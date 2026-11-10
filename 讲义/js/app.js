/* global TOC_DATA, pdfjsLib */
(function () {
  'use strict';

  var TOC = window.TOC_DATA;
  var SUBJECTS = TOC.subjects;
  var pdfjs = window.pdfjsLib;

  /* ---------------- DOM ---------------- */
  var $ = function (sel) { return document.querySelector(sel); };
  var sidebar = $('#sidebar');
  var scroller = $('#scroller');
  var pagesHost = $('#pages');
  var overlay = $('#overlay');
  var overlayTitle = $('#overlayTitle');
  var loadStatus = $('#loadStatus');
  var pageLabel = $('#pageLabel');
  var curSection = $('#curSection');
  var jumpInput = $('#jumpInput');
  var zoomSelect = $('#zoomSelect');
  var tocHost = $('#toc');
  var tocFilter = $('#tocFilter');
  var jumpForm = $('#jumpForm');
  var subjectsHost = $('#subjects');
  var subjectLabel = $('#subjectLabel');
  var rawPdf = $('#rawPdf');
  var volumesHost = $('#volumes');

  /* ---------------- 性能参数（按需加载的关键） ---------------- */
  var PAGE_MAX_WIDTH = 1180;        // 单页最大显示宽度（CSS px）
  var MAX_CANVAS_PIXELS = 4.2e6;    // 单页画布像素上限：控制单页渲染耗时与内存
  var MAX_CONCURRENT_RENDERS = 2;   // 同时渲染的页数
  var OBSERVER_MARGIN = '600px 0px'; // 视口外预渲染范围（越小越省流量）

  /* ---------------- state ---------------- */
  var state = {
    subjectId: null,
    subject: null,
    vol: 0,
    doc: null,
    docTask: null,
    pageProxies: [],      // 已取得元数据的页（懒加载）
    pagePromises: [],     // 正在取的页
    baseViewports: [],    // 每页原始尺寸（懒加载，未知时用 defaultViewport）
    defaultViewport: null,
    wrappers: [],
    papers: [],
    canvases: [],
    hints: [],
    renderedScale: [],
    renderTasks: [],
    renderScale: [],
    wantRender: [],
    pending: [],          // 待渲染队列
    rendering: 0,         // 正在渲染的数量
    sectionStart: {},
    sectionAtPage: [],
    tocButtons: [],
    currentPage: 1,
    scaleMode: 'fit',
    generation: 0,
    observer: null,
    saved: {},
    savedVol: {},
    loadToken: 0,
    tops: [],             // 每页相对滚动容器的偏移（缓存，避免每次滚动算 rect）
    topsDirty: true,
  };

  /*
   * 关键优化：disableAutoFetch + disableStream
   *   默认配置下 pdf.js 会在后台把整本 PDF 连续下载完（内科 86MB → 打开一页要等 80MB+）。
   *   关掉自动预取与流式整本传输后，只按 Range 取“当前页 + 目录索引”真正需要的数据。
   * rangeChunkSize 16KB：PDF 的页面字典是零散分布的，每次都要按 chunk 对齐读取，
   *   实测 64KB→12.7MB、16KB→3.8MB（生理上册首屏），而请求数几乎不变，所以取小块；
   *   页面内容/图片流是按精确长度读取的，不受 chunk 大小影响。
   */
  var PDFJS_OPTS = {
    cMapUrl: 'vendor/pdfjs/cmaps/',
    cMapPacked: true,
    useSystemFonts: true,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: false,
    rangeChunkSize: 16384,
  };

  /* ---------------- utils ---------------- */
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mb(bytes) { return (bytes / 1048576).toFixed(1); }

  function showOverlay(title, sub) {
    overlay.classList.remove('hidden', 'is-error');
    overlayTitle.textContent = title;
    loadStatus.textContent = sub || '';
    var sp = overlay.querySelector('.spinner');
    if (sp) { sp.style.display = ''; }
  }

  function setOverlaySub(sub) { loadStatus.textContent = sub; }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function showError(title, detail) {
    overlay.classList.remove('hidden');
    overlay.classList.add('is-error');
    overlayTitle.textContent = title;
    loadStatus.innerHTML = detail;
    var sp = overlay.querySelector('.spinner');
    if (sp) { sp.style.display = 'none'; }
  }

  function subjectById(id) {
    for (var i = 0; i < SUBJECTS.length; i++) {
      if (SUBJECTS[i].id === id) { return SUBJECTS[i]; }
    }
    return null;
  }

  /* ---------------- 讲义页码（md） → PDF 页 / 分册 ---------------- */
  function mdAnchors(subject) {
    var anchors = [];
    (subject.parts || []).forEach(function (part) {
      if (part.page != null) { anchors.push({ page: part.page, pdf: part.pdf, vol: part.vol || 0 }); }
      (part.items || []).forEach(function (it) {
        if (it.page != null) { anchors.push({ page: it.page, pdf: it.pdf, vol: it.vol || 0 }); }
      });
    });
    anchors.sort(function (a, b) { return a.page - b.page; });
    return anchors;
  }

  /**
   * 把讲义页码（目录左侧 p.X，也是进度看板里的 PX）解析成 PDF 页码与分册。
   * 目录条目本身就是锚点，命中即精确跳转；未命中时按相邻锚点的页码差推算。
   */
  function mdToPdf(subject, mdPage) {
    mdPage = parseInt(mdPage, 10);
    if (!subject || isNaN(mdPage) || mdPage < 1) { return null; }
    var anchors = mdAnchors(subject);
    if (!anchors.length) { return null; }

    var i;
    for (i = 0; i < anchors.length; i++) {
      if (anchors[i].page === mdPage) {
        return { pdf: anchors[i].pdf, vol: anchors[i].vol, md: mdPage, exact: true };
      }
    }

    var before = null, after = null;
    for (i = 0; i < anchors.length; i++) {
      if (anchors[i].page < mdPage) { before = anchors[i]; }
      else { after = anchors[i]; break; }
    }

    var target;
    if (before) {
      var volCount = ((subject.volumes[before.vol] || {}).pdfPageCount) || 1;
      var pdf = before.pdf + (mdPage - before.page);
      if (pdf > volCount) {
        if (after && after.vol !== before.vol) {
          target = { pdf: after.pdf, vol: after.vol };
        } else {
          target = { pdf: volCount, vol: before.vol };
        }
      } else {
        if (after && after.vol === before.vol && pdf > after.pdf) { pdf = after.pdf; }
        target = { pdf: pdf, vol: before.vol };
      }
    } else if (after) {
      target = { pdf: after.pdf, vol: after.vol };
    } else {
      return null;
    }

    var total = ((subject.volumes[target.vol] || {}).pdfPageCount) || 1;
    target.pdf = clamp(target.pdf, 1, total);
    target.md = mdPage;
    target.exact = false;
    return target;
  }

  function itemCount(subject) {
    var n = 0;
    (subject.parts || []).forEach(function (p) { n += (p.items || []).length; });
    return n;
  }

  /* ---------------- volumes (外科上/下合订) ---------------- */
  function normalizeAll() {
    SUBJECTS.forEach(function (s) {
      if (!s.volumes) {
        s.volumes = [{ label: '', file: s.file, pdfPageCount: s.pdfPageCount }];
      }
      s.mergedVolumes = s.volumes.length > 1;
      s.pdfPageCount = s.volumes.reduce(function (n, v) { return n + v.pdfPageCount; }, 0);
    });
  }

  function volumeOf(subject, vol) {
    return subject.volumes[clamp(vol || 0, 0, subject.volumes.length - 1)];
  }

  function volumeLabel(subject, vol) {
    var v = volumeOf(subject, vol);
    return v && v.label ? v.label : '';
  }

  function volumeShort(subject, vol) {
    return volumeLabel(subject, vol).replace('册', '');
  }

  function savedKey(id, vol) { return id + ':' + vol; }

  function currentVolume() { return volumeOf(state.subject, state.vol); }

  function totalPages(s) {
    return s.volumes.reduce(function (n, v) { return n + v.pdfPageCount; }, 0);
  }

  /* ---------------- subject tabs ---------------- */
  function buildSubjectTabs() {
    var frag = document.createDocumentFragment();
    SUBJECTS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'subject-tab';
      b.dataset.subject = s.id;
      var sub = s.mergedVolumes ? ('（' + s.volumes.map(function (v) { return v.label; }).join('+') + '）') : '';
      b.title = s.name + sub + ' · ' + totalPages(s) + ' 页 · ' + itemCount(s) + ' 个目录条目';
      var n = document.createElement('span');
      n.className = 'n';
      n.textContent = s.name;
      var m = document.createElement('span');
      m.className = 'm';
      m.textContent = totalPages(s) + ' 页 · ' + itemCount(s) + ' 节';
      b.appendChild(n);
      b.appendChild(m);
      frag.appendChild(b);
    });
    subjectsHost.appendChild(frag);
    subjectsHost.addEventListener('click', function (e) {
      var b = e.target.closest('.subject-tab');
      if (!b) { return; }
      var id = b.dataset.subject;
      if (id !== state.subjectId) { loadSubject(id, null, null); }
    });
  }

  function renderVolumeSwitch() {
    volumesHost.innerHTML = '';
    var s = state.subject;
    var show = s.mergedVolumes;
    volumesHost.classList.toggle('is-hidden', !show);
    if (!show) { return; }
    s.volumes.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'volume-tab';
      b.dataset.vol = String(i);
      b.classList.toggle('active', i === state.vol);
      b.textContent = v.label + '（' + v.pdfPageCount + ' 页）';
      b.title = v.label + (v.note ? ' · ' + v.note : '') + ' · ' + v.pdfPageCount + ' 页';
      volumesHost.appendChild(b);
    });
  }

  function updateSubjectUI() {
    var s = state.subject;
    subjectsHost.querySelectorAll('.subject-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.subject === s.id);
    });
    subjectLabel.textContent = s.name + (s.mergedVolumes ? '·' + volumeLabel(s, state.vol) : '');
    rawPdf.href = currentVolume().file;
    renderVolumeSwitch();
    pageLabel.textContent = '加载中…';
    curSection.textContent = '';
  }

  /* ---------------- TOC ---------------- */
  function rebuildTOC() {
    var s = state.subject;
    tocHost.innerHTML = '';
    state.tocButtons = [];
    var frag = document.createDocumentFragment();

    (s.front || []).forEach(function (f) {
      frag.appendChild(makeTocItem(f.title, null, f.pdf, f.vol || 0));
    });

    (s.parts || []).forEach(function (part) {
      var pvol = part.vol || 0;
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'toc-part';
      head.dataset.pdf = String(part.pdf || 1);
      head.dataset.vol = String(pvol);
      var t = document.createElement('span');
      t.textContent = part.title;
      head.appendChild(t);
      var hint = document.createElement('span');
      hint.className = 'pdf-hint';
      var vp = s.mergedVolumes ? (volumeShort(s, pvol) + ' · ') : '';
      hint.textContent = vp + (part.page ? ('p.' + part.page + ' · PDF ' + part.pdf) : ('PDF ' + part.pdf));
      head.appendChild(hint);
      frag.appendChild(head);
      (part.items || []).forEach(function (it) {
        frag.appendChild(makeTocItem(it.title, it.page, it.pdf, it.vol || 0));
      });
    });

    tocHost.appendChild(frag);
    filterTOC();
  }

  function makeTocItem(title, page, pdf, vol) {
    vol = vol || 0;
    var merged = state.subject.mergedVolumes;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toc-item';
    btn.dataset.pdf = String(pdf);
    btn.dataset.vol = String(vol);
    btn.title = (merged && volumeLabel(state.subject, vol) ? volumeLabel(state.subject, vol) + ' · ' : '') +
      (page ? '讲义第 ' + page + ' 页 · ' : '') + 'PDF 第 ' + pdf + ' 页';
    var t = document.createElement('span');
    t.className = 't';
    t.textContent = title;
    btn.appendChild(t);
    if (page) {
      var b = document.createElement('span');
      b.className = 'badge';
      b.textContent = 'p.' + page;
      btn.appendChild(b);
    }
    var hint = document.createElement('span');
    hint.className = 'pdf-hint';
    hint.textContent = (merged ? (volumeShort(state.subject, vol) + '·') : '') + 'PDF ' + pdf;
    btn.appendChild(hint);
    state.tocButtons.push({ el: btn, pdf: pdf, page: page, title: title, vol: vol });
    return btn;
  }

  function filterTOC() {
    var q = tocFilter.value.trim().toLowerCase();
    state.tocButtons.forEach(function (b) {
      var hit = !q || b.title.toLowerCase().indexOf(q) !== -1;
      b.el.classList.toggle('is-hidden', !hit);
    });
    tocHost.querySelectorAll('.toc-part').forEach(function (head) {
      var any = false;
      var el = head.nextElementSibling;
      while (el && !el.classList.contains('toc-part')) {
        if (el.classList.contains('toc-item') && !el.classList.contains('is-hidden')) { any = true; break; }
        el = el.nextElementSibling;
      }
      head.classList.toggle('is-hidden', !!q && !any);
    });
  }

  function buildSectionIndex() {
    var s = state.subject;
    var vol = state.vol;
    var total = currentVolume().pdfPageCount;
    state.sectionStart = {};
    state.sectionAtPage = [];
    (s.front || []).forEach(function (f) {
      if ((f.vol || 0) !== vol) { return; }
      state.sectionStart[f.pdf] = { page: null, title: f.title, part: '前置' };
    });
    (s.parts || []).forEach(function (part) {
      if ((part.vol || 0) === vol && !state.sectionStart[part.pdf]) {
        state.sectionStart[part.pdf] = { page: part.page, title: part.title, part: part.title };
      }
      (part.items || []).forEach(function (it) {
        if ((it.vol || 0) !== vol) { return; }
        if (!state.sectionStart[it.pdf]) {
          state.sectionStart[it.pdf] = { page: it.page, title: it.title, part: part.title };
        }
      });
    });
    var last = null;
    for (var p = 1; p <= total; p++) {
      if (state.sectionStart[p]) { last = state.sectionStart[p]; }
      state.sectionAtPage[p] = last;
    }
  }

  /* ---------------- page DOM ---------------- */
  function teardown() {
    if (state.observer) {
      try { state.observer.disconnect(); } catch (e) { /* ignore */ }
      state.observer = null;
    }
    cancelAllRenders();
    if (state.doc) {
      try { state.doc.destroy(); } catch (e) { /* ignore */ }
    }
    if (state.docTask && state.docTask !== state.doc) {
      try { state.docTask.destroy(); } catch (e) { /* ignore */ }
    }
    state.doc = null;
    state.docTask = null;
    state.pageProxies = [];
    state.pagePromises = [];
    state.baseViewports = [];
    state.defaultViewport = null;
    state.wrappers = [];
    state.papers = [];
    state.canvases = [];
    state.hints = [];
    state.renderedScale = [];
    state.renderTasks = [];
    state.renderScale = [];
    state.wantRender = [];
    state.pending = [];
    state.rendering = 0;
    state.tops = [];
    state.topsDirty = true;
    state.generation += 1;
    pagesHost.innerHTML = '';
    pagesHost.style.width = '';
  }

  function cancelAllRenders() {
    for (var i = 0; i < state.renderTasks.length; i++) {
      if (state.renderTasks[i]) {
        try { state.renderTasks[i].cancel(); } catch (e) { /* ignore */ }
      }
      state.renderTasks[i] = null;
    }
  }

  function pageRatioCss(vp) { return vp.width + ' / ' + vp.height; }

  function buildPages() {
    var TOTAL = currentVolume().pdfPageCount;
    var ratio = pageRatioCss(state.defaultViewport);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < TOTAL; i++) {
      var pdfPage = i + 1;
      var wrap = document.createElement('section');
      wrap.className = 'page';
      wrap.dataset.page = String(pdfPage);

      var meta = document.createElement('div');
      meta.className = 'page-meta';
      var left = document.createElement('span');
      left.textContent = 'PDF 第 ' + pdfPage + ' 页';
      var right = document.createElement('span');
      right.className = 'page-sec';
      var sec = state.sectionStart[pdfPage];
      if (sec && sec.page) {
        right.textContent = '讲义 p.' + sec.page + ' · ' + sec.title;
      } else if (sec) {
        right.textContent = sec.title;
      }
      meta.appendChild(left);
      meta.appendChild(right);

      var paper = document.createElement('div');
      paper.className = 'page-paper';
      paper.dataset.ratio = ratio;
      paper.style.aspectRatio = ratio;
      var canvas = document.createElement('canvas');
      canvas.width = 0;
      canvas.height = 0;
      var hint = document.createElement('div');
      hint.className = 'page-hint';
      hint.textContent = '第 ' + pdfPage + ' 页（滚动到此处时加载）';
      paper.appendChild(canvas);
      paper.appendChild(hint);
      wrap.appendChild(meta);
      wrap.appendChild(paper);
      frag.appendChild(wrap);

      state.wrappers.push(wrap);
      state.papers.push(paper);
      state.canvases.push(canvas);
      state.hints.push(hint);
      state.renderedScale.push(0);
      state.renderTasks.push(null);
      state.renderScale.push(0);
      state.wantRender.push(false);
    }
    pagesHost.appendChild(frag);
    applyLayout();
    setupObserver();
  }

  /* ---------------- layout ---------------- */
  function pageWidthPt(i) {
    var vp = state.baseViewports[i] || state.defaultViewport;
    return vp ? vp.width : 595.2;
  }

  function fitScaleFor(i) {
    var avail = Math.max(200, pagesHost.clientWidth - 44);
    return Math.min(avail, PAGE_MAX_WIDTH) / pageWidthPt(i);
  }

  function scaleFor(i) {
    if (state.scaleMode === 'fit') { return fitScaleFor(i); }
    return parseFloat(state.scaleMode);
  }

  function applyLayout() {
    var fixed = state.scaleMode === 'fit' ? null : parseFloat(state.scaleMode);
    var TOTAL = state.wrappers.length;
    for (var i = 0; i < TOTAL; i++) {
      var paper = state.papers[i];
      var wrap = state.wrappers[i];
      if (fixed) {
        var w = Math.round(pageWidthPt(i) * fixed);
        wrap.style.width = w + 'px';
        wrap.style.maxWidth = 'none';
        paper.style.width = w + 'px';
      } else {
        wrap.style.width = '';
        wrap.style.maxWidth = '';
        paper.style.width = '100%';
      }
    }
    // 缩放变化 → 所有已渲染画布作废，重新按新比例渲染可见页
    cancelAllRenders();
    state.generation += 1;
    for (var j = 0; j < TOTAL; j++) {
      if (state.renderedScale[j] > 0) { clearCanvas(j); }
      state.wantRender[j] = false;
    }
    state.pending = [];
    state.topsDirty = true;
  }

  function clearCanvas(idx) {
    var paper = state.papers[idx];
    var canvas = state.canvases[idx];
    if (!paper || !canvas) { return; }
    paper.classList.remove('is-rendered');
    canvas.width = 0;
    canvas.height = 0;
    state.renderedScale[idx] = 0;
    state.renderScale[idx] = 0;
    var hint = state.hints[idx];
    if (hint) { hint.textContent = '第 ' + (idx + 1) + ' 页'; }
  }

  /* ---------------- 渲染调度 ---------------- */
  function setupObserver() {
    if (!('IntersectionObserver' in window)) { return; }
    state.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var idx = parseInt(en.target.dataset.page, 10) - 1;
        if (en.isIntersecting) {
          requestRender(idx);
        } else if (Math.abs(idx + 1 - state.currentPage) > 3) {
          unloadPage(idx);
        }
      });
    }, { root: scroller, rootMargin: OBSERVER_MARGIN });
    state.wrappers.forEach(function (w) { state.observer.observe(w); });
  }

  function renderVisible() {
    if (!state.doc || !state.wrappers.length) { return; }
    var scRect = scroller.getBoundingClientRect();
    for (var i = 0; i < state.wrappers.length; i++) {
      var r = state.wrappers[i].getBoundingClientRect();
      if (r.bottom > scRect.top - 600 && r.top < scRect.bottom + 600) { requestRender(i); }
    }
  }

  function ensurePage(idx) {
    if (state.pageProxies[idx]) { return Promise.resolve(state.pageProxies[idx]); }
    if (state.pagePromises[idx]) { return state.pagePromises[idx]; }
    var token = state.loadToken;
    var pr = state.doc.getPage(idx + 1).then(function (page) {
      if (token === state.loadToken) {
        state.pageProxies[idx] = page;
        if (!state.baseViewports[idx]) { state.baseViewports[idx] = page.getViewport({ scale: 1 }); }
      }
      state.pagePromises[idx] = null;
      return page;
    }, function (err) {
      state.pagePromises[idx] = null;
      throw err;
    });
    state.pagePromises[idx] = pr;
    return pr;
  }

  function syncRatio(idx) {
    var vp = state.baseViewports[idx];
    if (!vp) { return; }
    var paper = state.papers[idx];
    if (!paper) { return; }
    var want = pageRatioCss(vp);
    if (paper.dataset.ratio !== want) {
      paper.dataset.ratio = want;
      paper.style.aspectRatio = want;
      state.topsDirty = true;
    }
  }

  function dprFor(vp) {
    var dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    var px = vp.width * vp.height * dpr * dpr;
    if (px > MAX_CANVAS_PIXELS) {
      dpr = Math.max(1, dpr * Math.sqrt(MAX_CANVAS_PIXELS / px));
    }
    return dpr;
  }

  function requestRender(idx) {
    if (!state.doc || idx < 0 || idx >= state.wrappers.length) { return; }
    var scale = scaleFor(idx);
    if (state.renderedScale[idx] > 0 && Math.abs(state.renderedScale[idx] - scale) < 0.001) { return; }
    if (state.renderTasks[idx]) { state.wantRender[idx] = true; return; }
    if (state.wantRender[idx]) { return; }
    state.wantRender[idx] = true;
    state.pending.push(idx);
    pumpRenders();
  }

  function pumpRenders() {
    while (state.rendering < MAX_CONCURRENT_RENDERS && state.pending.length) {
      var idx = state.pending.shift();
      if (!state.wantRender[idx]) { continue; }
      // 快速滚动时用户早已离开这一页：丢掉排队任务，省流量也省 CPU
      if (Math.abs((idx + 1) - state.currentPage) > 6 && state.renderedScale[idx] === 0) {
        state.wantRender[idx] = false;
        continue;
      }
      startRender(idx);
    }
  }

  function startRender(idx) {
    state.rendering += 1;
    state.wantRender[idx] = false;
    var gen = state.generation;
    var paper = state.papers[idx];
    var canvas = state.canvases[idx];
    var hint = state.hints[idx];
    var usedScale = 0;
    paper.classList.remove('is-failed', 'is-rendered');
    hint.textContent = '加载中…';

    ensurePage(idx).then(function (page) {
      if (gen !== state.generation) { return null; }
      syncRatio(idx);
      var scale = scaleFor(idx);
      usedScale = scale;
      var vp = page.getViewport({ scale: scale });
      var dpr = dprFor(vp);
      canvas.width = Math.max(1, Math.floor(vp.width * dpr));
      canvas.height = Math.max(1, Math.floor(vp.height * dpr));
      var ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      var task = page.render({
        canvasContext: ctx,
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
        intent: 'display',
      });
      state.renderTasks[idx] = task;
      state.renderScale[idx] = scale;
      return task.promise;
    }).then(function () {
      state.renderTasks[idx] = null;
      if (gen !== state.generation) { return; }
      state.renderedScale[idx] = usedScale;
      paper.classList.add('is-rendered');
      state.topsDirty = true;
      if (state.wantRender[idx]) {
        state.wantRender[idx] = false;
        state.pending.push(idx);
      }
    }).catch(function (err) {
      state.renderTasks[idx] = null;
      if (gen !== state.generation) { return; }
      if (err && err.name === 'RenderingCancelledException') { return; }
      paper.classList.add('is-failed');
      hint.textContent = '第 ' + (idx + 1) + ' 页渲染失败：' + (err && err.message ? err.message : err);
      console.error('render page ' + (idx + 1), err);
    }).then(function () {
      state.rendering = Math.max(0, state.rendering - 1);
      pumpRenders();
    });
  }

  function unloadPage(idx) {
    var p = state.papers[idx];
    if (!p || !p.classList.contains('is-rendered')) { return; }
    if (state.renderTasks[idx]) { return; }
    clearCanvas(idx);
  }

  function prefetchNext(pdfPage) {
    // 预取下一页，翻页时几乎不用等
    var idx = pdfPage;
    if (idx >= 0 && idx < state.wrappers.length && state.renderedScale[idx] === 0) {
      requestRender(idx);
    }
  }

  /* ---------------- navigation ---------------- */
  function jumpToPage(pdfPage, opts) {
    opts = opts || {};
    if (opts.vol !== undefined && opts.vol !== null && opts.vol !== state.vol) {
      loadVolume(state.subject, opts.vol, pdfPage);
      return;
    }
    if (!state.doc) { return; }
    var TOTAL = currentVolume().pdfPageCount;
    pdfPage = clamp(pdfPage || 1, 1, TOTAL);
    var idx = pdfPage - 1;
    var wrap = state.wrappers[idx];
    if (!wrap) { return; }
    setCurrent(pdfPage);          // 先更新当前页，渲染队列据此判断优先级
    requestRender(idx);
    wrap.scrollIntoView({ block: 'start', behavior: opts.smooth ? 'smooth' : 'auto' });
    if (opts.flash !== false) {
      wrap.classList.remove('flash');
      void wrap.offsetWidth;
      wrap.classList.add('flash');
    }
    try {
      history.replaceState(null, '', '#s=' + state.subjectId + '&vol=' + state.vol + '&page=' + pdfPage);
    } catch (e) { /* ignore */ }
    if (opts.smooth) {
      setTimeout(function () { state.topsDirty = true; prefetchNext(pdfPage); }, 420);
    } else {
      state.topsDirty = true;
      prefetchNext(pdfPage);
    }
  }

  function stepPage(delta) {
    if (!state.doc) { return; }
    var total = currentVolume().pdfPageCount;
    var p = state.currentPage + delta;
    if (p < 1) {
      if (state.vol > 0) {
        loadVolume(state.subject, state.vol - 1, state.subject.volumes[state.vol - 1].pdfPageCount);
      }
      return;
    }
    if (p > total) {
      if (state.vol < state.subject.volumes.length - 1) {
        loadVolume(state.subject, state.vol + 1, 1);
      }
      return;
    }
    jumpToPage(p, { flash: false });
  }

  function setCurrent(pdfPage) {
    state.currentPage = pdfPage;
    var v = currentVolume();
    pageLabel.textContent = (v.label ? v.label + ' ' : '') + 'PDF ' + pdfPage + ' / ' + v.pdfPageCount;
    jumpInput.value = String(pdfPage);
    var sec = state.sectionAtPage[pdfPage];
    curSection.textContent = sec ? (sec.page ? '当前：' + sec.title + '（讲义 p.' + sec.page + '）' : '当前：' + sec.title) : '';
    updateActiveTOC(pdfPage);
  }

  function updateActiveTOC(pdfPage) {
    var best = null;
    for (var i = 0; i < state.tocButtons.length; i++) {
      var b = state.tocButtons[i];
      if (b.vol !== state.vol) { continue; }
      if (b.pdf <= pdfPage) { best = b; } else { break; }
    }
    var bestPdf = best ? best.pdf : -1;
    var changed = false;
    state.tocButtons.forEach(function (b) {
      var on = b.vol === state.vol && b.pdf === bestPdf;
      if (b.el.classList.contains('active') !== on) {
        b.el.classList.toggle('active', on);
        if (on) { changed = true; }
      }
    });
    if (best && changed) {
      var r = best.el.getBoundingClientRect();
      var hr = tocHost.getBoundingClientRect();
      if (r.top < hr.top + 4 || r.bottom > hr.bottom - 4) { best.el.scrollIntoView({ block: 'center' }); }
    }
  }

  /* ---------------- 滚动定位（缓存偏移 + 二分，避免每帧量所有页） ---------------- */
  function updateTops() {
    var scRect = scroller.getBoundingClientRect();
    var base = scroller.scrollTop - scRect.top;
    var n = state.wrappers.length;
    for (var i = 0; i < n; i++) {
      state.tops[i] = state.wrappers[i].getBoundingClientRect().top + base;
    }
    state.topsDirty = false;
  }

  function currentPageFromScroll() {
    if (!state.wrappers.length) { return 1; }
    if (state.topsDirty || state.tops.length !== state.wrappers.length) { updateTops(); }
    var y = scroller.scrollTop + 90;
    var lo = 0, hi = state.tops.length - 1, best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (state.tops[mid] <= y) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best + 1;
  }

  var onScroll = debounce(function () {
    if (!state.doc) { return; }
    var best = currentPageFromScroll();
    if (best !== state.currentPage) { setCurrent(best); }
  }, 60);

  /* ---------------- load subject / volume ---------------- */
  function loadSubject(id, targetPage, vol) {
    var subject = subjectById(id) || SUBJECTS[0];
    if (vol == null) { vol = state.savedVol[subject.id] || 0; }
    loadVolume(subject, vol, targetPage);
  }

  function loadVolume(subject, vol, targetPage, retry) {
    vol = clamp(vol || 0, 0, subject.volumes.length - 1);
    if (state.subjectId === subject.id && state.vol === vol && state.doc) {
      jumpToPage(targetPage || state.currentPage);
      return;
    }
    if (state.subjectId && state.subject) {
      state.saved[savedKey(state.subjectId, state.vol)] = state.currentPage;
      state.savedVol[state.subjectId] = state.vol;
    }
    state.loadToken += 1;
    var token = state.loadToken;
    state.subjectId = subject.id;
    state.subject = subject;
    state.vol = vol;
    state.savedVol[subject.id] = vol;
    state.pendingPage = (targetPage != null ? targetPage : null);
    updateSubjectUI();
    teardown();
    rebuildTOC();
    buildSectionIndex();
    var v = currentVolume();
    showOverlay('正在打开《' + subject.name + (subject.mergedVolumes ? '·' + v.label : '') + '》',
      '共 ' + v.pdfPageCount + ' 页 · 只按需读取当前页数据，不再整本下载');

    var opts = Object.assign({}, PDFJS_OPTS, { url: encodeURI(v.file) });
    var loadingTask = pdfjs.getDocument(opts);
    state.docTask = loadingTask;
    var lastSub = '';
    loadingTask.onProgress = function (p) {
      if (!p || !p.total || !p.loaded) { return; }
      var sub = '已读取 ' + mb(p.loaded) + ' MB（按需分段下载，不再等待整本 PDF）';
      if (sub !== lastSub) { lastSub = sub; setOverlaySub(sub); }
    };

    loadingTask.promise.then(function (doc) {
      if (token !== state.loadToken) {
        try { doc.destroy(); } catch (e) { /* ignore */ }
        return;
      }
      state.doc = doc;
      return prepareDoc(doc, token, subject);
    }).catch(function (err) {
      if (token !== state.loadToken) { return; }
      if (err && err.name === 'AbortException') { return; }
      // 网络抖动（分段请求失败）时自动重试一次，避免用户看到“PDF 加载失败”
      var msg = String((err && err.message) || '');
      var netIssue = !err || err.name === 'UnknownErrorException' || /fetch|network|timed?\s*out/i.test(msg);
      if (!retry && netIssue) {
        var again = (targetPage != null) ? targetPage : state.pendingPage;
        setOverlaySub('网络不稳定，正在自动重试…');
        setTimeout(function () {
          if (token === state.loadToken) { loadVolume(subject, vol, again, true); }
        }, 800);
        return;
      }
      console.error(err);
      showError('PDF 加载失败', '错误信息：' + escapeHtml(err && err.message ? err.message : String(err)) +
        '<br><br>请确认 <b>' + escapeHtml(v.file) + '</b> 存在，并通过本地服务器访问。');
    });
  }

  /**
   * 只取第 1 页的尺寸用于排版；其余页保持占位，滚动到哪页再取哪页。
   * （旧实现会先把全部 300~400 页的 page 对象取一遍，等于把整本 PDF 拉下来。）
   */
  function prepareDoc(doc, token, subject) {
    return doc.getPage(1).then(function (first) {
      if (token !== state.loadToken) {
        try { doc.destroy(); } catch (e) { /* ignore */ }
        return;
      }
      state.pageProxies[0] = first;
      state.baseViewports[0] = first.getViewport({ scale: 1 });
      state.defaultViewport = state.baseViewports[0];
      state.doc = doc;
      buildPages();
      hideOverlay();
      var page = state.saved[savedKey(subject.id, state.vol)] || 1;
      if (state.pendingPage != null) { page = state.pendingPage; state.pendingPage = null; }
      jumpToPage(page, { flash: false });
    });
  }

  /* ---------------- zoom ---------------- */
  zoomSelect.addEventListener('change', function () {
    state.scaleMode = zoomSelect.value;
    if (!state.doc) { return; }
    applyLayout();
    renderVisible();
    jumpToPage(state.currentPage, { flash: false });
  });

  /* ---------------- events ---------------- */
  jumpForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = parseInt(jumpInput.value, 10);
    if (!isNaN(n)) { jumpToPage(n, { flash: true }); }
  });
  $('#prevPage').addEventListener('click', function () { stepPage(-1); });
  $('#nextPage').addEventListener('click', function () { stepPage(1); });
  scroller.addEventListener('scroll', onScroll, { passive: true });

  tocHost.addEventListener('click', function (e) {
    var item = e.target.closest('.toc-item');
    if (item) {
      e.preventDefault();
      var vol = parseInt(item.dataset.vol, 10) || 0;
      var pdf = parseInt(item.dataset.pdf, 10);
      if (vol !== state.vol) { loadVolume(state.subject, vol, pdf); }
      else { jumpToPage(pdf, { flash: true }); }
      if (isNarrow()) { closeSidebarMobile(); }
      return;
    }
    var part = e.target.closest('.toc-part');
    if (part) {
      e.preventDefault();
      var pvol = parseInt(part.dataset.vol, 10) || 0;
      var ppdf = parseInt(part.dataset.pdf, 10) || 1;
      if (pvol !== state.vol) { loadVolume(state.subject, pvol, ppdf); }
      else { jumpToPage(ppdf, { flash: true }); }
      if (isNarrow()) { closeSidebarMobile(); }
    }
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { return; }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { stepPage(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { stepPage(1); }
    else if (e.key === 'Home') { jumpToPage(1, { flash: false }); }
    else if (e.key === 'End') { jumpToPage(state.subject ? currentVolume().pdfPageCount : 1, { flash: false }); }
    else if (e.key === '[' || e.key === ']') {
      var idx = -1;
      for (var i = 0; i < SUBJECTS.length; i++) { if (SUBJECTS[i].id === state.subjectId) { idx = i; break; } }
      var nextIdx = (idx + (e.key === ']' ? 1 : -1) + SUBJECTS.length) % SUBJECTS.length;
      loadSubject(SUBJECTS[nextIdx].id, null, null);
    }
  });

  window.addEventListener('resize', debounce(function () {
    if (state.scaleMode === 'fit' && state.doc) { applyLayout(); renderVisible(); }
  }, 200));

  function isNarrow() { return window.matchMedia('(max-width: 880px)').matches; }
  function relayoutSoon() {
    if (state.scaleMode !== 'fit') { return; }
    setTimeout(function () {
      if (state.doc) { applyLayout(); renderVisible(); }
    }, 320);
  }
  $('#sideClose').addEventListener('click', function () {
    if (isNarrow()) { closeSidebarMobile(); }
    else { sidebar.classList.add('collapsed'); relayoutSoon(); }
  });
  $('#sideOpen').addEventListener('click', function () {
    if (isNarrow()) { sidebar.classList.add('open'); $('#scrim').hidden = false; }
    else { sidebar.classList.remove('collapsed'); relayoutSoon(); }
  });
  $('#scrim').addEventListener('click', closeSidebarMobile);
  function closeSidebarMobile() {
    sidebar.classList.remove('open');
    $('#scrim').hidden = true;
  }
  tocFilter.addEventListener('input', filterTOC);

  /* ---------------- init ---------------- */
  function init() {
    if (location.protocol === 'file:') {
      showError('需要通过本地服务器打开',
        '浏览器禁止网页直接读取本地 PDF 文件。请回到网站根目录，双击 <b>启动网站.cmd</b>（或运行 <b>serve.py</b>），' +
        '然后在浏览器打开 <b>http://127.0.0.1:8787/</b>，从看板点页码进来即可。');
      return;
    }
    if (!pdfjs || !TOC || !SUBJECTS || !SUBJECTS.length) {
      showError('资源加载失败', 'vendor/pdfjs/pdf.min.js 或 data/toc-data.js 未能执行，请检查文件是否完整。');
      return;
    }
    pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
    normalizeAll();
    buildSubjectTabs();
    volumesHost.addEventListener('click', function (e) {
      var b = e.target.closest('.volume-tab');
      if (!b) { return; }
      var vol = parseInt(b.dataset.vol, 10);
      if (vol !== state.vol) { loadVolume(state.subject, vol, null); }
    });

    var m = /s=([\w-]+)/.exec(location.hash || '');
    var vm = /vol=(\d+)/.exec(location.hash || '');
    var pm = /page=(\d+)/.exec(location.hash || '');
    var mm = /md=(\d+)/.exec(location.hash || '');
    var startId = m ? m[1] : SUBJECTS[0].id;
    if (!subjectById(startId)) { startId = SUBJECTS[0].id; }
    var startVol = vm ? parseInt(vm[1], 10) : 0;

    // 支持从进度看板点页码进来：#s=physiology&md=12（讲义页码，自动换成 PDF 页）
    var startTarget = null;
    if (pm) {
      startTarget = { pdf: parseInt(pm[1], 10), vol: startVol };
    } else if (mm) {
      startTarget = mdToPdf(subjectById(startId), parseInt(mm[1], 10));
    }
    if (startTarget) {
      startVol = startTarget.vol;
      state.pendingPage = startTarget.pdf;
    } else {
      state.pendingPage = null;
    }
    loadSubject(startId, startTarget ? startTarget.pdf : null, startVol);
  }

  window.__viewer = {
    state: state,
    loadSubject: loadSubject,
    loadVolume: loadVolume,
    jumpToPage: jumpToPage,
    stepPage: stepPage,
    mdToPdf: mdToPdf,
    mdAnchors: mdAnchors,
    init: init,
  };
  init();
})();