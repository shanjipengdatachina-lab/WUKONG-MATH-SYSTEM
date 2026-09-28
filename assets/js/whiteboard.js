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
  var COLORS = [
    { value: '#1f2937', label: '墨黑' },
    { value: '#dc2626', label: '朱红' },
    { value: '#2563eb', label: '靛蓝' },
    { value: '#059669', label: '青绿' },
    { value: '#ea580c', label: '橘橙' },
    { value: '#7c3aed', label: '紫罗兰' }
  ];
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
  var HIGHLIGHT_WIDTH = 18;      // 荧光标记的笔宽（世界单位）
  var HIGHLIGHT_ALPHA = 0.3;
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
    color: COLORS[0].value,
    width: WIDTHS[1].value,
    eraser: ERASERS[1].value,
    grid: false,
    showProblem: true,
    problemId: null,
    problemAt: { x: 16, y: 16 },  // 题面底纹在板上的位置（世界坐标）
    problemHover: false,          // 鼠标是否正压在题面上（决定那层很浅的底要不要浮现）
    external: null,              // 其它页面送来的内容 { text, tag, extra }
    strokes: [],                 // { type?, color, width, highlight?, pressured?, points:[{x,y,p}] }
    actions: [],
    redo: [],
    active: null,
    view: { scale: 1, x: 16, y: 16, w: 800, h: 520, dpr: 1 }
  };

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
  function drawGrid() {
    var v = state.view;
    var step = 40;
    while (step * v.scale < 14) step *= 2;
    while (step * v.scale > 96) step /= 2;
    var left = (0 - v.x) / v.scale;
    var right = (v.w - v.x) / v.scale;
    var top = (0 - v.y) / v.scale;
    var bottom = (v.h - v.y) / v.scale;
    var startX = Math.floor(left / step) * step;
    var startY = Math.floor(top / step) * step;
    ctx.save();
    ctx.strokeStyle = 'rgba(15,23,42,.06)';
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
      ctx.fillStyle = 'rgba(37,99,235,.05)';
      ctx.fill();
      /* 左侧 2.5px 竖条：不占横向空间，当"这是一道题"的轻锚点 */
      ctx.beginPath();
      ctx.rect(x + 0.5, y + 12, 2.5, Math.max(8, h - 24));
      ctx.fillStyle = 'rgba(37,99,235,.42)';
      ctx.fill();
    }

    var tx = x + 20;
    var ty = y + 14;
    ctx.textBaseline = 'top';
    if (data.tag) {
      ctx.font = tagFont;
      ctx.fillStyle = state.problemHover ? 'rgba(37,99,235,.78)' : 'rgba(16,18,21,.42)';
      ctx.fillText(data.tag, tx, ty + 3);
      ty += tagH;
    }
    ctx.font = textFont;
    ctx.fillStyle = '#101215';
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tx, ty + 3);
      ty += 29;
    }
    if (extraLines.length) {
      ctx.font = extraFont;
      ctx.fillStyle = 'rgba(16,18,21,.56)';
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

  /* 这个世界点是否落在题面里 —— 悬停判定用它，拖动题面的命中判定也用它 */
  function hitProblem(wx, wy) {
    return problemBox.h > 0 &&
      wx >= problemBox.x && wx <= problemBox.x + problemBox.w &&
      wy >= problemBox.y && wy <= problemBox.y + problemBox.h;
  }

  /* 那层很浅的底只在鼠标压上来时浮现：平时题面就是印在板上的一段字 */
  function setProblemHover(on) {
    on = !!on;
    if (state.problemHover === on) return;
    state.problemHover = on;
    scheduleRedraw();
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
    if (s.highlight) ctx.globalAlpha = HIGHLIGHT_ALPHA;

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

  function drawArrowHead(from, to, w) {
    var ang = Math.atan2(to.y - from.y, to.x - from.x);
    var len = Math.max(10, w * 3.6);
    var spread = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - len * Math.cos(ang - spread), to.y - len * Math.sin(ang - spread));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - len * Math.cos(ang + spread), to.y - len * Math.sin(ang + spread));
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

  function drawStroke(s) {
    if (!s) return;
    if (isShapeTool(s.type)) drawShape(s);
    else drawFreehand(s);
  }

  function redraw() {
    var v = state.view;
    if (ctx.setTransform) ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, v.w, v.h);
    ctx.save();
    if (ctx.setTransform) ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.x, v.dpr * v.y);
    if (state.grid) drawGrid();
    drawProblemLayer();
    for (var i = 0; i < state.strokes.length; i++) drawStroke(state.strokes[i]);
    ctx.restore();
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

  function eraseAt(x, y, r, bucket) {
    var removed = [];
    for (var i = state.strokes.length - 1; i >= 0; i--) {
      if (strokeHit(state.strokes[i], x, y, r)) removed.push({ index: i, stroke: state.strokes[i] });
    }
    if (!removed.length) return removed;
    removed.sort(function (a, b) { return a.index - b.index; });
    for (var j = removed.length - 1; j >= 0; j--) state.strokes.splice(removed[j].index, 1);
    if (bucket) Array.prototype.push.apply(bucket, removed);
    return removed;
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
    if (state.tool === 'eraser') {
      state.active = { mode: 'erase', id: e.pointerId, bucket: [] };
      eraseAt(pt.x, pt.y, state.eraser / state.view.scale, state.active.bucket);
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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    if (stroke.highlight) ctx.globalAlpha = HIGHLIGHT_ALPHA;
    ctx.lineWidth = strokeWidthFor(stroke, p1, p2);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(p1.x, p1.y, end.x, end.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function onMove(e) {
    var act = state.active;
    if (!act || act.id !== e.pointerId) {
      /* 没落笔时，pointermove 只负责一件事：鼠标是不是压在题面上（决定那层底浮不浮现） */
      if (!act) {
        var hp = pointFrom(e);
        if (hp) setProblemHover(state.showProblem && hitProblem(hp.x, hp.y));
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

    var events = (typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents()) || [e];

    if (act.mode === 'erase') {
      var r = state.eraser / state.view.scale;
      for (var i = 0; i < events.length; i++) {
        var pe = pointFrom(events[i]);
        if (!pe) continue;
        eraseAt(pe.x, pe.y, r, act.bucket);
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
    if (act.mode === 'erase') {
      if (act.bucket.length) commitAction({ type: 'erase', items: act.bucket, label: '擦除' });
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
    canvas.addEventListener('pointerleave', function () { setProblemHover(false); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
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
    syncUI();
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
    var stat = byId('wb-stat');
    if (stat) stat.textContent = '笔画 ' + state.strokes.length + ' · 可撤销 ' + state.actions.length;
    zoomLabel();
  }

  function buildPickers() {
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
        showProblem: state.showProblem,
        problemId: state.problemId,
        external: state.external,
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
    config: { COLORS: COLORS, WIDTHS: WIDTHS, ERASERS: ERASERS, SHAPE_TOOLS: SHAPE_TOOLS, GROUPS: GROUPS, TOOL_GROUPS: TOOL_GROUPS },
    COLORS: COLORS,
    WIDTHS: WIDTHS,
    ERASERS: ERASERS,
    applyAction: applyAction,
    unapplyAction: unapplyAction,
    commitAction: commitAction,
    undo: undo,
    redo: redo,
    clearAll: clearAll,
    eraseAt: eraseAt,
    strokeHit: strokeHit,
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
    badPoints: function () { return badPoints; },
    setProblemHover: setProblemHover,
    hitProblem: hitProblem,
    drawProblemLayer: drawProblemLayer,
    drawStroke: drawStroke,
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
