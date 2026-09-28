/* ==========================================================================
   交互增强层 (shell.js)
   --------------------------------------------------------------------------
   设计稿只提供了静态结构，本文件以「渐进增强」的方式补齐全站交互：
     1. 移动端抽屉导航（<=640px）
     2. ⌘K 全局搜索面板（知识点评分 + 键盘导航）
     3. 返回顶部
     4. Toast 提示
     5. 面向各页面的通用工具 API（window.MathSite）
   不依赖任何第三方库；lucide 已在页面中本地引入，此处仅负责补渲染图标。
   ========================================================================== */

(function () {
  'use strict';

  if (window.__mathShellReady) return;
  window.__mathShellReady = true;

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */

  var qs = function (sel, root) { return (root || document).querySelector(sel); };
  var qsa = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function currentPage() {
    var path = window.location.pathname.split('/').pop() || 'home.html';
    return path.replace(/\.html$/, '') || 'index';
  }

  /** localStorage 在 file:// 下可能不可用，统一降级为内存存储 */
  var memoryStore = {};
  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem('wkmath:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key)
          ? memoryStore[key]
          : fallback;
      }
    },
    set: function (key, value) {
      memoryStore[key] = value;
      try {
        window.localStorage.setItem('wkmath:' + key, JSON.stringify(value));
      } catch (err) { /* 忽略：隐私模式或 file:// */ }
      return value;
    }
  };

  function lockScroll(locked) {
    if (locked) {
      document.body.setAttribute('data-scroll-locked', 'true');
    } else if (!qs('[data-open="true"].shell-cmdk')) {
      document.body.removeAttribute('data-scroll-locked');
    }
  }

  /** 简易焦点圈定，供搜索面板使用 */
  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    var focusables = qsa(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */

  var TONE_ICON = {
    success: 'check-circle-2',
    warning: 'alert-triangle',
    error: 'x-circle',
    info: 'info'
  };

  function toastStack() {
    var stack = qs('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, tone, duration) {
    if (!message) return;
    var level = TONE_ICON[tone] ? tone : 'info';
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('data-tone', level);
    el.innerHTML =
      '<span class="toast__icon"><i data-lucide="' + TONE_ICON[level] + '"></i></span>' +
      '<span class="toast__body"></span>';
    qs('.toast__body', el).textContent = message;
    toastStack().appendChild(el);
    renderIcons();
    requestAnimationFrame(function () { el.setAttribute('data-show', 'true'); });
    window.setTimeout(function () {
      el.removeAttribute('data-show');
      window.setTimeout(function () { el.remove(); }, 240);
    }, duration || 2600);
  }

  /* ------------------------------------------------------------------ *
   * 站点导航数据（与设计稿既有路由保持一致）
   * ------------------------------------------------------------------ */

  var DRAWER_GROUPS = [
    {
      label: '学习',
      links: [
        { text: '章节索引', href: 'reader.html' },
        { text: '知识图谱', href: 'graph.html' },
        { text: '考点速练', href: 'practice.html' },
        { text: '考点总览', href: 'exams.html' },
        { text: '公式速查', href: 'formulas.html' }
      ]
    },
    {
      label: '我的',
      links: [
        { text: '个人中心', href: 'profile.html' },
        { text: '学习进度', href: 'progress.html' },
        { text: '学习报告', href: 'report.html' },
        { text: '错题本', href: 'mistakes.html', badge: '37' },
        { text: '收藏夹', href: 'favorites.html', badge: '24' },
        { text: '笔记汇总', href: 'notebook.html' },
        { text: '会员中心', href: 'membership.html' },
        { text: '消息通知', href: 'notifications.html', badge: '3' }
      ]
    },
    {
      label: '站点',
      links: [
        { text: '学习方法', href: 'methods.html' },
        { text: '易错速析', href: 'pitfalls.html' },
        { text: '论坛', href: 'forum.html' },
        { text: '帮助中心', href: 'help.html' },
        { text: '账号设置', href: 'settings.html' },
        { text: '关于本站', href: 'about.html' }
      ]
    }
  ];

  var SEARCH_POINTS = [
    { t: '有理数', m: '第 01 章', href: 'reader.html' },
    { t: '数轴、相反数与绝对值', m: '第 01 章', href: 'reader.html' },
    { t: '有理数的加减乘除与乘方', m: '第 01 章', href: 'reader.html' },
    { t: '整式的加减', m: '第 02 章', href: 'reader.html' },
    { t: '合并同类项', m: '第 02 章', href: 'reader.html' },
    { t: '一元一次方程', m: '第 03 章', href: 'reader.html' },
    { t: '几何图形初步', m: '第 04 章', href: 'reader.html' },
    { t: '相交线与平行线', m: '第 05 章', href: 'reader.html' },
    { t: '平行线的判定与性质', m: '第 05 章', href: 'reader.html' },
    { t: '实数与平方根', m: '第 06 章', href: 'reader.html' },
    { t: '平面直角坐标系', m: '第 07 章', href: 'reader.html' },
    { t: '二元一次方程组', m: '第 08 章', href: 'reader.html' },
    { t: '不等式与不等式组', m: '第 09 章', href: 'reader.html' },
    { t: '数据的收集、整理与描述', m: '第 10 章', href: 'reader.html' },
    { t: '三角形', m: '第 11 章', href: 'reader.html' },
    { t: '全等三角形', m: '第 12 章', href: 'reader.html' },
    { t: '轴对称', m: '第 13 章', href: 'reader.html' },
    { t: '整式的乘法与因式分解', m: '第 14 章', href: 'reader.html' },
    { t: '分式', m: '第 15 章', href: 'reader.html' },
    { t: '二次根式', m: '第 16 章', href: 'reader.html' },
    { t: '勾股定理', m: '第 17 章', href: 'reader.html' },
    { t: '平行四边形', m: '第 18 章', href: 'reader.html' },
    { t: '一次函数', m: '第 19 章', href: 'reader.html' },
    { t: '数据的分析', m: '第 20 章', href: 'reader.html' },
    { t: '一元二次方程', m: '第 21 章', href: 'reader.html' },
    { t: '二次函数', m: '第 22 章', href: 'reader.html' },
    { t: '旋转', m: '第 23 章', href: 'reader.html' },
    { t: '圆', m: '第 24 章', href: 'reader.html' },
    { t: '概率初步', m: '第 25 章', href: 'reader.html' },
    { t: '反比例函数', m: '第 26 章', href: 'reader.html' },
    { t: '相似', m: '第 27 章', href: 'reader.html' },
    { t: '锐角三角函数', m: '第 28 章', href: 'reader.html' },
    { t: '投影与视图', m: '第 29 章', href: 'reader.html' },
    { t: '立体图形与三视图演示', m: '交互演示', href: 'concept-3d.html' },
    { t: '公式速查表', m: '工具', href: 'formulas.html' },
    { t: '方法速学汇总', m: '工具', href: 'methods.html' },
    { t: '易错速析汇总', m: '工具', href: 'pitfalls.html' },
    { t: '考点速练', m: '练习', href: 'practice.html' },
    { t: '考点速练总览', m: '练习', href: 'exams.html' },
    { t: '错题本', m: '我的', href: 'mistakes.html' },
    { t: '收藏夹', m: '我的', href: 'favorites.html' },
    { t: '笔记汇总', m: '我的', href: 'notebook.html' },
    { t: '学习进度', m: '我的', href: 'progress.html' },
    { t: '学习报告', m: '我的', href: 'report.html' }
  ];

  var SHORTCUTS = [
    { t: '知识图谱', href: 'graph.html', icon: 'network' },
    { t: '论坛', href: 'forum.html', icon: 'messages-square' },
    { t: '帮助中心', href: 'help.html', icon: 'life-buoy' },
    { t: '个人中心', href: 'profile.html', icon: 'user' }
  ];

  /* ------------------------------------------------------------------ *
   * 2. ⌘K 全局搜索
   * ------------------------------------------------------------------ */

  function initCommandPalette() {
    var trigger = qs('.shell-search, .ide-rail__search');

    var panel = document.createElement('div');
    panel.className = 'shell-cmdk';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', '搜索知识点');
    panel.innerHTML =
      '<div class="shell-cmdk__scrim"></div>' +
      '<div class="shell-cmdk__panel">' +
      '<div class="shell-cmdk__field">' +
      '<i data-lucide="search"></i>' +
      '<input class="shell-cmdk__input" type="text" autocomplete="off" spellcheck="false" ' +
      'placeholder="搜索知识点、章节或页面" aria-label="搜索知识点">' +
      '<kbd class="shell-cmdk__esc">ESC</kbd>' +
      '</div>' +
      '<ul class="shell-cmdk__results" role="listbox" aria-label="搜索结果"></ul>' +
      '<div class="shell-cmdk__foot">' +
      '<span><span class="shell-cmdk__key">↑</span><span class="shell-cmdk__key">↓</span>选择</span>' +
      '<span><span class="shell-cmdk__key">Enter</span>跳转</span>' +
      '<span><span class="shell-cmdk__key">Esc</span>关闭</span>' +
      '</div>' +
      '</div>';
    document.body.appendChild(panel);
    renderIcons();

    var input = qs('.shell-cmdk__input', panel);
    var list = qs('.shell-cmdk__results', panel);
    var scrim = qs('.shell-cmdk__scrim', panel);
    var lastFocused = null;
    var cursor = 0;
    var rows = [];

    function render() {
      var keyword = input.value.trim().toLowerCase();
      var points = SEARCH_POINTS;
      if (keyword) {
        points = points.filter(function (item) {
          return (item.t + ' ' + item.m).toLowerCase().indexOf(keyword) !== -1;
        });
      } else {
        points = points.slice(0, 6);
      }

      var shortcuts = SHORTCUTS.filter(function (item) {
        return !keyword || item.t.toLowerCase().indexOf(keyword) !== -1;
      });

      var html = '';
      if (points.length) {
        html += '<li class="shell-cmdk__group">知识点</li>';
        html += points.map(function (item) {
          return (
            '<li role="option"><a class="shell-cmdk__item" href="' + item.href + '">' +
            '<i data-lucide="file-text"></i>' +
            '<span class="shell-cmdk__item-title">' + item.t + '</span>' +
            '<span class="shell-cmdk__item-meta">' + item.m + '</span>' +
            '</a></li>'
          );
        }).join('');
      }
      if (shortcuts.length) {
        html += '<li class="shell-cmdk__group">快捷入口</li>';
        html += shortcuts.map(function (item) {
          return (
            '<li role="option"><a class="shell-cmdk__item" href="' + item.href + '">' +
            '<i data-lucide="' + item.icon + '"></i>' +
            '<span class="shell-cmdk__item-title">' + item.t + '</span>' +
            '<span class="shell-cmdk__item-meta">页面</span>' +
            '</a></li>'
          );
        }).join('');
      }
      if (!html) {
        html = '<li class="shell-cmdk__empty">没有匹配「' +
          input.value.replace(/[<>&]/g, '') + '」的结果，按 Enter 查看全部搜索</li>';
      }

      list.innerHTML = html;
      renderIcons();

      if (keyword) {
        var more = document.createElement('li');
        more.className = 'shell-cmdk__group';
        more.innerHTML = '<a href="search.html?q=' + encodeURIComponent(input.value.trim()) +
          '" style="color:var(--math-primary);text-decoration:none">查看全部结果 →</a>';
        list.appendChild(more);
      }

      rows = qsa('.shell-cmdk__item', list);
      cursor = 0;
      highlight();
    }

    function highlight() {
      rows.forEach(function (row, index) {
        if (index === cursor) {
          row.setAttribute('data-cursor', 'true');
          if (row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
        } else {
          row.removeAttribute('data-cursor');
        }
      });
    }

    function open() {
      lastFocused = document.activeElement;
      if (lastFocused && trigger && lastFocused === trigger) lastFocused = trigger;
      panel.setAttribute('data-open', 'true');
      lockScroll(true);
      input.value = '';
      render();
      window.setTimeout(function () { input.focus(); }, 60);
    }

    function close() {
      panel.removeAttribute('data-open');
      lockScroll(false);
      if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    }

    function isOpen() { return panel.getAttribute('data-open') === 'true'; }

    if (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        open();
      });
    }

    // 全站快捷键：⌘K / Ctrl+K 打开，/ 打开，Esc 关闭
    document.addEventListener('keydown', function (event) {
      var key = event.key ? event.key.toLowerCase() : '';
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        if (isOpen()) close(); else open();
        return;
      }
      if (isOpen()) {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (rows.length) { cursor = (cursor + 1) % rows.length; highlight(); }
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (rows.length) { cursor = (cursor - 1 + rows.length) % rows.length; highlight(); }
          return;
        }
        if (event.key === 'Enter') {
          var active = rows[cursor];
          if (active) { event.preventDefault(); window.location.href = active.getAttribute('href'); }
          else if (input.value.trim()) {
            window.location.href = 'search.html?q=' + encodeURIComponent(input.value.trim());
          }
          return;
        }
        trapFocus(panel, event);
        return;
      }
      // 未打开时，非输入态按 "/" 唤起
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          event.preventDefault();
          open();
        }
      }
    });

    input.addEventListener('input', render);
    scrim.addEventListener('click', close);

    // 供其他页面复用（例如页面内搜索框）
    api.openSearch = open;
  }

  /* ------------------------------------------------------------------ *
   * 3. 返回顶部
   * ------------------------------------------------------------------ */

  function initToTop() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.setAttribute('aria-label', '返回顶部');
    btn.innerHTML = '<i data-lucide="arrow-up"></i>';
    document.body.appendChild(btn);
    renderIcons();

    var ticking = false;
    function sync() {
      ticking = false;
      if (window.scrollY > 480) btn.setAttribute('data-visible', 'true');
      else btn.removeAttribute('data-visible');
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(sync); }
    }, { passive: true });
    sync();

    btn.addEventListener('click', function () {
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. 通用表单增强
   *    设计稿为静态演示，此处负责：必填校验 -> 统一反馈 -> 按设计稿的
   *    主行动链接（.btn--primary[href]）继续跳转，避免提交导致页面重载。
   * ------------------------------------------------------------------ */

  function initForms() {
    qsa('form').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var fields = qsa('input:not([type="checkbox"]):not([type="radio"]), textarea', form);
        var empty = fields.filter(function (field) {
          return !field.disabled && !String(field.value || '').trim();
        });
        if (empty.length) {
          var first = empty[0];
          first.focus();
          first.setAttribute('aria-invalid', 'true');
          toast('请先填写「' + (first.getAttribute('placeholder') || '必填项') + '」', 'warning');
          return;
        }

        var primary = qs('.btn--primary[href]', form);
        if (primary) {
          window.location.href = primary.getAttribute('href');
          return;
        }
        toast('已提交（演示环境不会真实发送）', 'success');
      });

      qsa('input, select, textarea', form).forEach(function (field) {
        field.addEventListener('input', function () {
          field.removeAttribute('aria-invalid');
        });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. 对设计稿中的 data-active 交互标签做统一增强
   *    设计稿用 data-active 表达「当前选中」，这里补齐键盘与状态语义
   * ------------------------------------------------------------------ */

  function initActiveGroups() {
    qsa('[data-active="true"]').forEach(function (el) {
      if (el.hasAttribute('aria-current')) return;
      if (el.tagName === 'A') el.setAttribute('aria-current', 'true');
      else el.setAttribute('aria-selected', 'true');
    });
  }

  /* ------------------------------------------------------------------ *
   * 对外 API（先于 boot 定义，boot 期间会继续挂载扩展方法）
   * ------------------------------------------------------------------ */

  var api = {
    qs: qs,
    qsa: qsa,
    toast: toast,
    store: store,
    currentPage: currentPage,
    icons: renderIcons
  };
  window.MathSite = api;

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */

  function boot() {
    initCommandPalette();
    initToTop();
    initForms();
    initActiveGroups();
    renderIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
