/* ============================================================
   访客统计（今日访客 / 总访客）
   ------------------------------------------------------------
   - 计数服务：abacus.jasoncameron.dev（免费公共计数 API，无需账号）
   - 统计口径：
       今日访客：同一浏览器每天计 1 次（按本地日期划分）
       总访客：每台设备累计只计 1 次
   - 展示位置：任何带 data-visit="today" / data-visit="total" 的元素
   - 降级策略：接口不可用时显示上次缓存值，或占位「—」，
     不影响页面其它功能；下次访问会自动重试计数
   ============================================================ */
(function () {
  'use strict';
  if (window.__visitorStatsInit) return;
  window.__visitorStatsInit = true;

  var API = 'https://abacus.jasoncameron.dev';
  var NS = 'lulu3103-306all';
  var KEY_DAY = '306all.visitor.day';
  var KEY_SEEN = '306all.visitor.seen';
  var KEY_LAST = '306all.visitor.last';

  var today = (function () {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return String(d.getFullYear()) + p(d.getMonth() + 1) + p(d.getDate());
  })();

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* 隐私模式等，忽略 */ }
  }
  function readCache() {
    try {
      var data = JSON.parse(read(KEY_LAST) || 'null');
      return data && typeof data === 'object' ? data : {};
    } catch (e) { return {}; }
  }
  function saveCache(patch) {
    var data = readCache();
    data.day = today;
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) data[k] = patch[k];
    }
    write(KEY_LAST, JSON.stringify(data));
  }

  function fmt(value) {
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function render(name, value) {
    var nodes = document.querySelectorAll('[data-visit="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = fmt(value);
  }

  /* 调用计数 API：/hit 自增并返回新值，/get 只读取 */
  function api(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      return data && typeof data.value === 'number' ? data.value : null;
    });
  }

  /* 已计过就只读取；没计过（或读取失败/计数不存在）就 +1 */
  function valueOf(key, counted, flagKey, flagValue) {
    function bump() {
      return api('/hit/' + NS + '/' + key).then(function (value) {
        write(flagKey, flagValue);
        return value;
      }, function () {
        return null;
      });
    }
    if (!counted) return bump();
    return api('/get/' + NS + '/' + key).then(function (value) {
      return value;
    }, function () {
      return null;
    }).then(function (value) {
      return value !== null ? value : bump();
    });
  }

  /* 先展示缓存值，避免接口慢时一直是占位符 */
  var cache = readCache();
  render('today', cache.day === today ? cache.today : null);
  render('total', cache.total);

  var dayCounted = read(KEY_DAY) === today;
  var totalCounted = read(KEY_SEEN) === '1';

  Promise.all([
    valueOf('uv-' + today, dayCounted, KEY_DAY, today),
    valueOf('uv-total', totalCounted, KEY_SEEN, '1')
  ]).then(function (values) {
    var patch = {};
    if (values[0] !== null) { patch.today = values[0]; render('today', values[0]); }
    if (values[1] !== null) { patch.total = values[1]; render('total', values[1]); }
    if (Object.keys(patch).length) saveCache(patch);
  }).catch(function () { /* 网络异常静默降级 */ });
})();
