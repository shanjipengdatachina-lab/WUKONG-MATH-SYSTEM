/* ==========================================================================
   悟空数学 — 阅读与显示设置（字号方案 / 亮中暗配色）
   --------------------------------------------------------------------------
   职责只有一个：**在首屏绘制之前**，把本机设置写到 <html> 上。

     html[data-wk-fs="lg"|"xl"]         → tokens.css 里 --math-fs 的两档乘数
     html[data-wk-theme="mid"|"dark"]   → tokens.css 里那两包配色

   所以每个页面的 <head> 里都要有它，而且越早越好 —— 晚了会先看到白底、
   再"哐"地跳成暗色（首屏闪一下是最伤体验的那种小毛病）。

   为什么不做自动跟随系统配色：用户要的是"我自己选"。自动跟随会和手动选择打架，
   以后想加，再加一档「跟随系统」就行，不用改这里的结构。

   零后端、零构建：设置存在本机 localStorage。存了认不出来的值一律回默认 --
   宁可用默认，也不能因为一个坏值把页面弄成白底白字。
   ========================================================================== */
(function () {
  'use strict';

  var THEME_KEY = 'wkmath.display.theme';   /* light | mid | dark */
  var FS_KEY = 'wkmath.display.fs';         /* std | lg | xl */
  var ACCENT_KEY = 'wkmath.display.accent'; /* green | blue | violet | amber | cyan | rose */
  /* 掌握度色彩方案（用户 2026-09-30 定的）：换的是那七档状态色的一整套 ——
     轴上的彩条 / 图例条 / 筛选胶囊 / 卡片徽标全跟着走（它们只读令牌，见 tokens.css）。 */
  var SCHEME_KEY = 'wkmath.display.scheme';
  /* 面板透明度（用户 2026-10-01）：浮窗（白板的题库 / 分析 / 设置面板、数轴的考试分析与考点浮窗）
     的**底色**透明度，默认 90%。写成一个 0~1 的数落到 `--math-panel-a` 上 ——
     tokens.css 里三包配色各自用 `--math-panel` 拼出半透明底（亮 / 中 / 暗三包的色不一样，
     所以不能在这里拼色值，只给"透明度"这一个数）。 */
  var PANEL_KEY = 'wkmath.display.panel';
  var PANEL_MIN = 40;
  var PANEL_MAX = 100;
  var PANEL_DEFAULT = 90;
  /* 属性**用自己的名字空间**（data-wk-*），不用通用的 data-theme。
     踩过一次：`data-theme` 很多库与运行环境都认，实测就有环境在页面加载后把它改回 light，
     于是"选了暗色却还是亮色"，而我们的内存状态、本机存储、白板板面全都是暗的 —— 找半天。
     换了名字，谁也抢不走。（页面标签上那个老 data-theme="light" 全站没有任何代码读它。） */
  var THEME_ATTR = 'data-wk-theme';
  var FS_ATTR = 'data-wk-fs';
  var ACCENT_ATTR = 'data-wk-accent';
  var SCHEME_ATTR = 'data-wk-scheme';
  var THEMES = ['light', 'mid', 'dark'];
  var SIZES = ['std', 'lg', 'xl'];
  var ACCENTS = ['green', 'blue', 'violet', 'amber', 'cyan', 'rose', 'red'];
  /* 六个方案：松绿（默认，就是 tokens.css 里 :root 那一套）+ 五套备选。
     无障碍那套是 Okabe–Ito：色觉友好、转灰度也分得开。 */
  var SCHEMES = ['green', 'blue', 'violet', 'amber', 'cyan', 'a11y'];
  var THEME_LABEL = { light: '亮色', mid: '中色', dark: '暗色' };
  var FS_LABEL = { std: '标准', lg: '大', xl: '特大' };
  var ACCENT_LABEL = { green: '松绿', blue: '靛蓝', violet: '紫罗兰', amber: '琥珀', cyan: '青碧', rose: '玫红', red: '中国红' };
  /* 六套的名字：2026-09-30 换成亮纯色之后，六套都是"一条彩虹"，差别在**六个状态各用什么色**
     （见 tokens.css 那一节的说明）—— 所以名字按各套的调子起，与色值一一对应。 */
  var SCHEME_LABEL = {
    green: '松绿（默认）', blue: '靛蓝', violet: '紫罗兰',
    amber: '琥珀', cyan: '青碧', a11y: '无障碍'
  };
  /* 默认高亮色是松绿（Trae 的品牌绿）—— **不写属性**，它就住在 tokens.css 的 :root 里。
     这样"从没设过"和"设成松绿"在 DOM 上完全一样，不会出现"重置了但属性还挂着"的灰区。 */
  var ACCENT_DEFAULT = 'green';
  /* 色彩方案同一个口径：默认那套不写属性 */
  var SCHEME_DEFAULT = 'green';

  function pick(key, allowed, dflt) {
    var v = null;
    try { v = window.localStorage.getItem(key); } catch (err) { v = null; }
    return allowed.indexOf(v) >= 0 ? v : dflt;
  }

  /* 数值型设置：存的是个数字，夹在 [min, max] 里。存的不是数 / 越界一律回默认 ——
     和字符串那几项一个口径（宁可用默认，也不能因为一个坏值把面板弄成透明的）。 */
  function pickNum(key, min, max, dflt) {
    var v = null;
    try { v = window.localStorage.getItem(key); } catch (err) { v = null; }
    var n = parseInt(v, 10);
    if (!isFinite(n) || n < min || n > max) { return dflt; }
    return n;
  }

  function clampPanel(n) {
    var v = parseInt(n, 10);
    if (!isFinite(v)) { return PANEL_DEFAULT; }
    return Math.max(PANEL_MIN, Math.min(PANEL_MAX, v));
  }

  function current() {
    return {
      theme: pick(THEME_KEY, THEMES, 'light'),
      fs: pick(FS_KEY, SIZES, 'std'),
      accent: pick(ACCENT_KEY, ACCENTS, ACCENT_DEFAULT),
      scheme: pick(SCHEME_KEY, SCHEMES, SCHEME_DEFAULT),
      panel: pickNum(PANEL_KEY, PANEL_MIN, PANEL_MAX, PANEL_DEFAULT)
    };
  }

  /* 落到 <html> 上。
     标准字号与默认高亮色**不写属性** —— 见上面 ACCENT_DEFAULT 的说明。
     主题一律写：亮色就是 :root，写 light 结果相同。 */
  function apply(state) {
    var el = document.documentElement;
    if (!el || !el.setAttribute) return state;
    el.setAttribute(THEME_ATTR, state.theme);
    if (state.fs === 'std') el.removeAttribute(FS_ATTR);
    else el.setAttribute(FS_ATTR, state.fs);
    if (state.accent === ACCENT_DEFAULT) el.removeAttribute(ACCENT_ATTR);
    else el.setAttribute(ACCENT_ATTR, state.accent);
    if (state.scheme === SCHEME_DEFAULT) el.removeAttribute(SCHEME_ATTR);
    else el.setAttribute(SCHEME_ATTR, state.scheme);
    /* 面板透明度：一个 0~1 的数，落在 <html> 的行内样式上（tokens.css 的
       `--math-panel` 三包配色都用它拼底）。默认值**照样写** —— 它是行内样式，
       写不写都要覆盖掉上一次的，不然"调低又调回 90%"会留下旧的数。 */
    if (el.style && el.style.setProperty) {
      el.style.setProperty('--math-panel-a', String(clampPanel(state.panel) / 100));
    }
    return state;
  }

  function read() { return apply(current()); }

  function broadcast(state) {
    /* 通知一声：白板的板面与全局配色共用同一个真值（见 whiteboard.js 的 setTheme）。
       没有 CustomEvent 的环境就跳过，不影响设置本身生效。 */
    try {
      if (typeof window.CustomEvent === 'function' && document.dispatchEvent) {
        document.dispatchEvent(new window.CustomEvent('wk:display', { detail: state }));
      }
    } catch (err) { /* 忽略 */ }
  }

  function set(patch) {
    var next = current();
    if (patch && THEMES.indexOf(patch.theme) >= 0) next.theme = patch.theme;
    if (patch && SIZES.indexOf(patch.fs) >= 0) next.fs = patch.fs;
    if (patch && ACCENTS.indexOf(patch.accent) >= 0) next.accent = patch.accent;
    if (patch && SCHEMES.indexOf(patch.scheme) >= 0) next.scheme = patch.scheme;
    if (patch && patch.panel !== undefined && patch.panel !== null) next.panel = clampPanel(patch.panel);
    try {
      window.localStorage.setItem(THEME_KEY, next.theme);
      window.localStorage.setItem(FS_KEY, next.fs);
      window.localStorage.setItem(ACCENT_KEY, next.accent);
      window.localStorage.setItem(SCHEME_KEY, next.scheme);
      window.localStorage.setItem(PANEL_KEY, String(next.panel));
    } catch (err) { /* 存不了也照样当场生效，只是刷新后回到默认 */ }
    apply(next);
    broadcast(next);
    return next;
  }

  var GROUPS = [
    { sel: '#set-fs [data-wk-fs]', attr: 'fs', dom: 'data-wk-fs', keys: SIZES },
    { sel: '#set-theme [data-wk-theme]', attr: 'theme', dom: 'data-wk-theme', keys: THEMES },
    { sel: '#set-accent [data-wk-accent]', attr: 'accent', dom: 'data-wk-accent', keys: ACCENTS },
    { sel: '#set-scheme [data-wk-scheme]', attr: 'scheme', dom: 'data-wk-scheme', keys: SCHEMES }
  ];

  function paintPressed(items, dom, value) {
    Array.prototype.forEach.call(items, function (el) {
      var on = (el.getAttribute(dom) || '') === value;
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (el.classList) {
        if (on) el.classList.add('is-on'); else el.classList.remove('is-on');
      }
    });
  }

  /* 设置页那两行按钮：DOM 写在页面里，绑定写在这里 ——
     免得"长什么样"和"怎么生效"分在两个文件里，改一处忘一处。 */
  function bind() {
    if (!document.querySelectorAll) return;
    var state = current();
    GROUPS.forEach(function (g) {
      var items = document.querySelectorAll(g.sel);
      if (!items || !items.length) return;
      paintPressed(items, g.dom, state[g.attr]);
      Array.prototype.forEach.call(items, function (btn) {
        if (!btn.addEventListener) return;
        btn.addEventListener('click', function () {
          var patch = {};
          patch[g.attr] = btn.getAttribute(g.dom);
          var next = set(patch);
          paintPressed(items, g.dom, next[g.attr]);
        });
      });
    });
    /* 面板透明度那颗滑块（不是 seg，是 range）：**拖动过程中就生效** ——
       它调的就是浮窗的底，所见即所得，不必等松手。`#set-panel-out` 是旁边那个百分数。 */
    var range = document.querySelector('#set-panel-range');
    if (range && range.addEventListener) {
      var out = document.querySelector('#set-panel-out');
      var paint = function (v) {
        if (out) { out.textContent = v + '%'; }
        range.setAttribute('aria-valuetext', v + '%');
      };
      range.value = String(state.panel);
      paint(state.panel);
      range.addEventListener('input', function () { paint(set({ panel: range.value }).panel); });
    }
  }

  /* 立刻应用（这个文件是同步脚本、就在 <head> 里，所以这一步发生在首屏之前） */
  var initial = apply(current());

  window.WK_DISPLAY = {
    themes: THEMES,
    sizes: SIZES,
    accents: ACCENTS,
    schemes: SCHEMES,
    accentDefault: ACCENT_DEFAULT,
    schemeDefault: SCHEME_DEFAULT,
    themeLabel: THEME_LABEL,
    fsLabel: FS_LABEL,
    accentLabel: ACCENT_LABEL,
    schemeLabel: SCHEME_LABEL,
    panelMin: PANEL_MIN,
    panelMax: PANEL_MAX,
    panelDefault: PANEL_DEFAULT,
    keys: { theme: THEME_KEY, fs: FS_KEY, accent: ACCENT_KEY, scheme: SCHEME_KEY, panel: PANEL_KEY },
    initial: initial,
    get: current,
    set: set,
    apply: apply,
    read: read,
    bind: bind
  };

  /* 设置页的按钮要等 DOM 出来才绑得上 */
  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () { bind(); });
  }
})();
