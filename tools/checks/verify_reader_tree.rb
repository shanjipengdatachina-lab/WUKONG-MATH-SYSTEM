# encoding: UTF-8
# 章节页体检：目录由数据现建 + 默认展开 + 点章节不把它点关 + 一屏只列当前学段
#
# 为什么这份体检要重写：
#   左栏目录原来是一段手写 HTML（六册 29 章），加了小学 / 高中 / 竞赛之后，
#   手写的东西必然与数据脱节（而且章号跨册会撞）。现在改成 reader-live.js 按学段现建，
#   于是"体检"的对象从那段 HTML 变成了"现建这件事本身"：
#     · HTML 里不该再留手写目录（留了就会和现建的那棵打架）
#     · 四个学段的名单、默认值、与图谱共用的记忆键要对。
#   展开 / 收起的真实手感由 tools/checks/harness-tail.js 真跑一遍来验。
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
html  = File.read(File.join(ROOT, 'reader.html'), encoding: 'UTF-8')
live  = File.read(File.join(ROOT, 'assets/js/reader-live.js'), encoding: 'UTF-8')
js    = File.read(File.join(ROOT, 'assets/js/pages.js'), encoding: 'UTF-8')
shell = File.read(File.join(ROOT, 'assets/js/ide-shell.js'), encoding: 'UTF-8')
mind  = File.read(File.join(ROOT, 'assets/js/mindmap.js'), encoding: 'UTF-8')
tree  = File.read(File.join(ROOT, 'assets/js/math-tree.js'), encoding: 'UTF-8')

issues = []

# 1) 左栏默认展开
issues << '章节页没有声明「左栏默认展开」' unless html.include?('class="reader-shell" data-left-default="open"')
issues << 'ide-shell.js 没有读取 data-left-default' unless shell.include?("getAttribute('data-left-default') === 'open'")
issues << 'ide-shell.js 没有按声明跳过上次的收起状态' unless shell.include?("if (!leftAlwaysOpen && readStore(STORE_LEFT) === 'hidden')")

# 2) 目录容器留空，内容由数据现建（留了手写目录就会和现建的打架）
issues << '章节页没有留出 #tree-body 容器' unless html.include?('class="tree-body" id="tree-body"')
body = html[/<div class="tree-body" id="tree-body">(.*?)<\/div>/m, 1].to_s
issues << "左栏里还留着 #{body.scan(/class="ch-row"/).size} 个手写章行（会被现建的树顶掉）" if body.include?('ch-row')
issues << '左栏里还留着现建的节行' if body.include?('sec-row')
issues << '学段条不在 #chapter-tree 里（学段是目录的一部分）' unless html.include?('class="tree-stage" id="tree-stage"')

# 3) 学段条：四项固定、默认初中
chips = html.scan(/<button type="button" class="tree-stage__chip[^"]*" data-stage="(\w+)"/).flatten
issues << "学段按钮不是四项：#{chips.inspect}" unless chips == %w[primary junior senior olympiad]
issues << '默认没按在初中上（新用户第一次进来看到的是初中教材）' unless
  html =~ /class="tree-stage__chip is-on" data-stage="junior" aria-pressed="true"/
issues << '学段条缺 aria-label' unless html.include?('aria-label="选学段"')

# 3b) 目录头上头要留白、学段条的吸附位置要跟着目录头走（都是用户报过的问题）
#     1. 原来 .tree-head 的 padding-top 是 0，标题紧贴窗口顶；收起态本来就是 18px，两态不一致
#     2. 原来学段条 top:48px 是写死的 —— 目录头一改高度就错位，所以两处都改成同一个变量
issues << '目录头贴着窗口顶（padding-top 必须留白，收起态都有 18px）' unless
  html[/\.tree-head\{[^}]*padding:\s*(?!0)[\d.]+px\s+[\d.]+px\s+0/m]
issues << '目录头的高度没有抽成变量（学段条要跟着它吸附）' unless html.include?('--tree-head-h:')
issues << '学段条的吸附位置写死了（改目录头高度就会错位，应取 --tree-head-h）' unless
  html[/\.tree-stage\{[^}]*top:\s*var\(--tree-head-h\)/m]
issues << '目录头的高度没用同一个变量（两处迟早对不上）' unless
  html[/\.tree-head\{[^}]*height:\s*var\(--tree-head-h\)/m]
# 宽屏下真正的滚动容器是 .tree-body（外壳是 overflow:hidden）——
# 换学段若不回到顶部，新名单的头几行就停在学段条底下（用户报的"内容被挡住"）
issues << '换学段后左栏没有回到顶部（新名单会被压在学段条下面）' unless
  live.include?('treeBody.scrollTop = 0')
