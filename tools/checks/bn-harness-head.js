/* ============================================================
   论坛轮播自检 —— 极简 DOM 桩 + 可控定时器
   ------------------------------------------------------------
   轮播这类东西的坑几乎都在"时间"和"状态"上：定时器没清、悬停没暂停、
   手动翻页后不重新计时、只有一张却还画出圆点。所以桩里必须有一个
   **能数、能手动拨**的定时器，否则这些事根本断言不了。
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

/* ---------- 可控时钟 ---------- */
var __clock = { seq: 0, timers: [], cleared: 0 };
function setInterval(fn, ms) {
  var id = ++__clock.seq;
  __clock.timers.push({ id: id, fn: fn, ms: ms });
  return id;
}
function clearInterval(id) {
  __clock.cleared++;
  __clock.timers = __clock.timers.filter(function (t) { return t.id !== id; });
}
/* 拨一次表：把所有活着的定时器各触发一次 */
function tick() {
  __clock.timers.slice().forEach(function (t) { t.fn(); });
}
function liveTimers() { return __clock.timers.length; }
function liveIntervalMs() { return __clock.timers.length ? __clock.timers[0].ms : 0; }
function resetClock() { __clock.seq = 0; __clock.timers = []; __clock.cleared = 0; }

/* ---------- DOM 桩 ---------- */
function matches(el, sel) {
  sel = String(sel).trim();
  if (sel.charAt(0) === '.') {
    var cls = sel.slice(1);
    return String(el.className || '').split(/\s+/).indexOf(cls) >= 0;
  }
  var attr = sel.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (attr) {
    var v = el.getAttribute ? el.getAttribute(attr[1]) : null;
    return attr[2] === undefined ? v !== null : v === attr[2];
  }
  return String(el.tagName).toLowerCase() === sel.toLowerCase();
}

function mkEl(tag) {
  var self = {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    id: '',
    style: {},
    _attrs: {},
    _h: {},
    children: [],
    textContent: '',
    innerHTML: '',
    hidden: false,
    parentNode: null,
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    removeAttribute: function (k) { delete this._attrs[k]; },
    hasAttribute: function (k) { return this._attrs[k] !== undefined; },
    addEventListener: function (t, fn) { this._h[t] = fn; },
    removeEventListener: function (t) { delete this._h[t]; },
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild: function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    focus: function () {},
    closest: function (sel) {
      var cur = this;
      while (cur) { if (matches(cur, sel)) return cur; cur = cur.parentNode; }
      return null;
    },
    querySelectorAll: function (sel) {
      var out = [];
      (function walk(node) {
        (node.children || []).forEach(function (c) {
          if (matches(c, sel)) out.push(c);
          walk(c);
        });
      })(self);
      return out;
    },
    querySelector: function (sel) { return this.querySelectorAll(sel)[0] || null; },
    /* 触发一次事件（模拟用户动手） */
    fire: function (type, ev) {
      if (this._h[type]) this._h[type](ev || { clientX: 0, clientY: 0, preventDefault: function () {}, stopPropagation: function () {} });
    }
  };
  self.classList = {
    add: function (c) { if (!self.classList.contains(c)) self.className = (self.className ? self.className + ' ' : '') + c; },
    remove: function (c) {
      self.className = String(self.className || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' ');
    },
    contains: function (c) { return String(self.className || '').split(/\s+/).indexOf(c) >= 0; }
  };
  return self;
}

var __els = {};
function elById(id) {
  if (!__els[id]) { __els[id] = mkEl('div'); __els[id].id = id; }
  return __els[id];
}

var document = {
  getElementById: function (id) { return __els[id] || null; },
  createElement: function (tag) { return mkEl(tag); },
  addEventListener: function () {},
  querySelector: function () { return null; }
};

/* 页面上的轮播挂载点 */
var bannerRoot = elById('forum-banner');

/* 系统"减少动态效果"的开关由用例控制 */
var __MATCH = {};
var window = {
  matchMedia: function (q) { return { matches: !!__MATCH[q] }; },
  addEventListener: function () {},
  WK_BANNERS: []
};
window.self = window;
