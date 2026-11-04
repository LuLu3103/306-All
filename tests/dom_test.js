/* ============================================================
   页面脚本测试（Node + 极简 DOM 模拟）
   ------------------------------------------------------------
   场景 A：未配置 Supabase —— 页面正常渲染，进度仅内存保存
   场景 B：模拟已登录 Supabase —— 云端读取、写入、退出清空
   运行：node tests/dom_test.js
   ============================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 极简 DOM ---------------- */

class TextNode {
  constructor(t) { this.nodeType = 3; this._text = String(t); this.parentNode = null; }
  get textContent() { return this._text; }
  get tagName() { return null; }
}

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...names) { names.forEach((n) => this.set.add(n)); this._sync(); }
  remove(...names) { names.forEach((n) => this.set.delete(n)); this._sync(); }
  contains(n) { return this.set.has(n); }
  toggle(n, force) {
    if (force === true) this.set.add(n);
    else if (force === false) this.set.delete(n);
    else if (this.set.has(n)) this.set.delete(n);
    else this.set.add(n);
    this._sync();
    return this.set.has(n);
  }
  replaceFromString(s) {
    this.set = new Set(String(s || '').split(/\s+/).filter(Boolean));
    this.el.attrs['class'] = Array.from(this.set).join(' ');
  }
  _sync() { this.el.attrs['class'] = Array.from(this.set).join(' '); }
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.classList = new ClassList(this);
    this._listeners = {};
    this._text = null;
    this._html = '';
    this.hidden = false;
    this.title = '';
    this.type = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.href = '';
    this.download = '';

    const attrRef = this.attrs;
    this.dataset = new Proxy({}, {
      set(target, key, value) {
        target[key] = String(value);
        attrRef['data-' + String(key).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())] = String(value);
        return true;
      },
      get(target, key) { return target[key]; }
    });
  }
  get className() { return this.attrs['class'] || ''; }
  set className(v) { this.attrs['class'] = String(v); this.classList.replaceFromString(v); }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = String(v); }
  get textContent() {
    if (this._text !== null) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) { this._text = String(v); this.children = []; this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; this._text = null; }
  appendChild(node) { node.parentNode = this; this.children.push(node); this._text = null; return node; }
  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    node.parentNode = null;
    return node;
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'class') this.classList.replaceFromString(v);
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    const arr = this._listeners[t] || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  dispatchEvent(ev) {
    if (!ev.target) ev.target = this;
    (this._listeners[ev.type] || []).forEach((fn) => fn.call(this, ev));
    if (ev.bubbles && this.parentNode) this.parentNode.dispatchEvent(ev);
    return true;
  }
  click() { this.dispatchEvent(new Event('click', { bubbles: true })); }
  focus() { this.focused = true; }
  blur() { this.focused = false; }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (matchesSelector(cur, sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  querySelector(sel) { return querySelectorAll(this, sel)[0] || null; }
  querySelectorAll(sel) { return querySelectorAll(this, sel); }
}

class Event {
  constructor(type, opts) {
    this.type = type;
    this.bubbles = !!(opts && opts.bubbles);
    this.target = null;
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
}

function collectElements(root) {
  const out = [];
  const walk = (node) => {
    (node.children || []).forEach((child) => {
      if (child.nodeType === 1) { out.push(child); walk(child); }
    });
  };
  walk(root);
  return out;
}

function matchesSelector(el, selector) {
  const tagMatch = selector.match(/^[a-zA-Z*]+/);
  if (tagMatch && tagMatch[0] !== '*') {
    if (!el.tagName || el.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
  }
  const idMatch = selector.match(/#([\w-]+)/);
  if (idMatch && el.attrs.id !== idMatch[1]) return false;
  for (const m of selector.matchAll(/\.([\w-]+)/g)) if (!el.classList.contains(m[1])) return false;
  for (const m of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (!(m[1] in el.attrs)) return false;
    if (m[2] !== undefined && el.attrs[m[1]] !== m[2]) return false;
  }
  return true;
}

function ancestorsMatch(el, parts) {
  let idx = parts.length - 1;
  let cur = el.parentNode;
  while (cur && idx >= 0) {
    if (matchesSelector(cur, parts[idx])) idx--;
    cur = cur.parentNode;
  }
  return idx < 0;
}

function querySelectorAll(root, selector) {
  const groups = String(selector).split(',').map((s) => s.trim()).filter(Boolean);
  const results = [];
  groups.forEach((group) => {
    const parts = group.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1];
    collectElements(root).forEach((cand) => {
      if (!matchesSelector(cand, last)) return;
      if (parts.length === 1 || ancestorsMatch(cand, parts.slice(0, -1))) results.push(cand);
    });
  });
  return Array.from(new Set(results));
}

/* ---------------- 环境构建 ---------------- */

const SKELETONS = [
  ['subjectNav', 'nav'], ['subjectTitle', 'h2'], ['subjectMeta', 'span'], ['taskList', 'div'],
  ['emptyState', 'div'], ['overallPercent', 'strong'], ['totalDone', 'strong'],
  ['totalLeft', 'strong'], ['totalAll', 'strong'], ['ringOverall', 'div'], ['ringValue', 'circle'],
  ['statList', 'section'], ['tipCard', 'section'], ['btnExport', 'button'], ['btnImport', 'button'],
  ['importFile', 'input'], ['btnReset', 'button'], ['searchInput', 'input'],
  ['btnHideDone', 'button'], ['btnExpandAll', 'button'], ['btnCollapseAll', 'button'],
  ['syncChip', 'button'], ['syncText', 'span'],
  ['syncModal', 'div'], ['syncCodeInput', 'input'], ['syncError', 'p'],
  ['btnConnect', 'button'], ['btnGenCode', 'button'], ['btnDisconnect', 'button'],
  ['openSetupFromSync', 'button'], ['setupModal', 'div'], ['toast', 'div'],
  ['viewBoardBtn', 'button'], ['viewWheelBtn', 'button'],
  ['boardView', 'main'], ['wheelView', 'main'], ['boardFooter', 'footer'],
  ['btnStatsToggle', 'button'], ['statsPopover', 'div'], ['statsToggleText', 'span'], ['btnStatsClose', 'button'],
  ['btnShowSyncCode', 'button'], ['syncCodeCard', 'div'], ['syncCodeValue', 'code'],
  ['btnRevealSyncCode', 'button'], ['btnCopySyncCode', 'button'], ['syncCodeEmpty', 'p'],
  ['btnGuide', 'button'], ['guideModal', 'div'], ['btnGuideClose', 'button'],
  ['guideTabBoard', 'button'], ['guideTabWheel', 'button'], ['guideTabSync', 'button'],
  ['guidePanelBoard', 'div'], ['guidePanelWheel', 'div'], ['guidePanelSync', 'div']
];

function makeContext(options) {
  const opts = options || {};
  const body = new Element('body');
  const head = new Element('head');
  const documentListeners = {};
  const location = { hash: '' };
  const history = { replaceState(_s, _t, hash) { location.hash = String(hash || ''); } };

  const document = {
    readyState: 'complete',
    body,
    head,
    createElement: (tag) => new Element(tag),
    createTextNode: (t) => new TextNode(t),
    getElementById: (id) => body.querySelector('#' + id),
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener: (t, fn) => { (documentListeners[t] = documentListeners[t] || []).push(fn); },
    dispatchEvent: (ev) => {
      if (!ev.target) ev.target = document;
      (documentListeners[ev.type] || []).forEach((fn) => fn.call(document, ev));
      return true;
    }
  };

  const storage = new Map();
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };

  const windowListeners = {};
  const ctx = {
    document, location, history, localStorage, console, setTimeout, clearTimeout,
    alert: (m) => { ctx.__alerts.push(String(m)); },
    confirm: () => true,
    Event,
    Blob: class Blob {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL() {} },
    FileReader: class FileReader {},
    navigator: {},
    __alerts: [],
    __storage: storage,
    __location: location,
    __windowListeners: windowListeners
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, fn) => { (windowListeners[t] = windowListeners[t] || []).push(fn); };
  ctx.dispatchWindowEvent = (ev) => { (windowListeners[ev.type] || []).forEach((fn) => fn.call(ctx, ev)); };

  SKELETONS.forEach(([id, tag]) => {
    const node = new Element(tag);
    node.id = id;
    body.appendChild(node);
  });

  // 转盘模块的轻量替身（看板测试不加载 Canvas 相关脚本）
  ctx.__ttRefresh = 0;
  ctx.__ttSetCloud = [];
  ctx.Turntable = {
    refresh() { ctx.__ttRefresh++; },
    setCloud(payload) { ctx.__ttSetCloud.push(payload || null); },
    updateCloudNote() {},
    getData() { return { version: 1, days: {} }; },
    isConnected() { return false; }
  };

  return ctx;
}

/* ---------------- 断言 ---------------- */

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else {
    failures.push(name);
    console.log('  ✗ ' + name + '  期望=' + JSON.stringify(expected) + '  实际=' + JSON.stringify(actual));
  }
}

function runFiles(ctx, files) {
  vm.createContext(ctx);
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
}

function countTasks(doc) { return doc.querySelectorAll('#taskList .task').length; }
function countChapters(doc) { return doc.querySelectorAll('#taskList .chapter').length; }
function navNames(doc) { return doc.querySelectorAll('#subjectNav .subject-btn__name').map((n) => n.textContent); }

async function waitFor(fn, timeout) {
  const limit = timeout || 3000;
  const t0 = Date.now();
  while (Date.now() - t0 < limit) {
    if (fn()) return true;
    await sleep(25);
  }
  return false;
}

/* ---------------- 场景 A：未配置云同步 ---------------- */

async function scenarioA() {
  console.log('\n===== 场景 A：未配置 Supabase =====');

  const ctx = makeContext();
  ctx.SUPABASE_CONFIG = { url: '', anonKey: '' };
  runFiles(ctx, ['data/tasks.js', 'js/cloud.js', 'js/app.js']);
  const doc = ctx.document;

  console.log('\n[A1] 基础渲染');
  check('五个学科按钮', navNames(doc), ['生理', '病理', '内科', '外科', '生化']);
  check('默认学科生理', doc.querySelector('#subjectTitle').textContent, '生理');
  check('总任务数 251', doc.querySelector('#totalAll').textContent, '251');
  check('生理章节 12', countChapters(doc), 12);
  check('生理任务 59', countTasks(doc), 59);
  check('统计行 5', doc.querySelectorAll('#statList .stat-row').length, 5);
  check('云同步提示未配置', doc.querySelector('#syncText').textContent, '云同步未配置');
  check('同步状态标记', doc.querySelector('#syncChip').dataset.status, 'unconfigured');

  console.log('\n[A2] 勾选与统计（内存）');
  const firstTask = doc.querySelectorAll('#taskList .task')[0];
  const cb = firstTask.querySelector('input');
  cb.checked = true;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
  check('总完成 1', doc.querySelector('#totalDone').textContent, '1');
  check('总剩余 250', doc.querySelector('#totalLeft').textContent, '250');
  check('进度环偏移已更新', typeof doc.querySelector('#ringValue').style.strokeDashoffset, 'string');
  check('提示卡显示未连接', doc.querySelector('#tipCard .tip-card__kv').textContent.indexOf('未连接') >= 0, true);

  console.log('\n[A3] 切换学科 / 筛选');
  doc.querySelectorAll('#subjectNav .subject-btn')[2].dispatchEvent(new Event('click'));
  check('切到内科', doc.querySelector('#subjectTitle').textContent, '内科');
  check('内科 8 章', countChapters(doc), 8);
  check('内科 80 项', countTasks(doc), 80);
  check('hash 同步', ctx.__location.hash, '#internal');

  const internalTask = doc.querySelectorAll('#taskList .task')[0];
  const internalCb = internalTask.querySelector('input');
  internalCb.checked = true;
  internalCb.dispatchEvent(new Event('change', { bubbles: true }));

  doc.querySelector('#btnHideDone').dispatchEvent(new Event('click'));
  check('隐藏已完成文案', doc.querySelector('#btnHideDone').textContent, '显示全部');
  check('隐藏后可见 79', countTasks(doc), 79);
  doc.querySelector('#btnHideDone').dispatchEvent(new Event('click'));

  const input = doc.querySelector('#searchInput');
  input.value = '骨折';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(260);
  const names = doc.querySelectorAll('#taskList .task .task__name').map((n) => n.textContent);
  check('内科搜索“骨折”无结果', names.length, 0);
  check('显示空状态', doc.querySelector('#emptyState').hidden, false);

  console.log('\n[A4] 视图切换（看板 / 转盘）');
  doc.querySelector('#viewWheelBtn').dispatchEvent(new Event('click'));
  check('切到转盘后看板隐藏', doc.querySelector('#boardView').hidden, true);
  check('切到转盘后转盘显示', doc.querySelector('#wheelView').hidden, false);
  check('body 标记 view-wheel', doc.body.classList.contains('view-wheel'), true);
  check('触发转盘刷新', ctx.__ttRefresh > 0, true);
  check('地址栏切到 #wheel', ctx.__location.hash, '#wheel');

  doc.querySelector('#viewBoardBtn').dispatchEvent(new Event('click'));
  check('切回看板', doc.querySelector('#boardView').hidden, false);
  check('切回看板后转盘隐藏', doc.querySelector('#wheelView').hidden, true);
  check('body 移除 view-wheel', doc.body.classList.contains('view-wheel'), false);

  console.log('\n[A5] 顶栏统计面板');
  check('统计面板默认收起', doc.querySelector('#statsPopover').hidden, true);
  doc.querySelector('#btnStatsToggle').dispatchEvent(new Event('click'));
  check('点按钮展开统计', doc.querySelector('#statsPopover').hidden, false);
  check('按钮标记展开', doc.querySelector('#btnStatsToggle').getAttribute('aria-expanded'), 'true');
  check('统计按钮显示百分比', /%$/.test(doc.querySelector('#statsToggleText').textContent), true);
  check('面板内仍渲染 5 个学科行', doc.querySelectorAll('#statList .stat-row').length, 5);

  const statRow = doc.querySelectorAll('#statList .stat-row')[1];
  statRow.dispatchEvent(new Event('click', { bubbles: true }));
  check('点学科行切换并收起面板', doc.querySelector('#subjectTitle').textContent, '病理');
  check('切换后统计面板收起', doc.querySelector('#statsPopover').hidden, true);

  doc.querySelector('#btnStatsToggle').dispatchEvent(new Event('click'));
  doc.querySelector('#btnStatsClose').dispatchEvent(new Event('click'));
  check('关闭按钮可收起', doc.querySelector('#statsPopover').hidden, true);

  doc.querySelector('#btnStatsToggle').dispatchEvent(new Event('click'));
  ctx.document.dispatchEvent(new Event('click'));
  check('点面板外可收起', doc.querySelector('#statsPopover').hidden, true);

  console.log('\n[A6] 使用说明弹窗');
  doc.querySelector('#btnGuide').dispatchEvent(new Event('click'));
  check('打开使用说明', doc.querySelector('#guideModal').hidden, false);
  check('默认显示看板说明', doc.querySelector('#guidePanelBoard').hidden, false);
  check('转盘说明隐藏', doc.querySelector('#guidePanelWheel').hidden, true);
  doc.querySelector('#guideTabWheel').dispatchEvent(new Event('click'));
  check('切换到转盘说明', doc.querySelector('#guidePanelWheel').hidden, false);
  check('看板说明隐藏', doc.querySelector('#guidePanelBoard').hidden, true);
  check('转盘 tab 激活', doc.querySelector('#guideTabWheel').classList.contains('is-active'), true);
  doc.querySelector('#btnGuideClose').dispatchEvent(new Event('click'));
  check('关闭使用说明', doc.querySelector('#guideModal').hidden, true);

  doc.querySelector('#viewWheelBtn').dispatchEvent(new Event('click'));
  doc.querySelector('#btnGuide').dispatchEvent(new Event('click'));
  check('转盘视图点说明默认显示转盘页', doc.querySelector('#guidePanelWheel').hidden, false);
  doc.querySelector('#viewBoardBtn').dispatchEvent(new Event('click'));
}

/* ---------------- 场景 B：同步码云同步（模拟 Supabase） ---------------- */

function makeMockSupabase() {
  const calls = { loads: [], saves: [] };
  const cloudIds = ['int-ch1-1'];

  const client = {
    rpc(name, params) {
      if (name === 'load_board') {
        calls.loads.push(params.p_code);
        return Promise.resolve({
          data: params.p_code === 'TESTCODE123' ? cloudIds.slice() : [],
          error: null
        });
      }
      if (name === 'save_board') {
        calls.saves.push({ code: params.p_code, ids: (params.p_progress || []).slice() });
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }
  };

  return { client, calls, cloudIds };
}

async function scenarioB() {
  console.log('\n===== 场景 B：同步码云同步（模拟 Supabase） =====');

  const mock = makeMockSupabase();
  const ctx = makeContext();
  ctx.SUPABASE_CONFIG = { url: 'https://mock.supabase.co', anonKey: 'mock-anon-key' };
  ctx.supabase = { createClient: () => mock.client };
  runFiles(ctx, ['data/tasks.js', 'js/cloud.js', 'js/app.js']);
  const doc = ctx.document;

  await waitFor(() => doc.querySelector('#syncText').textContent === '设置同步码', 3000);
  check('未设置同步码时的状态', doc.querySelector('#syncText').textContent, '设置同步码');

  console.log('\n[B1] 打开弹窗 → 连接同步码');
  doc.querySelector('#syncChip').dispatchEvent(new Event('click'));
  check('同步弹窗已打开', doc.querySelector('#syncModal').hidden, false);

  const codeInput = doc.querySelector('#syncCodeInput');
  codeInput.value = 'TESTCODE123';
  doc.querySelector('#btnConnect').dispatchEvent(new Event('click'));

  const connected = await waitFor(() => doc.querySelector('#totalDone').textContent === '1', 3000);
  check('连接后载入云端 1 条', connected, true);
  check('连接后状态已同步', doc.querySelector('#syncText').textContent, '已同步');
  check('同步码已保存到本机', ctx.__storage.get('xizong-board.sync-code.v1'), 'TESTCODE123');

  console.log('\n[B1+] 查看 / 复制本机同步码');
  doc.querySelector('#btnShowSyncCode').dispatchEvent(new Event('click'));
  check('同步码卡片显示', doc.querySelector('#syncCodeCard').hidden, false);
  check('展示完整同步码', doc.querySelector('#syncCodeValue').textContent, 'TESTCODE123');
  doc.querySelector('#btnRevealSyncCode').dispatchEvent(new Event('click'));
  check('点隐藏后打码', doc.querySelector('#syncCodeValue').textContent, 'TEST••••23');
  doc.querySelector('#btnRevealSyncCode').dispatchEvent(new Event('click'));
  check('再点显示恢复完整', doc.querySelector('#syncCodeValue').textContent, 'TESTCODE123');

  console.log('\n[B2] 勾选后写入云端');
  const firstTask = doc.querySelectorAll('#taskList .task')[0];
  const cb = firstTask.querySelector('input');
  cb.checked = true;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(900);
  check('触发 save_board', mock.calls.saves.length >= 1, true);
  const last = mock.calls.saves[mock.calls.saves.length - 1] || { code: '', ids: [] };
  check('写入用同一同步码', last.code, 'TESTCODE123');
  check('写入包含 2 条记录', last.ids.length, 2);
  check('总完成 2', doc.querySelector('#totalDone').textContent, '2');

  console.log('\n[B3] 断开同步清空本页');
  doc.querySelector('#btnDisconnect').dispatchEvent(new Event('click'));
  const disconnected = await waitFor(() => doc.querySelector('#syncText').textContent === '设置同步码', 3000);
  check('断开后状态未连接', disconnected, true);
  check('断开后本页数据清空', doc.querySelector('#totalDone').textContent, '0');
  check('本机同步码已清除', ctx.__storage.get('xizong-board.sync-code.v1'), undefined);
  check('断开后同步码卡片隐藏', doc.querySelector('#syncCodeCard').hidden, true);
  check('断开后显示找回提示', doc.querySelector('#syncCodeEmpty').hidden, false);

  console.log('\n[B4] 再次连接同一同步码可恢复');
  doc.querySelector('#syncChip').dispatchEvent(new Event('click'));
  doc.querySelector('#syncCodeInput').value = 'TESTCODE123';
  doc.querySelector('#btnConnect').dispatchEvent(new Event('click'));
  const restored = await waitFor(() => doc.querySelector('#totalDone').textContent === '1', 3000);
  check('重新连接恢复云端记录', restored, true);
}

/* ---------------- 场景 C：原生 fetch 调用 Supabase RPC（不加载 SDK） ---------------- */

async function scenarioC() {
  console.log('\n===== 场景 C：原生 fetch 云同步（无 SDK） =====');

  const ctx = makeContext();
  ctx.SUPABASE_CONFIG = { url: 'https://demo.supabase.co/', anonKey: 'sb_publishable_demo' };
  ctx.__requests = [];
  ctx.fetch = function (url, options) {
    const opts = options || {};
    const body = opts.body ? JSON.parse(opts.body) : {};
    ctx.__requests.push({ url, opts, body });
    if (String(url).indexOf('/rpc/load_board') !== -1) {
      const value = String(body.p_code || '').slice(-10) === '#turntable'
        ? { version: 1, days: {} }
        : ['phy-ch2-1', 'bio-ch1-1'];
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(value)) });
    }
    return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
  };
  ctx.__storage.set('xizong-board.sync-code.v1', 'LOCALCODE1');
  runFiles(ctx, ['js/cloud.js']);

  const result = await ctx.Cloud.init();
  check('初始化读取本机同步码', result.code, 'LOCALCODE1');
  check('载入看板记录', result.ids.length, 2);
  check('状态为已同步', ctx.Cloud.getStatus(), 'synced');

  const loads = ctx.__requests.filter((r) => r.url.indexOf('/rpc/load_board') !== -1);
  check('load_board 调用 2 次（看板 + 转盘）', loads.length, 2);
  check('请求 URL 使用配置的地址', loads[0].url, 'https://demo.supabase.co/rest/v1/rpc/load_board');
  check('请求携带 apikey', loads[0].opts.headers.apikey, 'sb_publishable_demo');
  check('请求携带 Bearer', loads[0].opts.headers.Authorization, 'Bearer sb_publishable_demo');
  check('转盘用 #turntable 后缀', loads.some((r) => String(r.body.p_code).slice(-10) === '#turntable'), true);

  console.log('\n[C1] 保存同样走原生 fetch');
  ctx.Cloud.saveDone(['phy-ch2-1', 'bio-ch1-1', 'bio-ch1-2']);
  ctx.Cloud.saveTurntable({ version: 1, days: { '2026-11-04': { records: [] } } });
  await ctx.Cloud.flush();
  const saves = ctx.__requests.filter((r) => r.url.indexOf('/rpc/save_board') !== -1);
  check('save_board 调用 2 次', saves.length, 2);
  check('看板保存内容', saves[0].body.p_progress.length, 3);
  check('转盘保存 key 带后缀', String(saves[1].body.p_code).slice(-10), '#turntable');
}

/* ---------------- 入口 ---------------- */

(async () => {
  try {
    await scenarioA();
    await scenarioB();
    await scenarioC();
  } catch (err) {
    failures.push('运行异常：' + err.message);
    console.error('\n运行异常：', err);
  }

  console.log('\n==============================');
  console.log('通过 ' + passed + ' 项断言，失败 ' + failures.length + ' 项');
  if (failures.length) {
    console.log('失败项：' + failures.join(' / '));
    process.exitCode = 1;
  }
})();
