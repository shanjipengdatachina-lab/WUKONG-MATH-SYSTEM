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

# 10) 收起状态下"看着像选了别的学段" + 中间栏必须跟着学段走（用户报过）
#     ① 左栏收起只剩 56px 时，四个 chip 横排会被裁到只剩第一个（小学）——
#        于是看着像"选了小学、正文却是高中"。收起状态只留真选中的那一个。
#     ② 换学段时中间栏必须跟着换：万一这个学段一条章都没有，要给明确说法，
#        不能悄悄返回、把上一个学段那篇文章留在那儿。
css = File.read(File.join(ROOT, 'assets/css/ide.css'), encoding: 'UTF-8')
issues << '左栏收起时学段条会把第一个 chip 露成"当前学段"（收起时应只留真选中的那个）' unless
  css[/\.reader-shell\[data-left="hidden"\] \.tree-stage__chip:not\(\.is-on\)\s*\{\s*display:\s*none/m]
issues << 'reader-live.js 换学段没有兜底（数据空时中间栏会留着上一个学段的内容）' unless
  live.include?('showStageEmpty')
issues << 'showStageHome 走到底没有调兜底' unless
  live[/function showStageHome\(\)[\s\S]{0,900}?\n\s*showStageEmpty\(\);/m]
issues << 'showStageEmpty 没写进中间栏（只声明了函数）' unless
  live[/function showStageEmpty\(\)[\s\S]{0,400}?art\.innerHTML/m]
issues << '索引里缺这一章时会直接返回（中间栏仍然留着上一篇）' unless
  live.include?('if (!chapterByNo[key]) continue;')

# 11) 左右栏的开关只留"各自顶部"那一处（用户："左下角俩按钮在各自的顶部都有了可以去掉"）
issues << '左栏里还挂着 #toggle-left（左栏顶部已经有收起按钮了）' if html.include?('id="toggle-left"')
issues << '左栏里还挂着 #toggle-right（右栏顶部已经有收起按钮了）' if html.include?('id="toggle-right"')
issues << '左栏顶部那份收起按钮丢了（那才是留下的那一处）' unless html.include?('id="tree-collapse"')
issues << '右栏顶部那份收起按钮丢了' unless html.include?('id="side-collapse"')
# 快捷键不能跟着按钮一起消失（删按钮时最容易顺手删掉 keydown）
issues << 'ide-shell.js 的 ⌘/Ctrl+B 快捷键被连坐删掉了' unless shell.include?("event.code !== 'KeyB'")

# 12) 数据来源的网址不再显示（用户："目录里所有的数据来源的那个网址 去掉即可；
#     后期我们的数据都是自己后台上传的"）。注意：**数据里的 source 字段要留着** ——
#     生成器拿它当必填项、校验还在，删了数据以后就得重新核一遍。
issues << '正文里还渲染着"目录来源"那一行' if live.include?("'<p class=\"kp-source\">")
issues << '图谱信息面板里还渲染着"目录来源"那一行' if mind.include?("'<p class=\"mm-source\">")
issues << 'sourceHTML / 拼链接那套已经没人用（留着就是死代码）' if live.include?('function sourceHTML')
issues << '正文里还留着 .kp-source 的样式（渲染撤了就是死样式）' if html.include?('.kp-source{')
issues << '数据里 source 字段被删了（生成器拿它当必填项，删数据要重新核）' unless
  tree.include?('source: "https://')

# 13) 右栏收起**必须留一条点得回来的窄条**（用户问过："为什么右边栏没有了"）
#     根因：上一轮按用户要求把左栏底部那颗「右栏」开关撤掉（他的理由正是"各自的顶部都有了"），
#     可右栏原来收起时是 `--panel-right:0px` + `opacity:0` + `pointer-events:none` ——
#     整条宽度收成 0，而「展开右栏」那颗按钮**自己就长在条里**：收起来之后界面上再也没有回路
#     （只剩 ⌘/Ctrl+⌥/Alt+B）。左栏收起时留 56px 带着展开按钮，右栏也得是同一个待遇，
#     用户那句"各自的顶部都有了"才真的成立。
issues << '右栏收起后整条收成 0（展开按钮自己就在条里，收起来就再也点不回来）' unless
  css[/\.reader-shell\[data-right="hidden"\]\s*\{\s*--panel-right:\s*56px/m]
issues << '右栏收起还在用 pointer-events/opacity 把整条抹掉（窄条里的按钮也点不着了）' if
  css[/\.reader-shell\[data-right="hidden"\]\s*\.reader-side\s*\{[^}]*pointer-events:\s*none/m]
issues << '右栏收起时没有只留标题栏（56px 窄条里会露出正文）' unless
  css[/\.reader-shell\[data-right="hidden"\]\s*\.reader-side\s*>\s*\*:not\(\.side-bar\)\s*\{\s*display:\s*none/m]
issues << '右栏收起时那颗按钮没留在窄条里（应把 .side-bar 居中留着）' unless
  css[/\.reader-shell\[data-right="hidden"\]\s*\.side-bar\s*\{[\s\S]{0,140}?justify-content:\s*center/m]
#     另外两处同源的问题：
#     ② 1024~1279 这一档，右栏的内容落到正文下面（页面里那段两列布局），
#        所以这一列必须收成 0 —— 不收就留一条 320px 的空带，右边缘看着就是"右栏空了/没了"。
#     ③ 窄屏两栏是**摞起来**的，两颗收起按钮都没有意义；左栏那颗原来就藏了，右栏那颗漏了。
issues << '1024~1279 没把右栏那一列收成 0（右边会留一条 320px 空带，像"右栏没了"）' unless
  css[/@media \(min-width:\s*1024px\) and \(max-width:\s*1279px\)\s*\{\s*\.reader-shell\s*\{\s*--panel-right:\s*0px/m]
narrow760 = css[/@media \(max-width:\s*1023px\)\s*\{([^}]*)\}/m, 1].to_s
issues << '窄屏下右栏那颗收起按钮还露着（点了什么都不会发生）' unless narrow760.include?('.side-collapse')
# 窄屏这一条还必须在选择器里带上 .reader-shell：页面自己那份基础规则（.tree-collapse{display:inline-flex}）
# 比 ide.css **晚加载**，同权重下会把 display:none 顶回去 —— 这次就是这么发现"改了等于没改"的。
issues << '窄屏藏按钮那条没带 .reader-shell（权重不够，页面自己的基础规则会把它顶回去）' unless
  narrow760[/\.reader-shell\s+\.tree-collapse[\s\S]{0,90}?\.reader-shell\s+\.side-collapse/]
#     三栏只写一份：reader.html 里不许再有那份死副本 —— 它比 ide.css 早，
#     会把 ide.css 的两列/三列判断压回去（1024~1279 那条空带就是这么来的）。
#     **比对前先剥掉 CSS 注释**：上面那段解释里就写着 `--panel-right:320px` 这几个字，
#     不剥的话守线会被自己的注释顶红（"守线别被自己的注释骗"这个坑踩过好几次了）。
html_css = html.gsub(%r{/\*[\s\S]*?\*/}, '')
issues << 'reader.html 里又抄了一份三栏布局（那份会压住 ide.css 的判断）' if
  html_css.include?('--panel-right:320px')
issues << 'reader.html 里还留着旧顶栏面板开关的死样式（.shell-panels / .shell-panel-btn）' if
  html_css.include?('.shell-panels') || html_css.include?('.shell-panel-btn')

# 14) 两颗收起按钮的长相，与"界面上不再写快捷键"
#     用户原话："这里换成侧边栏的那种按钮" + "左边栏搜索有快捷键去掉 / 工具栏hover的时候有的
#     还带着快捷键的提示，去掉即可"。两头一起守。
#     （a）按钮换成侧栏（.ide-rail__item）那一套：无边框、34px、圆角 8、图标 18、悬停只换底色、
#         聚焦用内缩 outline；而且两栏**共用同一条规则**，各写各的迟早一边改一边忘。
btn_css = html[/\.tree-collapse,\s*\.side-collapse\{([^}]*)\}/m, 1].to_s
issues << '两颗收起按钮没共用同一条规则（应写成 .tree-collapse, .side-collapse）' if btn_css.empty?
issues << '收起按钮还留着边框（侧栏那套无边框，靠悬停换底色）' if btn_css.include?('border:1px')
issues << '收起按钮不是 34px 方形（要跟侧栏那一排图标按钮一个分量）' unless
  btn_css.include?('width:34px;height:34px')
issues << '收起按钮的图标不是 18px（侧栏的图标就是 18px）' unless
  html[/\.tree-collapse__icon,\s*\.side-collapse__icon\{[^}]*width:18px;height:18px/m]
issues << '收起按钮的悬停还会把边框染出来（侧栏那套只换底色）' if
  html[/\.tree-collapse:hover,[\s\S]{0,80}?border-color:/m]
#     （b）收起态的目录头只剩那颗按钮：上下留白 ×2 + 34 不能超过目录头的高度（--tree-head-h），
#         超了就会被固定高度裁掉一点。这条是算出来的（18+34+12=64 > 60 才会去改成 13px）。
head_pad = css[/\.reader-shell\[data-left="hidden"\] \.tree-head\s*\{[^}]*padding:\s*(\d+)px 0/m, 1]
head_h = html[/--tree-head-h:\s*(\d+)px/, 1]
issues << '收起态目录头的上下留白丢了（那颗按钮就贴到顶了）' if head_pad.nil?
if head_pad && head_h
  issues << "收起态目录头装不下那颗 34px 按钮（留白 #{head_pad}×2 + 34 > 头高 #{head_h}）" if
    head_pad.to_i * 2 + 34 > head_h.to_i
end
#     （c）提示语里不再写按键 —— **守的是设置 title 的那两行**，不是整份文件：
#         文件头的注释里本来就写着"⌘/Ctrl + B 切左栏"，整份搜会被自己的注释顶红（踩过这个坑）。
fs_title = shell[/btn\.setAttribute\('title',\s*([^;]*)\);/, 1].to_s
issues << '「全屏」按钮的提示语里又带上了按键（应只是「全屏模式 / 退出全屏」）' if
  fs_title.include?('⌘') || fs_title.include?('Esc')
side_title = shell[/sideBtn\.setAttribute\('title',\s*([^;]*)\);/, 1].to_s
issues << '右栏那颗按钮的提示语里又带上了快捷键（应只是「展开右栏 / 隐藏右栏」）' if
  side_title.include?('⌘')
issues << '右栏那颗按钮在 HTML 里的初始 title 还带着快捷键' if html.include?('title="隐藏右栏（')

puts '左栏目录: 手写 %d 行（应为 0）· 学段按钮 %d 个（默认 初中）' % [body.scan(/class="ch-row"/).size, chips.size]
puts "册 / 板块: #{books} 册 + #{tracked} 个板块，全部带 stage 标记"
puts issues.empty? ? '章节页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
