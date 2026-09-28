# encoding: UTF-8
# 白板页体检
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
html = File.read(File.join(ROOT, 'whiteboard.html'), encoding: 'UTF-8')

issues = []
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
  '适应内容（设置面板内）' => 'id="wb-zoom-fit"',
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
issues << '工具条槽位又变多了，检查是否把同类工具拆回了单个按钮' unless plain + groups + level <= 14

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
wbjs = File.read(File.join(ROOT, 'assets/js/whiteboard.js'), encoding: 'UTF-8')
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
end

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
#   标题 13px（跟 .wb-bank__title 同档，比正文大一档）· 正文 13.5px
{ '.wb-panel' => '分析答案面板', '.wb-menu' => '保存菜单', '.wb-ink' => '转译窗口' }.each do |sel, name|
  issues << "#{name} #{sel} 的圆角没统一（容器应为 16px = --math-radius-lg）" unless
    html[/#{Regexp.escape(sel)}\{[^}]*border-radius:var\(--math-radius-lg\)/m]
end
{ '.wb-tab' => 'tab 标签', '.wb-panel__close' => '面板收起按钮', '.wb-menu__item' => '菜单项',
  '.wb-ink__close' => '转译窗口收起按钮', '.wb-ink__btn' => '转译窗口按钮',
  '.wb-answer__notes' => '注释开关', '.wb-answer__result' => '标准答案那一行' }.each do |sel, name|
  issues << "#{name} #{sel} 的圆角没统一（里面的东西应为 8px = --math-radius-md）" unless
    html[/#{Regexp.escape(sel)}\{[^}]*border-radius:var\(--math-radius-md\)/m]
end
issues << '面板标题（tab）字号跟正文一般大 —— 层次是平的（标题 13px / 正文 13.5px）' unless
  html[/\.wb-tab\{[^}]*font-size:calc\(13px \* var\(--math-fs\)\)/m]
issues << '转译窗口标题字号不是 13px（跟其它面板标题不齐）' unless
  html[/\.wb-ink__title\{[^}]*font-size:calc\(13px \* var\(--math-fs\)\)/m]
issues << '条目正文没跟题库条目同一档（应 13.5px）' unless
  html[/\.wb-tile__text\{[^}]*font-size:calc\(13.5px \* var\(--math-fs\)\)/m]

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
