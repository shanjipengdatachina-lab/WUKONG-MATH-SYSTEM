# encoding: UTF-8
# 白板页体检
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
html = File.read(File.join(ROOT, 'whiteboard.html'), encoding: 'UTF-8')
# 引擎源码在一开头就读进来：守线是**按段落一条条加的**，谁先谁后不固定 ——
# 原来它读在中段，前面某条守线用到 wbjs 就 `NameError` 崩了，
# 而崩掉的体检脚本一行 ✗ 都不打，"没跑完"被当成了"没红灯"（2026-09-29 真踩过这一下）。
wbjs = File.read(File.join(ROOT, 'assets/js/whiteboard.js'), encoding: 'UTF-8')
issues = []
# 滚轮 = 放大缩小（用户 2026-09-30："白板和图谱的滚轮也应该设置成放大缩小，而不是现在的上下移动"）：
# 原来 onWheel 里分两支 —— ⌘ / Ctrl + 滚轮才缩放，光滚轮是上下平移；那条口径撤了。
wb_wheel = wbjs[/function onWheel\(e\) \{[\s\S]{0,600}?\n  \}/].to_s
issues << '白板里找不到 onWheel（守线要跟着改）' if wb_wheel.empty?
issues << '白板的滚轮又变回"带 ⌘ / Ctrl 才缩放"了（用户："滚轮也应该设置成放大缩小"）' if
  wb_wheel[/ctrlKey|metaKey/]
issues << '白板的滚轮缩放没锚在指针上（应围着指针那个点放大 / 缩小）' unless
  wb_wheel.include?('zoomAt(cx.sx, cx.sy')

# 右键 = 平移板面（用户 2026-09-30："白板右键可以拖动画板"）——
# 跟时间轴一条口径：鼠标三个键里只有左键落笔，中键与右键都归平移。
wb_down = wbjs[/function onDown\(e\) \{[\s\S]{0,4000}?\n  \}/].to_s
issues << '白板里找不到 onDown（守线要跟着改）' if wb_down.empty?
issues << '白板的右键又被挡在门外了（用户："右键可以拖动画板"）' if
  wb_down[/e\.button !== 0 && e\.button !== 1\)\s*return;/]
issues << '白板的右键没有进平移分支（中键 / 右键都该是平移）' unless
  wb_down[/e\.button === 1 \|\| e\.button === 2/]
issues << '白板的左键被顺手改成平移了（左键得留着落笔）' if
  wb_down[/e\.button === 0[^\n]*startPan/]
