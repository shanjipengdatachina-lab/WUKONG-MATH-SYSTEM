/* ============================================================
   会话自检 —— 登录 / 退出的侧栏与身份（跑在 ide-shell.js 之后）
   ============================================================ */
var SH = window.WK_SHELL;
function eq2(a, b, label) { assert(String(a) === String(b), label + '（期望 ' + b + '，实际 ' + a + '）'); }
function has(text, part, label) { assert(String(text).indexOf(part) !== -1, label); }

assert(!!SH, 'ide-shell 导出了 window.WK_SHELL');
eq2(SH.user.grade, '七年级（下）', '演示账号带着年级信息');

/* ---- 未登录：侧栏是"登录"，身份为空 ---- */
accountEl.setAttribute('href', 'login.html');
window.localStorage.removeItem('wkmath.user');
eq2(SH.session(), null, '没登录时本机没有会话');
eq2(SH.current(), null, '没登录时没有身份');
eq2(accountEl.getAttribute('href'), 'login.html', '没登录时侧栏保持"登录"');

/* ---- 页面自己写着已登录时，沿用页面上的身份（与演示一致） ---- */
accountEl.setAttribute('href', 'profile.html');
assert(SH.current() && SH.current().name === '林一鸣', '侧栏是账号时沿用页面上的身份');
eq2(SH.current().grade, '七年级（下）', '沿用的身份带着年级');
accountEl.setAttribute('href', 'login.html');

/* ---- 点登录：写入会话并把侧栏换成账号 ---- */
fire(loginSubmitEl, 'click');
assert(!!SH.session() && SH.session().name === '林一鸣', '点登录后本机记下会话');
eq2(SH.session().grade, '七年级（下）', '会话里带着年级，图谱据此默认聚焦');
eq2(accountEl.getAttribute('href'), 'profile.html', '登录后侧栏指向个人中心');
has(accountEl.getAttribute('title'), '个人中心', '登录后提示语跟着变');
eq2(labelEl.textContent, '林一鸣', '登录后侧栏显示姓名');
eq2(avatarEl.textContent, '林', '登录后头像显示姓氏');

/* ---- 点退出：清会话并恢复未登录的样子 ---- */
fire(logoutEl, 'click');
eq2(SH.session(), null, '退出后清掉本机会话');
eq2(SH.current(), null, '退出后不再有身份');
eq2(accountEl.getAttribute('href'), 'login.html', '退出后侧栏回到"登录"');
eq2(labelEl.textContent, '登录', '退出后侧栏文字回到登录');
has(avatarEl.innerHTML, 'data-lucide="user"', '退出后头像回到图标');
eq2(window.localStorage.getItem('wkmath.user'), null, '退出后本机不残留用户数据');

out('----');
out(__fail ? '有失败项' : '会话自检全部通过');
