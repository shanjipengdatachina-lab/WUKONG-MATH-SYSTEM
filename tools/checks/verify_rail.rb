# encoding: UTF-8
# 外壳第二版体检：顶栏已撤，全部收进左侧栏
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
BAK  = '/Users/liyuanyuan/.trae-cn/work/6ab7b9737ec5c92d0299834b/backup-html3'
FORUM_NAV = %w[forum.html forum-thread.html board.html my-posts.html forum-compose.html]
# 这一页按设计没有外壳侧栏，侧栏结构检查对它跳过（verify_brand 里也是这么跳的）：
# 它是一份独立的功能规划文档页，不在站点动线上（ia_audit 也会把它报成"孤岛"）。
# Universal.html（用户 2026-10-02 交来的**粒子沙盒页**）同一条待遇：它是首页 hero 那块
# 星空的**原稿**（引擎已搬进 assets/js/home-galaxy.js），本身不挂外壳、不进动线。
SKIP_RAIL = %w[白板功能规划.html Universal.html].freeze

problems = []
files = Dir.glob(File.join(ROOT, '*.html')).sort

files.each do |path|
  name = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  bak_path = File.join(BAK, name)
  old  = File.exist?(bak_path) ? File.read(bak_path, encoding: 'UTF-8') : ''
  issues = []

  # 顶栏必须已经撤掉
  issues << '仍残留顶部栏' if html.include?('<header class="ide-bar"')
  # 顶栏留白必须归零
  issues << '仍有 padding-top:56px' if html =~ /padding-top:\s*56px/
  issues << '仍有 top:56px 偏移' if html =~ /(?<![\w-])top:\s*56px/

  # ---- 以下这一组只对"有侧栏的页面"成立 ----
  unless SKIP_RAIL.include?(name)
    # 侧栏部件
    issues << '缺 ide-rail' unless html.include?('class="ide-rail"')
    issues << '缺 data-shell=v2 标记' unless html.include?('data-shell="2"')
    issues << '缺 logo / 标题' unless html.include?('ide-rail__brand-name')
    issues << '缺账号入口' unless html.include?('ide-rail__account')
    issues << '缺设置入口' unless html.include?('settings.html')
    issues << '侧栏缺搜索按钮' unless html.include?('ide-rail__search') || name == 'concept.html'

    # 侧栏上不再出现快捷键提示（用户原话："左边栏搜索有快捷键去掉"）。
    # 原来「搜索」那一行悬停展开时会露出一个 ⌘K 角标（.ide-rail__kbd），
    # 「全屏」那颗的 title 里也写着（Esc 退出）。**键照旧好使**，只是不再写在界面上。
    issues << '侧栏的搜索那一行又挂上了快捷键角标（.ide-rail__kbd）' if html.include?('ide-rail__kbd')
    issues << '侧栏的搜索 title 里又带上了快捷键（应只是「搜索知识点」）' if
      html.include?('title="搜索知识点（')
    issues << '侧栏「全屏」的 title 里又带上了按键（应只是「全屏模式」）' if
      html.include?('title="全屏模式（')

    # 侧栏入口：论坛必须有一项；论坛各页该项要是当前项；错题本不该再挂在主导航
    if html.include?('class="ide-rail"')
      issues << '侧栏缺「论坛」入口' unless html.include?('data-nav-key="forum"')
      if FORUM_NAV.include?(name) && html !~ /data-nav-key="forum" data-active="true"/
        issues << '论坛页没把「论坛」标为当前项'
      end
      issues << '侧栏不该再有「错题本」导航项（属登录后的个人功能）' if html.include?('data-nav-key="mistakes"')
      issues << '侧栏不该再有「练习」导航项（真题页里按考点进入）' if html.include?('data-nav-key="practice"')
      if %w[practice.html practice-result.html].include?(name) && html !~ /data-nav-key="exams" data-active="true"/
        issues << '练习系列页没把「真题」标为当前项'
      end
    end
  end

  # 原本挂在顶栏的通知 / 头像入口不能在侧栏丢失
  header_old = old[%r{<header class="ide-bar">.*?</header>}m].to_s
  if header_old.include?('shell-icon-btn')
    issues << '通知入口丢失' unless html.include?('href="notifications.html"')
  end
  if header_old.include?('shell-avatar')
    issues << '账号入口丢失' unless html.include?('href="profile.html"')
  end

  # 标签配平。**先把注释剥掉再数** —— 注释里写着的 `<a>` 会被当成一个开标签：
  # reader.html 的样式注释里正好有「…渲染那段与它的样式（含 <a> 三态）一起删干净…」这么一句，
  # 于是它一直被误报成「a 标签不配平(22/21)」。
  # （同类坑这个项目已经踩到第八次：守线别被自己的注释顶红/顶绿 —— 这一处是顶红。）
  code = html.gsub(/<!--.*?-->/m, '').gsub(%r{/\*.*?\*/}m, '')
  %w[nav div a button].each do |tag|
    o = code.scan(/<#{tag}[\s>]/i).length
    c = code.scan(%r{</#{tag}>}i).length
    issues << "#{tag} 标签不配平(#{o}/#{c})" if o != c
  end

  problems << [name, issues] unless issues.empty?
end

puts "体检页面: #{files.length}"
if problems.empty?
  puts '全部通过 ✓（顶栏已撤，侧栏部件齐全，入口未丢）'
else
  # **问题行必须带 ✗，并且非零退出。**
  # run_all.rb 是按输出里的「✗」数红灯的（见它开头那段注释）。这里原来打印的是普通行、
  # 也从不非零退出 —— 于是这个脚本报出来的问题从来进不了 run_all 的账：42 页的侧栏结构检查
  # 等于一直没被真正执行过。2026-09-29 发现时，里面静静躺着两条（一条误报、一条按设计跳过），
  # 而 run_all 一直报"体检无红灯"。
  problems.each { |n, is| puts "      ✗ #{n}: #{is.join(' / ')}" }
end

puts
puts '---- 侧栏交互（ide-shell.js）----'
shell_js = File.read(File.join(ROOT, 'assets/js/ide-shell.js'), encoding: 'UTF-8')
rail_checks = {
  '鼠标点完侧栏主动失焦（点完收回原状）' => "event.detail === 0",
  '失焦只针对侧栏条目' => "closest('.ide-rail__item, .ide-rail__account, .ide-rail__brand')",
  '当前页入口不再整页重载' => 'isSelfLink',
  '全屏切页不换文档（覆盖区）' => "className = 'fs-shell'",
  '覆盖区里的页面藏起自己的侧栏' => "setAttribute('data-embed', '')"
}
rail_checks.each do |label, token|
  puts format('  %-34s %s', label, shell_js.include?(token) ? '✓' : '✗')
end
missed = rail_checks.reject { |_, token| shell_js.include?(token) }.keys
puts missed.empty? ? '侧栏交互全部就位 ✓' : missed.map { |m| "  ✗ 缺：#{m}" }.join("\n")

puts
puts '---- 抽查 ----'
%w[home.html reader.html notifications.html login.html concept.html graph.html].each do |f|
  h = File.read(File.join(ROOT, f), encoding: 'UTF-8')
  rail = h[%r{<nav class="ide-rail".*?</nav>}m].to_s
  puts format('%-20s 顶栏=%s 侧栏条目=%-3d 搜索=%s 通知=%s 账号=%s 面板开关=%s',
              f,
              h.include?('<header class="ide-bar"') ? '残留' : '已撤',
              rail.scan('ide-rail__item').length,
              rail.include?('ide-rail__search') ? '有' : '无',
              rail.include?('notifications.html') ? '有' : '无',
              rail.include?('login.html') ? '登录' : (rail.include?('profile.html') ? '已登录' : '无'),
              h.include?('id="toggle-left"') ? '有' : '无')
end

# 有问题就非零退出：run_all 那条"退出码非 0 且零 ✗ = 崩了"的判据要靠它区分
# "跑完了、有问题" 和 "没跑完"。单独直接跑这个脚本时，退出码也是给 CI / 眼睛用的信号。
exit 1 unless problems.empty?
