/* ==========================================================================
   知识图谱 · 脑图引擎 (mindmap.js)
   --------------------------------------------------------------------------
   目标：把「六册 → 29 章 → 节 → 知识点」这张层级网做成一张平面、可无限拖放的
         画布。层级用连线表达，点击节点在右侧看信息。
   做法：不引入任何图形库（项目零构建、可离线），自己实现：
     1. 整齐树布局（列对齐 + 父节点居中于子节点）
     2. SVG 字符串渲染（一次 innerHTML，比逐节点 createElement 快很多）
     3. 平移 / 缩放（唯一变换矩阵，画布点阵背景同步移动，强化「无限平面」感）
     4. 折叠展开（含「保持被点节点不动」的手感处理）
     5. 定位搜索 + 按册筛选 + 信息面板
     6. 跨层级关联（前置/后续）虚线：只有真实存在的数据才画，不编造
   数据来自 assets/js/math-tree.js（由 tools/build-math-tree.rb 生成）。
   ========================================================================== */

(function () {
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
    root: '总览', book: '册', field: '体系', chapter: '章', section: '节', group: '栏目',
    point: '知识点', method: '方法', error: '易错点', exam: '考点'
  };

  var BOXED = { root: 1, book: 1, field: 1, chapter: 1 };
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
   * 3. 筛选范围：按册（年级教材）或按课标领域（几何 / 代数 / 统计与概率）
   * ------------------------------------------------------------------ */

  /* scopeKey 是"当前只看哪一块"：'' 是总览，册名或领域名。
     两个分法共用这一个变量 —— 它本身就是可判别的（册名 vs 领域名），
     不需要再造一个"当前是哪个分法"的开关去跟它同步。 */
  var scopeKey = '';

  /* 领域名 → 图里那个合成根。体系是"看法"，不是真的父节点：
     章的真实父节点还是册，所以信息面板里的路径照实显示
     「初中数学 / 八年级（下） / 平行四边形」—— 这里不编造层级。 */
  var FIELD_SCOPES = {};
  /* 列表与工具条上用短名，图里的节点名仍用课标全称（和"册"一致：
     名单里写「七年级（上）」，工具条上写「七上」） */
  var FIELD_SHORT = { '数与代数': '代数', '图形与几何': '几何', '统计与概率': '统计与概率' };
  /* 固定顺序：几何在前（用户说的就是"几何代数"） */
  var FIELD_ORDER = ['图形与几何', '数与代数', '统计与概率'];

  function fieldScope(name) {
    if (FIELD_SCOPES[name]) return FIELD_SCOPES[name];
    var kids = [];
    DATA.kids.forEach(function (book) {
      (book.kids || []).forEach(function (ch) { if (ch.field === name) kids.push(ch); });
    });
    if (!kids.length) return null;
    var agg = { chapter: 0, section: 0, group: 0, point: 0, method: 0, error: 0, exam: 0 };
    kids.forEach(function (ch) {
      Object.keys(ch.agg || {}).forEach(function (k) { agg[k] += ch.agg[k]; });
    });
    agg.chapter = kids.length;
    var node = {
      id: 'f:' + name,
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
    FIELD_SCOPES[name] = node;
    return node;
  }

  /* 数据里出现过的领域名（按 FIELD_ORDER 排，未知的排在最后） */
  function fieldNames() {
    var seen = {}, out = [];
    DATA.kids.forEach(function (book) {
      (book.kids || []).forEach(function (ch) {
        if (ch.field && !seen[ch.field]) { seen[ch.field] = true; out.push(ch.field); }
      });
    });
    out.sort(function (a, b) {
      var ai = FIELD_ORDER.indexOf(a), bi = FIELD_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
    return out;
  }

  function isFieldScope(key) {
    return !!key && fieldNames().indexOf(key) >= 0;
  }

  function rootScope() {
    if (!scopeKey) return DATA;
    var book = DATA.kids.filter(function (b) { return b.name === scopeKey; })[0];
    if (book) return book;
    return fieldScope(scopeKey) || DATA;
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

  /* ------------------------------------------------------------------ *
   * 4. 度量与布局
   * ------------------------------------------------------------------ */

  var V_GAP = 9;
  var H_GAP = 46;

  function fontSize(kind) {
    if (kind === 'root') return 15;
    if (kind === 'book' || kind === 'chapter') return 14;
    return 13;
  }
  function nodeHeight(kind) {
    if (kind === 'root') return 38;
    if (kind === 'book') return 30;
    return 26;
  }
  function nodePad(kind) {
    if (kind === 'root') return 16;
    if (kind === 'book') return 14;
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

  function nodeWidth(node) {
    var size = fontSize(node.kind);
    var width = measure(node.name, size);
    if (node.no) width += measure(node.no, size * 0.84) + 7;
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
    world.setAttribute('transform', 'translate(' + view.tx + ',' + view.ty + ') scale(' + view.k + ')');
    if (zoomLabel) zoomLabel.textContent = Math.round(view.k * 100) + '%';
    // 点阵背景跟着一起动，「无限平面」的感觉来自这里
    canvas.style.backgroundSize = (24 * view.k) + 'px ' + (24 * view.k) + 'px';
    canvas.style.backgroundPosition = view.tx + 'px ' + view.ty + 'px';
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
      parts.push('<text class="mm-no" x="' + cursorX + '" y="' + textY + '" font-size="' +
        (size * 0.84).toFixed(1) + '">' + esc(node.no) + '</text>');
      cursorX += measure(node.no, size * 0.84) + 7;
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

    if (node.kind === 'root' || node.kind === 'book' || node.kind === 'field') {
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
    if (panelNo) panelNo.textContent = node.no || '';
    html.push('<span class="mm-panel__kind"' + tone + '>' + KIND_LABEL[node.kind] + '</span>');
    html.push('<h2 class="mm-panel__title">' + esc(node.name) + '</h2>');

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
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      var rect = canvas.getBoundingClientRect();
      zoomAt(event.clientX - rect.left, event.clientY - rect.top,
        view.k * Math.exp(-event.deltaY * 0.0022));
      return;
    }
    event.preventDefault();
    view.tx -= event.deltaX;
    view.ty -= event.deltaY;
    applyView();
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
  var levelBtn = qs('#mm-level-btn');
  var levelMenu = qs('#mm-level-menu');
  var helpBtn = qs('#mm-help-btn');
  var helpMenu = qs('#mm-help-menu');
  var scopeNote = qs('#mm-scope-note');

  var SCOPE_KEY = 'wkmath.graph.scope';
  var AXIS_KEY = 'wkmath.graph.axis';
  var AXES = ['book', 'field'];
  var axis = 'book';            // 当前浮层里看的是哪一栏：book | field
  var BOOK_SHORT = {
    '': '总览',
    '七年级（上）': '七上', '七年级（下）': '七下',
    '八年级（上）': '八上', '八年级（下）': '八下',
    '九年级（上）': '九上', '九年级（下）': '九下'
  };
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

  // 默认聚焦：看过哪册 / 哪个体系就记哪个；没记过就按学生当前年级；未登录给总览
  function initialScope() {
    var saved = readStore(SCOPE_KEY);
    if (saved !== null && saved !== '') {
      /* 存的是册名或领域名 —— 不认识的值一律当没存（旧数据 / 手改过的存储），
         否则 rootScope() 会落到总览，而工具条上却写着那个不认识的名字。 */
      if (BOOK_SHORT[saved] || isFieldScope(saved)) return saved;
      return '';
    }
    if (saved === '') return '';
    return signedIn() ? studentGrade() : '';
  }

  /* 当前范围落在哪一栏。范围本身就能说明：册名 → 年级教材，领域名 → 几何代数。
     这样不会出现"选中的那一项在看不见的那一栏里"。
     参数可传一个范围进去 —— 启动时要用"存储里那个范围"来算，
     不能只看现场的 scopeKey（那一刻还没赋值）。 */
  function axisOfScope(key) {
    var k = (key === undefined) ? scopeKey : (key || '');
    if (!k) return '';
    if (isFieldScope(k)) return 'field';
    return BOOK_SHORT[k] ? 'book' : '';
  }

  /* 启动时的那一栏：先看范围属于哪一栏；范围是总览时用记着的那一栏，最后兜到年级教材。
     这里刻意从 initialScope() 现算 —— 它等价于"刷新一次页面会落在哪一栏"。 */
  function initialAxis() {
    var derived = axisOfScope(initialScope());
    if (derived) return derived;
    var saved = readStore(AXIS_KEY);
    return AXES.indexOf(saved) >= 0 ? saved : 'book';
  }

  /* 范围在工具条与列表上的短名 */
  function scopeShort() {
    return BOOK_SHORT[scopeKey] || FIELD_SHORT[scopeKey] || '总览';
  }

  /* aria-pressed 给读屏，is-on 给眼睛：两个都要设。
     只设 aria-pressed 的话，视觉上打开浮层看不出当前选的是哪一册 / 哪一档。
     .mm-flyout__item.is-on 的样式是从白板共享过来的，白板那边一直这么用。 */
  function markOn(el, on) {
    if (!el || !el.classList) return;
    if (on) el.classList.add('is-on');
    else el.classList.remove('is-on');
  }

  /* 分法切换：只换名单，不动图 —— 图要等你点具体某一项才变。
     这和"点开浮层只是看看"是一致的。 */
  function setAxis(next) {
    if (AXES.indexOf(next) < 0) return false;
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
    qsa('#mm-book-menu [data-axis-pane]').forEach(function (pane) {
      var on = (pane.getAttribute('data-axis-pane') || '') === axis;
      if (on) { if (pane.removeAttribute) pane.removeAttribute('hidden'); pane.hidden = false; }
      else { if (pane.setAttribute) pane.setAttribute('hidden', ''); pane.hidden = true; }
    });

    /* 册那一栏 */
    qsa('#mm-book-menu [data-book]').forEach(function (item) {
      var on = (item.getAttribute('data-book') || '') === scopeKey && axis === 'book';
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });
    /* 体系那一栏 */
    qsa('#mm-book-menu [data-field]').forEach(function (item) {
      var on = (item.getAttribute('data-field') || '') === scopeKey && axis === 'field';
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });
    qsa('#mm-level-menu [data-fold]').forEach(function (item) {
      var on = Number(item.getAttribute('data-fold')) === levelDepth;
      item.setAttribute('aria-pressed', String(on));
      markOn(item, on);
    });
    if (bookBtn) bookBtn.setAttribute('data-mm-tip', '只看某一册或某一体系 · 当前 ' + scopeShort());
    if (levelBtn) levelBtn.setAttribute('data-mm-tip', '显示到哪一层 · 当前 ' + (LEVEL_SHORT[levelDepth] || '到章'));
    if (scopeNote) {
      if (isFieldScope(scopeKey)) {
        var node = fieldScope(scopeKey);
        scopeNote.textContent = '当前按「' + FIELD_SHORT[scopeKey] + '」体系看，共 ' + node.kids.length +
          ' 章（课标名：' + scopeKey + '）；点工具条第一个按钮可换分法。';
      } else if (scopeKey) {
        scopeNote.textContent = '当前按 ' + scopeKey + ' 聚焦' + (signedIn() ? '（学生当前年级）' : '') + '；点工具条第一个按钮可换册。';
      } else if (signedIn()) {
        scopeNote.textContent = '已登录：默认聚焦学生当前年级（' + studentGrade() + '），这里看的是总览。';
      } else {
        scopeNote.textContent = '未登录：先看总览，六册与各章一目了然；登录后默认聚焦自己的年级。';
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

  scopeKey = initialScope();
  axis = initialAxis();

  /* ---- 浮层：一次只开一个 ---- */
  function menuPairs() {
    return [[bookBtn, bookMenu], [levelBtn, levelMenu], [helpBtn, helpMenu]];
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
  if (bookBtn) bookBtn.addEventListener('click', function () { toggleMenu(bookBtn, bookMenu); });
  if (levelBtn) levelBtn.addEventListener('click', function () { toggleMenu(levelBtn, levelMenu); });
  if (helpBtn) helpBtn.addEventListener('click', function () { toggleMenu(helpBtn, helpMenu); });

  /* 分法切换条 */
  qsa('#mm-axis [data-axis]').forEach(function (item) {
    item.addEventListener('click', function () { setAxis(item.getAttribute('data-axis')); });
  });

  qsa('#mm-book-menu [data-book]').forEach(function (item) {
    item.addEventListener('click', function () {
      setBookFilter(item.getAttribute('data-book'));
      closeMenus();
    });
  });

  /* 体系那一栏：和册一样，选了就收起浮层 */
  qsa('#mm-book-menu [data-field]').forEach(function (item) {
    item.addEventListener('click', function () {
      setBookFilter(item.getAttribute('data-field'));
      closeMenus();
    });
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
    fields: fieldNames,
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
    books: DATA.kids.map(function (book) { return book.name; }),
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
})();
