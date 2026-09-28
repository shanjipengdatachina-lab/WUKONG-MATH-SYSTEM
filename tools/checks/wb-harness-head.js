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
var __ctxCalls = { stroke: 0, fill: 0, clear: 0, fillText: 0, texts: [] };

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
    appendChild: function (c) { this.children.push(c); return c; }
  };
  self.classList = {
    add: function (c) { self._classes[c] = true; },
    remove: function (c) { delete self._classes[c]; },
    contains: function (c) { return !!self._classes[c]; },
    toggle: function (c) { if (self._classes[c]) delete self._classes[c]; else self._classes[c] = true; }
  };
  return self;
}

var ctx = {
  setTransform: function () {}, clearRect: function () { __ctxCalls.clear++; },
  save: function () {}, restore: function () {},
  beginPath: function () {}, moveTo: function () {}, lineTo: function () {},
  quadraticCurveTo: function () {}, arc: function () {},
  rect: function () {}, roundRect: function () {}, ellipse: function () {},
  fill: function () { __ctxCalls.fill++; }, stroke: function () { __ctxCalls.stroke++; },
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
