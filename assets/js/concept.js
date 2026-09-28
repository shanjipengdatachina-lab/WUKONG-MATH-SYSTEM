/* ==========================================================================
   知识点卡片交互 (concept.js)
   --------------------------------------------------------------------------
   对应「唯一入口 → 知识点卡片」这套新结构，一个知识点一张卡：
     1. 学段视角：小学铺垫 / 初中 / 高中延伸 —— 换的是滤镜，不是知识点
     2. 版本聚合：切换教材版本，只高亮它在各版本里的章节点位
     3. 数轴演示：三要素可逐个关掉，直观验证「缺一不可」；点 P 可拖拽读数
     4. 目录滚动高亮
     5. 未生成卡片的知识点给出诚实提示，不做假跳转
   依赖 shell.js 暴露的 window.MathSite。
   ========================================================================== */

(function () {
  'use strict';

  var MS = window.MathSite;
  if (!MS) return;

  var qs = MS.qs;
  var qsa = MS.qsa;
  var toast = MS.toast;

  /* ------------------------------------------------------------------ *
   * 1. 学段视角
   * ------------------------------------------------------------------ */

  var STAGE_NAME = { primary: '小学铺垫', junior: '初中', senior: '高中延伸' };

  function setStage(stage) {
    qsa('[data-stage-panel]').forEach(function (panel) {
      if (panel.getAttribute('data-stage-panel') === stage) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });

    var note = qs('#kp-current-stage');
    if (note) note.innerHTML = '当前视角：<b>' + (STAGE_NAME[stage] || '初中') + '</b>';

    // 逐节目录只在初中（主体）视角成立
    var toc = qs('#kp-toc');
    var hint = qs('#kp-toc-hint');
    var isJunior = stage === 'junior';
    if (toc) { if (isJunior) toc.removeAttribute('hidden'); else toc.setAttribute('hidden', ''); }
    if (hint) { if (isJunior) hint.setAttribute('hidden', ''); else hint.removeAttribute('hidden'); }

    if (!isJunior) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  document.addEventListener('math:select', function (event) {
    var el = event.detail && event.detail.el;
    if (!el) return;
    var stage = el.getAttribute('data-stage');
    if (stage) setStage(stage);
  });

  // 网络区的「跨学段」入口
  qsa('[data-stage-jump]').forEach(function (item) {
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    function jump() {
      var chip = qs('.seg__item[data-stage="' + item.getAttribute('data-stage-jump') + '"]');
      if (chip) chip.click();
    }
    item.addEventListener('click', jump);
    item.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jump(); }
    });
  });

  /* ------------------------------------------------------------------ *
   * 2. 版本聚合
   * ------------------------------------------------------------------ */

  var VERSION_NAME = { rj: '人教版', bsd: '北师大版', sk: '苏科版' };

  function setVersion(version) {
    qsa('.kp-ver').forEach(function (chip) {
      chip.classList.toggle('kp-ver--on', chip.getAttribute('data-ver') === version);
    });
    var note = qs('#kp-current-version');
    if (note) note.textContent = VERSION_NAME[version] || '人教版';
  }

  var versionSelect = qs('#kp-version');
  if (versionSelect) {
    versionSelect.addEventListener('change', function () {
      setVersion(versionSelect.value);
      toast('已切换到' + (VERSION_NAME[versionSelect.value] || '') + '：同一个知识点，编排位置不同', 'info', 2600);
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. 数轴演示
   * ------------------------------------------------------------------ */

  (function initNumberLine() {
    var demo = qs('#nl-demo');
    var point = qs('#nl-point');
    var svg = qs('.nl__svg');
    if (!demo || !point || !svg) return;

    var VIEW_W = 680;          // 与 SVG viewBox 宽度一致
    var ORIGIN_X = 340;        // 原点在 viewBox 中的横坐标
    var UNIT = 56;             // 一个单位长度对应的像素
    var MIN = -4.5;
    var MAX = 4.5;

    var current = 2.5;
    var dragging = false;
    var lastVerdict = null;

    function fmt(value) {
      return String(value).replace('-', '\u2212');   // 使用真正的负号 −
    }
    function clamp(value) {
      return Math.max(MIN, Math.min(MAX, value));
    }
    function valueFromX(x) {
      return clamp(Math.round(((x - ORIGIN_X) / UNIT) * 2) / 2);   // 吸附到 0.5
    }
    function xFromValue(value) {
      return ORIGIN_X + value * UNIT;
    }
    function xFromEvent(event) {
      var rect = svg.getBoundingClientRect();
      return (event.clientX - rect.left) * (VIEW_W / rect.width);
    }
    function parts() {
      var state = {};
      qsa('.nl-sw', demo).forEach(function (sw) {
        state[sw.getAttribute('data-part')] = sw.getAttribute('aria-pressed') === 'true';
      });
      return state;
    }

    function renderReadout() {
      var state = parts();
      var readout = qs('#nl-readout');
      if (!readout) return;
      if (!state.unit) {
        readout.innerHTML = '读不出坐标——没有单位长度，就不知道「一格」是多远。';
      } else {
        readout.innerHTML = '点 P 表示 <b class="m">' + fmt(current) + '</b>';
      }
    }

    function renderVerdict() {
      var state = parts();
      var missing = [];
      if (!state.origin) missing.push('原点');
      if (!state.direction) missing.push('正方向');
      if (!state.unit) missing.push('单位长度');
      var ok = missing.length === 0;
      if (ok === lastVerdict) return;
      lastVerdict = ok;

      var verdict = qs('#nl-verdict');
      if (!verdict) return;
      verdict.setAttribute('data-ok', String(ok));
      verdict.innerHTML = '<i data-lucide="' + (ok ? 'check' : 'x') + '" style="width:15px;height:15px"></i>' +
        '<span>' + (ok ? '这是一条数轴：三要素齐全。'
                       : '还不是数轴：缺了 ' + missing.join('、') + '。') + '</span>';
      MS.icons();
    }

    function render() {
      var state = parts();
      demo.setAttribute('data-part-origin', state.origin ? 'on' : 'off');
      demo.setAttribute('data-part-direction', state.direction ? 'on' : 'off');
      demo.setAttribute('data-part-unit', state.unit ? 'on' : 'off');
      renderVerdict();
      renderReadout();
    }

    function place(value) {
      current = clamp(value);
      var x = xFromValue(current);
      var dot = qs('.nl-point__dot', point);
      var hit = qs('.nl-point__hit', point);
      var label = qs('#nl-point-label');
      if (dot) dot.setAttribute('cx', x);
      if (hit) hit.setAttribute('cx', x);
      if (label) {
        label.setAttribute('x', x);
        label.textContent = 'P = ' + fmt(current);
      }
      point.setAttribute('aria-valuenow', String(current));
      point.setAttribute('aria-valuetext', '点 P 表示 ' + fmt(current));
      renderReadout();
    }

    // 三要素开关
    qsa('.nl-sw', demo).forEach(function (sw) {
      sw.addEventListener('click', function () {
        var on = sw.getAttribute('aria-pressed') === 'true';
        sw.setAttribute('aria-pressed', String(!on));
        lastVerdict = null;   // 强制刷新判定文案
        render();
      });
    });

    // 整条数轴都可点、可拖：命中区域大，触屏也好用
    function startDrag(event) {
      dragging = true;
      demo.setAttribute('data-dragging', 'true');
      // SVG 元素不会因点击自动获得焦点，需显式聚焦，否则键盘微调失效
      if (point.focus) { try { point.focus(); } catch (err) { /* 忽略 */ } }
      if (svg.setPointerCapture) { try { svg.setPointerCapture(event.pointerId); } catch (err) { /* 忽略 */ } }
      place(valueFromX(xFromEvent(event)));
      event.preventDefault();
    }

    function moveDrag(event) {
      if (!dragging) return;
      place(valueFromX(xFromEvent(event)));
    }

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      demo.removeAttribute('data-dragging');
      if (svg.releasePointerCapture) { try { svg.releasePointerCapture(event.pointerId); } catch (err) { /* 忽略 */ } }
    }

    svg.addEventListener('pointerdown', startDrag);
    svg.addEventListener('pointermove', moveDrag);
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    point.addEventListener('keydown', function (event) {
      var step = event.shiftKey ? 1 : 0.5;
      if (event.key === 'ArrowRight') { event.preventDefault(); place(current + step); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); place(current - step); }
    });

    place(current);
    render();
  })();

  /* ------------------------------------------------------------------ *
   * 4. 目录滚动高亮
   * ------------------------------------------------------------------ */

  (function initToc() {
    var links = qsa('#kp-toc a');
    if (!links.length) return;

    var targets = links.map(function (link) {
      return { link: link, target: qs(link.getAttribute('href')) };
    }).filter(function (item) { return item.target; });

    function activate(id) {
      links.forEach(function (link) {
        if (link.getAttribute('data-toc') === id) link.setAttribute('data-active', 'true');
        else link.removeAttribute('data-active');
      });
    }

    targets.forEach(function (item) {
      item.link.addEventListener('click', function (event) {
        event.preventDefault();
        item.target.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
        activate(item.target.id);
        history.replaceState(null, '', '#' + item.target.id);
      });
    });

    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) activate(entry.target.id);
      });
    }, { rootMargin: '-72px 0px -68% 0px', threshold: 0 });

    targets.forEach(function (item) { observer.observe(item.target); });
  })();

  /* ------------------------------------------------------------------ *
   * 5. 尚未生成卡片的知识点：诚实提示，不做假跳转
   * ------------------------------------------------------------------ */

  qsa('[data-pending]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      toast('「' + link.getAttribute('data-pending') + '」的卡片还没做——当前样板只完成了「数轴」', 'info', 3000);
    });
  });
})();
