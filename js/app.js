/* ============================================================
   西综讲义进度看板 · 交互逻辑
   ------------------------------------------------------------
   职责：渲染顶栏 / 功能栏 / 统计栏，处理勾选与云同步。
   任务数据：data/tasks.js（window.TASKS_DATA）
   云同步：js/cloud.js（window.Cloud，Supabase + 同步码）
   ============================================================ */

(function () {
  'use strict';

  var DATA = window.TASKS_DATA;
  var RING_CIRCUMFERENCE = 326.73;

  var state = {
    done: new Set(),
    collapsed: new Set(),
    currentSubjectId: null,
    view: 'board',
    hideDone: false,
    query: '',
    daily: { date: '', count: 0 }
  };

  var chapterRefs = new Map();

  /* ---------------- 工具函数 ---------------- */

  function $(sel) { return document.querySelector(sel); }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function span(className, textValue) {
    var node = el('span', className);
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function text(str) { return document.createTextNode(String(str)); }

  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function getSubject(id) {
    for (var i = 0; i < DATA.subjects.length; i++) {
      if (DATA.subjects[i].id === id) return DATA.subjects[i];
    }
    return null;
  }

  function chapterKey(subjectId, chapterId) { return subjectId + ':' + chapterId; }

  function subjectStats(subject) {
    var total = 0, doneCount = 0, plusTotal = 0, plusDone = 0;
    subject.chapters.forEach(function (ch) {
      ch.items.forEach(function (item) {
        total++;
        if (state.done.has(item.id)) doneCount++;
        if (item.kind === 'plus') {
          plusTotal++;
          if (state.done.has(item.id)) plusDone++;
        }
      });
    });
    return {
      total: total,
      done: doneCount,
      left: total - doneCount,
      percent: total ? Math.round((doneCount / total) * 100) : 0,
      plusTotal: plusTotal,
      plusDone: plusDone
    };
  }

  function overallStats() {
    var total = 0, doneCount = 0;
    DATA.subjects.forEach(function (s) {
      var st = subjectStats(s);
      total += st.total;
      doneCount += st.done;
    });
    return {
      total: total,
      done: doneCount,
      left: total - doneCount,
      percent: total ? Math.round((doneCount / total) * 100) : 0
    };
  }

  var ICON_CHECK =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var ICON_CHEVRON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

  /* ---------------- 顶栏 ---------------- */

  function renderNav() {
    var nav = $('#subjectNav');
    nav.innerHTML = '';

    DATA.subjects.forEach(function (subject) {
      var st = subjectStats(subject);

      var btn = el('button', 'subject-btn');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(subject.id === state.currentSubjectId));
      btn.title = subject.name + '：已完成 ' + st.done + ' / ' + st.total;
      if (subject.id === state.currentSubjectId) btn.classList.add('is-active');
      if (st.total > 0 && st.done === st.total) btn.classList.add('is-complete');

      btn.appendChild(span('subject-btn__name', subject.name));
      btn.appendChild(span('subject-btn__count', st.done + '/' + st.total));

      var barWrap = span('subject-btn__bar');
      var barFill = span('');
      barFill.style.width = st.percent + '%';
      barWrap.appendChild(barFill);
      btn.appendChild(barWrap);

      btn.addEventListener('click', function () { switchSubject(subject.id); });
      nav.appendChild(btn);
    });
  }

  function switchSubject(id) {
    if (!getSubject(id) || state.currentSubjectId === id) return;
    state.currentSubjectId = id;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + id);
    }
    renderNav();
    renderTasks();
    renderStats();
    updateSubjectMeta();
  }

  /* ---------------- 视图切换：进度看板 / 学习转盘 ---------------- */

  function applyView(view, options) {
    var opts = options || {};
    var isWheel = view === 'wheel';
    if (!isWheel) view = 'board';
    state.view = view;

    var boardView = $('#boardView');
    var wheelView = $('#wheelView');
    var boardFooter = $('#boardFooter');

    if (boardView) boardView.hidden = isWheel;
    if (wheelView) wheelView.hidden = !isWheel;
    if (boardFooter) boardFooter.hidden = isWheel;
    document.body.classList.toggle('view-wheel', isWheel);

    [['#viewBoardBtn', 'board'], ['#viewWheelBtn', 'wheel']].forEach(function (pair) {
      var btn = $(pair[0]);
      if (!btn) return;
      var active = pair[1] === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    if (!opts.silent && window.history && window.history.replaceState) {
      var hash = isWheel ? '#wheel' : '#' + state.currentSubjectId;
      window.history.replaceState(null, '', hash);
    }

    if (isWheel) {
      closeStatsPopover();
      if (window.Turntable) Turntable.refresh();
    } else {
      renderAll();
    }
  }

  /* ---------------- 顶栏统计下拉面板 ---------------- */

  function statsPopover() { return $('#statsPopover'); }

  function nodeContains(node, target) {
    if (!node || !target) return false;
    if (typeof node.contains === 'function') return node.contains(target);
    var cur = target;
    while (cur) {
      if (cur === node) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  function closeStatsPopover() {
    var panel = statsPopover();
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    var btn = $('#btnStatsToggle');
    if (btn) {
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleStatsPopover() {
    var panel = statsPopover();
    if (!panel) return;
    if (panel.hidden) {
      panel.hidden = false;
      var btn = $('#btnStatsToggle');
      if (btn) {
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    } else {
      closeStatsPopover();
    }
  }

  function switchView(view) {
    if (view === state.view) return;
    applyView(view);
  }

  function updateSubjectMeta() {
    var subject = getSubject(state.currentSubjectId);
    if (!subject) return;
    var st = subjectStats(subject);
    $('#subjectTitle').textContent = subject.name;
    $('#subjectMeta').textContent = '已完成 ' + st.done + ' / ' + st.total + ' 项 · 剩余 ' + st.left + ' 项';
  }

  function itemMatches(item, query) {
    if (!query) return true;
    if (item.name.toLowerCase().indexOf(query) !== -1) return true;
    if (item.page && String(item.page) === query) return true;
    return false;
  }

  function kindBadgeNode(item) {
    if (item.kind === 'plus') return span('badge badge--plus', '串讲');
    if (item.kind === 'sub') return span('badge badge--sub', '细分');
    if (item.kind === 'chapter') return span('badge badge--chapter', '整章');
    return null;
  }

  function buildTaskRow(item) {
    var row = el('div', 'task');
    row.dataset.taskId = item.id;
    if (state.done.has(item.id)) row.classList.add('is-done');

    var label = el('label', 'task__check');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.done.has(item.id);
    input.setAttribute('aria-label', item.name);
    input.addEventListener('change', function () {
      toggleTask(item.id, input.checked);
    });

    var box = span('task__box');
    box.innerHTML = ICON_CHECK;

    label.appendChild(input);
    label.appendChild(box);

    var name = span('task__name', item.name);
    var badges = el('div', 'task__badges');

    var kindBadge = kindBadgeNode(item);
    if (kindBadge) badges.appendChild(kindBadge);
    if (item.page) badges.appendChild(span('badge badge--page', 'P' + item.page));

    row.appendChild(label);
    row.appendChild(name);
    if (badges.children.length) row.appendChild(badges);

    row.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.task__check')) return;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    return row;
  }

  function renderTasks() {
    var list = $('#taskList');
    var subject = getSubject(state.currentSubjectId);
    list.innerHTML = '';
    chapterRefs.clear();

    if (!subject) {
      $('#emptyState').hidden = false;
      return;
    }

    var query = state.query.trim().toLowerCase();
    var visibleCount = 0;

    subject.chapters.forEach(function (chapter) {
      var items = chapter.items.filter(function (item) {
        if (state.hideDone && state.done.has(item.id)) return false;
        return itemMatches(item, query);
      });
      if (!items.length) return;

      var chapterTotal = chapter.items.length;
      var chapterDone = chapter.items.filter(function (i) { return state.done.has(i.id); }).length;
      var chapterPercent = chapterTotal ? Math.round((chapterDone / chapterTotal) * 100) : 0;

      var key = chapterKey(subject.id, chapter.id);
      var isOpen = query ? true : !state.collapsed.has(key);

      visibleCount += items.length;

      var chapterEl = el('section', 'chapter');
      chapterEl.dataset.chapterId = chapter.id;
      chapterEl.dataset.subjectId = subject.id;
      if (isOpen) chapterEl.classList.add('is-open');
      if (chapterTotal > 0 && chapterDone === chapterTotal) chapterEl.classList.add('chapter--all-done');

      var head = el('button', 'chapter__head');
      head.type = 'button';
      head.setAttribute('aria-expanded', String(isOpen));

      var chevron = span('chapter__chevron');
      chevron.innerHTML = ICON_CHEVRON;
      head.appendChild(chevron);
      head.appendChild(span('chapter__name', chapter.name));

      var progressWrap = span('chapter__progress');
      var countEl = span('chapter__count', chapterDone + '/' + chapterTotal);
      var barWrap = span('chapter__bar');
      var barEl = span('');
      barEl.style.width = chapterPercent + '%';
      barWrap.appendChild(barEl);
      progressWrap.appendChild(countEl);
      progressWrap.appendChild(barWrap);
      head.appendChild(progressWrap);

      head.addEventListener('click', function () {
        var keyNow = chapterKey(subject.id, chapter.id);
        if (chapterEl.classList.contains('is-open')) {
          chapterEl.classList.remove('is-open');
          state.collapsed.add(keyNow);
          head.setAttribute('aria-expanded', 'false');
        } else {
          chapterEl.classList.add('is-open');
          state.collapsed.delete(keyNow);
          head.setAttribute('aria-expanded', 'true');
        }
      });

      var body = el('div', 'chapter__body');
      items.forEach(function (item) { body.appendChild(buildTaskRow(item)); });

      chapterEl.appendChild(head);
      chapterEl.appendChild(body);
      list.appendChild(chapterEl);

      chapterRefs.set(chapterEl, { chapter: chapter, countEl: countEl, barEl: barEl });
    });

    $('#emptyState').hidden = visibleCount !== 0;
    if (visibleCount === 0) {
      var empty = el('div', 'empty-state');
      var p = el('p');
      p.textContent = '没有匹配的任务';
      var s = span('');
      s.textContent = '试试换个关键词，或关闭「隐藏已完成」';
      empty.appendChild(p);
      empty.appendChild(s);
      list.appendChild(empty);
    }
  }

  function toggleTask(taskId, checked) {
    var isNewlyDone = checked && !state.done.has(taskId);
    if (checked) state.done.add(taskId); else state.done.delete(taskId);

    if (isNewlyDone) {
      if (state.daily.date !== todayStr()) state.daily = { date: todayStr(), count: 0 };
      state.daily.count++;
    }

    persistAll();

    var row = $('#taskList .task[data-task-id="' + taskId + '"]');
    if (row) row.classList.toggle('is-done', checked);

    updateChapterIndicators();
    renderNav();
    renderStats();
    updateSubjectMeta();
  }

  function persistAll() {
    if (window.Cloud && Cloud.getCode()) {
      Cloud.saveDone(Array.from(state.done));
    }
  }

  function updateChapterIndicators() {
    chapterRefs.forEach(function (ref, chapterEl) {
      var chapter = ref.chapter;
      var total = chapter.items.length;
      var doneCount = chapter.items.filter(function (i) { return state.done.has(i.id); }).length;
      var percent = total ? Math.round((doneCount / total) * 100) : 0;

      ref.countEl.textContent = doneCount + '/' + total;
      ref.barEl.style.width = percent + '%';
      chapterEl.classList.toggle('chapter--all-done', total > 0 && doneCount === total);
    });
  }

  /* ---------------- 统计栏 ---------------- */

  function renderStats() {
    var overall = overallStats();

    $('#overallPercent').textContent = overall.percent + '%';
    var toggleText = $('#statsToggleText');
    if (toggleText) toggleText.textContent = overall.percent + '%';
    $('#totalDone').textContent = String(overall.done);
    $('#totalLeft').textContent = String(overall.left);
    $('#totalAll').textContent = String(overall.total);

    var ring = $('#ringOverall');
    var ringValue = $('#ringValue');
    ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - overall.percent / 100));
    ring.classList.toggle('is-complete', overall.total > 0 && overall.done === overall.total);

    var list = $('#statList');
    list.innerHTML = '';

    DATA.subjects.forEach(function (subject) {
      var st = subjectStats(subject);

      var row = el('button', 'stat-row');
      row.type = 'button';
      if (subject.id === state.currentSubjectId) row.classList.add('is-active');
      if (st.total > 0 && st.done === st.total) row.classList.add('is-complete');

      var top = span('stat-row__top');
      top.appendChild(span('stat-row__name', subject.name));
      var countWrap = span('stat-row__count');
      var b = el('b');
      b.textContent = String(st.done);
      countWrap.appendChild(b);
      countWrap.appendChild(text(' / ' + st.total));
      top.appendChild(countWrap);

      var barWrap = span('stat-row__bar');
      var barFill = span('');
      barFill.style.width = st.percent + '%';
      barWrap.appendChild(barFill);

      var foot = span('stat-row__foot');
      foot.appendChild(span('', '剩余 ' + st.left + ' 项'));
      foot.appendChild(span('', st.percent + '%'));

      row.appendChild(top);
      row.appendChild(barWrap);
      row.appendChild(foot);

      row.addEventListener('click', function () {
        closeStatsPopover();
        switchSubject(subject.id);
      });
      list.appendChild(row);
    });

    renderTip();
  }

  function renderTip() {
    var subject = getSubject(state.currentSubjectId);
    var st = subject ? subjectStats(subject) : { left: 0, plusTotal: 0, plusDone: 0 };
    var plusLeft = st.plusTotal - st.plusDone;
    var daily = state.daily && state.daily.date === todayStr() ? state.daily.count : 0;
    var code = window.Cloud ? Cloud.getCode() : '';

    var card = $('#tipCard');
    card.innerHTML = '';

    var line = el('div');
    line.appendChild(text('当前学科 '));
    var bName = el('b');
    bName.textContent = subject ? subject.name : '—';
    line.appendChild(bName);
    line.appendChild(text(' 还剩 '));
    var bLeft = el('b');
    bLeft.textContent = String(st.left);
    line.appendChild(bLeft);
    line.appendChild(text(' 项未完成'));
    if (st.plusTotal) {
      line.appendChild(text('，其中串讲任务 '));
      var bPlus = el('b');
      bPlus.textContent = String(plusLeft);
      line.appendChild(bPlus);
      line.appendChild(text(' 项'));
    }
    line.appendChild(text('。'));

    var kv = span('tip-card__kv');
    var syncSpan = span('', code ? ('云同步 · ' + maskCode(code)) : '云同步 · 未连接');
    syncSpan.title = code ? '同步码：' + code : '设置同步码后，进度会保存到云端';
    kv.appendChild(syncSpan);
    kv.appendChild(span('', '今日已勾选 ' + daily + ' 项'));

    card.appendChild(line);
    card.appendChild(kv);
  }

  /* ---------------- 云同步状态 / 同步码 ---------------- */

  function maskCode(value) {
    var code = String(value || '');
    if (!code) return '';
    if (code.length <= 6) return code;
    return code.slice(0, 4) + '••••' + code.slice(-2);
  }

  function updateSyncChip() {
    var chip = $('#syncChip');
    var label = $('#syncText');
    if (!chip || !label) return;

    var st = window.Cloud ? Cloud.getStatus() : 'unconfigured';
    var code = window.Cloud ? Cloud.getCode() : '';

    var map = {
      unconfigured: '云同步未配置',
      offline: '云同步不可用',
      idle: '设置同步码',
      syncing: '同步中…',
      synced: '已同步',
      error: '同步失败 · 重试'
    };

    chip.dataset.status = st;
    label.textContent = map[st] || '云同步';
    chip.title = code
      ? ('同步码：' + maskCode(code) + '（点击立即同步）')
      : (st === 'unconfigured' ? '点击查看 Supabase 配置指南' : '点击设置同步码');

    if (window.Turntable && typeof Turntable.updateCloudNote === 'function') {
      Turntable.updateCloudNote();
    }
  }

  function openSyncModal() {
    var input = $('#syncCodeInput');
    var err = $('#syncError');
    var disconnectBtn = $('#btnDisconnect');

    var currentCode = window.Cloud ? Cloud.getCode() : '';
    // 未连接时自动填一个随机码：用户只需点「连接并同步」，再记下这个码即可
    if (input) input.value = currentCode || (window.Cloud ? Cloud.randomCode() : '');
    if (err) { err.hidden = true; err.textContent = ''; }
    if (disconnectBtn) disconnectBtn.hidden = !(window.Cloud && Cloud.getCode());

    openModal('syncModal');
    setTimeout(function () {
      if (input) input.focus();
    }, 50);
  }

  function connectSync() {
    if (!window.Cloud) return;

    var input = $('#syncCodeInput');
    var err = $('#syncError');
    var value = input ? input.value : '';

    if (err) { err.hidden = true; err.textContent = ''; }

    var promise = Cloud.connect(value);

    promise.then(function (result) {
      var ids = result.ids || [];
      ids.forEach(function (id) { state.done.add(id); });

      var localOnly = [];
      state.done.forEach(function (id) {
        if (ids.indexOf(id) === -1) localOnly.push(id);
      });
      if (localOnly.length) Cloud.saveDone(Array.from(state.done));

      if (window.Turntable && typeof Turntable.setCloud === 'function') {
        Turntable.setCloud({ connected: true, data: result.turntable || null });
      }

      closeModal('syncModal');
      renderAll();
      showToast('已连接同步码，看板与转盘进度已载入');
    }).catch(function (error) {
      if (err) {
        err.hidden = false;
        err.textContent = error.message || '连接失败，请重试';
      }
    });
  }

  function generateCode() {
    if (!window.Cloud) return;
    var input = $('#syncCodeInput');
    if (input) input.value = Cloud.randomCode(16);
  }

  function disconnectSync() {
    if (!window.Cloud || !Cloud.getCode()) return;
    var ok = confirm(
      '确定断开本机云同步吗？\n本页进度会清空，云端数据仍保留；之后填入同一个同步码即可恢复。'
    );
    if (!ok) return;

    Cloud.disconnect().then(function () {
      state.done.clear();
      state.daily = { date: todayStr(), count: 0 };
      if (window.Turntable && typeof Turntable.setCloud === 'function') {
        Turntable.setCloud({ connected: false, data: null });
      }
      closeModal('syncModal');
      renderAll();
      showToast('已断开云同步，本页进度已清空');
    });
  }

  function manualSync() {
    if (!window.Cloud) return;

    var st = Cloud.getStatus();
    if (st === 'unconfigured' || st === 'offline') {
      openModal('setupModal');
      return;
    }
    if (!Cloud.getCode()) {
      openSyncModal();
      return;
    }

    Cloud.fetchDone().then(function (ids) {
      var added = 0;
      ids.forEach(function (id) {
        if (!state.done.has(id)) { state.done.add(id); added++; }
      });
      var localOnly = [];
      state.done.forEach(function (id) {
        if (ids.indexOf(id) === -1) localOnly.push(id);
      });
      if (localOnly.length) Cloud.saveDone(Array.from(state.done));
      if (window.Turntable) {
        Cloud.fetchTurntable().then(function (data) {
          Turntable.setCloud({ connected: true, data: data || null });
        }).catch(function () { /* 状态已由 Cloud 标记 */ });
      }
      renderAll();
      if (added) showToast('已从云端同步 ' + added + ' 条记录');
    }).catch(function (error) {
      showToast('同步失败：' + error.message);
    });
  }

  /* ---------------- 导出 / 导入 / 重置 ---------------- */

  function exportProgress() {
    var payload = {
      app: 'xizong-progress-board',
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: Array.from(state.done).sort()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    a.href = url;
    a.download = '西综进度-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var arr = Array.isArray(parsed) ? parsed : parsed.progress;
        if (!Array.isArray(arr)) throw new Error('文件格式不正确');

        var merged = [];
        arr.forEach(function (id) {
          if (typeof id === 'string' && !state.done.has(id)) {
            state.done.add(id);
            merged.push(id);
          }
        });

        if (merged.length) persistAll();

        renderAll();
        alert('导入完成：新增 ' + merged.length + ' 条完成记录，当前共 ' + state.done.size + ' 条。');
      } catch (e) {
        alert('导入失败：' + e.message);
      }
    };
    reader.onerror = function () { alert('读取文件失败，请重试。'); };
    reader.readAsText(file, 'utf-8');
  }

  function resetProgress() {
    if (!state.done.size) {
      alert('当前还没有完成记录，无需重置。');
      return;
    }
    var connected = !!(window.Cloud && Cloud.getCode());
    var msg = '确定要清空全部完成记录吗？\n共 ' + state.done.size + ' 条' +
      (connected ? '，云端记录也会一并清空' : '') + '，操作不可撤销（建议先导出备份）。';
    if (!confirm(msg)) return;

    state.done.clear();
    state.daily = { date: todayStr(), count: 0 };
    if (connected) Cloud.saveDone([]);
    renderAll();
  }

  function renderAll() {
    renderNav();
    renderTasks();
    renderStats();
    updateSubjectMeta();
    updateSyncChip();
  }

  /* ---------------- 弹窗 ---------------- */

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector('.modal:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
  }

  function closeAllModals() {
    Array.prototype.forEach.call(document.querySelectorAll('.modal:not([hidden])'), function (m) {
      m.hidden = true;
    });
    document.body.classList.remove('modal-open');
  }

  function showToast(message) {
    var toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('is-show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove('is-show');
      setTimeout(function () { toast.hidden = true; }, 250);
    }, 2600);
  }

  function copyText(targetId, button) {
    var target = document.getElementById(targetId);
    if (!target) return;
    var value = target.textContent || '';

    function done() {
      if (!button) return;
      var original = button.textContent;
      button.textContent = '已复制';
      setTimeout(function () { button.textContent = original; }, 1500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(function () { done(); });
    } else {
      done();
    }
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    $('#btnExport').addEventListener('click', exportProgress);

    $('#btnImport').addEventListener('click', function () { $('#importFile').click(); });

    $('#importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importProgress(file);
      e.target.value = '';
    });

    $('#btnReset').addEventListener('click', resetProgress);

    var searchInput = $('#searchInput');
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var value = searchInput.value;
      searchTimer = setTimeout(function () {
        state.query = value;
        renderTasks();
      }, 160);
    });

    $('#btnHideDone').addEventListener('click', function () {
      state.hideDone = !state.hideDone;
      this.setAttribute('aria-pressed', String(state.hideDone));
      this.textContent = state.hideDone ? '显示全部' : '隐藏已完成';
      renderTasks();
    });

    $('#btnExpandAll').addEventListener('click', function () {
      var subject = getSubject(state.currentSubjectId);
      if (!subject) return;
      subject.chapters.forEach(function (ch) { state.collapsed.delete(chapterKey(subject.id, ch.id)); });
      renderTasks();
    });

    $('#btnCollapseAll').addEventListener('click', function () {
      var subject = getSubject(state.currentSubjectId);
      if (!subject) return;
      subject.chapters.forEach(function (ch) { state.collapsed.add(chapterKey(subject.id, ch.id)); });
      renderTasks();
    });

    // 云同步
    $('#syncChip').addEventListener('click', manualSync);
    $('#btnConnect').addEventListener('click', connectSync);
    $('#btnGenCode').addEventListener('click', generateCode);
    $('#btnDisconnect').addEventListener('click', disconnectSync);

    var syncCodeInput = $('#syncCodeInput');
    if (syncCodeInput) {
      syncCodeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); connectSync(); }
      });
    }

    var openSetup = $('#openSetupFromSync');
    if (openSetup) {
      openSetup.addEventListener('click', function () {
        closeModal('syncModal');
        openModal('setupModal');
      });
    }

    // 关闭按钮 / 遮罩
    Array.prototype.forEach.call(document.querySelectorAll('[data-close-modal]'), function (node) {
      node.addEventListener('click', function () { closeModal(node.dataset.closeModal); });
    });

    // 复制按钮
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy-target]'), function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.dataset.copyTarget, btn);
      });
    });

    // 功能切换：进度看板 / 学习转盘
    $('#viewBoardBtn').addEventListener('click', function () { switchView('board'); });
    $('#viewWheelBtn').addEventListener('click', function () { switchView('wheel'); });

    // 统计下拉面板
    var statsBtn = $('#btnStatsToggle');
    if (statsBtn) statsBtn.addEventListener('click', toggleStatsPopover);
    var statsClose = $('#btnStatsClose');
    if (statsClose) statsClose.addEventListener('click', closeStatsPopover);
    document.addEventListener('click', function (e) {
      var panel = statsPopover();
      if (!panel || panel.hidden) return;
      if (nodeContains(panel, e.target)) return;
      if (statsBtn && nodeContains(statsBtn, e.target)) return;
      closeStatsPopover();
    });

    // 数字键 1-5 快速切换学科（仅看板视图）
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeAllModals(); closeStatsPopover(); return; }
      if (state.view !== 'board') return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= DATA.subjects.length) {
        switchSubject(DATA.subjects[idx - 1].id);
      }
    });

    window.addEventListener('hashchange', function () {
      var id = (window.location.hash || '').replace('#', '');
      if (id === 'wheel') {
        switchView('wheel');
        return;
      }
      if (getSubject(id)) {
        if (state.view !== 'board') switchView('board');
        if (id !== state.currentSubjectId) switchSubject(id);
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  function initialSubjectId() {
    var hashId = (window.location.hash || '').replace('#', '');
    if (getSubject(hashId)) return hashId;
    return DATA.subjects[0].id;
  }

  function boot() {
    if (!DATA || !Array.isArray(DATA.subjects) || !DATA.subjects.length) {
      document.body.textContent = '数据加载失败：请确认 data/tasks.js 已正确加载。';
      return;
    }

    state.currentSubjectId = initialSubjectId();

    bindEvents();
    renderAll();

    // 根据地址栏决定初始视图（#wheel → 学习转盘）
    var initialView = (window.location.hash || '').replace('#', '') === 'wheel' ? 'wheel' : 'board';
    applyView(initialView, { silent: true });

    if (!window.Cloud) {
      updateSyncChip();
      return;
    }

    Cloud.onStatus(function () { updateSyncChip(); });

    Cloud.init().then(function (result) {
      updateSyncChip();

      if (window.Turntable && typeof Turntable.setCloud === 'function') {
        Turntable.setCloud({
          connected: Boolean(result && result.code && Cloud.getCode()),
          data: result ? result.turntable : null
        });
      }

      if (result && result.ids && result.ids.length) {
        var added = 0;
        result.ids.forEach(function (id) {
          if (!state.done.has(id)) { state.done.add(id); added++; }
        });
        var localOnly = [];
        state.done.forEach(function (id) {
          if (result.ids.indexOf(id) === -1) localOnly.push(id);
        });
        if (localOnly.length) Cloud.saveDone(Array.from(state.done));
        if (added) renderAll();
      }
    }).catch(function () {
      updateSyncChip();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
