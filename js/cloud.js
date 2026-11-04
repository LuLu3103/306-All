/* ============================================================
   云同步模块（Supabase，免登录 · 同步码模式）
   ------------------------------------------------------------
   同一份同步码下存两类数据，互不干扰：
     · 看板：boards 表 code = 同步码                → 已完成任务 id 数组
     · 转盘：boards 表 code = 同步码 + '#turntable' → { version, updatedAt, days }
   表结构见页面里的「配置指南」弹窗 / README。

   实现方式：直接用浏览器 fetch 调用 PostgREST 的 RPC 接口
   （/rest/v1/rpc/load_board、/rest/v1/rpc/save_board），
   不依赖任何 CDN 脚本，打开页面即可用；anon / publishable key
   通过 apikey + Authorization 头携带。

   对 app.js 暴露：
     Cloud.init()              Promise<{code, configured, ids, turntable}>
     Cloud.onStatus(fn)        状态变化回调
     Cloud.getStatus()         当前状态
     Cloud.getCode()           当前同步码（未连接返回 ''）
     Cloud.isConfigured()      是否已填写 Supabase 配置
     Cloud.connect(code)       Promise<{code, ids, turntable}>
     Cloud.disconnect()        断开本机同步
     Cloud.fetchDone()         Promise<string[]> 看板完成记录
     Cloud.fetchTurntable()    Promise<object|null> 转盘数据
     Cloud.saveDone(ids)       排队保存看板记录
     Cloud.saveTurntable(data) 排队保存转盘数据
     Cloud.flush()             立即保存排队中的变更
     Cloud.randomCode()        生成随机同步码
   ============================================================ */

