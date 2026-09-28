/* ==========================================================================
   数字白板 (whiteboard.js)
   --------------------------------------------------------------------------
   · 无限画布：世界坐标 + 缩放 / 平移（滚轮、双指、空格拖拽、中键拖拽）
   · 输入：鼠标、数位板（含压感）、手指触控
   · 工具：画笔、荧光标记、橡皮（整笔擦除）、直线、箭头、矩形、椭圆
   · 工具条：仿 PS 把同类工具合成一组，点开浮层再选，节省底部空间
   · 题面：直接画在板上（世界坐标的底板层，不参与擦除与清空）
   · 模型：矢量存储 + 操作栈（绘制 / 擦除 / 清空 一律可撤销重做）
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  /* 浅色板共用的六支笔（中板底色仍浅，深色笔照样看得清，所以和白板同一套） */
  var LIGHT_COLORS = [
    { value: '#1f2937', label: '墨黑' },
    { value: '#dc2626', label: '朱红' },
    { value: '#2563eb', label: '靛蓝' },
    { value: '#059669', label: '青绿' },
    { value: '#ea580c', label: '橘橙' },
    { value: '#7c3aed', label: '紫罗兰' }
  ];
  /* 深色板要浅色笔，否则一条墨黑的线画在黑板上等于没画 */
  var DARK_COLORS = [
    { value: '#f8fafc', label: '雪白' },
    { value: '#f87171', label: '珊瑚' },
    { value: '#60a5fa', label: '天蓝' },
    { value: '#34d399', label: '翡翠' },
    { value: '#fbbf24', label: '琥珀' },
    { value: '#c084fc', label: '淡紫' }
  ];

  /* 板面主题：**一个主题是一整包配色**。
     为什么不能只换板面色 —— 深色板上深色字会直接消失，
     所以题面四色（ink / inkSoft / tag / tint）、网格、六支笔、荧光透明度都得跟着换。 */
  var THEMES = {
    white: {
      key: 'white', label: '白板',
      board: '#ffffff',
      grid: 'rgba(15,23,42,.06)',
      ink: '#101215', inkSoft: 'rgba(16,18,21,.56)', tag: 'rgba(16,18,21,.42)',
      tagHot: 'rgba(37,99,235,.78)',
      tint: 'rgba(37,99,235,.05)',
      highlightAlpha: 0.30,
      colors: LIGHT_COLORS
    },
    mid: {
      key: 'mid', label: '中板',
      board: '#eceff3',
      grid: 'rgba(15,23,42,.07)',
      ink: '#12161c', inkSoft: 'rgba(18,22,28,.58)', tag: 'rgba(18,22,28,.44)',
      tagHot: 'rgba(37,99,235,.78)',
      tint: 'rgba(37,99,235,.045)',
      highlightAlpha: 0.30,
      colors: LIGHT_COLORS
    },
    dark: {
      key: 'dark', label: '黑板',
      /* 深蓝黑而不是纯黑：纯黑配白字对比过强、久看累 */
      board: '#0f172a',
      grid: 'rgba(148,163,184,.14)',
      ink: '#f1f5f9', inkSoft: 'rgba(241,245,249,.62)', tag: 'rgba(241,245,249,.46)',
      tagHot: 'rgba(147,197,253,.86)',
      tint: 'rgba(96,165,250,.10)',
      highlightAlpha: 0.38,
      colors: DARK_COLORS
    }
  };
  var THEME_KEYS = ['white', 'mid', 'dark'];
  /* COLORS 是"当前这套笔"，换板时会被整体替换（见 setTheme） */
  var COLORS = LIGHT_COLORS;
  var WIDTHS = [
    { value: 2.2, label: '细' },
    { value: 3.6, label: '中' },
    { value: 6, label: '粗' }
  ];
  var ERASERS = [
    { value: 14, label: '小' },
    { value: 26, label: '中' },
    { value: 44, label: '大' }
  ];
  /* 网格疏密三档：世界单位。中档就是原来的 40 —— 所以默认观感一点不变，
     只是把原来写死的那个数变成了可选项。 */
  var GRID_SIZES = [
    { value: 20, label: '小' },
    { value: 40, label: '中' },
    { value: 80, label: '大' }
  ];
  var DEFAULT_GRID_SIZE = 40;
  var HIGHLIGHT_WIDTH = 18;      // 荧光标记的笔宽（世界单位）
  var SHAPE_TOOLS = ['line', 'arrow', 'rect', 'ellipse'];
  /* 工具分组（仿 PS：同类工具收进一个格子，点开再选，省工具条空间） */
  var GROUPS = ['draw', 'shape'];
  var TOOL_GROUPS = {
    draw: ['pen', 'highlighter', 'eraser'],
    shape: ['line', 'arrow', 'rect', 'ellipse']
  };
  var GROUP_TITLES = {
    draw: '画笔组：画笔 / 荧光笔 / 橡皮',
    shape: '图形组：直线 / 箭头 / 矩形 / 椭圆'
  };
  var MIN_SCALE = 0.15;
  var MAX_SCALE = 8;
  var STORE_KEY = 'wkmath.whiteboard.v1';
  var MAX_STROKES = 800;
  var MATH_FONT = '"Times New Roman","Songti SC","Source Han Serif SC","Noto Serif CJK SC",serif';
  var UI_FONT = '"Inter","PingFang SC","Noto Sans CJK SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  /* 题面底纹：宽度按内容算，只在一个上限处折行。
     原来的 PROBLEM_W 写死 720 —— 题目短也占满一条，四周空白全浪费。 */
  var PROBLEM_MAX_W = 720;       // 世界宽度上限，超长题在这里折行
  var PROBLEM_MIN_W = 160;       // 再短的题也留一点衬底，不然像散落的字
  var problemBox = { x: 16, y: 16, w: PROBLEM_MIN_W, h: 0 };   // 最近一次算出的题面矩形（世界坐标）

  function byId(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function toast(msg) {
    var MS = window.MathSite;
    if (MS && typeof MS.toast === 'function') MS.toast(msg);
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function isShapeTool(t) {
    return SHAPE_TOOLS.indexOf(t) >= 0;
  }

  var canvas = byId('wb-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var wrap = byId('wb-canvas-wrap') || canvas.parentNode;

  /* ---------- 状态 ---------- */
  var state = {
    tool: 'pen',                 // pen | highlighter | eraser | line | arrow | rect | ellipse
    groupLast: { draw: 'pen', shape: 'line' },   // 每个工具组格子上显示的那一个（PS 式的"上次用的"）
    theme: 'white',              // 板面主题：white | mid | dark
    color: COLORS[0].value,
    width: WIDTHS[1].value,
    eraser: ERASERS[1].value,
    grid: false,
    gridSize: DEFAULT_GRID_SIZE,  // 网格疏密：20 | 40 | 80
    showProblem: true,
    problemId: null,
    problemAt: { x: 16, y: 16 },  // 题面底纹在板上的位置（世界坐标）
    problemHover: false,          // 鼠标是否正压在题面上（决定那层很浅的底要不要浮现）
    problemGripHot: false,        // 鼠标是否正压在题面的把手上（决定光标是不是"可抓"）
    tipAt: null,                  // 笔尖 / 橡皮圆圈的位置（画布内 CSS 像素）；null = 不画
    external: null,              // 其它页面送来的内容 { text, tag, extra }
    analysis: {                   // 「分析 / 答案」这一层（DOM 浮层，不是画在板上的墨）
      open: false,                // 台阶框是否展开
      answerOpen: false,          // 答案块是否展开
      showNotes: true,            // 默认展示注释（设计 §2 #7）
      steps: []                   // [{ wx, wy, text }]，长度 0~5
    },
    ink: {                        // 「手写转文字」这一层（同样是 DOM 浮层）
      open: false,
      problemId: null,            // 这份文字属于哪道题
      steps: [],                  // [{ text, tone, comment }]
      source: '',                 // preset | empty | none —— 决定要不要挂「演示」标
      notice: ''                  // 面板顶部那句实话
    },
    strokes: [],                 // { type?, color, width, highlight?, pressured?, points:[{x,y,p}] }
    actions: [],
    redo: [],
    active: null,
    view: { scale: 1, x: 16, y: 16, w: 800, h: 520, dpr: 1 }
  };

  /* 当前板面主题（拿不到就退回白板，永远不给 undefined） */
  function theme() { return THEMES[state.theme] || THEMES.white; }
  function themes() { return THEMES; }

  /* ---------- 视图：世界 ↔ 屏幕 ---------- */
  function toWorld(sx, sy) {
    var v = state.view;
    return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale };
  }
  function zoomAt(sx, sy, factor) {
    var v = state.view;
    var next = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    if (Math.abs(next - v.scale) < 1e-5) return;
    var k = next / v.scale;
    v.x = sx - (sx - v.x) * k;
    v.y = sy - (sy - v.y) * k;
    v.scale = next;
    redraw();
    syncUI();
  }
  function zoomBy(factor) {
    var v = state.view;
    zoomAt(v.w / 2, v.h / 2, factor);
  }
  function resetZoom() {
    var v = state.view;
    zoomAt(v.w / 2, v.h / 2, 1 / v.scale);
  }
  function contentBounds() {
    var minX = 0, minY = 0, maxX = PROBLEM_MAX_W, maxY = 120;
    if (state.showProblem && problemBox.h > 0) {
      minX = Math.min(minX, problemBox.x);
      minY = Math.min(minY, problemBox.y);
      maxX = Math.max(maxX, problemBox.x + problemBox.w);
      maxY = Math.max(maxY, problemBox.y + problemBox.h);
    }
    state.strokes.forEach(function (s) {
      (s.points || []).forEach(function (p) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }
  function fitContent() {
    var v = state.view;
    var b = contentBounds();
    var pad = 40;
    var w = Math.max(1, b.maxX - b.minX);
    var h = Math.max(1, b.maxY - b.minY);
    var scale = clamp(Math.min((v.w - pad * 2) / w, (v.h - pad * 2) / h), MIN_SCALE, MAX_SCALE);
    v.scale = scale;
    v.x = pad + ((v.w - pad * 2) - w * scale) / 2 - b.minX * scale;
    v.y = pad + ((v.h - pad * 2) - h * scale) / 2 - b.minY * scale;
    redraw();
    syncUI();
  }

  /* ---------- 操作栈 ---------- */
  function applyAction(a) {
    if (!a) return;
    if (a.type === 'draw') {
      if (state.strokes.indexOf(a.stroke) < 0) state.strokes.push(a.stroke);
    } else if (a.type === 'erase') {
      a.items.slice().sort(function (x, y) { return y.index - x.index; }).forEach(function (it) {
        var i = state.strokes.indexOf(it.stroke);
        if (i >= 0) state.strokes.splice(i, 1);
      });
    } else if (a.type === 'region') {
      /* 区域擦除记的是"这一拖之前 / 之后，板上是哪些笔"。
         之所以只存引用就够：擦除**不修改原来那一笔**（新笔都是新对象），
         所以撤销就是把数组整个换回去，一笔都不会丢。 */
      state.strokes.length = 0;
      Array.prototype.push.apply(state.strokes, a.after);
    }
  }
  function unapplyAction(a) {
    if (!a) return;
    if (a.type === 'draw') {
      var i = state.strokes.indexOf(a.stroke);
      if (i >= 0) state.strokes.splice(i, 1);
    } else if (a.type === 'erase') {
      a.items.slice().sort(function (x, y) { return x.index - y.index; }).forEach(function (it) {
        if (state.strokes.indexOf(it.stroke) < 0) {
          state.strokes.splice(Math.min(it.index, state.strokes.length), 0, it.stroke);
        }
      });
    } else if (a.type === 'region') {
      state.strokes.length = 0;
      Array.prototype.push.apply(state.strokes, a.before);
    }
  }
  function commitAction(a) {
    state.actions.push(a);
    state.redo.length = 0;
    persist();
    syncUI();
  }
  function undo() {
    if (!state.actions.length) return false;
    var a = state.actions.pop();
    unapplyAction(a);
    state.redo.push(a);
    redraw();
    persist();
    syncUI();
    return true;
  }
  function redo() {
    if (!state.redo.length) return false;
    var a = state.redo.pop();
    applyAction(a);
    state.actions.push(a);
    redraw();
    persist();
    syncUI();
    return true;
  }
  function clearAll() {
    if (!state.strokes.length) return false;
    var items = state.strokes.map(function (s, i) { return { index: i, stroke: s }; });
    state.strokes.length = 0;
    commitAction({ type: 'erase', items: items, label: '清空' });
    redraw();
    toast('已清空，可用撤销找回');
    return true;
  }

  /* ---------- 画布尺寸 ---------- */
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(wrap.clientWidth || canvas.clientWidth || state.view.w));
    var h = Math.max(1, Math.round(wrap.clientHeight || canvas.clientHeight || state.view.h));
    var first = state.view.w !== w || state.view.h !== h;
    state.view.w = w;
    state.view.h = h;
    state.view.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (canvas.style) {
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    if (first && state.freshView) {
      /* 首次进场：把题面对齐到左上角，窄屏时自动缩小以完整显示 */
      state.view.scale = clamp(Math.min(1, (w - 32) / PROBLEM_MAX_W), MIN_SCALE, 1);
      state.view.x = 16;
      state.view.y = 16;
      state.freshView = false;
    }
    redraw();
    reflowPanel();
  }

  /* ---------- 绘制 ---------- */
  /* 网格疏密 = 三档选出来的基数，下面那两条随缩放自动加密 / 减疏的修正一字不改：
     格子始终落在 14～96 屏幕像素之间这条保证，对三档一视同仁。
     代价是三档在离得很远或放得很大时会趋于同一个疏密 —— 这是躲不掉的，
     要保证"格子看得清"，就只能落在有限区间里，区间里再怎么排也会撞。
     为"永远不同"把格子画到 7px 那种糊掉的程度，是更坏的选择。 */
  function drawGrid() {
    var v = state.view;
    var step = state.gridSize || DEFAULT_GRID_SIZE;
    while (step * v.scale < 14) step *= 2;
    while (step * v.scale > 96) step /= 2;
    var left = (0 - v.x) / v.scale;
    var right = (v.w - v.x) / v.scale;
    var top = (0 - v.y) / v.scale;
    var bottom = (v.h - v.y) / v.scale;
    var startX = Math.floor(left / step) * step;
    var startY = Math.floor(top / step) * step;
    ctx.save();
    ctx.strokeStyle = theme().grid;
    ctx.lineWidth = 1 / v.scale;
    for (var x = startX; x <= right; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (var y = startY; y <= bottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function wrapText(text, maxW) {
    var lines = [];
    var s = String(text == null ? '' : text);
    var cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      var test = cur + ch;
      var tooWide = ctx.measureText && ctx.measureText(test).width > maxW;
      if (tooWide && cur) { lines.push(cur); cur = ch; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* 题面：世界坐标里的底板层。
     画成"底纹"而不是"卡片"：极浅的衬底、不描边，宽度按内容算 ——
     卡片有边界，边界要吃掉四周空白，宽度还固定，题目短也占满一条。 */
  function drawProblemLayer() {
    var data = cardData();
    if (!data || !state.showProblem) { problemBox.h = 0; return; }

    var tagFont = '12px ' + UI_FONT;
    var textFont = '600 19px ' + MATH_FONT;
    var extraFont = '13px ' + UI_FONT;
    var innerMax = PROBLEM_MAX_W - 36;

    /* 第一遍：量"不折行要多宽"，用它定下这条底纹占多宽 */
    var natural = 0;
    if (data.tag) { ctx.font = tagFont; natural = Math.max(natural, ctx.measureText(data.tag).width); }
    if (data.text) { ctx.font = textFont; natural = Math.max(natural, ctx.measureText(data.text).width); }
    if (data.extra) { ctx.font = extraFont; natural = Math.max(natural, ctx.measureText(data.extra).width); }
    var innerW = clamp(Math.ceil(natural), PROBLEM_MIN_W - 36, innerMax);

    /* 第二遍：按定下的宽度折行 */
    var lines = [];
    if (data.text) { ctx.font = textFont; lines = wrapText(data.text, innerW); }
    var extraLines = [];
    if (data.extra) { ctx.font = extraFont; extraLines = wrapText(data.extra, innerW); }

    var x = state.problemAt.x;
    var y = state.problemAt.y;
    var w = innerW + 36;
    var tagH = data.tag ? 22 : 0;
    var h = tagH + lines.length * 29 + (extraLines.length ? extraLines.length * 21 + 8 : 0) + 26;

    problemBox.x = x; problemBox.y = y; problemBox.w = w; problemBox.h = h;

    ctx.save();
    /* 底纹默认**不画**：题面就是印在板上的一段字。
       鼠标压上来时才浮现这层很浅的底 —— 平时把板面整个留给演算。 */
    if (state.problemHover) {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, 14);
      else ctx.rect(x, y, w, h);
      ctx.fillStyle = theme().tint;
      ctx.fill();
      /* 这里原本有"一道通高竖条 + 两道短横"的把手纹，都去掉了。
         用户看过真实效果后明确要求去掉那两道短横 —— 题面上不该挂任何记号。
         抓取区还在（problemGrip），鼠标压上去光标仍是"可抓"，只是不再画东西了。 */
    }

    var tx = x + 20;
    var ty = y + 14;
    ctx.textBaseline = 'top';
    if (data.tag) {
      ctx.font = tagFont;
      ctx.fillStyle = state.problemHover ? theme().tagHot : theme().tag;
      ctx.fillText(data.tag, tx, ty + 3);
      ty += tagH;
    }
    ctx.font = textFont;
    ctx.fillStyle = theme().ink;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tx, ty + 3);
      ty += 29;
    }
    if (extraLines.length) {
      ctx.font = extraFont;
      ctx.fillStyle = theme().inkSoft;
      ty += 8;
      for (var j = 0; j < extraLines.length; j++) {
        ctx.fillText(extraLines[j], tx, ty);
        ty += 21;
      }
    }
    ctx.restore();
  }

  /* 题面矩形的只读快照（世界坐标）：给覆盖层定位、给断言用 */
  function problemLayout() {
    return { x: problemBox.x, y: problemBox.y, w: problemBox.w, h: problemBox.h };
  }

  /* 这个世界点是否落在题面里 —— 悬停判定用它 */
  function hitProblem(wx, wy) {
    return problemBox.h > 0 &&
      wx >= problemBox.x && wx <= problemBox.x + problemBox.w &&
      wy >= problemBox.y && wy <= problemBox.y + problemBox.h;
  }

  /* 题面的把手：左侧那条主色竖条所在的一小条（正文从 x+20 才开始，这里没有字）。
     为什么不做成"整块都能拖"：题面是**演算区**，学生要在题目上圈已知条件、划关键词 ——
     整块吃掉指针就等于把"在题目上圈画"这个最常用的动作禁掉了。
     把手只压在无字处：想挪就抓它，想圈画就直接画。 */
  var PROBLEM_GRIP_W = 24;
  function problemGrip() {
    return { x: problemBox.x - 3, y: problemBox.y, w: PROBLEM_GRIP_W + 3, h: problemBox.h };
  }
  function hitProblemHandle(wx, wy) {
    if (problemBox.h <= 0) return false;
    var g = problemGrip();
    return wx >= g.x && wx <= g.x + g.w && wy >= g.y && wy <= g.y + g.h;
  }

  /* 那层很浅的底只在鼠标压上来时浮现：平时题面就是印在板上的一段字 */
  function setProblemHover(on) {
    on = !!on;
    if (state.problemHover === on) return;
    state.problemHover = on;
    /* 压在把手上时换成"可以抓"的光标 —— 整块都能拖的话这个提示就没意义了 */
    syncCursor();
    scheduleRedraw();
  }

  /* 指针是不是正压在把手上（决定光标形状） */
  function setProblemGripHot(on) {
    on = !!on;
    if (state.problemGripHot === on) return;
    state.problemGripHot = on;
    syncCursor();
  }

  /* 画布上的光标由两件事决定，集中在一处免得互相覆盖。
     **题面把手优先于笔尖**：题面在任何工具下都能拖，压在把手上时必须让人看出"可抓"，
     否则用着笔的时候路过把手，光标被藏掉、圈又画在那里，"能抓"这件事就完全看不出来了。

     调用点只有 syncUI 一处（外加下面两个 hover 设置器）—— 收口在一个函数里，
     才不会出现"某条改工具的路径忘了同步光标"的事。 */
  function syncCursor() {
    if (!canvas || !canvas.style) return;
    if (state.problemHover && state.problemGripHot) { canvas.style.cursor = 'grab'; return; }
    if (state.tool === 'pen' || state.tool === 'highlighter' || state.tool === 'eraser') {
      canvas.style.cursor = 'none';
      return;
    }
    canvas.style.cursor = '';
  }

  function strokeWidthFor(s, p, q) {
    if (!s.pressured) return s.width;
    var pr = ((p && p.p ? p.p : 0) + (q && q.p ? q.p : 0)) / 2;
    if (!(pr > 0)) pr = 0.5;
    return s.width * (0.45 + 1.05 * clamp(pr, 0, 1));
  }

  function drawFreehand(s) {
    var pts = s.points || [];
    if (!pts.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    if (s.highlight) ctx.globalAlpha = theme().highlightAlpha;

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, Math.max(0.7, strokeWidthFor(s, pts[0], pts[0]) / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i > 0 ? i - 1 : 0];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var start = i === 0 ? p1 : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      var end = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      ctx.beginPath();
      ctx.lineWidth = strokeWidthFor(s, p1, p2);
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(p1.x, p1.y, end.x, end.y);
      ctx.stroke();
    }
    var last = pts[pts.length - 1];
    var prev = pts[pts.length - 2];
    ctx.beginPath();
    ctx.lineWidth = strokeWidthFor(s, prev, last);
    ctx.moveTo((prev.x + last.x) / 2, (prev.y + last.y) / 2);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  /* 箭头的两支头端点。抽出来是因为**橡皮也要知道头的几何** ——
     否则箭头被擦一下，杆断成两截、头直接不见（那处改动会跟画的地方对不上）。 */
  function arrowHeadPts(from, to, w) {
    var ang = Math.atan2(to.y - from.y, to.x - from.x);
    var len = Math.max(10, (w || 3) * 3.6);
    var spread = Math.PI / 7;
    return [
      { x: to.x - len * Math.cos(ang - spread), y: to.y - len * Math.sin(ang - spread) },
      { x: to.x - len * Math.cos(ang + spread), y: to.y - len * Math.sin(ang + spread) }
    ];
  }

  function drawArrowHead(from, to, w) {
    var h = arrowHeadPts(from, to, w);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(h[0].x, h[0].y);
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(h[1].x, h[1].y);
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawShape(s) {
    var pts = s.points || [];
    if (pts.length < 2) return;
    var a = pts[0];
    var b = pts[1];
    var w = s.width || 3;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.type === 'line' || s.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (s.type === 'arrow') drawArrowHead(a, b, w);
    } else if (s.type === 'rect') {
      ctx.beginPath();
      ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.stroke();
    } else if (s.type === 'ellipse') {
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2,
          Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2,
          Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 笔尖 / 橡皮的圆圈：跟在鼠标后面，表示"这一圈就是这一下会画（或擦）到的范围"。
     画在**屏幕空间**：橡皮的半径本来就是屏幕像素；笔尖则按 scale 换算，
     所以圈的大小始终等于"手上这支笔在屏幕上多粗"。

     为什么要用圆圈换掉十字光标：十字只告诉你"点在哪"，圆圈还告诉你"会画多粗"。
     笔细的时候真实笔尖只有 1px 半径，画出来等于看不见，所以给一个最小半径兜底。 */
  var TIP_MIN_R = 3;
  function drawTipRing() {
    var at = state.tipAt;
    if (!at || !ctx) return;
    /* 压在题面把手上时不画圈 —— 那时光标是"可抓"，两个提示叠在一起会互相打架 */
    if (state.problemHover && state.problemGripHot) return;
    var v = state.view;
    var r = 0, lw = 1.2;
    if (state.tool === 'eraser') {
      r = state.eraser;
      lw = 1.5;
    } else if (state.tool === 'pen' || state.tool === 'highlighter') {
      r = Math.max(TIP_MIN_R, (state.tool === 'highlighter' ? HIGHLIGHT_WIDTH : state.width) * v.scale / 2);
    }
    if (!r) return;   // 图形工具仍用十字：画框时要的是准，不是笔粗
    if (ctx.setTransform) ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.arc === 'function') ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.lineWidth = lw;
    /* 颜色跟着板面主题走：黑板上得用浅色，不然深底上根本看不见这个圈 */
    ctx.strokeStyle = theme().tag;
    ctx.stroke();
    ctx.restore();
  }

  function drawStroke(s) {
    if (!s) return;
    /* 自己设世界变换 —— 这样无论从 redraw() 里批量画，还是从指针事件里单独画一笔，都对 */
    worldTransform();
    if (isShapeTool(s.type)) drawShape(s);
    else drawFreehand(s);
  }

  /* 世界坐标 → 位图的变换。**凡是要画世界坐标的地方，都得自己先设一次。**
     `setTransform` 是"替换"而不是"叠加"，所以重复设是幂等的，多设无害、少设出事。
     为什么非强调不可：`redraw()` 结尾的 `ctx.restore()` 会把变换退回**设备像素空间**，
     于是"拖动中的增量墨迹"（drawTail）如果不自己重设，就会把世界坐标当 CSS 像素画出来 ——
     墨不跟手、位置和粗细都错，直到松手时 `redraw()` 重画才纠正回来。
     用户报的"落笔在 A，画笔却从别处画起、还多一条长线"就是它：**画的时候**错，一松手又对了。 */
  function worldTransform() {
    var v = state.view;
    if (ctx.setTransform) ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.x, v.dpr * v.y);
  }

  function redraw() {
    var v = state.view;
    if (ctx.setTransform) ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    /* 板面色由**画布自己铺**，不再靠 .wb-canvas-wrap 的 CSS 白底：
       导出要带背景，透明区会变成透明 PNG。 */
    ctx.fillStyle = theme().board;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.save();
    worldTransform();
    if (state.grid) drawGrid();
    drawProblemLayer();
    for (var i = 0; i < state.strokes.length; i++) drawStroke(state.strokes[i]);
    ctx.restore();
    drawTipRing();
    /* 浮层（题面旁两个按钮 / 台阶框 / 答案块）都是 DOM，画布管不到它们；
       它们的位置全部由世界坐标投影出来，所以每次重绘后重排一次就跟着板走了。
       注意：必须放在**画完题面之后** —— drawProblemLayer 里才会算出最新的题面矩形，
       摆在它前面就会慢一帧（这一处踩过：断言报"题面右移后按钮没跟着动"）。 */
    renderSteps(overlayCtx());
    layoutOverlays();
  }

  /* ---------- 分析 / 答案：DOM 浮层 ---------- */

  /* 世界坐标 → 画布内坐标（CSS 像素）。
     这些浮层是 .wb-canvas-wrap 的绝对定位子元素，与 <canvas> 的 CSS 盒子共享同一个原点，
     所以**不加** getBoundingClientRect().left —— 加了反而会多偏一个左边距（这一处踩过）。 */
  function boardToScreen(wx, wy) {
    var v = state.view;
    return { x: v.x + wx * v.scale, y: v.y + wy * v.scale };
  }

  function toggleHidden(el, hide) {
    if (!el) return;
    el.hidden = !!hide;
    if (hide) { if (el.setAttribute) el.setAttribute('hidden', 'hidden'); }
    else if (el.removeAttribute) el.removeAttribute('hidden');
  }

  function setText(el, s) {
    if (el && el.textContent !== s) el.textContent = s;
  }

  /* 板上有题面吗？题面收起时，按钮 / 台阶 / 答案都要一起收起 */
  function overlayCtx() {
    var data = cardData();
    var box = problemLayout();
    return { has: !!data && !!state.showProblem && box.h > 0, box: box };
  }

  /* 两个按钮的激活态：分析开 / 答案开，各自亮，互不干扰
     （第三个按钮"转文字"见下面的 syncActs 扩展） */
  function syncActs() {
    press(byId('wb-act-analysis'), state.analysis.open);
    press(byId('wb-act-answer'), state.analysis.answerOpen);
    press(byId('wb-act-transcribe'), state.ink.open);
  }

  /* 浮层落位：全部由世界坐标投影出来，所以平移 / 缩放后重排一次就跟着板走了。
     redraw() 结尾会调它，因此不需要额外的 resize 监听。 */
  function layoutOverlays(ctx) {
    ctx = ctx || overlayCtx();
    layoutActs(ctx);
    layoutBelow(ctx);
  }

  /* 题面右上角那组按钮 */
  function layoutActs(ctx) {
    var v = state.view;
    var acts = byId('wb-acts');
    if (!acts) return;
    /* 板上没题、或题面被收起 → 这一层跟着收起，不留在板上当幽灵 */
    toggleHidden(acts, !ctx.has);
    syncActs();
    if (acts.hidden || !acts.style) return;

    var anchor = boardToScreen(ctx.box.x + ctx.box.w + 10, ctx.box.y);
    var aw = acts.offsetWidth || 108;
    var ah = acts.offsetHeight || 26;
    /* 压回可视区：宁可"不再贴着题面"，也不能让按钮跑出画布按不到 */
    var maxX = Math.max(4, (wrap.clientWidth || v.w) - aw - 4);
    var maxY = Math.max(4, (wrap.clientHeight || v.h) - ah - 4);
    acts.style.left = Math.min(Math.max(4, anchor.x), maxX) + 'px';
    acts.style.top = Math.min(Math.max(4, anchor.y), maxY) + 'px';

    /* 台阶框也由世界坐标投影出来 —— 和上面两个按钮同一套算法。
       位置只在第一次落位时算，之后跟着学生拖的结果走（见 openAnalysis）。 */
    for (var si = 0; si < MAX_STEPS; si++) {
      var sb = byId('wb-step-' + si);
      if (!sb || sb.hidden || !sb.style) continue;
      var st = state.analysis.steps[si];
      if (!st || st.wx === null) continue;
      var sp = boardToScreen(st.wx, st.wy);
      sb.style.left = Math.round(sp.x) + 'px';
      sb.style.top = Math.round(sp.y) + 'px';
    }
  }

  /* 题目下方竖排的那几块：谁开谁占位，依次往下，互不重叠。
     目前只有「手写转文字」一块；「台阶框」「答案块」按同一张登记表挂进来即可，
     不用各自去算位置 —— 三块都往下挂，各算各的必然会互相压。 */
  function belowBlocks() {
    return [
      { el: byId('wb-ink-text'), open: state.ink.open }
    ];
  }

  function layoutBelow(ctx) {
    var v = state.view;
    var below = ctx.box.y + ctx.box.h + 12;
    belowBlocks().forEach(function (block) {
      var el = block.el;
      if (!el || !el.style) return;
      toggleHidden(el, !ctx.has || !block.open);
      if (el.hidden) return;
      var at = boardToScreen(ctx.box.x, below);
      var bw = el.offsetWidth || 280;
      var bh = el.offsetHeight || 120;
      var maxX = Math.max(4, (wrap.clientWidth || v.w) - bw - 4);
      var maxY = Math.max(4, (wrap.clientHeight || v.h) - bh - 4);
      el.style.left = Math.min(Math.max(4, at.x), maxX) + 'px';
      el.style.top = Math.min(Math.max(4, at.y), maxY) + 'px';
      below += bh + 10;
    });
  }

  /* 这两个开关在 Task 3 / Task 4 里长出内容；先让按钮有个真实反应，
     免得 Task 2 交付的是两个点不动的装饰。 */
  function toggleAnalysis() {
    if (state.analysis.open) closeAnalysis(); else openAnalysis();
    return state.analysis.open;
  }

  function toggleAnswer() {
    state.analysis.answerOpen = !state.analysis.answerOpen;
    redraw();
    return state.analysis.answerOpen;
  }

  /* ---------- 台阶框 ---------- */

  var MAX_STEPS = 5;

  /* 台阶的引导语：只给"该往哪儿看"。本版是预置数据，接真服务只换这一个调用点。 */
  function stepGuides() {
    var api = (typeof window !== 'undefined' && window.WK_ANALYSIS) ? window.WK_ANALYSIS : null;
    if (!api || typeof api.steps !== 'function') return [];
    var list = api.steps(cardData());
    return (list && list.length) ? list.slice(0, MAX_STEPS) : [];
  }
  function stepGuide(i) { return stepGuides()[i] || ''; }

  /* 台阶框的初始落位：题面右侧、依次向下错开。
     偏移量按屏幕像素折算成世界单位 —— 这样不管当前缩放多少，看起来都是同一套间距。 */
  function defaultStepAt(i) {
    var box = problemBox;
    var k = state.view.scale || 1;
    return {
      wx: box.x + box.w + (26 + i * 16) / k,
      wy: box.y + (i * 104) / k
    };
  }

  /* 展开台阶：位置只在第一次落位时算，之后跟着学生拖的结果走 */
  function openAnalysis() {
    var n = stepGuides().length;
    if (!n) return 0;
    for (var i = 0; i < n; i++) {
      var s = state.analysis.steps[i];
      if (!s) { s = { wx: null, wy: null, text: '' }; state.analysis.steps[i] = s; }
      if (s.wx === null || s.wy === null) {
        var d = defaultStepAt(i);
        s.wx = d.wx; s.wy = d.wy;
      }
    }
    state.analysis.steps.length = n;
    state.analysis.open = true;
    state.analysis.answerOpen = false;   /* 点「分析」先把答案收起来（设计 §2 #6） */
    redraw();
    persist();
    return n;
  }

  function closeAnalysis() {
    state.analysis.open = false;         /* 收起不是清空：学生写的内容留着 */
    redraw();
    persist();
  }

  function analysisOpen() { return !!state.analysis.open; }

  function setStepText(i, text) {
    var s = state.analysis.steps[i];
    if (!s) return null;
    s.text = String(text == null ? '' : text);
    var pad = byId('wb-step-pad-' + i);
    /* 只有真的不一样才回写 DOM —— 否则每敲一个字都会把光标顶到末尾 */
    if (pad && pad.textContent !== s.text) pad.textContent = s.text;
    /* 这里**故意不 persist()**：本函数挂在 input 事件上，每敲一个字都会调用一次，
       而 persist() 会把最多 800 笔笔迹整体 JSON 序列化一遍 —— 每敲一个字写几百 KB 会卡。
       落盘交给失焦（blur）和拖动结束（onStepUp）。 */
    return s.text;
  }
  function stepText(i) {
    var s = state.analysis.steps[i];
    return s ? (s.text || '') : '';
  }
  function stepPos(i) {
    var s = state.analysis.steps[i];
    return s ? { wx: s.wx, wy: s.wy } : null;
  }

  function renderSteps(ctx) {
    var guides = stepGuides();
    for (var i = 0; i < MAX_STEPS; i++) {
      var box = byId('wb-step-' + i);
      if (!box) continue;
      var on = ctx.has && state.analysis.open && i < guides.length;
      toggleHidden(box, !on);
      if (!on) continue;
      setText(byId('wb-step-guide-' + i), guides[i]);
      var s = state.analysis.steps[i];
      var pad = byId('wb-step-pad-' + i);
      if (pad && pad.textContent !== (s ? (s.text || '') : '')) pad.textContent = s ? (s.text || '') : '';
      if (box.style && box.style.setProperty) box.style.setProperty('--i', String(i));
    }
  }

  /* 拖台阶框：手柄是标题栏。手上拖的是屏幕像素，世界位移除以 scale —— 和拖题面同一条规矩。 */
  var stepDrag = null;

  function onStepDown(idx, e) {
    var s = state.analysis.steps[idx];
    if (!s || s.wx === null) return;
    var head = byId('wb-step-head-' + idx);
    stepDrag = { idx: idx, id: e.pointerId, sx: e.clientX, sy: e.clientY, wx: s.wx, wy: s.wy };
    var box = byId('wb-step-' + idx);
    if (box && box.classList) box.classList.add('is-dragging');
    if (head && typeof head.setPointerCapture === 'function') {
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }

  function onStepMove(idx, e) {
    if (!stepDrag || stepDrag.idx !== idx || e.pointerId !== stepDrag.id) return;
    var s = state.analysis.steps[idx];
    if (!s) return;
    var k = state.view.scale || 1;
    s.wx = stepDrag.wx + (e.clientX - stepDrag.sx) / k;
    s.wy = stepDrag.wy + (e.clientY - stepDrag.sy) / k;
    layoutOverlays();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }

  function onStepUp(idx, e) {
    if (!stepDrag || stepDrag.idx !== idx) return;
    if (e && e.pointerId !== undefined && e.pointerId !== stepDrag.id) return;
    var box = byId('wb-step-' + idx);
    if (box && box.classList) box.classList.remove('is-dragging');
    stepDrag = null;
    persist();
  }

  /* 每个台阶框各挂各的 —— 把序号闭包进来，
     比在事件里 closest('.wb-step') 反查更稳（桩里 closest 永远是 null）。 */
  function initStepDrag() {
    for (var i = 0; i < MAX_STEPS; i++) {
      (function (idx) {
        var head = byId('wb-step-head-' + idx);
        if (!head || !head.addEventListener) return;
        head.addEventListener('pointerdown', function (e) { onStepDown(idx, e); });
        head.addEventListener('pointermove', function (e) { onStepMove(idx, e); });
        head.addEventListener('pointerup', function (e) { onStepUp(idx, e); });
        head.addEventListener('pointercancel', function (e) { onStepUp(idx, e); });
        var pad = byId('wb-step-pad-' + idx);
        if (pad && pad.addEventListener) {
          pad.addEventListener('input', function () { setStepText(idx, pad.textContent); });
          /* 失焦时落盘：打字过程不写，离开这个框才写一次 */
          pad.addEventListener('blur', function () { persist(); });
        }
      })(i);
    }
  }

  /* ---------- 手写转文字：识别 + 分步点评 ----------
     本版不接真 AI：文字与点评都来自 assets/js/whiteboard-ink-text.js 的预置数据，
     接真服务时只换那个模块里的 recognize() / review() 两个函数，这里一行不用动。 */

  var INK_KEY = 'wkmath.whiteboard.inktext';
  var WK_INK = window.WK_INK_TEXT;

  /* 按题目 id 分开放，与笔迹分开存：
     「清空画布」只清笔迹，不该把已经转出来的文字一起抹掉 —— 那是你存下来的东西。 */
  function inkStore() {
    var raw = null;
    try { raw = window.localStorage.getItem(INK_KEY); } catch (e) { return {}; }
    if (!raw) return {};
    var d;
    try { d = JSON.parse(raw); } catch (e) { return {}; }
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  }

  function inkWrite(store) {
    try { window.localStorage.setItem(INK_KEY, JSON.stringify(store)); } catch (e) { /* 忽略 */ }
  }

  /* 读某一题的记录。坏数据一律当"没转过"，不崩也不显示半截 */
  function inkRecord(problemId) {
    if (!problemId) return null;
    var rec = inkStore()[problemId];
    if (!rec || !rec.steps || !rec.steps.length) return null;
    return rec.steps.map(function (s) {
      var tone = (s && s.tone) || 'ok';
      if (!WK_INK || WK_INK.TONES.indexOf(tone) < 0) tone = 'ok';
      return {
        text: String((s && s.text) != null ? s.text : ''),
        tone: tone,
        comment: String((s && s.comment) || '')
      };
    });
  }

  function inkSave(problemId, steps) {
    if (!problemId) return false;
    var store = inkStore();
    store[problemId] = {
      steps: steps.map(function (s) { return { text: s.text, tone: s.tone, comment: s.comment }; })
    };
    inkWrite(store);
    return true;
  }

  function inkDrop(problemId) {
    if (!problemId) return false;
    var store = inkStore();
    if (!store[problemId]) return false;
    delete store[problemId];
    inkWrite(store);
    return true;
  }

  /* 题面框以外的笔迹 —— 一条都没有就**不装**（不许凭空变出一段用户没写过的字） */
  function inkOutside() {
    if (!WK_INK) return [];
    return WK_INK.outsideStrokes(state.strokes, problemLayout());
  }

  function runTranscribe() {
    var id = state.problemId;
    /* 面板里那份文字属于哪道题，以**打开这一刻**的题为准。
       不跟着走的话，编辑会存到上一题名下（断言抓出来过：切到 7a-03 改字，却写进了 7a-02）。 */
    state.ink.problemId = id;
    var outside = inkOutside();
    if (!outside.length) {
      state.ink.steps = [];
      state.ink.source = 'empty';
      state.ink.notice = '题面外还没有笔迹。写下你的思路，再点一次。';
      inkRender();
      return false;
    }
    var res = WK_INK ? WK_INK.recognize(id, outside) : { ok: false };
    if (!res.ok) {
      state.ink.steps = [];
      state.ink.source = 'none';
      state.ink.notice = (WK_INK && WK_INK.NO_PRESET) || '这道题还没有演示数据。';
      inkRender();
      return false;
    }
    state.ink.steps = (res.steps || []).map(function (s, i) {
      var rv = WK_INK.review(id, i, s.text) || {};
      return { text: s.text, tone: rv.tone || 'ok', comment: rv.comment || '' };
    });
    state.ink.source = 'preset';
    state.ink.notice = WK_INK.DEMO_NOTE;
    inkSave(id, state.ink.steps);
    inkRender();
    return true;
  }

  function inkRowHtml(s, i) {
    var tone = (WK_INK && WK_INK.TONES.indexOf(s.tone) >= 0) ? s.tone : 'ok';
    return '<li class="wb-ink__step" data-tone="' + tone + '">' +
      '<span class="wb-ink__no">第 ' + (i + 1) + ' 步</span>' +
      '<div class="wb-ink__text" contenteditable="true" role="textbox" tabindex="0"' +
      ' data-step="' + i + '" aria-label="第 ' + (i + 1) + ' 步的文字">' + esc(s.text) + '</div>' +
      (s.comment
        ? '<p class="wb-ink__cmt"><span class="wb-ink__tone">' +
          esc((WK_INK && WK_INK.TONE_LABEL[tone]) || '') + '</span>' + esc(s.comment) + '</p>'
        : '') +
      '</li>';
  }

  /* 面板内容由数据重建。文字那格是 contenteditable ——
     所以**输入过程中绝不重画**（重画会重建 DOM、光标就断了）：输入只写数据。 */
  function inkRender() {
    setText(byId('wb-ink-note'), state.ink.notice || '');
    toggleHidden(byId('wb-ink-badge'), state.ink.source !== 'preset');
    var list = byId('wb-ink-steps');
    if (list) {
      list.innerHTML = (state.ink.steps || []).map(inkRowHtml).join('');
    }
    var acts = byId('wb-ink-acts');
    toggleHidden(acts, !state.ink.steps.length);
    syncActs();
  }

  /* 打开时：有记录就用记录，没有就当场转一次 */
  function inkLoad() {
    state.ink.problemId = state.problemId;
    var rec = inkRecord(state.ink.problemId);
    if (rec) {
      state.ink.steps = rec;
      state.ink.source = 'preset';
      state.ink.notice = (WK_INK && WK_INK.DEMO_NOTE) || '';
      inkRender();
      return true;
    }
    return runTranscribe();
  }

  /* 换题了：面板开着就换成这一题的记录 / 重新识别。
     不这么做的话，切到另一题还挂着上一题的文字 —— 那是串台。 */
  function inkSyncProblem() {
    if (!state.ink.open) return false;
    state.ink.problemId = state.problemId;
    inkLoad();
    scheduleRedraw();
    return true;
  }

  function toggleTranscribe() {
    state.ink.open = !state.ink.open;
    if (state.ink.open) inkLoad();
    else inkRender();
    redraw();
    return state.ink.open;
  }

  var rafPending = false;
  function scheduleRedraw() {
    if (rafPending) return;
    rafPending = true;
    var run = function () { rafPending = false; redraw(); };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else run();
  }

  /* ---------- 擦除：整笔（含图形） ---------- */
  function distToSegmentSq(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = dx * dx + dy * dy;
    var t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
    t = clamp(t, 0, 1);
    var ex = x1 + t * dx - px;
    var ey = y1 + t * dy - py;
    return ex * ex + ey * ey;
  }

  function strokeHit(s, x, y, r) {
    var pts = s.points || [];
    var tol = r + (s.width || 3) / 2;
    if (!pts.length) return false;
    if (isShapeTool(s.type)) {
      if (pts.length < 2) return false;
      var a = pts[0];
      var b = pts[1];
      if (s.type === 'rect') {
        var x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
        var y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
        return distToSegmentSq(x, y, x1, y1, x2, y1) <= tol * tol ||
          distToSegmentSq(x, y, x2, y1, x2, y2) <= tol * tol ||
          distToSegmentSq(x, y, x2, y2, x1, y2) <= tol * tol ||
          distToSegmentSq(x, y, x1, y2, x1, y1) <= tol * tol;
      }
      if (s.type === 'ellipse') {
        var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        var rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        for (var k = 0; k < 36; k++) {
          var t1 = (k / 36) * Math.PI * 2;
          var t2 = ((k + 1) / 36) * Math.PI * 2;
          if (distToSegmentSq(x, y,
            cx + rx * Math.cos(t1), cy + ry * Math.sin(t1),
            cx + rx * Math.cos(t2), cy + ry * Math.sin(t2)) <= tol * tol) return true;
        }
        return false;
      }
      return distToSegmentSq(x, y, a.x, a.y, b.x, b.y) <= tol * tol;
    }
    if (pts.length === 1) {
      var dx = pts[0].x - x;
      var dy = pts[0].y - y;
      return dx * dx + dy * dy <= tol * tol;
    }
    for (var i = 0; i < pts.length - 1; i++) {
      if (distToSegmentSq(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tol * tol) return true;
    }
    return false;
  }

  /* ---------- 橡皮：圆圈擦到哪里，哪里才没 ---------- */

  /* 一条线段被圆"吃掉"之后剩下什么，返回 0~2 段：
     圆只咬在中间 → 剩两段；咬住一端 → 剩一段；整段都在圆里 → 什么都不剩。
     这是"擦哪儿没哪儿"能干净切断的原因 —— **按几何切**，不是按点删。
     按点删的话，一条只有两端的直线被圆咬中间时一个点都不在圆里，会完全擦不动。 */
  function clipSegmentOut(ax, ay, bx, by, cx, cy, r) {
    var dx = bx - ax, dy = by - ay;
    var fx = ax - cx, fy = ay - cy;
    var aa = dx * dx + dy * dy;
    var bb = 2 * (fx * dx + fy * dy);
    var cc = fx * fx + fy * fy - r * r;
    if (aa < 1e-9) return (cc > 0) ? [{ ax: ax, ay: ay, bx: bx, by: by }] : [];
    var disc = bb * bb - 4 * aa * cc;
    if (disc <= 0) {
      /* 与圆不相交：整段要么全在外、要么全在内，拿中点判一下 */
      var mx = (ax + bx) / 2 - cx, my = (ay + by) / 2 - cy;
      return (mx * mx + my * my > r * r) ? [{ ax: ax, ay: ay, bx: bx, by: by }] : [];
    }
    var sq = Math.sqrt(disc);
    var t1 = (-bb - sq) / (2 * aa);
    var t2 = (-bb + sq) / (2 * aa);
    /* 只在线段的延长线上相交，线段本身没进圆 */
    if (t2 <= 0 || t1 >= 1) return [{ ax: ax, ay: ay, bx: bx, by: by }];
    var in0 = Math.max(0, t1);
    var in1 = Math.min(1, t2);
    var out = [];
    if (in0 > 1e-6) out.push({ ax: ax, ay: ay, bx: ax + dx * in0, by: ay + dy * in0 });
    if (in1 < 1 - 1e-6) out.push({ ax: ax + dx * in1, ay: ay + dy * in1, bx: bx, by: by });
    return out;
  }

  /* 一条折线被圆咬过之后剩下的一段一段。相邻的保留段首尾相接就并成一条，别把一笔碎成几十条。 */
  function clipPolyline(pts, cx, cy, r) {
    var runs = [], cur = null;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var kept = clipSegmentOut(a.x, a.y, b.x, b.y, cx, cy, r);
      if (!kept.length) { cur = null; continue; }
      if (cur) cur.push({ x: kept[0].bx, y: kept[0].by, p: b.p });
      else cur = [{ x: kept[0].ax, y: kept[0].ay, p: a.p }, { x: kept[0].bx, y: kept[0].by, p: b.p }];
      if (kept.length > 1) {
        /* 圆咬在这一段的中间：当前这条到此为止，第二截另起一条 */
        runs.push(cur);
        cur = [{ x: kept[1].ax, y: kept[1].ay, p: a.p }, { x: kept[1].bx, y: kept[1].by, p: b.p }];
      }
    }
    if (cur) runs.push(cur);
    return runs.filter(function (rn) { return rn.length >= 2; });
  }

  /* 把一笔"看得见的墨"拆成若干条折线（世界坐标）。
     手写笔迹本身就是一条折线；图形按**轮廓**拆 —— 箭头是"杆 + 两支头"，矩形是四条边，
     椭圆是采样成的一圈。这样擦除对图形和手写用同一套算法，不用写两遍。 */
  function strokePolylines(s) {
    var pts = s.points || [];
    if (pts.length < 2) return [];
    if (!isShapeTool(s.type)) return [pts];
    var a = pts[0], b = pts[1];
    if (s.type === 'rect') {
      var x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      var y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
      return [
        [{ x: x1, y: y1 }, { x: x2, y: y1 }],
        [{ x: x2, y: y1 }, { x: x2, y: y2 }],
        [{ x: x2, y: y2 }, { x: x1, y: y2 }],
        [{ x: x1, y: y2 }, { x: x1, y: y1 }]
      ];
    }
    if (s.type === 'ellipse') {
      var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      var rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
      var ring = [];
      for (var k = 0; k <= 48; k++) {
        var t = (k / 48) * Math.PI * 2;
        ring.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
      }
      return [ring];
    }
    var out = [[{ x: a.x, y: a.y }, { x: b.x, y: b.y }]];
    if (s.type === 'arrow') {
      var head = arrowHeadPts(a, b, s.width || 3);
      out.push([{ x: b.x, y: b.y }, head[0]]);
      out.push([{ x: b.x, y: b.y }, head[1]]);
    }
    return out;
  }

  /* 这一笔被圆咬过之后剩下的点列。
     **没被咬到返回 null**（和"被吃光了返回 []"是两回事 —— 前者原样不动，后者整笔消失）。 */
  function polylinesAfterErase(s, cx, cy, r) {
    var polys = strokePolylines(s);
    if (!polys.length) return null;
    /* 笔有粗细：墨的范围是"中心线往外 w/2"，所以判定半径要把半个笔宽算进去 */
    var tol = r + (s.width || 3) / 2;
    var out = [];
    var touched = false;
    for (var i = 0; i < polys.length; i++) {
      var pts = polys[i];
      var hit = false;
      for (var j = 0; j < pts.length - 1 && !hit; j++) {
        if (distToSegmentSq(cx, cy, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y) <= tol * tol) hit = true;
      }
      if (!hit) { out.push(pts.slice()); continue; }   // 这一条不在圆里，整条留着
      touched = true;
      var runs = clipPolyline(pts, cx, cy, tol);
      for (var k = 0; k < runs.length; k++) out.push(runs[k]);
    }
    return touched ? out : null;
  }

  /* 区域擦除：圆圈擦到哪里，哪里才没。
     和"碰到就整笔删掉"是两回事 —— 一笔被圆圈咬过之后会**断成两截**，
     断口正好落在圆的边界上。返回"改了几笔"。 */
  function eraseRegionAt(cx, cy, r) {
    var changed = 0;
    var next = [];
    for (var i = 0; i < state.strokes.length; i++) {
      var s = state.strokes[i];
      var pieces = polylinesAfterErase(s, cx, cy, r);
      if (pieces === null) { next.push(s); continue; }   // 没碰到：原样留着
      changed++;
      /* 一律造新对象，**绝不改原来那一笔** —— 撤销靠的就是"旧笔还完好" */
      for (var k = 0; k < pieces.length; k++) {
        if (pieces[k].length < 2) continue;
        next.push({
          color: s.color, width: s.width,
          highlight: s.highlight, pressured: s.pressured,
          points: pieces[k]
        });
      }
    }
    if (changed) {
      state.strokes.length = 0;
      Array.prototype.push.apply(state.strokes, next);
    }
    return changed;
  }

  /* ---------- 输入：鼠标 / 数位板 / 手指 ---------- */
  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return { sx: e.clientX - (rect.left || 0), sy: e.clientY - (rect.top || 0) };
  }
  /* 采点：把"不是真实位置"的事件挡在门外。
     用户报过一种怪相 —— 一笔画下去，先从板子最左边多射出一条长线再回到落笔处。
     原因是有 pointermove 带着不可用的坐标混进了点列：白板左侧有侧栏，画布左边缘
     在 clientX≈48 处，所以 clientX=0 不可能是真实的按压位置，直接判坏点丢掉。 */
  var badPoints = 0;
  function pointFrom(e) {
    var x = e ? e.clientX : null;
    var y = e ? e.clientY : null;
    if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) {
      badPoints++;
      return null;
    }
    if (x === 0 && y === 0) { badPoints++; return null; }
    var p = canvasPoint(e);
    var w = toWorld(p.sx, p.sy);
    w.p = typeof e.pressure === 'number' ? e.pressure : 0;
    return w;
  }
  function constrain(a, b, shift) {
    if (!shift) return b;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy) * 2) return { x: b.x, y: a.y };
    if (Math.abs(dy) > Math.abs(dx) * 2) return { x: a.x, y: b.y };
    var d = Math.min(Math.abs(dx), Math.abs(dy)) * (dx < 0 ? -1 : 1);
    return { x: a.x + d, y: a.y + (dy < 0 ? -Math.abs(d) : Math.abs(d)) };
  }

  var spaceDown = false;

  function startPan(e) {
    var p = canvasPoint(e);
    state.active = {
      mode: 'pan', id: e.pointerId,
      sx: p.sx, sy: p.sy, vx: state.view.x, vy: state.view.y
    };
  }
  function cancelActive() {
    var act = state.active;
    if (!act) return;
    state.active = null;
    if (act.mode === 'draw' && act.stroke) {
      var i = state.strokes.indexOf(act.stroke);
      if (i >= 0) state.strokes.splice(i, 1);
    }
    /* 拖动题面中途取消 → 退回原位，不留一个"拖到一半"的题面 */
    if (act.mode === 'problem') {
      state.problemAt.x = act.ax;
      state.problemAt.y = act.ay;
    }
    redraw();
  }

  function onDown(e) {
    if (state.active) return;
    if (e.pointerType === 'mouse' && typeof e.button === 'number' && e.button !== 0 && e.button !== 1) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof canvas.setPointerCapture === 'function') {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }

    if ((e.pointerType === 'mouse' && e.button === 1) || spaceDown) {
      startPan(e);
      return;
    }

    var pt = pointFrom(e);
    if (!pt) return;   /* 坐标不可用：宁可不落笔，也不画出鬼线 */

    /* 抓住题面左侧的把手 → 拖动题面，不落笔。
       为什么不整块都能拖：题面是演算区，正文上还要能圈已知条件（见 hitProblemHandle 注释）。
       判据用世界坐标：缩放 / 平移之后，把手跟着题面一起变。 */
    if (state.showProblem && hitProblemHandle(pt.x, pt.y)) {
      var cp = canvasPoint(e);
      state.active = {
        mode: 'problem', id: e.pointerId,
        sx: cp.sx, sy: cp.sy,
        ax: state.problemAt.x, ay: state.problemAt.y
      };
      syncUI();
      return;
    }

    if (state.tool === 'eraser') {
      /* 记下"这一拖之前板上有哪些笔"，松手时把前后两个数组一起交给撤销栈 */
      state.active = { mode: 'erase', id: e.pointerId, before: state.strokes.slice(), changed: 0 };
      state.active.changed += eraseRegionAt(pt.x, pt.y, state.eraser / state.view.scale);
      scheduleRedraw();
      syncUI();
      return;
    }

    if (isShapeTool(state.tool)) {
      var shape = {
        type: state.tool,
        color: state.color,
        width: state.width,
        points: [{ x: pt.x, y: pt.y }, { x: pt.x, y: pt.y }]
      };
      state.active = { mode: 'draw', id: e.pointerId, stroke: shape, shape: true };
      state.strokes.push(shape);
      scheduleRedraw();
      syncUI();
      return;
    }

    var stroke = {
      color: state.color,
      width: state.tool === 'highlighter' ? HIGHLIGHT_WIDTH : state.width,
      highlight: state.tool === 'highlighter',
      pressured: state.tool !== 'highlighter' && e.pointerType === 'pen' && pt.p > 0,
      points: [pt]
    };
    state.active = { mode: 'draw', id: e.pointerId, stroke: stroke, shape: false };
    state.strokes.push(stroke);
    drawStroke(stroke);
    syncUI();
  }

  function drawTail(stroke) {
    var pts = stroke.points;
    var n = pts.length;
    if (n < 2) return;
    var i = n - 2;
    var p0 = pts[i > 0 ? i - 1 : 0];
    var p1 = pts[i];
    var p2 = pts[i + 1];
    var start = i === 0 ? p1 : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    var end = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    ctx.save();
    /* 这里是拖动途中的增量绘制，不在 redraw() 的管线里 —— 变换必须自己设。
       少了这一行，墨就会按设备像素画出来：位置偏、线也变粗，松手后才被纠正。 */
    worldTransform();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    if (stroke.highlight) ctx.globalAlpha = theme().highlightAlpha;
    ctx.lineWidth = strokeWidthFor(stroke, p1, p2);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(p1.x, p1.y, end.x, end.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function onMove(e) {
    /* 笔尖 / 橡皮的圆圈要跟着鼠标走，无论有没有按下去 —— 所以这一步放在最前面，
       别被下面的分支挡住（按着笔拖的时候也要跟）。 */
    var sp = canvasPoint(e);
    state.tipAt = { x: sp.sx, y: sp.sy };
    if (state.tool === 'pen' || state.tool === 'highlighter' || state.tool === 'eraser') scheduleRedraw();
    var act = state.active;
    if (!act || act.id !== e.pointerId) {
      /* 没落笔时，pointermove 只负责两件事：底要不要浮现、光标要不要变成"可抓" */
      if (!act) {
        var hp = pointFrom(e);
        if (hp) {
          var onProblem = state.showProblem && hitProblem(hp.x, hp.y);
          setProblemHover(onProblem);
          setProblemGripHot(onProblem && hitProblemHandle(hp.x, hp.y));
        }
      }
      return;
    }
    if (typeof e.preventDefault === 'function') e.preventDefault();

    if (act.mode === 'pan') {
      var sp = canvasPoint(e);
      state.view.x = act.vx + (sp.sx - act.sx);
      state.view.y = act.vy + (sp.sy - act.sy);
      scheduleRedraw();
      return;
    }

    if (act.mode === 'problem') {
      /* 屏幕位移除以 scale 才是世界位移：放大 2 倍时，手上拖 100px，题面只该挪 50 个世界单位 */
      var pp = canvasPoint(e);
      state.problemAt.x = act.ax + (pp.sx - act.sx) / state.view.scale;
      state.problemAt.y = act.ay + (pp.sy - act.sy) / state.view.scale;
      /* 题面跟着手走，指针就一直在它里面 —— 拖动期间让那层底保持浮现，看得见自己搬的是什么 */
      setProblemHover(true);
      scheduleRedraw();
      return;
    }

    /* 有的浏览器会返回**空数组**（而不是 null）—— 空数组是真值，会把后面的 `|| [e]` 短路掉，
       于是这一次的坐标被无声丢掉，笔迹中间缺一段。空数组时退回事件本身。 */
    var coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    var events = (coalesced && coalesced.length) ? coalesced : [e];

    if (act.mode === 'erase') {
      var r = state.eraser / state.view.scale;
      for (var i = 0; i < events.length; i++) {
        var pe = pointFrom(events[i]);
        if (!pe) continue;
        act.changed += eraseRegionAt(pe.x, pe.y, r);
      }
      scheduleRedraw();
      syncUI();
      return;
    }

    if (act.shape) {
      var last = events[events.length - 1];
      var q = pointFrom(last);
      if (!q) return;
      var c = constrain(act.stroke.points[0], q, e.shiftKey);
      act.stroke.points[1] = c;
      scheduleRedraw();
      return;
    }

    var changed = false;
    for (var j = 0; j < events.length; j++) {
      var p2 = pointFrom(events[j]);
      if (!p2) continue;
      var pts = act.stroke.points;
      var tail = pts[pts.length - 1];
      if (Math.abs(p2.x - tail.x) < 0.3 / state.view.scale && Math.abs(p2.y - tail.y) < 0.3 / state.view.scale) continue;
      pts.push(p2);
      changed = true;
    }
    if (changed) drawTail(act.stroke);
  }

  function onUp(e) {
    var act = state.active;
    if (!act || act.id !== e.pointerId) return;
    state.active = null;
    if (typeof canvas.releasePointerCapture === 'function') {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }

    if (act.mode === 'pan') {
      redraw();
      return;
    }
    if (act.mode === 'problem') {
      /* 挪位置不算一次编辑：不进撤销栈（撤销是给笔画和擦除用的）。
         位置也不写 localStorage —— 用户没要求记住它，多一个持久化字段就多一处迁移。 */
      redraw();
      syncUI();
      return;
    }
    if (act.mode === 'erase') {
      /* 一拖算**一次**操作：松手时把"这一拖之前 / 之后"两个快照交给撤销栈，
         所以撤销是整拖撤销，不会一格一格往回跳。 */
      if (act.changed) {
        commitAction({
          type: 'region', label: '擦除',
          before: act.before, after: state.strokes.slice()
        });
      }
      scheduleRedraw();
      syncUI();
      return;
    }

    var pts = act.stroke.points;
    if (act.shape) {
      var a = pts[0];
      var b = pts[1];
      if (Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) < 1) {
        var i = state.strokes.indexOf(act.stroke);
        if (i >= 0) state.strokes.splice(i, 1);
        redraw();
        return;
      }
    } else if (pts.length === 1) {
      pts.push({ x: pts[0].x + 0.01, y: pts[0].y, p: pts[0].p });
    }
    commitAction({ type: 'draw', stroke: act.stroke, label: act.shape ? '图形' : '笔画' });
    redraw();
  }

  function onWheel(e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    var v = state.view;
    var cx = canvasPoint(e);
    if (e.ctrlKey || e.metaKey) {
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(cx.sx, cx.sy, Math.pow(1.0018, -dy));
    } else {
      var dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      var dyy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      v.x -= dx;
      v.y -= dyy;
      scheduleRedraw();
    }
  }

  /* 双指缩放 / 平移（触控） */
  var pinch = null;
  function touchInfo(e) {
    var t0 = e.touches[0];
    var t1 = e.touches[1];
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      d: Math.sqrt(Math.pow(t1.clientX - t0.clientX, 2) + Math.pow(t1.clientY - t0.clientY, 2)),
      cx: (t0.clientX + t1.clientX) / 2 - (rect.left || 0),
      cy: (t0.clientY + t1.clientY) / 2 - (rect.top || 0)
    };
  }
  function onTouchStart(e) {
    if (e.touches && e.touches.length === 2) {
      cancelActive();
      pinch = touchInfo(e);
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  function onTouchMove(e) {
    if (!(e.touches && e.touches.length === 2)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    var info = touchInfo(e);
    if (!pinch) { pinch = info; return; }
    var v = state.view;
    if (pinch.d > 0) {
      var k = clamp(info.d / pinch.d, 0.2, 5);
      var next = clamp(v.scale * k, MIN_SCALE, MAX_SCALE);
      var real = next / v.scale;
      v.x = info.cx - (pinch.cx - v.x) * real;
      v.y = info.cy - (pinch.cy - v.y) * real;
      v.scale = next;
    } else {
      v.x += info.cx - pinch.cx;
      v.y += info.cy - pinch.cy;
    }
    pinch = info;
    scheduleRedraw();
    syncUI();
  }
  function onTouchEnd(e) {
    if (!e.touches || e.touches.length < 2) pinch = null;
  }

  if (typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    /* 鼠标离开画布时把题面那层底收掉，别留在板上 */
    canvas.addEventListener('pointerleave', function () {
      setProblemGripHot(false);
      setProblemHover(false);
      /* 鼠标离开画布，笔尖那个圈也要收掉，别留在板边上 */
      if (state.tipAt) { state.tipAt = null; scheduleRedraw(); }
    });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    /* 台阶框：拖动与书写各挂各的（序号闭包进去），挂在按钮之前先建好桩 */
    initStepDrag();

    /* 「分析 / 答案」两个按钮：先只有按钮，内容在 Task 3 / Task 4 接进来 */
    var actsAnalysis = byId('wb-act-analysis');
    if (actsAnalysis && actsAnalysis.addEventListener) {
      actsAnalysis.addEventListener('click', function () { toggleAnalysis(); });
    }
    var actsAnswer = byId('wb-act-answer');
    if (actsAnswer && actsAnswer.addEventListener) {
      actsAnswer.addEventListener('click', function () { toggleAnswer(); });
    }
    /* 第三个按钮：手写转文字 */
    var actsInk = byId('wb-act-transcribe');
    if (actsInk && actsInk.addEventListener) {
      actsInk.addEventListener('click', function () { toggleTranscribe(); });
    }
    var inkClose = byId('wb-ink-close');
    if (inkClose && inkClose.addEventListener) {
      inkClose.addEventListener('click', function () { toggleTranscribe(); });
    }
    /* 重新识别：再跑一遍（会覆盖这一题存过的文字） */
    var inkAgain = byId('wb-ink-again');
    if (inkAgain && inkAgain.addEventListener) {
      inkAgain.addEventListener('click', function () { runTranscribe(); redraw(); });
    }
    /* 移除：删掉这一题的记录，面板跟着收起 */
    var inkClear = byId('wb-ink-clear');
    if (inkClear && inkClear.addEventListener) {
      inkClear.addEventListener('click', function () {
        inkDrop(state.problemId);
        state.ink.steps = [];
        state.ink.source = '';
        state.ink.notice = '';
        state.ink.open = false;
        inkRender();
        redraw();
      });
    }
    /* 文字那一格是 contenteditable：用委托接输入，输入只写数据、不重画 ——
       重画会把 DOM 重建，光标就断了（正打字时最烦人的那种 bug）。 */
    var inkSteps = byId('wb-ink-steps');
    if (inkSteps && inkSteps.addEventListener) {
      inkSteps.addEventListener('input', function (e) {
        var t = e && e.target;
        if (!t || !t.getAttribute) return;
        var i = parseInt(t.getAttribute('data-step'), 10);
        if (!(i >= 0) || !state.ink.steps[i]) return;
        state.ink.steps[i].text = String(t.textContent == null ? '' : t.textContent);
        inkSave(state.ink.problemId || state.problemId, state.ink.steps);
      });
    }
    canvas.addEventListener('touchcancel', onTouchEnd);
    if (wrap && wrap.addEventListener) {
      wrap.addEventListener('pointerdown', function (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
      });
    }
  }

  /* ---------- 题库 ---------- */
  function problems() {
    return Array.isArray(window.WB_PROBLEMS) ? window.WB_PROBLEMS : [];
  }
  function findProblem(id) {
    var all = problems();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  var bank = { book: '全部', q: '' };

  function renderBank() {
    var list = byId('wb-bank-list');
    if (!list) return;
    var q = bank.q.toLowerCase();
    var items = problems().filter(function (p) {
      if (bank.book !== '全部' && p.book !== bank.book) return false;
      if (!q) return true;
      return (p.text + ' ' + p.chapter + ' ' + p.book).toLowerCase().indexOf(q) >= 0;
    });
    list.innerHTML = items.length
      ? items.map(function (p) {
          var active = p.id === state.problemId;
          return '<button type="button" class="wb-item' + (active ? ' is-active' : '') + '"' +
            ' data-wb-pick="' + esc(p.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
            '<span class="wb-item__tag">' + esc(p.book) + ' · ' + esc(p.chapter) + '</span>' +
            '<span class="wb-item__text">' + esc(p.text) + '</span>' +
            '<span class="wb-item__cue">上板</span>' +
            '</button>';
        }).join('')
      : '<p class="wb-empty">没有匹配的题目</p>';
    var count = byId('wb-bank-count');
    if (count) count.textContent = items.length + ' 题';
  }

  function cardData() {
    var p = state.problemId ? findProblem(state.problemId) : null;
    if (state.external && state.external.text) return state.external;
    if (p) return { text: p.text, tag: p.book + ' · ' + p.chapter, extra: '' };
    return null;
  }

  /* 「回到知识点」：把当前题面的来源当成一个点名，回到图谱定位那个条目。
     「七上 · 有理数」这种只取最后一段；「考点 1 整式的概念」这种去掉考点序号，
     剩下的才是图谱里检索得到的名字。 */
  function kpKeyword(data) {
    var raw = data && data.tag ? String(data.tag).trim() : '';
    if (!raw) return '';
    var parts = raw.split('·');
    var name = parts[parts.length - 1].trim();
    name = name.replace(/^考点\s*\d+\s*/, '').trim();
    name = name.replace(/^第[一二三四五六七八九十百零〇\d]+[章节]\s*/, '').trim();
    return name;
  }

  function kpTargetUrl(data) {
    var key = kpKeyword(data);
    return key ? 'graph.html?q=' + encodeURIComponent(key) : 'graph.html';
  }

  function jumpToKp() {
    var url = kpTargetUrl(cardData());
    try { window.location.href = url; } catch (e) { /* 忽略 */ }
    return url;
  }

  function renderCard() {
    var data = cardData();
    var meta = byId('wb-problem-meta');
    var text = byId('wb-problem-text');
    var extra = byId('wb-problem-extra');
    if (meta) meta.textContent = data ? (data.tag || '') : '';
    if (text) text.textContent = data ? data.text : '';
    if (extra) extra.textContent = data ? (data.extra || '') : '';
    var toggle = byId('wb-problem-toggle');
    if (toggle) toggle.disabled = !data;
    var jump = byId('wb-jump-kp');
    if (jump) {
      var key = kpKeyword(data);
      jump.setAttribute('data-wb-tip', key ? '回到知识点 · ' + key : '回到知识点');
    }
    redraw();
    return data;
  }

  function applyProblem(id) {
    var p = id ? findProblem(id) : null;
    state.problemId = p ? p.id : null;
    state.external = null;
    renderCard();
    renderBank();
    persist();
    syncUI();
    inkSyncProblem();       // 面板开着就换成这一题的记录，别让上一题的文字留在板上
    return p;
  }

  function applyExternal(data) {
    state.external = data && data.text
      ? { text: String(data.text), tag: String(data.tag || ''), extra: String(data.extra || '') }
      : null;
    if (state.external) state.problemId = null;
    renderCard();
    renderBank();
    persist();
    syncUI();
    inkSyncProblem();
    return state.external;
  }

  function readQuery() {
    var out = {};
    var s = '';
    try { s = (window.location && window.location.search) || ''; } catch (e) { s = ''; }
    if (!s) return out;
    s.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? '' : kv.slice(i + 1);
      try {
        k = decodeURIComponent(k.replace(/\+/g, ' '));
        v = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch (e) { /* 原样 */ }
      if (k) out[k] = v;
    });
    return out;
  }

  function pickProblem(id) {
    return applyProblem(state.problemId === id ? null : id);
  }

  /* ---------- 工具与界面 ---------- */
  /* 工具属于哪一组；撤销 / 清空这类动作按钮不属于任何组 */
  function groupOf(tool) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (TOOL_GROUPS[GROUPS[i]].indexOf(tool) >= 0) return GROUPS[i];
    }
    return null;
  }
  /* 格子上该显示哪个工具：当前工具在这一组就显示它，否则显示这一组上次用过的那个 */
  function groupSlot(group) {
    var list = TOOL_GROUPS[group] || [];
    if (list.indexOf(state.tool) >= 0) return state.tool;
    var last = state.groupLast ? state.groupLast[group] : null;
    return list.indexOf(last) >= 0 ? last : list[0];
  }
  function flyoutGroup() {
    for (var i = 0; i < GROUPS.length; i++) {
      var box = byId('wb-flyout-' + GROUPS[i]);
      if (box && box.hidden === false) return GROUPS[i];
    }
    return null;
  }
  function setFlyout(group) {
    GROUPS.forEach(function (g) {
      var open = g === group;
      var box = byId('wb-flyout-' + g);
      var btn = byId('wb-group-' + g);
      if (box) {
        if (open) {
          if (box.removeAttribute) box.removeAttribute('hidden');
          box.hidden = false;
        } else {
          if (box.setAttribute) box.setAttribute('hidden', 'hidden');
          box.hidden = true;
        }
      }
      if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  function closeFlyout() {
    if (flyoutGroup()) setFlyout(null);
  }
  function toggleFlyout(group) {
    if (flyoutGroup() === group) { setFlyout(null); return; }
    setPopover(false);      // 两块浮层只留一块，别叠在一起
    setFlyout(group);
  }
  /* 把每个格子刷成"当前工具 / 上次用的工具"，所在的组高亮 */
  function paintGroups() {
    GROUPS.forEach(function (g) {
      var btn = byId('wb-group-' + g);
      if (!btn) return;
      var on = groupOf(state.tool) === g;
      if (btn.setAttribute) {
        btn.setAttribute('data-active', groupSlot(g));
        btn.setAttribute('title', GROUP_TITLES[g]);
        btn.setAttribute('aria-label', GROUP_TITLES[g] + (on ? '（当前）' : ''));
      }
      if (btn.classList) {
        if (on) btn.classList.add('is-on');
        else btn.classList.remove('is-on');
      }
    });
  }

  function setTool(tool) {
    if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'eraser' && !isShapeTool(tool)) tool = 'pen';
    state.tool = tool;
    closeFlyout();          // 从浮层里选完就把浮层收起来
    persist();
    syncUI();               // 光标由 syncUI 收口，这里不用再单独调一次
  }
  function setColor(value) {
    var hit = COLORS.filter(function (c) { return c.value === value; })[0];
    if (hit) {
      state.color = hit.value;
      if (state.tool === 'eraser') state.tool = 'pen';
    }
    persist();
    syncUI();
  }
  function setWidth(value) {
    var v = parseFloat(value);
    WIDTHS.forEach(function (w) { if (Math.abs(w.value - v) < 0.01) state.width = w.value; });
    if (state.tool === 'eraser') state.tool = 'pen';
    persist();
    syncUI();
  }
  function setEraser(value) {
    var v = parseFloat(value);
    ERASERS.forEach(function (e) { if (Math.abs(e.value - v) < 0.01) state.eraser = e.value; });
    state.tool = 'eraser';
    persist();
    syncUI();
  }
  function setGrid(on) {
    state.grid = !!on;
    redraw();
    persist();
    syncUI();
  }
  /* 选网格疏密。决定 #4：顺手把网格打开 ——
     网格关着时选一档却"屏幕上什么都没变"，会被当成没生效。
     这和既有习惯一致：正在用橡皮时点颜色，会自动切回画笔。 */
  function setGridSize(value) {
    var v = parseFloat(value);
    var hit = null;
    GRID_SIZES.forEach(function (g) { if (Math.abs(g.value - v) < 0.01) hit = g; });
    if (!hit) return false;                 // 不在梯子里的值一律不认
    state.gridSize = hit.value;
    if (!state.grid) state.grid = true;     // 顺手打开
    redraw();
    persist();
    syncUI();
    toast('网格 · ' + hit.label);
    return true;
  }
  function gridSizeKey() {
    var s = '';
    GRID_SIZES.forEach(function (g) { if (Math.abs(g.value - state.gridSize) < 0.01) s = g.label; });
    return s || '中';
  }
  function setShowProblem(on) {
    state.showProblem = !!on;
    redraw();
    persist();
    syncUI();
  }
  function popoverOpen() {
    var pop = byId('wb-pop');
    return !!pop && pop.hidden === false;
  }
  function setPopover(open) {
    var pop = byId('wb-pop');
    var btn = byId('wb-settings');
    if (open) setFlyout(null);      // 打开设置面板就先收起工具组浮层
    if (pop) {
      if (open) {
        if (pop.removeAttribute) pop.removeAttribute('hidden');
        pop.hidden = false;
      } else {
        if (pop.setAttribute) pop.setAttribute('hidden', 'hidden');
        pop.hidden = true;
      }
    }
    if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ---------- 悬浮题库面板：工具条按钮开关 + 拖拽 ---------- */
  function bankOpen() {
    var el = byId('wb-bank');
    return !!el && el.hidden === false;
  }
  function setBank(open) {
    var el = byId('wb-bank');
    var btn = byId('wb-bank-toggle');
    if (el) {
      if (open) {
        if (el.removeAttribute) el.removeAttribute('hidden');
        el.hidden = false;
      } else {
        if (el.setAttribute) el.setAttribute('hidden', 'hidden');
        el.hidden = true;
      }
    }
    press(btn, !!open);
  }
  /* 面板坐标：优先取已写入的行内坐标，其次取浏览器算出的偏移，最后退回默认值 */
  function panelPos(el) {
    var x = el && el.style ? parseFloat(el.style.left) : NaN;
    var y = el && el.style ? parseFloat(el.style.top) : NaN;
    if (!isFinite(x)) x = el && typeof el.offsetLeft === 'number' ? el.offsetLeft : 20;
    if (!isFinite(y)) y = el && typeof el.offsetTop === 'number' ? el.offsetTop : 40;
    return { x: x, y: y };
  }
  /* 把面板压在画板范围内，不允许拖出屏幕 */
  function clampPanel(x, y) {
    var el = byId('wb-bank');
    var w = el && typeof el.offsetWidth === 'number' && el.offsetWidth ? el.offsetWidth : 300;
    var h = el && typeof el.offsetHeight === 'number' && el.offsetHeight ? el.offsetHeight : 260;
    var maxX = Math.max(8, wrap.clientWidth - w - 8);
    var maxY = Math.max(8, wrap.clientHeight - h - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }
  var panelDrag = null;
  function onPanelDown(e) {
    var el = byId('wb-bank');
    var head = byId('wb-bank-head');
    if (!el || !el.style) return;
    var t = e.target;
    if (t && t.closest && t.closest('.wb-bank__close')) return;
    var p = panelPos(el);
    panelDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: p.x, y: p.y };
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.bottom = 'auto';
    if (el.classList) el.classList.add('is-dragging');
    if (head && typeof head.setPointerCapture === 'function') {
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  function onPanelMove(e) {
    if (!panelDrag || e.pointerId !== panelDrag.id) return;
    var el = byId('wb-bank');
    if (!el || !el.style) return;
    var p = clampPanel(panelDrag.x + (e.clientX - panelDrag.sx), panelDrag.y + (e.clientY - panelDrag.sy));
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  function onPanelUp(e) {
    if (!panelDrag) return;
    if (e && e.pointerId !== undefined && e.pointerId !== panelDrag.id) return;
    var head = byId('wb-bank-head');
    var el = byId('wb-bank');
    if (head && typeof head.releasePointerCapture === 'function' && e && e.pointerId !== undefined) {
      try { head.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    panelDrag = null;
    if (el && el.classList) el.classList.remove('is-dragging');
  }
  function initPanelDrag() {
    var head = byId('wb-bank-head');
    if (!head || !head.addEventListener) return;
    head.addEventListener('pointerdown', onPanelDown);
    head.addEventListener('pointermove', onPanelMove);
    head.addEventListener('pointerup', onPanelUp);
    head.addEventListener('pointercancel', onPanelUp);
  }
  /* 画板尺寸变了（进/出全屏、窗口缩放）就把面板收回可视范围 */
  function reflowPanel() {
    var el = byId('wb-bank');
    if (!el || !el.style) return;
    if (!el.style.left && !el.style.top) return;
    var x = parseFloat(el.style.left);
    var y = parseFloat(el.style.top);
    if (!isFinite(x)) x = 20;
    if (!isFinite(y)) y = 40;
    var p = clampPanel(x, y);
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
  }

  /* 全屏统一由侧栏的「全屏」按钮负责（ide-shell.js），
     白板这边只做一件事：全屏切换后把画布按新尺寸重排。 */
  function zoomLabel() {
    var el = byId('wb-zoom-level');
    if (el) el.textContent = Math.round(state.view.scale * 100) + '%';
  }

  function press(el, on) {
    if (!el) return;
    if (el.classList) {
      if (on) el.classList.add('is-on');
      else el.classList.remove('is-on');
    }
    if (el.setAttribute) el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncUI() {
    press(byId('wb-pen'), state.tool === 'pen');
    press(byId('wb-highlighter'), state.tool === 'highlighter');
    press(byId('wb-eraser'), state.tool === 'eraser');
    press(byId('wb-line'), state.tool === 'line');
    press(byId('wb-arrow'), state.tool === 'arrow');
    press(byId('wb-rect'), state.tool === 'rect');
    press(byId('wb-ellipse'), state.tool === 'ellipse');
    press(byId('wb-grid'), state.grid);
    press(byId('wb-problem-toggle'), state.showProblem);
    press(byId('wb-bank-toggle'), bankOpen());
    paintGroups();

    var undoBtn = byId('wb-undo');
    if (undoBtn) undoBtn.disabled = !state.actions.length;
    var redoBtn = byId('wb-redo');
    if (redoBtn) redoBtn.disabled = !state.redo.length;

    var dot = byId('wb-current-color');
    if (dot && dot.style) dot.style.background = state.color;

    var themeBox = byId('wb-themes');
    if (themeBox && themeBox.querySelectorAll) {
      Array.prototype.forEach.call(themeBox.querySelectorAll('[data-wb-theme]'), function (b) {
        press(b, b.getAttribute('data-wb-theme') === state.theme);
      });
    }

    var colorBox = byId('wb-colors');
    if (colorBox && colorBox.querySelectorAll) {
      Array.prototype.forEach.call(colorBox.querySelectorAll('[data-wb-color]'), function (b) {
        press(b, b.getAttribute('data-wb-color') === state.color);
      });
    }
    var widthBox = byId('wb-widths');
    if (widthBox && widthBox.querySelectorAll) {
      Array.prototype.forEach.call(widthBox.querySelectorAll('[data-wb-width]'), function (b) {
        press(b, Math.abs(parseFloat(b.getAttribute('data-wb-width')) - state.width) < 0.01);
      });
    }
    var eraserBox = byId('wb-erasers');
    if (eraserBox && eraserBox.querySelectorAll) {
      Array.prototype.forEach.call(eraserBox.querySelectorAll('[data-wb-eraser]'), function (b) {
        press(b, Math.abs(parseFloat(b.getAttribute('data-wb-eraser')) - state.eraser) < 0.01);
      });
    }
    var gridBox = byId('wb-grids');
    if (gridBox && gridBox.querySelectorAll) {
      Array.prototype.forEach.call(gridBox.querySelectorAll('[data-wb-grid]'), function (b) {
        press(b, Math.abs(parseFloat(b.getAttribute('data-wb-grid')) - state.gridSize) < 0.01);
      });
    }
    /* 工具条那个网格按钮仍是纯开关，但气泡跟上当前档：不开设置也知道现在是哪档 */
    var gridBtn = byId('wb-grid');
    if (gridBtn && gridBtn.setAttribute) {
      gridBtn.setAttribute('data-wb-tip', '网格 · ' + gridSizeKey() + ' G');
    }
    var stat = byId('wb-stat');
    if (stat) stat.textContent = '笔画 ' + state.strokes.length + ' · 可撤销 ' + state.actions.length;
    zoomLabel();

    /* 光标归位放这里，不放在 setTool 里 ——
       `#wb-canvas` 的 CSS 是 `cursor:crosshair`，只要没人把它显式改成 none，
       十字就一直生效。而"刚打开页面、还没点过任何工具按钮"这一刻根本不会走 setTool
       （工具是从存储恢复或取默认值），于是画笔选着、十字却挂在屏幕上。
       syncUI 在启动末尾和每次状态变化后都会走一遍，挂这儿才能保证不漏。 */
    syncCursor();
  }

  /* 某个颜色在给定配色里是第几支；不在里面返回 -1 */
  function indexOfColor(list, value) {
    for (var i = 0; i < list.length; i++) { if (list[i].value === value) return i; }
    return -1;
  }

  /* 让"当前这套笔"与当前主题一致。
     两个时机必须走一遍：启动把主题从存储恢复之后、以及换板之后。
     顺手刷新测试钩子上的快照 —— __WB__.COLORS 是对象引用，不会自己跟着变。 */
  function syncPalette() {
    COLORS = theme().colors;
    if (typeof window !== 'undefined' && window.__WB__) {
      window.__WB__.COLORS = COLORS;
      if (window.__WB__.config) window.__WB__.config.COLORS = COLORS;
    }
    return COLORS;
  }

  /* 换板。
     笔色按**序号**平移 —— 唯一不会让人意外的映射（否则"我选的红色怎么变绿了"）。
     板上**已有的每一笔也一起平移**：不平移的话，切到黑板时原来的深色墨迹直接看不见，
     那不叫"换了块板"，那叫"把我的推导弄没了"。只动颜色，点坐标 / 笔粗 / 图形类型一律不动。 */
  /* 板面主题与「阅读与显示」里的配色是**同一个真值**（见阅读与显示设计 §2 #9）：
     在板里切板面 = 整站跟着切；在设置里选配色 = 板面跟着换。
     两个开关各写各的状态迟早会打架，所以只留一份。
     老数据照顾：本机从没在设置里选过配色时，以白板这份旧记录为准，并把它写回设置。 */
  var DISPLAY_TO_BOARD = { light: 'white', mid: 'mid', dark: 'dark' };
  var BOARD_TO_DISPLAY = { white: 'light', mid: 'mid', dark: 'dark' };

  function displayApi() {
    return (typeof window !== 'undefined' && window.WK_DISPLAY) ? window.WK_DISPLAY : null;
  }
  function storedDisplayTheme() {
    var api = displayApi();
    if (!api) return null;
    var v = null;
    try { v = window.localStorage.getItem(api.keys.theme); } catch (err) { v = null; }
    return api.themes.indexOf(v) >= 0 ? v : null;
  }
  function pushThemeToDisplay(boardKey) {
    var api = displayApi();
    if (!api) return;
    /* 只写主题，不碰字号 —— 白板管不着字号 */
    api.set({ theme: BOARD_TO_DISPLAY[boardKey] || 'light' });
  }
  function reconcileTheme() {
    var api = displayApi();
    if (!api) return;
    var chosen = storedDisplayTheme();
    if (chosen) {
      var mapped = DISPLAY_TO_BOARD[chosen];
      if (mapped && mapped !== state.theme) setTheme(mapped);
    } else {
      pushThemeToDisplay(state.theme);
    }
  }

  function setTheme(key) {
    if (THEME_KEYS.indexOf(key) < 0) return false;
    if (key === state.theme) return true;
    var from = theme().colors;
    var to = THEMES[key].colors;
    state.theme = key;
    /* 板面就是整站的配色：切一次，设置页那一栏也跟着亮（§2 #9） */
    pushThemeToDisplay(key);

    var ci = indexOfColor(from, state.color);
    if (ci >= 0 && to[ci]) state.color = to[ci].value;
    for (var i = 0; i < state.strokes.length; i++) {
      var s = state.strokes[i];
      var si = indexOfColor(from, s.color);
      if (si >= 0 && to[si]) s.color = to[si].value;
    }

    syncPalette();
    /* 屏幕上的浮层（按钮 / 台阶框 / 答案块）**保持浅色** —— 它们是界面，不是板面。
       深色板上"深板 + 浅浮层"是常见做法（像暗色画布配浅色面板）。
       这里只把板面色同步给外壳的 CSS 变量，让画布以外的那一圈也跟着变。 */
    if (wrap && wrap.style && wrap.style.setProperty) wrap.style.setProperty('--wb-board', theme().board);

    buildPickers();
    syncUI();
    redraw();
    persist();
    return true;
  }

  function buildPickers() {
    var themeBox = byId('wb-themes');
    if (themeBox) {
      themeBox.innerHTML = THEME_KEYS.map(function (k) {
        var t = THEMES[k];
        return '<button type="button" class="wb-theme" data-wb-theme="' + k + '"' +
          ' title="' + esc(t.label) + '" aria-label="板面：' + esc(t.label) + '" aria-pressed="false">' +
          '<span class="wb-theme__chip" style="background:' + esc(t.board) + '"></span>' +
          esc(t.label) + '</button>';
      }).join('');
    }
    var colorBox = byId('wb-colors');
    if (colorBox) {
      colorBox.innerHTML = COLORS.map(function (c) {
        return '<button type="button" class="wb-swatch" data-wb-color="' + esc(c.value) + '"' +
          ' style="--wb-swatch:' + esc(c.value) + '" title="' + esc(c.label) + '"' +
          ' aria-label="' + esc(c.label) + '" aria-pressed="false"><span></span></button>';
      }).join('');
    }
    var widthBox = byId('wb-widths');
    if (widthBox) {
      widthBox.innerHTML = WIDTHS.map(function (w) {
        return '<button type="button" class="wb-size" data-wb-width="' + w.value + '"' +
          ' data-wb-tip="笔粗 · ' + esc(w.label) + '" aria-label="笔粗' + esc(w.label) + '" aria-pressed="false">' +
          '<span class="wb-size__dot" style="width:' + Math.max(4, Math.round(w.value * 1.7)) + 'px;height:' +
          Math.max(4, Math.round(w.value * 1.7)) + 'px"></span></button>';
      }).join('');
    }
    var eraserBox = byId('wb-erasers');
    if (eraserBox) {
      eraserBox.innerHTML = ERASERS.map(function (e) {
        return '<button type="button" class="wb-size" data-wb-eraser="' + e.value + '"' +
          ' data-wb-tip="橡皮 · ' + esc(e.label) + '" aria-label="橡皮' + esc(e.label) + '" aria-pressed="false">' +
          '<span class="wb-size__ring" style="width:' + Math.max(7, Math.round(e.value * 0.42)) + 'px;height:' +
          Math.max(7, Math.round(e.value * 0.42)) + 'px"></span></button>';
      }).join('');
    }
    /* 网格疏密：预览方块用 CSS 渐变画格子，格子大小写在各档自己的规则里。
       方向必须是"数值越小、格子越密"，写反了这条就成了误导。 */
    var gridBox = byId('wb-grids');
    if (gridBox) {
      gridBox.innerHTML = GRID_SIZES.map(function (g) {
        return '<button type="button" class="wb-grid" data-wb-grid="' + g.value + '"' +
          ' data-wb-tip="网格 · ' + esc(g.label) + '" aria-label="网格疏密' + esc(g.label) + '" aria-pressed="false">' +
          '<span class="wb-grid__chip" aria-hidden="true"></span>' + esc(g.label) + '</button>';
      }).join('');
    }
  }

  function bind(id, fn) {
    var el = byId(id);
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('click', function (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        fn();
      });
    }
  }

  function bindDelegates() {
    var list = byId('wb-bank-list');
    if (list && list.addEventListener) {
      list.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-pick]') : null;
        if (btn) pickProblem(btn.getAttribute('data-wb-pick'));
      });
    }
    var themeBox = byId('wb-themes');
    if (themeBox && themeBox.addEventListener) {
      themeBox.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-theme]') : null;
        if (btn) setTheme(btn.getAttribute('data-wb-theme'));
      });
    }
    /* 设置页改了配色（同一个真值）时板面跟着换。自己这边切板面也会走到这里，
       但那时 key 已经等于 state.theme，setTheme 会直接返回，不会转圈。 */
    if (document.addEventListener) {
      document.addEventListener('wk:display', function (e) {
        var t = e && e.detail && e.detail.theme;
        var boardKey = t ? DISPLAY_TO_BOARD[t] : null;
        if (boardKey && boardKey !== state.theme) setTheme(boardKey);
      });
    }
    var colorBox = byId('wb-colors');
    if (colorBox && colorBox.addEventListener) {
      colorBox.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-color]') : null;
        if (btn) setColor(btn.getAttribute('data-wb-color'));
      });
    }
    var widthBox = byId('wb-widths');
    if (widthBox && widthBox.addEventListener) {
      widthBox.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-width]') : null;
        if (btn) setWidth(btn.getAttribute('data-wb-width'));
      });
    }
    var eraserBox = byId('wb-erasers');
    if (eraserBox && eraserBox.addEventListener) {
      eraserBox.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-eraser]') : null;
        if (btn) setEraser(btn.getAttribute('data-wb-eraser'));
      });
    }
    var gridBox = byId('wb-grids');
    if (gridBox && gridBox.addEventListener) {
      gridBox.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-grid]') : null;
        if (btn) setGridSize(btn.getAttribute('data-wb-grid'));
      });
    }
    var filters = byId('wb-books');
    if (filters && filters.addEventListener) {
      filters.addEventListener('click', function (e) {
        var t = e.target;
        var btn = t && t.closest ? t.closest('[data-wb-book]') : null;
        if (!btn) return;
        bank.book = btn.getAttribute('data-wb-book');
        if (filters.querySelectorAll) {
          Array.prototype.forEach.call(filters.querySelectorAll('[data-wb-book]'), function (b) {
            press(b, b.getAttribute('data-wb-book') === bank.book);
          });
        }
        renderBank();
      });
    }
    var search = byId('wb-search');
    if (search && search.addEventListener) {
      search.addEventListener('input', function () {
        bank.q = search.value || '';
        renderBank();
      });
    }
  }

  var TOOL_KEYS = { b: 'pen', h: 'highlighter', e: 'eraser', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse' };

  function bindKeys() {
    if (!document.addEventListener) return;
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var k = e.key;
      var mod = e.metaKey || e.ctrlKey;
      if (mod && (k === 'z' || k === 'Z')) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      /* ⌘/Ctrl + B：开关悬浮题库面板（本页 ide-shell 已空跑，不会再抢这个快捷键） */
      if (mod && (k === 'b' || k === 'B')) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        setBank(!bankOpen());
        return;
      }
      if (k === ' ' || k === 'Spacebar') { spaceDown = true; if (typeof e.preventDefault === 'function') e.preventDefault(); return; }
      if (mod) return;
      if (k === 'Escape' || k === 'Esc') { setPopover(false); setBank(false); setFlyout(null); return; }
      if (k === '0') { resetZoom(); return; }
      if (k === '1' && e.shiftKey) { fitContent(); return; }
      var tool = TOOL_KEYS[String(k).toLowerCase()];
      if (tool) { setTool(tool); return; }
      if (k >= '1' && k <= '6') {
        var c = COLORS[Number(k) - 1];
        if (c) setColor(c.value);
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Spacebar') spaceDown = false;
    });
  }

  /* ---------- 记忆 ---------- */
  function persist() {
    var cur = groupOf(state.tool);
    if (cur) state.groupLast[cur] = state.tool;   // 让每个格子记住上次用的那一个
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        tool: state.tool,
        groupLast: { draw: state.groupLast.draw, shape: state.groupLast.shape },
        color: state.color,
        width: state.width,
        eraser: state.eraser,
        grid: state.grid,
        gridSize: state.gridSize,
        theme: state.theme,
        showProblem: state.showProblem,
        problemId: state.problemId,
        external: state.external,
        /* 分析 / 答案那一层：台阶的位置与学生写的内容都要落盘 ——
           「收起」不算清空，刷新回来还得在。 */
        analysis: {
          open: state.analysis.open,
          answerOpen: state.analysis.answerOpen,
          showNotes: state.analysis.showNotes,
          steps: state.analysis.steps.map(function (s) {
            return { wx: s.wx, wy: s.wy, text: s.text || '' };
          })
        },
        view: { scale: state.view.scale, x: state.view.x, y: state.view.y },
        strokes: state.strokes.slice(-MAX_STROKES)
      }));
    } catch (e) { /* 忽略 */ }
  }

  function restore() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { return; }
    if (!raw) return;
    var d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || typeof d !== 'object') return;
    if (typeof d.tool === 'string' && (d.tool === 'pen' || d.tool === 'highlighter' || d.tool === 'eraser' || isShapeTool(d.tool))) {
      state.tool = d.tool;
    }
    if (d.groupLast && typeof d.groupLast === 'object') {
      GROUPS.forEach(function (g) {
        if (TOOL_GROUPS[g].indexOf(d.groupLast[g]) >= 0) state.groupLast[g] = d.groupLast[g];
      });
    }
    var g0 = groupOf(state.tool);
    if (g0) state.groupLast[g0] = state.tool;
    if (typeof d.color === 'string') state.color = d.color;
    if (typeof d.width === 'number') state.width = d.width;
    if (typeof d.eraser === 'number') state.eraser = d.eraser;
    state.grid = !!d.grid;
    /* 网格疏密：不在三档里就保持默认 40，别让旧数据把板面弄成奇怪的格子 */
    if (typeof d.gridSize === 'number') {
      GRID_SIZES.forEach(function (g) {
        if (Math.abs(g.value - d.gridSize) < 0.01) state.gridSize = g.value;
      });
    }
    /* 板面主题：不在三套里就回落白板，别让旧数据把白板弄崩 */
    if (THEME_KEYS.indexOf(d.theme) >= 0) state.theme = d.theme;
    if (typeof d.showProblem === 'boolean') state.showProblem = d.showProblem;
    if (Array.isArray(d.strokes)) {
      state.strokes = d.strokes.filter(function (s) {
        return s && typeof s.color === 'string' && Array.isArray(s.points) && s.points.length;
      });
    }
    if (typeof d.problemId === 'string') state.problemId = d.problemId;
    if (d.external && typeof d.external === 'object' && d.external.text) {
      state.external = {
        text: String(d.external.text),
        tag: String(d.external.tag || ''),
        extra: String(d.external.extra || '')
      };
    }
    if (d.view && typeof d.view.scale === 'number') {
      state.view.scale = clamp(d.view.scale, MIN_SCALE, MAX_SCALE);
      state.view.x = typeof d.view.x === 'number' ? d.view.x : state.view.x;
      state.view.y = typeof d.view.y === 'number' ? d.view.y : state.view.y;
      state.viewRestored = true;
    }
  }

  /* ---------- 启动 ---------- */
  restore();
  /* 板面主题与整站配色对齐（同一份真值，见 reconcileTheme） */
  reconcileTheme();
  /* 主题是从存储恢复出来的，所以调色板要跟着对齐一次 ——
     否则刷新回来是黑板、调色板却还是浅色那六支。 */
  syncPalette();
  if (wrap && wrap.style && wrap.style.setProperty) wrap.style.setProperty('--wb-board', theme().board);
  state.freshView = !state.viewRestored;
  buildPickers();
  bindDelegates();
  bind('wb-pen', function () { setTool('pen'); });
  bind('wb-highlighter', function () { setTool('highlighter'); });
  bind('wb-eraser', function () { setTool('eraser'); });
  bind('wb-line', function () { setTool('line'); });
  bind('wb-arrow', function () { setTool('arrow'); });
  bind('wb-rect', function () { setTool('rect'); });
  bind('wb-ellipse', function () { setTool('ellipse'); });
  bind('wb-undo', function () { if (!undo()) toast('没有可撤销的操作'); });
  bind('wb-redo', function () { if (!redo()) toast('没有可重做的操作'); });
  bind('wb-clear', function () { if (!clearAll()) toast('画布已经是空的'); });
  bind('wb-grid', function () { setGrid(!state.grid); });
  bind('wb-problem-toggle', function () { setShowProblem(!state.showProblem); });
  bind('wb-bank-toggle', function () { setBank(!bankOpen()); });
  bind('wb-jump-kp', jumpToKp);
  bind('wb-bank-close', function () { setBank(false); });
  initPanelDrag();
  bind('wb-group-draw', function () { toggleFlyout('draw'); });
  bind('wb-group-shape', function () { toggleFlyout('shape'); });
  bind('wb-settings', function () { setPopover(!popoverOpen()); });
  bind('wb-zoom-in', function () { zoomBy(1.2); });
  bind('wb-zoom-out', function () { zoomBy(1 / 1.2); });
  bind('wb-zoom-level', function () { resetZoom(); });
  bind('wb-zoom-fit', fitContent);
  bindKeys();

  if (document.addEventListener) {
    ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach(function (evt) {
      document.addEventListener(evt, function () {
        // 侧栏的「全屏」按钮切换后，画布按新的可用尺寸重排
        syncUI();
        resize();
      });
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      var inPanel = !!(t && t.closest && (t.closest('#wb-pop') || t.closest('#wb-settings')));
      var inGroup = !!(t && t.closest && t.closest('.wb-dock__group'));
      if (popoverOpen() && !inPanel) setPopover(false);
      if (flyoutGroup() && !inGroup) setFlyout(null);
    }, true);
  }

  var query = readQuery();
  if (query.t || query.text) {
    applyExternal({
      text: query.t || query.text,
      tag: query.g || query.tag || '',
      extra: query.x || query.extra || ''
    });
  }

  renderBank();
  if (state.external || state.problemId) renderCard();
  syncUI();      // 每次都刷一遍，工具组格子才不会停在默认图标上

  resize();
  if (typeof window.ResizeObserver === 'function') {
    try { new window.ResizeObserver(function () { resize(); }).observe(wrap); } catch (e) { /* 忽略 */ }
  }
  if (window.addEventListener) {
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
  }

  /* 供自动化自检使用 */
  window.__WB__ = {
    state: state,
    bank: bank,
    config: { COLORS: COLORS, WIDTHS: WIDTHS, ERASERS: ERASERS, GRID_SIZES: GRID_SIZES, SHAPE_TOOLS: SHAPE_TOOLS, GROUPS: GROUPS, TOOL_GROUPS: TOOL_GROUPS },
    COLORS: COLORS,
    themes: themes,
    theme: theme,
    setTheme: setTheme,
    WIDTHS: WIDTHS,
    ERASERS: ERASERS,
    applyAction: applyAction,
    unapplyAction: unapplyAction,
    commitAction: commitAction,
    undo: undo,
    redo: redo,
    clearAll: clearAll,
    strokeHit: strokeHit,
    eraseRegionAt: eraseRegionAt,
    polylinesAfterErase: polylinesAfterErase,
    strokePolylines: strokePolylines,
    clipSegmentOut: clipSegmentOut,
    strokeWidthFor: strokeWidthFor,
    setTool: setTool,
    groupOf: groupOf,
    groupSlot: groupSlot,
    paintGroups: paintGroups,
    flyoutGroup: flyoutGroup,
    setFlyout: setFlyout,
    closeFlyout: closeFlyout,
    toggleFlyout: toggleFlyout,
    setColor: setColor,
    setWidth: setWidth,
    setEraser: setEraser,
    setGrid: setGrid,
    setGridSize: setGridSize,
    gridSizes: function () { return GRID_SIZES; },
    setShowProblem: setShowProblem,
    setPopover: setPopover,
    popoverOpen: popoverOpen,
    setBank: setBank,
    bankOpen: bankOpen,
    panelPos: panelPos,
    clampPanel: clampPanel,
    onPanelDown: onPanelDown,
    onPanelMove: onPanelMove,
    onPanelUp: onPanelUp,
    initPanelDrag: initPanelDrag,
    reflowPanel: reflowPanel,
    problemLayout: problemLayout,
    boardToScreen: boardToScreen,
    layoutOverlays: layoutOverlays,
    overlayCtx: overlayCtx,
    toggleAnalysis: toggleAnalysis,
    toggleAnswer: toggleAnswer,
    stepGuides: stepGuides,
    stepGuide: stepGuide,
    stepText: stepText,
    setStepText: setStepText,
    stepPos: stepPos,
    openAnalysis: openAnalysis,
    closeAnalysis: closeAnalysis,
    analysisOpen: analysisOpen,
    initStepDrag: initStepDrag,
    toggleTranscribe: toggleTranscribe,
    transcribe: runTranscribe,
    inkOutside: inkOutside,
    inkSteps: function () { return state.ink.steps; },
    inkRecord: inkRecord,
    inkDrop: inkDrop,
    inkLoad: inkLoad,
    inkKey: function () { return INK_KEY; },
    belowBlocks: belowBlocks,
    view: function () {
      return { x: state.view.x, y: state.view.y, scale: state.view.scale, w: state.view.w, h: state.view.h };
    },
    strokes: function () { return state.strokes; },
    badPoints: function () { return badPoints; },
    setProblemHover: setProblemHover,
    setProblemGripHot: setProblemGripHot,
    problemGrip: problemGrip,
    hitProblem: hitProblem,
    hitProblemHandle: hitProblemHandle,
    drawProblemLayer: drawProblemLayer,
    worldTransform: worldTransform,
    drawStroke: drawStroke,
    drawTail: drawTail,
    wrapText: wrapText,
    toWorld: toWorld,
    zoomAt: zoomAt,
    zoomBy: zoomBy,
    resetZoom: resetZoom,
    fitContent: fitContent,
    contentBounds: contentBounds,
    applyProblem: applyProblem,
    applyExternal: applyExternal,
    renderCard: renderCard,
    cardData: cardData,
    kpKeyword: kpKeyword,
    kpTargetUrl: kpTargetUrl,
    jumpToKp: jumpToKp,
    readQuery: readQuery,
    pickProblem: pickProblem,
    renderBank: renderBank,
    redraw: redraw,
    resize: resize,
    persist: persist,
    restore: restore,
    syncUI: syncUI,
    onDown: onDown,
    onMove: onMove,
    onUp: onUp,
    onWheel: onWheel
  };
})();
