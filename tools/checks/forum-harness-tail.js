/* ============================================================
   论坛自检（assets/js/forum.js）
   首页场景：专题筛选、最新/热门、发帖与校验、转义安全
   详情场景：按 id 渲染、浏览累加、回复与引用、没带 id 的兜底
   ============================================================ */
function assert(ok, label) {
  print((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) __fail = true;
}
var __fail = false;
var F = window.__FORUM__;
var E = __capture.els;

function DB() { return JSON.parse(__capture.store[F.KEY]); }
function postOf(id) {
  return DB().posts.filter(function (p) { return p.id === id; })[0];
}
function click(el, extra) {
  var ev = { defaultPrevented: false, preventDefault: function () { this.defaultPrevented = true; }, target: null };
  for (var k in (extra || {})) ev[k] = extra[k];
  if (el && el.handlers && el.handlers.click) el.handlers.click(ev);
  return ev;
}
function postsInHtml(html) { return (html.match(/class="post"/g) || []).length; }

/* ---------------- 通用：排版与时间 ---------------- */
assert(F.esc('<b>a&b</b>') === '&lt;b&gt;a&amp;b&lt;/b&gt;', '转义：尖括号与 & 全部转掉');
assert(F.rich('设 $y = kx + b$，看 $k$ 的符号').indexOf('<span class="m">y = kx + b</span>') >= 0, '排版：$…$ 认成公式');
assert(F.rich('第一段\n\n第二段').split('<p>').length === 3, '排版：空行分段');
assert(F.rich('清单：\n- 先看符号\n- 再定单调性').indexOf('<ul><li>先看符号</li><li>再定单调性</li></ul>') >= 0, '排版：- 起头成列表');
assert(F.rich('正文', 'floor__text').indexOf('<p class="floor__text">') === 0, '排版：段落可指定类名');
assert(F.timeAgo(Date.now() - 30 * 1000) === '刚刚', '时间：刚刚');
assert(F.timeAgo(Date.now() - 30 * 60 * 1000) === '30 分钟前', '时间：分钟');
assert(F.timeAgo(Date.now() - 5 * 3600 * 1000) === '5 小时前', '时间：小时');
assert(F.timeAgo(Date.now() - 3 * 24 * 3600 * 1000) === '3 天前', '时间：天');

if (PAGE === 'thread') {
  /* ---------------- 帖子详情 ---------------- */
  var db = DB();
  var probe = F.query('id');
  var post = db.posts.filter(function (p) { return p.id === probe; })[0];
  var fell = !post;
  if (fell) post = db.posts[0];

  assert(E['thread-title'].textContent === post.title, fell ? '没带 id：兜底到第一篇' : '按 id 渲染标题');
  assert(E['thread-tag'].textContent === F.boardOf(post.board).name, '专题标签跟着帖子');
  assert(E['thread-board'].textContent === F.boardOf(post.board).name, '面包屑里的专题跟着帖子');
  assert(E['thread-body'].innerHTML.indexOf('<span class="m">') >= 0, '正文里的公式渲染成公式体');
  assert(E['thread-body'].innerHTML.indexOf('<p>') === 0, '正文按段落渲染');
  assert((E['thread-floors'].innerHTML.match(/class="floor"/g) || []).length === post.floors.length, '楼层数与数据一致');
  assert(E['thread-floors'].innerHTML.indexOf('#2') >= 0, '楼层从 #2 开始编号');
  assert(E['thread-meta'].innerHTML.indexOf('<b>' + post.floors.length + '</b> 条回复') >= 0, '顶部回复数与楼层一致');
  assert(document.title === post.title + ' · 悟空数学', '标签页标题跟着帖子');
  assert(E['thread-views'].innerHTML.indexOf('<b>' + post.views + '</b>') >= 0, '浏览数已累加');
  assert(postOf(post.id).views === post.views, '浏览数写回本地');

  /* 引用与 @回复 */
  var f0 = post.floors[0];
  function link(act) {
    return { getAttribute: function (k) { return k === 'data-act' ? act : (k === 'data-who' ? f0.who : null); } };
  }
  click(E['thread-floors'], { target: { closest: function () { return link('quote'); } } });
  assert(E['reply-text'].value.indexOf('> ' + f0.who + '：') === 0, '点「引用」把原话带进输入框');
  E['reply-text'].value = '';
  click(E['thread-floors'], { target: { closest: function () { return link('reply'); } } });
  assert(E['reply-text'].value === '@' + f0.who + ' ', '点「回复」自动带 @');

  /* 回复校验与成功 */
  E['reply-text'].value = '';
  var n0 = postOf(post.id).floors.length;
  click(E['reply-submit']);
  assert(__capture.toasts[__capture.toasts.length - 1] === '先写点内容再发表', '空回复：只提示不发');
  assert(postOf(post.id).floors.length === n0, '空回复：楼层数不动');

  E['reply-text'].value = '我的做法是先把 $k$ 的符号标出来，再判单调性。';
  click(E['reply-submit']);
  var saved = postOf(post.id);
  assert(saved.floors.length === n0 + 1, '回复已写入存储');
  assert(saved.floors[saved.floors.length - 1].who === F.ME, '回复作者是当前登录用户');
  assert(E['reply-text'].value === '', '发表后输入框清空');
  assert((E['thread-floors'].innerHTML.match(/class="floor"/g) || []).length === n0 + 1, '楼层立刻 +1');
  assert(E['thread-meta'].innerHTML.indexOf('<b>' + (n0 + 1) + '</b> 条回复') >= 0, '顶部回复数同步');
  assert(__capture.toasts[__capture.toasts.length - 1] === '回复已发表', '发表后有反馈');
} else if (PAGE === 'board') {
  /* ---------------- 专题页 ---------------- */
  var dbB = DB();
  var boardId = F.query('board') || 'help';
  var info = F.boardOf(boardId);
  var inBoard = dbB.posts.filter(function (p) { return p.board === boardId; });
  var boardReplies = inBoard.reduce(function (n, p) { return n + p.floors.length; }, 0);
  var boardHtml = E['board-list'].innerHTML;
  function topId() { var m = /id=(\w+)/.exec(E['board-list'].innerHTML); return m ? m[1] : ''; }

  assert(E['board-title'].textContent === info.name, '专题页标题跟着 ?board=');
  assert(E['board-crumb-name'].textContent === info.name, '面包屑也跟着专题');
  assert(E['board-desc'].textContent === info.note, '专题说明跟着专题');
  assert(document.title === info.name + ' · 悟空数学', '标签页标题跟着专题');
  assert(E['board-stats'].textContent === inBoard.length + ' 主题 · ' + boardReplies + ' 条回复', '统计完全来自数据');
  assert((boardHtml.match(/class="trow"/g) || []).length === inBoard.length, '只列本专题的帖子');
  assert(boardHtml.indexOf('forum-thread.html?id=') >= 0, '每条都链到详情页');
  assert(boardHtml.indexOf(info.name) >= 0, '每条的专题标签是本专题');

  var byReply = inBoard.slice().sort(function (a, b) { return F.lastAt(b) - F.lastAt(a); });
  assert(topId() === byReply[0].id, '默认按「最新回复」排');
  assert(E['sort-reply'].getAttribute('data-active') === 'true', '默认排序项高亮');

  click(E['sort-post']);
  var byPost = inBoard.slice().sort(function (a, b) { return b.at - a.at; });
  assert(topId() === byPost[0].id, '「最新发布」按发帖时间重排');
  assert(E['sort-post'].getAttribute('data-active') === 'true', '高亮跟着切');
  assert(E['sort-reply'].getAttribute('data-active') === null, '旧排序项不再高亮');

  click(E['sort-replies']);
  var byFloors = inBoard.slice().sort(function (a, b) { return b.floors.length - a.floors.length || b.at - a.at; });
  assert(topId() === byFloors[0].id, '「回复最多」按回复数重排');
  assert(click(E['sort-replies']).defaultPrevented === true, '点排序不跳页');
} else if (PAGE === 'mine') {
  /* ---------------- 我的帖子 / 我的回复 ---------------- */
  var dbM = DB();
  var minePosts = dbM.posts.filter(function (p) { return p.author === F.ME; });
  var mineFloors = [];
  dbM.posts.forEach(function (p) {
    p.floors.forEach(function (f) { if (f.who === F.ME) mineFloors.push(f); });
  });

  assert(E['mine-desc'].innerHTML.indexOf('<b class="num">' + minePosts.length + '</b> 篇帖子') >= 0, '统计里的帖子数来自数据');
  assert(E['mine-desc'].innerHTML.indexOf('<b class="num">' + mineFloors.length + '</b> 条回复') >= 0, '统计里的回复数来自数据');
  assert(E['mine-count-posts'].textContent === String(minePosts.length), '「我的帖子」计数');
  assert(E['mine-count-replies'].textContent === String(mineFloors.length), '「我的回复」计数');
  assert((E['mine-posts'].innerHTML.match(/class="prow"/g) || []).length === minePosts.length, '帖子列表条数正确');
  assert((E['mine-replies'].innerHTML.match(/class="prow"/g) || []).length === mineFloors.length, '回复列表条数正确');
  assert(E['mine-posts'].innerHTML.indexOf('forum-thread.html?id=') >= 0, '帖子链到详情页');
  assert((E['mine-posts'].innerHTML.match(/class="prow__title"/g) || []).length === minePosts.length, '每个帖子都渲染出标题');
  assert(E['mine-replies'].innerHTML.indexOf('prow__quote') >= 0, '回复带上原话摘要');
  assert(minePosts.length === 3 && mineFloors.length >= 3, '演示数据里当前用户有帖子也有回复');

  assert(E['mine-posts'].hidden === false && E['mine-replies'].hidden === true, '默认只显示我的帖子');
  assert(click(E['mine-tab-replies']).defaultPrevented === true, '点标签不跳页');
  assert(E['mine-posts'].hidden === true && E['mine-replies'].hidden === false, '切到我的回复');
  assert(E['mine-tab-replies'].getAttribute('data-active') === 'true', '标签高亮跟着切');
  click(E['mine-tab-posts']);
  assert(E['mine-posts'].hidden === false && E['mine-replies'].hidden === true, '切回我的帖子');
  assert(E['mine-tab-posts'].getAttribute('data-active') === 'true', '高亮切回');
} else {
  /* ---------------- 论坛首页 ---------------- */
  var db = DB();
  assert(db && db.posts.length === 6, '首次进入写入 6 篇演示数据');
  assert(E['forum-count'].textContent === '共 6 个主题', '主题计数来自数据');
  assert(E['forum-sec-title'].textContent === '最新主题', '列表标题默认「最新主题」');
  assert(postsInHtml(E['forum-list'].innerHTML) === 6, '列表渲染出 6 条');
  assert(E['forum-list'].innerHTML.indexOf('forum-thread.html?id=p1') >= 0, '每条都链到详情页');
  assert(/<b>3<\/b> 条回复/.test(E['forum-list'].innerHTML), '回复数取自楼层数');
  assert(E['card-study'].countEl.textContent === '3 主题', '专题卡片计数来自数据');
  assert(__capture.iconCalls > 0, '渲染完补画图标');

  /* 最新 / 热门 */
  var html = E['forum-list'].innerHTML;
  assert(html.indexOf('id=p1') < html.indexOf('id=p2'), '最新：新帖在前');
  click(E['tab-hot']);
  html = E['forum-list'].innerHTML;
  assert(html.indexOf('id=p3') < html.indexOf('id=p2'), '热门：按回复与浏览重排');
  assert(E['tab-hot'].getAttribute('data-active') === 'true', '热门标签高亮');
  assert(E['forum-sec-title'].textContent === '热门主题', '标题跟着切到「热门主题」');
  click(E['tab-latest']);
  assert(E['tab-latest'].getAttribute('data-active') === 'true', '切回最新');

  /* 专题筛选 */
  assert(E['forum-board-link'].hidden === true, '没筛专题时不显示「进入专题页」');
  assert(click(E['card-study']).defaultPrevented === true, '点专题卡片不跳页，就地筛选');
  assert(postsInHtml(E['forum-list'].innerHTML) === 3, '只看「学习交流」：3 条');
  assert(E['card-study'].getAttribute('data-active') === 'true', '选中的专题高亮');
  assert(E['forum-sec-title'].textContent === '学习交流', '标题显示当前专题');
  assert(__capture.replaced[__capture.replaced.length - 1] === 'forum.html?board=study', '筛选状态写进地址栏');
  assert(E['forum-board-link'].hidden === false &&
    E['forum-board-link'].getAttribute('href') === 'board.html?board=study', '筛了专题才给出「进入专题页」入口');
  click(E['card-study']);
  assert(postsInHtml(E['forum-list'].innerHTML) === 6, '再点一次取消筛选');
  assert(E['card-study'].getAttribute('data-active') === null, '取消后不再高亮');

  /* 发帖 */
  assert(click(E['forum-compose-open']).defaultPrevented === true, '点「发帖」就地展开表单');
  assert(E['forum-compose-box'].hidden === false, '表单显示出来');
  assert(__capture.focus.indexOf('compose-title') >= 0, '光标落在标题上');
  E['compose-title'].value = '';
  click(E['compose-submit']);
  assert(DB().posts.length === 6, '标题空：不发帖');
  assert(__capture.toasts[__capture.toasts.length - 1] === '先写个标题', '标题空：提示先写标题');
  E['compose-title'].value = '这题为什么要先配方？';
  E['compose-body'].value = '';
  click(E['compose-submit']);
  assert(__capture.toasts[__capture.toasts.length - 1] === '正文还空着', '正文空：提示写正文');

  E['compose-title'].value = '这题为什么要先配方？';
  E['compose-body'].value = '题干是 $x^2 + 6x + 5 = 0$，我按配方法做：\n- 先把常数项移过去\n- 再凑一次项系数一半的平方';
  E['compose-board'].value = 'help';
  click(E['compose-submit']);
  db = DB();
  assert(db.posts.length === 7, '发布成功：帖子 +1');
  assert(db.posts[0].title === '这题为什么要先配方？', '新帖排在最前');
  assert(db.posts[0].author === F.ME, '作者是当前登录用户');
  assert(db.posts[0].board === 'help' && db.posts[0].floors.length === 0, '专题与楼层初始正确');
  assert(E['forum-compose-box'].hidden === true, '发布后表单收起');
  assert(E['compose-title'].value === '' && E['compose-body'].value === '', '输入框已清空');
  assert(E['forum-list'].innerHTML.indexOf('这题为什么要先配方？') >= 0, '列表立刻出现新帖');

  /* 注入安全：标题里的标签必须被转义 */
  E['compose-title'].value = '<img src=x onerror=alert(1)>';
  E['compose-body'].value = '正文里的 <script> 也该被转义';
  click(E['compose-submit']);
  var out = E['forum-list'].innerHTML;
  assert(out.indexOf('&lt;img') >= 0, '标题里的标签被转义');
  assert(out.indexOf('<img src=x') < 0, '列表里没有可直接执行的标签');
}

print(__fail ? 'RESULT: 有失败项' : 'RESULT: 全部通过');
