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

    /* 容量是后台配的（免费版 50 道，在「套餐与服务项目」里改）。
       **超了也要如实说**：演示数据里就有 158 道 —— 那是导入进来的历史数据，
       不受后来配的容量约束。装作没这回事，比把话说明白更糟。 */
    var quota = data.quota;
    if (typeof quota === 'number') {
      var cap = document.createElement('p');
      cap.className = 'wk-note';
      if (quota === 0) {
        cap.innerHTML = '当前方案<strong>不含错题本</strong>。' +
          '<a href="membership.html">看会员方案</a>';
      } else if (total >= quota) {
        cap.innerHTML = '错题本已用 <strong>' + total + ' / ' + quota + '</strong> 道，满了 —— ' +
          '再做错的题不会再归档。<a href="membership.html">开通会员</a>之后不限量。';
      } else {
        cap.innerHTML = '错题本已用 <strong>' + total + ' / ' + quota + '</strong> 道。';
      }
      main.insertBefore(cap, main.firstChild);
    }

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
   * 学习报告（report.html）
   * ------------------------------------------------------------------
   * 这一页原来是**整页写死的假数字**（"第 1 周 8 / 第 4 周 18"、
   * "有理数 92%"、三条编出来的建议）。留着假的比空着更糟 ——
   * 会有人拿它对账。现在全部来自 /me/growth。
   *
   * 与后台「学生详情」用的是**同一个服务端函数**（一个 userId 走 cookie、
   * 一个走路径），所以学生看到的数和老师看到的是同一份，不会两个数打架。
   * ================================================================== */

  /** 一根横条：标签 + 进度条 + 右侧数值。空的条也给，只是宽度 0。 */
  function barRow(label, pctVal, val) {
    var w = Math.max(0, Math.min(100, Math.round(pctVal)));
    return '<div class="bar-row">' +
      '<span class="bar-row__label" title="' + esc(label) + '">' + esc(label) + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
      '<span class="bar-row__val">' + esc(val) + '</span>' +
    '</div>';
  }

  function renderReport(g) {
    var rangeEl = one('#rp-range');
    if (rangeEl) {
      rangeEl.textContent = '统计区间 ' + String(g.range.from).slice(0, 10) + ' → ' +
        String(g.range.to).slice(0, 10) +
        '（' + (g.range.granularity === 'month' ? '按月' : '按周') + '）';
    }

    var last = g.growth.length ? g.growth[g.growth.length - 1] : null;
    var pb = g.progress.buckets.length ? g.progress.buckets[g.progress.buckets.length - 1] : null;
    var done = pb ? pb.done : 0;
    var plan = pb ? pb.plan : 0;
    var behind = plan - done;
    var p = g.practice;

    /* ---- KPI ---- */
    var kpisEl = one('#rp-kpis');
    if (kpisEl) {
      var cells = [
        { n: last ? last.touched : 0, u: '格', l: '已学知识点' },
        {
          n: p.accuracy === null ? '—' : Math.round(p.accuracy * 100),
          u: p.accuracy === null ? '' : '%',
          l: '练习正确率',
        },
        { n: p.questions, u: '道', l: '做题数' },
        {
          n: behind >= 0 ? behind : -behind,
          u: '格',
          l: behind > 0 ? '落后计划' : (behind < 0 ? '超前计划' : '与计划持平'),
        },
      ];
      kpisEl.innerHTML = cells.map(function (c) {
        return '<div class="kpi">' +
          '<p class="kpi__num">' + esc(c.n) + (c.u ? '<span>' + esc(c.u) + '</span>' : '') + '</p>' +
          '<p class="kpi__label">' + esc(c.l) + '</p>' +
        '</div>';
      }).join('');
    }

    /* ---- 学习趋势：最近 8 个桶，每周"新学了几格" ----
       用"已触及格数的增量"，而不是"事件数"：事件里混着复习和订正，
       那些不叫"新学"。 */
    var trendEl = one('#rp-trend');
    if (trendEl) {
      var arr = g.growth.slice(-8);
      var rows = [];
      var maxDelta = 1;
      var deltas = arr.map(function (b, i) {
        var prev = i === 0
          ? (g.growth.length > arr.length ? g.growth[g.growth.length - arr.length - 1].touched : 0)
          : arr[i - 1].touched;
        var d = Math.max(0, b.touched - prev);
        if (d > maxDelta) { maxDelta = d; }
        return d;
      });
      arr.forEach(function (b, i) {
        rows.push(barRow(b.key, (deltas[i] / maxDelta) * 100, deltas[i] + ' 格'));
      });
      var total = deltas.reduce(function (x, y) { return x + y; }, 0);
      /* 末几周一根新学的都没有时，摆 8 根空条不如直说 ——
         而且这话本身就是这份报告最该被看到的一句。 */
      if (!rows.length || total === 0) {
        var lastKey = '';
        for (var k = g.growth.length - 1; k >= 0; k -= 1) {
          if (g.growth[k].events > 0) { lastKey = g.growth[k].key; break; }
        }
        trendEl.innerHTML = '<p class="empty">最近 ' + arr.length + ' 周没有新的学习记录' +
          (lastKey ? '（最后一次学习在 ' + esc(lastKey) + ' 那一周）' : '') + '。</p>';
      } else {
        trendEl.innerHTML = rows.join('');
      }
    }

    /* ---- 章节掌握度 ---- */
    var chEl = one('#rp-chapters');
    if (chEl) {
      chEl.innerHTML = g.byChapter.length
        ? g.byChapter.map(function (c) {
          return barRow(c.name, c.masteryAvg, c.masteryAvg + '%');
        }).join('')
        : '<p class="empty">还没有学过 3 格以上的章 —— 学过几格之后再来看这里。</p>';
    }

    /* ---- 薄弱章节：错题本 + 卷面上框出的 ---- */
    var weakEl = one('#rp-weak');
    if (weakEl) {
      weakEl.innerHTML = g.weak.length
        ? g.weak.slice(0, 8).map(function (w) {
          var parts = [];
          if (w.mistakes) { parts.push('错题 ' + w.mistakes); }
          if (w.boxes) { parts.push('框出 ' + w.boxes); }
          return '<a class="lrow" href="mistakes.html">' +
            '<span class="lrow__name">' + esc(w.name) + '</span>' +
            '<span class="lrow__val">' + esc(parts.join(' · ')) + '</span>' +
          '</a>';
        }).join('')
        : '<p class="empty">还没有错题记录 —— 错题本和卷面上框出的错题都会汇到这里。</p>';
    }

    /* ---- 下一步建议：全部由上面的真实数字推出来，不编 ----
       没有数据就不出那一条 —— 宁可只有一条真建议，也不要三条套话。 */
    var advEl = one('#rp-advice');
    if (advEl) {
      var items = [];
      if (g.byChapter.length) {
        var c0 = g.byChapter[0];
        items.push({
          t: '先补「' + c0.name + '」',
          d: '这一章你学过 ' + c0.learned + ' 格，平均掌握度只有 ' + c0.masteryAvg +
            '% —— 是目前最薄的一章。先把这里的知识点重看一遍。',
        });
      }
      if (g.weak.length) {
        var w0 = g.weak[0];
        items.push({
          t: '把「' + w0.name + '」的错题过一遍',
          d: '错题本 ' + w0.mistakes + ' 道' + (w0.boxes ? '、卷面上框出 ' + w0.boxes + ' 道' : '') +
            '，是你错得最多的一章。',
        });
      }
      if (behind > 0) {
        items.push({
          t: '进度落后计划 ' + behind + ' 格',
          d: '按计划到 ' + String(g.range.to).slice(0, 10) + ' 该学 ' + plan +
            ' 格，你已经学完 ' + done + ' 格。要么赶一赶，要么把计划调现实一点。',
        });
      } else if (p.accuracy !== null && p.accuracy < 0.8) {
        items.push({
          t: '练习正确率还有空间',
          /* 分母写的是**判得了分的题数**：白板题没有答案、判不了分，
             拿"做题数"当分母那句话就自相矛盾了（同一页上面那格就是做题数）。 */
          d: '判分了 ' + p.judged + ' 道、正确率 ' + Math.round(p.accuracy * 100) +
            '%。错题先订正再往下走，比多做新题划算。',
        });
      }
      advEl.innerHTML = items.length
        ? items.map(function (a, i) {
          return '<div class="advice">' +
            '<span class="advice__no">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
            '<div class="advice__body">' +
              '<p class="advice__title">' + esc(a.t) + '</p>' +
              '<p class="advice__desc">' + esc(a.d) + '</p>' +
            '</div>' +
          '</div>';
        }).join('')
        : '<p class="empty">数据还太少，暂时给不出建议 —— 学几格、做几次练习之后这里就有东西了。</p>';
    }

    /* ---- 打印按钮 ---- */
    var printBtn = one('#rp-print');
    if (printBtn) {
      printBtn.addEventListener('click', function () { window.print(); });
    }
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
    /* 学习报告的每一块都由 /me/growth 一块儿给出 —— 拆成几个接口的话，
       这一页会出几个各自转圈的方块，而它们本来就该一起看。 */
    if (PAGE === 'report.html') {
      jobs.push(API.get('/me/growth').then(renderReport));
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
