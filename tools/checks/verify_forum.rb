# encoding: UTF-8
# 论坛体检：首页与详情页是否已接上数据渲染，脚本与样式是否就位
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

def read(f) File.read(File.join(ROOT, f), encoding: 'UTF-8') end

problems = []
def need(problems, ok, msg) problems << msg unless ok end

home = read('forum.html')
thread = read('forum-thread.html')
board = read('board.html')
mine = read('my-posts.html')
js = read('assets/js/forum.js')

# ---------- 首页 ----------
need(problems, home.include?('<div id="forum-list"></div>'), '首页缺帖子列表容器')
need(problems, !home.include?('<a class="post"'), '首页还留着写死的帖子')
need(problems, home.scan(/data-board="/).size == 3, '首页专题卡片应为 3 个（实际 %d）' % home.scan(/data-board="/).size)
need(problems, !home.include?('<a class="board" href="board.html"'), '首页专题卡片仍指向写死的板块页')
need(problems, home.include?('id="forum-compose-box"') && home.include?('id="compose-submit"'), '首页缺内嵌发帖表单')
need(problems, home.include?('id="forum-compose-open"'), '首页缺「发帖」入口')
need(problems, home.include?('id="forum-count"') && home.include?('id="forum-sec-title"'), '首页缺计数 / 标题挂点')
need(problems, home.include?('data-tab="latest"') && home.include?('data-tab="hot"'), '首页标签缺 data-tab')
need(problems, home.include?('<script src="assets/js/forum.js"></script>'), '首页没挂 forum.js')
need(problems, home.include?('.compose{'), '首页缺发帖表单样式')
need(problems, home.include?('.board[data-active="true"]'), '首页缺选中专题的高亮样式')
need(problems, home.include?('forum-compose.html'), '首页没留「完整编辑器」入口（旧页面会变成死路）')

# ---------- 详情 ----------
%w[thread-body thread-title thread-tag thread-meta thread-views thread-floors thread-board].each do |id|
  need(problems, thread.include?(%(id="#{id}")), "详情页缺挂点 #{id}")
end
need(problems, thread.include?('<textarea class="reply__box reply__input" id="reply-text"'), '回复框还是只读的 div')
need(problems, thread.include?('id="reply-submit"'), '详情页缺发表回复按钮挂点')
need(problems, !thread.include?('<article class="floor">'), '详情页还留着写死的楼层')
need(problems, thread.include?('<script src="assets/js/forum.js"></script>'), '详情页没挂 forum.js')
need(problems, thread.include?('.reply__input'), '详情页缺输入框样式')

# ---------- 专题页 ----------
need(problems, board.include?('<section class="tlist" id="board-list"'), '专题页缺主题列表容器')
need(problems, !board.include?('<a class="trow"'), '专题页还留着写死的主题')
%w[board-title board-crumb-name board-desc board-stats].each do |id|
  need(problems, board.include?(%(id="#{id}")), "专题页缺挂点 #{id}")
end
need(problems, board.scan(/data-sort="/).size == 3, '专题页排序应有 3 种（实际 %d）' % board.scan(/data-sort="/).size)
need(problems, board.include?('<script src="assets/js/forum.js"></script>'), '专题页没挂 forum.js')
need(problems, board.include?('forum.html?compose=1'), '专题页的发帖入口没指向可用的表单')
need(problems, !board.include?('href="forum-compose.html"'), '专题页还指向写死的发帖页')

# ---------- 我的帖子 ----------
need(problems, mine.include?('<section class="panel" id="mine-posts"'), '我的帖子缺帖子面板')
need(problems, mine.include?('id="mine-replies"'), '我的帖子缺回复面板')
need(problems, !mine.include?('<a class="prow"'), '我的帖子还留着写死的条目')
%w[mine-desc mine-count-posts mine-count-replies mine-tab-posts mine-tab-replies].each do |id|
  need(problems, mine.include?(%(id="#{id}")), "我的帖子缺挂点 #{id}")
end
need(problems, mine.include?('id="mine-desc"'), '我的帖子缺统计挂点')
need(problems, mine.include?('.panel[hidden]'), '我的帖子缺面板隐藏规则')
need(problems, mine.include?('<script src="assets/js/forum.js"></script>'), '我的帖子没挂 forum.js')
need(problems, mine.include?('forum.html?compose=1'), '我的帖子的发帖入口没指向可用的表单')

# ---------- 脚本 ----------
need(problems, home.include?('id="forum-board-link"'), '首页缺「进入专题页」入口')
need(problems, js.include?('function initBoard()') && js.include?('function initMine()'), 'forum.js 缺专题页 / 我的帖子渲染')
need(problems, js.include?("query('compose')"), 'forum.js 不支持 ?compose=1 直接开表单')

need(problems, js.include?("var KEY = 'wkmath.forum.v1'"), 'forum.js 缺本地存储键')
need(problems, js.include?('localStorage'), 'forum.js 没落本地存储')
need(problems, js.scan(/id: 'p\d'/).size >= 6, 'forum.js 演示数据不足 6 篇')
need(problems, js.include?('function seed()') && js.include?("db.v !== VER"), 'forum.js 缺演示数据与版本兜底')
need(problems, js.include?('function esc(') && js.include?('function rich('), 'forum.js 缺转义与排版')
need(problems, js.include?('function timeAgo('), 'forum.js 缺相对时间')
need(problems, js.include?('forum-thread.html?id='), 'forum.js 列表没链到详情页')
need(problems, !js.include?('eval('), 'forum.js 里出现了 eval')

# 当前用户（侧栏登录的 林一鸣）在演示数据里应有 3 篇，和「我的帖子 3」对得上
mine = js.scan(/author: '林一鸣'/).size
need(problems, mine == 3, "演示数据里「林一鸣」的帖子应为 3 篇（实际 #{mine}）")

if problems.empty?
  puts '论坛体检通过 ✓（首页 / 详情已数据驱动，脚本与样式就位，当前用户 3 篇演示帖）'
else
  problems.each { |p| puts "  ✗ #{p}" }
end
