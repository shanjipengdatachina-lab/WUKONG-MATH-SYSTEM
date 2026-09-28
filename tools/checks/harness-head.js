/* ============================================================
   验证用最小 DOM 桩：让 assets/js/reader-live.js 能在
   osascript -l JavaScript（JavaScriptCore）里跑起来做逻辑自检
   ============================================================ */

if (typeof print !== 'function') {
  var print = function (s) { console.log(String(s)); };
}

var __capture = {
  artInner: '__AUTHORED__',
  outlineHidden: false,
  outlineItems: [],
  scrollCalls: [],
  treeHandlers: {},
  artHandlers: {},
  collapseHandler: null,
  leftHandler: null,
  rightHandler: null,
  sideHandler: null,
  docHandlers: {},
  docListeners: {},
  store: {},
  treeInner: '',
  created: [],
  winHandlers: {},
  winListeners: {},
  bodyChildren: []
};

/* 同一事件可以注册多个处理：docHandlers[type] 变成"全都调一遍"的派发器 */
function bindCollector(bag, listeners) {
  return function (type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
    bag[type] = function () {
      var args = arguments;
      listeners[type].forEach(function (h) { h.apply(null, args); });
    };
  };
}

function mkFakeEl(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    textContent: '',
    id: '',
    attrs: {},
    children: [],
    handlers: {},
    setAttribute: function (k, v) { this.attrs[k] = v; },
    removeAttribute: function (k) { delete this.attrs[k]; },
    getAttribute: function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    appendChild: function (c) { this.children.push(c); return c; },
    addEventListener: function (type, fn) { this.handlers[type] = fn; }
  };
}

var __heads = [
  { tagName: 'H2', id: '', textContent: '2.1　整式', getBoundingClientRect: function () { return { top: 10 }; } },
  { tagName: 'H3', id: '', textContent: '合并同类项', getBoundingClientRect: function () { return { top: 500 }; } }
];

var art = {
  get innerHTML() { return __capture.artInner; },
  set innerHTML(v) { __capture.artInner = v; },
  addEventListener: function (type, fn) { __capture.artHandlers[type] = fn; },
  querySelectorAll: function (sel) { return sel === 'h2, h3' ? __heads : []; },
  getBoundingClientRect: function () { return { top: 0 }; }
};

var outlineList = {
  innerHTML: '',
  appendChild: function (c) { __capture.outlineItems.push(c); return c; }
};

var outlineBlock = {
  setAttribute: function (k) { if (k === 'hidden') __capture.outlineHidden = true; },
  removeAttribute: function (k) { if (k === 'hidden') __capture.outlineHidden = false; }
};

var treeEl = {
  contains: function () { return true; },
  addEventListener: function (type, fn) { __capture.treeHandlers[type] = fn; },
  querySelectorAll: function () { return []; },
  querySelector: function () { return null; }
};

/* 左栏学段条 + 由 reader-live.js 现建的目录树 */
function mkChip(code) {
  return {
    _attrs: { 'data-stage': code },
    className: 'tree-stage__chip',
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = v; }
  };
}
var stageChips = [mkChip('primary'), mkChip('junior'), mkChip('senior'), mkChip('olympiad')];
var stageBarEl = {
  _attrs: {},
  handlers: {},
  getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  setAttribute: function (k, v) { this._attrs[k] = v; },
  addEventListener: function (type, fn) { this.handlers[type] = fn; },
  querySelectorAll: function (sel) { return sel === '[data-stage]' ? stageChips : []; },
  contains: function () { return true; }
};
var treeBodyEl = {
  _html: '',
  get innerHTML() { return this._html; },
  set innerHTML(v) { this._html = v; __capture.treeInner = v; },
  querySelector: function () { return null; }
};
var treeMetaEl = {
  textContent: '',
  _attrs: {},
  getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  setAttribute: function (k, v) { this._attrs[k] = v; }
};

/* 三栏骨架 + 左栏收起按钮 */
var shellStub = {
  _attrs: {},
  getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  setAttribute: function (k, v) { this._attrs[k] = v; },
  removeAttribute: function (k) { delete this._attrs[k]; }
};

/* 可选前置开关（由 prelude-*.js 提供）：
   __SHELL_LEFT_DEFAULT —— 页面是否声明「左栏默认展开」
   __PRELOAD_STORE      —— 预置上一次落盘的显隐状态  */
if (typeof __SHELL_LEFT_DEFAULT === 'string') {
  shellStub._attrs['data-left-default'] = __SHELL_LEFT_DEFAULT;
}
if (typeof __PRELOAD_STORE === 'object' && __PRELOAD_STORE) {
  for (var __pk in __PRELOAD_STORE) {
    if (Object.prototype.hasOwnProperty.call(__PRELOAD_STORE, __pk)) {
      __capture.store[__pk] = __PRELOAD_STORE[__pk];
    }
  }
}

var collapseBtn = {
  _attrs: {},
  getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  setAttribute: function (k, v) { this._attrs[k] = v; },
  removeAttribute: function (k) { delete this._attrs[k]; },
  addEventListener: function (type, fn) { if (type === 'click') __capture.collapseHandler = fn; }
};

function mkPanelBtn(key) {
  return {
    _attrs: {},
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = v; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    addEventListener: function (type, fn) { if (type === 'click') __capture[key] = fn; }
  };
}