window.Cloud = (function () {
  'use strict';

  var CODE_KEY = 'xizong-board.sync-code.v1';
  var TURNTABLE_SUFFIX = '#turntable';

  var STATUS = {
    UNCONFIGURED: 'unconfigured',
    OFFLINE: 'offline',
    IDLE: 'idle',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    ERROR: 'error'
  };

  // 若页面里已注入了 supabase-js 客户端（例如测试环境），优先使用它；
  // 正常浏览器里不加载任何 SDK，直接走 fetch。
  var client = null;
  var configured = false;
  var status = STATUS.UNCONFIGURED;

  var code = '';
  var pending = new Map(); // key -> value
  var saveTimer = null;
  var saving = false;

  var statusListeners = [];

  /* ---------------- 基础工具 ---------------- */

  function config() {
    var c = window.SUPABASE_CONFIG || {};
    return {
      url: String(c.url || '').trim().replace(/\/+$/, ''),
      anonKey: String(c.anonKey || '').trim()
    };
  }

  function isConfigured() {
    var c = config();
    return !!c.url && !!c.anonKey;
  }

  function emitStatus(next) {
    if (next === status) return;
    status = next;
    statusListeners.forEach(function (fn) {
      try { fn(next); } catch (e) { /* ignore */ }
    });
  }

  function storage() {
    try { return window.localStorage || null; } catch (e) { return null; }
  }

  function readUrlCode() {
    var search = (window.location && window.location.search) || '';
    var match = /[?&]code=([^&#]+)/.exec(search);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }

  function readCode() {
    var fromUrl = readUrlCode();
    if (fromUrl) { writeCode(fromUrl); return fromUrl; }
    var store = storage();
    return store ? String(store.getItem(CODE_KEY) || '').trim() : '';
  }

  function writeCode(value) {
    var store = storage();
    if (store) store.setItem(CODE_KEY, value);
  }

  function clearStoredCode() {
    var store = storage();
    if (store) store.removeItem(CODE_KEY);
  }

  function normalizeCode(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, '');
  }

  function randomCode(length) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    var size = length || 16;
    var out = '';
    var cryptoObj = window.crypto || window.msCrypto;
    var buf = null;
    if (cryptoObj && cryptoObj.getRandomValues) {
      buf = new Uint8Array(size);
      cryptoObj.getRandomValues(buf);
    }
    for (var i = 0; i < size; i++) {
      var n = buf ? buf[i] : Math.floor(Math.random() * 256);
      out += chars.charAt(n % chars.length);
    }
    return out;
  }

  function normalizeIds(data) {
    if (Array.isArray(data)) {
      return data.filter(function (id) { return typeof id === 'string'; });
    }
    if (typeof data === 'string') {
      try {
        var parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter(function (id) { return typeof id === 'string'; });
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  }

  function normalizeTurntable(data) {
    var value = data;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (e) { return null; }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!value.days || typeof value.days !== 'object' || Array.isArray(value.days)) return null;
    return value;
  }

  function turntableKey() { return code + TURNTABLE_SUFFIX; }

  /* ---------------- 传输层：优先 fetch，兼容注入的 SDK 客户端 ---------------- */

  function prepareTransport() {
    // 测试 / 特殊环境下可能注入了 supabase-js；正常页面里 window.supabase 不存在
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      var c = config();
      try {
        client = window.supabase.createClient(c.url, c.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
      } catch (e) {
        client = null;
      }
    }
    return Promise.resolve();
  }

  function nativeRpc(fn, payload) {
    var c = config();
    if (!c.url || !c.anonKey) {
      return Promise.reject(new Error('未配置 Supabase URL 或 anon key'));
    }
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('当前浏览器不支持 fetch，请升级浏览器'));
    }

    return fetch(c.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.anonKey,
        'Authorization': 'Bearer ' + c.anonKey
      },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return res.text().then(function (text) {
        if (!res.ok) {
          throw new Error('云端返回 ' + res.status + (text ? '：' + text.slice(0, 160) : ''));
        }
        if (!text) return null;
        try { return JSON.parse(text); } catch (e) { return null; }
      });
    });
  }

  function rpc(fn, payload) {
    if (client && typeof client.rpc === 'function') {
      return client.rpc(fn, payload).then(function (res) {
        if (res && res.error) throw new Error(res.error.message || '云端请求失败');
        return res ? res.data : null;
      });
    }
    return nativeRpc(fn, payload);
  }

  /* ---------------- 按键读写 ---------------- */

  function loadKey(key) {
    if (!code) return Promise.resolve(null);
    return rpc('load_board', { p_code: key });
  }

  function saveKey(key, value) {
    if (!code) return Promise.resolve();
    return rpc('save_board', { p_code: key, p_progress: value });
  }

  function fetchDone() {
    if (!code) {
      emitStatus(STATUS.IDLE);
      return Promise.resolve([]);
    }
    emitStatus(STATUS.SYNCING);
    return loadKey(code).then(function (data) {
      emitStatus(STATUS.SYNCED);
      return normalizeIds(data);
    }).catch(function (err) {
      emitStatus(STATUS.ERROR);
      throw err;
    });
  }

  function fetchTurntable() {
    if (!code) return Promise.resolve(null);
    return loadKey(turntableKey()).then(function (data) {
      return normalizeTurntable(data);
    }).catch(function () {
      return null;
    });
  }

  /* ---------------- 初始化 / 连接 ---------------- */

  function init() {
    configured = isConfigured();
    code = readCode();

    if (!configured) {
      emitStatus(STATUS.UNCONFIGURED);
      return Promise.resolve({ code: '', configured: false, ids: [], turntable: null });
    }

    emitStatus(STATUS.SYNCING);

    return prepareTransport().then(function () {
      if (!code) {
        emitStatus(STATUS.IDLE);
        return { code: '', configured: true, ids: [], turntable: null };
      }

      return Promise.all([fetchDone(), fetchTurntable()]).then(function (results) {
        emitStatus(STATUS.SYNCED);
        return { code: code, configured: true, ids: results[0] || [], turntable: results[1] || null };
      }).catch(function () {
        emitStatus(STATUS.OFFLINE);
        return { code: code, configured: true, ids: [], turntable: null };
      });
    });
  }

  function connect(newCode) {
    if (!isConfigured()) {
      return Promise.reject(new Error('云同步还没配置：请先填写 js/supabase-config.js 并刷新页面'));
    }
    var cleaned = normalizeCode(newCode);
    if (cleaned.length < 6) {
      return Promise.reject(new Error('同步码至少 6 位，建议用 12 位以上随机码'));
    }

    emitStatus(STATUS.SYNCING);
    var previousCode = code;
    code = cleaned;

    return prepareTransport().then(function () {
      return Promise.all([fetchDone(), fetchTurntable()]);
    }).then(function (results) {
      writeCode(cleaned);
      emitStatus(STATUS.SYNCED);
      return { code: cleaned, ids: results[0] || [], turntable: results[1] || null };
    }).catch(function (err) {
      if (!previousCode) code = '';
      emitStatus(STATUS.ERROR);
      throw new Error(err.message || '读取云端失败，请确认已执行建表 SQL');
    });
  }

  function disconnect() {
    code = '';
    pending.clear();
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    clearStoredCode();
    emitStatus(isConfigured() ? STATUS.IDLE : STATUS.UNCONFIGURED);
    return Promise.resolve();
  }

  /* ---------------- 保存（按 key 排队） ---------------- */

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      flush();
    }, 600);
  }

  function saveDone(ids) {
    if (!code) return;
    pending.set(code, (ids || []).slice());
    scheduleSave();
  }

  function saveTurntable(data) {
    if (!code) return;
    pending.set(turntableKey(), data);
    scheduleSave();
  }

  function flush() {
    if (!code || saving) return Promise.resolve();
    if (!pending.size) return Promise.resolve();

    var entries = Array.from(pending.entries());
    pending.clear();
    saving = true;
    emitStatus(STATUS.SYNCING);

    var chain = Promise.resolve();
    entries.forEach(function (entry) {
      chain = chain.then(function () { return saveKey(entry[0], entry[1]); });
    });

    return chain.then(function () {
      saving = false;
      emitStatus(STATUS.SYNCED);
    }).catch(function () {
      saving = false;
      entries.forEach(function (entry) { pending.set(entry[0], entry[1]); });
      emitStatus(STATUS.ERROR);
      scheduleSave();
    });
  }

  /* ---------------- 对外接口 ---------------- */

  return {
    init: init,
    onStatus: function (fn) { statusListeners.push(fn); },
    getStatus: function () { return status; },
    getCode: function () { return code; },
    isConfigured: isConfigured,
    connect: connect,
    disconnect: disconnect,
    fetchDone: fetchDone,
    fetchTurntable: fetchTurntable,
    saveDone: saveDone,
    saveTurntable: saveTurntable,
    flush: flush,
    randomCode: function () { return randomCode(16); },
    statusKeys: function () { return Object.keys(STATUS).map(function (k) { return STATUS[k]; }); }
  };
})();
