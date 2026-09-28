/* ==========================================================================
   章节阅读 · 单页化
   --------------------------------------------------------------------------
   目标（对齐三栏文档站）：
     左栏 · 目录树      点击章 / 节 / 知识点，不再整页跳转
     中栏 · 正文        就地换成被点击章节的内容（由 math-tree.js 数据生成）
     右栏 · 本页目录    列出中栏正文的 h2 / h3 小标题，滚动高亮，点击定位

   依赖：assets/js/math-tree.js（window.MATH_TREE，由 tools/build-math-tree.rb 生成）
   ========================================================================== */
(function () {
  'use strict';

  var TREE = window.MATH_TREE;
  var art = document.getElementById('knowledge-point');
  var treeEl = document.getElementById('chapter-tree');
  var outlineBlock = document.getElementById('page-outline');
  var outlineList = document.getElementById('outline-list');
  if (!TREE || !art || !treeEl) return;

  /* 设计稿里唯一一篇手写正文（1.2 有理数 · 知识点2 数轴）原样保留，
     选中该知识点、或点生成正文里的「图文详解」时展示 */
  var AUTHORED = { chapter: '01', section: '1.2', point: '2' };
  var authoredHTML = art.innerHTML;

  /* ------------------------------------------------------------------ *
   * 1. 数据索引
   * ------------------------------------------------------------------ */

  var chapterByNo = {};
  var chapterOfSection = {};

  (TREE.children || []).forEach(function (book) {
    (book.children || []).forEach(function (chapter) {
      if (chapter.kind !== 'chapter') return;
      chapterByNo[chapter.no] = { book: book, chapter: chapter };
      (chapter.children || []).forEach(function (node) {
        if (node.no) chapterOfSection[node.no] = chapter.no;
      });
    });
  });

  function secId(no) {
    return 'sec-' + String(no).replace(/\./g, '-');
  }
  function groupId(tone) {
    return 'grp-' + (tone || 'exam');
  }
  function itemId(sectionNo, itemNo) {
    return 'pt-' + String(sectionNo).replace(/\./g, '-') + '-' + itemNo;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function chapterStats(chapter) {
    var st = { sections: 0, points: 0, methods: 0, errors: 0, exams: 0 };
    (chapter.children || []).forEach(function (node) {
      if (node.kind === 'section') {
        st.sections += 1;
        (node.children || []).forEach(function (it) {
          if (it.kind === 'point') st.points += 1;
        });
      } else if (node.kind === 'group') {
        var n = (node.children || []).length;
        if (node.tone === 'method') st.methods = n;
        else if (node.tone === 'error') st.errors = n;
        else if (node.tone === 'exam') st.exams = n;
      }
    });
    return st;
  }

  /* ------------------------------------------------------------------ *
   * 2. 生成中栏正文
   * ------------------------------------------------------------------ */

  function itemsHTML(node, chapterNo, sectionNo) {
    var items = node.children || [];
    if (!items.length) {
      return '<p class="sec-empty">本节暂无收录条目。</p>';
    }
    var html = '<ol class="points-list">';
    items.forEach(function (it) {
      var isAuthored = sectionNo === AUTHORED.section &&
        it.no === AUTHORED.point &&
        chapterNo === AUTHORED.chapter;
      html += '<li class="points-list__item" id="' + itemId(sectionNo, it.no) + '">' +
        '<span class="points-list__num">' + esc(it.no) + '</span>' +
        '<p class="points-list__text">' + esc(it.name) +
        (isAuthored ? ' <a class="pt-detail" href="#" data-authored="1">图文详解 →</a>' : '') +
        '</p></li>';
    });
    return html + '</ol>';
  }

  function renderChapter(entry, focusId) {
    var book = entry.book;
    var chapter = entry.chapter;
    var st = chapterStats(chapter);
    var meta = ['本章共 ' + st.sections + ' 节', st.points + ' 个知识点'];
    if (st.methods) meta.push(st.methods + ' 个方法');
    if (st.errors) meta.push(st.errors + ' 个易错点');
    if (st.exams) meta.push(st.exams + ' 个考点');

    var html = '<nav class="breadcrumb" aria-label="面包屑">' +
      '<span class="breadcrumb__item">' + esc(book.name) + '</span>' +
      '<span class="breadcrumb__sep">／</span>' +
      '<span class="breadcrumb__item">第' + esc(chapter.cn) + '章 ' + esc(chapter.name) + '</span>' +
      '</nav>';

    html += '<p class="kp-index">第 ' + esc(chapter.no) + ' 章 · ' + esc(book.name) + '</p>';
    html += '<h1 class="kp-title">' + esc(chapter.name) + '</h1>';
    html += '<p class="kp-def">' + esc(meta.join(' · ')) + '。点击右栏「本页目录」可定位到任意一节。</p>';

    (chapter.children || []).forEach(function (node) {
      var id = node.no ? secId(node.no) : groupId(node.tone);
      var label = node.no ? node.no + '　' + node.name : node.name;
      html += '<section class="kp-block" id="' + id + '">' +
        '<h2 class="sec-title">' + esc(label) + '</h2>' +
        itemsHTML(node, chapter.no, node.no) +
        '</section>';
    });

    art.innerHTML = html;
    document.title = chapter.name + ' · 章节阅读';

    if (focusId) focusAnchor(focusId);
    else window.scrollTo({ top: 0, behavior: 'smooth' });

    buildOutline();
  }

  function showAuthored() {
    art.innerHTML = authoredHTML;
    document.title = '数轴 · 章节阅读';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    buildOutline();
  }

  function focusAnchor(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('is-flash');
    window.setTimeout(function () { el.classList.remove('is-flash'); }, 1200);
  }

  /* ------------------------------------------------------------------ *
   * 3. 右栏 · 本页目录
   * ------------------------------------------------------------------ */

  var outlineTargets = [];

  function buildOutline() {
    if (!outlineBlock || !outlineList) return;
    var heads = art.querySelectorAll('h2, h3');
    outlineList.innerHTML = '';
    outlineTargets = [];

    if (!heads.length) {
      outlineBlock.setAttribute('hidden', '');
      return;
    }
    outlineBlock.removeAttribute('hidden');

    Array.prototype.forEach.call(heads, function (head, i) {
      if (!head.id) head.id = 'art-head-' + i;
      var li = document.createElement('li');
      li.className = 'outline__item' + (head.tagName === 'H3' ? ' outline__item--sub' : '');

      var link = document.createElement('a');
      link.className = 'outline__link';
      link.href = '#' + head.id;
      link.textContent = head.textContent;
      link.addEventListener('click', function (event) {
        event.preventDefault();
        focusAnchor(head.id);
        if (window.history.replaceState) {
          window.history.replaceState(null, '', '#' + head.id);
        } else {
          window.location.hash = head.id;
        }
      });

      li.appendChild(link);
      outlineList.appendChild(li);
      outlineTargets.push({ id: head.id, link: link });
    });

    syncOutline();
  }

  function syncOutline() {
    if (!outlineTargets.length) return;
    var current = outlineTargets[0];
    outlineTargets.forEach(function (item) {
      var el = document.getElementById(item.id);
      if (el && el.getBoundingClientRect().top <= 140) current = item;
    });
    outlineTargets.forEach(function (item) {
      item.link.removeAttribute('data-active');
      item.link.removeAttribute('aria-current');
    });
    current.link.setAttribute('data-active', 'true');
    current.link.setAttribute('aria-current', 'true');
  }

  var rafId = 0;
  window.addEventListener('scroll', function () {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = 0;
      syncOutline();
    });
  }, { passive: true });

  /* ------------------------------------------------------------------ *
   * 4. 左栏 · 目录树点击：就地换中栏，不跳页
   * ------------------------------------------------------------------ */

  function markActive(row) {
    Array.prototype.forEach.call(
      treeEl.querySelectorAll('.ch-row[data-active], .sec-row[data-active], .pt-row[data-active]'),
      function (el) {
        el.removeAttribute('data-active');
        el.removeAttribute('aria-current');
      }
    );
    row.setAttribute('data-active', 'true');
    row.setAttribute('aria-current', 'true');
  }

  function chapterRowOf(row) {
    var list = row.closest('ul.section-list');
    return list ? list.previousElementSibling : null;
  }

  function sectionRowOf(row) {
    var list = row.closest('ul.point-list');
    return list ? list.previousElementSibling : null;
  }

  function selectAuthoredRow() {
    var secRow = treeEl.querySelector('.sec-row[data-section="' + AUTHORED.section + '"]');
    if (!secRow) return;
    var li = secRow.closest('li');
    var list = li ? li.querySelector('ul.point-list') : null;
    var ptRow = list ? list.querySelector('.pt-row[data-point="' + AUTHORED.point + '"]') : null;
    if (ptRow) markActive(ptRow);
  }

  treeEl.addEventListener('click', function (event) {
    var row = event.target.closest ? event.target.closest('.ch-row, .sec-row, .pt-row') : null;
    if (!row || !treeEl.contains(row)) return;

    var chapterNo = null;
    var focusId = null;
    var secNo = '';
    var pointNo = '';

    if (row.classList.contains('ch-row')) {
      chapterNo = row.getAttribute('data-chapter');
    } else if (row.classList.contains('sec-row')) {
      var chRow = chapterRowOf(row);
      chapterNo = chRow ? chRow.getAttribute('data-chapter') : null;
      secNo = row.getAttribute('data-section') || '';
      if (!secNo || secNo === 'method' || secNo === 'error') {
        focusId = groupId(secNo === 'error' ? 'error' : 'method');
      } else {
        focusId = secId(secNo);
      }
    } else {
      var secRow = sectionRowOf(row);
      var ownerRow = secRow ? chapterRowOf(secRow) : null;
      chapterNo = ownerRow ? ownerRow.getAttribute('data-chapter') : null;
      secNo = secRow ? (secRow.getAttribute('data-section') || '') : '';
      pointNo = row.getAttribute('data-point') || '';
      focusId = secNo ? itemId(secNo, pointNo) : null;
    }

    if (!chapterNo) return;
    var entry = chapterByNo[chapterNo];
    if (!entry) return;

    event.preventDefault();
    markActive(row);

    var isAuthored = pointNo && chapterNo === AUTHORED.chapter &&
      secNo === AUTHORED.section && pointNo === AUTHORED.point;

    if (isAuthored) {
      showAuthored();
      return;
    }
    renderChapter(entry, focusId);
  });

  /* 生成正文里的「图文详解」：回到手写正文 */
  art.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('[data-authored]') : null;
    if (!link) return;
    event.preventDefault();
    showAuthored();
    selectAuthoredRow();
  });

  /* ------------------------------------------------------------------ *
   * 5. 右栏提示悬停（左右栏显隐由 ide-shell.js 统一负责）
   * ------------------------------------------------------------------ */

  /* 右栏「方法速学 / 易错速析 / 对应练习」：鼠标移入即展开，点标题可固定展开 */
  Array.prototype.forEach.call(document.querySelectorAll('.side-block--fold'), function (block) {
    var head = block.querySelector('.side-block__head') || block.querySelector('.side-block__title');
    if (!head) return;

    if (head.tagName !== 'H2' && head.tagName !== 'H3') head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', 'false');

    function toggle() {
      var on = !block.classList.contains('is-open');
      if (on) block.classList.add('is-open');
      else block.classList.remove('is-open');
      head.setAttribute('aria-expanded', on ? 'true' : 'false');
    }

    head.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('a')) return; // 「查看全部」照常跳转
      event.preventDefault();
      toggle();
    });
    head.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });

  /* ------------------------------------------------------------------ *
   * 6. 启动
   * ------------------------------------------------------------------ */

  buildOutline();
  syncOutline();
})();
