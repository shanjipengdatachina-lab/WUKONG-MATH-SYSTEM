/* ==========================================================================
   章节阅读 · 单页化
   --------------------------------------------------------------------------
   目标（对齐三栏文档站）：
     左栏 · 目录树      点击章 / 节 / 知识点，不再整页跳转
     中栏 · 正文        就地换成被点击章节的内容（由 math-tree.js 数据生成）
     右栏 · 本页目录    列出中栏正文的 h2 / h3 小标题，滚动高亮，点击定位

   依赖：assets/js/math-tree.js（window.MATH_TREE，由 tools/build-math-tree.rb 生成）

   四学段的处理：数据是四个学段合在一起的（27 册 / 169 章），但一屏只该看见
   一册的那一套 —— 左栏的册 / 章 / 节按当前学段现建，默认初中。学段键与知识图谱
   共用（wkmath.graph.stage），在那边选了高中，过来这边也是高中，不用再选一次。
   ========================================================================== */
(function () {
  'use strict';

  var TREE = window.MATH_TREE;
  var art = document.getElementById('knowledge-point');
  var treeEl = document.getElementById('chapter-tree');
  var treeBody = document.getElementById('tree-body');
  var treeMeta = document.getElementById('tree-meta');
  var stageBar = document.getElementById('tree-stage');
  var outlineBlock = document.getElementById('page-outline');
  var outlineList = document.getElementById('outline-list');
  if (!TREE || !art || !treeEl) return;

  /* 设计稿里唯一一篇手写正文（1.2 有理数 · 知识点2 数轴）原样保留，
     选中该知识点、或点生成正文里的「图文详解」时展示 */
  var AUTHORED = { chapter: '01', section: '1.2', point: '2' };
  var authoredHTML = art.innerHTML;

  /* ------------------------------------------------------------------ *
   * 0. 学段：一屏只列一个学段的那几册（默认初中）
   * ------------------------------------------------------------------ */

  var STAGES = [
    { code: 'primary', short: '小学', name: '小学数学', word: '册' },
    { code: 'junior', short: '初中', name: '初中数学', word: '册' },
    { code: 'senior', short: '高中', name: '高中数学', word: '册' },
    { code: 'olympiad', short: '竞赛', name: '竞赛数学', word: '板块' }
  ];
  var STAGE_KEY = 'wkmath.graph.stage';   // 与图谱同一个键：两边记住的是同一件事
  var DEFAULT_STAGE = 'junior';

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* 忽略 */ }
  }

  function stageInfo(code) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].code === code) return STAGES[i];
    }
    return null;
  }

  /* 注意：这里读的是 math-tree.js 的原始节点（children），不是 mindmap.js 加工后的
     kids —— 图谱那页才跑 mindmap.js，这页没有它。 */
  function booksOf(code) {
    return (TREE.children || []).filter(function (book) { return book.stage === code; });
  }

  /* 存了个认不出来的值就回初中（跟图谱一致） */
  function initialStage() {
    var saved = readStore(STAGE_KEY);
    return stageInfo(saved) ? saved : DEFAULT_STAGE;
  }
  var currentStage = initialStage();

  /* 当前学段摆开来长什么样：哪几册、每册里的章用什么键。
     键要能在学段内唯一定位一章，因为章号本身不一定唯一 ——
     初中是一路 01-29 排下来的，小学按单元每册从 01 重来，高中必修 / 选必各自排，
     竞赛干脆不编号。用章号当键就会串册（点小学第一册第 1 单元翻到别的册去），
     所以只在不重复时才用章号，否则用「册序号 c 章序号」。 */
  var LAYOUT_CACHE = {};

  function layoutOf(code) {
    if (LAYOUT_CACHE[code]) return LAYOUT_CACHE[code];

    var books = booksOf(code);
    var seen = {};
    var chapters = 0;

    books.forEach(function (book) {
      (book.children || []).forEach(function (node) {
        if (node.kind === 'chapter' && node.no) seen[node.no] = (seen[node.no] || 0) + 1;
      });
    });

    var keys = books.map(function (book, bi) {
      return (book.children || []).map(function (node, ci) {
        if (node.kind === 'chapter') chapters += 1;
        return (node.no && seen[node.no] === 1) ? node.no : ('b' + bi + 'c' + ci);
      });
    });

    LAYOUT_CACHE[code] = { books: books, keys: keys, chapters: chapters };
    return LAYOUT_CACHE[code];
  }

  /* ------------------------------------------------------------------ *
   * 1. 数据索引（只索引当前学段）
   * ------------------------------------------------------------------ */

  var chapterByNo = {};

  function buildIndex() {
    chapterByNo = {};
    var layout = layoutOf(currentStage);
    layout.books.forEach(function (book, bi) {
      (book.children || []).forEach(function (chapter, ci) {
        if (chapter.kind !== 'chapter') return;
        var key = layout.keys[bi][ci];
        chapterByNo[key] = { book: book, chapter: chapter, key: key };
      });
    });
  }

  function secId(no) {
    return 'sec-' + String(no).replace(/\./g, '-');
  }
  /* 没有编号的节（小学、竞赛的活动栏目）就用「父章键 + 序号」兜底，不然整章的锚点会挤成一个 */
  function secIdOf(node, index, chapterKey) {
    return node.no ? secId(node.no) : ('sec-' + chapterKey + '-' + index);
  }
  function groupId(tone) {
    return 'grp-' + (tone || 'exam');
  }
  function itemId(sectionNo, itemNo) {
    return 'pt-' + String(sectionNo).replace(/\./g, '-') + '-' + itemNo;
  }
  function pointIdOf(sectionNo, sectionAnchor, item, index) {
    var tail = item.no || String(index + 1);
    return sectionNo
      ? ('pt-' + String(sectionNo).replace(/\./g, '-') + '-' + tail)
      : (sectionAnchor + '-p' + tail);
  }

  /* ------------------------------------------------------------------ *
   * 2. 左栏 · 按学段现建目录树
   * ------------------------------------------------------------------ */

  /* 和原手写目录同一套类名（.tree-volume / .ch-row / .sec-row / .pt-row），
     折叠与展开仍然交给 pages.js，所以现建的树和手写那棵手感完全一样。
     data-focus 直接写死目标锚点：小学的节没有编号，靠编号推锚点会算错。 */
  function chapterLabel(chapter) {
    return chapter.cn ? ('第' + chapter.cn + (chapter.unit ? '单元' : '章')) : '';
  }
  function chapterFull(chapter) {
    var pre = chapterLabel(chapter);
    return pre ? (pre + ' ' + chapter.name) : chapter.name;
  }
  function isAuthoredChapter(code, chapter) {
    return code === 'junior' && chapter.no === AUTHORED.chapter;
  }

  var PT_LABEL = { point: '知识点', method: '方法', error: '易错点', exam: '考点' };

  function warnHTML(text, cls) {
    return '<span class="' + cls + '" title="' + esc(text) + '">待核</span>';
  }

  function treeHTML(code) {
    var layout = layoutOf(code);
    var html = '';

    layout.books.forEach(function (book, bi) {
      var chapters = (book.children || []).filter(function (node) { return node.kind === 'chapter'; });
      var body = '';

      if (!chapters.length) {
        body = '<p class="tree-note">' +
          esc(book.pending || '这一册的小节还没收录') + '</p>';
      } else {
        chapters.forEach(function (chapter) {
          var ci = (book.children || []).indexOf(chapter);
          var key = layout.keys[bi][ci];
          var active = isAuthoredChapter(code, chapter);
          var activeAttr = active ? ' data-active="true" aria-current="true"' : '';

          body += '<li><a class="ch-row" href="chapter.html" data-chapter="' + esc(key) + '"' + activeAttr + '>' +
            '<span class="ch-row__num">' + esc(chapter.no || '') + '</span>' +
            '<span class="ch-row__name">' + esc(chapter.name) + '</span>' +
            (chapter.pending ? warnHTML(chapter.pending, 'ch-row__warn') : '') +
            '</a>';

          var sections = chapter.children || [];
          if (sections.length) {
            /* 当前正在读的那一章默认摊开，其余收起（和设计稿一致） */
            body += '<ul class="section-list" data-subtree="' + (active ? 'expanded' : 'collapsed') + '">';
            sections.forEach(function (node, si) {
              var anchor = node.kind === 'group'
                ? groupId(node.tone)
                : secIdOf(node, si, key);
              var secActive = active && node.no === AUTHORED.section;
              var isGroup = node.kind === 'group';

              body += '<li><a class="sec-row" href="reader.html"' +
                ' data-section="' + esc(isGroup ? node.tone : (node.no || '')) + '"' +
                ' data-focus="' + esc(anchor) + '"' +
                (secActive ? ' data-active="true" aria-current="true"' : '') + '>' +
                '<span class="sec-row__num">' + esc(node.no || '') + '</span>' +
                '<span class="sec-row__name">' + esc(node.name) + '</span></a>';

              var items = node.children || [];
              if (items.length) {
                body += '<ul class="point-list" data-subtree="' + (secActive ? 'expanded' : 'collapsed') + '">';
                items.forEach(function (item, ii) {
                  var itemActive = secActive && item.no === AUTHORED.point;
                  body += '<li><a class="pt-row" href="reader.html"' +
                    ' data-point="' + esc(item.no || String(ii + 1)) + '"' +
                    ' data-focus="' + esc(pointIdOf(node.no, anchor, item, ii)) + '"' +
                    (itemActive ? ' data-active="true" aria-current="true"' : '') + '>' +
                    '<span class="pt-row__idx">' + esc(PT_LABEL[item.kind] || '知识点') + '</span>' +
                    '<span class="pt-row__num">' + esc(item.no || String(ii + 1)) + '</span>' +
                    '<span class="pt-row__name">' + esc(item.name) + '</span></a></li>';
                });
                body += '</ul>';
              }
              body += '</li>';
            });
            body += '</ul>';
          }
          body += '</li>';
        });
      }

      html += '<section class="tree-volume">' +
        '<div class="volume-head">' +
        '<span class="volume-head__name">' + esc(book.name) + '</span>' +
        (book.pending ? warnHTML(book.pending, 'volume-head__warn') : '') +
        '<i data-lucide="chevron-down" class="volume-head__icon"></i>' +
        '</div>' +
        '<ul class="chapter-list" data-subtree="expanded">' + body + '</ul>' +
        '</section>';
    });

    return html;
  }

  /* 待核按两级数：册级（整册目录没核到）和章级（小节没核到）。
     只数册级会把"章还标着待核"的小学显示成完全核过，所以两级都要算。 */
  function pendingCount(code) {
    var n = 0;
    booksOf(code).forEach(function (book) {
      if (book.pending) n += 1;
      (book.children || []).forEach(function (ch) { if (ch.pending) n += 1; });
    });
    return n;
  }

  function metaText(code) {
    var layout = layoutOf(code);
    var info = stageInfo(code) || {};
    var pending = pendingCount(code);
    return layout.books.length + ' ' + (info.word || '册') + ' · ' +
      layout.chapters + ' 章' + (pending ? ' · ' + pending + ' 待核' : '');
  }

  function paintStage() {
    if (stageBar && stageBar.querySelectorAll) {
      Array.prototype.forEach.call(stageBar.querySelectorAll('[data-stage]'), function (chip) {
        var on = chip.getAttribute('data-stage') === currentStage;
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) chip.className = 'tree-stage__chip is-on';
        else chip.className = 'tree-stage__chip';
      });
    }
    if (treeMeta) {
      var info = stageInfo(currentStage);
      treeMeta.textContent = metaText(currentStage);
      treeMeta.setAttribute('title', (info ? info.name : '') + ' · ' + metaText(currentStage));
    }
  }

  /* 重建之后要重新绑一次折叠逻辑 —— 旧节点随 innerHTML 一起没了。
     首次（DOMContentLoaded 之前）不绑：pages.js 那边本来就会绑一次，
     这边再绑一次就成了点一下展开又被点回去。 */
  var treeBound = false;

  function mountTree() {
    if (!treeBody) return;
    treeBody.innerHTML = treeHTML(currentStage);
    /* 重建之后回到顶部。宽屏下左栏是「目录头 / 学段条固定 + 中间那条名单自己滚」
       （见 reader.html 的 `@media (min-width:1024px)`：.tree-body 才是滚动容器），
       换学段时若留着上一条的 scrollTop，新名单的头几行就停在学段条底下 ——
       用户看到的是"点一下学段，第一册被挡掉半截"。换一套名单就是重看一遍，从头上开始。 */
    if (typeof treeBody.scrollTop === 'number') treeBody.scrollTop = 0;
    var api = window.MathSite;
    if (api && api.icons) api.icons();
    if (treeBound && api && api.initReaderTree) api.initReaderTree();
  }

  function markActiveKey(key) {
    if (!treeBody || !treeBody.querySelector) return;
    var row = treeBody.querySelector('.ch-row[data-chapter="' + key + '"]');
    if (row) markActive(row);
  }

  /* 换学段之后中间栏回到哪儿：初中回到手写正文（设计稿的初始状态），
     其余学段落到第一册第一章。
     **兜底**：万一这个学段的目录里一个能渲染的"章"都没有（数据还没上），
     必须给一句明确的话 —— 原来这里悄悄就返回了，中间栏会留着**上一个学段**那篇文章，
     用户看到的就是"左边选了小学、正文还是高中的三角函数"。 */
  function showStageHome() {
    if (currentStage === DEFAULT_STAGE) {
      showAuthored();
      return;
    }
    var layout = layoutOf(currentStage);
    for (var bi = 0; bi < layout.books.length; bi++) {
      var kids = layout.books[bi].children || [];
      for (var ci = 0; ci < kids.length; ci++) {
        if (kids[ci].kind !== 'chapter') continue;
        var key = layout.keys[bi][ci];
        if (!chapterByNo[key]) continue; // 索引里没有这一章（数据缺口）→ 接着往后找
        renderChapter(chapterByNo[key]);
        markActiveKey(key);
        return;
      }
    }
    showStageEmpty();
  }

  /* 这个学段一条章都没有时的中间栏：说清是什么情况，而不是留一篇别的学段的文章 */
  function showStageEmpty() {
    var info = stageInfo(currentStage) || {};
    art.innerHTML = '<h1 class="kp-title">' + esc(info.name || '这个学段') + '还没上内容</h1>' +
      '<p class="sec-empty">目录由后台上传，这一学段的册与章还在准备中。左边的学段按钮随时可以切回去。</p>';
    document.title = (info.short || '学段') + ' · 悟空数学';
    buildOutline();
  }

  function setStage(code) {
    if (!stageInfo(code) || code === currentStage) return;
    currentStage = code;
    writeStore(STAGE_KEY, code);
    buildIndex();
    paintStage();
    mountTree();
    showStageHome();
  }

  if (stageBar && stageBar.addEventListener) {
    stageBar.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('[data-stage]') : null;
      if (!chip || !stageBar.contains(chip)) return;
      setStage(chip.getAttribute('data-stage'));
    });
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

  function itemsHTML(node, chapter, anchor) {
    var items = node.children || [];
    if (!items.length) {
      return '<p class="sec-empty">本节暂无收录条目。</p>';
    }
    var html = '<ol class="points-list">';
    items.forEach(function (it, ii) {
      var isAuthored = chapter.no === AUTHORED.chapter &&
        node.no === AUTHORED.section &&
        it.no === AUTHORED.point;
      html += '<li class="points-list__item" id="' + pointIdOf(node.no, anchor, it, ii) + '">' +
        '<span class="points-list__num">' + esc(it.no || String(ii + 1)) + '</span>' +
        '<p class="points-list__text">' + esc(it.name) +
        (isAuthored ? ' <a class="pt-detail" href="#" data-authored="1">图文详解 →</a>' : '') +
        '</p></li>';
    });
    return html + '</ol>';
  }

  /* 待核：这份目录要给学生看，哪儿还没核到，正文里就说清。
     **不再渲染"目录来源"那一行**（用户要的："目录里所有的数据来源的那个网址 去掉即可；
     后期我们的数据都是自己后台上传的"）—— 数据里 source 字段仍留着：生成器拿它当必填项、
     校验也还在，只是不再把那串网址端到学生面前。 */
  function notesHTML(book, chapter) {
    var html = '';
    var pending = chapter.pending || book.pending;
    if (pending) {
      html += '<p class="kp-pending"><span class="kp-pending__tag">待核</span>' + esc(pending) + '</p>';
    }
    return html;
  }

  function renderChapter(entry, focusId) {
    if (!entry) return;
    var book = entry.book;
    var chapter = entry.chapter;
    var st = chapterStats(chapter);

    var meta = [];
    if (st.sections) meta.push('本章共 ' + st.sections + ' 节');
    else if (!(chapter.children || []).length) meta.push('这一章目前只有章节框架，小节还没收录');
    else meta.push('本章共 0 节');
    if (st.points) meta.push(st.points + ' 个知识点');
    if (st.methods) meta.push(st.methods + ' 个方法');
    if (st.errors) meta.push(st.errors + ' 个易错点');
    if (st.exams) meta.push(st.exams + ' 个考点');

    var index = [];
    if (chapter.no) index.push('第 ' + chapter.no + (chapter.unit ? '单元' : '章'));
    index.push(book.name);

    var html = '<nav class="breadcrumb" aria-label="面包屑">' +
      '<span class="breadcrumb__item">' + esc(book.name) + '</span>' +
      '<span class="breadcrumb__sep">／</span>' +
      '<span class="breadcrumb__item">' + esc(chapterFull(chapter)) + '</span>' +
      '</nav>';

    html += '<p class="kp-index">' + esc(index.join(' · ')) + '</p>';
    html += '<h1 class="kp-title">' + esc(chapter.name) + '</h1>';
    /* 「本页目录」在宽屏是右栏、窄屏摞在正文下面 —— 所以这句话**不能**写成"点击右栏"：
       ≥1024 才有右栏（1024~1279 那一档原来干脆没有右栏，话说得出口、栏却不在）。 */
    html += '<p class="kp-def">' + esc(meta.join(' · ')) + '。「本页目录」里可以跳到任意一节。</p>';
    html += notesHTML(book, chapter);

    (chapter.children || []).forEach(function (node, si) {
      var anchor = node.kind === 'group' ? groupId(node.tone) : secIdOf(node, si, entry.key);
      var label = node.no ? node.no + '　' + node.name : node.name;
      html += '<section class="kp-block" id="' + anchor + '">' +
        '<h2 class="sec-title">' + esc(label) + '</h2>' +
        itemsHTML(node, chapter, anchor) +
        '</section>';
    });

    art.innerHTML = html;
    document.title = chapter.name + ' · 悟空数学';

    if (focusId) focusAnchor(focusId);
    else window.scrollTo({ top: 0, behavior: 'smooth' });

    buildOutline();
  }

  function showAuthored() {
    art.innerHTML = authoredHTML;
    document.title = '数轴 · 悟空数学';
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
    /* 现建的树直接把目标锚点写在 data-focus 上（小学的节没有编号，推不出来） */
    var focusAttr = row.getAttribute ? row.getAttribute('data-focus') : null;

    if (row.classList.contains('ch-row')) {
      chapterNo = row.getAttribute('data-chapter');
    } else if (row.classList.contains('sec-row')) {
      var chRow = chapterRowOf(row);
      chapterNo = chRow ? chRow.getAttribute('data-chapter') : null;
      secNo = row.getAttribute('data-section') || '';
      if (focusAttr) {
        focusId = focusAttr;
      } else if (!secNo || secNo === 'method' || secNo === 'error') {
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
      if (focusAttr) focusId = focusAttr;
      else focusId = secNo ? itemId(secNo, pointNo) : null;
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

  buildIndex();
  paintStage();
  mountTree();
  /* 记着的学段不是初中，中栏也跟着换成那一套的第一章 */
  if (currentStage !== DEFAULT_STAGE) showStageHome();

  /* pages.js 要到 DOMContentLoaded 才绑折叠逻辑，它绑的就是刚建出来的这棵树。
     那之后再重建（换学段）就得由我们补绑一次 —— 这里只是把开关拨上去。 */
  document.addEventListener('DOMContentLoaded', function () { treeBound = true; });

  buildOutline();
  syncOutline();
})();
