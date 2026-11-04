/* ============================================================
   学习转盘页面逻辑测试（Node + 极简 DOM，Canvas 打桩）
   - 验证合并后转盘视图能正常初始化
   - 验证云同步：setCloud 载入 / 合并 / 断开 / 写回
   运行：node tests/turntable_app_test.js
   ============================================================ */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

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

/* ---------------- 环境 ---------------- */

const IDS = [
  "clock", "clockDate", "viewMeta", "datePicker", "prevDay", "nextDay", "todayBtn",
  "storagePill", "footerNote", "wheelModePill", "wheelStage", "wheelCanvas", "hubSpin", "spinBtn",
  "resultCard", "resultEmpty", "resultEmptyText", "resultBody", "resultType", "resultTime",
  "resultNote", "resultProgress", "resultProgressBar", "resultDone", "resultAgain",
  "taskSub", "taskViewPill", "ttTaskList", "taskEmpty", "taskEmptyText", "taskFootHint", "clearDayBtn",
  "rangeToday", "rangeWeek", "rangeMonth", "statsNote",
  "statsSub", "statsPill", "statStudy", "statStudySub", "statRest", "statRestSub", "statDone", "statDoneSub",
  "ratioStudy", "ratioRest", "ratioStudyBar", "ratioRestBar",
  "chartBtn", "saveChartBtn", "chartArea", "donutChartTitle", "donutChart", "barChartTitle", "barChart",
  "chartHint", "donutLegendStudy", "donutLegendRest",
  "helpBtn", "helpModal", "helpBackdrop", "helpClose", "helpOk",
  "exportBtn", "importBtn", "ttImportFile", "resetAllBtn", "ttToast"
];

const CANVAS_IDS = new Set(["wheelCanvas", "donutChart", "barChart"]);
const INPUT_IDS = new Set(["datePicker", "ttImportFile"]);
const RANGE_IDS = { rangeToday: "today", rangeWeek: "week", rangeMonth: "month" };

function makeCanvas() {
  const canvas = new Element("canvas");
  canvas.width = 420;
  canvas.height = 420;
  canvas.clientWidth = 420;
  const noop = () => {};
  canvas.getContext = () => new Proxy({}, {
    get(target, key) {
      if (key === "measureText") return () => ({ width: 12 });
      if (key in target) return target[key];
      return noop;
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  return canvas;
}

function makeTurntableContext() {
  const body = new Element("body");
  const head = new Element("head");
  const location = { hash: "" };
  const history = { replaceState(_s, _t, h) { location.hash = String(h || ""); } };

  const documentObj = {
    readyState: "complete",
    body,
    head,
    createElement: (tag) => new Element(tag),
    createTextNode: (t) => new TextNode(t),
    getElementById: (id) => body.querySelector("#" + id),
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener: () => {},
    dispatchEvent: () => true
  };

  const wrap = new Element("div");
  wrap.clientWidth = 480;
  body.appendChild(wrap);

  IDS.forEach((id) => {
    let node;
    if (CANVAS_IDS.has(id)) {
      node = makeCanvas();
      node.parentElement = wrap;
      wrap.appendChild(node);
    } else if (INPUT_IDS.has(id)) {
      node = new Element("input");
      body.appendChild(node);
    } else if (RANGE_IDS[id]) {
      node = new Element("button");
      node.className = "range-tab";
      node.dataset.range = RANGE_IDS[id];
      body.appendChild(node);
    } else {
      node = new Element("div");
      body.appendChild(node);
    }
    node.id = id;
  });

  const ctx = {
    document: documentObj,
    location,
    history,
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    Event,
    Blob: class Blob {},
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL() {} },
    FileReader: class FileReader {},
    navigator: {},
    __saves: []
  };
  ctx.window = ctx;
  ctx.addEventListener = () => {};
  ctx.dispatchWindowEvent = () => {};

  ctx.Cloud = {
    getCode: () => "TESTCODE",
    init: () => Promise.resolve({ code: "TESTCODE", configured: true, ids: [], turntable: null }),
    connect: () => Promise.resolve({ code: "TESTCODE", ids: [], turntable: null }),
    disconnect: () => Promise.resolve(),
    onStatus: () => {},
    saveDone: () => {},
    saveTurntable: (data) => { ctx.__saves.push(data); },
    fetchDone: () => Promise.resolve([]),
    fetchTurntable: () => Promise.resolve(null),
    flush: () => {},
    updateCloudNote: () => {}
  };

  return ctx;
}

function runFiles(ctx, files) {
  vm.createContext(ctx);
  files.forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  });
}

