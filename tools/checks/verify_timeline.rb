# encoding: UTF-8
# 时间轴页体检（timeline.html + assets/js/timeline.js）
#
# 为什么要有这一页的守线：
#   这一页的轴、刻度、网格全画在 canvas 上，DOM 里几乎是空壳 ——
#   肉眼看着"页面没报错"说明不了刻度对不对。所以这里把**契约**逐条钉住：
#   刻度从图谱来（五级：学段 / 册·板块 / 章 / 节 / 知识点）、缩放到某一级才出现、
#   视图模型与白板同源（拖动 / 滚轮 / 双指 / 适配）、网格三档、
#   工具条照白板那套尺寸与状态。谁把某一级弄丢了、把适配拆了，这里直接报错。
#
# 覆盖面：
#   1) 页面骨架（canvas / 读数 / 工具条 / 网格疏密浮层 / 帮助）
#   2) 全站左栏的「时间轴」入口（位置、图标、当前项）
#   3) 视图与刻度的契约（token 名字级、缩放函数、五级刻度、网格三档）
#   4) 令牌纪律：颜色只能从 CSS 令牌读；页面与脚本里不许写死颜色与字号
#   5) 无障碍：画布有点名、按钮有 aria-label、浮层有 aria-expanded
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

def read(*parts)
  File.read(File.join(ROOT, *parts), encoding: 'UTF-8')
end

issues = []

page  = read('timeline.html')
js    = read('assets/js/timeline.js')
data  = read('assets/js/timeline-data.js')
css   = read('assets/css/tokens.css')
pages = Dir.glob(File.join(ROOT, '*.html')).sort.map { |p| File.basename(p) }

# ---------- 1. 页面骨架 ----------
issues << '标签页标题不是「时间轴 · 悟空数学」' unless page.include?('<title>时间轴 · 悟空数学</title>')

i_disp = page.index('assets/js/display.js')
i_css  = page.index('assets/css/tokens.css')
issues << 'display.js 没有排在 tokens.css 之前（首屏会先白后暗）' if i_disp.nil? || i_css.nil? || i_disp > i_css

%w[cdn.jsdelivr.net unpkg.com].each do |host|
  issues << "页面引了外部 CDN（#{host}）—— 这是零构建站点，依赖一律本地" if page.include?(host)
end

{
  '数轴画布'     => 'data-tk-canvas',
  '画布容器'     => 'data-tk-wrap',
  '当前知识点读数' => 'data-tk-now',
  '缩放读数'     => 'data-tk-zoom',
  '底部工具条'   => 'data-tk-dock',
  '网格疏密浮层' => 'id="tk-grids"',
  '帮助浮层'     => 'data-tk-help'
}.each do |label, token|
  issues << "页面缺#{label}（#{token}）" unless page.include?(token)
end

# 工具条上的按钮（照白板那一套）：网格 / 疏密 / 缩小 / 放大 / 适配 / 帮助
{
  '网格开关' => 'id="tk-grid"',
  '网格疏密' => 'id="tk-pop-toggle"',
  '缩小'     => 'id="tk-zoom-out"',
  '放大'     => 'id="tk-zoom-in"',
  '适配'     => 'id="tk-zoom-fit"',
  '帮助'     => 'id="tk-help"'
}.each do |label, token|
  issues << "工具条缺「#{label}」（#{token}）" unless page.include?(token)
end
issues << '「适配」没有用白板那个图标（maximize-2）—— 同一个动作同一个图标' unless
  page.include?('id="tk-zoom-fit"') && page =~ /id="tk-zoom-fit"[\s\S]{0,220}maximize-2/
issues << '工具条按钮尺寸不是白板那一档（34×34）' unless page.include?('width: 34px; height: 34px;')
issues << '工具条图标尺寸不是白板那一档（16px）' unless page.include?('.tk-dock__btn svg { width: 16px; height: 16px; }')

%w[assets/js/math-tree.js assets/js/timeline-data.js assets/js/timeline.js assets/js/shell.js assets/js/ide-shell.js].each do |src|
  issues << "页面没挂 #{src}" unless page.include?(src)
end
issues << 'timeline.js 没有排在 math-tree.js 之后（轴要读图谱数据）' unless
  page.index('assets/js/math-tree.js') && page.index('assets/js/timeline.js') &&
  page.index('assets/js/math-tree.js') < page.index('assets/js/timeline.js')
issues << 'timeline.js 没有排在 timeline-data.js 之后（要读学习记录）' unless
  page.index('assets/js/timeline-data.js') && page.index('assets/js/timeline.js') &&
  page.index('assets/js/timeline-data.js') < page.index('assets/js/timeline.js')

# ---------- 2. 全站左栏的「时间轴」入口 ----------
with_rail = []
missing_in = []
pages.each do |name|
  html = read(name)
  next unless html.include?('class="ide-rail"')
  with_rail << name
  rail = html[%r{<nav class="ide-rail".*?</nav>}m].to_s
  unless rail.include?('data-nav-key="timeline"')
    missing_in << name
    next
  end
  issues << "#{name}: 「时间轴」入口没有指向 timeline.html" unless rail.include?('href="timeline.html"')
  issues << "#{name}: 「时间轴」入口的图标不是数轴那颗（git-commit-horizontal）" unless
    rail.include?('data-lucide="git-commit-horizontal"')
  i_graph = rail.index('data-nav-key="graph"')
  i_time  = rail.index('data-nav-key="timeline"')
  issues << "#{name}: 「时间轴」没有排在图谱后面" if i_graph && i_time && i_time < i_graph
end
issues << '没有任何页面挂上了「时间轴」入口（迁移脚本没跑？）' if with_rail.empty?
issues << "#{missing_in.size} 个带侧栏的页面还没加上「时间轴」：#{missing_in.join('、')}" unless missing_in.empty?
issues << '时间轴页自己没把「时间轴」标为当前项' unless
  page =~ /data-nav-key="timeline" data-active="true" aria-current="page"/

# ---------- 3. 视图与刻度的契约 ----------
# 刻度必须从图谱来，不是设计稿里编的那几组数
issues << 'timeline.js 没读图谱数据（window.MATH_TREE）' unless js.include?('window.MATH_TREE')
issues << 'timeline.js 没有摊平图谱的函数（buildAxis）' unless js.include?('function buildAxis')
# 五级刻度：学段 / 册·板块 / 章 / 节 / 知识点
%w[book track chapter section point].each do |kind|
  issues << "timeline.js 里没处理图谱的「#{kind}」这一级" unless js.include?("'#{kind}'")
