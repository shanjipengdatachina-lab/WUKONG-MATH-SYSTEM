/* ==========================================================================
   账号三页的接线（assets/js/auth-pages.js）
   --------------------------------------------------------------------------
   管 login.html / register.html / password-reset.html 三个表单。
   逻辑只有一类：**校验（在本地先拦一道明显的错）→ 打接口 → 按结果说话**。
   真正的判定永远在服务端（密码规则、账号是否被占用都以后端为准），
   这里的校验只是为了少一次白跑的网络往返、以及把话说得具体一点。

   依赖 `assets/js/auth-client.js`（window.WK_AUTH）与 `assets/js/api.js`（接口地址）。
   ========================================================================== */
(function () {
  'use strict';

  var AUTH = window.WK_AUTH;
  if (!AUTH) { return; }

  function $(id) { return document.getElementById(id); }

  function say(el, text, ok) {
    if (!el) { return; }
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = text;
    el.hidden = false;
    el.className = ok ? 'auth__msg auth__msg--ok' : 'auth__msg';
  }

  function busy(btn, on, label) {
    if (!btn) { return; }
    if (on) { btn.setAttribute('aria-busy', 'true'); btn.dataset.label = btn.textContent; btn.textContent = label || '请稍候…'; }
    else { btn.removeAttribute('aria-busy'); if (btn.dataset.label) { btn.textContent = btn.dataset.label; } }
  }

  /** 服务端那条规则（apps/api 里 zod 的 password）：至少 8 位，字母与数字都要有。 */
  function passwordProblem(pw) {
    if (!pw || pw.length < 8) { return '密码至少 8 位'; }
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { return '密码要同时含字母和数字'; }
    return '';
  }

  function failMsg(err) {
    if (err && err.status === 0) { return err.message; }
    return (err && err.message) || '出了点问题，再试一次';
  }

  /* ================================================================== *
   * login.html
   * ================================================================== */
  function wireLogin() {
    var form = $('login-form');
    if (!form) { return; }
    var msg = $('login-msg');
    var btn = $('login-submit-btn');
    var account = $('login-account');
    var password = $('login-password');

    /* 已经登录了再来看登录页：说一声，别让人重复输密码 */
    AUTH.ready().then(function (u) {
      if (!u || !msg) { return; }
      say(msg, '你已经以「' + u.nickname + '」登录了。要换个账号，先退出。', true);
      var back = document.createElement('a');
      back.href = AUTH.nextTarget();
      back.textContent = '回到刚才那页';
      back.style.marginLeft = '8px';
      msg.appendChild(back);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      say(msg, '');
      var name = (account && account.value || '').trim();
      if (!name) { say(msg, '请填手机号或登录名'); if (account) { account.focus(); } return; }
      if (!password || !password.value) { say(msg, '请填密码'); if (password) { password.focus(); } return; }

      busy(btn, true, '登录中…');
      AUTH.login(name, password.value).then(
        function () { window.location.assign(AUTH.nextTarget()); },
        function (err) { busy(btn, false); say(msg, failMsg(err)); }
      );
    });
  }

  /* ================================================================== *
   * register.html
   * ================================================================== */
  function wireRegister() {
    var form = $('register-form');
    if (!form) { return; }
    var msg = $('register-msg');
    var btn = $('register-submit-btn');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      say(msg, '');
      var nickname = ($('nickname') || {}).value || '';
      var phone = (($('phone') || {}).value || '').trim();
      var password = ($('password') || {}).value || '';
      var terms = $('terms');

      if (!nickname.trim()) { say(msg, '请填昵称'); return; }
      if (!/^1\d{10}$/.test(phone)) { say(msg, '手机号要填 11 位数字（这一版手机号就是登录名）'); return; }
      var pwBad = passwordProblem(password);
      if (pwBad) { say(msg, pwBad); return; }
      if (terms && !terms.checked) { say(msg, '先同意《用户协议》与《隐私政策》'); return; }

      busy(btn, true, '注册中…');
      AUTH.register({ username: phone, password: password, nickname: nickname.trim() }).then(
        function () { window.location.assign('profile.html'); },
        function (err) { busy(btn, false); say(msg, failMsg(err)); }
      );
    });
  }

  /* ================================================================== *
   * password-reset.html
   * ================================================================== */
  function wireReset() {
    var form = $('reset-form');
    if (!form) { return; }
    var msg = $('reset-msg');
    var hint = $('reset-hint');
    var askBtn = $('reset-ask-btn');
    var submitBtn = $('reset-submit-btn');
    var phone = $('reset-phone');
    var token = $('reset-token');
    var password = $('reset-password');
    var step2 = $('reset-step-2');

    function markStep(n) {
      ['reset-step-1', 'reset-step-2', 'reset-step-3'].forEach(function (id, i) {
        var el = $(id);
        if (!el) { return; }
        var at = i + 1;
        el.removeAttribute('data-active');
        el.removeAttribute('aria-current');
        el.removeAttribute('data-done');
        if (at === n) { el.setAttribute('data-active', 'true'); el.setAttribute('aria-current', 'step'); }
        if (at < n) { el.setAttribute('data-done', 'true'); }
      });
    }

    if (askBtn) {
      askBtn.addEventListener('click', function () {
        say(msg, '');
        var name = (phone && phone.value || '').trim();
        if (!name) { say(msg, '请先填手机号 / 登录名'); return; }

        busy(askBtn, true, '领取中…');
        AUTH.resetAsk(name).then(
          function (res) {
            busy(askBtn, false);
            if (res && res.devToken) {
              if (token) { token.value = res.devToken; }
              if (hint) { hint.textContent = '本地开发环境直接把令牌回给了页面（正式环境会发到手机/邮箱）。'; }
              say(msg, '令牌已领到，填个新密码就能改。', true);
            } else {
              if (hint) { hint.textContent = '令牌已发出，去手机/邮箱里取，填到上面这一格。'; }
              say(msg, '如果这个账号存在，令牌已经发出去了。', true);
            }
            markStep(2);
            if (step2) { step2.setAttribute('data-active', 'true'); }
            if (password) { password.focus(); }
          },
          function (err) { busy(askBtn, false); say(msg, failMsg(err)); }
        );
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      say(msg, '');
      var t = (token && token.value || '').trim();
      var pw = password ? password.value : '';
      if (!t) { say(msg, '请先领一个重置令牌'); return; }
      var pwBad = passwordProblem(pw);
      if (pwBad) { say(msg, pwBad); return; }

      busy(submitBtn, true, '提交中…');
      AUTH.resetConfirm(t, pw).then(
        function () {
          busy(submitBtn, false);
          markStep(3);
          say(msg, '密码已改好，正在回登录页…', true);
          window.setTimeout(function () { window.location.assign('login.html'); }, 900);
        },
        function (err) { busy(submitBtn, false); say(msg, failMsg(err)); }
      );
    });
  }

  wireLogin();
  wireRegister();
  wireReset();
}());
