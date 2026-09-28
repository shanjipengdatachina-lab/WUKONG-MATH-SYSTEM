/* ============================================================
   白板引擎自检 —— 极简 DOM 桩
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
var __ctxCalls = { stroke: 0, fill: 0, clear: 0, fillText: 0, texts: [], strokeTfs: [], arcs: [], segs: [], pt: null };

function mkEl(tag) {
  var self = {
    tagName: String(tag || 'div').toUpperCase(),
    _attrs: {}, _classes: {}, _h: {}, children: [],
    textContent: '', innerHTML: '', value: '', hidden: false, disabled: false,
    style: {},
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    removeAttribute: function (k) { delete this._attrs[k]; },
    hasAttribute: function (k) { return this._attrs[k] !== undefined; },
    addEventListener: function (t, fn) { this._h[t] = fn; },
    querySelectorAll: function () { return []; },
    closest: function () { return null; },
    appendChild: function (c) { this.children.push(c); return c; },
    /* 答案块的注释行要重建，桩必须模拟真实的 DOM 操作 */
    removeChild: function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  };
  self.classList = {
    add: function (c) { self._classes[c] = true; },
    remove: function (c) { delete self._classes[c]; },
    contains: function (c) { return !!self._classes[c]; },
    toggle: function (c) { if (self._classes[c]) delete self._classes[c]; else self._classes[c] = true; }
  };
  return self;
}

/* 变换栈：真实的 Canvas2D 里 setTransform 是"替换"、save/restore 是"压/弹"。
   桩必须照着模拟，否则"增量绘制时用的是哪个变换"这类问题在断言里根本看不见 ——
   真机上就是这么漏过去的（drawTail 拿设备变换当世界变换用）。 */
var __tf = { a: 1, d: 1, e: 0, f: 0 };
var __tfStack = [];
function tfNow() { return { a: __tf.a, d: __tf.d, e: __tf.e, f: __tf.f }; }
function tfEq(x, y) { return x && y && x.a === y.a && x.d === y.d && x.e === y.e && x.f === y.f; }

var ctx = {
  setTransform: function (a, b, c, d, e, f) { __tf = { a: a, d: d, e: e, f: f }; },
  clearRect: function () { __ctxCalls.clear++; },
  /* 板面色现在由画布自己 fillRect 铺满（不再靠 CSS 白底），桩要认这个调用。
     计入 clear —— 它语义上就是"把画布铺一层底"，别计入 fill，
     否则 §7b 那些数填充次数的断言会被每次 redraw 多出来的这一下打乱。 */
  fillRect: function () { __ctxCalls.clear++; },
  save: function () { __tfStack.push(tfNow()); },
  restore: function () { if (__tfStack.length) __tf = __tfStack.pop(); },
  /* 线段要记下来：网格间距这类"画出来的东西"只能量坐标。
     只记"画了几次线"是量不出疏密的 —— 把 gridSize 存下来却在 drawGrid 里
     继续写死 40，数次数一样过。每个 beginPath 重置起点，避免跨路径连出一条假线。 */
  beginPath: function () { __ctxCalls.pt = null; },
  moveTo: function (x, y) { __ctxCalls.pt = { x: x, y: y }; },
  lineTo: function (x, y) {
    if (__ctxCalls.pt) __ctxCalls.segs.push({ x0: __ctxCalls.pt.x, y0: __ctxCalls.pt.y, x1: x, y1: y });
    __ctxCalls.pt = { x: x, y: y };
  },
  quadraticCurveTo: function () {}, ellipse: function () {},
  /* arc 要记下来：笔尖 / 橡皮那个圈的半径就藏在这里，不记就只能数"画了几笔"，
     量不到"圈有多大"（而圈的大小正是这个功能唯一要守住的东西）。 */
  arc: function (x, y, r) { __ctxCalls.arcs.push({ x: x, y: y, r: r }); },
  rect: function () {}, roundRect: function () {},
  fill: function () { __ctxCalls.fill++; __ctxCalls.fillTf = tfNow(); },
  stroke: function () { __ctxCalls.stroke++; __ctxCalls.strokeTf = tfNow(); __ctxCalls.strokeTfs.push(tfNow()); },
  measureText: function (t) { return { width: String(t).length * 9 }; },
  fillText: function (t) { __ctxCalls.fillText++; __ctxCalls.texts.push(String(t)); },
  lineWidth: 1, strokeStyle: '', fillStyle: '', lineCap: '', lineJoin: '',
  font: '', textBaseline: '', globalAlpha: 1
};