issues << '板面没屏蔽浏览器右键菜单（菜单一弹就把 pointerup 抢走，拖动会断在半路）' unless
  wbjs[/addEventListener\('contextmenu'[\s\S]{0,160}?preventDefault/]
%w[header nav main aside section div ul li button canvas label p a].each do |tag|
  o = html.scan(/<#{tag}[\s>]/i).length
  c = html.scan(%r{</#{tag}>}i).length
  issues << "#{tag} 标签不配平(#{o}/#{c})" if o != c
end

need = {
  '侧栏外壳' => 'class="ide-rail"',
  '侧栏版本标记' => 'data-shell="2"',
  '白板入口高亮' => 'data-nav-key="whiteboard" data-active="true"',
  '单列骨架（无左右栏）' => 'class="reader-shell wb-shell"',
  '单列优先于 ide.css 三栏' => '.reader-shell.wb-shell{display:grid;grid-template-columns:minmax(0,1fr)',
  '悬浮题库面板' => 'class="wb-bank" id="wb-bank" aria-label="题库" hidden',
  '题库拖拽标题栏' => 'class="wb-bank__head" id="wb-bank-head"',
  '拖拽手柄图标' => 'data-lucide="grip-vertical"',
  '题库关闭按钮' => 'class="wb-bank__close" id="wb-bank-close"',
  '工具条题库按钮' => 'class="wb-dock__btn" id="wb-bank-toggle"',
  '题库按钮用书库图标' => 'data-lucide="library-big"',
  '题目列表容器' => 'id="wb-bank-list"',
  '题目搜索框' => 'id="wb-search"',
  '册筛选' => 'id="wb-books"',
  '画布' => 'id="wb-canvas"',
  '悬浮工具条' => 'class="wb-dock"',
  '工具组：画笔组格子' => 'wb-dock__btn wb-dock__btn--group" id="wb-group-draw"',
  '工具组：图形组格子' => 'wb-dock__btn wb-dock__btn--group" id="wb-group-shape"',
  '画笔组浮层' => 'class="wb-flyout" id="wb-flyout-draw"',
  '图形组浮层' => 'class="wb-flyout" id="wb-flyout-shape"',
  '格子内按当前工具切换图标' => '.wb-dock__btn--group[data-active="pen"] [data-wb-ico="pen"]',
  '格子右下角的小三角' => 'class="wb-dock__caret"',
  '浮层样式' => '.wb-flyout{',
  '浮层项样式' => '.wb-flyout__item{',
  '画笔按钮' => 'id="wb-pen"',
  '荧光标记按钮' => 'id="wb-highlighter"',
  '橡皮按钮' => 'id="wb-eraser"',
  '直线按钮' => 'id="wb-line"',
  '箭头按钮' => 'id="wb-arrow"',
  '矩形按钮' => 'id="wb-rect"',
  '椭圆按钮' => 'id="wb-ellipse"',
  '缩放控件在工具条内' => 'id="wb-zoom-level"',
  '放大按钮' => 'id="wb-zoom-in"',
  '缩小按钮' => 'id="wb-zoom-out"',
  '适应内容（工具条上、「放大」右边）' => 'class="wb-dock__btn" id="wb-zoom-fit"',
  '全屏按钮在侧栏（与全站一致）' => 'id="toggle-fullscreen"',
  '撤销按钮' => 'id="wb-undo"',
  '重做按钮' => 'id="wb-redo"',
  '清空按钮' => 'id="wb-clear"',
  '网格按钮' => 'id="wb-grid"',
  '题面开关' => 'id="wb-problem-toggle"',
  '回到知识点按钮' => 'class="wb-dock__btn" id="wb-jump-kp"',
  '设置面板开关' => 'id="wb-settings"',
  '悬浮设置面板' => 'id="wb-pop"',
  '颜色区' => 'id="wb-colors"',
  '笔粗区' => 'id="wb-widths"',
  '橡皮大小区' => 'id="wb-erasers"',
  '题面文字镜像（无障碍）' => 'id="wb-problem-text"',
  '板面选择器' => 'id="wb-themes"',
  '板面选择器样式' => '.wb-theme{',
  '网格疏密区' => 'id="wb-grids"',
  '网格疏密选择器样式' => '.wb-grid{',
  '画布底色跟着主题' => 'background:var(--wb-board,var(--math-background))',
  '题库脚本' => 'whiteboard-problems.js',
  '上传我的题（在底部工具条上）' => 'id="wb-act-upload"',
  '右侧竖工具条' => 'class="wb-side" id="wb-side"',
  '竖条上的分析按钮' => 'id="wb-act-analysis"',
  '竖条上的转译按钮' => 'id="wb-act-transcribe"',
  '竖条上的保存按钮' => 'id="wb-act-save"',
  '保存菜单（存题 / 导出）' => 'class="wb-menu" id="wb-save"',
  '分析答案面板' => 'id="wb-panel"',
  '面板的两个 tab' => 'class="wb-tabs"',
  '分析 tab 的条目列表' => 'id="wb-think-list"',
  '答案 tab 的标准答案行' => 'id="wb-answer-result"',
  '答案 tab 的注释开关' => 'id="wb-act-notes"',
  '分析与答案数据脚本' => 'whiteboard-analysis.js',
  '白板脚本' => 'whiteboard.js'
}
need.each { |label, token| issues << "缺 #{label}" unless html.include?(token) }

# 悬浮题库面板：必须是画板里的浮层，不能再占网格列
stage_i = html.index('<section class="wb-stage"')
bank_i = html.index('<aside class="wb-bank"')
issues << '题库面板没有放进画板（应作为 .wb-stage 的浮层子元素）' unless stage_i && bank_i && bank_i > stage_i
issues << '题库面板缺少绝对定位（应悬浮，不占画布空间）' unless html.include?('.wb-bank{') && html.include?('position:absolute;left:20px;bottom:80px')
issues << '题库面板没有拖拽态光标' unless html.include?('.wb-bank__head{') && html.include?('cursor:grab')
issues << '题库面板仍按窄屏堆叠（应始终悬浮）' if html.include?('#wb-bank{position:static')
issues << '仍保留旧的题库栏骨架类名' if html.include?('wb-pane-head') || html.include?('wb-pane-title')
issues << '侧栏仍留着旧的题库栏开关' if html.include?('id="toggle-left"')

# 工具条分组：画笔 / 图形这 7 个按钮必须收进两组浮层，条上只留两个格子
%w[wb-pen wb-highlighter wb-eraser wb-line wb-arrow wb-rect wb-ellipse].each do |id|
  unless html =~ /<button[^>]*class="wb-flyout__item"[^>]*id="#{id}"/
    issues << "工具 #{id} 没在浮层里（应带 wb-flyout__item 类）"
  end
end
%w[wb-group-draw wb-group-shape].each do |id|
  issues << "工具组格子 #{id} 的类名不对" unless html =~ /<button[^>]*wb-dock__btn--group"[^>]*id="#{id}"/
end

issues << '仍保留顶部工具条' if html.include?('class="wb-tools"')
issues << '仍保留右侧悬浮栏目' if html.include?('class="wb-zoom"')
issues << '仍保留画布上方的题面卡片' if html.include?('class="wb-problem" id="wb-problem"')
issues << '标签页标题异常' unless html =~ /<title>数字白板/ && html.rstrip.end_with?('</html>')

puts "whiteboard.html: #{html.bytesize} 字节"

# 工具条槽位统计（分组后应该明显变少）
plain = html.scan(/class="wb-dock__btn"/).length
groups = html.scan(/class="wb-dock__btn wb-dock__btn--group"/).length
level = html.scan(/class="wb-dock__level"/).length
puts "工具条槽位: #{plain + groups + level} 个（工具组 #{groups} + 普通按钮 #{plain} + 缩放读数 #{level}）"
# 15 = 原来 14 + 「适应内容」。这一格是**故意加的**：它原先藏在「画笔设置」浮层里
# （一行「视图」+ 一个带文字的按钮），用户要求挪到工具条上、紧挨着「放大」右边 ——
# 找一个"适应内容"得先打开设置，本来就不合理。
# 上限仍然卡得紧：以后再加按钮，先想能不能并进已有的组，别顺手就加一格。
issues << '工具条槽位又变多了，检查是否把同类工具拆回了单个按钮' unless plain + groups + level <= 15

# 「适应内容」的三件事一起守（用户原话："适应内容按钮挪出来，放在放大按钮的右边；换个图标表示适配内容"）：
#   ① 位置：紧跟在「放大」之后（原来藏在「画笔设置」浮层里 —— 找一个适应内容得先打开设置）
#   ② 长相：走工具条按钮那一套，不是原来那个带文字的 .wb-view-btn
#   ③ 图标：maximize-2（四角向外 = "把内容撑满、一眼看全"），与图谱页的「适应窗口」同一个 ——
#      同一个动作同一个图标。原来那支是 scan，几个方括号读起来像"扫描"
# 比之前先把 HTML 注释剥掉：这两个按钮之间正好夹着一段"为什么挪过来"的说明，
# 不剥的话窗口宽度就得跟着注释长度调（第一版写 400 就是被它顶掉的）。
html_bare = html.gsub(/<!--[\s\S]*?-->/, '')
zoom_seq = html_bare[/id="wb-zoom-in"[\s\S]{0,300}?id="wb-zoom-fit"[\s\S]{0,300}?<\/button>/m].to_s
issues << '「适应内容」不在「放大」右边（要求的顺序：缩小 · 读数 · 放大 · 适应内容）' if zoom_seq.empty?
issues << '「适应内容」没走工具条按钮那一套样式' unless zoom_seq.include?('class="wb-dock__btn" id="wb-zoom-fit"')
issues << '「适应内容」的图标不是 maximize-2（应与图谱「适应窗口」同一个）' unless zoom_seq.include?('data-lucide="maximize-2"')
# 「提示气泡里不许再出现按键」（用户原话："工具栏hover的时候有的还带着快捷键的提示，去掉即可"）。
# 以前是有的带、有的不带（撤销 ⌘Z / 题库 ⌘B / 适应内容 ⇧1 带，显示题面 / 放大不带），
# 一悬停就觉得不齐。**快捷键本身照旧好使**，只是不再写在提示里。
tips = html.scan(/data-(?:wb|mm)-tip="([^"]*)"/).flatten
issues << '工具条提示里还带着按键（气泡里不该出现 ⌘ / ⇧ / 单个字母键）' if
  tips.any? { |t| t =~ /[⌘⇧]| [A-Za-z]\z/ }
issues << '网格按钮的静态气泡里又跟上了按键（应只是「网格 · 疏/中/密」）' unless
  html[/data-wb-tip="网格 · (疏|中|密)"/]
wbjs_tip = wbjs[/gridBtn\.setAttribute\('data-wb-tip',([^;]*)\)/, 1].to_s
issues << '网格气泡的动态那一段仍把按键拼在后面（+ \' G\'）' if wbjs_tip.include?("' G'")
issues << '.wb-view-btn 成了死样式（那个按钮已经挪到工具条上）' if html.include?('.wb-view-btn{')

# 紧凑度：浮层 / 工具条 / 设置面板都收过一档，别又松回去
tight = {
  '浮层行高 26px' => '.wb-flyout__item{',
  '浮层宽度 146px' => 'min-width:146px;padding:4px',
  '浮层图标 14px' => '.wb-flyout__item svg{flex:none;width:14px;height:14px}',
  '浮层行间距 1px' => 'flex-direction:column;gap:1px',
  '工具条按钮 34px' => 'width:34px;height:34px;padding:0',
  '工具条图标 16px' => '.wb-dock__btn svg{width:16px;height:16px}',
  '设置面板内边距 12/14' => 'padding:12px 14px',
  '色板 22px' => 'width:22px;height:22px;padding:2px'
}
tight.each do |label, token|
  issues << "紧凑度回退：缺 #{label}" unless html.include?(token)
end
issues << '浮层行高又变回 32px' if html.include?('height:32px;padding:0 9px')
issues << '工具条按钮又变回 36px' if html.include?('width:36px;height:36px;padding:0')

# 激活态提示：圆角实心块（专业工具条做法），不再是圈住图标的圆环
shape = {
  '工具条是圆角矩形而不是胶囊' => 'border:1px solid var(--math-border);border-radius:var(--math-radius-lg)',
  '按钮是圆角方形而不是圆形' => 'border:1px solid transparent;border-radius:var(--math-radius-md)',
  '激活块用实心浅色 + 主色图标' =>
    '.wb-dock__btn.is-on{border-color:transparent;background:var(--math-primary-tint);color:var(--math-primary)}',
  '激活块悬停时加深一档' => '.wb-dock__btn.is-on:hover{background:var(--math-primary-200)}'
}
shape.each { |label, token| issues << "激活态缺「#{label}」" unless html.include?(token) }
issues << '浮层里当前工具的高亮没跟工具条统一' unless
  html.include?('.wb-flyout__item.is-on{background:var(--math-primary-tint);color:var(--math-primary)}')
issues << '激活态又用回「圆圈描边」' if
  html[/\.wb-dock__btn\.is-on\{[^}]*border-color:var\(--math-primary-200\)/]
issues << '工具条又变回胶囊' if html[/\.wb-dock\{[^}]*border-radius:999px/]
issues << '工具条按钮又变回圆形' if html[/\.wb-dock__btn\{[^}]*border-radius:999px/]
# 保留的圆只应是语义上该圆的：色板（含色板内圆）、笔迹预览点、橡皮预览环、册筛选胶囊。
# **只数共享区（wb-styles）**：要守的是"工具条 / 浮层这些共用控件别变回胶囊"，
# 而回归风险只存在于共享区。页面自己的小控件用胶囊是合理的
# （「演示」标、语气标这种小标签本来就是圆的），数进去只会逼着后来人改预期数字。
shared_css = html[/<style id="wb-styles">(.*?)<\/style>/m, 1].to_s
round_ok = shared_css.scan(/border-radius:999px/).length
issues << "共享区里的圆形用法数量异常（#{round_ok}，应为 6）" unless round_ok == 6

# 悬浮提示：自绘气泡替掉系统灰框，工具条上不再挂 title
dock_html = html[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
issues << '工具条又挂回了系统 title 气泡' if dock_html.include?('title="')
issues << '自绘提示样式缺失' unless html.include?('content:attr(data-wb-tip)')
issues << '浮层展开时没有抑制提示' unless html.include?('[data-wb-tip][aria-expanded="true"]::after{display:none}')
# 自绘提示：底部工具条 11 个 + 竖工具条 3 个 + 浮层里的几处（数一数异常了就是有人加/删忘了说）
issues << '自绘提示数量异常（' + html.scan('data-wb-tip="').length.to_s + '）' unless html.scan('data-wb-tip="').length == 18

# 提示气泡要真的浮在工具条**之上**：气泡锚在按钮上，而工具条自己还有 padding + border，
# 差值太小就会压住工具栏的边框，看着像"挡在工具栏上"。
tip_gap  = html[/\[data-wb-tip\]::after\{[^}]*?bottom:calc\(100% \+ (\d+)px\)/m, 1].to_i
dock_pad = html[/\.wb-dock\{[^}]*?padding:(\d+)px/m, 1].to_i
dock_bw  = html[/\.wb-dock\{[^}]*?border:(\d+)px/m, 1].to_i
clearance = tip_gap - dock_pad - dock_bw
issues << "提示气泡离工具条上沿只有 #{clearance}px，会压住工具栏（至少要 8px）" if clearance < 8

# 操作反馈（全站 toast）也不能压住工具条。它挂在 document.body 上、定位是全站统一的
# bottom:28px，而白板工具条底边在 18px、顶边在 64px —— 必然重叠。
# 覆盖规则必须写在样式表 <link> 之后（同权重靠文档顺序取胜），选择器要盖住 body 那一层。
toast_bottom = html[/body \.toast-stack\{[^}]*?bottom:calc\((\d+)px/m, 1].to_i
if toast_bottom.zero?
  issues << '白板页没有把操作反馈抬到工具条上方（body .toast-stack 覆盖缺失或选择器选不中）'
else
  dock_bottom = html[/\.wb-dock\{[^}]*?bottom:(\d+)px/m, 1].to_i
  dock_h      = html[/\.wb-dock__btn\{[^}]*?width:(\d+)px;height:(\d+)px/m, 1].to_i +
                2 * html[/\.wb-dock\{[^}]*?padding:(\d+)px/m, 1].to_i +
                2 * html[/\.wb-dock\{[^}]*?border:(\d+)px/m, 1].to_i
  gap = toast_bottom - (dock_bottom + dock_h)
  issues << "操作反馈离工具条上沿只有 #{gap}px，会压住工具栏（至少要 8px）" if gap < 8
end
link_i  = html.index('assets/css/shell.css')
style_i = html.index('<style id="wb-page-styles">')
issues << 'toast 覆盖写在了样式表之前，会被 shell.css 盖掉' if link_i && style_i && style_i < link_i

# 「分析 / 答案」这一层：右侧竖条上的按钮必须"很轻"（静止不铺底色），否则板面就不干净了；
# 且新样式必须放在第二套 style 块里 —— wb-styles 是图谱共享共享样式的母版（会被改名抄到图谱）。
issues << '右侧竖条按钮丢了"很轻"的静止态（应 background:none）' unless
  html[/\.wb-side__btn\{[^}]*background:none/m]
# 注意这个正则：不能用 `.*?`，它会跨过 `</style>` 跑到后面那个块里去找 .wb-side{，
# 结果把"样式确实在独立块里"误报成"跑进了 wb-styles"（这条先写错过一次）。
issues << '分析 / 答案的样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-side__btn\{/m]
issues << '分析 / 答案的样式没放进独立 style 块' unless html.include?('<style id="wb-analysis-styles">')
# 竖条上只有图标（没有字），所以每个按钮必须有自绘提示 —— 光一个灯泡图标谁也猜不到是"分析"
%w[wb-act-analysis wb-act-transcribe wb-act-save].each do |id|
  issues << "右侧竖条的 #{id} 没挂自绘提示（光一个图标看不出是干什么的）" unless
    html[/id="#{id}"[^>]*data-wb-tip/]
end
issues << '笔粗 / 橡皮按钮仍用系统 title' if wbjs.include?('title="笔粗') || wbjs.include?('title="橡皮')

# 全屏已并到侧栏：工具条不留全屏，专注模式（wb-focus）那套一并清掉
dock_only = html[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
issues << '工具条里还留着全屏按钮（应与侧栏统一）' if dock_only.include?('id="wb-full"')
issues << '仍残留 wb-focus 专注模式样式' if html.include?('wb-focus')
issues << 'whiteboard.js 仍在自管全屏' if wbjs.include?('function toggleFull') || wbjs.include?('function setFocus')
issues << 'whiteboard.js 没监听全屏切换（全屏后画布要重排）' unless wbjs.include?("'fullscreenchange'")

# 网格疏密三档：三档必须齐、数值必须和 js 里的梯子对得上，
# 预览方块的疏密方向不能写反（20 那档格子最小），样式同样不许进共享区。
GRID_LADDER = [20, 40, 80].freeze
GRID_LADDER.each do |size|
  issues << "网格疏密少了 #{size} 这一档" unless html.include?(".wb-grid[data-wb-grid=\"#{size}\"] .wb-grid__chip")
end
chip_px = GRID_LADDER.map { |s| html[/\.wb-grid\[data-wb-grid="#{s}"\] \.wb-grid__chip\{background-size:([\d.]+)px/, 1].to_f }
if chip_px.any? { |v| v <= 0 }
  issues << "网格预览方块缺 background-size（有两档看起来一样密）"
elsif !(chip_px[0] < chip_px[1] && chip_px[1] < chip_px[2])
  issues << "网格预览方块的疏密写反了（应 20 最密 → 80 最疏，实际 #{chip_px.join(' / ')}px）"
end
GRID_LADDER.each do |size|
  issues << "js 里的网格梯子少了 #{size}" unless wbjs.include?("value: #{size}") || wbjs[/var GRID_SIZES[\s\S]*?\];/].to_s.include?("value: #{size}")
end
issues << '网格疏密是"顺手把网格打开"的（网格关着时选一档要能看到变化）' unless
  wbjs.include?('if (!state.grid) state.grid = true;')
issues << '网格疏密样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-grid\{/m]

# ---------- 手写转文字（思路框底部的按钮 + 题目下方的面板） ----------
# 这一层**没有真 AI**：内容全是预置的。所以最要紧的守线是"必须说清这是演示"，
# 以及"没写东西时不许凭空变出内容"（后者在断言里守，这里守页面上的那几处文案与结构）。
%w[wb-act-transcribe wb-ink-text wb-ink-steps wb-ink-note wb-ink-badge wb-ink-acts
   wb-ink-close wb-ink-again wb-ink-clear].each do |id|
  issues << "手写转文字缺挂点 ##{id}" unless html.include?(%(id="#{id}"))
end
issues << '转文字面板没有默认收起（会一进页面就浮在板上）' unless
  html[/id="wb-ink-text"[^>]*hidden/]
issues << '转文字面板没挂在题面同一层（应该是 .wb-canvas-wrap 的绝对定位子元素）' unless
  html.include?('.wb-ink{') && html.include?('position:absolute')
issues << '转文字面板缺「演示」标（预置数据必须说清，不许假装真识别）' unless
  html.include?('id="wb-ink-badge">演示<') || html.include?('id="wb-ink-badge">演示')
issues << '转文字面板缺一句说明挂点（#wb-ink-note）' unless html.include?('id="wb-ink-note"')
issues << '转文字样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-ink\{/m]
inkjs = File.read(File.join(ROOT, 'assets/js/whiteboard-ink-text.js'), encoding: 'UTF-8')
issues << '转文字的数据模块没被引用（应该是独立文件、界面与内容分开）' unless
  html.include?('whiteboard-ink-text.js') && html.index('whiteboard-ink-text.js') < html.index('assets/js/whiteboard.js')
issues << '转文字缺少"两个可替换的函数"（接真服务时只换它们）' unless
  inkjs.include?('function recognize(') && inkjs.include?('function review(')
issues << '转文字没写清"本版不接真 AI"' unless inkjs.include?('不接真 AI')
issues << '转文字没守住"只认题面框外的笔迹"' unless inkjs.include?('function outsideStrokes(')
issues << '转文字没写清"没写东西就不装"' unless inkjs.include?('一笔都没有时不装')
# 预置数据里不许出现"这一步有问题" —— 没有真模型就不判学生对错（语气标里支持，数据里不用）
issues << '预置数据里出现了 warn（没有真模型就不该判学生对错）' if
  inkjs[/var PRESET = \{[\s\S]*?\n  \};/].to_s.include?("'warn'")
issues << '文字那一格不是可编辑的（识别一定会出错，必须能改）' unless
  wbjs.include?('contenteditable')
# ---------- 右侧竖工具条 + 分析答案面板（两个 tab）+ 保存菜单 ----------
# 用户定的这一版：底部那条上加「上传我的题」（独立功能）；对"这道题"做的事收进右侧一条竖着的工具条
# （分析 / 转译 / 保存，答案并进分析里当一个 tab）；面板**不挂在题目上**、自己可以拖 ——
# 「这样我们的题目周围干干净净的」。
side_html = html[/<div class="wb-side" id="wb-side".*?<\/div>/m].to_s
if side_html.empty?
  issues << '找不到右侧竖工具条（.wb-side）'
else
  issues << "竖条里不是三个按钮（实际 #{side_html.scan(/<button/).size} 个）" unless
    side_html.scan(/<button/).size == 3
  order = %w[wb-act-analysis wb-act-transcribe wb-act-save].map { |id| side_html.index(id) }
  issues << '竖条上三个按钮的顺序不是「分析 → 转译 → 保存」' unless
    order.all? && order == order.sort && order.uniq.size == 3
  issues << '竖条是横着排的（用户要的是竖着放、图标竖排）' unless
    html[/\.wb-side\{[^}]*flex-direction:column/m]
  issues << '竖条挂在最右边会压住别的东西 —— 它得留在画布容器里、靠右浮着' unless
    html[/\.wb-side\{[^}]*right:\d+px/m] && html[/\.wb-side\{[^}]*position:absolute/m]

  # 分析那颗图标：用户要求换掉灯泡（"白板右侧第一个按钮分析图标换一下"）。
  # 选 sparkles 的两个理由：① 这个按钮出的是 **AI 给的分析**，灯泡读起来是"灵感/点子"；
  # ② 站内 sparkles 已经是"AI 生成"的意思（通知页在用），换个地方用同一支，读者不用重新学。
  analysis_btn = side_html[/id="wb-act-analysis"[\s\S]{0,260}?<\/button>/m].to_s
  issues << '分析按钮的图标不是 sparkles（用户要求换掉原来那个灯泡）' unless
    analysis_btn.include?('data-lucide="sparkles"')
  issues << '分析按钮还挂着 lightbulb' if analysis_btn.include?('data-lucide="lightbulb"')
  # 提示语只写"分析"两个字（用户："含答案标注去掉即可"）——
  # 那半句是给做产品的人看的，点开就在里面，不必在提示里提前解释。
  issues << '分析按钮的提示语不只是「分析」（"含答案"那半句该去掉）' unless
    analysis_btn.include?('data-wb-tip="分析"')
  # 只看所有提示语里有没有这三个字 —— 不能拿整页去搜：
  # 上面那段解释"为什么去掉含答案"的注释里就有这三个字，整页搜索会被自己的注释顶红
  # （这个坑这个项目踩过两次了，规则写进文档了：查"页面上还有没有某句话"要先剥注释、或只看属性值）。
  tips = html.scan(/data-wb-tip="([^"]*)"/).flatten
  issues << "「含答案」这几个字还在某条提示语里（#{tips.select { |t| t.include?('含答案') }.join('、')}）" if
    tips.any? { |t| t.include?('含答案') }
end

# 自绘提示的位置：横排工具条是"上方居中"，**右侧竖条上必须改到左边** ——
# 竖排时"上方居中"正好盖住上面那颗按钮，用户看提示的时候下一个按钮被挡着。
# （用户原话："鼠标滑动出现的提示词应该在图标的左侧显示，避免挡住按钮"）
side_tip = html[/\.wb-side \[data-wb-tip\]::after\{[^}]*\}/m].to_s
issues << '右侧竖条上没有"提示改到左边"这条规则（还是会挡住上面那颗按钮）' if side_tip.empty?
issues << '竖条上的提示没挂到按钮左侧（right:calc(100% + 8px)）' unless
  side_tip.include?('right:calc(100% + 8px)')
issues << '竖条上的提示没把默认的"居中偏左"让开（少了 left:auto）' unless
  side_tip.include?('left:auto')
issues << '竖条上的提示没有纵向对中（会跑偏）' unless
  html[/\.wb-side \[data-wb-tip\]:hover::after[\s\S]{0,120}?transform:translateY\(-50%\)/m]

# 「上传我的题」必须在**底部那条**工具条上（用户原话："这个上传。这个按钮要放在底部"）
dock_html = html[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
issues << '「上传我的题」没在底部工具条上（用户要求它放底部，它是独立功能）' unless
  dock_html.include?('id="wb-act-upload"')
issues << '「上传我的题」还挂在题目旁边（那一层已经收进右侧竖条了）' if
  side_html.include?('wb-act-upload')

# 旧的三个按钮排 / 思路框 / 答案块必须**清干净**：留着挂点就会被下一版又接回去
%w[wb-acts wb-think wb-answer wb-step wb-upload-tip].each do |gone|
  issues << "页面上还留着旧的 #{gone} 挂点" if html.include?("id=\"#{gone}\"")
end
issues << 'whiteboard.js 里还留着台阶框那套代码' if wbjs.include?('wb-step') || wbjs.include?('stepGuides')
issues << 'whiteboard.js 里还留着可写台阶的内容字段（analysis.steps）' if wbjs.include?('analysis.steps')
issues << 'whiteboard.js 里还留着"整块拖动"那套（面板现在自己拖）' if wbjs.include?('function bindGroupDrag(')
issues << 'whiteboard.js 里还留着"往下排"的登记表（面板不再挂在题目下）' if wbjs.include?('function belowBlocks(')

%w[wb-panel wb-save].each do |id|
  issues << "#{id} 没有默认收起（会一进页面就浮在板上）" unless html[/id="#{id}"[^>]*hidden/]
end
panel_i = html.index('id="wb-panel"')
ink_i = html.index('id="wb-ink-text"')
panel_html = (panel_i && ink_i && ink_i > panel_i) ? html[panel_i...ink_i] : ''
issues << '面板里出现了可写格子（用户要的是"就看看思路"，只读）' if
  panel_html.include?('contenteditable')
issues << '面板里还带着「把手写转成文字」（转译已经独立成竖条上的按钮了）' if
  panel_html.include?('把手写转成文字')
issues << '面板没做成"一个框两个 tab"' unless
  html.include?('.wb-panel{') && html.include?('class="wb-tabs"') &&
  html.include?('role="tablist"') && html.include?('role="tabpanel"')
issues << 'tab 缺 aria-selected（读屏不知道当前在哪一页）' unless
  html.scan(/aria-selected="/).size == 2
issues << '分析 / 答案面板样式跑进了 wb-styles（会被抄到图谱当死规则）' if
  html[/<style id="wb-styles">(?:(?!<\/style>).)*?\.wb-panel\{/m]
issues << '答案那一页没标「AI 生成」（注释是 AI 给的，必须说清来源）' unless
  html.include?('wb-answer__flag') && html.include?('AI 生成')
issues << '保存菜单里没有「存进我的题」' unless
  html.include?('id="wb-save-mine"') && html.include?('存进「我的题」')
issues << '保存菜单里没有「导出文件」' unless
  html.include?('id="wb-save-file"') && html.include?('导出成图片')
issues << '「上传我的题」没写清这一版还没做（会变成点了没反应的假按钮）' unless
  wbjs.include?('拍照上传还在做')
issues << '「上传我的题」没给出现在就能走的路（只说不做，等于把用户晾在那儿）' unless
  wbjs.include?('在题库里挑一道题上板')
issues << '注释开关只有一态文案（收起 / 显示必须都有，否则点一次就再也回不来）' unless
  wbjs.include?('收起注释') && wbjs.include?('显示注释')
# 面板位置是自己的（屏幕像素）：拖动改的是 state.winAt，不是题面那一份
issues << '面板的位置还挂在题面上（应该各存各的：state.winAt）' unless
  wbjs.include?('state.winAt') && wbjs.include?('function placeWin(') && wbjs.include?('function winMove(')
issues << '面板拖动写回了题面位置（"题目周围干干净净"就破了）' if
  wbjs[/function winMove\([\s\S]*?\n  \}/].to_s.include?('state.problemAt')
# 上限 8 步 × 大字号，内容能高过整块画布；不封顶的话底下那截就再也够不着了
issues << '面板没设最大高度（长内容会顶出画布，底下的按钮点不到）' unless
  html[/\.wb-panel\{[^}]*max-height/]
issues << '面板的长内容不能自己滚（超出画布的部分就够不着了）' unless
  html[/\.wb-panel__body\{[^}]*overflow-y:auto/] && html[/\.wb-panel__body\{[^}]*min-height:0/]

# 浮层的"尺寸规矩"（用户原话：「面板有点丑，圆角需要统一起来；标题字号也有问题」）：
#   容器圆角 = --math-radius-lg（16px，跟底部工具条 / 题库面板 .wb-bank 的 16px 同档）
#   里面的按钮与条目 = --math-radius-md（8px，跟 .wb-item / .wb-dock__btn 同档）
#   标题 13px（跟 .wb-bank__title 同档）· 正文 12.5px · 注释 12px · 微标 11px
#
# 正文那一档原来写的是 13.5 —— **比标题 13 还大**，而这个面板自己的规矩写的就是
# "标题比正文大一档"，抬标题那一次把正文一起抬上去了。用户报过：
# 「解析面板的正文字号是不是不规范，有点大」。守线现在要求两件事：
# 正文必须是 12.5，且**必须比标题小**（13 > 12.5 > 12 > 11 一档一档往下走）。
{ '.wb-panel' => '分析答案面板', '.wb-menu' => '保存菜单', '.wb-ink' => '转译窗口',
  '.wb-bank' => '题库面板', '.wb-pop' => '画笔设置浮层' }.each do |sel, name|
  issues << "#{name} #{sel} 的圆角没统一（容器应为 16px = --math-radius-lg）" unless
    html[/#{Regexp.escape(sel)}\{[^}]*border-radius:var\(--math-radius-lg\)/m]
end
{ '.wb-tab' => 'tab 标签', '.wb-panel__close' => '面板收起按钮', '.wb-menu__item' => '菜单项',
  '.wb-ink__close' => '转译窗口收起按钮', '.wb-ink__btn' => '转译窗口按钮',
  '.wb-answer__notes' => '注释开关', '.wb-answer__result' => '标准答案那一行' }.each do |sel, name|
  issues << "#{name} #{sel} 的圆角没统一（里面的东西应为 8px = --math-radius-md）" unless
    html[/#{Regexp.escape(sel)}\{[^}]*border-radius:var\(--math-radius-md\)/m]
end
issues << '面板标题（tab）字号不是 13px（层次靠它压住正文）' unless
  html[/\.wb-tab\{[^}]*font-size:calc\(13px \* var\(--math-fs\)\)/m]
issues << '转译窗口标题字号不是 13px（跟其它面板标题不齐）' unless
  html[/\.wb-ink__title\{[^}]*font-size:calc\(13px \* var\(--math-fs\)\)/m]
issues << '条目正文不是 12.5px —— 正文必须比标题（13px）小一档（用户报过"正文有点大"）' unless
  html[/[}\n]\s*\.wb-tile__text\{[^}]*font-size:calc\(12\.5px \* var\(--math-fs\)\)/m]
issues << '转译面板里的条目正文没跟台阶正文同档（应 12.5px，两块同屏并排）' unless
  html[/[}\n]\s*\.wb-ink \.wb-tile__text\{[^}]*font-size:calc\(12\.5px \* var\(--math-fs\)\)/m]

# 三颗 ✕ 必须长得一模一样（用户原话："题库的关闭按钮和样式应该和分析面板一致"）。
# 分析面板 / 题库 / 转译各有一颗，三个是同一个动作 —— 以前各写各的：
# 分析面板 22×22 无边框文字 ×、题库 24×24 带边框的 svg x、转译 22×22。
# （曾经还有第四颗：题面右上那颗 hover 控件上的 ✕ —— 用户要求把那两颗一起撤掉，见下面那条。）
# 这里逐条比对"尺寸与配色"，**margin-left 这类排版项不参与**（转译那颗要多一个 margin-left:auto
# 把自己顶到标题栏右端，那是排版不是长相）。
CLOSE_PROPS = %w[width height display place-items border border-radius background color
                 font-size line-height cursor].freeze
CLOSE_SELECTORS = { '.wb-panel__close' => '分析面板', '.wb-bank__close' => '题库面板',
                    '.wb-ink__close' => '转译窗口' }.freeze

def close_face(css, sel)
  body = css[/#{Regexp.escape(sel)}\{([^}]*)\}/m, 1]
  return nil unless body
  CLOSE_PROPS.map do |prop|
    m = body.match(/(?:\A|;)\s*#{Regexp.escape(prop)}:([^;}]+)/)
    "#{prop}:#{m ? m[1].strip : '(缺)'}"
  end.join('; ')
end

close_faces = CLOSE_SELECTORS.map { |sel, name| [name, sel, close_face(html, sel)] }
close_faces.each do |name, sel, face|
  issues << "#{name}里找不到 #{sel} 那颗 ✕（四个 ✕ 应共用同一套长相）" if face.nil?
end
close_ref = close_faces.find { |_, sel, _| sel == '.wb-panel__close' }.to_a.last
close_faces.each do |name, sel, face|
  next if face.nil? || close_ref.nil? || face == close_ref
  issues << "#{name}的 ✕（#{sel}）跟分析面板那颗长得不一样：\n      #{face}\n      基准：#{close_ref}"
end
issues << '题库那颗 ✕ 还是图标（分析面板是文字 ×，两边得是同一种东西）' if
  html[/<button type="button" class="wb-bank__close"[\s\S]{0,240}?<i data-lucide="x">/m]
issues << '题库 ✕ 的 svg 规则还留着（✕ 已经是文字 × 了，这条是死样式）' if
  html.include?('.wb-bank__close svg')

# 题库那张卡片的外壳要跟分析面板同一套（用户原话："题库的关闭按钮和样式应该和分析面板一致"）。
# 以前是白底 + 24px 投影 + 铺底又拉分隔线的标题栏 + 15px 抓手，并排一开就不像一个系统里的东西。
issues << '题库面板还是白底（没跟分析面板一样走 --math-popover）' unless
  html[/\.wb-bank\{[^}]*background:var\(--math-popover\)/m]
issues << '题库面板的投影没跟分析面板同一档（应 var(--math-shadow-1)）' unless
  html[/\.wb-bank\{[^}]*box-shadow:var\(--math-shadow-1\)/m]
bank_head = html[/\.wb-bank__head\{([^}]*)\}/m, 1].to_s
issues << '题库的标题栏还铺着底色（分析面板的标题栏不铺底）' if bank_head.include?('background:')
issues << '题库的标题栏还拉着一条分隔线（分析面板的标题栏没有）' if bank_head.include?('border-bottom')
issues << '题库的抓手不是 14px（分析面板是 14px）' unless
  html[/\.wb-bank__grip\{[^}]*width:14px/m]
issues << '题库拖动时的投影没跟分析面板同一档（应 var(--math-shadow-2)）' unless
  html[/\.wb-bank\.is-dragging\{[^}]*box-shadow:var\(--math-shadow-2\)/m]

# 题面那两颗 hover 控件（✕ 收起题面 / ⠿ 拖动）用户要求撤掉（原话："这俩按钮去掉吧"）。
# 撤掉**不丢功能**，两条路都另有入口：
#   · 收起题面 → 工具条上那颗「题面」（#wb-problem-toggle，见上面 need 里那条）；
#   · 拖动题面 → 画布上题面自身的把手（左侧竖条 + 有 tag 时的标题行，见下面"题面的把手"那节）。
# 所以这里反过来守：**不许长回来**。留着就是死码 —— 元素没了、样式没了、JS 却在跑。
#
# 这一条必须**先把注释剥掉再查**：解释这次撤除的那两段注释（wb-styles 里那段、
# 以及 HTML 里那行说明）本身就写着 `.wb-pctl` / wb-problem-ctl 这些字样 ——
# 拿原文去 include? 就是拿自己的注释把守线顶绿（这个坑这个项目已经踩到第七次）。
html_code = html.gsub(/<!--.*?-->/m, '').gsub(%r{/\*.*?\*/}m, '')
issues << '题面那两颗 hover 控件又长回来了（代码里还有 wb-problem-ctl / .wb-pctl）' if
  html_code.include?('wb-problem-ctl') || html_code.include?('.wb-pctl')
issues << '题面控件那套 JS 还留着（problemCtl* 已经是死码了）' if
  wbjs.include?('problemCtlEl') || wbjs.include?('problemCtlVisible') || wbjs.include?('problemCtlHot')
# 题面还得能拖 —— 撤掉的是"重复的那个入口"，画布上那条把手必须完好无损
issues << '画布上那条把手没走 beginProblemDrag（题面就拖不动了）' unless
  wbjs[/hitProblemHandle\(pt\.x, pt\.y\)\)\s*\{\s*beginProblemDrag\(e\);/m]
# 「收起题面」也只剩工具条那颗「题面」一条路了（题面那颗 ✕ 已撤）——
# 它要是不再绑着，学生就**再也收不起题面**了。这条是撤控件的前提，必须守。
issues << '工具条那颗「题面」没绑到 setShowProblem（题面就收不起来了）' unless
  wbjs[/bind\('wb-problem-toggle',\s*function\s*\(\)\s*\{\s*setShowProblem\(!state\.showProblem\);?\s*\}\)/m]

# 分析必须跟着题走（用户原话："分析是针对当前的题目做的分析；所以当用户切换题目的时候，
# 分析窗口是自动更新的"）。两处一起守：
#   ① 面板里有一行写清"正对着哪道题" —— 切题时它先变，眼睛立刻能确认；
#   ② 台阶本身按这道题生成（只复述题面上的数与记号，不推断）。
issues << '分析面板没写"正对"哪道题（切了题看不出来分析跟没跟过去）' unless
  html.include?('id="wb-panel-subject"')
issues << '「正对」那一行只写了个空标签，渲染时没往上填东西' unless
  wbjs[/byId\('wb-panel-subject'\)[\s\S]{0,400}?'正对：'/m]
anjs = File.read(File.join(ROOT, 'assets/js/whiteboard-analysis.js'), encoding: 'UTF-8')
issues << '分析台阶还是与题目无关的一段死文案（切题后一个字都不变）' unless
  anjs[/function steps\(data\)[\s\S]{0,900}?numbersIn\(text\)/m]
issues << '台阶里抠的"题面上的数"没有实现（找不到 numbersIn）' unless anjs.include?('function numbersIn(')
issues << '台阶里认的"题面上的记号"没有实现（找不到 opsIn）' unless anjs.include?('function opsIn(')

# 浮窗宽度只有一个数（用户问："面板宽度是不是应该一致"）。
# 四个浮窗原来各写各的：分析答案 280 / 题库 300 / 画笔设置 320 / 转写 360 —— 并排一开就不齐。
# 令牌落在 tokens.css 的 --math-float-w，两页共用；图谱页那两张同源卡片由
# build_graph_css.rb 同步（verify_graph.rb 逐条比规则体，忘了重跑生成器那里就会红）。
# **一个选择器可能有好几条规矩（窄屏覆盖、上限、定位……），每一条都要看** ——
# 这条守线第一版只看了第一条，真机上题库仍被窄屏那条撑成满屏，守线却是绿的。
tokens_css = File.read(File.join(ROOT, 'assets/css/tokens.css'), encoding: 'UTF-8')
issues << '浮窗宽度没有令牌（tokens.css 里找不到 --math-float-w）' unless
  tokens_css[/--math-float-w:\s*\d+px/]

# 窄屏**只有一条**破例，而且要点名：名单类那一块（题库）摊到整屏（左 12 右 12）——
# 读长名单比挤成 320 好用。图谱页那两张同源卡片窄屏下同样摊满（verify_graph.rb 那头也守着），
# 阅读框（分析答案 / 转写）任何时候都不破例。这条例外是**点名允许**的，不是漏网。
narrow = html[/@media \(max-width:1023px\)\{[\s\S]*?\n\}/m].to_s
issues << '窄屏那段没了（浮窗在窄屏下会跑回老位置）' if narrow.empty?
issues << '窄屏下题库不再摊满整屏了（两页的名单类卡片就不同源了）' unless
  narrow[/\.wb-bank\{[^}]*left:12px;right:12px[^}]*[;}]\s*width:auto/]

{ '.wb-bank' => '题库面板', '.wb-pop' => '画笔设置浮层',
  '.wb-panel' => '分析答案面板', '.wb-ink' => '转写窗口' }.each do |sel, name|
  bodies = html.scan(/#{Regexp.escape(sel)}\{([^}]*)\}/m).flatten
  issues << "#{name} #{sel} 一条样式都没有" if bodies.empty?
  bodies.each do |body|
    # 把这条规矩里**每一条** width 都拿出来看，不能只看第一条：
    # 反证时踩中过 —— 补一条 `.wb-bank{width:300px}`，`width` 前面那个 `;` 在捕获段之外，
    # 旧写法取不到，那条新规矩整个漏过去（守线常绿）。
    body.scan(/(?:\A|;)\s*width:([^;}]+)/).flatten.each do |raw|
      w = raw.strip
      next if w == 'var(--math-float-w)'           # 走令牌 —— 正确
      next if sel == '.wb-bank' && w == 'auto' && body.include?('left:12px;right:12px') # 上面那条窄屏破例
      issues << "#{name} #{sel} 里有一条写着死宽度的规矩（width:#{w}）—— 浮窗宽度只能走 var(--math-float-w)"
    end
  end
  issues << "#{name} #{sel} 缺一条窄窗兜底（max-width:calc(100% - 24px)）" unless
    bodies.any? { |b| b[/[;{]\s*width:var\(--math-float-w\)/] && b.include?('max-width:calc(100% - 24px)') }
end
fallback = wbjs[/var w = \(el && el\.offsetWidth\) \|\| ([^;]+);/, 1].to_s
issues << '找不到浮窗的兜底宽度（defaultWinAt 里没有那一行）' if fallback.empty?
issues << '两个浮窗的兜底宽度按窗口分岔了（并排一开就是一个宽一个窄）' if fallback.include?('which')

# 抓手指纹：分析答案面板的标题栏上有，转写窗口原来漏了 ——
# 两块是同屏并排的（都在右侧、都能拖），长相要一样：指纹挂在最右端、收起按钮的右边。
issues << '转写窗口的标题栏没有抓手指纹（.wb-ink__grip 不存在）' unless
  html[/<i data-lucide="grip-vertical" class="wb-ink__grip"/]
issues << '转写窗口的抓手指纹没挂在标题栏最右端（应紧跟在收起按钮之后）' unless
  html[/class="wb-ink__close"[\s\S]{0,160}?class="wb-ink__grip"/]

# 拖动抓手必须躲开标题栏里的控件（用户反馈："点击关闭都没有效果"）。
# ✕ 与 tab 都长在标题栏里面，抓手要是不躲：pointerdown 里的 setPointerCapture 会把后面那个
# click 改派给抓手，按钮自己的 click 根本不响 —— 题库面板当初就躲开了 .wb-bank__close，
# 新的两块面板漏了这一步。附带一条：抓手不许 preventDefault（同理会把子控件的点击挡掉）。
win_down = wbjs[/function winDown\([\s\S]*?\n  \}/].to_s
# 先剥掉注释再查：这段函数里就写着"这里不再 preventDefault……"，不剥的话守线会被注释自己点着
# （这次就点着了：守线常红 = 和"常绿"一样没用，等于没守）
win_code = win_down.gsub(%r{/\*[\s\S]*?\*/}, '').gsub(%r{//[^\n]*}, '')
issues << '面板抓手没躲开标题栏里的控件（✕ / tab 会点不动）' unless win_code.include?('closest(')
issues << '面板抓手又加了 preventDefault（会把 ✕ / tab 的点击一起挡掉）' if
  win_code.include?('preventDefault')
# 题面的把手：左侧那一条 + **标题行**（用户原话"包括题目上面的那个标题"）。
# 标题行只在有 tag 时才存在：没 tag 的题，最上面那一行就是正文第一行 —— 吃了它，
# 学生就圈不动那一道题里最常圈的那一行。
issues << '题面的把手只剩左边那一条了（用户要的标题行把手丢了）' unless
  wbjs.include?('function problemGripRects(') && wbjs.include?('PROBLEM_TITLE_H')
issues << '题面标题行把手没判"有没有 tag"（没 tag 的题会把正文第一行吃掉）' unless
  wbjs[/function problemGripRects\([\s\S]*?\n  \}/].to_s.include?('data.tag')
# 拖动中的光标要压过子控件自己的 cursor（否则手划到 tab 上就从 grabbing 变 pointer）
issues << '拖动中的"正抓着"光标没压过标题栏里的子控件' unless
  html[/\.wb-panel\.is-dragging \.wb-panel__head \*/] && html[/\.wb-ink\.is-dragging \.wb-ink__head \*/]
# 两块的标题栏都要做成"可抓"的样子（用户看不出它能拖）。
# 注意要带分号：不带分号的话 `.wb-ink__head{cursor:grabbing}`（拖动中那条）也能把它满足，
# 守线就成了摆设 —— 反证时正是这样"没能变红"。
issues << '转译窗口的标题栏没做成可抓的样子（用户看不出它能拖）' unless
  html[/\.wb-ink__head\{[^}]*cursor:grab;/m]
issues << '分析答案面板的标题栏没做成可抓的样子' unless
  html[/\.wb-panel__head\{[^}]*cursor:grab;/m]
# 思路 / 答案 / 转文字三处共用同一套条目样式，最怕后一段"不带前缀地又写一遍"——
# 后写的会静静盖掉前写的，而且三处里只有一处看着不对（真机复核抓到过：
# 转文字面板的旧样式把答案块的编号压成了灰色小字、正文还多了一层底）。
tile_dupes = html.scan(/^([^\n{}]*?)\{/).flatten.map(&:strip)
               .select { |s| s.start_with?('.wb-tile') }
               .group_by { |s| s }.select { |_, v| v.size > 1 }.keys
issues << "条目样式被不带前缀地定义了两遍（后一条会悄悄盖掉前一条）：#{tile_dupes.join('、')}" unless tile_dupes.empty?
issues << '条目样式没做成三处共用的一套（思路 / 答案 / 转文字各写各的）' unless
  html.include?('.wb-tile{') && html.include?('.wb-tile__no{')
# 注释那一行是 flex:1 0 100%，再挂 margin 会被浏览器吞掉（真机上就是"注释与正文齐平"）
issues << 'AI 注释那一行没缩进（和正文齐平，会被当成正文的一部分）' unless
  html[/\.wb-tile__cmt\{[^}]*padding-left:/]
# 面板的位置**必须**是自己的那一份（state.winAt）：用户要"题目周围干干净净"，
# 面板要是跟着题面走，拖题目就会连面板一起搬走 —— 那是上一版的规矩，早废了。
issues << '面板位置又挂回题面那一份了（应各存各的 state.winAt）' if
  wbjs[/function placeWin\([\s\S]*?\n  \}/].to_s.include?('problemAt')
# 分析答案面板的状态：开没开 / 停在哪一页 / 注释显示没 —— 落盘也就是这三样
analysis_blocks = wbjs.scan(/analysis:\s*\{[\s\S]*?\n\s*\},/)
issues << '找不到分析答案面板的状态 / 落盘块' if analysis_blocks.empty?
analysis_blocks.each do |b|
  %w[open tab showNotes].each do |k|
    issues << "分析答案面板的 #{k} 没进状态或没落盘" unless b.include?(k)
  end
  issues << '分析那一层存了步骤（步骤是算出来的，不该存）' if b.include?('steps')
  issues << '分析那一层还留着 answerOpen（答案已经并成一个 tab 了）' if b.include?('answerOpen')
end


# 设置面板又高了一行，矮屏上必须有个"放不下就自己滚"的兜底，不能把顶上一截切掉
issues << '设置面板没有兜底滚动（矮屏上会被切掉顶部，够不着上面那一行）' unless
  html[/\.wb-pop\{max-height:calc\(100vh - \d+px\);overflow-y:auto/]

flyout_h = 4 * 26 + 3 * 1 + 2 * 4 + 2
puts "浮层尺寸: 146 × #{flyout_h}px（原 172 × 148px，面积 -33%）"
puts "工具条按钮: 34px（原 36px）；设置面板内边距: 12/14（原 16/18）"

puts issues.empty? ? '白板页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")

# 题库统计
probs = File.read(File.join(ROOT, 'assets/js/whiteboard-problems.js'), encoding: 'UTF-8')
puts "题库条目: #{probs.scan(/\{ id: '/).length} 条"
puts "页面总数: #{Dir.glob(File.join(ROOT, '*.html')).length}"

# 全站白板入口（白板功能规划.html 是独立文档，按设计不进侧栏，不计入）
STANDALONE = %w[白板功能规划.html]
miss = Dir.glob(File.join(ROOT, '*.html'))
         .reject { |f| STANDALONE.include?(File.basename(f)) }
         .reject { |f| File.read(f, encoding: 'UTF-8').include?('data-nav-key="whiteboard"') }
puts miss.empty? ? '全站侧栏均已加入白板入口 ✓' : "缺白板入口: #{miss.map { |f| File.basename(f) }.join(', ')}"
