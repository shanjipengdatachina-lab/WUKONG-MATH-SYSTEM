/* ============================================================
   pages.js 自检用的极简 DOM 桩：只搭出章节树的必要结构
   册 → 章 A（带节列表，默认展开） / 章 B（带节列表，默认收起） / 章 C（无节列表）
   ============================================================ */
function out(line) {
  if (typeof console !== 'undefined' && console.log) console.log(line);
  else print(line);
}

function node(spec) {
  spec = spec || {};
  var el = {
    tagName: String(spec.tag || 'div').toUpperCase(),
    className: spec.className || '',
    _attrs: spec.attrs || {},
    _map: spec.map || {},
    _parent: spec.parent || null,
    handlers: {},
    children: [],
    style: {},
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    removeAttribute: function (k) { delete this._attrs[k]; },
    addEventListener: function (t, fn) { this.handlers[t] = fn; },
    appendChild: function (c) { this.children.push(c); return c; },
    remove: function () {},
    closest: function (sel) {
      var n = this;
      while (n) {
        if (sel === 'li' && n.tagName === 'LI') return n;
        n = n._parent;
      }
      return null;
    },
    querySelector: function (sel) {
      var hit = this._map[sel];
      if (!hit) return null;
      return Array.isArray(hit) ? (hit[0] || null) : hit;
    },
    querySelectorAll: function (sel) {
      var hit = this._map[sel];
      if (!hit) return [];
      return Array.isArray(hit) ? hit : [hit];
    }
  };
  return el;
}

var subA = node({ tag: 'ul', attrs: { 'data-subtree': 'expanded' } });
var subB = node({ tag: 'ul', attrs: { 'data-subtree': 'collapsed' } });
var liA = node({ tag: 'li', map: { 'ul[data-subtree]': subA } });
var liB = node({ tag: 'li', map: { 'ul[data-subtree]': subB } });
var liC = node({ tag: 'li' });
subA._parent = liA;
subB._parent = liB;

var chA = node({ tag: 'a', className: 'ch-row', attrs: { 'data-chapter': '01' }, parent: liA });
var chB = node({ tag: 'a', className: 'ch-row', attrs: { 'data-chapter': '02' }, parent: liB });
var chC = node({ tag: 'a', className: 'ch-row', attrs: { 'data-chapter': '03' }, parent: liC });

var chapterList = node({ tag: 'ul', attrs: { 'data-subtree': 'expanded' } });
var volumeHead = node({ tag: 'div' });
var volume = node({ tag: 'section', map: { '.volume-head': volumeHead, 'ul.chapter-list': chapterList } });

var tree = node({
  tag: 'aside',
  map: { '.tree-volume': [volume], '.ch-row': [chA, chB, chC] }
});

var document = {
  readyState: 'complete',
  querySelector: function (sel) { return sel === '#chapter-tree' ? tree : null; },
  querySelectorAll: function () { return []; },
  getElementById: function () { return null; },
  addEventListener: function () {},
  createElement: function (tag) { return node({ tag: tag }); }
};

var window = {
  location: { pathname: '/reader.html' },
  addEventListener: function () {},
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  MathSite: {
    qs: function (sel, root) { return (root || document).querySelector(sel); },
    qsa: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },
    toast: function () {},
    store: {
      get: function (k, fallback) { return fallback === undefined ? null : fallback; },
      set: function () {},
      remove: function () {}
    },
    currentPage: function () { return 'reader'; },
    icons: function () {}
  }
};