var els = {};
function elById(id) {
  if (!els[id]) { els[id] = mkEl('div'); els[id].id = id; }
  return els[id];
}

/* 画布与容器 */
var canvasEl = elById('wb-canvas');
canvasEl.getContext = function () { return ctx; };
canvasEl.getBoundingClientRect = function () { return { left: 0, top: 0 }; };
canvasEl.setPointerCapture = function () {};
canvasEl.releasePointerCapture = function () {};
canvasEl.width = 0;
canvasEl.height = 0;
canvasEl.clientWidth = 1200;
canvasEl.clientHeight = 700;

var wrapEl = elById('wb-canvas-wrap');
wrapEl.clientWidth = 1200;
wrapEl.clientHeight = 700;
canvasEl.parentNode = wrapEl;

/* 悬浮题库面板：HTML 里带 hidden 属性，所以默认是收起的 */
var bankPanelEl = elById('wb-bank');
bankPanelEl.hidden = true;

/* 工具条里的题库按钮 / 面板标题栏 / 关闭按钮：按真实 HTML 的属性预置 */
var bankToggleEl = elById('wb-bank-toggle');
bankToggleEl.setAttribute('aria-pressed', 'false');
bankToggleEl.setAttribute('aria-controls', 'wb-bank');
bankToggleEl.setAttribute('title', '题库（⌘/Ctrl + B）');
var bankHeadEl = elById('wb-bank-head');
var bankCloseEl = elById('wb-bank-close');
bankCloseEl.setAttribute('aria-label', '关闭题库');

/* 工具条里的「回到知识点」按钮：HTML 里带自绘提示 */
var jumpKpEl = elById('wb-jump-kp');
jumpKpEl.setAttribute('data-wb-tip', '回到知识点');
jumpKpEl.setAttribute('aria-label', '回到知识点');

/* 工具条：工具组格子 + 浮层，按真实 HTML 的初始状态预置 */
var groupDrawEl = elById('wb-group-draw');
groupDrawEl.setAttribute('data-active', 'pen');
groupDrawEl.setAttribute('aria-expanded', 'false');
groupDrawEl.setAttribute('aria-haspopup', 'true');
var groupShapeEl = elById('wb-group-shape');
groupShapeEl.setAttribute('data-active', 'line');
groupShapeEl.setAttribute('aria-expanded', 'false');
var flyoutDrawEl = elById('wb-flyout-draw');
flyoutDrawEl.hidden = true;
var flyoutShapeEl = elById('wb-flyout-shape');
flyoutShapeEl.hidden = true;

var document = {
  getElementById: function (id) { return elById(id); },
  addEventListener: function (t, fn) { __capture.docHandlers[t] = fn; },
  createElement: function (t) { return mkEl(t); }
};

/* body / html：用于验证全屏专注模式 */
var bodyEl = mkEl('body');
document.body = bodyEl;
var htmlEl = mkEl('html');
htmlEl.requestFullscreen = function () { document.fullscreenElement = htmlEl; };
htmlEl.webkitRequestFullscreen = htmlEl.requestFullscreen;
document.documentElement = htmlEl;
document.exitFullscreen = function () { delete document.fullscreenElement; };
document.addEventListener = function (t, fn) { __capture.docHandlers[t] = fn; };

var __capture = { docHandlers: {}, store: {} };

/* 题面上方那三个小按钮（上传我的题 / 分析 / 答案）、右侧「思路」框、
   题目下方的「标准答案」块、以及「拍照还在做」的实话条：真实 HTML 里默认全是收起的 */
