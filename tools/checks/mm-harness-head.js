/* ============================================================
   知识图谱自检 —— 极简 DOM 桩（osascript -l JavaScript）
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
var TOASTS = [];

function mkEl(tag) {
  var self = {
    tagName: String(tag || 'div').toUpperCase(),
    _attrs: {}, _classes: {}, _h: {}, children: [],
    textContent: '', innerHTML: '', value: '', style: {},
    offsetWidth: 320, offsetHeight: 240, focused: false,
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    removeAttribute: function (k) { delete this._attrs[k]; },
    hasAttribute: function (k) { return this._attrs[k] !== undefined; },
    addEventListener: function (t, fn) { (this._h[t] = this._h[t] || []).push(fn); },
    removeEventListener: function (t, fn) {
      var list = this._h[t] || []; var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1);
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    closest: function () { return null; },
    appendChild: function (c) { this.children.push(c); return c; },
    focus: function () { this.focused = true; },
    blur: function () { this.focused = false; },
    getBoundingClientRect: function () {
      return this._rect || { left: 0, top: 0, width: 1440, height: 900 };
    }
  };
  self.classList = {
    add: function (c) { self._classes[c] = true; },
    remove: function (c) { delete self._classes[c]; },
    contains: function (c) { return !!self._classes[c]; },
    toggle: function (c) { if (self._classes[c]) delete self._classes[c]; else self._classes[c] = true; }
  };
  return self;
}

function fire(el, type, event) {
  var ev = event || {};
  ev.type = type;
  if (!ev.preventDefault) ev.preventDefault = function () {};
  if (!ev.stopPropagation) ev.stopPropagation = function () {};
  (el._h[type] || []).slice().forEach(function (fn) { fn(ev); });
  return ev;
}

var els = {};
function elById(id) {
  if (!els[id]) { els[id] = mkEl('div'); els[id].id = id; }
  return els[id];
}

/* 画布与两块悬浮面板 */
var canvasEl = elById('mm-canvas');
canvasEl._rect = { left: 0, top: 0, width: 1440, height: 900 };
var infoPanelEl = elById('mm-panel');
infoPanelEl.setAttribute('hidden', '');
infoPanelEl._rect = { left: 1080, top: 20, width: 340, height: 420 };
infoPanelEl.offsetWidth = 340; infoPanelEl.offsetHeight = 420;
var panelHeadEl = elById('mm-panel-head');
var panelBodyEl = elById('mm-panel-body');
var panelNoEl = elById('mm-panel-no');
var panelTitleEl = elById('mm-panel-title');
var panelCloseEl = elById('mm-panel-close');
var searchPanelEl = elById('mm-search-panel');
searchPanelEl.setAttribute('hidden', '');
searchPanelEl._rect = { left: 20, top: 20, width: 320, height: 240 };
searchPanelEl.offsetWidth = 320; searchPanelEl.offsetHeight = 240;
var searchHeadEl = elById('mm-search-head');
var searchInputEl = elById('mm-search');
var searchResultsEl = elById('mm-search-results');

/* 工具条上的按钮 */
var accountEl = elById('ide-rail-account');
accountEl.setAttribute('href', 'login.html');
var avatarEl = mkEl('span');
var labelEl = mkEl('span');
labelEl.textContent = '登录';
accountEl.querySelector = function (sel) {
  if (sel === '.ide-rail__avatar') return avatarEl;
  if (sel === '.ide-rail__label') return labelEl;
  return null;
};
var loginSubmitEl = mkEl('a');
loginSubmitEl.setAttribute('data-dom-id', 'login-submit');
var logoutEl = mkEl('a');
logoutEl.setAttribute('data-dom-id', 'settings-logout');
var bookBtnEl = elById('mm-book-btn');
bookBtnEl.setAttribute('aria-expanded', 'false');
var bookMenuEl = elById('mm-book-menu');
bookMenuEl.setAttribute('hidden', '');
var levelBtnEl = elById('mm-level-btn');
levelBtnEl.setAttribute('aria-expanded', 'false');
var levelMenuEl = elById('mm-level-menu');
levelMenuEl.setAttribute('hidden', '');
var helpBtnEl = elById('mm-help-btn');
helpBtnEl.setAttribute('aria-expanded', 'false');
var helpMenuEl = elById('mm-help-menu');
helpMenuEl.setAttribute('hidden', '');
var searchToggleEl = elById('mm-search-toggle');
var searchCloseEl = elById('mm-search-close');
var bookLabelEl = elById('mm-book-label');
var levelLabelEl = elById('mm-level-label');
var scopeNoteEl = elById('mm-scope-note');
var worldEl = elById('mm-world');
var svgEl = elById('mm-svg');
var zoomLabelEl = elById('mm-zoom-label');
var totalEl = elById('mm-total');
totalEl.setAttribute('data-mm-total', '');

