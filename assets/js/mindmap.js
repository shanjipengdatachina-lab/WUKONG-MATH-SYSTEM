/* ==========================================================================
   知识图谱 · 脑图引擎 (mindmap.js)
   --------------------------------------------------------------------------
   目标：把「六册 → 29 章 → 节 → 知识点」这张层级网做成一张平面、可无限拖放的
         画布。层级用连线表达，点击节点在右侧看信息。
   做法：不引入任何图形库（项目零构建、可离线），自己实现：
     1. 整齐树布局（列对齐 + 父节点居中于子节点）
     2. SVG 字符串渲染（一次 innerHTML，比逐节点 createElement 快很多）
     3. 平移 / 缩放（唯一变换矩阵；画布是纯色底，不加任何底纹）
     4. 折叠展开（含「保持被点节点不动」的手感处理）
     5. 定位搜索 + 按册筛选 + 信息面板
     6. 跨层级关联（前置/后续）虚线：只有真实存在的数据才画，不编造
   数据来自 assets/js/math-tree.js（由 tools/build-math-tree.rb 生成）。
   ========================================================================== */

var __wkGraph = function () {
  'use strict';

  var MS = window.MathSite;
  var DATA = window.MATH_TREE;
  if (!MS || !DATA) return;

  var qs = MS.qs;
  var qsa = MS.qsa;
  var toast = MS.toast;

  var canvas = qs('#mm-canvas');
  var svg = qs('#mm-svg');
  var world = qs('#mm-world');
  var panel = qs('#mm-panel');
  var zoomLabel = qs('#mm-zoom-label');
  var searchInput = qs('#mm-search');
  var searchResults = qs('#mm-search-results');
  if (!canvas || !world || !panel) return;

  /* ------------------------------------------------------------------ *
   * 0. 已有知识卡片的节点（目前只有「数轴」一张样板卡）
   * ------------------------------------------------------------------ */

  var CARD_BY_NAME = { 数轴: 'concept.html' };

  // 跨层级关联：只登记真实写进卡片里的前置 / 后续，不做推断
  var CROSS_LINKS = {
    数轴: [
      { name: '有理数的有关概念', rel: '前置' },
      { name: '正数和负数', rel: '前置' },
      { name: '相反数', rel: '后续' },
      { name: '绝对值', rel: '后续' },
      { name: '有理数大小的比较', rel: '后续' },
      { name: '用数轴表示有理数的方法', rel: '后续' },
      { name: '实数与数轴的关系', rel: '后续' }
    ]
  };

  var KIND_LABEL = {
    root: '总览', stage: '学段', book: '册', track: '板块', field: '体系',
    chapter: '章', section: '节', group: '栏目',
    point: '知识点', method: '方法', error: '易错点', exam: '考点'
  };

  var BOXED = { root: 1, stage: 1, book: 1, track: 1, field: 1, chapter: 1 };
  var DOTTED = { point: 1, method: 1, error: 1, exam: 1 };

  /* ------------------------------------------------------------------ *
   * 1. 预处理：补齐 id / parent / 深度 / 后代统计
   * ------------------------------------------------------------------ */

  var byId = {};
  var byName = {};
  var seq = 0;

  function prepare(node, parent, depth) {
    node.id = 'n' + (seq++);
    node.parent = parent;
    node.depth = depth;
    node.kids = node.children || [];
    node.hasChildren = node.kids.length > 0;
    node.agg = { chapter: 0, section: 0, group: 0, point: 0, method: 0, error: 0, exam: 0 };

    node.kids.forEach(function (child) {
      prepare(child, node, depth + 1);
      node.agg[child.kind] = (node.agg[child.kind] || 0) + 1;
      Object.keys(child.agg).forEach(function (kind) {
        node.agg[kind] += child.agg[kind];
      });
    });

    byId[node.id] = node;
    if (!byName[node.name]) byName[node.name] = node;
    return node;
  }
  prepare(DATA, null, 0);

  var TOTAL_NODES = seq;
  var totalEl = qs('[data-mm-total]');
  if (totalEl) totalEl.textContent = String(TOTAL_NODES);

  function eachNode(node, fn) {
    fn(node);
    node.kids.forEach(function (child) { eachNode(child, fn); });
  }

  /* ------------------------------------------------------------------ *
   * 2. 折叠状态
   * ------------------------------------------------------------------ */

  var collapsed = {};
  var DEFAULTS = {};

  function markDefaults(depthLimit) {
    collapsed = {};
    eachNode(DATA, function (node) {
      if (node.hasChildren && node.depth >= depthLimit) collapsed[node.id] = true;
    });
    DEFAULTS[depthLimit] = true;
  }

  // 默认：册展开、章可见但收起 —— 一屏看到 6 册 29 章
  markDefaults(2);

  function visibleKids(node) {
    return collapsed[node.id] ? [] : node.kids;
  }

  function collectVisible(node, out) {
    out.push(node);
    visibleKids(node).forEach(function (child) { collectVisible(child, out); });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 3. 筛选范围：学段 → 册（教材册次）或课标领域
   * ------------------------------------------------------------------ */

  /* 四个学段（与 tools/build-math-tree.rb 的 STAGES 一一对应）。
     学段是"册"上的一个字段，不是树上的一层 —— 加一层会让折叠档位、面板统计、
     阅读器、默认深度全部往后挪一格，而收益为零：学段是大分区，
     不会有人在同一屏里既展开"高中"又展开"必修一"。
     所以选中学段时，用一个**合成根**把它当成整张图的根（复用"按领域分"那套机制）。 */
  var STAGES = [
    { code: 'primary', name: '小学数学', short: '小学' },
    { code: 'junior', name: '初中数学', short: '初中' },
    { code: 'senior', name: '高中数学', short: '高中' },
    { code: 'olympiad', name: '竞赛数学', short: '竞赛' }
  ];
  var STAGE_CODES = STAGES.map(function (s) { return s.code; });

  /* 两个分法在每个学段里叫什么。竞赛只有板块，第二栏没有。 */
  var AXIS_TITLE = {
    primary: { book: '教材册次', field: '四大领域' },
    junior: { book: '年级教材', field: '几何代数' },
    senior: { book: '教材册次', field: '课标主题' },
    olympiad: { book: '四大板块', field: null }
  };

  /* 册 / 板块的短名（挂在章号前面用，也和工具条上的字一致） */
  var BOOK_SHORT = {
    /* 小学：一二三年级是 2024 新版、四五六年级是 2013 旧版（按"当前在用"取） */
    '一年级上册': '一上', '一年级下册': '一下',
    '二年级上册': '二上', '二年级下册': '二下',
    '三年级上册': '三上', '三年级下册': '三下',
    '四年级上册': '四上', '四年级下册': '四下',
    '五年级上册': '五上', '五年级下册': '五下',
    '六年级上册': '六上', '六年级下册': '六下',
    /* 初中 */
    '七年级（上）': '七上', '七年级（下）': '七下',
    '八年级（上）': '八上', '八年级（下）': '八下',
    '九年级（上）': '九上', '九年级（下）': '九下',
    /* 高中：人教A版是按册的（必修两册 + 选择性必修三册），不是按年级 */
    '必修第一册': '必修一', '必修第二册': '必修二',
    '选择性必修第一册': '选必一', '选择性必修第二册': '选必二', '选择性必修第三册': '选必三'
  };

  function stageOf(code) {
    for (var i = 0; i < STAGES.length; i++) { if (STAGES[i].code === code) return STAGES[i]; }
    return STAGES[1];   // 认不出来就回初中（现在的内容都是初中的）
  }

  /* 某个学段的册 / 板块（按数据里的顺序） */
  function booksOf(code) {
    return DATA.kids.filter(function (b) { return b.stage === code; });
  }

  var STAGE_SCOPES = {};
  /* 学段的合成根：depth 0（与总根同层），孩子是该学段的册 —— 列位置不用特判 */
  function stageScope(code) {
    if (STAGE_SCOPES[code]) return STAGE_SCOPES[code];
    var kids = booksOf(code);
    if (!kids.length) return null;
    var agg = { book: 0, track: 0, chapter: 0, section: 0, group: 0, point: 0, method: 0, error: 0, exam: 0 };
    kids.forEach(function (b) {
      Object.keys(b.agg || {}).forEach(function (k) { agg[k] += b.agg[k]; });
      agg[b.kind] = (agg[b.kind] || 0) + 1;
    });
    var node = {
      id: 's:' + code,
      name: stageOf(code).name,
      kind: 'stage',
      depth: 0,
      parent: null,
      kids: kids,
      children: kids,
      hasChildren: true,
      agg: agg,
      kidsSet: kids.reduce(function (m, b) { m[b.id] = true; return m; }, {})
    };
    STAGE_SCOPES[code] = node;
    return node;
  }

  /* 当前只看哪一块：'' 是这一学段的总览，册名或领域名。
     两个分法共用这一个变量 —— 它本身就可判别，不需要再造一个开关去同步。 */
  var scopeKey = '';

  /* 领域名 → 图里那个合成根。**按学段缓存**：同一个「数与代数」在小学和初中
     都有，不分开缓存就会串台（小学点"数与代数"，出来的却是初中的 13 章）。 */
  var FIELD_SCOPES = {};
  /* 列表与工具条上用短名，图里的节点名仍用课标全称 */
  var FIELD_SHORT = {
    '数与代数': '代数', '图形与几何': '几何', '统计与概率': '统计与概率', '综合与实践': '综合实践',
    '预备知识': '预备', '函数': '函数', '几何与代数': '几何代数',
    '概率与统计': '概率统计', '数学建模活动与数学探究活动': '建模探究'
  };

  function fieldScope(stageCode, name) {
    var cacheKey = stageCode + ':' + name;
    if (FIELD_SCOPES[cacheKey]) return FIELD_SCOPES[cacheKey];
    var kids = [];
    booksOf(stageCode).forEach(function (b) {
      (b.kids || []).forEach(function (ch) { if (ch.field === name) kids.push(ch); });
    });
    if (!kids.length) return null;
    var agg = { chapter: 0, section: 0, group: 0, point: 0, method: 0, error: 0, exam: 0 };
    kids.forEach(function (ch) {
      Object.keys(ch.agg || {}).forEach(function (k) { agg[k] += ch.agg[k]; });
    });
    agg.chapter = kids.length;
    var node = {
      id: 'f:' + cacheKey,
      name: name,
      kind: 'field',
      /* 与"册"同层（depth 1），所以列位置、字号、盒子这些全都不用特判 */
      depth: 1,
      parent: null,
      kids: kids,
      children: kids,
      hasChildren: true,
      agg: agg,
      /* 自己孩子的索引。locate() 判断"目标在不在当前范围里"是沿着父链往上走，
         而章的真实父节点是册、永远走不到这个合成节点上 ——
         没有这张表，在「几何」范围内定位「平行四边形」（明明就在眼前）会被
         误判成"在别处"，然后把筛选清掉。 */
      kidsSet: kids.reduce(function (m, ch) { m[ch.id] = true; return m; }, {})
    };
    FIELD_SCOPES[cacheKey] = node;
    return node;
  }

  /* 某学段里出现过的领域名，按这个顺序列（数据里没有的领域不列 ——
     列了却没内容是骗人的）。
     初中的顺序是"几何在前"：那一栏的名字就叫「几何代数」，名字与列表对得上，
     这是上次定下的；小学与高中按课标自己的顺序。 */
  var FIELD_ORDER = {
    primary: ['数与代数', '图形与几何', '统计与概率', '综合与实践'],
    junior: ['图形与几何', '数与代数', '统计与概率'],
    senior: ['预备知识', '函数', '几何与代数', '概率与统计', '数学建模活动与数学探究活动'],
    olympiad: []
  };

  function fieldNames(stageCode) {
    var seen = {};
    booksOf(stageCode).forEach(function (b) {
      (b.kids || []).forEach(function (ch) { if (ch.field) seen[ch.field] = true; });
    });
    var order = FIELD_ORDER[stageCode] || [];
    return order.filter(function (f) { return seen[f]; });
  }

  function isFieldScope(key) {
    return !!key && fieldNames(currentStage).indexOf(key) >= 0;
  }

  var currentStage = 'junior';

  /* 当前这一屏的根：先定学段，再看范围 */
  function rootScope() {
    var base = stageScope(currentStage) || DATA;
    if (!scopeKey) return base;
    var book = base.kids.filter(function (b) { return b.name === scopeKey; })[0];
    if (book) return book;
    return fieldScope(currentStage, scopeKey) || base;
  }

  /* 目标在不在当前范围里。除了沿父链，还要看合成根那张孩子索引 —— 见 kidsSet 的说明。 */
  function scopeContains(scope, node) {
    var cur = node;
    while (cur) {
      if (cur === scope) return true;
      if (scope.kidsSet && scope.kidsSet[cur.id]) return true;
      cur = cur.parent;
    }
    return false;
  }

  /* 这个节点是哪个学段的。学段不是树上的一层，而是册 / 板块身上的一个字段，
     所以拿"哪一段的范围里能看见它"反查 —— 用的就是上面那套判断，不另立规矩。 */
  function stageOfNode(node) {
    for (var i = 0; i < STAGE_CODES.length; i++) {
      var scope = stageScope(STAGE_CODES[i]);
      if (scope && scopeContains(scope, node)) return STAGE_CODES[i];
    }
    return '';
  }

  /* ------------------------------------------------------------------ *
   * 4. 度量与布局
   * ------------------------------------------------------------------ */

  var V_GAP = 9;
  var H_GAP = 46;

  function fontSize(kind) {
    if (kind === 'root' || kind === 'stage') return 15;
    if (kind === 'book' || kind === 'track' || kind === 'chapter') return 14;
    return 13;
  }
  function nodeHeight(kind) {
    if (kind === 'root' || kind === 'stage') return 38;
    if (kind === 'book' || kind === 'track') return 30;
    return 26;
  }
  function nodePad(kind) {
    if (kind === 'root' || kind === 'stage') return 16;
    if (kind === 'book' || kind === 'track') return 14;
    return 11;
  }

  // SVG 里量不了文字宽度，用字符宽度估算（CJK 约 1em，西文约 0.55em）
  function measure(text, size) {
    var width = 0;
    for (var i = 0; i < text.length; i++) {
      width += text.charCodeAt(i) > 0x2e80 ? size : size * 0.55;
    }
    return width;
  }

  /* 章号前面挂上册的短名（八下 18）。
     跨学段之后光看 04 / 05 / 07 更看不懂 —— 那些号是各自册内编的，
     必修两册排到第 10 章、选择性必修又从头排。竞赛的章不编号，返回空。 */
  function labelNo(node) {
    if (!node || !node.no) return '';
    if (node.kind !== 'chapter') return node.no;
    var book = node.parent;
    var short = book ? BOOK_SHORT[book.name] : '';
    return short ? (short + ' ' + node.no) : node.no;
  }

  function nodeWidth(node) {
    var size = fontSize(node.kind);
    var width = measure(node.name, size);
    if (node.no) width += measure(labelNo(node), size * 0.84) + 7;
    if (BOXED[node.kind]) return width + nodePad(node.kind) * 2 + 6;
    if (DOTTED[node.kind]) return width + 13;
    return width;
  }

  // 折叠按钮占据的横向空间
  function outOffset(node) {
    return node.hasChildren ? 22 : 0;
  }

  function layout() {
    var scope = rootScope();
    var visible = collectVisible(scope, []);

    // 列位置：每一列宽度取该层最宽节点
    var colWidth = [];
    var maxDepth = 0;
    visible.forEach(function (node) {
      maxDepth = Math.max(maxDepth, node.depth);
      var w = nodeWidth(node) + outOffset(node);
      colWidth[node.depth] = Math.max(colWidth[node.depth] || 0, w);
    });

    var colX = [];
    var acc = 0;
    for (var d = 0; d <= maxDepth; d++) {
      colX[d] = acc;
      acc += (colWidth[d] || 0) + H_GAP;
    }

    // 纵向：后序占位，父节点居中于首尾子节点之间
    var cursor = 0;
    function place(node) {
      node.x = colX[node.depth] || 0;
      node.w = nodeWidth(node);
      var kids = visibleKids(node);
      if (!kids.length) {
        var h = nodeHeight(node.kind);
        node.y = cursor + h / 2;
        cursor += h + V_GAP;
        return;
      }
      kids.forEach(place);
      node.y = (kids[0].y + kids[kids.length - 1].y) / 2;
    }
    place(scope);

    return visible;
  }

  /* ------------------------------------------------------------------ *
   * 5. 视图变换
   * ------------------------------------------------------------------ */

  var view = { k: 1, tx: 0, ty: 0 };
  var MIN_K = 0.12;
  var MAX_K = 2.5;

  function applyView() {
    /* 最后一道闸：view 里只要有一个不是有限数，这条 transform 就是非法的。
       浏览器会把整条属性丢掉（图瞬移回左上角），而且之后每次写入还是 NaN ——
       表现就是"图不能放大缩小也不能拖"。宁可不写，也不要把画面写死。
       注意这只是兜底：真出了 NaN，断言里那条 isFinite 照样会红，藏不住。 */
    if (!isFinite(view.tx) || !isFinite(view.ty) || !isFinite(view.k)) return;
    world.setAttribute('transform', 'translate(' + view.tx + ',' + view.ty + ') scale(' + view.k + ')');
    if (zoomLabel) zoomLabel.textContent = Math.round(view.k * 100) + '%';
    /* 这里原来还有两行：把画布的点阵底纹按 view.k / view.tx 重设一遍，
       让底纹跟着板一起平移缩放（"无限平面"的感觉）。
       用户看过之后要求画布是纯色，点阵已从样式里删掉 ——
       这两行不删就成了谁也看不见的死代码，下一个人照着它还会把点阵加回来。 */
  }

  function zoomAt(px, py, nextK) {
    nextK = Math.max(MIN_K, Math.min(MAX_K, nextK));
    var wx = (px - view.tx) / view.k;
    var wy = (py - view.ty) / view.k;
    view.k = nextK;
    view.tx = px - wx * nextK;
    view.ty = py - wy * nextK;
    applyView();
  }

  function canvasSize() {
    var rect = canvas.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function bounds(visible) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visible.forEach(function (node) {
      var h = nodeHeight(node.kind) + 10;
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x + node.w + outOffset(node));
      minY = Math.min(minY, node.y - h / 2);
      maxY = Math.max(maxY, node.y + h / 2);
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function fit(padding) {
    var visible = layout();
    if (!visible.length) return;
    var box = bounds(visible);
    var size = canvasSize();
    var pad = padding == null ? 56 : padding;
    var k = Math.min(
      (size.w - pad * 2) / Math.max(1, box.maxX - box.minX),
      (size.h - pad * 2) / Math.max(1, box.maxY - box.minY),
      1.2
    );
    view.k = Math.max(MIN_K, Math.min(MAX_K, k));
    view.tx = (size.w - (box.maxX - box.minX) * view.k) / 2 - box.minX * view.k;
    view.ty = (size.h - (box.maxY - box.minY) * view.k) / 2 - box.minY * view.k;
    applyView();
  }

  function centerOn(node) {
    /* 兜底：节点没被布局过时 x / y / w 是 undefined，直接算出来就是 NaN，
       而 NaN 会顺着 view 传给下面每一次拖动和缩放（见 locate 里的说明）。
       宁可不居中，也不写一个把画面变成死的数。 */
    if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.w !== 'number') return;
    var size = canvasSize();
    view.tx = size.w / 2 - (node.x + node.w / 2) * view.k;
    view.ty = size.h / 2 - node.y * view.k;
    applyView();
  }

  /* ------------------------------------------------------------------ *
   * 6. 渲染
   * ------------------------------------------------------------------ */

  var selectedId = null;
  var matchIds = {};
  var relatedIds = {};
  var lastVisible = [];
  var lastMatched = [];

  // 拖拽状态（click 处理器要读 moved，所以提到前面声明）
  var dragging = false;
  var moved = false;
  var dragStart = null;

  function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function linkPath(parent, child) {
    var x1 = parent.x + parent.w + outOffset(parent);
    var y1 = parent.y;
    var x2 = child.x;
    var y2 = child.y;
    var dx = Math.max(14, (x2 - x1) * 0.45);
    var deep = child.depth >= 3 ? ' mm-link--deep' : '';
    return '<path class="mm-link' + deep + '" d="M' + x1 + ' ' + y1 +
      ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"></path>';
  }

  function nodeMarkup(node) {
    var size = fontSize(node.kind);
    var h = nodeHeight(node.kind);
    var pad = nodePad(node.kind);
    var isSel = node.id === selectedId;
    var isCollapsed = !!collapsed[node.id];

    var cls = ['mm-node', 'mm-node--' + node.kind];
    // 没有底色板的节点（节 / 栏目 / 知识点…）：选中时不能沿用"主色底 + 白字"那套，
    // 得换成"浅色底块 + 主色文字"，否则白底白字等于消失。
    if (!BOXED[node.kind]) cls.push('is-text');
    if (node.hasChildren) cls.push('has-children');
    if (isCollapsed) cls.push('is-collapsed');
    if (isSel) cls.push('is-selected');
    else if (isOnPath(node)) cls.push('is-on-path');
    if (matchIds[node.id]) cls.push('is-match');
    if (relatedIds[node.id]) cls.push('is-related');

    var parts = [];
    parts.push('<g class="' + cls.join(' ') + '" data-id="' + node.id + '" tabindex="0" role="button" ' +
      'aria-label="' + esc(KIND_LABEL[node.kind] + '：' + node.name) + '">');

    // 命中区：让纯文字节点也好点
    var hitW = node.w + outOffset(node);
    parts.push('<rect class="mm-node__hit" x="' + node.x + '" y="' + (node.y - h / 2) +
      '" width="' + hitW + '" height="' + h + '" rx="6"></rect>');

    var textY = node.y + size * 0.36;
    var cursorX = node.x + pad;

    if (BOXED[node.kind]) {
      var rx = node.kind === 'root' ? 8 : 6;
      parts.push('<rect class="mm-node__box" x="' + node.x + '" y="' + (node.y - h / 2) +
        '" width="' + node.w + '" height="' + h + '" rx="' + rx + '"></rect>');
      cursorX = node.x + pad;
    } else if (DOTTED[node.kind]) {
      parts.push('<circle class="mm-dot" cx="' + (node.x + 3) + '" cy="' + node.y + '" r="2.6"></circle>');
      cursorX = node.x + 13;
    } else {
      cursorX = node.x;
    }

    if (node.no) {
      var noText = labelNo(node);
      parts.push('<text class="mm-no" x="' + cursorX + '" y="' + textY + '" font-size="' +
        (size * 0.84).toFixed(1) + '">' + esc(noText) + '</text>');
      cursorX += measure(noText, size * 0.84) + 7;
    }

    var toneAttr = node.tone ? ' data-tone="' + node.tone + '"' : '';
    parts.push('<text class="mm-label"' + toneAttr + ' x="' + cursorX + '" y="' + textY +
      '" font-size="' + size + '">' + esc(node.name) + '</text>');

    // 折叠按钮
    if (node.hasChildren) {
      var cx = node.x + node.w + 11;
      var cy = node.y;
      parts.push('<g class="mm-toggle" data-id="' + node.id + '">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="7"></circle>' +
        '<line x1="' + (cx - 3.5) + '" y1="' + cy + '" x2="' + (cx + 3.5) + '" y2="' + cy + '"></line>' +
        (isCollapsed
          ? '<line x1="' + cx + '" y1="' + (cy - 3.5) + '" x2="' + cx + '" y2="' + (cy + 3.5) + '"></line>'
          : '') +
        '</g>');
      if (isCollapsed) {
        var count = node.kids.length;
        parts.push('<text class="mm-toggle__count" x="' + (cx + 12) + '" y="' + (cy + 3.5) + '">' +
          count + '</text>');
      }
    }

    parts.push('</g>');
    return parts.join('');
  }

  function isOnPath(node) {
    if (!selectedId) return false;
    var sel = byId[selectedId];
    var cur = sel ? sel.parent : null;
    while (cur) {
      if (cur.id === node.id) return true;
      cur = cur.parent;
    }
    return false;
  }

  function crossLinkMarkup(visible) {
    if (!selectedId) return '';
    var sel = byId[selectedId];
    if (!sel) return '';
    var links = CROSS_LINKS[sel.name];
    if (!links) return '';

    var visibleIds = {};
    visible.forEach(function (node) { visibleIds[node.id] = true; });

    var out = [];
    links.forEach(function (link) {
      var target = byName[link.name];
      if (!target || !visibleIds[target.id]) return;
      var fromRight = sel.x < target.x;
      var x1 = fromRight ? sel.x + sel.w + outOffset(sel) : sel.x;
      var x2 = fromRight ? target.x : target.x + target.w;
      var dx = Math.max(20, Math.abs(x2 - x1) * 0.4);
      out.push('<path class="mm-crosslink" d="M' + x1 + ' ' + sel.y +
        ' C' + (x1 + (fromRight ? dx : -dx)) + ' ' + sel.y + ' ' +
        (x2 - (fromRight ? dx : -dx)) + ' ' + target.y + ' ' + x2 + ' ' + target.y + '"></path>');
    });
    return out.join('');
  }

  function render(options) {
    var opts = options || {};
    var visible = layout();
    lastVisible = visible;

    // 关联节点标记（仅当前可见的才算）
    relatedIds = {};
    if (selectedId) {
      var sel = byId[selectedId];
      var links = sel ? CROSS_LINKS[sel.name] : null;
      if (links) {
        var visibleIds = {};
        visible.forEach(function (node) { visibleIds[node.id] = true; });
        links.forEach(function (link) {
          var target = byName[link.name];
          if (target && visibleIds[target.id]) relatedIds[target.id] = true;
        });
      }
    }

    var svgParts = [];
    visible.forEach(function (node) {
      visibleKids(node).forEach(function (child) {
        svgParts.push(linkPath(node, child));
      });
    });
    svgParts.push(crossLinkMarkup(visible));
    visible.forEach(function (node) { svgParts.push(nodeMarkup(node)); });

    world.innerHTML = svgParts.join('');

    if (opts.fit) fit();
    else applyView();
  }

  /* ------------------------------------------------------------------ *
   * 7. 信息面板
   * ------------------------------------------------------------------ */

  function statsFor(node) {
    var agg = node.agg;
    var rows = [];
    var leafKinds = node.kind === 'point' || node.kind === 'method' || node.kind === 'error' || node.kind === 'exam';

    if (node.kind === 'stage') {
      rows.push([node.agg.track ? '板块' : '册', (node.agg.book || 0) + (node.agg.track || 0)]);
      rows.push(['章', agg.chapter]);
    }
    if (node.kind === 'root' || node.kind === 'book' || node.kind === 'track' || node.kind === 'field') {
      rows.push(['章', agg.chapter]);
    }
    if (node.kind !== 'section' && node.kind !== 'group' && !leafKinds) {
      rows.push(['节 / 栏目', agg.section + agg.group]);
    }
    if (!leafKinds) {
      rows.push(['知识点', agg.point]);
      rows.push(['方法', agg.method]);
      rows.push(['易错点', agg.error]);
      rows.push(['考点', agg.exam]);
    }
    return rows.filter(function (row) { return row[1] > 0; });
  }

  function pathOf(node) {
    var chain = [];
    var cur = node;
    while (cur) { chain.unshift(cur); cur = cur.parent; }
    return chain;
  }

  function renderPanel(node) {
    var html = [];
    var tone = node.tone ? ' data-tone="' + node.tone + '"' : '';

    // 面板本身是悬浮的：编号放标题栏，正文里是类型徽标 + 名称
    if (panelNo) panelNo.textContent = labelNo(node) || node.no || '';
    html.push('<span class="mm-panel__kind"' + tone + '>' + KIND_LABEL[node.kind] + '</span>');
    html.push('<h2 class="mm-panel__title">' + esc(node.name) + '</h2>');

    /* 目录待核的节点：如实说明为什么这里是空的。
       空着不说会被当成"忘了做"，而有依据的空缺和没做是两件事。
       **不再渲染"目录来源"那一行**（用户："目录里所有的数据来源的那个网址 去掉即可；
       后期我们的数据都是自己后台上传的"）—— 数据里 source 字段仍留着（生成器当必填项用），
       只是不把网址显示出来。 */
    if (node.pending) {
      html.push('<p class="mm-pending">目录待核：' + esc(node.pending) + '</p>');
    }

    // 定位路径（可点击逐级回跳）
    var chain = pathOf(node);
    var pathHtml = chain.map(function (item, index) {
      if (index === chain.length - 1) return '<span>' + esc(item.name) + '</span>';
      return '<button type="button" data-goto="' + item.id + '">' + esc(item.name) + '</button>';
    }).join('<span class="sep">/</span>');
    html.push('<p class="mm-path">' + pathHtml + '</p>');

    var stats = statsFor(node);
    if (stats.length) {
      html.push('<dl class="mm-stats">');
      stats.forEach(function (row) {
        html.push('<div class="mm-stats__row"><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>');
      });
      html.push('</dl>');
    }

    // 子节点
    if (node.kids.length) {
      html.push('<div class="mm-block"><p class="mm-block__label">直接下级 · ' + node.kids.length + '</p><ul class="mm-list">');
      node.kids.forEach(function (child) {
        html.push('<li><button type="button" data-goto="' + child.id + '">' +
          '<span class="l-name">' + esc(child.name) + '</span>' +
          (child.no ? '<span class="l-no">' + esc(child.no) + '</span>' : '') +
          '</button></li>');
      });
      html.push('</ul></div>');
    }

    // 知识卡片
    var card = CARD_BY_NAME[node.name];
    if (card) {
      html.push('<a class="mm-cta" href="' + card + '">打开知识卡片 →</a>');
    } else if (node.kind === 'point' || node.kind === 'method' || node.kind === 'error' || node.kind === 'exam') {
      html.push('<p class="mm-pending">这个条目的知识卡片还没做。当前样板只用「数轴」把一张卡做完整了，' +
        '其余条目在结构上已经就位。</p>');
    }

    // 跨层级关联
    var links = CROSS_LINKS[node.name];
    if (links) {
      html.push('<div class="mm-block"><p class="mm-block__label">关联 · 前置与后续</p><ul class="mm-list">');
      links.forEach(function (link) {
        var target = byName[link.name];
        html.push('<li><button type="button" data-goto="' + (target ? target.id : '') + '">' +
          '<span class="l-name">' + esc(link.name) + '</span>' +
          '<span class="l-rel" data-rel="' + link.rel + '">' + link.rel + '</span>' +
          '</button></li>');
      });
      html.push('</ul></div>');
      html.push('<p class="mm-count-note">关联来自卡片里已确认的前置 / 后续关系；' +
        '画布上仅当两端都可见时才会画出虚线。</p>');
    }

    if (panelBody) panelBody.innerHTML = html.join('');
    if (panel) panel.removeAttribute('hidden');   // 点节点即浮出来
  }

  function renderEmptyPanel() {
    if (panelBody) panelBody.innerHTML = '';
    if (panelNo) panelNo.textContent = '';
    if (panel) panel.setAttribute('hidden', '');
  }

  /* ------------------------------------------------------------------ *
   * 8. 交互：折叠、选中、定位
   * ------------------------------------------------------------------ */

  function toggleFold(id) {
    var node = byId[id];
    if (!node || !node.hasChildren) return;

    // 记录被点节点当前的屏幕位置，重排后把它拉回原处，避免视野跳走
    var anchorScreen = { x: view.tx + node.x * view.k, y: view.ty + node.y * view.k };

    if (collapsed[id]) delete collapsed[id];
    else collapsed[id] = true;

    // 先算一遍新坐标，再校正位移
    var savedTx = view.tx;
    var savedTy = view.ty;
    layout();
    view.tx = anchorScreen.x - node.x * view.k;
    view.ty = anchorScreen.y - node.y * view.k;
    if (!isFinite(view.tx) || !isFinite(view.ty)) { view.tx = savedTx; view.ty = savedTy; }
    render();
  }

  function select(id, options) {
    var node = byId[id];
    if (!node) return;
    selectedId = id;
    renderPanel(node);
    render();
    if (options && options.center) centerOn(node);
  }

  function expandTo(node) {
    var cur = node.parent;
    var changed = false;
    while (cur) {
      if (collapsed[cur.id]) { delete collapsed[cur.id]; changed = true; }
      cur = cur.parent;
    }
    return changed;
  }

  function locate(id, options) {
    var node = byId[id];
    if (!node) return;
    /* 目标可能在**别的学段**里：白板上的题是初中的，图谱却可能正停在小学
       （学段跟册一样是记在本机的，"上次看过哪一段"就停在哪一段）。
       不改学段的话，它在当前范围里压根不进布局 —— x/y/w 全是 undefined，
       紧接着的 centerOn 就会算出 NaN，transform 写成 translate(NaN,NaN)，
       浏览器把整条属性丢掉：之后拖也不动、滚也不缩（用户报的就是这个）。
       所以定位的第一步，是先把学段搬到它所在的那一段。 */
    var home = stageOfNode(node);
    if (home && home !== currentStage) setStage(home);
    // 筛选状态下目标可能在范围之外，先放开筛选
    if (scopeKey) {
      var scope = rootScope();
      if (!scopeContains(scope, node) && node !== DATA) {
        setBookFilter('');                 // 顺带把 scopeKey 与存储、界面一起归位
      }
    }
    expandTo(node);
    selectedId = id;
    renderPanel(node);
    render();
    centerOn(node);
    if (options && options.flash) {
      var g = world.querySelector('.mm-node[data-id="' + id + '"]');
      if (g) { try { g.focus({ preventScroll: true }); } catch (err) { /* 忽略 */ } }
    }
  }

  world.addEventListener('click', function (event) {
    if (moved) return;           // 拖拽结束时不要误触发点击
    var toggle = event.target.closest ? event.target.closest('.mm-toggle') : null;
    if (toggle) { toggleFold(toggle.getAttribute('data-id')); return; }
    var group = event.target.closest ? event.target.closest('.mm-node') : null;
    if (!group) return;
    select(group.getAttribute('data-id'));
    // SVG 元素点击后不会自动获得焦点，需显式聚焦，否则方向键折叠失效
    try { group.focus({ preventScroll: true }); } catch (err) { /* 忽略 */ }
  });

  world.addEventListener('keydown', function (event) {
    var group = event.target.closest ? event.target.closest('.mm-node') : null;
    if (!group) return;
    var id = group.getAttribute('data-id');
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(id);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (collapsed[id]) toggleFold(id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!collapsed[id] && byId[id].hasChildren) toggleFold(id);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(id, event.key === 'ArrowDown' ? 1 : -1);
    }
  });

  function moveFocus(id, delta) {
    var index = lastVisible.findIndex(function (node) { return node.id === id; });
    if (index === -1) return;
    var next = lastVisible[index + delta];
    if (!next) return;
    var el = world.querySelector('.mm-node[data-id="' + next.id + '"]');
    if (el) { try { el.focus({ preventScroll: true }); } catch (err) { /* 忽略 */ } }
  }

  panel.addEventListener('click', function (event) {
    var trigger = event.target.closest ? event.target.closest('[data-goto]') : null;
    if (!trigger) return;
    var id = trigger.getAttribute('data-goto');
    if (id) locate(id, { flash: true });
  });

  /* ------------------------------------------------------------------ *
   * 9. 平移与缩放
   * ------------------------------------------------------------------ */

  /* 浮层（节点面板 / 定位面板 / 工具条 / 浮出菜单）是界面层，不属于画布。
     它们是 .mm-canvas 的子元素，按下和滚动都会冒到画布上 —— 不拦住的话，
     拖浮窗会连带把整张图一起平移，在面板里滚轮会变成缩放。 */
  function insideOverlay(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('.mm-card, .mm-dock, .mm-flyout');
  }

  canvas.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;
    if (insideOverlay(event.target)) return;   // 这一下是给浮层的，画布别动
    dragging = true;
    moved = false;
    dragStart = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  });

  function onDragMove(event) {
    if (!dragging) return;
    var dx = event.clientX - dragStart.x;
    var dy = event.clientY - dragStart.y;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 4) {
      moved = true;
      canvas.classList.add('is-panning');
    }
    if (!moved) return;
    view.tx = dragStart.tx + dx;
    view.ty = dragStart.ty + dy;
    applyView();
  }

  function onDragEnd() {
    dragging = false;
    canvas.classList.remove('is-panning');
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  }

  canvas.addEventListener('wheel', function (event) {
    if (insideOverlay(event.target)) return;   // 在浮层里滚轮 = 滚浮层自己的内容
    event.preventDefault();
    /* 滚轮 = 放大缩小（用户 2026-09-30："白板和图谱的滚轮也应该设置成放大缩小，
       而不是现在的上下移动"）。原来要按 ⌘ / Ctrl 才缩放、光滚轮是平移 —— 现在统一：
       **滚轮只管缩放，平移还是拖画布**（下面 onDragMove 那套没动）。 */
    var rect = canvas.getBoundingClientRect();
    zoomAt(event.clientX - rect.left, event.clientY - rect.top,
      view.k * Math.exp(-event.deltaY * 0.0022));
  }, { passive: false });

  function bindZoom(id, factor) {
    var btn = qs('#' + id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var size = canvasSize();
      if (factor === null) { view.k = 1; applyView(); return; }
      if (factor === 'fit') { fit(); return; }
      zoomAt(size.w / 2, size.h / 2, view.k * factor);
    });
  }
  bindZoom('mm-in', 1.25);
  bindZoom('mm-out', 0.8);
  bindZoom('mm-reset', null);
  bindZoom('mm-fit', 'fit');

  /* ------------------------------------------------------------------ *
   * 10. 折叠层级按钮
   * ------------------------------------------------------------------ */

  function setFold(depthLimit) {
    levelDepth = depthLimit;
    collapsed = {};
    eachNode(DATA, function (node) {
      if (node.hasChildren && node.depth >= depthLimit) collapsed[node.id] = true;
    });
    if (selectedId && collapsed[selectedId]) selectedId = null;
    if (selectedId) renderPanel(byId[selectedId]); else renderEmptyPanel();
    syncScope();
    render({ fit: true });
  }

  // 层级收进工具条的浮层里，点一项就切一档
  qsa('#mm-level-menu [data-fold]').forEach(function (item) {
    item.addEventListener('click', function () {
      setFold(Number(item.getAttribute('data-fold')) || 2);
      closeMenus();
    });
  });

  /* ------------------------------------------------------------------ *
   * 11. 按册筛选
   * ------------------------------------------------------------------ */

  document.addEventListener('math:select', function (event) {
    var el = event.detail && event.detail.el;
    if (!el || !el.hasAttribute('data-book')) return;
    setBookFilter(el.getAttribute('data-book'));
  });

  /* ------------------------------------------------------------------ *
   * 12. 定位搜索
   * ------------------------------------------------------------------ */

  function searchNodes(keyword) {
    var key = keyword.trim().toLowerCase();
    if (!key) return [];
    var out = [];
    eachNode(DATA, function (node) {
      if (out.length >= 40) return;
      if (node.name.toLowerCase().indexOf(key) !== -1) out.push(node);
    });
    return out;
  }

  function closeResults() {
    if (searchResults) searchResults.setAttribute('hidden', '');
    if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
  }

  function showResults(matches) {
    if (!searchResults) return;
    if (!matches.length) {
      searchResults.innerHTML = '<li class="mm-search__empty">没有匹配的条目</li>';
      searchResults.removeAttribute('hidden');
      searchInput.setAttribute('aria-expanded', 'true');
      return;
    }
    searchResults.innerHTML = matches.slice(0, 12).map(function (node) {
      var chain = pathOf(node).slice(1);
      var last = chain[chain.length - 1];
      var pathText = chain.slice(0, -1).map(function (item) { return item.name; }).join(' / ');
      return '<li><button type="button" data-goto="' + node.id + '">' +
        '<span class="r-name">' + esc(node.name) + '</span>' +
        '<span class="r-path">' + esc(pathText) + '</span></button></li>';
    }).join('');
    searchResults.removeAttribute('hidden');
    searchInput.setAttribute('aria-expanded', 'true');
    matchIds = {};
    matches.slice(0, 12).forEach(function (node) { matchIds[node.id] = true; });
    lastMatched = matches;
    render();
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var value = searchInput.value;
      if (!value.trim()) {
        matchIds = {};
        closeResults();
        render();
        return;
      }
      showResults(searchNodes(value));
    });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeResults(); searchInput.blur(); return; }
      if (event.key === 'Enter' && lastMatched.length) {
        event.preventDefault();
        locate(lastMatched[0].id, { flash: true });
        closeResults();
      }
    });
    searchInput.addEventListener('focus', function () {
      if (searchInput.value.trim()) showResults(searchNodes(searchInput.value));
    });
  }

  if (searchResults) {
    searchResults.addEventListener('click', function (event) {
      var trigger = event.target.closest ? event.target.closest('[data-goto]') : null;
      if (!trigger) return;
      locate(trigger.getAttribute('data-goto'), { flash: true });
      closeResults();
    });
  }

  document.addEventListener('click', function (event) {
    if (!searchResults || searchResults.hasAttribute('hidden')) return;
    if (event.target.closest && event.target.closest('.mm-search')) return;
    closeResults();
  });

  /* ------------------------------------------------------------------ *
   * 13. 工具条、悬浮面板与默认年级
   * ------------------------------------------------------------------ */

  var panelHead = qs('#mm-panel-head');
  var panelBody = qs('#mm-panel-body');
  var panelNo = qs('#mm-panel-no');
  var panelClose = qs('#mm-panel-close');
  var searchPanel = qs('#mm-search-panel');
  var searchToggle = qs('#mm-search-toggle');
  var searchClose = qs('#mm-search-close');
  var bookBtn = qs('#mm-book-btn');
  var bookMenu = qs('#mm-book-menu');
  var stageBtn = qs('#mm-stage-btn');
  var stageMenu = qs('#mm-stage-menu');
  var bookPane = qs('#mm-book-pane');
  var fieldPane = qs('#mm-field-pane');
  var levelBtn = qs('#mm-level-btn');
  var levelMenu = qs('#mm-level-menu');
  var helpBtn = qs('#mm-help-btn');
  var helpMenu = qs('#mm-help-menu');
  var scopeNote = qs('#mm-scope-note');

  var SCOPE_KEY = 'wkmath.graph.scope';
  var AXIS_KEY = 'wkmath.graph.axis';
  var STAGE_KEY = 'wkmath.graph.stage';
  var AXES = ['book', 'field'];
  var axis = 'book';            // 当前浮层里看的是哪一栏：book | field
  var LEVEL_SHORT = { 2: '到章', 3: '到节', 99: '全部' };
  var levelDepth = 2;

  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* 忽略 */ }
  }

  // 侧栏左下角是账号还是"登录"，就是这一页的登录态
  function signedIn() {
    var acct = document.querySelector ? document.querySelector('.ide-rail__account') : null;
    if (!acct) return false;
    var href = acct.getAttribute('href') || '';
    return href !== 'login.html' && href !== 'register.html';
  }

  function studentGrade() {
    var user = window.WK_SHELL && window.WK_SHELL.user;
    if (user && user.grade) return user.grade;
    return '七年级（下）';
  }

  /* 默认学段：记过就用记过的，没有就初中（现在的内容都是初中的）。
     存了个认不出来的值也回初中。 */
  function initialStage() {
    var saved = readStore(STAGE_KEY);
    return STAGE_CODES.indexOf(saved) >= 0 ? saved : 'junior';
  }

  // 默认聚焦：看过哪册 / 哪个体系就记哪个；没记过就按学生当前年级；未登录给总览
  function initialScope() {
    var saved = readStore(SCOPE_KEY);
    if (saved !== null && saved !== '') {
      /* 存的是册名或领域名 —— 不认识的值一律当没存（旧数据 / 手改过的存储，
         也可能是上一学段的册名，换学段后那个名字在这里不存在）。 */
      var inStage = booksOf(currentStage).some(function (b) { return b.name === saved; });
      if (inStage || isFieldScope(saved)) return saved;
      return '';
    }
    if (saved === '') return '';
    return signedIn() && currentStage === 'junior' ? studentGrade() : '';
  }

  /* 当前范围落在哪一栏。范围本身就能说明：册名 → 教材册次，领域名 → 课标主题。
     这样不会出现"选中的那一项在看不见的那一栏里"。
     参数可传一个范围进去 —— 启动时要用"存储里那个范围"来算。 */
  function axisOfScope(key) {
    var k = (key === undefined) ? scopeKey : (key || '');
    if (!k) return '';
    if (isFieldScope(k)) return 'field';
    return booksOf(currentStage).some(function (b) { return b.name === k; }) ? 'book' : '';
  }

  /* 启动时的那一栏：先看范围属于哪一栏；范围是总览时用记着的那一栏，最后兜到册那一栏。 */
  function initialAxis() {
    var derived = axisOfScope(initialScope());
    if (derived) return derived;
    var saved = readStore(AXIS_KEY);
    if (AXES.indexOf(saved) < 0) return 'book';
    /* 竞赛没有第二栏，别把 axis 停在 field 上 */
    if (saved === 'field' && !(AXIS_TITLE[currentStage] || {}).field) return 'book';
    return saved;
  }

  /* 范围在工具条与列表上的短名 */
  function scopeShort() {
    if (!scopeKey) return '总览';
    return BOOK_SHORT[scopeKey] || FIELD_SHORT[scopeKey] || scopeKey;
  }

  function stageBooksWord() { return currentStage === 'olympiad' ? '板块' : '册'; }

  /* 数一棵子树里有多少节点（给说明文字用；一千多个节点，一次遍历无所谓） */
  function countNodes(scope) {
    var n = 0;
    (function walkCount(x) {
      n++;
      (x.kids || []).forEach(walkCount);
    })(scope);
    return n;
  }

  /* aria-pressed 给读屏，is-on 给眼睛：两个都要设。
     只设 aria-pressed 的话，视觉上打开浮层看不出当前选的是哪一项。 */
  function markOn(el, on) {
    if (!el || !el.classList) return;
    if (on) el.classList.add('is-on');
    else el.classList.remove('is-on');
  }

  function toggleHidden(el, hide) {
    if (!el) return;
    el.hidden = !!hide;
    if (hide) { if (el.setAttribute) el.setAttribute('hidden', 'hidden'); }
    else if (el.removeAttribute) el.removeAttribute('hidden');
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (err) { /* 忽略 */ }
    }
  }

  /* ---------- 浮层里的两项名单：按学段整块重建 ----------
     为什么不在 HTML 里写死：四学段合计 27 本册 / 4 个板块，
     写死就是把数据抄两遍，而且换学段时一定会有一半对不上。 */
  function bookEntries() {
    var list = [{ value: '', label: '总览 · 全部' + stageBooksWord(), icon: 'layout-grid' }];
    booksOf(currentStage).forEach(function (b) {
      list.push({
        value: b.name,
        label: b.name,
        icon: b.kind === 'track' ? 'shapes' : 'book',
        note: b.pending ? '待核' : ((b.kids || []).length ? '' : '暂空')
      });
    });
    return list;
  }

  function fieldEntries() {
    var list = [{ value: '', label: '总览 · 全部' + stageBooksWord(), icon: 'layout-grid' }];
    fieldNames(currentStage).forEach(function (f) {
      list.push({ value: f, label: f, icon: 'shapes', note: '' });
    });
    return list;
  }

  var bookItems = [];      // 当前学段在浮层里那一栏的元素（重建时整体换掉）
  var fieldItems = [];

  function mkItems(pane, attrName, entries) {
    var items = [];
    if (!pane) return items;
    if (pane.innerHTML !== undefined) pane.innerHTML = '';
    entries.forEach(function (row) {
      var el = document.createElement('button');
      el.className = 'mm-flyout__item';
      el.setAttribute('type', 'button');
      el.setAttribute(attrName, row.value);
      el.setAttribute('aria-pressed', 'false');
      el.innerHTML = '<i data-lucide="' + esc(row.icon) + '"></i>' +
        '<span class="mm-flyout__label">' + esc(row.label) + '</span>' +
        (row.note ? '<span class="mm-flyout__note">' + esc(row.note) + '</span>' : '');
      if (el.addEventListener) {
        el.addEventListener('click', function () {
          setBookFilter(row.value);
          closeMenus();
        });
      }
      if (pane.appendChild) pane.appendChild(el);
      items.push(el);
    });
    return items;
  }

  function buildMenu() {
    bookItems = mkItems(bookPane, 'data-book', bookEntries());
    fieldItems = mkItems(fieldPane, 'data-field', fieldEntries());
    /* 分法条上的字样跟着学段走；竞赛没有第二栏，整条收起来 */
    var titles = AXIS_TITLE[currentStage] || AXIS_TITLE.junior;
    var axes = qsa('#mm-axis [data-axis]');
    (axes || []).forEach(function (el) {
      var k = el.getAttribute('data-axis') || '';
      var t = (k === 'book') ? titles.book : titles.field;
      if (el.textContent !== undefined) el.textContent = t || '';
      toggleHidden(el, !t);
    });
    toggleHidden(qs('#mm-axis'), !titles.field);
    refreshIcons();
  }

  /* 换学段：范围归零、名单重建、图重新落位。
     最后这一步不能省 —— 不重新 fit 的话画布还停在上一学段的坐标上，看着像一张空板。 */
  function setStage(code) {
    if (STAGE_CODES.indexOf(code) < 0) return false;
    if (code === currentStage) return true;
    currentStage = code;
    scopeKey = '';
    if (!(AXIS_TITLE[code] || {}).field) axis = 'book';
    else if (AXES.indexOf(axis) < 0) axis = 'book';
    writeStore(STAGE_KEY, code);
    writeStore(SCOPE_KEY, '');
    buildMenu();
    syncScope();
    render({ fit: true });
    toast('切到' + stageOf(code).short, 'info', 1400);
    return true;
  }

  /* 分法切换：只换名单，不动图 —— 图要等你点具体某一项才变。
     这和"点开浮层只是看看"是一致的。 */
  function setAxis(next) {
    if (AXES.indexOf(next) < 0) return false;
    if (next === 'field' && !(AXIS_TITLE[currentStage] || {}).field) return false;   // 竞赛没有第二栏
    axis = next;
    writeStore(AXIS_KEY, next);
    syncScope();
    return true;
  }

  function syncScope() {
    var bookLabel = qs('#mm-book-label');
    var levelLabel = qs('#mm-level-label');
    if (bookLabel) bookLabel.textContent = scopeShort();
    if (levelLabel) levelLabel.textContent = LEVEL_SHORT[levelDepth] || '到章';

    /* 分法条 */
    qsa('#mm-axis [data-axis]').forEach(function (item) {
      var on = (item.getAttribute('data-axis') || '') === axis;
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });
    /* 两栏名单：一次只露一栏 */
    toggleHidden(bookPane, axis !== 'book');
    toggleHidden(fieldPane, axis !== 'field');

    bookItems.forEach(function (item) {
      var on = (item.getAttribute('data-book') || '') === scopeKey && axis === 'book';
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });
    fieldItems.forEach(function (item) {
      var on = (item.getAttribute('data-field') || '') === scopeKey && axis === 'field';
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });
    qsa('#mm-level-menu [data-fold]').forEach(function (item) {
      var on = Number(item.getAttribute('data-fold')) === levelDepth;
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });

    /* 学段按钮 */
    var stageLabel = qs('#mm-stage-label');
    if (stageLabel) stageLabel.textContent = stageOf(currentStage).short;
    if (stageBtn) stageBtn.setAttribute('data-mm-tip', '选学段 · 当前 ' + stageOf(currentStage).short);
    qsa('#mm-stage-menu [data-stage]').forEach(function (item) {
      var on = (item.getAttribute('data-stage') || '') === currentStage;
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });

    if (bookBtn) {
      var titles = AXIS_TITLE[currentStage] || AXIS_TITLE.junior;
      bookBtn.setAttribute('data-mm-tip', '只看某一' + stageBooksWord() +
        (titles.field ? '或某一课标主题' : '') + ' · 当前 ' + scopeShort());
    }
    if (levelBtn) levelBtn.setAttribute('data-mm-tip', '显示到哪一层 · 当前 ' + (LEVEL_SHORT[levelDepth] || '到章'));

    if (scopeNote) {
      var st = stageOf(currentStage);
      var titles2 = AXIS_TITLE[currentStage] || AXIS_TITLE.junior;
      if (isFieldScope(scopeKey)) {
        var fnode = fieldScope(currentStage, scopeKey);
        scopeNote.textContent = '当前看的是' + st.short + '的「' + scopeKey + '」，共 ' + fnode.kids.length +
          ' 章；点工具条的「' + (titles2.book || '册') + '」按钮可换。';
      } else if (scopeKey) {
        scopeNote.textContent = '当前聚焦' + st.short + '的「' + scopeKey + '」' +
          (signedIn() && currentStage === 'junior' ? '（学生当前年级）' : '') +
          '；点工具条的「' + (titles2.book || '册') + '」按钮可换。';
      } else {
        var books = booksOf(currentStage);
        var chs = books.reduce(function (n, b) { return n + (b.kids || []).length; }, 0);
        /* 待核分两级：整册目录没核到（册上标着），以及章核到了、小节没核到（章上标着）。
           只报册级会让"章还标着待核"的那一学段看着像全核过了。 */
        var pend = books.filter(function (b) { return b.pending; }).length;
        var pendCh = 0;
        books.forEach(function (b) {
          (b.kids || []).forEach(function (c) { if (c.pending) pendCh += 1; });
        });
        var scope = stageScope(currentStage);
        var pendText = [];
        if (pend) pendText.push(pend + ' 本目录待核');
        if (pendCh) pendText.push(pendCh + ' 章的小节待核');
        scopeNote.textContent = '当前看' + st.short + '：' + books.length + ' ' + stageBooksWord() + ' · ' +
          chs + ' 章 · ' + countNodes(scope) + ' 个节点' +
          (pendText.length ? '（其中 ' + pendText.join('、') + '，节点上标着）' : '') +
          '；点工具条第一个按钮可换学段。' +
          /* 按年级默认聚焦这件事只发生在初中（别的学段没有"学生当前年级"这回事） */
          (currentStage === 'junior'
            ? (signedIn() ? '默认聚焦学生当前年级。' : '未登录：先看总览，登录后默认聚焦自己的年级。')
            : '');
      }
    }
  }

  function setBookFilter(name) {
    var next = name || '';
    scopeKey = next;
    /* 选了哪一栏的项，就把那一栏亮出来 —— 否则"我选的东西在看不见的那一栏里" */
    if (next && axisOfScope()) axis = axisOfScope();
    writeStore(SCOPE_KEY, next);
    syncScope();
    render({ fit: true });
    toast(next ? '只看 ' + (FIELD_SHORT[next] || next) : '显示全部六册', 'info', 1600);
  }

  /* 启动顺序有讲究：先定学段，再定范围（范围要在学段里校验），最后定分法那一栏 */
  currentStage = initialStage();
  scopeKey = initialScope();
  axis = initialAxis();

  /* ---- 浮层：一次只开一个 ---- */
  function menuPairs() {
    return [[stageBtn, stageMenu], [bookBtn, bookMenu], [levelBtn, levelMenu], [helpBtn, helpMenu]];
  }
  function closeMenus() {
    menuPairs().forEach(function (pair) {
      if (pair[1]) pair[1].setAttribute('hidden', '');
      if (pair[0]) pair[0].setAttribute('aria-expanded', 'false');
    });
  }
  function toggleMenu(btn, menu) {
    if (!btn || !menu) return;
    var wasOpen = !menu.hasAttribute('hidden');
    closeMenus();
    if (wasOpen) return;
    menu.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
  }
  if (stageBtn) stageBtn.addEventListener('click', function () { toggleMenu(stageBtn, stageMenu); });
  if (bookBtn) bookBtn.addEventListener('click', function () { toggleMenu(bookBtn, bookMenu); });
  if (levelBtn) levelBtn.addEventListener('click', function () { toggleMenu(levelBtn, levelMenu); });
  if (helpBtn) helpBtn.addEventListener('click', function () { toggleMenu(helpBtn, helpMenu); });

  /* 学段那四项是固定的，写在 HTML 里；册 / 领域两项名单由 buildMenu() 按学段现建 */
  qsa('#mm-stage-menu [data-stage]').forEach(function (item) {
    item.addEventListener('click', function () {
      setStage(item.getAttribute('data-stage'));
      closeMenus();
    });
  });

  /* 分法切换条 */
  qsa('#mm-axis [data-axis]').forEach(function (item) {
    item.addEventListener('click', function () { setAxis(item.getAttribute('data-axis')); });
  });

  /* ---- 面板开合：悬停工具条上的按钮或点节点 ---- */
  function cardOpen(card) { return !!(card && !card.hasAttribute('hidden')); }
  function openCard(card) { if (card) card.removeAttribute('hidden'); }
  function closeCard(card) { if (card) card.setAttribute('hidden', ''); }

  function openSearch() {
    openCard(searchPanel);
    if (searchToggle) {
      searchToggle.classList.add('is-on');
      searchToggle.setAttribute('aria-expanded', 'true');
    }
    closeMenus();
    if (searchInput) { try { searchInput.focus(); } catch (err) { /* 忽略 */ } }
  }
  function closeSearch() {
    closeCard(searchPanel);
    if (searchToggle) {
      searchToggle.classList.remove('is-on');
      searchToggle.setAttribute('aria-expanded', 'false');
    }
    if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
    closeResults();
  }
  function closeInfo() {
    selectedId = null;
    renderEmptyPanel();
    render();
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', function () {
      if (cardOpen(searchPanel)) closeSearch(); else openSearch();
    });
  }
  if (searchClose) searchClose.addEventListener('click', function () { closeSearch(); });
  if (panelClose) panelClose.addEventListener('click', function () { closeInfo(); });

  /* ---- 拖动：按住面板标题栏，鼠标 / 触控 / 数位板都能拖，边界留在画布内 ---- */
  function bindDrag(card, handle) {
    if (!card || !handle) return;
    var active = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;

    function onMove(event) {
      if (!active) return;
      var box = canvas.getBoundingClientRect();
      var width = card.offsetWidth || 320;
      var height = card.offsetHeight || 200;
      var left = baseLeft + (event.clientX - startX);
      var top = baseTop + (event.clientY - startY);
      left = Math.max(8, Math.min(left, Math.max(8, box.width - width - 8)));
      top = Math.max(8, Math.min(top, Math.max(8, box.height - height - 8)));
      card.style.left = left + 'px';
      card.style.top = top + 'px';
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      if (event.preventDefault) event.preventDefault();
    }
    function onUp() {
      if (!active) return;
      active = false;
      card.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
    handle.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      // 别让这次按下冒到画布去：拖浮窗不能连带平移整张图
      if (event.stopPropagation) event.stopPropagation();
      var box = canvas.getBoundingClientRect();
      var rect = card.getBoundingClientRect();
      active = true;
      startX = event.clientX;
      startY = event.clientY;
      baseLeft = rect.left - box.left;
      baseTop = rect.top - box.top;
      card.classList.add('is-dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      if (event.preventDefault) event.preventDefault();
    });
  }
  bindDrag(panel, panelHead);
  bindDrag(searchPanel, qs('#mm-search-head'));

  /* ---- 点空白处收浮层；Esc 收浮层与面板；⇧1 / ⇧2 / ⇧3 / ⇧4 / 0 快捷键 ---- */
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('.mm-dock')) return;
    closeMenus();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenus();
      closeSearch();
      closeInfo();
      return;
    }
    if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    var code = event.code || '';
    var key = event.key || '';
    if (code === 'Digit1' || key === '1' || key === '!') { event.preventDefault(); fit(); }
    else if (code === 'Digit2' || key === '2' || key === '@') { event.preventDefault(); setFold(2); }
    else if (code === 'Digit3' || key === '3' || key === '#') { event.preventDefault(); setFold(3); }
    else if (code === 'Digit4' || key === '4' || key === '$') { event.preventDefault(); setFold(99); }
    else if (code === 'Digit0' || key === '0' || key === ')') { event.preventDefault(); view.k = 1; applyView(); }
  });

  /* 自查与测试用的接口 */
  window.__MM__ = {
    scope: { get: function () { return scopeKey; }, set: setBookFilter, initial: initialScope },
    axis: { get: function () { return axis; }, set: setAxis, initial: initialAxis, keys: AXES },
    stage: {
      get: function () { return currentStage; },
      set: setStage,
      initial: initialStage,
      keys: STAGE_CODES,
      list: function () {
        return STAGES.map(function (s) { return { code: s.code, name: s.name, short: s.short }; });
      }
    },
    stageOf: function (code) { var s = stageOf(code || currentStage); return { code: s.code, name: s.name, short: s.short }; },
    stageScope: stageScope,
    stageBooksWord: stageBooksWord,
    axisTitle: function () { return AXIS_TITLE[currentStage] || AXIS_TITLE.junior; },
    booksOf: function (code) { return booksOf(code || currentStage).map(function (b) { return b.name; }); },
    books: function () { return booksOf(currentStage).map(function (b) { return b.name; }); },
    bookItems: function () { return bookItems; },
    fieldItems: function () { return fieldItems; },
    labelNo: labelNo,
    buildMenu: buildMenu,
    fields: function (code) { return fieldNames(code || currentStage); },
    fieldScope: fieldScope,
    fieldShort: function (name) { return FIELD_SHORT[name || ''] || name || ''; },
    fieldOf: function (chapterName) {
      var hit = null;
      DATA.kids.forEach(function (book) {
        (book.kids || []).forEach(function (ch) { if (ch.name === chapterName) hit = ch; });
      });
      return hit ? hit.field : null;
    },
    scopeContains: scopeContains,
    rootScope: rootScope,
    each: function (fn) { eachNode(DATA, fn); },
    level: { get: function () { return levelDepth; }, set: setFold },
    signedIn: signedIn,
    studentGrade: studentGrade,
    shortOf: function (name) { return name ? (BOOK_SHORT[name] || FIELD_SHORT[name] || name) : '总览'; },
    syncScope: syncScope,
    setBookFilter: setBookFilter,
    closeMenus: closeMenus,
    toggleMenu: toggleMenu,
    openSearch: openSearch,
    closeSearch: closeSearch,
    openCard: openCard,
    closeCard: closeCard,
    cardOpen: cardOpen,
    bindDrag: bindDrag,
    infoOpen: function () { return cardOpen(panel); },
    searchOpen: function () { return cardOpen(searchPanel); },
    infoPanel: function () { return panel; },
    searchPanelEl: function () { return searchPanel; },
    select: select,
    locate: locate,
    render: render,
    renderPanel: renderPanel,
    renderEmptyPanel: renderEmptyPanel,
    closeInfo: closeInfo,
    deepLink: applyDeepLink,
    query: queryParam,
    insideOverlay: insideOverlay,
    view: function () { return { tx: view.tx, ty: view.ty, k: view.k }; },
    toggleFold: toggleFold,
    visible: function () { return collectVisible(rootScope(), []); }
  };

  /* ------------------------------------------------------------------ *
   * 14. 从别的页面点名进来（graph.html?q=知识点）
   * ------------------------------------------------------------------ */

  function queryParam(name) {
    var search = '';
    try { search = (window.location && window.location.search) || ''; } catch (err) { search = ''; }
    if (!search) return '';
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(search);
    if (!m) return '';
    var raw = m[1].replace(/\+/g, ' ');
    try { return decodeURIComponent(raw); } catch (err) { return raw; }
  }

  /* 白板「回到知识点」、以及任何带 ?q= 的外部链接都走这里：
     打开定位面板 → 填词 → 有命中就定位（会自动放开册筛选、展开路径），没命中就说明一声 */
  function applyDeepLink() {
    var keyword = queryParam('q').trim();
    if (!keyword || !searchInput) return false;
    openSearch();
    searchInput.value = keyword;
    var matches = searchNodes(keyword);
    showResults(matches);
    if (matches.length) locate(matches[0].id, { flash: true });
    else toast('图谱里没有「' + keyword + '」');
    return true;
  }

  /* ------------------------------------------------------------------ *
   * 15. 启动
   * ------------------------------------------------------------------ */

  function boot() {
    buildMenu();          // 册 / 领域两项名单按当前学段先建出来
    syncScope();
    renderEmptyPanel();
    render({ fit: true });
    applyDeepLink();
    window.addEventListener('resize', function () { applyView(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
};

/* 等接口把知识树取回来再跑 —— 拉不到、且本地没缓存时由 WK_API.boot 出兜底页，绝不留白屏。
   没有 api.js 的场合（测试脚手架把本文件拼进去跑）就同步执行，行为与改造前完全一致。 */
if (window.WK_API) { window.WK_API.boot(__wkGraph); } else { __wkGraph(); }
