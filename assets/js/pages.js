/* ==========================================================================
   页面级交互层 (pages.js)
   --------------------------------------------------------------------------
   设计稿只提供了静态结构，本文件按页面补齐真实交互：
     1. 通用可选组（分段控件 / 标签页 / 选择器）：单选语义 + 键盘操作
     2. 通用开关（role="switch"）：状态切换并本地记忆
     3. search.html：查询词回填、清空、搜索、按类型筛结果
     4. practice.html：选项作答判定、填空题、进度联动、提交校验
     5. forum-compose.html：富文本工具栏、标签增删、预览
     6. reader：目录树展开收起（点选换页由 reader-live.js 接管）
   依赖 shell.js 暴露的 window.MathSite；本身不引入任何第三方库。
   ========================================================================== */

(function () {
  'use strict';

  var MS = window.MathSite;
  if (!MS) return;

  var qs = MS.qs;
  var qsa = MS.qsa;
  var toast = MS.toast;
  var store = MS.store;
  var page = MS.currentPage();

  /* ------------------------------------------------------------------ *
   * 1. 通用可选组
   * ------------------------------------------------------------------ */

  var SELECTABLE = [
    '.segmented__item', '.seg__item', '.tab', '.pick',
    '.view-switch__item', '.ch-row', '.sec-row', '.pt-row', '[role="tab"]'
  ].join(', ');

  var GROUP_HOST = 'ul, ol, .seg, .segmented, .tabs, .picks, .view-switch, [role="tablist"]';

  function groupOf(el) {
    var host = el.closest(GROUP_HOST) || el.parentElement;
    if (!host) return [el];
    return qsa(SELECTABLE, host).filter(function (item) {
      return item.tagName === el.tagName && item.closest(GROUP_HOST) === host;
    });
  }

  function setActive(el, group) {
    group.forEach(function (item) {
      var on = item === el;
      if (on) item.setAttribute('data-active', 'true');
      else item.removeAttribute('data-active');

      if (item.getAttribute('role') === 'tab') {
        item.setAttribute('aria-selected', String(on));
      } else if (item.tagName === 'BUTTON') {
        item.setAttribute('aria-pressed', String(on));
      }
      if (item.tagName === 'A') {
        if (on) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      }
    });
  }

  function initSelectables() {
    qsa(SELECTABLE).forEach(function (el) {
      if (el.getAttribute('data-ms-selectable') === '1') return;
      el.setAttribute('data-ms-selectable', '1');

      el.addEventListener('click', function (event) {
        var group = groupOf(el);
        if (group.length > 1) setActive(el, group);

        // 占位链接不跳转，仅切换选中态
        if (el.getAttribute('href') === '#') event.preventDefault();

        document.dispatchEvent(new CustomEvent('math:select', {
          detail: { el: el, label: (el.textContent || '').trim() }
        }));
      });

      // 分段控件 / 标签页支持左右方向键切换
      if (el.getAttribute('role') === 'tab' || el.matches('.segmented__item, .seg__item, .view-switch__item')) {
        el.addEventListener('keydown', function (event) {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          var group = groupOf(el);
          if (group.length < 2) return;
          event.preventDefault();
          var index = group.indexOf(el);
          var next = event.key === 'ArrowRight' ? index + 1 : index - 1;
          next = (next + group.length) % group.length;
          group[next].focus();
          group[next].click();
        });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. 通用开关
   * ------------------------------------------------------------------ */

  function initSwitches() {
    qsa('[role="switch"]').forEach(function (sw, index) {
      if (sw.getAttribute('data-ms-switch') === '1') return;
      sw.setAttribute('data-ms-switch', '1');

      var base = sw.classList[0] || 'sw__box';
      var onClass = base + '--on';
      var key = 'switch:' + page + ':' + (sw.getAttribute('aria-label') || index);

      function apply(on) {
        sw.setAttribute('aria-checked', String(on));
        sw.classList.toggle(onClass, on);
      }

      // 以设计稿的初始状态为准，其次读取本地记忆
      var remembered = store.get(key, null);
      if (typeof remembered === 'boolean') apply(remembered);

      sw.addEventListener('click', function () {
        var on = sw.getAttribute('aria-checked') !== 'true';
        apply(on);
        store.set(key, on);
        toast((sw.getAttribute('aria-label') || '设置') + '已' + (on ? '开启' : '关闭'), 'info', 1800);
      });

      sw.addEventListener('keydown', function (event) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          sw.click();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. 搜索页
   * ------------------------------------------------------------------ */

  function initSearch() {
    var box = qs('.sbox');
    if (!box) return;

    var input = qs('input', box);
    var clear = qs('.sbox__clear', box);
    var go = qs('.sbox__go', box);
    var tabs = qsa('.tab');

    var params = new URLSearchParams(window.location.search);
    var initial = params.get('q');

    if (initial !== null && input) {
      input.value = initial;
      var sumQ = qs('.sum__q');
      if (sumQ) sumQ.textContent = initial;
      document.title = initial + ' · 搜索结果';
    }

    function submit() {
      var value = input ? input.value.trim() : '';
      if (!value) {
        toast('请输入要搜索的关键词', 'warning');
        if (input) input.focus();
        return;
      }
      window.location.href = 'search.html?q=' + encodeURIComponent(value);
    }

    if (go) go.addEventListener('click', submit);
    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
    }
    if (clear && input) {
      clear.addEventListener('click', function () {
        input.value = '';
        input.focus();
      });
    }

    // 按类型筛选结果分组
    var groups = qsa('.grp');
    if (!groups.length || !tabs.length) return;

    function filterTabs() {
      var active = qs('.tab[data-active="true"]');
      var label = active ? (active.textContent || '').replace(/\s*\d+\s*$/, '').trim() : '全部';
      var visible = 0;
      groups.forEach(function (group) {
        var title = (qs('.grp__title', group) || {}).textContent || '';
        var show = label === '全部' || label.indexOf(title.trim()) !== -1 || title.trim().indexOf(label) !== -1;
        group.hidden = !show;
        if (show) visible++;
      });
      var sum = qs('.sum');
      if (sum) sum.setAttribute('data-filtered', String(visible));
    }

    document.addEventListener('math:select', function (event) {
      if (event.detail.el && event.detail.el.classList.contains('tab')) filterTabs();
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. 考点速练
   * ------------------------------------------------------------------ */

  function normalizeAnswer(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/[\u2212\u2013\u2014\uFF0D]/g, '-') // −–—－ -> -
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function initPractice() {
    var quiz = qs('#quiz-list');
    if (!quiz) return;

    var items = qsa('.quiz-item', quiz);
    if (!items.length) return;

    function markStatus(item, ok) {
      var head = qs('.quiz-head', item);
      if (!head) return;
      var status = qs('.quiz-status', head);
      if (!status) {
        status = document.createElement('span');
        status.className = 'quiz-status';
        head.appendChild(status);
      }
      status.setAttribute('data-tone', ok ? 'success' : 'error');
      status.innerHTML = '<i data-lucide="' + (ok ? 'check' : 'x') + '" class="quiz-status__icon"></i>' +
        '<span>' + (ok ? '正确' : '错误') + '</span>';
      MS.icons();
    }

    function updateProgress() {
      var total = items.length;
      var answered = items.filter(function (item) { return item.getAttribute('data-answered') === 'true'; }).length;
      var correct = items.filter(function (item) { return item.getAttribute('data-correct') === 'true'; }).length;

      var now = qs('.side__count-now');
      if (now) now.textContent = String(answered);
      var totalEl = qs('.side__count-total');
      if (totalEl) totalEl.textContent = '/ ' + total;
      var meta = qs('.side__meta');
      if (meta) meta.textContent = '已完成 ' + answered + ' 题 · 正确 ' + correct + ' 题';

      var bar = qs('.bar__fill');
      if (bar) bar.style.width = (total ? Math.round((answered / total) * 100) : 0) + '%';
      var barBox = qs('.bar[role="progressbar"]');
      if (barBox) {
        barBox.setAttribute('aria-valuenow', String(answered));
        barBox.setAttribute('aria-valuemax', String(total));
      }
    }

    function finish(item, ok) {
      item.setAttribute('data-answered', 'true');
      if (ok) item.setAttribute('data-correct', 'true');
      markStatus(item, ok);
      updateProgress();
    }

    items.forEach(function (item) {
      var opts = qsa('.opt', item);
      var blankInputs = qsa('input.blank', item);

      // 设计稿第 1 题自带「已答对」状态，作为初始进度
      if (qs('.quiz-status', item)) {
        item.setAttribute('data-answered', 'true');
        if (opts.some(function (opt) { return opt.getAttribute('data-state') === 'correct'; })) {
          item.setAttribute('data-correct', 'true');
        }
      }

      if (opts.length) {
        opts.forEach(function (opt) {
          opt.addEventListener('click', function () {
            if (item.getAttribute('data-answered') === 'true') return;
            var key = opts.filter(function (o) { return o.getAttribute('data-correct') === 'true'; })[0];
            var ok = opt.getAttribute('data-correct') === 'true';

            opts.forEach(function (other) {
              other.setAttribute('aria-checked', String(other === opt));
              if (other !== opt && other !== key) other.setAttribute('data-state', 'idle');
            });
            opt.setAttribute('data-state', ok ? 'correct' : 'wrong');
            if (!ok && key) key.setAttribute('data-state', 'correct');

            finish(item, ok);
          });
        });
      }

      if (blankInputs.length) {
        blankInputs.forEach(function (input) {
          input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
              event.preventDefault();
              input.blur();
            }
          });
          input.addEventListener('input', function () {
            input.removeAttribute('data-state');
          });
          input.addEventListener('blur', function () {
            var value = input.value.trim();
            if (!value) {
              input.removeAttribute('data-state');
              return;
            }
            var ok = normalizeAnswer(value) === normalizeAnswer(input.getAttribute('data-answer'));
            input.setAttribute('data-state', ok ? 'correct' : 'wrong');
            // 同题全部填空都作答后判定该题
            var filled = blankInputs.every(function (i) { return i.value.trim(); });
            if (filled && item.getAttribute('data-answered') !== 'true') {
              var allRight = blankInputs.every(function (i) {
                return i.getAttribute('data-state') === 'correct';
              });
              finish(item, allRight);
            }
          });
        });
      }
    });

    // 提交前校验：未答完不跳转
    var submit = qs('[data-dom-id="practice-submit"]');
    if (submit) {
      submit.addEventListener('click', function (event) {
        var pending = items.filter(function (item) { return item.getAttribute('data-answered') !== 'true'; });
        if (!pending.length) return;
        event.preventDefault();
        toast('还有 ' + pending.length + ' 题未作答', 'warning');
        pending[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    updateProgress();
  }

  /* ------------------------------------------------------------------ *
   * 5. 发帖页
   * ------------------------------------------------------------------ */

  function initCompose() {
    var editor = qs('.editor[contenteditable="true"]');
    var toolbar = qs('.toolbar');
    if (!editor || !toolbar) return;

    function focusEditor() {
      editor.focus();
      var selection = window.getSelection();
      if (selection && selection.rangeCount === 0) {
        var range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    function exec(command, value) {
      focusEditor();
      try {
        document.execCommand(command, false, value || null);
      } catch (err) {
        toast('当前浏览器不支持该格式操作', 'warning');
      }
    }

    var ACTIONS = {
      '加粗': function () { exec('bold'); },
      '斜体': function () { exec('italic'); },
      '无序列表': function () { exec('insertUnorderedList'); },
      '有序列表': function () { exec('insertOrderedList'); },
      '插入公式': function () {
        exec('insertHTML', '<span class="m">y = kx + b</span>&nbsp;');
      },
      '插入图片': function () {
        exec('insertHTML', '<span class="editor-media">[图片]</span>&nbsp;');
      },
      '插入链接': function () {
        var text = String(window.getSelection ? window.getSelection() : '').trim() || '链接文字';
        exec('insertHTML', '<a href="https://" target="_blank" rel="noopener">' + text + '</a>&nbsp;');
      }
    };

    var previewBox = null;

    function scrub(html) {
      return html
        .replace(/<\s*(script|style|iframe)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    }

    function togglePreview(btn) {
      if (previewBox) {
        previewBox.remove();
        previewBox = null;
        editor.hidden = false;
        btn.setAttribute('aria-pressed', 'false');
        toast('已退出预览', 'info', 1600);
        return;
      }
      previewBox = document.createElement('div');
      previewBox.className = 'editor-preview';
      previewBox.innerHTML = scrub(editor.innerHTML);
      editor.parentNode.insertBefore(previewBox, editor.nextSibling);
      editor.hidden = true;
      btn.setAttribute('aria-pressed', 'true');
      toast('预览模式：再点一次可继续编辑', 'info', 2200);
    }

    qsa('.tb', toolbar).forEach(function (btn) {
      var label = btn.getAttribute('aria-label') || '';
      if (label === '预览') {
        btn.addEventListener('click', function () { togglePreview(btn); });
        return;
      }
      var action = ACTIONS[label];
      if (action) btn.addEventListener('click', action);
    });

    // 标签增删
    function bindRemove(tag) {
      var remove = qs('button[aria-label="移除标签"]', tag);
      if (!remove) return;
      remove.addEventListener('click', function () { tag.remove(); });
    }

    qsa('.tag').forEach(bindRemove);

    var addBtn = qs('.tag-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var editing = qs('.tag--editing');
        if (editing) {
          var existing = qs('input', editing);
          if (existing) existing.focus();
          return;
        }

        var tag = document.createElement('span');
        tag.className = 'tag tag--editing';
        var field = document.createElement('input');
        field.type = 'text';
        field.maxLength = 12;
        field.placeholder = '标签名';
        field.setAttribute('aria-label', '新标签名');
        tag.appendChild(field);
        addBtn.parentNode.insertBefore(tag, addBtn);
        field.focus();

        var settled = false;
        function commit() {
          if (settled) return;
          settled = true;
          var name = field.value.trim();
          if (!name) {
            tag.remove();
            return;
          }
          if (qsa('.tag:not(.tag--editing)').length >= 6) {
            toast('最多添加 6 个标签', 'warning');
            tag.remove();
            return;
          }
          tag.classList.remove('tag--editing');
          tag.textContent = name;
          var remove = document.createElement('button');
          remove.type = 'button';
          remove.setAttribute('aria-label', '移除标签');
          remove.textContent = '×';
          tag.appendChild(remove);
          bindRemove(tag);
          toast('已添加标签「' + name + '」', 'success', 1800);
        }

        field.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            settled = true;
            tag.remove();
          }
        });
        field.addEventListener('blur', commit);
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * 6. 章节阅读：目录树
   * ------------------------------------------------------------------ */

  function initReaderTree() {
    var tree = qs('#chapter-tree');
    if (!tree) return;

    // 设计稿用 data-subtree="expanded|collapsed" 标注展开态，
    // 但未提供对应 CSS 与点击逻辑，此处补全（图标随状态切换）。
    function swapIcon(holder, name, iconClass) {
      if (!holder) return;
      var old = qs('svg, i[data-lucide]', holder);
      if (old) old.remove();
      var icon = document.createElement('i');
      icon.setAttribute('data-lucide', name);
      if (iconClass) icon.className = iconClass;
      holder.appendChild(icon);
      MS.icons();
    }

    function bindToggle(trigger, panel, iconHolder, iconClass) {
      if (!trigger || !panel) return;

      function apply(expanded) {
        panel.setAttribute('data-subtree', expanded ? 'expanded' : 'collapsed');
        trigger.setAttribute('aria-expanded', String(expanded));
        swapIcon(iconHolder, expanded ? 'chevron-down' : 'chevron-right', iconClass);
      }

      apply(panel.getAttribute('data-subtree') !== 'collapsed');

      function toggle(event) {
        if (event) event.preventDefault();
        apply(panel.getAttribute('data-subtree') !== 'expanded');
      }

      trigger.addEventListener('click', toggle);

      // 册标题是普通 div，补齐按钮语义与键盘操作
      if (trigger.tagName !== 'A') {
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
        trigger.style.cursor = 'pointer';
        trigger.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        });
      }
    }

    // 册：整册章列表展开 / 收起
    qsa('.tree-volume', tree).forEach(function (volume) {
      bindToggle(
        qs('.volume-head', volume),
        qs('ul.chapter-list', volume),
        qs('.volume-head', volume),
        'volume-head__icon'
      );
    });

    // 章：点一下就展开该章的节与知识点，并且不会把刚点的这一章点关；
    //     同时收起别的章，章节目录里始终只留当前章展开（换页由 reader-live.js 接管）
    var chapterRows = qsa('.ch-row', tree);

    function chapterSub(row) {
      var li = row.closest('li');
      return li ? qs('ul[data-subtree]', li) : null;
    }

    function applyChapter(row, sub, expanded) {
      sub.setAttribute('data-subtree', expanded ? 'expanded' : 'collapsed');
      row.setAttribute('aria-expanded', String(expanded));
    }

    chapterRows.forEach(function (row) {
      var sub = chapterSub(row);
      if (!sub) return;

      applyChapter(row, sub, sub.getAttribute('data-subtree') !== 'collapsed');

      row.addEventListener('click', function () {
        chapterRows.forEach(function (other) {
          if (other === row) return;
          var otherSub = chapterSub(other);
          if (otherSub) applyChapter(other, otherSub, false);
        });
        applyChapter(row, sub, true);
      });
    });

  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */

  function boot() {
    initSelectables();
    initSwitches();
    initSearch();
    initPractice();
    initCompose();
    initReaderTree();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
