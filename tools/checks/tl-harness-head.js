/* ============================================================
   时间轴引擎自检 —— 极简 DOM / 画布 / 令牌桩
   ------------------------------------------------------------
   为什么单开这一套：时间轴的轴、刻度、彩条、缩略条全画在 canvas 上，DOM 里几乎是空壳
   （verify_timeline.rb 开头那段话说的就是这个）。静态体检只能 grep 字符串 ——
   能证明"函数还在"，证明不了"锚点缩放真的没动"、"缩略条的滑块宽度真的是视野占比"、
   "筛选四维真的是或 / 与"。所以这里搭一个极简桩把 timeline.js 真跑起来，
   用真实引擎跑纯逻辑（§5.1 第 3 步里"能跑纯逻辑的就用真实引擎跑"那一半）。
   桩的写法和 wb-harness-head.js 同一套路（那边是白板引擎），只是多了两样白板不需要的：
     · `getComputedStyle`：时间轴的颜色**全部**从 tokens.css 的令牌读（§2.11 ⑨），
       桩要能把 `var(--math-…)` 解成一个可信的值 —— 下面那张令牌表就是"真值"；
     · 每块 canvas 各记一份调用：轴与缩略条是两块画布，混在一起就分不清谁画了什么。
   ============================================================ */

function out(line) {
  if (typeof console !== 'undefined' && console.log) console.log(line);
  else print(line);
}
function assert(ok, label) {
  out((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;

/* ------------------------------------------------------------
   1. 令牌表（"真值"）
   ------------------------------------------------------------
   值故意取得**一眼认得出来是桩造的**（11,11,11 / 22,22,22 …），
   这样断言 `markColor('key') === 'rgb(201,101,7)'` 才真的证明了"颜色是从令牌读的"：
   要是哪天有人把颜色写死成字面量，这条立刻红。
   值本身对不对是 verify_display.rb 的活（它逐令牌比对亮 / 中 / 暗三包），这里只管"走没走令牌"。 */
var TOK = {
  '--math-background': 'rgb(101,1,1)',
  '--math-surface': 'rgb(102,1,1)',
  '--math-foreground': 'rgb(103,1,1)',
  '--math-ink-2': 'rgb(104,1,1)',
  '--math-ink-3': 'rgb(105,1,1)',
  '--math-ink-4': 'rgb(106,1,1)',
  '--math-line': 'rgb(107,1,1)',
  '--math-line-strong': 'rgb(108,1,1)',
  '--math-primary': 'rgb(109,1,1)',
  '--math-bar-ok': 'rgb(201,1,1)',
  '--math-bar-gold': 'rgb(202,1,1)',
  '--math-bar-first': 'rgb(203,1,1)',
  '--math-bar-learn': 'rgb(204,1,1)',
  '--math-bar-review': 'rgb(205,1,1)',
  '--math-bar-weak': 'rgb(206,1,1)',
  '--math-bar-idle': 'rgb(207,1,1)',
  '--math-mark-key': 'rgb(301,1,1)',
  '--math-mark-hard': 'rgb(302,1,1)',
  '--math-mark-review': 'rgb(303,1,1)',
  '--math-mark-block': 'rgb(304,1,1)',
  '--math-stage-primary': 'rgb(401,1,1)',
  '--math-stage-junior': 'rgb(402,1,1)',
  '--math-stage-senior': 'rgb(403,1,1)',
  '--math-stage-olympiad': 'rgb(404,1,1)'
};
var VARS = { '--math-font-sans': 'sans-serif', '--math-fs': '1' };

/* ------------------------------------------------------------
   2. 画布桩：一块 canvas 一份记录
   ------------------------------------------------------------ */
function mkCtx(tag) {
  var c = {
    tag: tag,
    transforms: [], dashes: [], fills: [], fillRects: [], strokes: [], texts: [], arcs: [],
    segs: [], clears: 0,
    font: '', textAlign: '', textBaseline: '', lineWidth: 1, lineCap: '', lineJoin: '',
    strokeStyle: '', fillStyle: '', globalAlpha: 1,
    _pt: null, _tf: { a: 1, d: 1, e: 0, f: 0 }, _stack: []
  };
  c.setTransform = function (a, b, cc, d, e, f) {
    c._tf = { a: a, d: d, e: e, f: f };
    c.transforms.push({ a: a, d: d, e: e, f: f });
  };
  c.save = function () { c._stack.push({ a: c._tf.a, d: c._tf.d, e: c._tf.e, f: c._tf.f }); };
  c.restore = function () { if (c._stack.length) { c._tf = c._stack.pop(); } };
  c.clearRect = function () { c.clears += 1; };
  c.fillRect = function (x, y, w, h) { c.fillRects.push({ x: x, y: y, w: w, h: h, style: c.fillStyle }); };
  c.beginPath = function () { c._pt = null; };
  c.closePath = function () {};
  c.moveTo = function (x, y) { c._pt = { x: x, y: y }; };
  c.lineTo = function (x, y) {
    if (c._pt) { c.segs.push({ x0: c._pt.x, y0: c._pt.y, x1: x, y1: y }); }
    c._pt = { x: x, y: y };
  };
  c.quadraticCurveTo = function () {};
  c.arc = function (x, y, r) { c.arcs.push({ x: x, y: y, r: r }); };
  c.fill = function () { c.fills.push({ style: c.fillStyle }); };
  c.stroke = function () { c.strokes.push({ style: c.strokeStyle, width: c.lineWidth }); };
  c.setLineDash = function (a) { c.dashes.push(a); };
  c.translate = function () {};
  c.scale = function () {};
  c.measureText = function (t) { return { width: String(t).length * 9 }; };
  c.fillText = function (t) { c.texts.push(String(t)); };
  return c;
}

/* ------------------------------------------------------------
   3. DOM 桩
   ------------------------------------------------------------ */
function mkEl(tag) {
  var self = {
    tagName: String(tag || 'div').toUpperCase(),
    _attrs: {}, _classes: {}, _h: {}, children: [], _own: '',
    className: '', hidden: false, disabled: false, value: '',
    id: '', width: 0, height: 0, clientWidth: 0, clientHeight: 0,
    offsetWidth: 0, offsetHeight: 0, parentNode: null,
    style: {},
    getAttribute: function (k) { return self._attrs[k] === undefined ? null : self._attrs[k]; },
    setAttribute: function (k, v) { self._attrs[k] = String(v); },
    removeAttribute: function (k) { delete self._attrs[k]; },
    hasAttribute: function (k) { return self._attrs[k] !== undefined; },
    addEventListener: function (t, fn) { self._h[t] = fn; },
    removeEventListener: function () {},
    appendChild: function (c) { c.parentNode = self; self.children.push(c); return c; },
    insertBefore: function (c) { c.parentNode = self; self.children.push(c); return c; },
    removeChild: function (c) {
      var i = self.children.indexOf(c);
      if (i >= 0) { self.children.splice(i, 1); }
      return c;
    },
    closest: function () { return null; },
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: self.clientWidth || 0, height: self.clientHeight || 0 };
    },
    setPointerCapture: function (id) { self._captured = id; },
    releasePointerCapture: function () { self._captured = null; },
    focus: function () {}, blur: function () {},
    querySelector: function (sel) { return elFor(sel); },
    querySelectorAll: function (sel) {
      var found = [];
      (function walk(node) {
        (node.children || []).forEach(function (c) {
          if (matches(c, sel)) { found.push(c); }
          walk(c);
        });
      }(self));
      return found;
    }
  };
  self.classList = {
    add: function (c) { self._classes[c] = true; },
    remove: function (c) { delete self._classes[c]; },
    contains: function (c) { return !!self._classes[c]; },
    toggle: function (c, on) {
      if (on === undefined) { on = !self._classes[c]; }
      if (on) { self._classes[c] = true; } else { delete self._classes[c]; }
    }
  };
  /* textContent 要**照真 DOM 的语义**实现：赋空串 = 把子节点全清掉、读出来 = 自己那段 + 所有后代的文字。
     这两条都必须真 —— 页面里 `box.textContent = ''` 之后重建胶囊（图例 / 筛选都是这么刷的），
     桩要是只把字符串存起来、children 不动，rebuild 几次数就会翻几番（第一版就是这么错的：
     筛选胶囊数报成了 35，图标数报成了 20）。 */
  Object.defineProperty(self, 'textContent', {
    get: function () {
      var s = self._own;
      self.children.forEach(function (c) { s += (c.textContent || ''); });
      return s;
    },
    set: function (v) { self.children = []; self._own = String(v); },
    enumerable: true,
    configurable: true
  });
  return self;
}

function mkText(s) { return { _isText: true, textContent: String(s), children: [] }; }

function matches(el, sel) {
  if (!el || el._isText) { return false; }
  if (sel.charAt(0) === '.') {
    var cls = sel.slice(1);
    return !!el._classes[cls] || String(el.className || '').split(/\s+/).indexOf(cls) >= 0;
  }
  if (sel.charAt(0) === '#') { return el.id === sel.slice(1); }
  if (sel.charAt(0) === '[') {
    return el._attrs[sel.slice(1, sel.length - 1).split('=')[0]] !== undefined;
  }
  return el.tagName === sel.toUpperCase();
}

/* 一个选择器一份桩：timeline.js 里同一个选择器每次都该拿到同一个元素 */
var __els = {};
function elFor(sel) {
  if (!__els[sel]) {
    var el = mkEl(/^button$/i.test(sel) ? 'button' : 'div');
    if (sel.charAt(0) === '#') { el.id = sel.slice(1); }
    __els[sel] = el;
  }
  return __els[sel];
}

/* 整棵树上的文字 —— textContent 已经是"自己 + 所有后代"了，这里只是个读起来顺手的别名 */
function allText(el) { return el ? (el.textContent || '') : ''; }

/* 数一棵子树里带 data-lucide 的图标（断言"四个标记胶囊各带一个小图标"用） */
function countIcons(el) {
  if (!el) { return 0; }
  var n = el._attrs && el._attrs['data-lucide'] !== undefined ? 1 : 0;
  (el.children || []).forEach(function (c) { n += countIcons(c); });
  return n;
}

/* 主舞台：[data-tk] —— 里面每个 [data-tk-…] 都是独立一块桩 */
var mainEl = mkEl('div');
mainEl.id = 'tk';
/* 几处尺寸：舞台 1200×700（与白板自查同一套数），缩略条的杆子 400×12，
   画布 1200×700 —— 这些数决定视图模型算出来的每一个坐标，断言里要照着它算 */
mainEl.clientWidth = 1200;
mainEl.clientHeight = 700;
elFor('[data-tk-wrap]').clientWidth = 1200;
elFor('[data-tk-wrap]').clientHeight = 700;
elFor('[data-tk-mini]').hidden = true;
elFor('[data-tk-mini-track]').clientWidth = 400;
elFor('[data-tk-mini-track]').clientHeight = 12;
elFor('[data-tk-mini-strip]').clientWidth = 400;
elFor('[data-tk-mini-strip]').clientHeight = 12;
/* 卡片 / 筛选 / 时间段 / 方阵四张浮层：HTML 里都带 hidden */
['card', 'filters', 'months', 'matrix', 'stages', 'help', 'hover', 'legend-bar'].forEach(function (k) {
  var el = elFor('[data-tk-' + k + ']');
  if (el) { el.hidden = true; }
});
elFor('#tk-pop').hidden = true;

var __ctxByCanvas = {};
var canvasEl = elFor('[data-tk-canvas]');
canvasEl.clientWidth = 1200;
canvasEl.clientHeight = 700;
canvasEl.getContext = function () {
  if (!__ctxByCanvas.axis) { __ctxByCanvas.axis = mkCtx('axis'); }
  return __ctxByCanvas.axis;
};
var ctx = canvasEl.getContext('2d');
var miniStripEl = elFor('[data-tk-mini-strip]');
miniStripEl.getContext = function () {
  if (!__ctxByCanvas.mini) { __ctxByCanvas.mini = mkCtx('mini'); }
  return __ctxByCanvas.mini;
};
var miniCtx = miniStripEl.getContext('2d');

/* ------------------------------------------------------------
   4. window / document
   ------------------------------------------------------------ */
var __store = {};
var __docHandlers = {};

var document = {
  body: mkEl('body'),
  documentElement: mkEl('html'),
  activeElement: null,
  hidden: false,
  /* _h 与 __docHandlers 是同一份：断言里 fire(document, 'keydown', …) 走的就是它 */
  _h: __docHandlers,
  getElementById: function (id) { return elFor('#' + id); },
  querySelector: function (sel) { return elFor(sel); },
  querySelectorAll: function () { return []; },
  createElement: function (t) { return mkEl(t); },
  createTextNode: function (s) { return mkText(s); },
  addEventListener: function (t, fn) { __docHandlers[t] = fn; },
  removeEventListener: function () {}
};

var window = {
  devicePixelRatio: 2,
  document: document,
  localStorage: {
    _d: {},
    getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; },
    setItem: function (k, v) { this._d[k] = String(v); __store[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  },
  /* 同步跑：scheduleRedraw 里有 rafPending 挡重复，不会递归 */
  requestAnimationFrame: function (fn) { fn(); return 1; },
  addEventListener: function (t, fn) { __docHandlers['w:' + t] = fn; },
  getComputedStyle: function (el) {
    var color = (el && el.style && el.style.color) || '';
    var m = /^var\((--[a-z0-9-]+)\)$/.exec(color);
    return {
      color: m ? (TOK[m[1]] || 'rgb(0,0,0)') : (color || 'rgb(0,0,0)'),
      getPropertyValue: function (name) { return VARS[name] === undefined ? '' : VARS[name]; }
    };
  }
};

/* display.js 的桩：时间轴只在换配色 / 换字号时重取令牌，这里给个能派事件的最小壳 */
window.WK_DISPLAY = {
  get: function () { return { theme: 'light', fs: 'std' }; },
  set: function () { var h = __docHandlers['wk:display']; if (h) { h({}); } }
};
/* 「学习计划设定」那颗按钮点了要给一句实话（§2.11 ⑤），桩把这句话记下来 */
var __toasts = [];
window.MathSite = { toast: function (msg) { __toasts.push(String(msg)); } };

/* ------------------------------------------------------------
   5. Path2D / lucide
   ------------------------------------------------------------
   轴上四类标记的小图标是**取页面上那份 lucide 的路径**（`[[标签, 属性], …]`）拼成 Path2D 再描边，
   不另画一套 —— 桩照着这个形状给四个图标，断言就能验"四个标记都真的拿到了路径"。 */
var __paths = [];
function Path2D(d) { this.d = d === undefined ? '' : String(d); }
/* Path2D 上那几个拼接方法：lucide 的图标是 [[标签, 属性], …]，
   path → addPath、rect / circle / line 各自走一个 —— 桩少一个就会出现
   "跑着跑着 p.rect is not a function"（第一版就漏了 rect，一放大到画标记那档就炸） */
Path2D.prototype.addPath = function (p) { __paths.push(p); };
Path2D.prototype.rect = function () {};
Path2D.prototype.arc = function () {};
Path2D.prototype.moveTo = function () {};
Path2D.prototype.lineTo = function () {};
window.lucide = {
  Star: [['path', { d: 'M1 1 L2 2' }], ['circle', { cx: 1, cy: 1, r: 1 }]],
  Flame: [['path', { d: 'M3 3 L4 4' }]],
  RotateCcw: [['path', { d: 'M5 5 L6 6' }]],
  Lock: [['rect', { x: 1, y: 1, width: 2, height: 2 }]],
  createIcons: function () { __iconsCreated += 1; }
};
var __iconsCreated = 0;

/* 清空一块画布的记录：断言要"这一帧画了什么"，而桩是累加的 ——
   不清就会把上一帧的调用也算进来（量彩条数、网格线数都会多算一截）。 */
function ctxReset(c) {
  if (!c) { return; }
  c.transforms = []; c.dashes = []; c.fills = []; c.fillRects = [];
  c.strokes = []; c.texts = []; c.arcs = []; c.segs = []; c.clears = 0;
}

/* ------------------------------------------------------------
   6. 造事件
   ------------------------------------------------------------ */
function pe(x, y, opts) {
  opts = opts || {};
  return {
    pointerId: opts.id === undefined ? 1 : opts.id,
    pointerType: opts.type || 'mouse',
    button: opts.button === undefined ? 0 : opts.button,
    clientX: x, clientY: y,
    pressure: 0, deltaX: opts.deltaX || 0, deltaY: opts.deltaY || 0, deltaMode: 0,
    shiftKey: !!opts.shift, metaKey: !!opts.meta, ctrlKey: !!opts.ctrl,
    key: opts.key || '',
    preventDefault: function () {}, stopPropagation: function () {}
  };
}
function fire(el, type, ev) { if (el && el._h && el._h[type]) { el._h[type](ev); } }

/* 拖动数轴：按下 → 若干次移动 → 松开 */
function dragAxis(dx, dy) {
  fire(canvasEl, 'pointerdown', pe(600, 300));
  fire(canvasEl, 'pointermove', pe(600 + dx, 300 + (dy || 0)));
  fire(canvasEl, 'pointerup', pe(600 + dx, 300 + (dy || 0)));
}
