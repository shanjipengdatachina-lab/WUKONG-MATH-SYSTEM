# encoding: UTF-8
# 统一浏览器标签：全站 42 个页面的 <title> 一律是「页面名 · 悟空数学」。
#
# 原来只有 whiteboard.html 一条是按这个规则写的，其余 41 条各写各的：
# 「首页」「关于本站」「数轴 · 知识点」「数字白板功能规划 · 悟空数学知识图谱」……
# 浏览器上开着十来个标签时，既认不出品牌，也认不出哪条是这个站。
#
# 可重复执行：标题已经是目标值就跳过（幂等）。
# 表里必须**刚好覆盖** 42 个页面 —— 多一条少一条都直接报错停手，
# 免得以后加了新页面，它还静静地留着一个没统一的标题。
#
# 注意：有几个页面是**运行时**改标题的（阅读器按章名、搜索按关键词、论坛按帖子 / 专题），
# 那些在 assets/js/ 里，本脚本管不到 —— 见 tools/checks/verify_brand.rb 里那一组守线。

ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('..', __dir__)).dup.force_encoding('UTF-8')
SUFFIX = ' · 悟空数学'

# 页面名。绝大多数就是各页原来那个名字，照搬；只有两处刻意改名，都写在注释里。
NAMES = {
  'about.html'          => '关于本站',
  'board.html'          => '板块列表',
  'chapter.html'        => '章首页',
  'checkout.html'       => '确认订单',
  'concept-3d.html'     => '立体图形演示',
  # 原来写的是「数轴 · 知识点」—— 可这一页按 ?id= 换知识点，写死「数轴」会误导
  'concept.html'        => '知识点',
  'exams.html'          => '考点速练总览',
  'favorites.html'      => '收藏夹',
  'formulas.html'       => '公式速查',
  'forum-compose.html'  => '发帖',
  'forum-thread.html'   => '帖子详情',
  'forum.html'          => '论坛',
  'graph.html'          => '知识图谱',
  'help.html'           => '帮助中心',
  'home.html'           => '首页',
  'login.html'          => '登录',
  'membership.html'     => '会员中心',
  'methods.html'        => '方法速学汇总',
  'mistake-detail.html' => '错题详情',
  'mistakes.html'       => '错题本',
  'my-posts.html'       => '我的帖子与回复',
  'notebook.html'       => '笔记汇总',
  'notifications.html'  => '消息通知',
  'orders.html'         => '订单与账单',
  'password-reset.html' => '找回密码',
  'payment-failed.html' => '支付失败',
  'payment-result.html' => '支付成功',
  'pitfalls.html'       => '易错速析汇总',
  'practice-result.html' => '练习结果',
  'practice.html'       => '考点速练',
  'privacy.html'        => '隐私政策',
  'profile.html'        => '个人中心',
  'progress.html'       => '学习进度',
  'reader.html'         => '章节阅读',
  'register.html'       => '注册',
  'report.html'         => '学习报告',
  'search.html'         => '搜索结果',
  'settings.html'       => '账号设置',
  'terms.html'          => '用户协议',
  'user.html'           => '用户主页',
  'whiteboard.html'     => '数字白板',
  # 原来写的是「数字白板功能规划 · 悟空数学知识图谱」—— 尾巴上挂的是"知识图谱"，
  # 而它其实是一份白板规划文档，不是图谱页
  '白板功能规划.html'      => '白板功能规划'
}.freeze

files = Dir.glob(File.join(ROOT, '*.html')).map { |p| File.basename(p) }.sort
missing = files - NAMES.keys
extra   = NAMES.keys - files
unless missing.empty? && extra.empty?
  abort '页面清单跟表对不上，停手：' \
        "\n  表里没有的页面：#{missing.join('、')}" \
        "\n  表里有但文件不在：#{extra.join('、')}" \
        "\n（新页面请加进 NAMES，并想好它的页面名）"
end

changed = []
already = []
files.each do |name|
  path = File.join(ROOT, name)
  html = File.read(path, encoding: 'UTF-8')
  cur = html[/<title>(.*?)<\/title>/m, 1]
  abort "#{name}: 找不到 <title>" if cur.nil?
  want = NAMES[name] + SUFFIX
  if cur.strip == want
    already << name
    next
  end
  html = html.sub(/<title>.*?<\/title>/m, "<title>#{want}</title>")
  File.write(path, html)
  changed << [name, cur.strip, want]
end

puts "统一标题：改了 #{changed.size} 页；本来就是对的 #{already.size} 页"
changed.each { |n, from, to| puts format('  %-24s %-30s → %s', n, from, to) }
