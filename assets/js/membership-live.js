/* ==========================================================================
   会员中心 · 按后台配置渲染（assets/js/membership-live.js）
   --------------------------------------------------------------------------
   用户的口径（2026-10-05）："我们的系统收费可以在后台设置套餐和服务项目，
   然后在前台显示出来；默认出免费版本，收费版本一个半年期，一年期，三年期。"

   所以这一页**一个价格、一个权益名都不写死**：
     · 列 = 套餐（免费 / 半年 / 一年 / 三年）—— 来自 /api/plans
     · 行 = 服务项目 —— 同上
     · 当前方案 = /api/me/entitlement（判定在服务端）
   后台改一次价格，这一页刷新就变。

   下单与支付**还没接**（要先有微信商户号 / 支付宝开放平台应用）。
   所以付费档的按钮明确写成"即将开放"，而不是摆一个点不动的按钮 ——
   按钮看起来能用、点了没反应，比明说还难受。

   依赖：assets/js/api.js（取数）、assets/js/auth-client.js（身份）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  if (!API) { return; }

  var curEl = document.querySelector('.cur');
  var tableEl = document.querySelector('table.plan');
  var actionsEl = document.querySelector('.plan-actions');
  if (!tableEl) { return; }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function yuan(cents) {
    var v = cents / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }

  /** 时长怎么写人话：0 天 = 永久；182 天 = 半年；365 = 一年；1095 = 三年 */
  function durationText(days) {
    if (days === 0) { return '永久免费'; }
    if (days < 200) { return '半年'; }
    if (days < 400) { return '一年'; }
    return Math.round(days / 365) + ' 年';
  }

  function perMonth(plan) {
    if (!plan.priceCents || !plan.days) { return ''; }
    var months = plan.days / 30;
    return '≈ ' + (plan.priceCents / 100 / months).toFixed(0) + ' 元/月';
  }

  var CSS_ID = 'member-live-style';
  function injectStyle() {
    if (document.getElementById(CSS_ID)) { return; }
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent =
      '.plan th[scope="col"]{position:relative}' +
      '.plan__badge{display:inline-block;margin-left:6px;padding:0 6px;height:18px;line-height:18px;' +
      'border-radius:4px;font-size:11px;font-weight:500;background:var(--math-primary);color:#fff;vertical-align:2px}' +
      '.plan__per{display:block;margin-top:2px;font-size:calc(11px * var(--math-fs));color:var(--math-ink-3)}' +
      '.plan__orig{display:block;font-size:calc(12px * var(--math-fs));color:var(--math-ink-4);text-decoration:line-through}' +
      '.plan td.plan__value{font-variant-numeric:tabular-nums}' +
      '.plan-actions__note{margin:10px 0 0;font-size:calc(12px * var(--math-fs));line-height:1.8;color:var(--math-ink-3)}' +
      '.plan .is-current{font-weight:600;color:var(--math-primary)}';
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ *
   * 画那张对比表
   * ------------------------------------------------------------------ */
  function renderTable(data) {
    var plans = data.plans || [];
    var services = data.services || [];
    if (!plans.length) { return; }

    var cols = '<col>' + plans.map(function (p) { return '<col' + (p.featured ? ' class="hl-col"' : '') + '>'; }).join('');

    var head = '<tr><th scope="col">权益</th>' + plans.map(function (p) {
      var badge = p.featured ? '<span class="plan__badge">推荐</span>' : '';
      return '<th scope="col"' + (p.featured ? ' class="hl-col"' : '') + '>' + esc(p.name) + badge + '</th>';
    }).join('') + '</tr>';

    /* 价格那一行单独画：有原价就划线，有时长就写清"多少钱 / 多久" */
    var priceRow = '<tr><th scope="row">价格</th>' + plans.map(function (p) {
      var cell = p.priceCents === 0
        ? '0 元'
        : '<span class="plan__orig">' + (p.originalCents ? yuan(p.originalCents) + ' 元' : '') + '</span>' +
          yuan(p.priceCents) + '<span> 元 / ' + durationText(p.days) + '</span>' +
          '<span class="plan__per">' + perMonth(p) + '</span>';
      return '<td class="price' + (p.featured ? ' hl-col' : '') + '">' + cell + '</td>';
    }).join('') + '</tr>';

    var body = services.map(function (s) {
      return '<tr><th scope="row"' + (s.desc ? ' title="' + esc(s.desc) + '"' : '') + '>' + esc(s.name) + '</th>' +
        plans.map(function (p) {
          var cell = (s.values || {})[p.code] || { included: false, value: null };
          if (!cell.included) { return '<td class="no">—</td>'; }
          if (cell.value) { return '<td class="plan__value">' + esc(cell.value) + '</td>'; }
          return '<td class="yes">✓</td>';
        }).join('') + '</tr>';
    }).join('');

    tableEl.innerHTML = '<colgroup>' + cols + '</colgroup><thead>' + head + '</thead><tbody>' + priceRow + body + '</tbody>';
  }

  /* ------------------------------------------------------------------ *
   * 当前方案
   * ------------------------------------------------------------------ */
  function renderCurrent(ent) {
    if (!curEl) { return; }
    var logged = !!ent;
    var plan = ent && ent.plan;

    if (!logged) {
      curEl.innerHTML =
        '<span class="cur__badge">未登录</span>' +
        '<p class="cur__text">登录之后这里会显示你当前的方案与到期时间。' +
        '没买过任何套餐时，默认就是<strong>免费版</strong>。</p>' +
        '<div class="cur__actions"><a class="btn btn--primary" href="login.html">登录</a></div>';
      return;
    }

    var name = plan ? plan.name : '免费版';
    var text;
    if (!plan || plan.code === 'free') {
      text = '当前为<strong>' + esc(name) + '</strong>。免费版不含的权益在下面那张表里用「—」标出来了。';
    } else if (ent.endAt) {
      var d = new Date(ent.endAt);
      var date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      text = '当前为<strong>' + esc(name) + '</strong>，' + date + ' 到期' +
        (ent.daysLeft === null ? '' : '（还剩 ' + ent.daysLeft + ' 天）') + '。';
    } else {
      text = '当前为<strong>' + esc(name) + '</strong>，不过期。';
    }

    var actions = (plan && plan.code !== 'free')
      ? '<a class="btn btn--ghost" href="orders.html">查看订单与账单</a>'
      : '<span class="cur__actions-note">要开通在上面选一档</span>';

    curEl.innerHTML =
      '<span class="cur__badge"' + (ent.isMember ? ' data-vip="1"' : '') + '>' + esc(name) + '</span>' +
      '<p class="cur__text">' + text + '</p>' +
      '<div class="cur__actions">' + actions + '</div>';

    /* 当前那一列在表里标一下 */
    if (plan) {
      var ths = tableEl.querySelectorAll('thead th');
      for (var i = 1; i < ths.length; i += 1) {
        if ((ths[i].textContent || '').indexOf(plan.name) === 0) { ths[i].classList.add('is-current'); }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 底下的按钮
   * ------------------------------------------------------------------ */
  function renderActions(data) {
    if (!actionsEl) { return; }
    var paid = (data.plans || []).filter(function (p) { return p.priceCents > 0; });
    /* 这句会被拼在"当前最低 "后面，所以这里不要再写一次"最低" */
    var cheapest = paid.reduce(function (a, p) { return (p.priceCents < a.priceCents ? p : a); }, paid[0]);
    var from = paid.length ? yuan(cheapest.priceCents) + ' 元 / ' + durationText(cheapest.days) : '';

    actionsEl.innerHTML =
      '<span class="btn btn--primary btn--sm" aria-disabled="true">选一档 · 即将开放</span>' +
      '<a class="btn btn--ghost btn--sm" href="orders.html" data-dom-id="plan-orders">查看订单与账单</a>' +
      '<p class="plan-actions__note">' +
      '套餐与权益现在是<strong>后台配、前台显示</strong>：改价格、加减服务项目、上下架都在管理后台的「套餐」页，' +
      '刷新这一页就变。' +
      (from ? '当前最低 ' + from + '。' : '') +
      '<br>下单与支付还没接 —— 那一步要先有微信支付商户号与支付宝开放平台应用（企业主体 + 域名备案）。' +
      '<span data-qa="plans-version">配置版本 ' + esc(data.version || '') + '</span>' +
      '</p>';
  }

  /* ------------------------------------------------------------------ *
   * 起
   * ------------------------------------------------------------------ */
  function start() {
    injectStyle();
    API.get('/plans').then(function (data) {
      renderTable(data);
      renderActions(data);

      if (!AUTH) { renderCurrent(null); return; }
      AUTH.ready().then(function (u) {
        if (!u) { renderCurrent(null); return; }
        API.get('/me/entitlement').then(
          function (ent) { renderCurrent(ent); },
          function () { renderCurrent(null); },
        );
      }, function () { renderCurrent(null); });
    }, function (err) {
      tableEl.innerHTML = '<tbody><tr><td>套餐没取到：' + esc((err && err.message) || '接口没通') +
        '（先在管理后台确认服务在跑）</td></tr></tbody>';
    });
  }

  start();
}());
