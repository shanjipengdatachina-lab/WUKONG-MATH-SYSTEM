/* ==========================================================================
   订单与账单（assets/js/orders-live.js）
   --------------------------------------------------------------------------
   这一页原来那张表是**写死在 HTML 里的假订单**（4 笔 + 2 张发票）。
   现在订单改读 /api/me/orders：真单据、真金额、真状态。

   两件事必须在这一页看得出来：
     · 哪一单走的是**测试通道** —— 否则对账的人会以为那笔钱真收到了
     · 发票**没做** —— 留着两张看起来很真的假发票，比空着更糟

   依赖：assets/js/api.js（取数）、assets/js/auth-client.js（身份）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  if (!API) { return; }

  var curEl = document.querySelector('.cur');
  /* 注意拿的是 **tbody**，不是整个 table：
     给 <table> 赋 innerHTML 会把 colgroup 和 thead 一起冲掉（表头就没了），
     而且页面看起来还挺正常 —— 只是表头不见了。 */
  var rowsEl = document.querySelector('[data-qa="orders-rows"]');
  var countEl = document.querySelector('[data-qa="orders-count"]');
  if (!rowsEl) { return; }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 金额一律两位小数 —— 这一页是给人对账用的，写 "19 元" 不如 "¥19.00" 清楚 */
  function yuan(cents) {
    return '¥' + (cents / 100).toFixed(2);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function dateText(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  var STATUS = {
    paid: { text: '已支付', cls: 'badge--ok' },
    pending: { text: '待支付', cls: 'badge--wait' },
    expired: { text: '已超时', cls: 'badge--wait' },
    canceled: { text: '已取消', cls: 'badge--wait' },
  };

  function renderOrders(list) {
    if (countEl) { countEl.textContent = '共 ' + list.length + ' 笔'; }

    if (!list.length) {
      rowsEl.innerHTML = '<tr><td colspan="5">还没有订单 —— 去' +
        '<a class="link-plain" href="membership.html">会员中心</a>选一档。</td></tr>';
      return;
    }

    var rows = list.map(function (o) {
      var s = STATUS[o.status] || { text: o.status, cls: '' };
      return '<tr>' +
        '<td class="ord-mono">' + esc(o.orderNo) + '</td>' +
        /* 测试通道的单就在这里标出来 —— 不标的话，这一页看起来就像真的收过钱 */
        '<td>' + esc(o.planName) + (o.isTest ? ' <span class="badge badge--wait">测试</span>' : '') + '</td>' +
        '<td class="num">' + yuan(o.amountCents) + '</td>' +
        '<td><span class="badge ' + s.cls + '">' + esc(s.text) + '</span></td>' +
        '<td class="ord-mono">' + esc(when(o.paidAt || o.createdAt)) + '</td>' +
        '</tr>';
    }).join('');

    rowsEl.innerHTML = rows;
  }

  function renderCurrent(ent) {
    if (!curEl) { return; }
    var plan = ent && ent.plan;

    if (!ent) {
      curEl.innerHTML =
        '<span class="cur__badge">未登录</span>' +
        '<p class="cur__text">登录之后这里会显示你当前的方案，上面那张表才看得到你自己的订单。</p>' +
        '<div class="cur__actions"><a class="btn btn--primary" href="login.html">登录</a></div>';
      return;
    }

    var name = plan ? plan.name : '免费版';
    var free = !plan || plan.code === 'free';
    var text = free
      ? '当前为<strong>' + esc(name) + '</strong>，还没有买过套餐。'
      : '当前为<strong>' + esc(name) + '</strong>' +
        (ent.endAt
          ? '，' + dateText(ent.endAt) + ' 到期' + (ent.daysLeft === null ? '' : '（还剩 ' + ent.daysLeft + ' 天）')
          : '，不过期') + '。';

    curEl.innerHTML =
      '<span class="cur__badge"' + (ent.isMember ? ' data-vip="1"' : '') + '>' + esc(name) + '</span>' +
      '<p class="cur__text">' + text + '</p>' +
      '<div class="cur__actions">' +
      '<a class="btn btn--ghost" href="membership.html" data-dom-id="orders-renew">' +
      (free ? '去开通' : '续费') + '</a></div>';
  }

  function start() {
    API.get('/me/orders').then(
      function (d) { renderOrders((d && d.items) || []); },
      function (err) {
        if (countEl) { countEl.textContent = '未登录'; }
        /* 401 不是"错误"，是"还没登录" —— 给一条能走的路，不是一句失败 */
        if (err && err.status === 401) {
          rowsEl.innerHTML = '<tr><td colspan="5">要登录才看得到订单 —— ' +
            '<a class="link-plain" href="login.html">去登录</a></td></tr>';
          return;
        }
        rowsEl.innerHTML = '<tr><td colspan="5">订单没取到：' +
          esc((err && err.message) || '接口没通') + '</td></tr>';
      },
    );

    if (!AUTH) { renderCurrent(null); return; }
    AUTH.ready().then(function (u) {
      if (!u) { renderCurrent(null); return; }
      API.get('/me/entitlement').then(renderCurrent, function () { renderCurrent(null); });
    }, function () { renderCurrent(null); });
  }

  start();
}());
