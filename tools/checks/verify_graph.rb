# encoding: UTF-8
# 知识图谱页体检：满屏骨架、底部工具条、悬浮面板、默认年级；并核对与白板的样式同源
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
issues = []

graph = File.read(File.join(ROOT, 'graph.html'), encoding: 'UTF-8')
mini  = File.read(File.join(ROOT, 'assets/js/mindmap.js'), encoding: 'UTF-8')
shell = File.read(File.join(ROOT, 'assets/js/ide-shell.js'), encoding: 'UTF-8')
wb    = File.read(File.join(ROOT, 'whiteboard.html'), encoding: 'UTF-8')
# 共享样式区（从白板生成、改名抄到图谱的那一段）。
# 页面自己的修正必须写在它之外，否则下次重新生成样式就被冲掉。
shared = graph[/\/\* MM-SHARED-BEGIN \*\/(.*?)\/\* MM-SHARED-END \*\//m, 1].to_s

# ---------- 1. 满屏骨架：去掉页头，画布独占 ----------
issues << '还能看到旧的页头 .mm-head' if graph.include?('class="mm-head"')
issues << '还留着"框架全屏"按钮' if graph.include?('mm-frame')
issues << '还留着"浏览器全屏"按钮' if graph.include?('id="mm-full"')
issues << '还留着框架全屏的样式钩子 data-mm-frame' if graph.include?('data-mm-frame')
issues << '缺少单列骨架 .reader-shell.mm-shell' unless graph.include?('.reader-shell.mm-shell')
issues << '画布没有铺满（缺 .mm-canvas{position:absolute;inset:0}）' unless graph =~ /\.mm-canvas\{position:absolute;inset:0/
issues << '画布没有回到第 1 列（CSS Grid 隐式列会把它压成 1px）' unless graph.include?('.mm-stage{grid-column:1')
issues << '侧栏的全屏按钮缺失（全站统一在左下角）' unless graph.include?('id="toggle-fullscreen"')

# ---------- 2. 底部工具条 ----------
issues << '缺底部工具条 .mm-dock' unless graph.include?('class="mm-dock"')
%w[mm-book-btn mm-book-menu mm-level-btn mm-level-menu mm-search-toggle mm-fit mm-out mm-reset mm-in mm-help-btn mm-help-menu].each do |id|
  issues << "工具条缺 ##{id}" unless graph.include?("id=\"#{id}\"")
end
issues << '工具条按钮没有自绘提示（应用 data-mm-tip，不要系统 title）' unless graph.include?('data-mm-tip=')
dock = graph[/<div class="mm-dock".*?<\/div>\s*<\/div>\s*<\/section>/m].to_s
issues << '工具条里还有系统 title 气泡' if dock =~ /\stitle="/

# ---------- 3. 悬浮面板（与白板题库面板同一套） ----------
issues << '缺悬浮信息面板 #mm-panel' unless graph.include?('id="mm-panel"')
issues << '信息面板没有默认收起（应带 hidden）' unless graph =~ /id="mm-panel"[^>]*hidden/
issues << '信息面板标题栏缺拖拽手柄' unless graph.include?('mm-card__grip')
issues << '信息面板缺关闭按钮' unless graph.include?('id="mm-panel-close"')
issues << '缺悬浮定位面板 #mm-search-panel' unless graph.include?('id="mm-search-panel"')
issues << '定位面板没有默认收起' unless graph =~ /id="mm-search-panel"[^>]*hidden/
issues << '定位面板缺标题栏' unless graph.include?('id="mm-search-head"')
issues << 'board-link.js 依赖的 #mm-panel 不见了（题目旁边的小按钮会失效）' unless graph.include?('id="mm-panel"')

# ---------- 4. 浮层内容 ----------
books = graph.scan(/data-book="/).size
issues << "册浮层应有 7 项（总览 + 六册），实际 #{books}" unless books == 7
folds = graph.scan(/data-fold="/).size
issues << "层级浮层应有 3 档，实际 #{folds}" unless folds == 3
%w[mm-help__title mm-help__list mm-help__legend mm-help__note].each do |cls|
  issues << "说明浮层缺 #{cls}（介绍与提示应能收进工具条）" unless graph.include?(cls)
end

# ---------- 5. mindmap.js 的接线 ----------
{
  '册浮层选项监听' => "qsa('#mm-book-menu [data-book]')",
  '层级浮层选项监听' => "qsa('#mm-level-menu [data-fold]')",
  '状态同步 syncScope' => 'function syncScope()',
  '默认年级 initialScope' => 'function initialScope()',
  '登录态判定 signedIn' => 'function signedIn()',
  '面板拖动 bindDrag' => 'function bindDrag(card, handle)',
  '自查接口 window.__MM__' => 'window.__MM__',
  '记住上次看的册' => "SCOPE_KEY = 'wkmath.graph.scope'"
}.each do |label, needle|
  issues << "mindmap.js 缺#{label}" unless mini.include?(needle)
end
%w[mm-frame mm-full .mm-fold__btn .segmented__item mm-panel__empty].each do |stale|
  issues << "mindmap.js 还引用已删除的 #{stale}" if mini.include?(stale)
end

# ---------- 5b. 筛选范围的分法切换（年级教材 / 几何代数） ----------
# 数据那边：每一章都得带课标领域，而且三个体系加起来正好是全部 29 章（不重不漏）。
# 漏一章不会报错、只会安静地少一块，所以必须在这里守着。
tree = File.read(File.join(ROOT, 'assets/js/math-tree.js'), encoding: 'UTF-8')
chap_lines = tree.scan(/kind: "chapter"[^}]*/)
issues << "math-tree.js 里章数不是 29（实际 #{chap_lines.size}）" unless chap_lines.size == 29
missing_field = chap_lines.reject { |l| l.include?('field: "') }
issues << "有 #{missing_field.size} 章没带课标领域（图谱的体系那一栏会少一块）" unless missing_field.empty?
# 本机 Ruby 是 2.6（系统自带），没有 Hash#tally，手数一遍
field_counts = Hash.new(0)
chap_lines.each { |l| field_counts[l[/field: "([^"]+)"/, 1]] += 1 }
issues << "课标领域不止三个（实际 #{field_counts.keys.join('、')}）" unless field_counts.size == 3
issues << "领域章数不是 13 / 13 / 3，加起来对不上 29（实际 #{field_counts.map { |k, v| "#{k}:#{v}" }.join(' ')}）" unless
  field_counts['图形与几何'] == 13 && field_counts['数与代数'] == 13 && field_counts['统计与概率'] == 3

# 页面那边：分法条 + 两栏名单
issues << '筛选浮层里没有分法切换条 #mm-axis' unless graph.include?('id="mm-axis"')
issues << '分法只有一格（应有"年级教材"与"几何代数"两格）' unless
  graph.scan(/data-axis="/).size == 2
%w[book field].each do |key|
  issues << "分法缺 data-axis=\"#{key}\" 这一格" unless graph.include?(%(data-axis="#{key}"))
end
issues << '分法条的两格没有 aria-pressed（读屏看不出当前按哪种分法）' unless
  graph[/id="mm-axis"[\s\S]{0,600}?aria-pressed/]
issues << '两栏名单缺 data-axis-pane' unless graph.scan(/data-axis-pane="/).size == 2
issues << '体系那一栏默认该收着（hidden）' unless
  graph[/data-axis-pane="field"[^>]*hidden/]
fields_in_page = graph.scan(/data-field="([^"]*)"/).flatten
issues << "体系那一栏应有 4 项（总览 + 三个体系），实际 #{fields_in_page.size}" unless fields_in_page.size == 4
%w[图形与几何 数与代数 统计与概率].each do |name|
  issues << "体系那一栏少了「#{name}」" unless fields_in_page.include?(name)
end
issues << '体系那一栏缺「总览 · 全部体系」' unless fields_in_page.include?('')
issues << '图例里没有「体系」这一行' unless graph.include?('lg--field')
issues << '推理节点样式缺 .mm-node--field' unless graph.include?('.mm-node--field .mm-node__box')
issues << '分法切换的样式跑进了共享区（重新生成样式时会被冲掉）' if
  shared.include?('.mm-axis{') || shared.include?('--field .mm-node__box')
issues << '分法把浮层标成 role=menu（菜单里必须放 menuitem，这里放不下分法条与两栏）' if
  graph[/id="mm-book-menu"[^>]*role="menu"/]

# mindmap.js 这边：合成根与它的接线
{
  '体系合成根 fieldScope' => 'function fieldScope(',
  '体系反查 scopeContains' => 'function scopeContains(',
  '孩子的索引 kidsSet' => 'kidsSet:',
  '分法切换 setAxis' => 'function setAxis(',
  '分法记忆 AXIS_KEY' => "AXIS_KEY = 'wkmath.graph.axis'",
  '分法条监听' => "qsa('#mm-axis [data-axis]')",
  '体系项监听' => "qsa('#mm-book-menu [data-field]')"
}.each do |label, needle|
  issues << "mindmap.js 缺#{label}" unless mini.include?(needle)
end
issues << '没有把课标领域也认作合法范围（initialScope 会把它当坏数据丢掉）' unless
  mini.include?('isFieldScope(saved)')

# ---------- 6. 会话（登录后按学生年级） ----------
{
  '本机会话键' => "SESSION_KEY = 'wkmath.user'",
  '登录写入' => 'function signIn(',
  '退出清除' => 'function signOut(',
  '对外接口 window.WK_SHELL' => 'window.WK_SHELL'
}.each do |label, needle|
  issues << "ide-shell.js 缺#{label}" unless shell.include?(needle)
end
issues << 'mindmap.js 没有从会话里取年级' unless mini.include?('window.WK_SHELL')

# ---------- 7. 与白板的样式同源：逐条比对规则正文 ----------
def rule_body(css, selector)
  # 取第一次出现的该选择器规则（选择器要整体匹配，避免 __head 之类串到父类）
  pattern = /(?:^|\})\s*#{Regexp.escape(selector)}\s*\{([^{}]*)\}/m
  m = css.match(pattern)
  m && m[1].gsub(/\s+/, ' ').strip
end

pairs = [
  ['.wb-dock', '.mm-dock'],
  ['.wb-dock__btn', '.mm-dock__btn'],
  ['.wb-dock__btn svg', '.mm-dock__btn svg'],
  ['.wb-dock__sep', '.mm-dock__sep'],
  ['.wb-dock__level', '.mm-dock__level'],
  ['.wb-dock__group', '.mm-dock__group'],
  ['.wb-flyout', '.mm-flyout'],
  ['.wb-flyout__item', '.mm-flyout__item'],
  ['.wb-flyout__item kbd', '.mm-flyout__item kbd'],
  ['.wb-bank', '.mm-card'],
  ['.wb-bank__head', '.mm-card__head'],
  ['.wb-bank__grip', '.mm-card__grip'],
  ['.wb-bank__close', '.mm-card__close']
]

compared = 0
pairs.each do |wb_sel, mm_sel|
  a = rule_body(wb, wb_sel)
  b = rule_body(graph, mm_sel)
  if a.nil?
    issues << "白板里找不到 #{wb_sel}（无法比对）"
  elsif b.nil?
    issues << "图谱里找不到 #{mm_sel}（工具条样式缺失）"
  else
    compared += 1
    issues << "#{mm_sel} 与白板不一致：\n    板 #{a}\n    图 #{b}" unless a == b
  end
end

# 悬浮提示的气泡：同样要一致，但**允许且仅允许一处不同** —— 属性的名字。
# 图谱上挂的是 data-mm-tip，白板上挂的是 data-wb-tip，所以两边读的 attr(...) 本来就该不一样；
# 其余（位置、底色、圆角、出现动画）必须逐字一致，免得两边气泡长得不一样。
tip_a = wb[/\[data-wb-tip\]::after\{([^}]*)\}/m, 1].to_s.gsub(/\s+/, ' ').strip
tip_b = graph[/\[data-mm-tip\]::after\{([^}]*)\}/m, 1].to_s.gsub(/\s+/, ' ').strip
tip_b_cmp = tip_b.gsub('attr(data-mm-tip)', 'attr(data-wb-tip)')
issues << '悬浮提示气泡与白板不一致（除 attr() 里的属性名之外应逐字相同）' unless tip_a == tip_b_cmp && !tip_a.empty?
issues << '图谱的提示气泡没有读 data-mm-tip（会显示成空白）' unless tip_b.include?('attr(data-mm-tip)')
compared += 1

# ---------- 8. 工具条尺寸：组按钮要装得下文字，浮层不能被书名挤爆 ----------
# 这是一次真实回归：共享样式来自白板，白板的组按钮只有图标（34px 正好），
# 图谱的组按钮多了一个文字状态，继续用固定宽度会把文字挤出可点区域。
issues << '图谱的组按钮还是被钉在固定宽度上（文字会被挤出可点区域）' unless
  graph.include?('.mm-dock__btn--group{width:auto')
issues << '册筛选 / 层级浮层没按内容自适应宽度（书名会被压到贴着右侧数字）' unless
  graph.include?('#mm-level-menu{width:max-content')
issues << '浮层没留兜底最大宽度（超长书名会把浮层撑破）' unless
  graph.include?('max-width:min(240px,calc(100vw - 40px))')
issues << '浮层行高没拉开（26px 装 12.5px 中文偏挤）' unless
  graph.include?('height:28px;padding:0 8px;gap:9px')

# 反面：这些修正必须写在共享区之外，否则下次重新生成样式就被冲掉
issues << '工具条修正被写进了共享区（重新生成样式时会被覆盖）' if
  shared.include?('width:max-content') || shared.include?('--group{width:auto')

# ---------- 9. 浮层里的"提示"必须是真话 ----------
# 册筛选原来挂了一排 0~6 的快捷键徽标，但 0~6 并没有绑定任何键 —— 说了做不到，已删。
# 层级浮层的 ⇧2 / ⇧3 / ⇧4 是真绑定的，必须留着。
# 注意：这里不能用 `<div ...>.*?</div>` —— 浮层里现在有嵌套的 div（分法条 + 两栏），
# 非贪婪匹配会停在第一个 </div> 上，于是"扫全盘"悄悄变成"只扫开头"，
# 底下那条"不许出现假快捷键徽标"的守线就名存实亡了。
book_i = graph.index('id="mm-book-menu"')
next_group_i = book_i ? graph.index('<div class="mm-dock__group">', book_i) : nil
book_menu = book_i ? graph[book_i...(next_group_i || graph.length)].to_s : ''
issues << '图谱里找不到册筛选浮层' if book_menu.empty?
issues << '册筛选里又出现了快捷键徽标（0~6 并未绑定任何键）' if book_menu.include?('<kbd>')
# 正面：捕获必须扫到浮层最后一项 —— 否则上面那条守线只是看着还在
issues << '册筛选浮层的捕获没扫到最后一个册（守线范围被截断了）' unless
  book_menu.include?('九年级（下）')

level_menu = graph[/<div class="mm-flyout" id="mm-level-menu".*?<\/div>/m].to_s
issues << '层级浮层的快捷键徽标被误删了（⇧2 / ⇧3 / ⇧4 是真绑定的，要留）' unless
  level_menu.scan('<kbd>⇧').size == 3

# 当前选中的那一册 / 那一档，视觉上必须看得出来
issues << '浮层项没有被标上 is-on（选中态只有读屏知道，眼睛看不到）' unless
  mini.include?("classList.add('is-on')")

# ---------- 10. 选中的节点不许"隐身" ----------
# --math-primary-foreground 是 #ffffff（给"主色底上的字"用的）。但只有 root / book /
# chapter 有底色板，节 / 栏目 / 知识点只有纯文字 —— 若沿用"选中 = 白字"，
# 白字画在白底上就整段消失（用户报过一次：点「方法速学」后节点没了）。
tokens = File.read(File.join(ROOT, 'assets/css/tokens.css'), encoding: 'UTF-8')
issues << 'tokens 里 --math-primary-foreground 不再是浅色，这条断言的前提变了' unless
  tokens =~ /--math-primary-foreground:\s*#fff/i
issues << '纯文字节点没被标上 is-text（选中时会沿用"白字"那条规则）' unless
  mini.include?("if (!BOXED[node.kind]) cls.push('is-text')")
issues << '选中的纯文字节点仍会把字刷成白色（白底白字 = 看不见）' unless
  graph.include?('.mm-node.is-selected.is-text .mm-label{fill:var(--math-primary)}')
issues << '选中的纯文字节点没有可见的底块（选中态看不出来）' unless
  graph.include?('.mm-node.is-selected.is-text .mm-node__hit{fill:var(--math-primary-tint)}')
# ---------- 11. 浮层的事件不许泄漏到画布 ----------
# 浮层（节点面板 / 定位面板 / 工具条）都是 .mm-canvas 的子元素，事件会冒泡到画布。
# 不拦的话：拖浮窗会把整张图一起平移，在面板里滚轮会变成缩放图谱。
guard = mini.scan('if (insideOverlay(event.target)) return;').size
issues << "画布对浮层事件的拦截不完整（pointerdown 与 wheel 两处都要，实际 #{guard} 处）" unless guard == 2
issues << 'insideOverlay 没把浮层类名列全（应含 .mm-card / .mm-dock / .mm-flyout）' unless
  mini.include?("'.mm-card, .mm-dock, .mm-flyout'")
issues << '拖浮窗时没有阻止事件冒泡（stopPropagation）' unless
  mini.include?('if (event.stopPropagation) event.stopPropagation();')

# 提示气泡：生成器只改选择器、不改声明体里的属性名，会让 content 变成空串 ——
# 表现就是"鼠标滑过底部按钮，一条提示都看不见"（真出过这个 bug）。
# 这里盯死：图谱里不许再出现 wb- 前缀的属性引用，且提示规则必须读 data-mm-tip。
issues << '提示气泡读的还是 data-wb-tip（生成器漏改声明体，气泡会空着）' if
  graph.include?('attr(data-wb-tip)')
issues << '提示气泡规则不见了（[data-mm-tip]::after 应为 content:attr(data-mm-tip)）' unless
  graph[/\[data-mm-tip\]::after\{[^}]*content:attr\(data-mm-tip\)/m]
# 底部每个按钮都要挂上提示，别再出现"一排按钮只有一半有名字"
# （按整份文件数：mm-dock__btn / mm-dock__level 都算工具条按钮，data-mm-tip 只挂在它们身上）
btn_count = graph.scan(/class="mm-dock__btn/).size + graph.scan(/class="mm-dock__level"/).size
tip_count = graph.scan(/data-mm-tip="/).size
issues << "底部按钮只有 #{tip_count} 个挂了提示（工具条上有 #{btn_count} 个按钮）" if tip_count < btn_count

puts "图谱页体检：#{issues.empty? ? '通过' : '发现问题'}"
puts "  与白板逐条比对的样式：#{compared} 条"
unless issues.empty?
  puts
  issues.each { |i| puts "  ✗ #{i}" }
  exit 1
end