/* ---------------- 断言 ---------------- */

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed += 1; console.log("  ✓ " + name); }
  else {
    failures.push(name);
    console.log("  ✗ " + name + "  期望=" + JSON.stringify(expected) + "  实际=" + JSON.stringify(actual));
  }
}

function main() {
  const ctx = makeTurntableContext();
  runFiles(ctx, [
    "js/turntable/core.js",
    "js/turntable/wheel.js",
    "js/turntable/charts.js",
    "js/turntable/app.js"
  ]);

  const C = ctx.STCore;
  const doc = ctx.document;
  const get = (id) => doc.getElementById(id);

  console.log("\n[T1] 初始化（未连接云同步）");
  check("导出 Turntable API", typeof ctx.Turntable, "object");
  check("API refresh", typeof ctx.Turntable.refresh, "function");
  check("初始无记录", ctx.Turntable.getData().days, {});
  check("云端标注", get("storagePill").textContent, "未连接云端");
  check("学习统计初始值", get("statStudy").textContent, "0min");
  check("范围 tab 数量", doc.querySelectorAll(".range-tab").length, 3);
  check("初始未连接", ctx.Turntable.isConnected(), false);

  console.log("\n[T2] 连接云同步并载入转盘记录");
  const today = C.toDateString(new Date());
  const record = { id: "rec-1", type: "study", minutes: 30, done: true, createdAt: Date.now() - 1000 };
  ctx.Turntable.setCloud({
    connected: true,
    data: { version: 1, days: { [today]: { records: [record] } } }
  });
  check("已连接", ctx.Turntable.isConnected(), true);
  check("载入 1 条记录", ctx.Turntable.getData().days[today].records.length, 1);
  check("云端标注已同步", get("storagePill").textContent, "云端已同步");
  check("任务栏渲染 1 条", get("ttTaskList").children.length, 1);
  check("学习时长统计", get("statStudy").textContent, "30min");
  check("完成数统计", get("statDone").innerHTML, "1<small>项</small>");
  check("写回云端 1 次", ctx.__saves.length, 1);
  check("写回内容含记录", ctx.__saves[0].days[today].records.length, 1);

  console.log("\n[T3] 云端重复记录按 id 合并");
  ctx.Turntable.setCloud({
    connected: true,
    data: {
      version: 1,
      days: {
        [today]: {
          records: [
            { id: "rec-1", type: "study", minutes: 60, done: true, createdAt: Date.now() - 500 },
            { id: "rec-2", type: "rest", minutes: 10, done: false, createdAt: Date.now() }
          ]
        }
      }
    }
  });
  check("同 id 不重复", ctx.Turntable.getData().days[today].records.length, 2);
  check("首次记录时长保留", ctx.Turntable.getData().days[today].records[0].minutes, 30);
  check("学习时长仍为 30min", get("statStudy").textContent, "30min");
  check("休息统计 10min", get("statRest").textContent, "10min");

  console.log("\n[T4] 断开同步后清空本页转盘数据");
  ctx.Turntable.setCloud({ connected: false, data: null });
  check("断开状态", ctx.Turntable.isConnected(), false);
  check("记录清空", ctx.Turntable.getData().days, {});
  check("标注未连接", get("storagePill").textContent, "未连接云端");
  check("任务栏清空", get("ttTaskList").children.length, 0);

  console.log("\n[T5] 云端返回空数据不报错");
  ctx.Turntable.setCloud({ connected: true, data: null });
  check("仍为空", ctx.Turntable.getData().days, {});
  ctx.Turntable.refresh();
  check("refresh 后仍正常", get("statStudy").textContent, "0min");

  console.log("\n==============================");
  console.log("通过 " + passed + " 项断言，失败 " + failures.length + " 项");
  if (failures.length) {
    console.log("失败项：" + failures.join(" / "));
    process.exitCode = 1;
  }
}

main();