end
# 六级文字：**分段 → 年级 → 册 → 章 → 节 → 知识点**（用户 2026-09-29 定的顺序）
issues << 'timeline.js 没有六级刻度的阶梯（LADDER 应为 6 级）' unless
  js =~ /var LADDER = \[[\s\S]{0,900}?\];/ && js[/var LADDER = \[([\s\S]{0,900}?)\];/, 1].to_s.scan(/\{ size:/).size == 6
issues << 'timeline.js 没有"年级"这一级（图谱里没有，得从册名推：一年级上册 → 一年级）' unless
  js.include?('function gradeOf') && js.include?('年级')
issues << '竞赛那四支没有年级，不该硬塞一个（年级那一级应允许为空）' unless
  js.include?("if (grade) { next = next.concat(")
# （原来这里查的是"769 格 · 4 分段 / 11 年级 / …"那一行的六个数的顺序。
#   2026-09-30 用户把左上角收成"当前知识点 + 掌握情况"两行，那一行没有了，这条守线随之撤掉；
#   六级刻度本身由上面的 LADDER 与 drawLevels 那几条盯着。）
# 抽稀两条：太窄的段不画**标记**（`wide = screenW >= spec.need`）；装不下半个名字的段
# 不写**名字**（`screenW < textW * view.scale * 0.5`，只约束"当前那一级"）。
issues << 'timeline.js 没有"格子占不下名字就不画"的抽稀（缩小时要只留重要刻度）' unless
  js =~ /screenW >= spec\.need/ && js =~ /screenW < textW \* view\.scale \* 0\.5/

# 名字只写一级 —— 用户 2026-09-29："底部的名字不可能各个层级都出现啊……只出现当前的；
# 他上一级别的就在左边一层层对应出现。"
issues << '六级名字又全部铺在轴上了（应只把"当前这一级"逐段写出来）' unless
  js.include?('function currentLabelDepth') &&
  js[/function drawLevels[\s\S]{0,400}?drawLevel\(d, range, cur\)/]
issues << '更粗的那几级没有只钉"视野左缘那一段"（会逐段铺满整条轴）' unless
  js.include?('if (!isCurrent && !coversLeft) { continue; }')
issues << '比"当前这一级"更细的级也在写名字（用户要的是"只出现当前的"）' unless
  js.include?('if (depth > labelDepth) { continue; }')
issues << '"当前这一级"是按"有一段够宽"挑的（会被个别特别宽的格子带偏）' unless
  js.include?('if (seen && fit * 2 >= seen) { return d; }')
issues << '视野左缘跑到轴外时面包屑整列空掉（左缘应先夹回轴的范围再问）' unless
  js.include?('var edge = clamp(visLeft, first, last);')
issues << '"当前这一级"不是"屏幕上画得出来的最细那一级"（应由细到粗找；不落到第 0 级 —— 学段不写名字）' unless
  js[/function currentLabelDepth[\s\S]{0,900}?for \(var d = LADDER\.length - 1; d >= 1; d -= 1\)/]
issues << '挑"当前这一级"的判据跟"写不写名字"不是同一条（会挑中一级却一个字都写不出来）' unless
  js[/function currentLabelDepth[\s\S]{0,1400}?ctx\.measureText\(seg\.name\)\.width \* view\.scale \* 0\.5/] &&
  js.include?('var text = seg.name;')
issues << '标签一行放不下没有"往下挪行"（用户："应该继续往下移动的"）' unless
  js =~ /for \(var r2 = 0; r2 < rows\.length; r2 \+= 1\)/
issues << '屏幕外的名字又被夹到左边缘了（会在左边糊成一团）' unless
  js =~ /else if \(cx < visLeft \|\| cx > visRight\) \{\s*\/\*[\s\S]{0,400}?continue;/ ||
  js.include?('名字本身就落在屏幕外')
issues << 'timeline.js 没有"格内再分小刻度"（放大时的细分）' unless js.include?('function drawMinor')

# 最细那一档：把一格（一个知识点）展开成它名下的卡片（参考图知识点视图那三条规则：
# 宽度 = 卡片权重、高度 = 卡片难度、颜色 = 卡片状态）
issues << '最细那一档没有把一格展开成卡片（drawCards）' unless
  js.include?('function drawCards') && js[/function redraw[\s\S]{0,1600}?drawCards\(\)/]
issues << '卡片的宽度不是按卡片权重分的' unless
  js.include?('usable * card.weight / sum')
issues << '卡片的高度不是按卡片难度给的' unless js.include?('heightOf(card.diff)')
issues << '卡片的颜色不是按卡片状态给的' unless js.include?('state.mastery ? statusColor(card.status)')
issues << '拆了卡片之后还叠着画整格那根柱子' unless
  js[/function drawBars[\s\S]{0,900}?if \(cardsOpen\(rec\)\) \{ continue; \}/]

# 网格疏密必须"只听设定" —— 早先折半折成同一个格距，用户报过"设定无效"
issues << '网格疏密又被折半折成同一档了（用户报过"网格大小设定无效"）' if
  js[/function drawGrid[\s\S]{0,400}?step \/= 2/]
issues << '网格太密时没有"隔整数倍画"的兜底' unless js.include?('Math.ceil(9 / gap)')

# 视图模型与白板同源：拖动 / 缩放 / 适配 / 双指
%w[function zoomAt function zoomBy function fitContent].each do |fn|
  issues << "timeline.js 缺 #{fn}（视图模型要与白板同源）" unless js.include?(fn)
end
issues << 'timeline.js 没有双指捏合' unless js.include?('onTouchMove') && js.include?('pinch')
issues << 'timeline.js 没有滚轮处理' unless js.include?("addEventListener('wheel'")
issues << 'timeline.js 没有拖动平移（pointerdown/pointermove）' unless
  js.include?("addEventListener('pointerdown'") && js.include?("addEventListener('pointermove'")
issues << 'timeline.js 没有缩放上下限（MIN_SCALE / MAX_SCALE）' unless
  js.include?('MIN_SCALE') && js.include?('MAX_SCALE')
issues << '适配按钮没有接 fitContent' unless js.include?('btnFit') && js.include?('fitContent()')
issues << '缩放读数是"相对适配的百分比"（应除以 view.fit）' unless js.include?('view.scale / view.fit')

# 网格三档（照白板）：20 / 40 / 80，且格子自动落在看得清的区间里
issues << '网格疏密不是三档（GRID_STEPS 应为 20 / 40 / 80）' unless
  js.include?('var GRID_STEPS = [20, 40, 80]')
issues << '网格疏密没有直接用设定的那一档' unless
  js[/function drawGrid[\s\S]{0,400}?var step = state\.gridSize/]

# 画布要按像素密度铺，且窗口变化要跟着重排
issues << '画布没有按 devicePixelRatio 铺（高分屏会糊）' unless js.include?('devicePixelRatio')
issues << '窗口变化后没有重排画布' unless js.include?("addEventListener('resize'")
issues << '显示设置（字号 / 配色）改了以后没有重取令牌重画' unless js.include?("addEventListener('wk:display'")

# ---------- 4. 悬停 / 观察节点 / 知识点卡片（用户第 7、8 条） ----------
issues << '页面没有悬停用的小气泡（data-tk-hover）' unless page.include?('data-tk-hover')
issues << '划过时不报名字（缺 showHover / hideHover）' unless
  js.include?('function showHover') && js.include?('function hideHover')
# 划到哪一格，读数两行就跟着换成那一格（用户第 7 条："边上也出现对应的名字"）
issues << '划过时读数不跟着换（应报"划过 · …"那一格）' unless
  js.include?("'划过 · '") && js.include?('function readIndex') &&
  js.include?('hoverIndex >= 0 ? hoverIndex : now')
issues << '页面没有知识点卡片面板（data-tk-card）' unless page.include?('data-tk-card')
issues << '点击没有弹卡片（缺 select / renderCard）' unless
  js.include?('function select') && js.include?('function renderCard')
issues << '点击判定丢掉了（应按拖动距离区分"点一下"与"拖了"）' unless
  js.include?('if (moved < 5)')
issues << '卡片面板没有随视野刷新（用户第 8 条："滑动的时候，卡片面板要不断刷新"）' unless
  js.include?('function retargetCard') && js[/function onMove[\s\S]{0,900}?retargetCard\(\)/]
issues << '两种节点没有分开画（缺 findNow / drawNodes / markNode）' unless
  %w[findNow drawNodes markNode].all? { |fn| js.include?("function #{fn}") }
issues << '当前学习节点没在启动时算出来（findNow 定义了却没调用，now 一直是 -1）' unless
  js[/loadWinAt\(\);[\s\S]{0,80}?findNow\(\);/]
issues << '两种节点没有"实心 / 空心"两种形状（只靠颜色分，色弱分不清）' unless
  js[/function markNode[\s\S]{0,1300}?ctx\.arc\(x, px\(DOT_ROW\), px\(DOT_R \+ 1\.8\)/] &&
  js[/function markNode[\s\S]{0,1300}?ctx\.arc\(x, px\(DOT_ROW\), px\(DOT_R \+ 4\)/]
issues << '学习节点用实心、观察节点用空心（fill 与 stroke 各走一支）' unless
  js[/function drawNodes[\s\S]{0,700}?markNode\(now, C\.primary[\s\S]{0,140}?true/] &&
  js[/function drawNodes[\s\S]{0,900}?markNode\(pin, C\.ink[\s\S]{0,140}?false/]
issues << '观察节点标记没接进重绘（redraw 里应画 drawNodes）' unless
  js[/function redraw[\s\S]{0,1700}?drawNodes\(\)/]
issues << '节点上没有胶囊标签（"当前 0336" / "观察 0301"）' unless
  js.include?("'当前 ' + idOf(now)") && js.include?("'观察 ' + idOf(pin)")
issues << '读数第一行没有报当前学习节点' unless
  js.include?("'当前 · '") && js[/function nowText[\s\S]{0,400}?idOf\(i\)\.slice\(-4\)/]
issues << '卡片里没有掌握度五因子（参考图里掌握度是五项加权出来的）' unless
  js.include?('WK_LEARNING.factors.forEach') && page.include?('tk-card__factors')
issues << '卡片里没有这个知识点的卡片列表（一个知识点就是一个知识点内部的细分）' unless
  js.include?('tk-card__card') && js.include?('rec.cards')
issues << '卡片面板没有关闭入口（× 按钮与 Esc 都要能关）' unless
  js.include?('btnCardClose.addEventListener') && js[/Escape'\)[\s\S]{0,120}?closeCard\(\)/]
issues << '知识点编号不是参考图那种写法（MATH-KP-0234）' unless js.include?("'MATH-KP-'")
issues << '路径里相邻两级同名时没去重（图谱里"章 = 节"同名很常见）' unless
  js.include?('parts[parts.length - 1] !== n')

# 浮层（知识点卡片 / 图例）：可拖、样式与手感照白板的 .wb-panel
# （用户："面板可以拖动 样式和标准按照白板的来走" —— 卡片与图例共用同一套）
issues << '浮层不能拖（缺 winDown / winMove / winUp）' unless
  %w[winDown winMove winUp].all? { |fn| js.include?("function #{fn}") }
issues << '浮层的抓手没挂上（标题栏应挂 pointerdown/move/up/cancel）' unless
  %w[pointerdown pointermove pointerup pointercancel].all? { |ev|
    js.include?("head.addEventListener('#{ev}'")
  }
issues << '拖动中没有"正抓着"的状态类（白板是 .is-dragging）' unless
  js.include?("classList.add('is-dragging')") && page.include?('.tk-card.is-dragging')
issues << '浮层位置没有记住（白板拖过之后 persist）' unless
  js.include?("'wkmath.timeline.v1'") && js.include?('function saveWinAt')
issues << '浮层位置没有夹回舞台内（拖出去就够不着了）' unless
  js[/function placeWin[\s\S]{0,900}?clamp\(winAt\[which\]\.left/]
# 抓手必须先躲开标题栏里的控件，否则 setPointerCapture 会把 ✕ 的 click 改派给标题栏 ——
# 表现就是"面板拖得动、却关不掉"（用户报过；白板同一处也是这么修的）。
issues << '标题栏会把 ✕ 的点击吃掉（面板拖得动、却关不掉：抓手要先躲开按钮）' unless
  js[/function winDown[\s\S]{0,900}?t\.closest\('button, a, input, select, textarea, \[contenteditable="true"\]'\)/]
issues << '面板没按白板那一套写：popover 底 / shadow-1 / --math-float-w / 标题栏 grab' unless
  page.include?('background: var(--math-popover)') && page.include?('box-shadow: var(--math-shadow-1)') &&
  page.include?('width: var(--math-float-w)') && page.include?('cursor: grab; touch-action: none; user-select: none')
issues << '面板不是"标题栏 + 落款 + 正文"三段（照白板 .wb-panel 的结构）' unless
  page.include?('data-tk-card-head') && page.include?('data-tk-card-name') &&
  page.include?('data-tk-card-subject') && page.include?('data-tk-card-body')
issues << '面板缺抓手图标（白板是 grip-vertical）' unless
  page.include?('grip-vertical') && page.include?('tk-card__grip')

# ---------- 图例卡（用户第 12 条：颜色按学习成果分，图例参考白板） ----------
issues << '图例卡没挂进页面（缺 data-tk-legend / data-tk-legend-states）' unless
  page.include?('data-tk-legend') && page.include?('data-tk-legend-states')
issues << '图例卡开关不全（缺 setLegend / toggleLegend）' unless
  js.include?('function setLegend') && js.include?('function toggleLegend')
issues << '图例卡没有"开着"的状态（aria-expanded / is-on）' unless
  js.include?('function syncLegendButton') && js.include?("btnLegend.setAttribute('aria-expanded'")
issues << 'Esc 关不掉图例卡' unless js[/Escape'\)[\s\S]{0,220}?setLegend\(false\)/]
# 图例**不是面板**（用户 2026-09-29："也不用出这个面板了……它不是个面板，
# 直接写在这块中间这块区域就行"）：它是底部工具条正上方的那一行，不该再回到可拖浮层那一套。
issues << '图例又变成可拖的浮层了（用户定的：它不是面板，是工具条正上方的一行）' unless
  js.include?("var WIN_KEYS = ['card', 'filter', 'months', 'matrix']") &&
  page.include?('data-tk-legend-bar') &&
  # 它住在"工具条正上方那一列"里（.tk-above），不再是各自绝对定位 —— 与缩略条同一列往上排
  page[/\.tk-above \{[\s\S]{0,520}?bottom: 78px/] &&
  page[/<div class="tk-above"[\s\S]{0,2400}?data-tk-legend-bar/]
issues << '图例条里没把四类标记排进去（应带小图标）' unless
  js[/function buildLegend[\s\S]{0,1400}?data-lucide/] && js.include?('legendMarks')
issues << '图例卡的七档色块不是从令牌解出来的（应走 statusColor）' unless
  js[/function buildLegend[\s\S]{0,600}?statusColor\(s\.name\)/]
issues << '图例卡没有两种节点的说明（实心 / 空心各一行）' unless
  page.include?('tk-legend__mark--now') && page.include?('tk-legend__mark--see')

# 掌握度五因子与卡片：数据层要有
issues << 'timeline-data.js 没有五因子（正确率 / 独立完成 / 复习间隔 / 速度 / 错题消除）' unless
  %w[正确率 独立完成 复习间隔 速度 错题消除].all? { |n| data.include?(n) } && data.include?('FACTORS')
issues << '掌握度不是五因子加权出来的（应能对上账）' unless
  js.include?('FACTORS') || data[/var sum = 0;[\s\S]{0,400}?FACTORS\[f\]\.weight/]
issues << 'timeline-data.js 没有卡片（类型 / 难度 / 正确率 / 状态 / 日期 / 权重）' unless
  %w[CARD_TYPES CARD_FLOW].all? { |k| data.include?(k) } && data.include?("type: typeName")

# ---------- 5. 学习记录（演示数据）：掌握度与学习日期的出处 ----------
# 掌握度与学习日期这两份数据在 timeline-data.js 里生成：种子写死（每次进页面一样）、
# 七档状态各有颜色令牌、段上要能汇总 —— 轴的着色全靠它
issues << 'timeline-data.js 没有对外接口 window.WK_LEARNING' unless data.include?('window.WK_LEARNING =')
%w[build rollup summary stateOf tokenOf].each do |fn|
  issues << "timeline-data.js 缺 #{fn}()" unless data.include?("#{fn}:")
end
issues << 'timeline-data.js 没有写死种子（每次进页面会换一张脸）' unless data.include?('DEFAULT_SEED = 20260929')
issues << 'timeline-data.js 的七档状态不全（应覆盖 --math-bar-* 七色）' unless
  %w[--math-bar-ok --math-bar-gold --math-bar-first --math-bar-learn --math-bar-review --math-bar-weak --math-bar-idle]
    .all? { |t| data.include?(t) }
issues << 'timeline-data.js 里出现了写死的颜色（状态色应走令牌）' unless data.scan(/#[0-9a-fA-F]{4,8}\b/).empty?
issues << 'timeline-data.js 没有给"知识点内部的部分"留位置（用户点名以后要细到定义 / 理解 / 应用）' unless
  data.include?('parts')

# 轴上的标记：一颗点 = 一个知识点，颜色按状态；刻度不再画竖线
issues << 'timeline.js 没有把段汇总成读数（段的读数要用）' unless
  js.include?('WK_LEARNING.rollup')
issues << 'timeline.js 没有从令牌解析状态色（statusColor）' unless js.include?('function statusColor')
issues << '轴上的点没有按学习状态上色' unless js.include?('statusColor(rec.status)')
issues << '轴上的点不是"一颗点 = 一个知识点"（应逐个 item 画，且按间隔抽稀）' unless
  js.include?('function drawDots') && js.include?('DOT_GAP / view.scale')
issues << '轴上的点没有按学习状态上色' unless js.include?('statusColor(rec.status)')
issues << '读数里没有"学到哪儿了"那一行（总进度要一眼看到）' unless
  js.include?('function progressText') && page.include?('data-tk-progress')

# 彩色条：**高矮 = 难度**（综合判定，学没学都有高度）、**颜色 = 掌握情况**、**圆头**；
# 默认不显示，按「掌握度」才出来（用户 2026-09-29 的更正）
issues << 'timeline.js 没有画彩色条（drawBars）' unless js.include?('function drawBars')
issues << '彩色条的高矮不是按难度给的（用户更正：高度 = 综合判定的难度）' unless
  js.include?('heightOf(rec.diff)') && js.include?('function heightOf')
issues << '彩色条又把"没学过的"跳掉了（用户更正：学没学都该有高度）' if
  js[/function drawBars[\s\S]{0,900}?if \(!rec \|\| !rec\.mastery\)/]
issues << '彩色条的顶端不是圆的（用户要求"圆形的、比较舒服"）' unless
  js[/function drawBars[\s\S]{0,1200}?quadraticCurveTo/]
issues << '彩色条的高度不是屏幕像素（放大后会跟着长到屏幕外）' unless
  js =~ /BAR_LEVELS = \[[\s\S]{0,400}?screen: \d/
issues << '彩色条高度没有低 / 中 / 高三档' unless js.include?("label: '低'") && js.include?("label: '中'") && js.include?("label: '高'")
issues << '页面没给彩色条高度留位置（id="tk-bar-levels"）' unless page.include?('id="tk-bar-levels"')
issues << '难度最低的那一档没有留高度（"简单"会变成"没有"）' unless js.include?('0.34 + 0.66')

# 掌握度彩条层：默认关 + 有按钮控制（用户原话："默认时不显示这些彩色的……
# 还有这个有按钮控制显示，它才显示"）
issues << '页面没有「掌握度」显示控制按钮（用户点名要有按钮控制）' unless page.include?('id="tk-mastery"')
issues << '掌握度彩条层不是默认关的' unless js.include?('mastery: false')
issues << '掌握度按钮没有接线' unless js.include?('function toggleMastery') && js.include?('btnMastery.addEventListener')
issues << '彩条与状态点没有跟着那颗按钮走' unless
  js.include?('if (!state.mastery || !LEARN || !N)') && js.include?('state.mastery && rec')

# 轴上的标记层级（用户："几个阶段，然后有一些大的点来显示……可以给它一些刻度，
# 用粗一点的线，或者高一点的线"）
issues << '分段没有用空心圆标（参考图里四个学段都是穿在轴上的空心圆）' unless
  js =~ /need: 0, +tick: \d+, +ring: [\d.]+/
issues << '章没有用实心小点标（参考图里章节点是轴上的小实心点）' unless
  js[/var LADDER = \[([\s\S]{0,700}?)\];/, 1].to_s.include?('dot: ')
issues << '年级 / 册 / 节没有刻度线（LADDER 里应有 tick）' unless
  js[/var LADDER = \[([\s\S]{0,700}?)\];/, 1].to_s.scan(/tick: \d/).size >= 3
# 学段这一级**不写名字**（用户 2026-09-30："左侧还出现很多什么小学、初中、高中的文字，
# 就直接去掉就行了。因为我们左上方已经有了"）—— 左上方读数里已经写着"小学 / 六年级 / …"，
# 轴上再钉一个"小学 001–380"是同一句话说两遍。学段只剩"空心圆"这个标记。
issues << '学段的名字又写回轴上了（用户 2026-09-30 要去掉：左上方读数里已经有了）' if
  js.include?('rangeText') || js[/function drawLevel[\s\S]{0,4200}?ctx\.fillText\(rangeText/]
issues << '学段那一级还占着 labelDepth 的行位（名字撤了就该退出名字这一层）' unless
  js[/function drawLevel[\s\S]{0,3600}?if \(depth === 0\) \{ continue; \}/]

# ---------- 数轴与读数的样式（用户 2026-09-30 给的三张参考图）----------
issues << '轴不是点线（参考图里是一串小圆点串成的轴）' unless
  js.include?('ctx.setLineDash([') && js.include?('function drawAxis')
issues << '名字装不下时整条不写（参考图里是"有理数…"这种截断写法）' unless
  js.include?('function fitLabel') && js.include?("'…'")
# 左上角只留"当前知识点 + 掌握情况"（用户："左上角的面板就是先当前的知识点和掌握情况即可"）
issues << '左上角不是两行（当前知识点 + 掌握情况）' unless
  page.include?('data-tk-now') && page.include?('data-tk-progress') &&
  js.include?('function nowText')
issues << '旧的三行读数又回来了（总数 / 进度 / 视野）' if
  page.include?('data-tk-count') || page.include?('data-tk-range')

# 「学习计划设定」按钮：用户点名先加一个按钮，功能待定
issues << '底部没有「学习计划设定」按钮（用户第 16 条点名要）' unless
  page.include?('id="tk-plan"') && page.include?('学习计划的时间轴设定')
issues << '「学习计划设定」按钮没有接线（点了要有回应）' unless js.include?('btnPlan')

# 清屏必须按像素密度清 —— 这一条踩过真机：单位变换只擦掉 1/dpr²，
# Retina（dpr=2）拖动时旧帧糊成一片，而无头浏览器 dpr=1 怎么截图都是好的
issues << 'redraw 清屏又退回单位变换了（高 dpr 屏上会只擦掉 1/dpr²，拖动时糊成一片）' unless
  js[/function redraw[\s\S]{0,600}?setTransform\(v\.dpr, 0, 0, v\.dpr, 0, 0\)/]

# ---------- 4b. 用户态（用户第 11 条）----------
# "如果用户没有登录，就显示一些用户的知识列表。如果用户登录了，就显示用户当前的数轴。"
issues << '页面没有"这一轴是谁的"那块（data-tk-who）' unless page.include?('data-tk-who')
issues << 'timeline-data.js 没有演示学生名单（students）' unless
  data.include?('DEMO_STUDENTS') && data.include?('students:')
issues << 'timeline-data.js 没有"按账号派生"（forAccount）' unless data.include?('forAccount:')
issues << 'build() 不能按"看谁"换一份数据（应能传 seed / progress）' unless
  data.include?('function build(items, opts)') &&
  data.include?("typeof opt.seed === 'number' ? opt.seed : DEFAULT_SEED")
issues << '未登录时没有默认看演示学生（pickViewer 应回落到演示学生）' unless
  js.include?('function pickViewer') && js.include?('viewerList()[0]')
# 收束（用户 2026-09-29："它现在太多了……演示学生这块就是谁登录，然后就用谁的就行"）：
# 左上角就一行，且**不再有可点的切换**。
issues << '左上角"谁在看"没做成一行（应 lead + 一枚胶囊 + 一句来源）' unless
  js[/function renderWho[\s\S]{0,700}?whoNode\('tk-who__lead'/] &&
  js[/function renderWho[\s\S]{0,900}?whoNode\('tk-who__note'/]
issues << '左上角还留着可切换的演示学生（用户："不再切换"）' if
  js[/function renderWho[\s\S]{0,800}?createElement\('button'\)/]
issues << '身份不是从会话来的（应走 ide-shell 的 WK_SHELL.current）' unless
  js.include?('WK_SHELL.current')
issues << '换了人没重算"学到哪儿了"（换一份数据，findNow 必须跟着重算）' unless
  js[/function rebuildLearn[\s\S]{0,900}?findNow\(\)/]
issues << '登录后没明写"本机演示数据"（不能装作那是真的云端记录）' unless
  js.include?('本机演示数据')

# ---------- 4c. 右侧控制栏（用户第 14 条）----------
# "右边有筛选、有控制，显示这个图标的、显示信息面板的图标，还有不同阶段的对比功能。"
issues << '页面没有右侧竖工具条（data-tk-side，照白板 .wb-side）' unless
  page.include?('data-tk-side') && page.include?('.tk-side {')
issues << '右侧那条不是照白板的样式（不悬停时淡着、同底色）' unless
  page[/\.tk-side \{[\s\S]{0,700}?opacity: \.34/]
issues << '右侧那条的提示气泡没改到左边（默认"上方居中"会顶出屏幕）' unless
  page[/\.tk-side \[data-tk-tip\]::after \{[\s\S]{0,200}?right: calc\(100% \+ 16px\)/]
%w[filter tags panel-right-open].each do |icon|
  issues << "右侧那条缺图标 #{icon}" unless page.include?("data-lucide=\"#{icon}\"")
end
# 2026-09-30 用户："阶段可以整合到筛选里" —— 原来那颗独立的「阶段」按钮与它的浮层一起撤了，
# 那排"全部 / 小学 / 初中 / 高中 / 竞赛"搬进筛选卡当最上面那一行。
issues << '「阶段」还有一颗独立按钮 / 一个浮层（用户："阶段可以整合到筛选里"）' if
  page.include?('id="tk-stage"') || page.include?('data-tk-stages') ||
  page.include?('data-lucide="columns-3"') || js.include?('setStages') || js.include?('stagesEl')
issues << '阶段那排胶囊没搬进筛选卡（应在"掌握度"那一行前面）' unless
  page[/<div class="tk-card__body">[\s\S]{0,300}?data-tk-stage-chips/] &&
  page[/data-tk-stage-chips[\s\S]{0,300}?data-tk-filter-status/]
issues << '筛选卡一开没把阶段胶囊建出来（它跟着卡片开合，开着才刷）' unless
  js[/function setFilterPanel[\s\S]{0,400}?syncStageChips\(true\)/] &&
  js[/function syncStageChips[\s\S]{0,260}?filtersEl\.hidden/]
issues << '筛选面板没挂进页面（data-tk-filters）' unless page.include?('data-tk-filters')
issues << '筛选只有状态一维（应还有难度 1–5）' unless
  page.include?('data-tk-filter-status') && page.include?('data-tk-filter-diff')
issues << '筛选是把格子从轴上拿掉了（用户口径：数轴永远是一条完整的数轴，只能变淡）' unless
  js.include?('var FILTER_ALPHA') && js.scan(/passFilter\(rec\) \? 1 : FILTER_ALPHA/).size >= 2
issues << '筛选没有"不选 = 不筛"的语义（空数组应表示这一维不筛）' unless
  js[/function passFilter[\s\S]{0,400}?f\.status\.length && f\.status\.indexOf/]
issues << '阶段切换不是"换视野"（应把这一段铺满屏幕，而不是筛掉别的段）' unless
  js.include?('function focusStage') && js.include?('function stageRange')
issues << '阶段胶囊的"选中"不是由视野算出来的（手动拖走之后会撒谎）' unless
  js.include?('function currentStage') && js.include?('overlap > span * 0.6')
issues << '刻度与文字没有开关（右侧那颗应能整层关掉）' unless
  js.include?('if (state.levels) { drawLevels(); }') && js.include?('if (state.levels) { drawMinor(); }')
issues << '信息面板没有开关（应能整块藏起来）' unless
  js.include?('function setReadout') && js.include?('leftEl.hidden = !state.readout')
issues << '筛选卡不是与知识点卡片同一套浮层（可拖、位置记住）' unless
  js.include?('var winAt = { card: null, filter: null, months: null, matrix: null }')

# ---------- 4e. 时间段对比（用户第 13 条）与方阵（用户第 18 条）----------
issues << 'timeline-data.js 没有按月的汇总（months）' unless
  data.include?('function months') && data.include?('months: months')
issues << '页面没有时间段对比卡（data-tk-months）' unless page.include?('data-tk-months')
issues << '时间段没有成为筛选的一维（选了月份要能落到轴上）' unless
  js.include?('state.filter.month') &&
  js.include?("f.month.length && f.month.indexOf(rec.month || '') < 0")
issues << '月份那一行的条子不是按平均掌握给的' unless
  js[/function buildMonths[\s\S]{0,1500}?fill\.style\.width = Math\.max\(2, m\.avg\)/]
issues << '页面没有方阵卡（data-tk-matrix）' unless page.include?('data-tk-matrix')
issues << '方阵不是"一排 18 个"（用户第 18 条："这一块一共有 18 个块"）' unless
  js.include?('var MATRIX_COLS = 18') && page.include?('repeat(18, 1fr)')
issues << '方阵的方块不是按掌握情况上色的（"掌握了就是绿的"）' unless
  js[/function buildMatrix[\s\S]{0,1400}?cell\.style\.background = statusColor\(status\)/]
issues << '点方块没有打开知识点卡片（§8 ④：不在方阵上改数据）' unless
  js[/function buildMatrix[\s\S]{0,1800}?addEventListener\('click', function \(\) \{ select\(index\); \}\)/]

# ---------- 4f. 缩略条（用户第 9 条）----------
issues << '页面没有缩略条（data-tk-mini）' unless
  page.include?('data-tk-mini') && page.include?('data-tk-mini-track') &&
  page.include?('data-tk-mini-win')
issues << '缩略条不是"只在放大之后出现"（用户第 9 条："如果放大了，就需要……出现"）' unless
  js.include?('function miniZoomed') && js.include?('view.scale > view.fit * 1.02') &&
  js[/function syncMini[\s\S]{0,600}?miniEl\.hidden = !zoomed/]
issues << '缩略条没有实时反映"当前屏幕所展示的范围"（每帧都要跟着视野动）' unless
  js[/function redraw\(\)[\s\S]{0,2600}?syncMini\(\)/] &&
  # 滑块宽度按"一屏能装下多少格"算 —— 只跟缩放有关，拖动时不跟着变（变就会抖，见下）
  js[/function syncMini[\s\S]{0,1400}?var span = Math\.max\(1, view\.w \/ view\.scale\)/] &&
  js[/function syncMini[\s\S]{0,1400}?miniWin\.style\.width = widthPct/]
# 用户 2026-09-30 明确选的：**横着**、贴着工具条上方，不是竖的
issues << '缩略条不是横铺一条（用户选的方案："横的，贴着工具条上方横铺一条"）' unless
  page[/\.tk-mini \{[\s\S]{0,700}?width: min\(420px/] &&
  # 它必须住在 .tk-above 那一列里（"贴着工具条上方"）
  page[/<div class="tk-above"[\s\S]{0,4200}?class="tk-mini"/]
issues << '缩略条不能点 / 拖（应该点一下、拖一下就能挪过去）' unless
  js.include?('function miniDown') && js.include?('function miniMove') &&
  js.include?("miniTrack.addEventListener('pointerdown', miniDown)")
# 用户 2026-09-30 又改了两条：
#   "太丑了……把它做得细一点。底下的白色框就不要了" —— 细杆（不再是白卡片）、不许有色块白底；
#   "条目里……用不同的颜色来代表不同的阶段""不同的阶段就尽量少出现文字" —— 学段改由**颜色**认。
issues << '缩略条又变回一张白卡片了（用户 2026-09-30："太丑了……做得细一点"）' if
  (mini_rule = page[/\.tk-mini \{[^}]*\}/]) &&
  mini_rule =~ /(border|background|backdrop-filter)/
issues << '缩略条的杆子不够细（12px 那一档；原来 18px 加一圈卡片底）' unless
  page[/\.tk-mini__track \{[^}]*height: 12px/]
# 定了：**就是一条标准滚动条**（用户 2026-09-30："这个宽度太宽了，会显得很笨，细一点就行"
# + "那个滑块的颜色现在也比较丑，你那个底色就直接弄成灰色，或者是黑色，
#   然后那个滑块的那个颜色就搞成那个系统色"）。
issues << '缩略条又变宽了（收到 420px —— 用户："这个宽度太宽了，会显得很笨"）' unless
  page[/\.tk-mini \{[\s\S]{0,700}?width: min\(420px/]
issues << '缩略条的底色不是中性灰（用户："底色就直接弄成灰色，或者是黑色"）' unless
  page[/\.tk-mini__track \{[^}]*background: var\(--math-line-strong\)/]
issues << '缩略条的滑块不是系统色（用户："滑块的那个颜色就搞成那个系统色"）' unless
  page[/\.tk-mini__win \{[^}]*background: var\(--math-primary\)/]
issues << '缩略条的滑块还在压那层白纱（应该只留一块实心的系统色 —— 用户："那个颜色比较丑"）' if
  page[/\.tk-mini__win \{[\s\S]{0,240}?box-shadow: 0 0 0 999px/]
issues << '缩略条上的学段刻度尺没了（学段认色不认字，见 §2.11 ⑲）' unless
  js[/function drawMiniStrip[\s\S]{0,2600}?g\.fillRect\(seg\.start \* cw, h - ruler, [\s\S]{0,120}?ruler\)/] &&
  js[/function drawMiniStrip[\s\S]{0,2600}?stageColor\(seg\.stage\)/] &&
  js.include?('function stageColor')
issues << '缩略条上还有"小学 / 初中 / 高中"这些字（用户 2026-09-30："尽量少出现文字"）' if
  js[/function drawMiniStrip[\s\S]{0,2600}?(STAGE_CN|fillText)/]
issues << '缩略条上的学段色不是从令牌来的（应读 --math-stage-*，不该写死颜色）' unless
  js.include?("'--math-stage-primary'") && js.include?("'--math-stage-olympiad'")
# 排序与间距（用户 2026-09-30："放在图例的上方" / "他挡住了，中间没有呼吸感"）：
# 缩略条在 DOM 里要排在**图例条前面**（同一 flex 列从上往下排），整列也要离工具条远一点。
issues << '缩略条没排在图例条上方（用户："在这个图例的上方……放在图例的上方"）' unless
  page[/<div class="tk-above"[\s\S]{0,2400}?class="tk-mini"[\s\S]{0,1200}?data-tk-legend-bar/]
issues << '缩略条 / 图例条又贴着工具条了（用户："他挡住了，中间没有呼吸感"）' unless
  page[/\.tk-above \{[\s\S]{0,520}?bottom: 78px/]
# 2026-09-30 又两条（看成品）：
#   "提示文字应该在缩略图的上方，不应在右边" —— 读数从杆子右边挪到上一行（列向排）；
#   "拖动滑块的时候时间轴抖动" —— 读数宽度是变的、杆子又是 flex:1，读数一变宽杆子就变窄，
#   拖动时量到的百分比跟着漂。所以：读数换行（杆子定宽）+ 拖动期间**只量一次**杆子。
issues << '缩略条的读数又跑回杆子右边了（用户："应该在缩略图的上方"）' unless
  page[/<div class="tk-mini"[\s\S]{0,320}?data-tk-mini-range[\s\S]{0,320}?data-tk-mini-track/] &&
  page[/\.tk-mini \{[\s\S]{0,700}?flex-direction: column/]
issues << '缩略条的杆子还是被读数挤着走（读数该换行、杆子不再 flex:1）' if
  page[/\.tk-mini__track \{[^}]*flex: 1 1 auto/]
issues << '拖缩略条时每帧重新量杆子（百分比会漂，时间轴跟着抖）' unless
  js[/miniDrag = \{ id: e\.pointerId, box: /] && js[/miniAt\(e\.clientX, miniDrag\.box\)/]
# 工具条那层要压过缩略条 / 图例条（用户 2026-09-30："鼠标滑到下方那些功能按钮的时候，
# 按钮的名字被时间轴挡住了……需要在时间轴的上方展示"）——
# 气泡是自己按钮的 ::after，"有 z-index 的祖先"里 z-index 是分层用的，所以只能抬整条工具条。
issues << '工具条那层没抬到缩略条之上（气泡提示会被缩略条盖住）' unless
  page[/\.tk-dock \{[\s\S]{0,600}?bottom: 18px; z-index: 9/]
issues << '筛选里没有"标记"这一维（四类标记也要能筛）' unless
  page.include?('data-tk-filter-mark') && js.include?('state.filter.mark')

# ---------- 4d. 四类特殊标记（用户 2026-09-29："重点难点待复习、前置未满足全都加上些小图标"）----------
issues << 'timeline-data.js 没有四类特殊标记（MARKS / marks）' unless
  data.include?('MARKS') && data.include?('marks:') &&
  %w[重点 难点 待复习 前置未满足].all? { |n| data.include?(n) }
issues << '学习记录上没有 mark 字段（标记接不到轴上）' unless data.include?('mark: mark')
issues << '四类标记的颜色令牌不齐（亮 / 中 / 暗三包各要一份）' unless
  %w[--math-mark-key --math-mark-hard --math-mark-block].all? { |t| css.include?("#{t}:") }
issues << '轴上没有画标记的小图标（用户："轴上也在对应知识点上画小图标"）' unless
  js.include?('function drawMarks') && js[/function redraw[\s\S]{0,1700}?drawMarks\(\)/]
issues << '轴上的标记图标与图例里不是同一份（应从页面那份 lucide 取路径，别另画一套）' unless
  js.include?('window.lucide[iconKey(') && js.include?('new Path2D(')
issues << '格子太窄也在硬画标记图标（769 格挤进 1200px 会成噪声）' unless
  js.include?('view.scale < MARK_MIN_W')

# ---------- 5. 令牌纪律 ----------
# 颜色只能从 CSS 令牌读 —— 写死一套就等于把亮 / 中 / 暗与七个高亮色锁死了
issues << 'timeline.js 没有从 CSS 令牌读颜色（readColor）' unless js.include?('function readColor')
%w[--math-background --math-line-strong --math-ink-2 --math-foreground --math-primary].each do |tok|
  issues << "timeline.js 没读 #{tok}" unless js.include?(tok)
end
# 字号乘 --math-fs（画布里的字也要跟着显示设置走）
issues << 'timeline.js 没读 --math-fs（画布里的字不会跟着字号档变）' unless js.include?("'--math-fs'")

hex_in_js = js.scan(/#[0-9a-fA-F]{4,8}\b/)
issues << "timeline.js 里出现了写死的颜色：#{hex_in_js.uniq.join('、')}" unless hex_in_js.empty?
issues << 'timeline.js 里出现了 font-size（画布字号应走 --math-fs 与 LADDER 里的尺寸）' if js.include?('font-size')

naked_fs = page.scan(/font-size:\s*\d*\.?\d+(px|rem)/).size + page.scan(/font-size:\s*clamp\(/).size
issues << "时间轴页还有 #{naked_fs} 处 font-size 没乘 --math-fs（选了大字号这一页不跟着变）" if naked_fs.positive?
issues << '时间轴页有写死的白底 / 白字（深色下会突兀）' if
  page.scan(/(?:background|color):\s*(?:#fff|rgba\(\s*255\s*,\s*255\s*,\s*255)/i).any?

# 掌握度令牌（彩条要用）三包齐全 —— 亮 / 中 / 暗各一份，缺一个深色下就会留亮色
BAR_TOKENS = %w[--math-bar-ok --math-bar-gold --math-bar-first --math-bar-learn
                --math-bar-review --math-bar-weak --math-bar-idle].freeze
BAR_TOKENS.each do |tok|
  issues << "tokens.css 缺掌握度令牌 #{tok}" unless css.include?("#{tok}:")
end
%w[mid dark].each do |theme|
  block = css[/html\[data-wk-theme="#{theme}"\]\s*\{(.*?)\n\}/m, 1].to_s
  issues << "tokens.css 的 #{theme} 那一包里解析不出令牌（守线要跟着改）" if block.empty?
  %w[--math-bar-first --math-bar-learn --math-bar-review].each do |tok|
    issues << "#{theme} 那一包缺 #{tok}（深色下会留下亮底那一组色）" unless block.include?("#{tok}:")
  end
end

# ---------- 5. 无障碍 ----------
issues << '画布没有点名（aria-label）' unless page.include?('data-tk-canvas aria-label')
issues << '工具条按钮缺 aria-label（图标按钮读屏要能读出来）' unless
  page.scan(/class="tk-dock__btn" id="[^"]+"[^>]*aria-label="/).size >= 5
issues << '网格 / 帮助浮层没有 aria-expanded' unless
  page.include?('aria-expanded="false" aria-controls="tk-pop"') &&
  page.include?('aria-expanded="false" aria-controls="tk-help"')
issues << '网格疏密三档没有 role / aria（读屏看不出选的是哪一档）' unless
  page.include?('role="radiogroup"') && js.include?("setAttribute('aria-checked'")

puts "时间轴页体检：本页 1 个，带侧栏的页面 #{with_rail.size} 个（逐个核对「时间轴」入口）"
puts "刻度契约：六级（分段 / 年级 / 册·板块 / 章 / 节 / 知识点）逐条核对"
puts "交互契约：悬停报名字 / 点击弹卡片 / 面板随视野刷新 / 观察节点标记逐条核对"
puts "视图契约：拖动 / 滚轮 / 双指 / 适配 / 网格三档 / 缩放读数逐条核对"
if issues.empty?
  puts '时间轴体检全部通过 ✓'
else
  issues.each { |i| puts "  ✗ #{i}" }
  exit 1
end