var leftBtn = mkPanelBtn('leftHandler');
var rightBtn = mkPanelBtn('rightHandler');
var sideBtn = mkPanelBtn('sideHandler');

/* 侧栏「全屏」按钮 + 页面全屏能力（ide-shell.js 的全屏模式） */
var fsLabel = {
  textContent: '全屏',
  getAttribute: function () { return null; },
  setAttribute: function () {}
};
var fsBtn = {
  _attrs: {},
  hidden: false,
  handlers: {},
  getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  setAttribute: function (k, v) { this._attrs[k] = v; },
  removeAttribute: function (k) { delete this._attrs[k]; },
  addEventListener: function (type, fn) { this.handlers[type] = fn; },
  querySelector: function (sel) { return sel === '.ide-rail__label' ? fsLabel : null; }
};

/* 侧栏链接（自检「当前页入口不再重载」）：指向本页 / 指向别页 / 带参数 */
function mkRailLink(href) {
  return {
    _attrs: { href: href },
    handlers: {},
    blurred: false,
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = v; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    hasAttribute: function (k) { return this._attrs[k] !== undefined; },
    addEventListener: function (type, fn) { this.handlers[type] = fn; },
    blur: function () { this.blurred = true; }
  };
}

/* 侧栏本体（自检「点完收起」） */
var railStub = {
  handlers: {},
  addEventListener: function (type, fn) { this.handlers[type] = fn; }
};
var railSelfLink = mkRailLink('reader.html');        // 当前页就是 reader.html
var railOtherLink = mkRailLink('practice.html');
var railQueryLink = mkRailLink('reader.html?t=x');   // 带参数的要照常跳

var document = {
  title: '',
  getElementById: function (id) {
    if (id === 'knowledge-point') return art;
    if (id === 'chapter-tree') return treeEl;
    if (id === 'tree-body') return treeBodyEl;
    if (id === 'tree-meta') return treeMetaEl;
    if (id === 'tree-stage') return stageBarEl;
    if (id === 'page-outline') return outlineBlock;
    if (id === 'outline-list') return outlineList;
    if (id === 'tree-collapse') return collapseBtn;
    if (id === 'toggle-left') return leftBtn;
    if (id === 'toggle-right') return rightBtn;
    if (id === 'side-collapse') return sideBtn;
    if (id === 'toggle-fullscreen') return fsBtn;
    for (var i = 0; i < __heads.length; i++) if (__heads[i].id === id) return __heads[i];
    return null;
  },
  addEventListener: bindCollector(__capture.docHandlers, __capture.docListeners),
  querySelector: function (sel) {
    if (sel === '.reader-shell') return shellStub;
    if (sel === '.to-top') return toTopStub;
    if (sel === '.ide-rail') return railStub;
    return null;
  },
  querySelectorAll: function (sel) {
    if (sel === '.ide-rail a[href]') return [railSelfLink, railOtherLink, railQueryLink];
    return [];
  },
  createElement: function (tag) { var el = mkFakeEl(tag); __capture.created.push(el); return el; }
};

/* documentElement 支持整页全屏：request 后 fullscreenElement 指向它 */
document.documentElement = {
  requestFullscreen: function () { document.fullscreenElement = document.documentElement; },
  webkitRequestFullscreen: function () { document.fullscreenElement = document.documentElement; },
  setAttribute: function (k, v) { this.attrs = this.attrs || {}; this.attrs[k] = v; },
  getAttribute: function (k) { return this.attrs && this.attrs[k] !== undefined ? this.attrs[k] : null; }
};
document.exitFullscreen = function () { delete document.fullscreenElement; };

/* 页面 body 与「回到顶部」按钮（覆盖区自检用） */
document.body = mkFakeEl('body');
document.body.appendChild = function (c) { __capture.bodyChildren.push(c); return c; };
var toTopStub = { hidden: false };

var window = {
  MATH_TREE: null,
  location: {
    pathname: '/reader.html',
    search: '',
    replace: function (url) { __capture.replaced = url; }
  },
  addEventListener: bindCollector(__capture.winHandlers, __capture.winListeners),
  scrollTo: function (arg) { __capture.scrollCalls.push(arg); },
  requestAnimationFrame: function (fn) { return 1; },
  setTimeout: function (fn) { return 1; },
  history: {
    replaceState: function () {},
    pushState: function (state, title, url) { __capture.pushed = url; }
  },
  localStorage: {
    getItem: function (k) { return __capture.store[k] === undefined ? null : __capture.store[k]; },
    setItem: function (k, v) { __capture.store[k] = String(v); }
  }
};

/* 可选场景：把自己伪装成「被装进覆盖区里的页面」（window.self !== window.top） */
if (typeof __SHELL_EMBED !== 'undefined' && __SHELL_EMBED) {
  window.self = {};
  window.top = window;
}

/* 目录树里的一小段真实结构：册 → 章 → 节 → 知识点 */
function mkRow(classes, attrs) {
  return {
    _classList: classes,
    _attrs: attrs || {},
    classList: { contains: function (c) { return classes.indexOf(c) !== -1; } },
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = v; },
    removeAttribute: function (k) { delete this._attrs[k]; }
  };
}

function clickRow(row) {
  __capture.treeHandlers.click({ target: { closest: function () { return row; } }, preventDefault: function () {} });
}
