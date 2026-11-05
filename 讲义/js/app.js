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

  /* ---------------- state ---------------- */
  var state = {
    subjectId: null,
    subject: null,
    vol: 0,
    doc: null,
    docTask: null,
    pageProxies: [],
    baseViewports: [],
    wrappers: [],
    papers: [],
    canvases: [],
    hints: [],
    renderedScale: [],
    renderTasks: [],
    renderScale: [],
    wantRender: [],
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
  };

  var PDFJS_OPTS = {
    cMapUrl: 'vendor/pdfjs/cmaps/',
    cMapPacked: true,
    useSystemFonts: true,
    isEvalSupported: false,
    disableAutoFetch: false,
    disableRange: false,
    disableStream: false,
    rangeChunkSize: 65536,
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

  function showOverlay(title, sub) {
    overlay.classList.remove('hidden', 'is-error');
    overlayTitle.textContent = title;
    loadStatus.textContent = sub || '';
    overlay.querySelector('.spinner').style.display = '';
  }

  function setOverlaySub(sub) { loadStatus.textContent = sub; }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function showError(title, detail) {
    overlay.classList.remove('hidden');
    overlay.classList.add('is-error');
    overlayTitle.textContent = title;
    loadStatus.innerHTML = detail;
    overlay.querySelector('.spinner').style.display = 'none';
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

  function totalPages(s) {
    return s.volumes.reduce(function (n, v) { return n + v.pdfPageCount; }, 0);
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
    for (var i = 0; i < state.renderTasks.length; i++) {
      if (state.renderTasks[i]) {
        try { state.renderTasks[i].cancel(); } catch (e) { /* ignore */ }
      }
    }
    if (state.doc) {
      try { state.doc.destroy(); } catch (e) { /* ignore */ }
    }
    if (state.docTask && state.docTask !== state.doc) {
      try { state.docTask.destroy(); } catch (e) { /* ignore */ }
    }
    state.doc = null;
    state.docTask = null;
    state.pageProxies = [];
    state.baseViewports = [];
    state.wrappers = [];
    state.papers = [];
    state.canvases = [];
    state.hints = [];
    state.renderedScale = [];
    state.renderTasks = [];
    state.renderScale = [];
    state.wantRender = [];
    state.generation += 1;
    pagesHost.innerHTML = '';
    pagesHost.style.width = '';
  }

  function buildPages() {
    var s = state.subject;
    var TOTAL = currentVolume().pdfPageCount;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < TOTAL; i++) {
      var pdfPage = i + 1;
      var vp = state.baseViewports[i];
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
      paper.style.aspectRatio = vp.width + ' / ' + vp.height;
      var canvas = document.createElement('canvas');
      canvas.width = 0;
      canvas.height = 0;
      var hint = document.createElement('div');
      hint.className = 'page-hint';
      hint.textContent = '第 ' + pdfPage + ' 页（滚动到此处时渲染）';
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

  function fitScaleFor(i) {
    var vp = state.baseViewports[i];
    var avail = Math.max(200, pagesHost.clientWidth);
    return Math.min(avail, 1180) / vp.width;
  }

  function scaleFor(i) {
    if (state.scaleMode === 'fit') { return fitScaleFor(i); }
    return parseFloat(state.scaleMode);
  }

  function applyLayout() {
    var TOTAL = state.wrappers.length;
    for (var i = 0; i < TOTAL; i++) {
      var vp = state.baseViewports[i];
      var paper = state.papers[i];
      var wrap = state.wrappers[i];
      if (state.scaleMode === 'fit') {
        wrap.style.width = '';
        wrap.style.maxWidth = '';
        paper.style.width = '100%';
      } else {
        var s = parseFloat(state.scaleMode);
        var w = Math.round(vp.width * s);
        wrap.style.width = w + 'px';
        wrap.style.maxWidth = 'none';
        paper.style.width = w + 'px';
      }
      paper.style.aspectRatio = vp.width + ' / ' + vp.height;
    }
    state.generation += 1;
    for (var j = 0; j < TOTAL; j++) {
      if (state.renderTasks[j]) {
        try { state.renderTasks[j].cancel(); } catch (e) { /* ignore */ }
      }
      state.renderTasks[j] = null;
      state.wantRender[j] = false;
      state.renderedScale[j] = 0;
      state.papers[j].classList.remove('is-rendered');
      if (!state.canvases[j].width) { state.hints[j].textContent = '第 ' + (j + 1) + ' 页'; }
    }
    renderVisible();
  }

  /* ---------------- render ---------------- */
  function setupObserver() {
    if (!('IntersectionObserver' in window)) { return; }
    state.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var idx = parseInt(en.target.dataset.page, 10) - 1;
        if (en.isIntersecting) {
          renderPage(idx);
        } else if (Math.abs(idx + 1 - state.currentPage) > 3) {
          unloadPage(idx);
        }
      });
    }, { root: scroller, rootMargin: '800px 0px' });
    state.wrappers.forEach(function (w) { state.observer.observe(w); });
  }

  function renderVisible() {
    if (!state.doc) { return; }
    var scRect = scroller.getBoundingClientRect();
    for (var i = 0; i < state.wrappers.length; i++) {
      var r = state.wrappers[i].getBoundingClientRect();
      if (r.bottom > scRect.top - 800 && r.top < scRect.bottom + 800) { renderPage(i); }
    }
  }

  function renderPage(idx) {
    var pdfPage = idx + 1;
    var scale = scaleFor(idx);
    var paper = state.papers[idx];
    if (!paper) { return; }
    if (paper.classList.contains('is-rendered') &&
        Math.abs(state.renderedScale[idx] - scale) < 0.001) { return; }
    if (state.renderTasks[idx]) {
      if (Math.abs(state.renderScale[idx] - scale) < 0.001) { return; }
      state.wantRender[idx] = true;
      return;
    }
    var gen = state.generation;
    var pageProxy = state.pageProxies[idx];
    var canvas = state.canvases[idx];
    var hint = state.hints[idx];
    paper.classList.remove('is-failed', 'is-rendered');
    hint.textContent = '渲染中…';

    var dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    var viewport = pageProxy.getViewport({ scale: scale });
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var task = pageProxy.render({
      canvasContext: ctx,
      viewport: viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      intent: 'display',
    });
    state.renderTasks[idx] = task;
    state.renderScale[idx] = scale;
    state.wantRender[idx] = false;
    task.promise.then(function () {
      if (gen !== state.generation) { return; }
      state.renderTasks[idx] = null;
      state.renderedScale[idx] = scale;
      paper.classList.add('is-rendered');
      if (state.wantRender[idx]) { state.wantRender[idx] = false; renderPage(idx); }
    }).catch(function (err) {
      if (gen !== state.generation) { return; }
      state.renderTasks[idx] = null;
      if (err && err.name === 'RenderingCancelledException') {
        if (state.wantRender[idx]) { state.wantRender[idx] = false; renderPage(idx); }
        return;
      }
      paper.classList.add('is-failed');
      hint.textContent = '第 ' + pdfPage + ' 页渲染失败：' + (err && err.message ? err.message : err);
      console.error('render page ' + pdfPage, err);
    });
  }

  function unloadPage(idx) {
    var p = state.papers[idx];
    if (!p || !p.classList.contains('is-rendered')) { return; }
    if (state.renderTasks[idx]) { return; }
    p.classList.remove('is-rendered');
    var c = state.canvases[idx];
    c.width = 0;
    c.height = 0;
    state.renderedScale[idx] = 0;
    state.hints[idx].textContent = '第 ' + (idx + 1) + ' 页';
    if (state.pageProxies[idx] && state.pageProxies[idx].cleanup) {
      try { state.pageProxies[idx].cleanup(); } catch (e) { /* ignore */ }
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
    renderPage(idx);
    wrap.scrollIntoView({ block: 'start', behavior: opts.smooth ? 'smooth' : 'auto' });
    if (opts.flash !== false) {
      wrap.classList.remove('flash');
      void wrap.offsetWidth;
      wrap.classList.add('flash');
    }
    setCurrent(pdfPage);
    try {
      history.replaceState(null, '', '#s=' + state.subjectId + '&vol=' + state.vol + '&page=' + pdfPage);
    } catch (e) { /* ignore */ }
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
      if (b.pdf <= pdfPage) { best = b; }
    }
    var bestPdf = best ? best.pdf : -1;
    state.tocButtons.forEach(function (b) {
      b.el.classList.toggle('active', b.vol === state.vol && b.pdf === bestPdf);
    });
    if (best) {
      var r = best.el.getBoundingClientRect();
      var hr = tocHost.getBoundingClientRect();
      if (r.top < hr.top + 4 || r.bottom > hr.bottom - 4) { best.el.scrollIntoView({ block: 'center' }); }
    }
  }

  var onScroll = debounce(function () {
    if (!state.doc) { return; }
    var scRect = scroller.getBoundingClientRect();
    var best = state.currentPage;
    for (var i = 0; i < state.wrappers.length; i++) {
      var r = state.wrappers[i].getBoundingClientRect();
      if (r.top - scRect.top <= 90) { best = i + 1; } else { break; }
    }
    if (best !== state.currentPage) { setCurrent(best); }
  }, 60);

  /* ---------------- load subject / volume ---------------- */
  function loadSubject(id, targetPage, vol) {
    var subject = subjectById(id) || SUBJECTS[0];
    if (vol == null) { vol = state.savedVol[subject.id] || 0; }
    loadVolume(subject, vol, targetPage);
  }

  function loadVolume(subject, vol, targetPage) {
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
    showOverlay('正在加载《' + subject.name + (subject.mergedVolumes ? '·' + v.label : '') + '》PDF…',
      '共 ' + v.pdfPageCount + ' 页，首次加载需要下载后解析，请稍候');

    var opts = Object.assign({}, PDFJS_OPTS, { url: encodeURI(v.file) });
    var loadingTask = pdfjs.getDocument(opts);
    state.docTask = loadingTask;
    var lastPct = -1;
    loadingTask.onProgress = function (p) {
      if (p && p.total) {
        var pct = Math.min(100, Math.round(p.loaded / p.total * 100));
        if (pct !== lastPct) { lastPct = pct; setOverlaySub('已下载 ' + pct + '% · 正在解析 PDF…'); }
      }
    };

    loadingTask.promise.then(function (doc) {
      if (token !== state.loadToken) {
        try { doc.destroy(); } catch (e) { /* ignore */ }
        return;
      }
      state.doc = doc;
      return prepareDocPages(doc, token, subject);
    }).catch(function (err) {
      if (token !== state.loadToken) { return; }
      console.error(err);
      showError('PDF 加载失败', '错误信息：' + escapeHtml(err && err.message ? err.message : String(err)) +
        '<br><br>请确认 <b>' + escapeHtml(v.file) + '</b> 存在，并通过本地服务器访问。');
    });
  }

  function prepareDocPages(doc, token, subject) {
    var total = doc.numPages;
    var proxies = new Array(total);
    var vps = new Array(total);
    var batch = 12;
    var next = 0;
    function worker() {
      if (token !== state.loadToken) { return Promise.resolve(); }
      if (next >= total) { return Promise.resolve(); }
      var start = next;
      next = Math.min(total, next + batch);
      var jobs = [];
      for (var i = start; i < next; i++) {
        jobs.push(doc.getPage(i + 1).then(function (k) {
          return function (page) {
            proxies[k] = page;
            vps[k] = page.getViewport({ scale: 1 });
          };
        }(i)));
      }
      return Promise.all(jobs).then(function () {
        setOverlaySub('正在读取页面尺寸 ' + next + ' / ' + total);
        return worker();
      });
    }
    return worker().then(function () {
      if (token !== state.loadToken) {
        try { doc.destroy(); } catch (e) { /* ignore */ }
        return;
      }
      state.pageProxies = proxies;
      state.baseViewports = vps;
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
      var idx = SUBJECTS.findIndex(function (s) { return s.id === state.subjectId; });
      var nextIdx = (idx + (e.key === ']' ? 1 : -1) + SUBJECTS.length) % SUBJECTS.length;
      loadSubject(SUBJECTS[nextIdx].id, null, null);
    }
  });

  window.addEventListener('resize', debounce(function () {
    if (state.scaleMode === 'fit' && state.doc) { applyLayout(); }
  }, 200));

  function isNarrow() { return window.matchMedia('(max-width: 880px)').matches; }
  function relayoutSoon() {
    if (state.scaleMode !== 'fit') { return; }
    setTimeout(function () { if (state.doc) { applyLayout(); } }, 320);
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
