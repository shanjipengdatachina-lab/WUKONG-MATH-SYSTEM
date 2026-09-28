/* ==========================================================================
   轮播组件 (banner-carousel.js)
   --------------------------------------------------------------------------
   一个不认识"论坛"的通用轮播：给它一个容器和一组条目，它自己搭起来。
   页面上有 #forum-banner 就自动挂载（数据来自 forum-banners.js）。

   规矩（逐条都能被断言守住）：
     1. 默认 8 秒一张。手动翻页后重新计时，不把自动播放永久关掉。
     2. 圆角由样式负责；这里只保证容器有 overflow:hidden 的类名。
     3. 悬停或键盘焦点进来就暂停，出去继续。
     4. 另有一个"暂停 / 继续"按钮 —— 自动轮播属于会自动更新的内容，
        无障碍规范要求给一个能停下来的机制；光靠悬停暂停对键盘用户等于没有。
     5. 系统设了"减少动态效果"→ 完全不自动播，静态停在第一张。
     6. 只有 1 张 → 不轮播，圆点与箭头不出现（避免"点了没反应"）。
        0 张 → 整块收起，不留一条空白。
     7. 非当前那张 aria-hidden 且链接 tabindex=-1，读屏与 Tab 都不会跑到看不见的图上。
     8. 图片给死宽高（不产生布局跳动）、非首张懒加载、加载失败落到渐变色底不出现裂图标。
     9. destroy() 必须清掉定时器 —— 否则重建一次就多一个定时器，翻页会越翻越快。
   ========================================================================== */
