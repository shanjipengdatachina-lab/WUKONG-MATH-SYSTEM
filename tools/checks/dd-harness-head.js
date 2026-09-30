/* ============================================================
   display.js 的极小桩
   ------------------------------------------------------------
   那个文件只做三件事：读写 localStorage、往 <html> 上写属性、派一个事件。
   所以桩只需要这三样 —— 不必造一整套 DOM。
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
function eq(a, b, label) {
  assert(a === b, label + '（期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a) + '）');
}
function has(text, needle, label) {
  assert(String(text).indexOf(needle) >= 0, label + '（实际 ' + JSON.stringify(String(text)) + '）');
}

var __store = {};
var __events = [];

/* 设置页那两组按钮的桩：只记"点了谁"和"按没按下" */
function mkChip(attr, value) {
  var chip = {
    _attrs: (function () { var a = {}; a[attr] = value; return a; })(),
    _pressed: null,
    _on: false,
    _click: null,
    getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    setAttribute: function (k, v) {
      this._attrs[k] = String(v);
      if (k === 'aria-pressed') this._pressed = String(v);
    },
    addEventListener: function (t, fn) { if (t === 'click') this._click = fn; },
    click: function () { if (this._click) this._click(); },
    classList: {
      add: function (c) { if (c === 'is-on') chip._on = true; },
      remove: function (c) { if (c === 'is-on') chip._on = false; }
    }
  };
  return chip;
}
function chipSet(attr, values) {
  var out = [];
  for (var i = 0; i < values.length; i++) out.push(mkChip(attr, values[i]));
  return out;
}
/* 按钮上的属性与 <html> 上的属性同名（都是 data-wk-*），页面里就是这么写的 */
var fsChips = chipSet('data-wk-fs', ['std', 'lg', 'xl']);
var themeChips = chipSet('data-wk-theme', ['light', 'mid', 'dark']);
var accentChips = chipSet('data-wk-accent', ['green', 'blue', 'violet', 'amber', 'cyan', 'rose', 'red']);
var schemeChips = chipSet('data-wk-scheme', ['green', 'blue', 'violet', 'amber', 'cyan', 'a11y']);

var __html = {
  _attrs: {},
  setAttribute: function (k, v) { this._attrs[k] = String(v); },
  removeAttribute: function (k) { delete this._attrs[k]; },
  getAttribute: function (k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  hasAttribute: function (k) { return this._attrs[k] !== undefined; }
};

var document = {
  documentElement: __html,
  handlers: {},
  addEventListener: function (t, fn) { this.handlers[t] = fn; },
  dispatchEvent: function (ev) { __events.push(ev); if (this.handlers[ev.type]) this.handlers[ev.type](ev); },
  querySelectorAll: function (sel) {
    if (sel === '#set-fs [data-wk-fs]') return fsChips;
    if (sel === '#set-theme [data-wk-theme]') return themeChips;
    if (sel === '#set-accent [data-wk-accent]') return accentChips;
    if (sel === '#set-scheme [data-wk-scheme]') return schemeChips;
    return [];
  }
};

var window = {
  CustomEvent: function (type, opt) {
    this.type = type;
    this.detail = opt ? opt.detail : undefined;
  },
  localStorage: {
    getItem: function (k) { return __store[k] === undefined ? null : __store[k]; },
    setItem: function (k, v) { __store[k] = String(v); },
    removeItem: function (k) { delete __store[k]; }
  },
  dispatchEvent: function (ev) { document.dispatchEvent(ev); }
};