issues << '回到顶部量错了元素（宽屏下滚动容器是 .tree-body，不是外壳）' if
  live.include?('treeEl.scrollTop = 0')

# 4) 现建的契约：四个学段、默认初中、读原始 children
%w[primary junior senior olympiad].each do |code|
  issues << "reader-live.js 里没登记学段 #{code}" unless live.include?("'#{code}'")
end
issues << 'reader-live.js 的默认学段不是初中' unless live.include?("DEFAULT_STAGE = 'junior'")
issues << 'reader-live.js 没有读原始 children（math-tree.js 里没有 kids，那是 mindmap.js 加工的）' if
  live.include?('.kids')
issues << 'reader-live.js 没有按学段过滤册' unless live.include?('book.stage === code')
issues << 'reader-live.js 没有给章算一个学段内唯一的键' unless live.include?("'b' + bi + 'c' + ci")
# 待核分两级（册 / 章）。章级那处要能在树里看见，不然只剩"数据里有、界面上没有"。
issues << 'reader-live.js 只数册级待核（章级那处会被吞掉）' unless live.include?('function pendingCount(')
issues << '现建的树里没有章级待核标记' unless live.include?('ch-row__warn')

# 5) 与图谱共用同一个记忆键（两边记住的是同一件事）
key = 'wkmath.graph.stage'
issues << "reader-live.js 没读 #{key}" unless live.include?(key)
issues << "mindmap.js 没读 #{key}（两页要共用）" unless mind.include?(key)

# 6) 点章节 = 展开（不再用普通 toggle 把当前章点关）—— 绑定仍在 pages.js，
#    现建的树重建之后由 reader-live.js 叫它再绑一次
issues << 'pages.js 仍用 bindToggle 处理章节行（会把刚点的章点关）' if
  js.include?("bindToggle(row, li ? qs('ul[data-subtree]', li) : null, null, null)")
issues << 'pages.js 缺少「点章节即展开」逻辑' unless js.include?('applyChapter(row, sub, true)')
issues << 'pages.js 缺少同册只留一章展开的收拢逻辑' unless js.include?('applyChapter(other, otherSub, false)')
issues << 'pages.js 缺少章节行 aria-expanded 同步' unless js.include?("row.setAttribute('aria-expanded', String(expanded))")
issues << '册的展开收起被误删' unless js.include?("qsa('.tree-volume', tree)")
issues << 'pages.js 没把折叠逻辑挂出来（现建之后没法补绑）' unless js.include?('MS.initReaderTree = initReaderTree')
issues << 'reader-live.js 重建之后没有补绑折叠逻辑' unless live.include?('api.initReaderTree()')

# 7) 现建的树要和原来那棵同一套类名，否则 CSS / 折叠逻辑全落空
%w[tree-volume volume-head chapter-list ch-row sec-row pt-row].each do |cls|
  issues << "现建的树里没有 .#{cls}（和手写那棵对不上）" unless live.include?("class=\"#{cls}")
end
issues << '册的章列表没有默认展开（原来的设计是默认全开）' unless live.include?("'<ul class=\"chapter-list\" data-subtree=\"expanded\">'")
issues << '当前章的节列表没有默认展开' unless live.include?("active ? 'expanded' : 'collapsed'")

# 8) 学段是册上的一栏，不是新加的一层（加了层会动到折叠层级、面板统计、阅读器深度）
books = tree.scan(/kind: "book"/).size
tracked = tree.scan(/kind: "track"/).size
stamped = tree.scan(/kind: "(?:book|track)", stage: "\w+"/).size
issues << "有 #{books + tracked - stamped} 个册 / 板块没带 stage" unless stamped == books + tracked
issues << '给学段单加了一层节点（应该只是册上的一栏）' if tree.include?('kind: "stage"')

# 9) 四份教材结构文件都在（数据源丢了就没法重新生成）
%w[人教版小学数学知识结构.md 人教版初中数学知识结构.md 人教版高中数学知识结构.md 竞赛数学章节框架.md].each do |f|
  issues << "缺教材结构文件：#{f}" unless File.exist?(File.join(ROOT, f))
end

puts "左栏目录: 手写 #{body.scan(/class="ch-row"/).size} 行（应为 0）· 学段按钮 #{chips.size} 个（默认 初中）"
puts "册 / 板块: #{books} 册 + #{tracked} 个板块，全部带 stage 标记"
puts issues.empty? ? '章节页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