elById('wb-acts').hidden = true;
elById('wb-act-upload').setAttribute('aria-label', '上传我自己的题');
elById('wb-act-analysis').setAttribute('aria-label', '看这道题的思路');
elById('wb-act-answer').setAttribute('aria-label', '对这道题的答案');
elById('wb-think').hidden = true;
elById('wb-think').setAttribute('hidden', 'hidden');
elById('wb-answer').hidden = true;
elById('wb-answer').setAttribute('hidden', 'hidden');
elById('wb-act-notes').setAttribute('aria-pressed', 'true');
elById('wb-act-notes').textContent = '收起注释';
elById('wb-upload-tip').hidden = true;
elById('wb-upload-tip').setAttribute('hidden', 'hidden');

/* 「手写转文字」那一层：按真实 HTML 的初始状态预置 ——
   面板与「演示」标都是收起的，两个动作按钮跟着面板走。 */
elById('wb-act-transcribe').setAttribute('aria-label', '把手写思路转成电子文字');
elById('wb-ink-text').hidden = true;
elById('wb-ink-text').setAttribute('hidden', 'hidden');
elById('wb-ink-badge').hidden = true;
elById('wb-ink-acts').hidden = true;

var window = {
  devicePixelRatio: 2,
  localStorage: {
    _d: {},
    getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; },
    setItem: function (k, v) { this._d[k] = String(v); __capture.store[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  },
  requestAnimationFrame: function (fn) { fn(); return 1; },
  addEventListener: function () {}
};

/* 「阅读与显示」的桩：白板板面与整站配色共用同一个真值，这里就是那个真值。
   （display.js 在真实页面里干的也是这几件事：写 localStorage、派一个事件。） */
var __displayState = { theme: 'light', fs: 'std' };
window.WK_DISPLAY = {
  themes: ['light', 'mid', 'dark'],
  sizes: ['std', 'lg', 'xl'],
  keys: { theme: 'wkmath.display.theme', fs: 'wkmath.display.fs' },
  get: function () { return { theme: __displayState.theme, fs: __displayState.fs }; },
  set: function (patch) {
    if (patch && this.themes.indexOf(patch.theme) >= 0) __displayState.theme = patch.theme;
    if (patch && this.sizes.indexOf(patch.fs) >= 0) __displayState.fs = patch.fs;
    window.localStorage.setItem(this.keys.theme, __displayState.theme);
    window.localStorage.setItem(this.keys.fs, __displayState.fs);
    var h = __capture.docHandlers && __capture.docHandlers['wk:display'];
    if (h) h({ type: 'wk:display', detail: { theme: __displayState.theme, fs: __displayState.fs } });
    return __displayState;
  }
};

/* 造一个指针事件 */
function pe(x, y, opts) {
  opts = opts || {};
  var ev = {
    pointerId: opts.id === undefined ? 1 : opts.id,
    pointerType: opts.type || 'mouse',
    button: opts.button === undefined ? 0 : opts.button,
    clientX: x, clientY: y,
    pressure: opts.pressure === undefined ? 0 : opts.pressure,
    deltaX: opts.deltaX === undefined ? 0 : opts.deltaX,
    deltaY: opts.deltaY === undefined ? 0 : opts.deltaY,
    deltaMode: opts.deltaMode === undefined ? 0 : opts.deltaMode,
    shiftKey: !!opts.shift, metaKey: !!opts.meta, ctrlKey: !!opts.ctrl,
    key: opts.key || '',
    preventDefault: function () {}, stopPropagation: function () {}
  };
  ev.getCoalescedEvents = function () { return [ev]; };
  ev.target = opts.target || null;
  return ev;
}

/* 用指针事件画一笔 */
function draw(pts, opts) {
  canvasEl._h.pointerdown(pe(pts[0][0], pts[0][1], opts));
  for (var i = 1; i < pts.length; i++) canvasEl._h.pointermove(pe(pts[i][0], pts[i][1], opts));
  var last = pts[pts.length - 1];
  canvasEl._h.pointerup(pe(last[0], last[1], opts));
}