window.WK_CAROUSEL = (function () {
  'use strict';

  var INTERVAL = 8000;      // 默认 8 秒一张
  var SWIPE_MIN = 40;       // 手指横向滑动超过这个距离才算一次翻页

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* 纯函数：按上线下线时间过一遍。
     没有真后台之前这两栏基本用不上，但"公告到期自动下线"是公告的固有语义，
     接上后台当天就要用 —— 所以先在这儿，不放在界面里。 */
  function activeBanners(items, now) {
    var t = typeof now === 'number' ? now : Date.now();
    return (items || []).filter(function (b) {
      if (!b || !b.title || !b.image) return false;
      var from = Date.parse(b.from || '');
      var until = Date.parse(b.until || '');
      if (!isNaN(from) && t < from) return false;
      if (!isNaN(until) && t > until) return false;
      return true;
    });
  }

  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function nextOf(i, n) { return n ? ((i + 1) % n) : 0; }
  function prevOf(i, n) { return n ? ((i - 1 + n) % n) : 0; }

  function buildSlide(b, i, n) {
    var doc = document;
    var a = b.href ? doc.createElement('a') : doc.createElement('div');
    a.className = 'bn-slide' + (b.href ? ' bn-slide--link' : '');
    if (b.href) a.setAttribute('href', b.href);
    a.setAttribute('role', 'group');
    a.setAttribute('aria-roledescription', '幻灯片');
    a.setAttribute('aria-label', '第 ' + (i + 1) + ' 张，共 ' + n + ' 张');
    /* 非当前那张：读屏不念、Tab 不进 —— 否则 Tab 会跑到看不见的图上 */
    a.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    if (b.href && i > 0) a.setAttribute('tabindex', '-1');

    var img = doc.createElement('img');
    img.className = 'bn-img';
    img.setAttribute('src', b.image);
    img.setAttribute('alt', b.alt || '');
    img.setAttribute('width', '1280');
    img.setAttribute('height', '400');
    img.setAttribute('decoding', 'async');
    if (i > 0) img.setAttribute('loading', 'lazy');   // 首张立刻出来，其余慢慢来
    /* 图挂了就退回那块渐变色底，不留裂图标 */
    if (img.addEventListener) {
      img.addEventListener('error', function () {
        a.className = a.className + ' is-broken';
        if (img.setAttribute) img.setAttribute('alt', '');
      });
    }
    a.appendChild(img);

    var scrim = doc.createElement('span');
    scrim.className = 'bn-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    a.appendChild(scrim);

    var copy = doc.createElement('span');
    copy.className = 'bn-copy';
    copy.innerHTML =
      (b.kind ? '<span class="bn-kind">' + esc(b.kind) + '</span>' : '') +
      '<span class="bn-title">' + esc(b.title) + '</span>' +
      (b.sub ? '<span class="bn-sub">' + esc(b.sub) + '</span>' : '') +
      (b.href && b.cta ? '<span class="bn-cta">' + esc(b.cta) + '</span>' : '');
    a.appendChild(copy);
    return a;
  }

  function mount(root, items, options) {
    if (!root) return null;
    options = options || {};
    var list = (items || []).slice();
    var doc = document;

    /* 0 张：整块收起，不留一条空白 */
    if (!list.length) {
      if (root.setAttribute) root.setAttribute('hidden', 'hidden');
      root.hidden = true;
      return null;
    }
    root.hidden = false;
    if (root.removeAttribute) root.removeAttribute('hidden');
    if (root.setAttribute) root.setAttribute('data-bn-count', String(list.length));

    var n = list.length;
    var multi = n > 1;
    var interval = options.interval || INTERVAL;
    var still = (options.reducedMotion === undefined) ? reducedMotion() : !!options.reducedMotion;
    var index = 0;
    var playing = multi && !still;
    var timer = null;
    var downX = null;
    var hovered = false;
    var focused = false;

    var shell = doc.createElement('div');
    shell.className = 'bn';
    shell.setAttribute('role', 'region');
    shell.setAttribute('aria-roledescription', '轮播');
    shell.setAttribute('aria-label', '活动与公告');
    /* 自动播时不实时播报（否则一直打断读屏）；手动翻过之后才用礼貌播报 */
    shell.setAttribute('aria-live', 'off');

    var track = doc.createElement('div');
    track.className = 'bn-track';
    if (still) track.className = 'bn-track is-still';
    shell.appendChild(track);

    var slides = list.map(function (b, i) { return buildSlide(b, i, n); });
    slides.forEach(function (s) { track.appendChild(s); });

    /* 圆点与箭头：只有多于一张时才有意义 */
    var dots = [];
    if (multi) {
      var dotBox = doc.createElement('div');
      dotBox.className = 'bn-dots';
      dotBox.setAttribute('role', 'group');
      dotBox.setAttribute('aria-label', '选择第几张');
      list.forEach(function (b, i) {
        var d = doc.createElement('button');
        d.className = 'bn-dot';
        d.setAttribute('type', 'button');
        d.setAttribute('aria-label', '第 ' + (i + 1) + ' 张：' + (b.title || ''));
        d.setAttribute('aria-current', i === 0 ? 'true' : 'false');
        if (d.addEventListener) d.addEventListener('click', function () { goTo(i, true); });
        dotBox.appendChild(d);
        dots.push(d);
      });
      shell.appendChild(dotBox);
    }

    var prevBtn = null, nextBtn = null, playBtn = null;
    /* 箭头用内联 SVG，不去依赖图标库的加载时机（这层是脚本建出来的，
       createIcons() 早就跑过去了，挂 <i data-lucide> 也不会被替换成图标）。 */
    var CHEV = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="';
    if (multi) {
      prevBtn = doc.createElement('button');
      prevBtn.className = 'bn-arrow bn-arrow--prev';
      prevBtn.setAttribute('type', 'button');
      prevBtn.setAttribute('aria-label', '上一张');
      prevBtn.innerHTML = CHEV + 'M15 18l-6-6 6-6"/></svg>';
      if (prevBtn.addEventListener) prevBtn.addEventListener('click', function () { goTo(index - 1, true); });
      shell.appendChild(prevBtn);

      nextBtn = doc.createElement('button');
      nextBtn.className = 'bn-arrow bn-arrow--next';
      nextBtn.setAttribute('type', 'button');
      nextBtn.setAttribute('aria-label', '下一张');
      nextBtn.innerHTML = CHEV + 'M9 18l6-6-6-6"/></svg>';
      if (nextBtn.addEventListener) nextBtn.addEventListener('click', function () { goTo(index + 1, true); });
      shell.appendChild(nextBtn);

      /* 「减少动态效果」下根本不自动播，所以不放"暂停"按钮 ——
         放一个按下去什么都不会发生的按钮，比不放更糟。 */
      if (!still) {
        playBtn = doc.createElement('button');
        playBtn.className = 'bn-play';
        playBtn.setAttribute('type', 'button');
        if (playBtn.addEventListener) playBtn.addEventListener('click', function () { playing ? pause() : play(); });
        shell.appendChild(playBtn);
      }
    }

    function syncSlides() {
      slides.forEach(function (s, k) {
        var on = (k === index);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (list[k] && list[k].href) {
          if (on) { if (s.removeAttribute) s.removeAttribute('tabindex'); }
          else s.setAttribute('tabindex', '-1');
        }
      });
    }

    function syncPlay() {
      if (!playBtn) return;
      playBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
      playBtn.setAttribute('aria-label', playing ? '暂停轮播' : '继续轮播');
      playBtn.textContent = playing ? '暂停' : '继续';
    }

    function stopTimer() {
      if (timer !== null) { clearInterval(timer); timer = null; }
    }
    function startTimer() {
      stopTimer();
      if (!multi || still || !playing || hovered || focused) return;
      timer = setInterval(function () { goTo(index + 1); }, interval);
    }

    function goTo(i, byUser) {
      index = ((i % n) + n) % n;
      if (track.style) track.style.transform = multi ? 'translateX(' + (-index * 100) + '%)' : '';
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === index ? 'true' : 'false'); });
      syncSlides();
      if (byUser) {
        /* 手动翻过之后，读屏可以播报了 */
        shell.setAttribute('aria-live', 'polite');
        restart();
      }
      return index;
    }
    function restart() { if (playing) startTimer(); }

    function play() { playing = true; syncPlay(); startTimer(); }
    function pause() { playing = false; syncPlay(); stopTimer(); }

    if (shell.addEventListener) {
      shell.addEventListener('mouseenter', function () { hovered = true; stopTimer(); });
      shell.addEventListener('mouseleave', function () { hovered = false; restart(); });
      shell.addEventListener('focusin', function () { focused = true; stopTimer(); });
      shell.addEventListener('focusout', function () { focused = false; restart(); });
      shell.addEventListener('pointerdown', function (e) { downX = e.clientX; });
      shell.addEventListener('pointerup', function (e) {
        if (downX === null) return;
        var dx = e.clientX - downX;
        downX = null;
        if (Math.abs(dx) < SWIPE_MIN) return;   // 小抖动不算翻页
        goTo(dx < 0 ? index + 1 : index - 1, true);
      });
    }

    /* 重新挂载时先清空，否则会叠出第二套幻灯片 */
    root.innerHTML = '';
    root.appendChild(shell);

    goTo(0);
    syncPlay();
    startTimer();

    var api = {
      root: root,
      shell: shell,
      track: track,
      slides: slides,
      dots: dots,
      prevBtn: prevBtn,
      nextBtn: nextBtn,
      playBtn: playBtn,
      count: n,
      interval: interval,
      still: still,
      index: function () { return index; },
      goTo: goTo,
      next: function (byUser) { return goTo(index + 1, byUser); },
      prev: function (byUser) { return goTo(index - 1, byUser); },
      play: play,
      pause: pause,
      playing: function () { return playing; },
      timerActive: function () { return timer !== null; },
      destroy: function () {
        stopTimer();
        if (root) root.innerHTML = '';
        return true;
      }
    };
    return api;
  }

  /* 页面上有 #forum-banner 就自动挂载 */
  function boot() {
    if (typeof document === 'undefined' || !document.getElementById) return null;
    var root = document.getElementById('forum-banner');
    if (!root) return null;
    var items = activeBanners(window.WK_BANNERS || [], Date.now());
    return mount(root, items);
  }

  var instance = boot();

  return {
    INTERVAL: INTERVAL,
    SWIPE_MIN: SWIPE_MIN,
    activeBanners: activeBanners,
    nextOf: nextOf,
    prevOf: prevOf,
    mount: mount,
    boot: boot,
    instance: function () { return instance; }
  };
})();