/* 浮层里的选项（与真实 HTML 一一对应） */
var BOOKS = ['', '七年级（上）', '七年级（下）', '八年级（上）', '八年级（下）', '九年级（上）', '九年级（下）'];
var bookItems = BOOKS.map(function (book) {
  var item = mkEl('button');
  item.setAttribute('data-book', book);
  item.setAttribute('aria-pressed', 'false');
  return item;
});
var levelItems = [2, 3, 99].map(function (depth) {
  var item = mkEl('button');
  item.setAttribute('data-fold', String(depth));
  item.setAttribute('aria-pressed', 'false');
  return item;
});

var qsaMap = {};
qsaMap['#mm-book-menu [data-book]'] = bookItems;
qsaMap['#mm-level-menu [data-fold]'] = levelItems;
qsaMap[', .segmented__item'] = [];

var window = {
  MathSite: {
    qs: function (sel) {
      if (sel && sel.charAt(0) === '#') return elById(sel.slice(1).replace(/[^A-Za-z0-9_-]/g, ''));
      return null;
    },
    qsa: function (sel) { return qsaMap[sel] || []; },
    toast: function (msg) { TOASTS.push(String(msg)); }
  },
  localStorage: {
    _d: {},
    getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  },
  requestAnimationFrame: function (fn) { if (fn) fn(); return 1; },
  lucide: { createIcons: function () {} },
  location: { pathname: '/graph.html', href: 'http://127.0.0.1:5173/graph.html', replace: function () {} },
  history: { pushState: function () {}, back: function () {} },
  addEventListener: function (t, fn) {
    this._h = this._h || {};
    (this._h[t] = this._h[t] || []).push(fn);
  },
  removeEventListener: function (t, fn) {
    var list = (this._h && this._h[t]) || [];
    var i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
};

var document = {
  readyState: 'complete',
  body: mkEl('body'),
  documentElement: mkEl('html'),
  addEventListener: function (t, fn) { (this._h = this._h || {}); (this._h[t] = this._h[t] || []).push(fn); },
  querySelector: function (sel) {
    if (sel === '.ide-rail__account') return accountEl;
    if (sel === '.reader-shell') return elById('reader-shell');
    if (sel === '.ide-rail') return elById('ide-rail');
    if (sel === '[data-dom-id="login-submit"]') return loginSubmitEl;
    if (sel === '[data-dom-id="settings-logout"]') return logoutEl;
    return null;
  },
  querySelectorAll: function () { return []; },
  getElementById: function (id) { return elById(id); },
  createElement: function (t) { return mkEl(t); }
};
window.document = document;

function docFire(type, event) {
  var ev = event || {};
  ev.type = type;
  if (!ev.preventDefault) ev.preventDefault = function () {};
  (document._h[type] || []).slice().forEach(function (fn) { fn(ev); });
}
function winFire(type, event) {
  var ev = event || {};
  ev.type = type;
  (window._h[type] || []).slice().forEach(function (fn) { fn(ev); });
}
/* 简单事件对象：够 mindmap.js 用 */
function ev(opts) {
  opts = opts || {};
  var e = {
    clientX: opts.x === undefined ? 0 : opts.x,
    clientY: opts.y === undefined ? 0 : opts.y,
    button: opts.button === undefined ? 0 : opts.button,
    key: opts.key || '', code: opts.code || '',
    shiftKey: !!opts.shift, metaKey: !!opts.meta, ctrlKey: !!opts.ctrl, altKey: !!opts.alt,
    target: opts.target || null
  };
  e.preventDefault = function () { e._prevented = true; };
  e.stopPropagation = function () {};
  return e;
}
