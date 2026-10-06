/* ==========================================================================
   学习中心那几页的接线（assets/js/me-pages.js）
   --------------------------------------------------------------------------
   管：个人中心 profile · 学习进度 progress · 错题本 mistakes ·
       收藏夹 favorites · 笔记汇总 notebook

   两件事：
     1. **登录闸** —— 这几页都是"自己的数据"，没登录直接送登录页，
        并把当前这一页记在 ?next= 里，登完回来还是这一页。
     2. **把接口的数据填进原来那些写死的演示数字里** —— 布局、类名一个不动，
        只换里面的内容；渲染函数按页面各写一个，互不牵连。

   依赖：`assets/js/api.js`（取数）与 `assets/js/auth-client.js`（身份与闸）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  if (!API || !AUTH) { return; }

  var PAGE = (window.location.pathname.split('/').pop() || 'index.html');

  /* 要登录才能看的页。会员中心不在此列 —— 价目表本来就该让人先看见。 */
  var GATED = [
    'profile.html', 'progress.html', 'mistakes.html', 'favorites.html',
    'notebook.html', 'report.html', 'notifications.html', 'orders.html', 'settings.html',
  ];

  /* ---------------- 小工具 ---------------- */

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function one(sel, root) { return (root || document).querySelector(sel); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** 侧栏那些"错题本 37 / 收藏夹 24"的数字 —— 四个页面都有，统一改。 */
  function setSideCount(id, n) {
    var link = one('[data-dom-id="' + id + '"]');
    if (!link) { return; }
    var badge = one('.acct-side__count', link);
    if (badge) { badge.textContent = String(n); }
  }

  /** 错因 key → 中文（词表在 timeline-data.js，全站共用那一份） */
  function causeName(key) {
    var list = (window.WK_LEARNING && window.WK_LEARNING.causes) || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].key === key) { return list[i].name; }
    }
    return key;
  }

  function whyOf(causes) {
    if (!causes || !causes.length) { return '错因未记'; }
    return causes.map(function (c) { return causeName(c.key); }).join('、');
  }

  function kindName(kind) {
    var map = { first: '首学', review: '复习', fix: '纠错', exam: '考试' };
    return map[kind] || kind;
  }

  function dayOf(iso) { return String(iso || '').slice(0, 10); }

  /** 出错了别把页面留空 —— 在正文头部说一句人话 */
  function shout(text) {
    var host = one('.page-head') || one('.acct-main') || one('main');
    if (!host) { return; }
    var box = document.createElement('p');
    box.className = 'wk-note';
    box.setAttribute('role', 'alert');
    box.textContent = text;
    host.appendChild(box);
    if (!one('#wk-note-style')) {
      var st = document.createElement('style');
      st.id = 'wk-note-style';
      st.textContent = '.wk-note{margin:12px 0 0;padding:10px 12px;border:1px solid var(--math-border);' +
        'border-radius:var(--math-radius-md);background:var(--math-surface);color:var(--math-ink-2);' +
        'font-size:calc(13px * var(--math-fs))}';
      document.head.appendChild(st);
    }
  }

  /* ================================================================== *
   * 个人中心
   * ================================================================== */
  function renderProfile(p) {
    var s = p.stats;

    var desc = one('.page-head__desc');
    if (desc) {
      desc.textContent = (p.user.grade ? p.user.grade + ' · ' : '') +
        '已学 ' + s.learned + ' / ' + s.records + ' 格 · 平均掌握 ' + s.masteryAvg + '%';
    }

    var name = one('.id-row__name');
    if (name) { name.textContent = p.user.nickname; }
    var mark = one('.id-row__mark');
    if (mark) { mark.textContent = p.user.nickname.charAt(0); }
    var sub = one('.id-row__sub');
    if (sub) {
      sub.textContent = '@' + p.user.username +
        (p.user.grade ? ' · ' + p.user.grade : '') +
        ' · 已掌握 ' + s.mastered + ' 格 · 共 ' + s.marks + ' 个标记';
    }

    /* 四张卡：原来写的是"连续 42 天 / 已学 186 / 错题 37 / 收藏 24"，
       现在换成库里真有的四个数（"连续天数"库里没有，不编，换成"已掌握"） */
    var cells = all('.stats__item');
    var values = [
      { n: s.learned, unit: '格', label: '已学知识点' },
      { n: s.mastered, unit: '格', label: '已掌握' },
      { n: s.mistakes, unit: '道', label: '错题' },
      { n: s.favorites, unit: '条', label: '收藏内容' },
    ];
    cells.forEach(function (cell, i) {
      var v = values[i];
      if (!v) { return; }
      var num = one('.stats__num', cell);
      var lab = one('.stats__label', cell);
      if (num) { num.innerHTML = esc(v.n) + '<span class="stats__unit">' + esc(v.unit) + '</span>'; }
      if (lab) { lab.textContent = v.label; }
    });

    /* "本周计划"那一条：库里没有"计划"这个概念，改成真实的总览 */
    var blockSub = one('.block__sub');
    if (blockSub) {
      blockSub.textContent = '共 ' + s.records + ' 格 · 已学 ' + s.learned + ' 格 · 已掌握 ' +
        s.mastered + ' 格 · 平均掌握 ' + s.masteryAvg + '%';
    }
    var bar = one('.bar');
    var fill = one('.bar__fill');
    var pct = s.records ? Math.round((s.learned / s.records) * 100) : 0;
    if (bar) { bar.setAttribute('aria-valuenow', String(pct)); }
    if (fill) { fill.style.width = pct + '%'; }

    /* 最近学习：服务器给的 12 条事件 */
    var list = one('.list');
    if (list && p.recent) {
      if (!p.recent.length) {
        list.innerHTML = '<p class="wk-note">还没有学习记录。去章节页读一节，回来就有了。</p>';
      } else {
        list.innerHTML = p.recent.slice(0, 6).map(function (e) {
          var meta = kindName(e.kind) + (e.exam ? ' · ' + e.exam : '') + ' · 掌握 ' + e.mastery + '%';
          return '<a class="list__row" href="reader.html">' +
            '<span class="list__num">' + esc(e.date.slice(5)) + '</span>' +
            '<span class="list__name">' + esc(e.nodeName) + '</span>' +
            '<span class="list__meta">' + esc(meta) + '</span>' +
            '<i data-lucide="chevron-right" class="list__chev" style="width:14px;height:14px"></i>' +
            '</a>';
        }).join('');
      }
    }
  }

  /* ================================================================== *
   * 学习进度
   * ================================================================== */
  function renderProgress(p) {
    var s = p.stats;
    var pct = s.records ? Math.round((s.learned / s.records) * 100) : 0;

    var desc = one('.page-head__desc');
    if (desc) {
      desc.textContent = (p.user.grade ? p.user.grade + ' · ' : '') +
        '共 ' + s.records + ' 格 · 已学 ' + s.learned + ' 格 · 平均掌握 ' + s.masteryAvg + '%';
    }

    var kpis = all('.kpi');
    var kv = [
      { num: s.learned + '<span>/ ' + s.records + '</span>', label: '已学知识点' },
      { num: pct + '<span>%</span>', label: '总完成度' },
      { num: s.masteryAvg + '<span>%</span>', label: '平均掌握度' },
      { num: s.exams + '<span>场</span>', label: '考试记录' },
    ];
    kpis.forEach(function (k, i) {
      var v = kv[i];
      if (!v) { return; }
      var num = one('.kpi__num', k);
      var lab = one('.kpi__label', k);
      if (num) { num.innerHTML = v.num; }
      if (lab) { lab.textContent = v.label; }
    });

    var title = one('#vol-title');
    if (title) { title.textContent = '各册进度'; }
    var note = one('.sec__note');
    if (note) { note.textContent = '共 ' + p.books.length + ' 册，按完成度排序'; }

    var host = one('.vol');
    if (!host) { return; }
    var vol = one('.vol', host.parentElement) || host;
    var parent = vol.parentElement;

    /* 把原来那几根写死的条整块换掉 */
    all('.vol', parent).forEach(function (el) { el.remove(); });

    var frag = document.createElement('div');
    frag.innerHTML = p.books.map(function (b) {
      return '<div class="vol">' +
        '<div class="vol__row">' +
        '<span class="vol__name">' + esc(b.name) + '</span>' +
        '<span class="vol__chapters">' + b.chapters + ' 章</span>' +
        '<span class="vol__pct">' + b.pct + '%</span>' +
        '<span class="vol__count">' + b.learned + ' / ' + b.total + '</span>' +
        '</div>' +
        '<div class="bar"><div class="bar__fill" style="width:' + b.pct + '%"></div></div>' +
        '</div>';
    }).join('');

    var nodes = Array.prototype.slice.call(frag.children);
    var anchor = one('.sec', parent);
    if (anchor && anchor.nextSibling) {
      nodes.forEach(function (n) { parent.insertBefore(n, anchor.nextSibling); });
    } else {
      nodes.forEach(function (n) { parent.appendChild(n); });
    }
  }

  /* ================================================================== *
   * 错题本
   * ================================================================== */
  function renderMistakes(data) {
    var items = data.items || [];
    var total = data.total || 0;
    var open = items.filter(function (m) { return m.status === 'open'; }).length;
    var done = total - open;

    var desc = one('.page-head__desc');
    if (desc) { desc.textContent = '共 ' + total + ' 道错题，其中 ' + open + ' 道待订正。'; }
    setSideCount('side-mistakes', total);

    /* 三个筛选标签后面的数字 */
    var fc = all('.filter__count');
    if (fc[0]) { fc[0].textContent = String(total); }
    if (fc[1]) { fc[1].textContent = String(open); }
    if (fc[2]) { fc[2].textContent = String(done); }

    var main = one('.acct-main');
    if (!main) { return; }

    /* 原来那几块写死的分组整块换掉 */
    all('.group', main).forEach(function (el) { el.remove(); });

    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'wk-note';
      empty.textContent = '错题本是空的。做完一套题，错的会自动归档到这里。';
      main.appendChild(empty);
      return;
    }

    /* 按"章 · 节"分组（取路径最后两段）—— 与设计稿里那种分块一致 */
    var groups = [];
    var index = {};
    items.forEach(function (m) {
      var key = m.path.slice(-2).join(' · ') || m.nodeName;
      if (index[key] === undefined) {
        index[key] = groups.length;
        groups.push({ key: key, rows: [] });
      }
      groups[index[key]].rows.push(m);
    });

    var frag = document.createElement('div');
    frag.innerHTML = groups.map(function (g) {
      var rows = g.rows.map(function (m) {
        var badge = m.status === 'open'
          ? '<span class="status status--todo"><i data-lucide="circle-alert" style="width:14px;height:14px"></i>待订正</span>'
          : '<span class="status status--done"><i data-lucide="check" style="width:14px;height:14px"></i>已订正</span>';
        return '<a class="mrow" href="mistake-detail.html?id=' + m.id + '">' +
          '<div class="mrow__body">' +
          '<p class="mrow__stem">' + esc(m.nodeName) +
          ' <span class="expr">（' + m.score + ' / ' + m.full + ' 分 · 卡片 ' + m.cardNo +
          ' · 轴上第 ' + (m.cellIndex + 1) + ' 格）</span></p>' +
          '<div class="mrow__meta">' +
          '<span class="mrow__tag">' + esc(m.examName) + '</span>' +
          '<span class="mrow__reason">' + esc(whyOf(m.causes)) + '</span>' +
          '<span class="mrow__reason">' + esc(m.date) + '</span>' +
          '</div></div>' +
          '<div class="mrow__right">' + badge +
          '<i data-lucide="chevron-right" class="mrow__arrow" style="width:14px;height:14px"></i>' +
          '</div></a>';
      }).join('');

      return '<section class="group" aria-label="' + esc(g.key) + ' 错题">' +
        '<div class="group__head">' +
        '<span class="group__no">' + g.rows.length + ' 道</span>' +
        '<p class="group__name">' + esc(g.key) + '</p>' +
        '<span class="group__count">' + esc(g.rows[0].examName) + '</span>' +
        '</div>' + rows + '</section>';
    }).join('');

    var nodes = Array.prototype.slice.call(frag.children);
    nodes.forEach(function (n) { main.appendChild(n); });
  }

  /* ================================================================== *
   * 收藏夹
   * ================================================================== */
  function renderFavorites(data) {
    var items = data.items || [];
    setSideCount('side-favorites', data.total || 0);

    var desc = one('.page-head__desc');
    if (desc) {
      var latest = items.length ? dayOf(items[0].createdAt) : '';
      desc.textContent = '共 ' + (data.total || 0) + ' 条' + (latest ? '，最近一次收藏在 ' + latest : '') + '。';
    }

    var fc = one('.filter__count');
    if (fc) { fc.textContent = String(data.total || 0); }

    var host = one('.fav-list');
    if (!host) { return; }

    if (!items.length) {
      host.innerHTML = '<li><p class="wk-note">还没有收藏。在知识点页点一下收藏，就会出现在这里。</p></li>';
      return;
    }

    host.innerHTML = items.map(function (f) {
      var tag = f.kind === 'point' ? '知识点' : (f.kind === 'post' ? '帖子' : f.kind);
      var href = f.kind === 'point' ? 'reader.html' : 'index.html';
      return '<li><a class="fav" href="' + href + '">' +
        '<div class="fav__body">' +
        '<div class="fav__title">' + esc(f.title) + '</div>' +
        '<div class="fav__meta"><span class="fav__tag">' + esc(tag) + '</span>' +
        '<span class="fav__from">' + esc(f.sub || '') + '</span></div>' +
        '</div>' +
        '<i class="fav__arrow" data-lucide="chevron-right" style="width:14px;height:14px"></i>' +
        '</a></li>';
    }).join('');
  }

  /* ================================================================== *
   * 笔记汇总
   * ================================================================== */
  function renderNotes(data) {
    var items = data.items || [];

    var tabs = all('.tab__count');
    if (tabs[0]) { tabs[0].textContent = String(data.total || 0); }
    if (tabs[1]) { tabs[1].textContent = String(data.total || 0); }
    if (tabs[2]) { tabs[2].textContent = '0'; }

    var host = one('.notes');
    if (!host) { return; }

    if (!items.length) {
      host.innerHTML = '<p class="wk-note">还没有笔记。在知识点页记一条，就会出现在这里。</p>';
      return;
    }

    host.innerHTML = items.map(function (n) {
      return '<article class="note">' +
        '<div class="note__src">' +
        '<span class="note__code">' + esc(dayOf(n.updatedAt).slice(5)) + '</span>' +
        '<h2 class="note__title">' + esc(n.title) + '</h2>' +
        '<a class="note__link" href="reader.html">打开知识点' +
        '<i data-lucide="chevron-right" class="note__arrow"></i></a>' +
        '</div>' +
        '<p class="note__body">' + esc(n.body) + '</p>' +
        '<div class="note__meta">' +
        '<span class="note__tag">' + (n.nodeId === null ? '自由笔记' : '来自知识点') + '</span>' +
        '<span class="note__date">' + esc(dayOf(n.updatedAt)) + '</span>' +
        '</div></article>';
    }).join('');
  }

  /* ================================================================== *
   * 起
   * ================================================================== */
  function render(user) {
    var needProfile = (PAGE === 'profile.html' || PAGE === 'progress.html');
    var jobs = [];

    var pProfile = needProfile
      ? API.get('/me/profile').then(function (p) {
        if (PAGE === 'profile.html') { renderProfile(p); }
        else { renderProgress(p); }
        setSideCount('side-mistakes', p.stats.mistakes);
        setSideCount('side-favorites', p.stats.favorites);
        return p;
      })
      : null;
    if (pProfile) { jobs.push(pProfile); }

    if (PAGE === 'mistakes.html') {
      jobs.push(API.get('/me/mistakes').then(renderMistakes));
    }
    if (PAGE === 'favorites.html') {
      jobs.push(API.get('/me/favorites').then(renderFavorites));
    }
    if (PAGE === 'notebook.html') {
      jobs.push(API.get('/me/notes').then(renderNotes));
    }

    if (!jobs.length) { return; }

    Promise.all(jobs).then(function () {
      if (window.lucide && window.lucide.createIcons) {
        try { window.lucide.createIcons(); } catch (e) { /* 图标画不出来不致命 */ }
      }
    }, function (err) {
      shout(err && err.status === 401 ? '登录已失效，请重新登录。' : '数据没取到：' + ((err && err.message) || err));
    });
  }

  function start() {
    if (GATED.indexOf(PAGE) >= 0) {
      AUTH.requireLogin().then(function (u) { if (u) { render(u); } });
    } else {
      AUTH.ready().then(function (u) { if (u) { render(u); } });
    }
  }

  start();
}());
