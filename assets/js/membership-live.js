/* ==========================================================================
   会员中心 · 按后台配置渲染 + 开通（assets/js/membership-live.js）
   --------------------------------------------------------------------------
   用户的口径（2026-10-05）："我们的系统收费可以在后台设置套餐和服务项目，
   然后在前台显示出来；默认出免费版本，收费版本一个半年期，一年期，三年期。"

   所以这一页**一个价格、一个权益名都不写死**：
     · 列 = 套餐（免费 / 半年 / 一年 / 三年）—— 来自 /api/plans
     · 行 = 服务项目 —— 同上
     · 当前方案 = /api/me/entitlement（判定在服务端）
     · 能不能开通 = /api/pay/channels（现在只有开发用测试通道）
   后台改一次价格，这一页刷新就变。

   **下单与权益生效这条链已经通了**（点「开通」→ 下单 → 付款 → 权益立刻生效）。
   但付款走的只有那一个**开发用测试通道**：它不产生任何真实收款，
   所以这一页必须把它标成"测试支付"，而不是让它长得像真实收银台 ——
   一个长得像真的假收银台，迟早骗到有人真去付钱。
   微信 Native 扫码要等商户资质（企业主体 + 商户号 + 域名备案）。

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

  var pad = function (n) { return String(n).padStart(2, '0'); };

  function dateText(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** 带时间的那个。**待支付的超时要用它** —— 只写"到今天为止"，
      而实际只有 30 分钟，读起来像有一整天可以付。 */
  function whenText(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    return dateText(iso) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
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
      '.plan .is-current{font-weight:600;color:var(--math-primary)}' +
      '.pay__box{margin-top:14px;border:1px solid var(--math-border);border-radius:var(--math-radius-md);padding:18px 20px}' +
      '.pay__box--test{border-style:dashed;background:var(--math-surface)}' +
      '.pay__box--ok{border-color:var(--math-state-success)}' +
      '.pay__flag{margin:0 0 10px;font-size:calc(13px * var(--math-fs));font-weight:500;color:var(--math-state-warning)}' +
      '.pay__line{margin:0 0 10px;font-size:calc(14px * var(--math-fs));color:var(--math-ink-2)}' +
      '.pay__line strong{color:var(--math-foreground);font-weight:600}' +
      '.pay__qr{margin:0 0 10px;padding:10px 12px;border:1px dashed var(--math-border);' +
      'border-radius:var(--math-radius-sm);font-family:var(--math-font-mono);' +
      'font-size:calc(12px * var(--math-fs));color:var(--math-ink-3);word-break:break-all}' +
      '.pay__hint{margin:0 0 12px;font-size:calc(13px * var(--math-fs));line-height:1.8;color:var(--math-ink-3)}' +
      '.pay__hint--bad{color:var(--math-state-warning)}' +
      '.pay__acts{display:flex;gap:10px;flex-wrap:wrap}';
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

    /* 操作那一行：免费版没什么可开通的，付费档给一个按钮。
       按钮就在这里，不再另跳一页 —— "选档 → 下单 → 付款"三步在一屏里走完 */
    var actRow = '<tr><th scope="row">操作</th>' + plans.map(function (p) {
      if (p.priceCents === 0) { return '<td class="no">默认就是它</td>'; }
      return '<td' + (p.featured ? ' class="hl-col"' : '') + '>' +
        '<button type="button" class="btn btn--primary btn--sm" data-buy="' + esc(p.code) + '">开通</button></td>';
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

    tableEl.innerHTML = '<colgroup>' + cols + '</colgroup><thead>' + head +
      '</thead><tbody>' + priceRow + body + actRow + '</tbody>';
  }

  /* ------------------------------------------------------------------ *
   * 当前方案
   * ------------------------------------------------------------------ */
  function renderCurrent(ent) {
    if (!curEl) { return; }

    /* **先把上一次的"当前"标记全部抹掉**再重画：
       只加不移的话，从免费版开通成一年会员之后，两列会同时标着"当前"。 */
    var ths = tableEl.querySelectorAll('thead th');
    for (var i = 1; i < ths.length; i += 1) { ths[i].classList.remove('is-current'); }

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
      text = '当前为<strong>' + esc(name) + '</strong>，' + dateText(ent.endAt) + ' 到期' +
        (ent.daysLeft === null ? '' : '（还剩 ' + ent.daysLeft + ' 天）') + '。';
    } else {
      text = '当前为<strong>' + esc(name) + '</strong>，不过期。';
    }

    var actions = (plan && plan.code !== 'free')
      ? '<a class="btn btn--ghost" href="orders.html">查看订单与账单</a>'
      : '<span class="cur__actions-note">要开通就在下面那张表里选一档</span>';

    curEl.innerHTML =
      '<span class="cur__badge"' + (ent.isMember ? ' data-vip="1"' : '') + '>' + esc(name) + '</span>' +
      '<p class="cur__text">' + text + '</p>' +
      '<div class="cur__actions">' + actions + '</div>';

    /* 当前那一列在表里标一下（上面已经清过一遍了） */
    if (plan) {
      for (var j = 1; j < ths.length; j += 1) {
        if ((ths[j].textContent || '').indexOf(plan.name) === 0) { ths[j].classList.add('is-current'); }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 底下的按钮与那句说明
   * ------------------------------------------------------------------ */
  function renderActions(data, channels) {
    if (!actionsEl) { return; }
    var paid = (data.plans || []).filter(function (p) { return p.priceCents > 0; });
    var cheapest = paid.reduce(function (a, p) { return (p.priceCents < a.priceCents ? p : a); }, paid[0]);
    var from = paid.length ? yuan(cheapest.priceCents) + ' 元 / ' + durationText(cheapest.days) : '';

    /* 全是假通道时说的话，和"有真通道"时说的话必须不一样 ——
       否则这一页会一直看起来像能收钱 */
    var testOnly = channels.length > 0 && channels.every(function (c) { return c.isTest; });

    actionsEl.innerHTML =
      '<a class="btn btn--ghost btn--sm" href="orders.html" data-dom-id="plan-orders">查看订单与账单</a>' +
      '<p class="plan-actions__note">' +
      '套餐与权益现在是<strong>后台配、前台显示</strong>：改价格、加减服务项目、上下架都在管理后台的「套餐」页，' +
      '刷新这一页就变。' +
      (from ? '当前最低 ' + from + '。' : '') +
      '<br>' +
      (testOnly
        ? '开通与权益生效这条链已经通了，但走的只有<strong>开发用测试通道</strong>，不产生真实收款。' +
          '微信扫码付款要等商户资质下来 —— 企业主体 · 微信支付商户号 · 支付宝开放平台应用 · 域名备案。'
        : '可用付款方式：' + channels.map(function (c) { return esc(c.name); }).join(' / ') + '。') +
      '<span data-qa="plans-version">配置版本 ' + esc(data.version || '') + '</span>' +
      '</p>';
  }

  /* ------------------------------------------------------------------ *
   * 开通：下单 → 付款 → 权益生效
   * ------------------------------------------------------------------ */
  var payEl = null;
  var channels = [];
  var currentOrder = null;
  var busy = false;

  function payHost() {
    if (payEl) { return payEl; }
    payEl = document.createElement('section');
    payEl.className = 'sec pay';
    payEl.setAttribute('aria-live', 'polite');
    /* 插在表格下面、那句说明上面 —— 下单的过程就在用户点的地方展开 */
    if (actionsEl && actionsEl.parentNode) {
      actionsEl.parentNode.insertBefore(payEl, actionsEl);
    } else {
      tableEl.parentNode.appendChild(payEl);
    }
    return payEl;
  }

  function payNote(html, bad) {
    payHost().innerHTML = '<p class="pay__hint' + (bad ? ' pay__hint--bad' : '') + '">' + html + '</p>';
  }

  function refreshMine() {
    if (!AUTH) { renderCurrent(null); return; }
    AUTH.ready().then(function (u) {
      if (!u) { renderCurrent(null); return; }
      API.get('/me/entitlement').then(renderCurrent, function () { renderCurrent(null); });
    }, function () { renderCurrent(null); });
  }

  function buy(planCode) {
    if (busy) { return; }
    var ch = channels[0];
    if (!ch) { payNote('现在没有可用的付款方式，稍后再试。', true); return; }

    busy = true;
    currentOrder = null;
    payNote('正在下单…');
    API.post('/orders', { planCode: planCode, channel: ch.code }).then(function (o) {
      busy = false;
      currentOrder = o;
      renderPay(o);
    }, function (err) {
      busy = false;
      /* 401 不是"错误"，是"还没登录" —— 让人去登录，别只说一句失败 */
      if (err && err.status === 401) {
        payNote('要登录才能开通 —— <a href="login.html">去登录</a>', true);
        return;
      }
      payNote('下单没成功：' + esc(err && err.message), true);
    });
  }

  function renderPay(o) {
    var prepay = o.prepay || {};
    payHost().innerHTML =
      '<div class="pay__box' + (o.isTest ? ' pay__box--test' : '') + '">' +
      (o.isTest ? '<p class="pay__flag">测试支付 · 不是真实收款</p>' : '') +
      '<p class="pay__line">' + esc(o.planName) + ' · <strong>' + yuan(o.amountCents) + ' 元</strong> · ' +
      (o.days > 0 ? o.days + ' 天' : '不过期') + '</p>' +
      '<p class="pay__line">订单号 <span class="ord-mono">' + esc(o.orderNo) + '</span>' +
      (o.expiresAt ? '（' + whenText(o.expiresAt) + ' 之前有效）' : '') + '</p>' +
      (prepay.kind === 'qrcode' && prepay.payload
        ? '<p class="pay__qr">' + esc(prepay.payload) + '</p>'
        : '') +
      (prepay.hint ? '<p class="pay__hint">' + esc(prepay.hint) + '</p>' : '') +
      '<div class="pay__acts">' +
      (o.isTest
        ? '<button type="button" class="btn btn--primary btn--sm" data-pay="dev">模拟支付成功</button>'
        : '') +
      '<button type="button" class="btn btn--ghost btn--sm" data-pay="cancel">取消</button>' +
      '</div></div>';
  }

  function devPay() {
    if (busy || !currentOrder) { return; }
    var order = currentOrder;
    busy = true;
    payNote('正在确认支付…');
    API.post('/pay/dev/pay', { orderNo: order.orderNo }).then(function (out) {
      busy = false;
      payHost().innerHTML =
        '<div class="pay__box pay__box--ok">' +
        '<p class="pay__line">已开通：<strong>' + esc(order.planName) + '</strong>' +
        (out && out.endAt ? ' · 有效期到 ' + dateText(out.endAt) : '') + '</p>' +
        '<p class="pay__hint">这一笔走的是<strong>开发用测试通道</strong>，不是真实收款，' +
        '订单上也会标着「测试」。</p>' +
        '<div class="pay__acts">' +
        '<a class="btn btn--ghost btn--sm" href="orders.html">查看订单</a>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-pay="cancel">知道了</button>' +
        '</div></div>';
      refreshMine();
    }, function (err) {
      busy = false;
      payNote('支付没成功：' + esc(err && err.message), true);
    });
  }

  /* 一处在 document 上收口，省得每次重画都得重新挂监听 */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) { return; }

    var buyBtn = t.closest('[data-buy]');
    if (buyBtn) { ev.preventDefault(); buy(buyBtn.getAttribute('data-buy')); return; }

    var payBtn = t.closest('[data-pay]');
    if (payBtn) {
      ev.preventDefault();
      if (payBtn.getAttribute('data-pay') === 'dev') { devPay(); }
      else { payHost().innerHTML = ''; }
    }
  });

  /* ------------------------------------------------------------------ *
   * 起
   * ------------------------------------------------------------------ */
  function start() {
    injectStyle();
    /* 付款方式与套餐并行取：一个是"能怎么付"，一个是"能买什么" */
    var chansP = API.get('/pay/channels').then(
      function (d) { channels = (d && d.channels) || []; },
      function () { channels = []; },
    );

    API.get('/plans').then(function (data) {
      renderTable(data);
      chansP.then(function () {
        renderActions(data, channels);
        /* 没有可用付款方式就别给按钮，一点就报错比没有按钮更难受 */
        if (!channels.length) {
          var bs = tableEl.querySelectorAll('[data-buy]');
          for (var i = 0; i < bs.length; i += 1) {
            bs[i].disabled = true;
            bs[i].textContent = '暂不可开通';
          }
        }
      });
      refreshMine();
    }, function (err) {
      tableEl.innerHTML = '<tbody><tr><td>套餐没取到：' + esc((err && err.message) || '接口没通') +
        '（先在管理后台确认服务在跑）</td></tr></tbody>';
    });
  }

  start();
}());
