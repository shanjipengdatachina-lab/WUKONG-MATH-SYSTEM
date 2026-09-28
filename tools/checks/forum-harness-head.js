/* ============================================================
   论坛自检用的最小 DOM 桩
   通过 __FORUM_PAGE 决定提供哪一页的元素（home / thread）
   ============================================================ */
var print = function (s) { console.log(String(s)); };

var __capture = { store: {}, toasts: [], iconCalls: 0, replaced: [], pushed: [], focus: [], els: {} };

var PAGE = (typeof __FORUM_PAGE !== 'undefined') ? __FORUM_PAGE : 'home';
var SEARCH = (typeof __FORUM_SEARCH !== 'undefined') ? __FORUM_SEARCH : '';
var PROBE_ID = (typeof __FORUM_PROBE !== 'undefined') ? __FORUM_PROBE : 'p3';

function mkFEl(id, tag) {
  var el = {
    id: id,
    tagName: String(tag || 'div').toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    attrs: {},
    handlers: {},
    countEl: null,
    getAttribute: function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
    removeAttribute: function (k) { delete this.attrs[k]; },
    addEventListener: function (t, fn) { this.handlers[t] = fn; },
    focus: function () { __capture.focus.push(id); },
    querySelector: function (sel) { return sel === '.board__count' ? this.countEl : null; }
  };
  __capture.els[id] = el;
  return el;
}

var HOME_IDS = ['forum-list', 'forum-count', 'forum-sec-title', 'forum-compose-box',
  'forum-compose-open', 'forum-compose-cancel', 'compose-submit', 'compose-title',
  'compose-board', 'compose-body', 'forum-board-link'];
var THREAD_IDS = ['thread-body', 'thread-title', 'thread-tag', 'thread-meta',
  'thread-views', 'thread-floors', 'thread-board', 'reply-text', 'reply-submit'];
var BOARD_IDS = ['board-list', 'board-crumb-name', 'board-title', 'board-desc', 'board-stats'];
var MINE_IDS = ['mine-posts', 'mine-replies', 'mine-desc', 'mine-count-posts',
  'mine-count-replies', 'mine-tab-posts', 'mine-tab-replies'];
var IDS = PAGE === 'thread' ? THREAD_IDS
  : PAGE === 'board' ? BOARD_IDS
    : PAGE === 'mine' ? MINE_IDS
      : HOME_IDS;
IDS.forEach(function (id) { mkFEl(id); });

/* 专题页的三种排序 */
var sortEls = ['reply', 'post', 'replies'].map(function (id) {
  var el = mkFEl('sort-' + id, 'a');
  el.attrs['data-sort'] = id;
  return el;
});

/* 专题卡片与标签页 */
var cardEls = ['study', 'help', 'exam'].map(function (id) {
  var el = mkFEl('card-' + id, 'a');
  el.attrs['data-board'] = id;
  el.countEl = { textContent: '' };
  el.attrs.href = 'forum.html?board=' + id;
  return el;
});
var tabEls = ['latest', 'hot'].map(function (id) {
  var el = mkFEl('tab-' + id, 'a');
  el.attrs['data-tab'] = id;
  return el;
});

var document = {
  title: '',
  getElementById: function (id) { return __capture.els[id] || null; },
  querySelector: function () { return null; },
  querySelectorAll: function (sel) {
    if (sel === '[data-board]') return cardEls;
    if (sel === '[data-tab]') return tabEls;
    if (sel === '[data-sort]') return sortEls;
    return [];
  },
  addEventListener: function () {},
  createElement: function (tag) { return mkFEl('tmp-' + tag, tag); }
};
/* 页面上的「专题」下拉：默认第一个；发帖表单初始是收起的（对应 HTML 的 hidden 属性） */
if (__capture.els['compose-board']) __capture.els['compose-board'].value = 'study';
if (__capture.els['forum-compose-box']) __capture.els['forum-compose-box'].hidden = true;

var window = {
  location: { pathname: '/forum.html', search: SEARCH },
  history: {
    replaceState: function (state, title, url) { __capture.replaced.push(url); },
    pushState: function (state, title, url) { __capture.pushed.push(url); }
  },
  localStorage: {
    getItem: function (k) { return __capture.store[k] === undefined ? null : __capture.store[k]; },
    setItem: function (k, v) { __capture.store[k] = String(v); },
    removeItem: function (k) { delete __capture.store[k]; }
  },
  addEventListener: function () {},
  MathSite: {
    toast: function (msg) { __capture.toasts.push(String(msg)); },
    icons: function () { __capture.iconCalls++; }
  }
};
window.self = window;
window.top = window;
