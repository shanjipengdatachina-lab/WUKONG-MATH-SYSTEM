# encoding: UTF-8
# 时间轴 3D 页体检（timeline-3d.html + assets/js/timeline-3d.js）
#
# 为什么要有这一页的守线：
#   这一页整块是 canvas，DOM 几乎是空壳 —— 肉眼"页面没报错"说明不了画得对不对。
#   更要紧的是**这一版是整段搬参照原型的**（用户 2026-09-30："直接删掉我们开发的 3D 版本，
#   然后用我发给你的那个嵌进去；数据按照我们的来用"），所以守线要盯两件事：
#     ① **原型的内核不许走样**：投影、取景、角度不夹、难度层那五档、考试切片的画法；
#     ② **我们的东西不许丢**：数据必须来自 timeline-axis.js / timeline-data.js，
#        颜色必须走令牌，默认平面、只读这两条口径不变。
#
# 覆盖面：
#   1) 页面骨架（画布 / 3D 开关 / 读数 / 考试分析面板 / 工具条 / 回平面入口）
#   2) 三条口径（默认平面、只读、同源；图例撤掉了，不许长回来）
#   3) 令牌纪律：颜色一律从 CSS 令牌读，页面与脚本里不许写死颜色
#   4) 原型内核：投影 / 取景 / 不夹角度 / 缩放范围 / 难度层 / 考试切片
#   5) 数据适配：NODES / STAGES / EXAMS 来自我们的模块；学年学期、没有天滑杆
#   6) 无障碍：画布有点名、按钮有 aria-label
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

def read(*parts)
  File.read(File.join(ROOT, *parts), encoding: 'UTF-8')
end

issues = []

page = read('timeline-3d.html')
js   = read('assets/js/timeline-3d.js')
flat = read('timeline.html')

# ---------- 1. 页面骨架 ----------
issues << '3D 页没有画布（data-t3-canvas）' unless page.include?('data-t3-canvas')
issues << '3D 页的画布没有 aria-label（读屏要能知道这是什么）' unless
  page =~ /data-t3-canvas[^>]*aria-label="[^"]+"/
issues << '3D 页没有「3D」开关（data-t3-toggle）' unless
  page.include?('data-t3-toggle') && page.include?('aria-pressed=')
# 左上角那块"谁 + 读数"2026-09-30 撤掉了（用户："现在左上角出的那些标题，什么'林一鸣当前
# 多少'……都给去掉就行。原因很简单：我用鼠标滑动的这些东西都会出现，现在重复的"）——
# 划过时的信息只在划过小卡里出一次，所以这里不再要求它存在，也不许悄悄长回来。
issues << '左上角那块读数又加回来了（用户 2026-09-30 说跟划过小卡重复、要撤掉）' if
  page.include?('data-t3-now') || page.include?('data-t3-who') || page.include?('class="t3-left"')
# 图例 2026-09-30 先撤掉了（用户："先去掉这个什么首学、复习、纠错、一次考试、课程计划线，
# 把这个去掉。我们一个个的来做"）—— 所以这里不再要求它存在，也不许悄悄长回来。
issues << '3D 页的图例又加回来了（用户要求先撤掉、一个个来做）' if page.include?('t3-legend')
issues << '3D 页没有回平面时间轴的入口（回不去 = 死胡同）' unless
  page.include?('href="timeline.html"')
issues << '平面那页没有 3D 入口（用户点不到这个视图）' unless
  flat.include?('href="timeline-3d.html"')
# 考试浮窗（用户 2026-09-30："每个考试的面……点击之后……弹出一个面板"＋
# "我点考试分析的时候，这个页面、考试分析里面应该有个 tab，它还有个考卷，也就是试卷……
# 要整合在一起，作为一个 tab 来选择"）—— **一块浮窗、两个页签**：分析 / 试卷。
issues << '3D 页没有考试浮窗（点住一场考试要弹出这一场的分析 + 试卷）' unless
  page.include?('data-t3-examwin') && page.include?('data-t3-examwin-list') &&
  page.include?('data-t3-examwin-close') && page.include?('data-t3-examwin-stats') &&
  page.include?('data-t3-examwin-note') && page.include?('data-t3-examwin-qlist')
issues << '考试浮窗的"分析 / 试卷"两个页签不在了（用户 2026-09-30 要的就是页签）' unless
  page.include?('data-t3-exam-tab="report"') && page.include?('data-t3-exam-tab="paper"') &&
  page.include?('data-t3-exam-pane="report"') && page.include?('data-t3-exam-pane="paper"') &&
  js.include?("panes[pz].getAttribute('data-t3-exam-pane') !== state.examTab")
# 考试那几个入口按用户后来的话从"板子上方"挪到**右侧那一竖排**（"这个考试，在上面。
# 我想想，放在哪啊？右边。你参考那个白板，右边我们也弄上竖的那一排"）：
# 难度层（点开才展开五档）· 考试分析（点了在**左边**出那块浮窗）。
issues << '右侧没有那一竖排（难度层 / 考试分析）' unless
  page.include?('data-t3-rail') && page.include?('data-t3-rail-levels') &&
  page.include?('data-t3-rail-report')
issues << '「难度层」不是"点开才展开那五档"（应初始收起、点开再选要显示哪几档）' unless
  page =~ /data-t3-levels[^>]*hidden/ && js.include?('state.railLevels = !state.railLevels;')
# 那五档要**在竖排的边上弹出去**，不是把竖排自己撑高（用户 2026-09-30："它边上再出来几层
# 不就行了吗？再出来几个点。它现在这样好丑啊"）；弹层里也别再挂注释（"它难度层后面这些
# 注释也不需[要]"），并且"考试分析"这颗按钮的提示就四个字（"它后面那个备注太长了，直接去掉"）。
issues << '难度层那五档不是"边上弹出去"（应绝对定位在这竖排左侧，别把竖排撑高）' unless
  page.include?('right: calc(100% + 8px);')
issues << '难度层弹层里又挂上注释了（用户 2026-09-30 明确说不需要）' if
  js.include?("cap.textContent = '选择要显示哪几档'") || page.include?('t3-levels__cap')
issues << '"考试分析"那颗按钮的提示又写长了（用户要的就是四个字）' unless
  js.include?("rep.setAttribute('data-t3-tip', shown ? '考试分析' : '先点住一块玻璃板');")
# 反向盯住：不许再长回"贴在板子上方"的那条 bar（那块已经被移到右边了）
issues << '板子上方那条 bar 又长回来了（用户 2026-09-30 已把它挪到右边）' if
  page.include?('data-t3-slabbar')
# 浮窗规格照白板那块面板（用户："参考白板的面板样式……可以拖动，它不应该老是在那。
# 而且宽度你也参考一下白板那边的那个面板，它应该是一致的"）—— 默认**贴着左上角**、
# 在左边（用户 2026-09-30："它贴着要完全出现就行，在左边"＋"直接顶着上面，稍微有一点[边距]"）。
issues << '浮窗不是白板那块面板的规格（同宽 --math-float-w + 标题栏可拖 + is-dragging + 贴着左上）' unless
  page.include?('width: var(--math-float-w)') && page.include?('cursor: grab') &&
  page.include?('top: 12px; left: 12px;') && page.include?('max-height: calc(100% - 24px);') &&
  page.include?('t3-float.is-dragging') && js.include?('function bindFloatDrag(')
# 「考点」浮窗的默认位置是**右下角**（用户 2026-10-01："考点面板的默认位置在右下角"）——
# 让开右侧那一竖排（`right: 18px`、宽 52px）与底部那条时间条。`left: auto` 不能省：
# 基类 `.t3-float` 上有 `left: 12px`，不置 auto 就还是赖在左下角。
# 实测（舞台 680×654）：面板 x 336…656 / y 436…506 —— 离竖排 10px、离时间条 15px、全在舞台内。
issues << '「考点」浮窗又赖回左下角了（用户 2026-10-01 要它默认落右下角）' unless
  page =~ /\.t3-float--node \{ top: auto; left: auto; right: 80px; bottom: 148px; \}/
# 单个考点那张独立小浮窗（用户："那个面板是只有在点击这个具体的某一个的时候，它出现一个单独的"）
issues << '少了"单个考点"那张独立浮窗（点具体某一个考点才出现）' unless
  page.include?('data-t3-nodewin') && js.include?('function syncNodePanel()') &&
  js.include?('function syncRail()')
issues << '浮窗里的行没接上（点一行应选中那个考点 + 弹单个考点浮窗）' unless
  js.include?("btn.setAttribute('data-t3-float-row'") && js.include?('function onFloatRowClick(ev)')
# 画布上划到"考点 / 题目"→ 面板里对应那几行**跟着亮**（用户 2026-10-01："鼠标在题目的点上移动的时候
# 题目面板的考点或者题目需要也有 hover 的状态"）。**光靠 CSS `:hover` 不行** —— 指针在画布上，
# 根本不在那一行上；得由 JS 按 `state.hovered` / `state.hoverRow` 挂 `is-hover`（随 syncReadout 重挂）。
#   分析那张考点表：`state.hovered === row.i`（直接划到考点）**或** `state.hoverRow.k === row.i`（划到它名下的题）；
#   试卷那张 / 考点浮窗那张题目表：`state.hoverRow.qi === 第几题`。
issues << '画布上划到它时，面板里对应那一行没跟着亮（少了 is-hover）' unless
  js.include?("(hovRow ? ' is-hover' : '')") &&
  js.include?("(qHov ? ' is-hover' : '')") &&
  js.include?("(mHov ? ' is-hover' : '')") &&
  js.include?('state.hovered === row.i || (state.hoverRow && state.hoverRow.k === row.i)') &&
  page.include?('button.t3-float__row.is-hover { background: var(--math-surface); }')
# 选中那一行要用**它自己那一档难度的标准色**（用户 2026-10-01："选中的时候有对应标准色的选择"）——
# 五档色由 JS 按 `levelColor()` 写进行上的 `--lv`，`is-pick` 走 `--lv`，不再借主色。
issues << '选中那一行没用"对应标准色"（应走行上的 --lv，而不是主色）' unless
  js.include?("btn.style.setProperty('--lv', levelColor(row.diff));") &&
  js.include?("row.style.setProperty('--lv', levelColor(n.difficulty));") &&
  page.include?('button.t3-float__row.is-pick {') && page.include?('color: var(--lv);')
issues << '选中那一行又改回主色了（用户要"对应标准色"）' if
  page.include?('button.t3-float__row.is-pick { background: var(--math-primary-tint)')
# ---------- 错因（用户 2026-10-01）----------
# "肯定有个错因，分个七八种吧……那七八种里面，他还要叠加这个知识点……而且里面这东西是复合叠加的。
#  既然要做就要做得力度深一点。" —— 词表**只有一份**，在 timeline-data.js（`WK_LEARNING.causes`），
# 3D 页只查表；主因写在错题那一行，叠加的几条与判据并进 `title`。
issues << '面板里看不到错因（「试卷」与「考点」两张表的错题行都没写）' unless
  js.include?('function causeText(item)') && js.include?('function causeTitle(item)') &&
  js.include?('put(row, causeCls(p), causeText(p));') &&
  js.include?('put(row, causeCls(m.p), causeText(m.p));')
issues << '错因在 3D 页里自己又写了一套词表（应只查 WK_LEARNING.causes）' unless
  js.include?('var list = (L && L.causes) || [];') && js.include?('var bys = (L && L.causeBys) || {};')
issues << '"不会 / 失误"两组没分颜色（不会 = 得回去补，失误 = 提醒就行）' unless
  page.include?('.t3-float__cause.is-gap { color: var(--math-bar-weak); font-weight: 600; }') &&
  page.include?('.t3-float__cause.is-slip { color: var(--math-ink-4); }')
# 反向：复合叠加不许被砍成"只留第一条"（`causes` 是数组，主因之外要挂上 `+N`）
issues << '复合叠加被砍成一条了（应保留整条 `causes` 数组并标出 +N）' unless
  js.include?("if (item.causes.length > 1) { t += ' +' + (item.causes.length - 1); }")
# 工具条：3D/平面 · 透视/正交 · 柱/曲线 · 着色 · 缩小/读数/放大 · 重置 · 帮助 · 回平面
#（难度层 2026-09-30 从工具条搬走 → 右侧那排竖按钮；**考试切片 2026-10-01 也搬过去了** ——
#  用户："你需要在 3D 数轴右边再加一个切片按钮，也就是考试切片的按钮。"）
%w[data-t3-toggle data-t3-proj data-t3-render data-t3-color
   data-t3-zoom-out data-t3-zoom data-t3-zoom-in data-t3-reset data-t3-help-btn].each do |k|
  issues << "3D 页工具条缺 #{k} 这个按钮" unless page.include?(k)
end
issues << '底部工具条上还留着「考试切片」那颗（已挪到右侧竖排，同一动作只留一颗按钮）' if
  page.include?('data-t3-exams')
# 工具条照白板：**只有图标**，汉字说明 hover 时才出（用户 2026-09-30："底部按钮参考白板的样子，
# 汉字解释 hover 的时候出现"）。所以按钮上不许再挂常显的汉字标签，tip 必须齐。
issues << '工具条按钮上又挂了常显的汉字（应只有图标，汉字走 data-t3-tip 在 hover 时出）' if
  page.include?('t3-dock__label')
issues << '工具条按钮没有 hover 气泡（每个按钮都要有 data-t3-tip）' unless
  page.scan(/<button[^>]*t3-dock__btn[^>]*>/).all? { |tag| tag.include?('data-t3-tip=') }
# 划过的那一行提示（用户 2026-10-01："这个提示不要太厚，可以直接就是一排字……放在学习时间的
# 上方"＋"如果这个 hover 出现的提示在学习时间这个上方出现的话，那我们右上角那个就可以直接删掉了"）
# —— 原来是右上角那张小卡，现在整块挪到**时间条上方的一行字**里；考到哪几场并进这一行。
issues << '少了"划过的一行提示"（data-t3-hint，应在时间条上方）' unless
  page.include?('data-t3-hint') && page =~ /\.t3-hint \{[\s\S]{0,400}?bottom: 122px;/
issues << '右上角那张划过小卡又长回来了（用户 2026-10-01 已让撤掉、只留底下一行）' if
  page.include?('data-t3-hover') || page.include?('.t3-hover') || js.include?('syncHoverCard')
issues << '划过提示没接上（应 syncHint：这一道题 / 这个考点 / 这一场考试三种说法）' unless
  js.include?('function syncHint()') && js.include?("txt = '第 ' + (row.qi + 1) + ' 题';") &&
  js.include?("' · 考的是「' + nd.name + '」'") && js.include?("' · 考到 ' + hits.length + ' 场'") &&
  js.include?('syncHint();')
issues << '划过提示没有"点一下打开那个考点的面板，并把这道题一起高亮"（用户 2026-10-01："对这个题感兴趣，然后点击一下，会出现考点的那个面板里，出现它的考点，然后这个题的具体样子"）' unless
  js.include?('state.pickedQ = row.qi;') && js.include?("hintBox.addEventListener('click'")
issues << '划过提示挡不住"移出画布就清掉"（光标从画布挪到它上面时会被清空，点不着）' unless
  js.include?('hoverOffTimer = window.setTimeout(clearHover, 220);') &&
  js.include?('if (hoverOffTimer) { window.clearTimeout(hoverOffTimer); hoverOffTimer = 0; }')
# 划到的那**一个点**要套一个白圈（用户 2026-10-01："它滑动的同时，应该有一个 hover 的点，
# 表示我选中了哪一个。可能是个白色的圈，就给人一个提示"）
issues << '划过的那一个点没有白圈' unless
  js.include?('if (state.hoverPt) {') && js.include?("c.strokeStyle = readColor('--math-popover');") &&
  js.include?('state.hoverPt = pt;')
# 切片顶上那行**标题**默认不写，划到或钉住之后才出现（用户 2026-09-30："它上面显示了四年级
# 年级考，还有考试的这个信息，应该还得加上基础信息，比如月几号、四年级年级考时间、考试的
# 基础分、满分多少、考了多少分。它应该类似标题"）—— 从原来只写年级名扩成"月日 · 名称 · 实得 / 满分"。
issues << '切片标题默认就写出来了（应划到 / 钉住之后才出现）' unless
  js.include?("if (hot || hov) {") &&
  js.include?("text(cnDate(e.date) + ' · ' + e.name + ' · ' + e.got + ' / ' + e.full + ' 分',") &&
  js.include?("{ x: pts[3].x, y: pts[3].y - 19 }, accent, 'left', 12);")
# 那行标题要**离切片顶边留一截**（用户 2026-10-01："那指示信息的标题稍微往上一点"）——
# 原来 `y - 10` 几乎贴在切片上沿、压着板顶那条边；现在是 `y - 19`。反向盯住：别再贴回去。
issues << '切片标题又贴回切片上沿了（用户 2026-10-01："那指示信息的标题稍微往上一点"）' if
  js.include?("{ x: pts[3].x, y: pts[3].y - 10 }, accent, 'left', 12);")
issues << '切片标题少了"年 / 月日 / 实得 / 满分"这几样（用户要它像标题一样一眼看明白）' unless
  js.include?('function cnDate(d)') && js.include?('cnDate(e.date)') &&
  js.include?("e.got + ' / ' + e.full + ' 分'") &&
  js.include?('got: got,') && js.include?('full: full,')
# 标题上的日子**要带年**（用户 2026-10-01："上面那个时间只不过没加上年，你需要加上年"）——
# 反向盯住：不许再退回只有"5月18日"那种写法
issues << '切片标题又退回"只有月日、没有年"了（用户要加年）' if
  js.include?('function mdText(d)') || js.include?('mdText(')

# ---------- 2. 三条口径 ----------
# 默认是 **3D**（用户 2026-09-30："柱状图默认是平面的，对吧？……直接进来就是 3D 的"）
issues << '默认视角不是 3D（state.view 初值必须是 space）' unless
  js =~ /view: 'space',/
issues << '3D 页在写学习记录（这一层是只读的：标记 / 掌握度 / 筛选都留在 2D）' if
  js =~ /\.marks\s*=/ || js.include?('setMarks') ||
  (js.include?('localStorage') && !js.include?("'wkmath.exam.scan.v1'"))
# 唯一允许的那一份例外（用户 2026-10-01）：**原卷认领**（学生对错因的"认可 / 再叠一个原因"）
# 要落本机，所以开了 `wkmath.exam.scan.v1` 这一个键。它不是学习记录 —— 标记 / 掌握度 / 筛选
# 照旧归 2D（上面那条盯着的就是"除了这一个键，别的存储键一个都不许出现"）。
issues << '3D 页多开了别的存储键（只许 `wkmath.exam.scan.v1` 那一份"原卷认领"）' unless
  js.scan(/localStorage\.\w+\(([^)]*)\)/).nil? ||
  js.scan(/localStorage\.\w+\(([^)]*)\)/).flatten.all? { |a| a.include?('SCAN_KEY') }
issues << '3D 页没有用共享的摊平模块（window.WK_AXIS.build）' unless
  js.include?('window.WK_AXIS') && js.include?('AX.build()')
issues << '3D 页没有用共享的学习记录（timeline-data.js）' unless
  js.include?('window.WK_LEARNING') && js.include?('buildTimeline')
issues << '3D 页引了第三方库（站点零构建、无 CDN：只有线 / 点 / 板，自己画就够）' if
  js =~ /require\(|from ['"]|three\.min|cdn\.|unpkg|jsdelivr/
issues << '3D 页没有引 timeline-axis.js（与 2D 共用同一根轴）' unless
  page.include?('assets/js/timeline-axis.js') && page.include?('assets/js/timeline-3d.js')

# ---------- 3. 令牌纪律 ----------
issues << '3D 页的样式里写死了颜色（颜色必须走 CSS 令牌，三套配色才自动生效）' if
  page[/<style id="t3-styles">([\s\S]*?)<\/style>/, 1].to_s =~ /#[0-9a-fA-F]{3,8}\b/
issues << '3D 引擎里写死了颜色（画布颜色必须从 tokens.css 读）' unless
  js.include?('readColor(') && js.include?("getPropertyValue")
issues << '3D 引擎里出现了写死的十六进制颜色（原型那几个常量必须换成令牌）' if
  js =~ /['"]#[0-9a-fA-F]{6}['"]/
issues << '3D 页的字号没有乘 --math-fs（显示设置里的"大 / 特大"要管到这里）' unless
  js.include?('--math-fs') && page.include?('var(--math-fs)')

# ---------- 4. 原型内核（照搬的那几处，一处都不许走样） ----------
issues << '相机距离不是原型那个 110' unless js.include?('var cameraDistance = 110;')
issues << '投影没有照原型（平移到盒子中心 → 绕垂直轴 → 绕水平轴 → 按深度缩放）' unless
  js.include?("var cy = (state.view === 'axis' ? y : y - 11) * sy;") &&
  js.include?('var rx = cx * cos + cz * sin;') &&
  js.include?('var rz = -cx * sin + cz * cos;') &&
  js.include?('var ry = cy * cp + rz * sp;') &&
  js.include?('var depth = rz * cp - cy * sp;') &&
  js.include?('cameraDistance / Math.max(8, cameraDistance + depth)')
# 旋转的**焦点**：没选中时是时间轴中心；选中某一场 → 焦点搬到那一场（x 中心 + 它那天）
issues << '旋转焦点没跟着选中的考试走（选中要把焦点搬到那一场，取消要回到中心）' unless
  js.include?("var cz = (state.view === 'axis' ? z : z - pivotZ) * sz;") &&
  js.include?('pivotX = xx((pinnedInfo.range[0] + pinnedInfo.range[1]) / 2);') &&
  js.include?('pivotZ = zOf(pinnedInfo.day);') &&
  js.include?('var pivotX = 0;') && js.include?('var pivotZ = 10;')
# 取景盒子照原型 100 × 22 × 20（X × Y × Z）；Z 方向现在取到 **FUTURE_Z** —— 底下那排题目点
# 站在轴外 2028 那一格上，取景要把它一起框住（见 2026-09-30 那条"再往外两年"）
issues << '取景盒子不是原型的 100 × 22 × 20（Z 应取到 FRAME_Z）' unless
  js.include?('[-50, 50][cx]') && js.include?('[0, 22][cyy]') && js.include?('[0, FRAME_Z][czz]') &&
  js.include?('var FRAME_Z = FUTURE_Z + 6;')
issues << '取景不是对称包围盒（转视角时内容会跑偏）' unless
  js.include?('2 * maxU') && js.include?('2 * maxV')
issues << '没给右侧面板留位置（原型是 w - 310）' unless js.include?('w > 760 ? 310')
# 两个轴都不夹角度（原型的注释：Wrap equivalent angles instead of clamping）
issues << '旋转又夹上角度了（yaw / pitch 都必须 % (Math.PI * 2)）' unless
  js.include?('state.yaw = (state.yaw + a.dx * 0.005) % (Math.PI * 2);') &&
  js.include?('state.pitch = (state.pitch + a.dy * 0.005) % (Math.PI * 2);')
issues << '俯仰角又夹回去了（不许再出现 Math.max(0, Math.min(1.25, …)) 这种边界）' if
  js =~ /Math\.max\(0, Math\.min\(1\.25/
issues << '缩放范围没照原型（它夹在 .55 ~ 24 倍）' unless
  js.include?('Math.max(0.55, Math.min(24,')
issues << '默认角度没照原型（yaw -0.08 / pitch 0.38）' unless
  js =~ /yaw: -0\.08,/ && js =~ /pitch: 0\.38/
# 难度层：原型那五个水平面
issues << '难度层不是原型那五档（4 / 8 / 12 / 16 / 20）' unless
  js.include?('var layerHeights = [4, 8, 12, 16, 20];')
issues << '难度层没有按深度排序再画（近的压远的）' unless
  js.include?('.sort(function (a, b) { return b.depth - a.depth; })')
# 每一层**自己一个颜色**（绿 / 蓝 / 黄 / 橙 / 红），不点就不出现
issues << '难度层没有各自的颜色（五档要从 --math-lv-1…5 读）' unless
  js.include?("return readColor('--math-lv-' + no);") &&
  js.include?('var tint = levelColor(o.i + 1);') && js.include?('polygon(points, tint, 0.06);')
issues << '难度层不是一层一个开关（应 state.levels 逐个开 / 关）' unless
  js.include?('levels: [false, false, false, false, false],') &&
  js.include?('function levelOn(no)') && js.include?('if (!levelOn(o.i + 1)) { return; }')
# 考试切片：一块立在考试那天的竖直板；板上每个考点按它的难度打点
issues << '考试切片不是"立在考试那天的竖直板"（宽度 = 考点跨度、底边落地、顶边到难度上限）' unless
  js.include?('var pts = [p(xx(a), 0, z), p(xx(b), 0, z), p(xx(b), 21, z), p(xx(a), 21, z)];')
issues << '考试覆盖点没按难度给高度（点的高度必须 = 这个知识点的难度）' unless
  js.include?('var pt = p(bx, nd.difficulty * 4, z);')
# 板上的点是**一道题一个点**，而且落在**这道题考的那一块**上
# （用户 2026-10-01："同样的一个知识点，比如绝对值……第七题是因为概念不清，第八题是因为
# 计算错了数，只有这样才能分清楚"）—— 一个考点一个点的话，两道题永远挤在同一处。
issues << '切片上还是一"考点"一个点（应一道题一个点，并按它考的那一块落位）' unless
  js.include?('e.paper.forEach(function (item, qi) {') &&
  js.include?('var bx = xx(k) + blockOffset(nd, item.card);')
issues << '考试覆盖点没区分对错（做错的要用"薄弱"色点出来）' unless
  js.include?('function seedColor(i, ex) { return ex.wrong[i] ? weak : accent; }')
# ---------- 一格里面再分块（与平面数轴**同一套算法**）----------
# 用户 2026-10-01："现在的颗粒力度很细，每个知识点里面还可能再分六七个维度……3D 的那个数轴，
# 知识点的线应该也像平面的那样，也就是它的知识点线是有宽度的，里面再根据他的情况有宽细之分。
# 这个数轴和 3D 的数轴、平面的数轴是一致的。只有这样才能细分。"
# 所以四条必须与平面同值：**宽度 = 卡片权重、门槛 = 一格 56 屏幕像素、缝 = 1.4px、高度齐平**。
tl_js = read('assets/js/timeline.js')
issues << '3D 的知识点柱还是一根线（没有按卡片权重切出宽度）' unless
  js.include?('function cardBlocks(cards, gridW, gridPx)') &&
  js.include?('var blocks = blocksOpen ? cardBlocks(n.cards, gridW, gridPx) : null;') &&
  js.include?('cards: (r.cards || [])')
issues << '3D 拆块的门槛 / 缝跟平面数轴对不上（缝必须同一套：1.4px）' unless
  js.include?('var CARD_GAP_PX = 1.4;') && tl_js.include?('var gap = px(1.4);')
# 门槛这个数**两边故意不一样**：平面 56px（它 `MAX_SCALE = 400`，够得着），
# 3D 只能缩到 24 倍（照原型那条口径），实测 zoom 24 时一格也才约 29px ——
# 照抄 56 的话这条功能**永远出不来**（第一版就是这么写的）。所以 3D 定 20px（zoom ≈ 16.5 到得了）。
issues << '3D 拆块的门槛又照抄了平面的 56px（3D 缩放上限 24 倍、一格最多约 29px，56 永远到不了）' unless
  js.include?('var CARD_MIN_GRID_PX = 20;') && tl_js.include?('var CARD_MIN_W = 56;')
issues << '3D 的块宽不是按权重分的（应 usable * weight / sum，和平面一条算法）' unless
  js.include?('var w = usable * (cards[i].weight || 0) / sum;') &&
  tl_js.include?('var w = usable * card.weight / sum;')
issues << '块名没写出来（一块宽到 34px 就该写卡片名，否则看不出哪块是哪块）' unless
  js.include?('var CARD_NAME_PX = 34;') && js.include?('if (!off && b.px >= CARD_NAME_PX) {')
issues << '柱子铺开之后两侧的块没进命中表（看得见、hover 不出来）' unless
  js.include?('dots.push({ x: b1.x, y: b1.y, id: n.id, base: b0, r: 4, card: bi });')
# "落在哪一块"要**读得出来**：柱子上的块只有几像素宽、写不下字，所以靠底部那一行提示说
# （用户 2026-10-01："同样的一个知识点……第七题是因为概念不清，第八题是因为计算错了数，
# 只有这样才能分清楚"）。切片上的点 / 底下那排的题也都带上 `card`，提示里补题号与块名。
issues << '"落在哪一块"读不出来（hover 提示没写块名 / 没带题号）' unless
  js.include?('hoverCard: null,') && js.include?('state.hoverCard = cardInfo;') &&
  js.include?('if (txt && blkType) { txt += \' · 落在「\' + blkType + \'」这一块\'; }') &&
  js.include?("if (blkType && blkQi !== null) { txt = '第 ' + (blkQi + 1) + ' 题 · ' + txt; }") &&
  js.include?('card: item.card, qi: qi });')
issues << '"落在哪一块"没跟着鼠标移开清掉（会一直挂着）' unless
  js.include?('state.hoverCard = null;') && js.include?('!state.hoverRow && !state.hoverCard')
# 一格宽是**实量**出来的（拿 `p()` 投影出来比），不是写死的解析式 —— 转视角 / 透视都不跑偏
issues << '一格在屏幕上多宽是写死的（应拿 p() 实量，转视角 / 透视才不跑偏）' unless
  js.include?('var gridPx = Math.abs(p(xx(1), 0, currentZ).x - p(xx(0), 0, currentZ).x);')
# 考试切片**不是**一个图层开关（用户 2026-10-01 第二次改口径："我们这个切片是一直在的，
# 这个切片是由这个时间轴来控制的，滑动时间轴就知道我们有多少"）—— 所以 `layers` 里没有 exams，
# 只有"多少场"由 `dayMs` 说了算。
issues << '考试切片又变成了图层开关（板应一直在，有多少由底部时间条决定）' if
  js.include?('exams: true,') || js.include?('state.layers.exams')
issues << '考试切片没有跟着"当前那一天"过滤（滑动时间条应能多一场少一场）' unless
  js.include?('EXAMS.filter(function (e) { return e.day <= state.dayMs; })')
issues << '底部那三个数据图层没齐（应是 progress / scores / effort 三个）' unless
  js.include?('layers: { progress: false, scores: false, effort: false }')
# 柱子：站在"当前那一天"那一刀上（跟着底部时间条走），X 轴与年级名跟着它
issues << '柱子没站在"当前那一天"那一刀上（时间条挪动时这堵墙要跟着滑）' unless
  js.include?("var currentZ = state.view === 'axis' ? 0 : zOf(state.dayMs);") &&
  js.include?('var base = p(xx(n.id), 0, currentZ);')
issues << 'X 轴没跟着柱子那条 z（应画在 currentZ 上）' unless
  js.include?('line(p(minX, 0, currentZ), p(maxX, 0, currentZ), muted, 0.45, 1);')
# 轴上那排年级名与「X · 知识序列」标签已撤（用户 2026-09-30："这个数轴上面的一年级、二年级、
# 三年级、四年级，还有知识序列应该去掉" —— 考试切片自己写了是哪个年级的）—— 反向盯住不许长回来。
issues << '轴上的年级名 / 「X · 知识序列」又长回来了（用户 2026-09-30 明确要撤）' if
  js.include?("text('X · 知识序列'") || js.include?('p(xx((start + end) / 2), -3.2, currentZ)')
# 「Y · 综合难度」「Z · 学习时间」这两处标签也收起来（用户 2026-09-30："你把这个学习时间和综合难度，
# 这四个字隐藏，就光隐藏就行"）—— 轴与刻度都还在，只是不再挂这八个字。
issues << '「Y · 综合难度」/「Z · 学习时间」又写回去了（用户已让隐藏）' if
  js.include?("text('Y · 综合难度'") || js.include?("text('Z · 学习时间'")
issues << '知识柱没画"基点 + 竖线"（原型是 line(base,pos) 再加一个点）' unless
  js.include?('line(base, pos, off ? grid : color, alpha,') &&
  js.include?('dots.push({ x: pos.x, y: pos.y, id: n.id, base: base, r: 5 });')
# 指针命中：原型是"22px 以内取最近"，我们在它前面加了一层"**点优先于面**"
# （板上的点落在板面里，板面判定是 dist=0，不先给点就永远划不到那个点）
issues << '指针命中不是"22px 以内取最近 + 点优先于面"' unless
  js.include?('if (dot && dotD < 22) { return dot; }') && js.include?('function hit(e)')

# ---------- 5. 数据适配（我们的东西） ----------
issues << 'NODES 没有从我们的轴里来（难度要落到 1–5 档）' unless
  js.include?('var NODES = ITEMS.map(') && js.include?('Math.max(1, Math.min(5, r.diff || 1))')
issues << 'STAGES 没有从我们的年级段里来' unless
  js.include?('var STAGES = (SEGS[1] || []).map(')
issues << 'EXAMS 没有从我们的考试表里来' unless
  js.include?('var EXAMS = examsOfStage().map(')
issues << '考试的"错"不是从卷面算的（应看 score / full，不许另编一套）' unless
  js.include?('if (p.score * 5 < p.full * 3) { wrong[vi] = 1; }')
# 时间条的滑杆走的是**我们的日期**（不是原型的 0–90 天）
issues << '时间条的滑杆不是按我们的时间窗算的（天数要由 T0/T1 推）' unless
  js.include?('var DAY_N = Math.max(1, Math.round((DAY1 - DAY0) / DAY));') &&
  js.include?('function dayIndex(ms)')
issues << 'Z 不是按我们的时间窗算的（日期 → 0…1 → ×20）' unless
  js.include?('return ms === null || ms === undefined ? 0 : tOf(ms) * 20;')
issues << '没有按我们的时间窗算 Z（第一册开学 → 最后一册读完）' unless
  js.include?('function zOf(ms)') && js.include?('T1 - T0')
# 底部时间条（用户 2026-09-30："它有一个底部有个时间条。你拖动时间条的时候，那个知识点会滑动。
# 同时呢滑动的过程中会出现一个个的考试的那个切片"）—— 照原型那一条：前一天 / 日期 / 滑杆 / 后一天
issues << '没有底部时间条（前一天 / 日期 / 滑杆 / 后一天）' unless
  page.include?('data-t3-timebar') && page.include?('data-t3-day') &&
  page.include?('data-t3-prev-day') && page.include?('data-t3-next-day') && page.include?('data-t3-date')
issues << '时间条没接上（拖动要挪"当前"那一天，柱子那堵墙跟着在时间里滑）' unless
  js.include?('function buildTimebar()') && js.include?("case 'day':") &&
  js.include?('var currentZ = state.view === \'axis\' ? 0 : zOf(state.dayMs);')
issues << '考试切片没跟着时间条走（应只画已经考过的：e.day <= state.dayMs）' unless
  js.include?('EXAMS.filter(function (e) { return e.day <= state.dayMs; })')
issues << '柱子颜色没跟着那一天走（应按那一刻的掌握度分档）' unless
  js.include?('function masteryAtTime(i, at)') && js.include?('function statusOf(m)')

# ---------- 5b. 选中 / 划过两种状态（用户 2026-09-30）----------
# 选中（钉住）某一场：**只有这一场和它考到的知识点是彩色的，其余灰显**；划过只把边框描重。
issues << '钉住一场之后没有"只留这一场彩色、其余灰显"' unless
  js.include?('var coveredByPinned = pinned ? COVERED[pinned] : null;') &&
  js.include?('var off = coveredByPinned !== null && !coveredByPinned[n.id];') &&
  js.include?('line(base, pos, off ? grid : color, alpha,')
issues << '划过的那一场没有描边（应把边框描重）' unless
  js.include?('var hov = state.hoverExam === e.id;') &&
  js.include?('(hot || hov) ? 1.6 : 1')
issues << '灰显的那几场没被压掉（覆盖点也该一起隐去）' unless
  js.include?('if (dim) { return; }')
# 难度层 = **右侧那排竖按钮**（照白板那排按钮）：五个档各一个开关，点名字开 / 关
issues << '右边没有难度层那排按钮（data-t3-levels）' unless
  page.include?('data-t3-levels') && page.include?('role="group"')
issues << '难度层那排没有五档各自的开关（应 buildLevels 里逐档建按钮 + data-t3-level）' unless
  js.include?('function buildLevels()') && js.include?("btn.setAttribute('data-t3-level', String(lv.no));") &&
  js.include?('state.levels[lv.no - 1] = !state.levels[lv.no - 1];') && js.include?('function syncLevels()')
# 五档的名字（基础 / 概念 / 应用 / 变化 / 综合）
%w[基础层 概念层 应用层 变化层 综合层].each do |nm|
  issues << "难度层缺少「#{nm}」这一档" unless js.include?("name: '#{nm}'")
end
# 选中某一场：板上考点用**曲线**连到对应柱子的顶；
# 柱底那串考点点**排成一排**（用户 2026-09-30："它应该弄成一排……它不一定非得按照这个数轴的长度，
# 它可以长一点……从那个数轴线状图那儿，再扯出来一条线，它是一一对应的……每一个知识点默认时候，
# 它的名字都会出现；如果是错的，就是红色的"）。
issues << '选中某一场后，考点没有用曲线连到对应的柱子' unless
  js.include?('c.bezierCurveTo(pt.x, pt.y - 22, top.x, top.y - 22, top.x, top.y);') &&
  js.include?('var top = p(bx, nd.difficulty * 4, currentZ);')
# 钉住一场之后柱墙底那一排：**这一道道题**（用户 2026-09-30："底下的这些应该是题目了吧？
# ……而不应该是知识点"），方向往**场景里面**、长度按第二遍的话定 =
# **切片宽度的 2.2 倍**（"我说了是 2 倍到 2.5 倍……拉开的时候是比较舒适的那种感觉"）。
issues << '钉住一场之后没有排出**这一道道题**（应按卷面逐题、不是按知识点）' unless
  js.include?('pe.paper.forEach(function (item, qi) {') &&
  js.include?("dots.push({ x: q.x, y: q.y, id: k, exam: pe.id, r: 7, onRow: true, qi: qi,")
# 那一排的长度按用户 2026-09-30 最后一句再放宽到 **1.5 倍**（"它这个宽度和长度，也就是我们
# 这么多题目的长度，可以再扩展一下，大约是扩展到现在的 1.5 倍，这样我们比较明显"）——
# 由原来的 160 × 2.2 改成 240 × 3.3。
issues << '那一排的长度不对（应 = 切片宽 × 3.3，用户要的是再放宽 1.5 倍）' unless
  js.include?('var rowW = Math.min(240, (sb - sa) / span * 100 * 3.3);')
# 那一排要站在**轴尾再往外两年**（用户 2026-09-30："我说了再往外，使劲往外……大约是在 2028 年
# 那个位置……相当于加两年的那个位置"），地面与取景都得跟着画出去。
issues << '那一排没挪到轴外（用户要它站在 2028 那一格上）' unless
  js.include?('var rowZ = FUTURE_Z;') && js.include?('var FUTURE_Z = 20 + 2 * YEAR_Z;')
# 年份刻度**贴着那条棱**（用户 2026-09-30："他应该找到那个表的那个根儿那。然后现在他离得有点远，
# 导致那些线感觉是跟标错了一样"）—— 不许再往右偏一大截。
issues << '年份刻度又飘走了（应紧挨着 Z 轴那条棱）' unless
  js.include?('line(p(maxX, 0, t.z), p(maxX + 1.4, 0, t.z), grid, 0.4);') &&
  js.include?("text(t.label, { x: pt.x + 9, y: pt.y + 4 }, muted, 'left', 11);")
# 轴外那两年**一个刻度、一个年份都不要**（用户 2026-09-30："我说的 2028 年是指大约说的那个
# 位置，但是那条线和那个数不需要出现……那个位置我们知道就行了"）—— 位置还在（那一排站在那儿），
# 只是不画刻度、不写年份。
issues << '轴外那两年又把年份 / 刻度画出来了（用户说只要知道大约位置就好）' unless
  js.include?('TIME_TICKS.forEach(function (t) {') && js.include?('if (t.future) { return; }')
issues << '年份刻度又飘到右边去了（用户 2026-09-30 说像标错了）' if js.include?('Math.min(w - 82, pt.x + 64)')
# 题号**用虚线牵出去写**，不直接压在那排点上（用户 2026-09-30："现在是直接罗列在那个线上，
# 我觉得不合适，挡住了。你可以找到那个点，然后用虚线指出来"）
issues << '题号又直接压在那排点上了（应该用虚线牵到外面写）' unless
  js.include?('line(q, { x: lab.x, y: labY }, hi ? accent : weak, hi ? 0.66 : 0.30, 1, [3, 3]);') &&
  js.include?("text('第' + (qi + 1) + '题', { x: lab.x, y: labY + 4 },")
# 题号**只标做错的那几道 + 点开那个考点考到的题**（用户 2026-09-30："我觉得最好直接出第多少题
# 第多少题……就是错的题它出来"；2026-10-01 又加了"点击了这个考点，这个考点相关的那两道题"）
issues << '题号不是"只标做错的那几道 / 点开那个考点考到的那几道"' unless
  js.include?('if (bad || hi) {')
# **每条错题都要有字**（用户 2026-10-01："做错的题目有好多，被红圈圈起来的有很多，但是显示红色
# 多少第多少题的少？应该每个做错的都有文字标记出来"）—— 反向盯住那句会漏标的密度过滤器，
# 并确认改成了"分四条车道轮流往外牵"
issues << '题号又被"至少隔 N 个世界单位才标一个"漏掉了几道（用户要每条错题都标出来）' if
  js.include?('qx - lastLabX >= 5') || js.include?('var lastLabX = -1e9;')
issues << '题号没有分车道（错题一挤就会摞在一起）' unless
  js.include?('var lane = labN % 4;') && js.include?('var labY = lab.y + 10 + lane * 12;')
# 每个点从它在轴上的柱脚扯一条引线 + 做错的红环（划到 / 点开的走 accent 加粗）
issues << '那一排的题目点没有从柱脚扯引线 / 没有标出错题' unless
  js.include?('line(foot, q, hi ? accent : (bad ? weak : lc),') &&
  js.include?('c.strokeStyle = hi ? accent : weak;')
# 浮窗里点**某一道题** → 图上那道题与它对应的知识点一起高亮（用户 2026-09-30："我点击哪道题，
# 哪道题就高亮，知识点高亮，对应的这个题目也高亮"）
issues << '点某道题没有"这道题 + 它的知识点一起高亮"' unless
  js.include?('var pick = state.pickedQ === qi;') &&
  js.include?('state.pickedQ = q === null || q === undefined ? null : Number(q);')
# 板上的点要**优先于板面**被命中（用户："鼠标 hover 在考试切片的点的时候，它应该出现一个
# 类似框住这个小点、描边的感觉"）—— 原来板面判定 dist=0，把这个点整个吃掉了。
issues << '板上的点被板面吃掉了（应"点优先于面"：12px 以内先给点）' unless
  js.include?('if (dot && dotD <= 12) { return dot; }')
# 点住一块玻璃板 → **相机适配到这一场**，而且**不弹**浮窗（用户："我选择了这个考试切片的时候，
# 它不应该出现'考试分析'这个，直接聚焦到'我的这次考试'这个图……一个相对地适配"）；
# 角度还要**回转到参考角度**（用户 2026-09-30："它那个角度就会回转到刚给我的参考角度……
# 让人家有一个直观的感受，就表示这个考试考的啥样子"）。
issues << '点住一块玻璃板没有把相机适配到这一场（也没把"不弹浮窗"写死）' unless
  js.include?('function focusExam(id, keepAngle, dur)') && js.include?('focusExam(best.exam);') &&
  js.include?('state.examWin = false;')
# 聚焦 / 松开都走**相机动画**（用户 2026-09-30："那个时间段的长度可以用动画的形式缩一下……
# 这样人家不至于说那么长"）；角度同时转到"俯视"的参考角度（"你一定要有一个俯视的感觉"）。
issues << '聚焦这一场时角度没转到"俯视"（用户 2026-09-30："你一定要有一个俯视的感觉……让人家可以看到空间关系"）' unless
  js =~ /function focusExam\(id, keepAngle, dur\) \{[\s\S]{0,700}?yaw: keepAngle \? state\.yaw : -0\.08,[\s\S]{0,160}?pitch: keepAngle \? state\.pitch : 0\.70,/
# 聚焦的缩放要**收敛**（用户 2026-09-30："它的确需要聚焦，但是你这聚焦的也太大了"）
issues << '聚焦的缩放又放大了（用户说太大了，要收敛）' unless
  js.include?('zoom: Math.max(1, Math.min(2.6, 100 / Math.max(26, w * 3.2))),')
# 相机动画在（中心 / 缩放 / 两个角度 / 平移一起插值，easeOutCubic），而且用户一动手就停
issues << '没有相机动画（聚焦 / 松开应平滑过渡，别硬跳）' unless
  js.include?('function camTo(to)') && js.include?('function camStop()') &&
  js.include?('1 - Math.pow(1 - k, 3)') && js.include?('window.requestAnimationFrame(step);')
issues << '用户一动手没把相机动画停住（会跟人抢镜头）' unless
  js =~ /function down\(e\) \{\s*camStop\(\);/ && js.include?("camStop();                     /* 滚轮自己缩放，也把相机动画停掉 */")
# 板上的点**先让位给板面**（用户 2026-09-30："我点击切片，现在还给我出这个考点和这个分析、
# 试卷呀？……默认是不出现的，是干干净净的"）—— 板上的覆盖点太密，不让位就会"随手一点弹考点"。
issues << '板上的点没让位给板面（钉住这一场之前，点板上任何地方都该算"点这块板"）' unless
  js.include?('if (best && best.onSlice && state.exam !== best.exam) {')
# 点空白 = **取消选择**（用户 2026-10-01："如果我鼠标放在空白的地方，点击的时候就相当于取消了
# 选择。知识点啊、题目或者画板之类的"）—— 原来漏了 `state.selected`（图上那个绿圈 + 绿字），
# 点完空白它还杵着。现在：选中的点 / 考点 / 题目 / 画板 / 四个划过状态一起清，浮窗收，视野归位。
issues << '点空白没有把"选中的那个点 / 钉子 / 浮窗 / 划过状态"一起收干净' unless
  js =~ /点空白 = \*\*取消选择\*\*[\s\S]{0,900}?state\.selected = null;[\s\S]{0,400}?state\.hoverRow = null;/
issues << '点空白留下了"选中的那个点"没清（绿圈 / 绿字会一直杵在图上）' unless
  js =~ /点空白 = \*\*取消选择\*\*[\s\S]{0,900}?state\.selected = null;/
# 点空白**不许动相机**（用户 2026-10-01 追加："单个切片测试的时候，点击外面，它还是会回到总轴。
# 你需要点击…之后，才能回到总轴"）—— 回总轴改由右侧「回到总轴」/ 底部「适配」负责，
# 一失手点到空白不该把用户调好的角度与缩放拽走。
issues << '点空白又把相机拽回总轴了（用户要"点了外面只是取消选择"，回总轴走「回到总轴」那颗按钮）' if
  js =~ /点空白 = \*\*取消选择\*\*[\s\S]{0,1300}?canvas\.style\.cursor = '';[\s\S]{0,320}?camTo\(/
# 【铁律】进了单个考试，**只有右侧「回到总轴」能"退出这一场"**（用户 2026-10-01："进入单个考试面板，
# 只有右侧的回到总轴可以回去，其他的排查一下，记住" + "我进入了单个的考试切片，然后随便点点外面，
# 空白的地方它就回去了呀……点外面的地方和点这个玻璃，它都能回去啊"）。
# 这里说的"回去"＝**`state.exam` 被松开**（板不聚焦、底下那排题没了 = 退出单个考试），不是相机飞哪儿去。
# 所以 `select()` 里**三条分支都不许碰 `state.exam`**（点另一块板 = 切到那一场，不算退出）。
issues << '点空白那一支又把 state.exam 松开/改动了（要退出只能点右侧「回到总轴」）' if
  js =~ /点空白 = \*\*取消选择\*\*[\s\S]{0,1600}?state\.exam = /
issues << '"再点同一块板"那一支又把 state.exam 松开了（要退出只能点右侧「回到总轴」）' if
  js =~ /if \(state\.exam === best\.exam\) \{[\s\S]{0,300}?state\.exam = null;/
issues << '"再点同一块板"那一支还在动相机（只该取消选中的那个点）' if
  js =~ /if \(state\.exam === best\.exam\) \{[\s\S]{0,300}?camTo\(/
issues << '"再点同一块板"没做成"只取消选中的那个点"' unless
  js =~ /if \(state\.exam === best\.exam\) \{\s*state\.nodeAt = null;\s*state\.pickedQ = null;\s*\}/
# `state.exam = null` 只许出现在「回到总轴」那一路（homeAxis）里
exam_clears = js.scan(/state\.exam = null;/).size
issues << "`state.exam = null` 出现在 #{exam_clears} 处（只该有 homeAxis 那一处）" if exam_clears > 1
issues << '「回到总轴」那一支没把这一场松开' unless
  js =~ /function homeAxis\(\) \{[\s\S]{0,400}?state\.exam = null;/
# 底部「重置视角」（↺）钉着时原来也回总轴，而且钉子还留着（"钉着却站在总轴视角"）——
# 现在钉着就重新聚焦这一场，没钉住才是整根轴
issues << '「重置视角」钉着某一场时把人踢回总轴了（第二条回总轴的路）' unless
  js.include?('function resetView()') &&
  js =~ /function resetView\(\) \{[\s\S]{0,400}?focusExam\(state\.exam\);[\s\S]{0,200}?return;/ &&
  js.include?("reset.addEventListener('click', function () { resetView();")
# 划过浮现的小卡**挪到右上角**（用户 2026-09-30）—— 2026-10-01 那张卡整体撤掉了，见上面
# "划过的一行提示"那几条（这里只留反向盯住，别再长回来）。
# 右侧那排按钮的提示**出在按钮左边**（用户 2026-09-30："它 hover 的时候出现那个字，
# 应该在他的左侧。不应该在右侧，也不应该在上面"）—— 走白板那排的方向。
issues << '右侧那排的提示没出在按钮左边（用户明确说过方向）' unless
  page.include?('[data-t3-rail] [data-t3-tip]::after {') &&
  page =~ /\[data-t3-rail\] \[data-t3-tip\]::after \{[\s\S]{0,200}?right: calc\(100% \+ 10px\);/
# 点某个考点 → **从这根柱子斜着**连到它考到的每一道题，剩下的详情写在柱子下边
#（用户 2026-10-01："柱状图直接 90 度出一条虚线……这是不对的。它应该从这条线出来……几条线，
#  它应该是斜着出现的……它代表的是我点击了这个考点，这个考点相关的那两道题。同时，这个考点下边
#  应该就会出现这两道题的具体详情"）
# 2026-10-01 收口：**一道题只留一根线**，起点一律是**柱脚**（和这一排里其它题的线同一个
# 起点、同一个方向）。用户原话："我点了知识点，弹出来那个线的方向和现在它展示的方向有些许
# 差别，你仔细核对一下它的样式有差别" —— 原来点开考点是两根：一根从柱脚牵出去（实线加粗）、
# 一根从**柱顶**斜下来（虚线），方向正好相反，同一个题点上看着就是两支箭对射。
issues << '点考点没有连到它考到的那几道题（一道题一根、从柱脚牵出去的斜虚线）' unless
  js.include?('var mine = state.nodeAt !== null && k === state.nodeAt && state.pickedQ === null;') &&
  js.include?('(mine && !pick) ? [4, 3] : null);')
issues << '又从柱顶另起了一根线（和柱脚那根方向相反，同一个题点上会看到两支箭对射）' if
  js.include?('var nTop = p(xx(nk), ndn.difficulty * 4, currentZ);')
# 画布上"亮几道"由 `pickedQ` 定、"弹哪个窗"由 `nodeAt` 定 —— 两件事各归各的：
#   · 点**某一道题**（点那个点、或点它那行「第 N 题」的字）→ 只亮这一道，但**浮窗要弹**；
#   · 点**考点**（柱顶 / 切片上的那个点）→ 它那 2~3 道题一起亮。
#（用户 2026-10-01 第一次："……现在为什么经常能点两三个？这个是不对的"；
#  第二次："我点击题目……但题目面板还是没有出现。应该点击题目也能出现。"）
issues << '点"题目相关的点"时只亮这一道的闸门没了（会连带亮出同一个考点的另外几道题）' unless
  js.include?('&& state.pickedQ === null;')
issues << '点"题目相关的点"没有弹出考点浮窗（用户 2026-10-01："应该点击题目也能出现"）' unless
  js =~ /if \(best && best\.onRow\) \{[\s\S]{0,1200}?state\.nodeAt = best\.id;/
issues << '点"切片上的考点点"没有把它的那几道题调出来（`nodeAt` 没设）' unless
  js =~ /else if \(best && best\.onSlice\) \{[\s\S]{0,900}?state\.selected = best\.id;\s*state\.nodeAt = best\.id;/
# 题号那行字本身也要能点（用户 2026-10-01："这个第几题是可以点击的。点击之后，就出来我们的考点"）
# —— 那个点太小，字比点大得多，所以字也挂进命中表。
issues << '「第 N 题」那行字不可点（应和那个点一样挂进命中表）' unless
  js.include?("dots.push({ x: lab.x, y: labY + 2, id: k, exam: pe.id, r: 8, onRow: true, qi: qi,")
# 考点浮窗里要把**这一场考到的几道题都列出来**（原来 `forEach` 只留了最后一道，
# 一个考点考了三次也只看得到一道）
issues << '考点浮窗只列了最后一道题（一个考点考了 2~3 次时少列）' unless
  js.include?("if (p.index - SPAN.from === i) { mines.push({ q: k + 1, qi: k, p: p }); }")
# 总轴时切片上那些考点点**不参与命中**（用户 2026-10-01："在总轴的时候，知识切片里面那些点，
# 我们就不让它点击了……那么小，我们肯定是优先选那个切片"）—— 板面照旧可点（点它 = 钉住这一场）。
issues << '总轴时切片上那些考点点还能点中（会抢走"点整块板"）' unless
  js.include?('if (pt.onSlice && state.exam === null) { return; }')
# 总轴时光标落在**切片的面**上 → 只认这块切片，任何"点"都得让位
# （用户 2026-10-01："在全轴模式下，鼠标只能捕捉考试切片，不能捕捉切片的考点"）。
# 为什么非要有这一条：柱顶那个考点点与切片上**同一个考点**的点同 x、同高、只差一个 z，
# 投影到屏幕上几乎重合（实测 74 个切片考点点里 61 个被判成了柱顶那个点：指着切片却锁了柱子的考点、
# 板子自己反而不亮）。修好后 74 个里 67 个认成切片、0 个认成考点。
issues << '总轴时"落在切片面上"还是被板上的考点点抢走（板子不亮、反倒锁了柱子的考点）' unless
  js.include?('if (state.exam === null && quad) { return quad; }')
# 反向：柱子下边那几行 `第 41 题 · 8 / 10` 的详情**不许长回来**（用户 2026-10-01："这个 41 题，
# 白色的 41 题，8-10。去掉就行。这个提示没用"）—— 斜线 + 圈留着，字去掉。
issues << '柱子下边那几行"第 N 题 · 得分"的详情又长回来了（用户说这个提示没用、要去掉）' if
  js.include?('var at = p(xx(nk), -3.6 - i * 3.4, currentZ);')
# 反向：原来那条"顺着 Z 轴垂直出去"的老写法不许长回来
issues << '那条"垂直 90 度出去"的老引线又长回来了' if
  js.include?("var stemZ = FUTURE_Z + 1.8;") || js.include?('p(xx(nk), 0, stemZ + i * 2.8)')
# 这一场考试是**哪一天** → 从切片底边拉一条**虚线**到时间轴上，轴上画一小道刻度 + 一个实心点。
#（用户 2026-10-01 先要的："把虚线加回来。和原来一模一样的样式……在切片底下有，其他的不变。"；
#  后来又让把**写在轴上的那行年月日**删掉："选中状态下，下表题删去" —— 那行字正好压在底部
#  时间条 / 年份刻度那一带上，跟时间条自己的日期撞在一起，反而糊。**虚线 + 刻度 + 点留着**。）
issues << '时间轴上没有把"这一场是哪一天"标出来' unless
  js.include?('function cnDate(d)') && js.include?('var zAx = zOf(axEx.day);') &&
  js.include?('line(p(maxX, 0, zAx), p(maxX + 1.4, 0, zAx), accent, 0.95, 1.8);')
issues << '少了"从切片底边拉到时间轴"的那条虚线（用户 2026-10-01："需要那条虚线""和原来一模一样"）' unless
  js.include?('var axFrom = p(axMid, 0, zAx);') && js.include?('line(axFrom, zPt, accent, 0.5, 1.2, [5, 4]);')
# **反向**：轴上那行年月日（连"放大时钳到画面边上"那套）不许长回来 —— 用户 2026-10-01 已让删掉。
issues << '轴上那行年月日又写回来了（用户 2026-10-01："选中状态下，下表题删去"）' if
  js.include?('var dLx = zPt.x - 9;') || js.include?('var dLy = Math.max(18, Math.min(h - 12') ||
  js.include?("text(cnDate(axEx.date), { x: dLx, y: dLy }, accent, dAlign, 11);")
# 反向：**日期**不许再摆到切片旁边（"只在时间轴那儿有时间就行，不需要在其他地方"）
issues << '日期又摆到切片边上去了（用户要它只在轴上）' if
  js.include?("text(dateTxt, { x: axFrom.x") || js.include?("text(cnDate(axEx.date), { x: axFrom.x")
# 浮窗正文**整块滚**（两张表都在里面）—— 否则后面那张会被挤成 0 高，"试卷不出现"（用户 2026-09-30）
issues << '浮窗正文没做成"整块滚"（两张表要一起看得见）' unless
  page.include?('data-t3-examwin-body') && page.include?('data-t3-nodewin-body') &&
  page.include?('.t3-float__body { overflow: auto; min-height: 0; }')
# 分析里那一行考点要写出"这一场考到第几题"（一个考点可能考到好几道）
issues << '分析里的考点行没有写出"考到第几题"' unless
  js.include?("put(btn, 't3-float__num', '第 ' + (qOf[row.i] || []).join('·') + ' 题');")
# 底部时间条那圈框撤掉（用户 2026-09-30："这个时间轴，它外面那个框能不能去掉？
# 你现在这样就显得好大、好蠢"）
issues << '时间条外面那圈框又回来了（用户已让去掉）' unless
  page =~ /\.t3-timebar \{[\s\S]{0,360}?background: none; border: 0; box-shadow: none;/
# 玻璃板：按难度分层切刻度 + 划到板上那个点时圈住它（用户 2026-09-30："在这个玻璃板上会切一些
# 难度……它在上面会分一二三四"、"它不是小手，可能是一个小圆圈，并锁定某个点"）
issues << '玻璃板上没有按难度分层切刻度（一二三四五那五条）' unless
  js.include?('line(p(xx(a), lv * 4, z), p(xx(b), lv * 4, z), levelColor(lv), 0.26);') &&
  js.include?("text(String(lv), { x: mid.x - 7, y: mid.y + 4 }, levelColor(lv), 'right', 10);")
issues << '划到板上的那个点时没有锁定圈 / 没有就地写考点名字' unless
  js.include?('if (state.hoverSlice && state.hovered === k && hov && state.hoverPt &&') &&
  js.include?("dots.push({ x: pt.x, y: pt.y, id: k, exam: e.id, r: 5, onSlice: true,") &&
  js.include?(": (best && (best.quad || onRow || best.paperPage !== undefined)) ? 'pointer' : '';")
# 同一考点的**几个点各自只锁自己那一个**（用户 2026-10-01 改成一题一个点之后）——
# 不按 `state.hoverPt` 收的话，同一个考点的几道题会同时套圈、同时写出好几行字，糊成一片。
issues << '划到一个切片点时，同一个考点的其它点也一起套圈了（应只锁光标底下那一个）' unless
  js.include?('Math.abs(pt.x - state.hoverPt.x) < 0.5 && Math.abs(pt.y - state.hoverPt.y) < 0.5')

# 底部那三颗数据图层（用户 2026-09-30："照搬参照里的 学习进度 / 成绩变化 / 投入学习 三个模块，
# 在 3D 数轴里展示对应的数据图层，按钮放在底部"）
issues << '底部少了数据图层按钮（data-t3-progress / data-t3-scores / data-t3-effort）' unless
  page.include?('data-t3-progress') && page.include?('data-t3-scores') && page.include?('data-t3-effort')
issues << '数据图层按钮没挂在底部工具条上' unless
  page[/data-t3-progress[\s\S]{0,600}?data-t3-scores/] &&
  page[/data-t3-scores[\s\S]{0,600}?data-t3-effort/]
# 「学习进度」= 累计完成 对 计划：实际数"首学"过的格数、计划数 `plannedAt`（两条都是真数据）
issues << '没有"学习进度"图层（应画 累计完成 对 计划 两条线）' unless
  js.include?('function buildProgress()') &&
  js.include?("if (rec.events[k].kind === 'first') { first = rec.events[k].at; break; }") &&
  js.include?('var p = rec && rec.plannedAt ? parseDay(rec.plannedAt) : null;') &&
  js.include?("if (state.layers.progress && state.view !== 'axis') {")
issues << '学习进度的两条线没有分开画（实际实线 / 计划虚线）' unless
  js.include?('line(prevA, pa, accent, 0.85, 1.8);') &&
  js.include?('line(prevP, pp, muted, 0.6, 1.2, [4, 3]);')
issues << '学习进度没画成"一块图板"（应与成绩变化同一块形制：板面 + 学年竖格）' unless
  js.include?('var pB = timeBoard(-42, -6);')
issues << '学习进度的纵轴刻度没与数轴的格数对齐（应取整步长、顶上一格 = N）' unless
  js.include?('var pStep = [10, 20, 25, 50, 100, 200].filter(function (s) { return N / s <= 5; })[0] || 10;') &&
  js.include?('pTicks.push(N);')
# 「成绩变化」= 每场考试的得分率折线：得分率由这张卷子的 Σ得分 ÷ Σ满分 算出来。
# 形态（用户 2026-09-30）：**正对观众的一块图板**（横轴时间、纵轴得分率），
# 不做那种在盒子里穿来穿去的线 —— 图板固定在靠前那一侧（z 不变）、两块板并排。
issues << '没有"成绩变化"图层（应画每场考试的得分率折线）' unless
  js.include?("score: full ? Math.round(got / full * 100) : 0,") &&
  js.include?('if (state.layers.scores && state.view !== \'axis\') {') &&
  js.include?('var pt = p(sB.x(e.day), sB.y(e.score / 100), sB.z);')
issues << '两块图板没有共用同一个形制（timeBoard：板面 + 边框 + 学年竖格）' unless
  js.include?('function timeBoard(l, r) {') &&
  js.include?('var pts = [p(l, b, z), p(r, b, z), p(r, b + high, z), p(l, b + high, z)];') &&
  js.include?('polygon(pts, paper, 0.9);') &&
  js.include?('line(p(xw(tms), b, z), p(xw(tms), b + high, z), muted, 0.35);') &&
  js.include?('var sB = timeBoard(6, 42);')
issues << '成绩变化的点没接回考试（点一下应能钉住那一场）' unless
  js.include?("dots.push({ x: pt.x, y: pt.y, id: -1, exam: e.id, r: 8 });")
# 「投入练习」= 从学习轨迹里按每两周数题量（首学 = 新题，复习 / 纠错 = 复做）—— 不编时长
issues << '没有"投入练习"图层（应从轨迹里按每两周数题量）' unless
  js.include?('function buildEffort()') && js.include?('var SPAN_MS = 14 * DAY;') &&
  js.include?("if (ev.kind === 'first') { buckets[b].first += 1; } else { buckets[b].redo += 1; }")
issues << '投入练习层没有画在地面左端那条带上' unless
  js.include?("if (state.layers.effort && state.view !== 'axis') {") &&
  js.include?('polygon([p(bx0, 0, ez), p(bx1, 0, ez), p(bx1, hFirst, ez), p(bx0, hFirst, ez)], accent, 0.55);')

# 三根轴**各自缩放**（用户 2026-10-01："时间是可以缩放的，同样的，X 轴知识点也可以缩放，
# Y 轴也可以缩放，Z 轴也可以缩放"＋"如果鼠标焦点放在时间轴上，就可以缩放"）：
#   ① 每根轴一个倍率；② 投影时按各自倍率拉，**取景仍按没缩放的盒子算**
#   （不然"把时间拉长"会被取景原样抵消，屏幕上一点都不变长）；
#   ③ 光标压在哪根轴上 → 滚轮只缩那一根；④ 锚点（光标底下那一格）原地不动。
issues << '三根轴没有各自的缩放倍率（应 axis.x / axis.y / axis.z）' unless
  js.include?('axis: { x: 1, y: 1, z: 1 },') && js.include?('state.axis.x = 1;')
issues << '投影没按各轴的倍率拉（应 projectWith(sx, sy, sz, …)）' unless
  js.include?('function projectWith(sx, sy, sz, x, y, z)') &&
  js.include?('function project(x, y, z) { return projectWith(axisS.x, axisS.y, axisS.z, x, y, z); }')
issues << '取景跟着轴缩放一起放大了（那样把时间拉长等于没拉）' unless
  js.include?('function projectBase(x, y, z) { return projectWith(1, 1, 1, x, y, z); }') &&
  js.include?('corners.push(projectBase([-50, 50][cx], [0, 22][cyy], [0, FRAME_Z][czz]));')
issues << '滚轮压在轴上时没有"只缩那一根"（应走 axisZoom + axisUnder）' unless
  js.include?('function axisUnder(mx, my)') && js.include?("case 'axisZoom': {") &&
  js.include?("dispatch({ type: 'axisZoom', axis: axHit.axis, anchor: axisAnchor(axHit),") &&
  js.include?('value: state.axis[axHit.axis] * Math.exp(-e.deltaY * 0.0018)')
issues << '轴缩放没有"光标底下那一格原地不动"（应量缩放前后落点再补平移）' unless
  js.include?('state.panX += before.x - after.x;') && js.include?('state.panY += before.y - after.y;')
issues << '轴缩放的倍率没夹住（应 0.4 ~ 4）' unless
  js.include?('state.axis[kk] = Math.max(0.4, Math.min(4, a.value));')
issues << '压在某根轴上时那根轴没被点亮 / 没报出名字与倍率' unless
  js.include?('function axisUnder(mx, my)') && js.include?('axisSegs[state.axisHot]') &&
  js.include?("AXIS_NAME[state.axisHot] + ' · 滚轮缩放 '")
issues << '轴上没有"光标压上就是缩放"的光标（应 zoom-in）' unless
  js.include?("canvas.style.cursor = axKey ? 'zoom-in'")
# 「点」与「轴」抢手底下那一块时：**8px 内先给点**（用户 2026-10-01 定的口径）——
# 底下那一排题号点正好画在时间轴轴尾那一条带上，轴的 12px 判定把它们整排抢走（实测 7 个划不到）。
issues << '轴把底下那一排题号点全抢走了（应"点离手底下 8px 以内时轴让位"）' unless
  js =~ /if \(axKey && best && !best\.quad && typeof best\.x === 'number'\) \{/ &&
  js.include?('if (pd <= 8) { axKey = null; }')
# 反向：时间轴那条"全局缩略条"不许长回来（用户 2026-10-01："你搞了一个缩略的轴，也就是放大
# 缩小的轴。这个不需要，直接去掉就行"）
issues << '时间轴那条全局缩略条又长回来了（用户 2026-10-01 已让去掉）' if
  page.include?('data-t3-scalebar') || page.include?('.t3-scalebar') ||
  js.include?('syncScaleBar') || js.include?('buildScaleBar')
# 底部那颗**「适配」**（用户 2026-10-01："在底部增加一个适配按钮，放在放大缩小的减号和加号边上。
# 点击这个按钮，就是把整个时间轴都适配画面。如果点击'当前'或者点击某个考点，也就是某一段，
# 也要适配这段"）—— 摆在 zoom-in 后面；三档口径：整根轴 / 这一场 / 这个考点。
issues << '底部少了「适配」按钮（data-t3-fit，应在放大缩小旁边）' unless
  page =~ /data-t3-zoom-in[\s\S]{0,400}?data-t3-fit/ && js.include?("el('[data-t3-fit]')")
issues << '「适配」没有三档口径（整根轴 / 钉住的那一场 / 点开的那个考点）' unless
  js.include?('function fitView()') && js.include?('if (state.exam !== null && examById(state.exam)) {') &&
  js.include?('if (state.nodeAt !== null && NODES[state.nodeAt]) {') &&
  js.include?('var FIT_HALF = 8;') && js.include?('fitBtn.addEventListener')
# **「适配」不许再动用户自己调好的东西**（用户 2026-10-01："点击切片，我们调了它，放大缩小之后，
# 再点击下面的自适应的时候，不要恢复到原来的那种角度……保留现在的 XYZ，和我们自己设定的一些值
# 之后，在这个框架内，充满屏幕。它的那个角度也不需要变。"）——
# 反向守线：`fitView()` 里不许出现"三根轴归位"，也不许出现写死的默认角度。
issues << '「适配」又把三根轴的拉伸归位了（用户要"保留现在的 XYZ"）' if
  js =~ /function fitView\(\) \{[\s\S]{0,1200}?state\.axis\.[xyz] = 1;/
issues << '「适配」又把角度掰回默认值了（用户要"角度也不需要变"）' if
  js =~ /function fitView\(\) \{[\s\S]{0,1200}?yaw: -0\.08|function fitView\(\) \{[\s\S]{0,1200}?pitch: 0\.70/
issues << '「适配」没有"按当前拉伸量出该多倍"（拉长过之后"整根轴进画面"就装不下，也不该再归位）' unless
  js.include?('function fitZoom()') && js.include?('zoomFitAll: zoomFitAll') &&
  js.include?('zoom: fitZoom(), yaw: state.yaw, pitch: state.pitch')
# 从「适配」进 focusExam 时要**保留角度**（点住那块板那一下才回默认俯视角）
issues << '「适配」适配这一场时把角度掰回默认了（没传 keepAngle）' unless
  js.include?('focusExam(state.exam, true);')
# 右侧竖排那颗**「回到总轴」**（用户 2026-10-01："右边现在有两个按钮了。你再加一个，就是总轴……
# 意思是回到总轴。点击之后……我们再回到总轴"）—— 松开钉子 + 铺满整根轴，角度与拉伸都保留。
issues << '右侧竖排少了「回到总轴」那颗按钮（data-t3-rail-home）' unless
  page =~ /data-t3-rail-home/ && page =~ /data-lucide="axis-3d"/
issues << '「回到总轴」没有接到动作上（应松开钉子 + 铺满整根轴）' unless
  js.include?('function homeAxis()') &&
  js.include?('railHome.addEventListener(\'click\', homeAxis);') &&
  js =~ /function homeAxis\(\) \{[\s\S]{0,500}?state\.exam = null;[\s\S]{0,400}?zoom: fitZoom\(\)/
# 工具条上这三颗**换过图标**（用户 2026-10-01："透视和正交按钮图标换一下；考试切片的图标换一下；
# 适配画面图片换一下"）——
#   投影：scan → **move-3d**（三根轴带箭头，读得出"空间 / 投影方式"）
#   切片：calendar-days → **square-stack**（叠起来的两片，正好像那摞玻璃板）
#   适配：maximize → **maximize-2**（四角向外 = "把内容撑满、一眼看全" —— 与白板「适应内容」、
#         平面时间轴「适配」**同一个动作同一个图标**，见 verify_whiteboard.rb 里那条约定）
issues << '「投影」按钮的图标不是 move-3d' unless
  page =~ /data-t3-proj[\s\S]{0,200}?data-lucide="move-3d"/
# **反向**：它不许再去开关"场景里那些玻璃板" —— 那个 `layers.exams` 整条已经撤掉（板一直在，
# 有多少由底部时间条决定，见 §2.11 67 与 68 节）。
issues << '考试切片又去开关场景里的玻璃板了（考试切片不再是图层开关 —— 板一直在）' if
  js.include?('layers.exams') || js.include?('exams: true,')
issues << '考试切片又被图层开关挡住了（应只看平面视角那一档）' unless
  js.include?("if (state.view !== 'axis') {") &&
  !js.include?("if (state.layers.exams && state.view !== 'axis') {")

# ---------- 「考试切片选择器」那条整条已撤（用户 2026-10-01）----------
# 用户："考试切面选择器按钮和它左边的选择切片 删除"。
# 原本这条是"右侧一颗按钮 + 它左边一摞楼层"：按钮只管那摞楼层显不显示，楼层一片 = 一场考试。
# 现在**连按钮带楼层一起删**，一场考试要挑就点**底部时间条上那排小圆点**，或者直接在场景里点那块玻璃板。
# 下面这些都是**反向**守线：谁再把它长回来就报出来。
issues << '「考试切片选择器」那颗按钮又长回来了（用户已让删掉）' if
  page.include?('data-t3-rail-picker') || js.include?("el('[data-t3-rail-picker]')") ||
  js.include?('pkBtn')
issues << '那摞"楼层"又长回来了（data-t3-floors）' if
  page.include?('t3-floors') || js.include?('floorsRef') || js.include?('layoutFloors') ||
  js.include?('syncFloors') || js.include?('floorExams') || js.include?('state.shelf')
issues << '苹果那种横向画廊又长回来了（t3-shelf 已撤，不许留渣）' if
  page.include?('t3-shelf') || js.include?('shelfRef') || js.include?('layoutShelf') ||
  js.include?('state.shelfAt')
# 楼层挪回右半边时留下的那条"浮窗往下让一格"的规则，也不许回来
issues << '浮窗又在为那条楼层让位了（楼层已整条撤掉）' if
  page =~ /\[data-t3-floors\]:not\(\[hidden\]\) ~ \.t3-float/
# `pickExam` 留着 —— **时间条上那排小圆点**还靠它"点一下选中那一场"
issues << 'pickExam 没有真的钉住这一场（应设 state.exam + focusExam）' unless
  js =~ /function pickExam\(id, quick\) \{[\s\S]{0,600}?state\.exam = id;[\s\S]{0,500}?focusExam\(id, false, quick \? 190 : undefined\);/
# 划过去那一档的短过渡留着（`camTo` 认单次指定的 dur）
issues << '相机过渡不接受单次指定的时长' unless
  js.include?('camAnim.dur = to.dur || 360;')

# ---------- 时间条上那排"考试小圆点"（用户 2026-10-01）----------
# "有考试的地方应该有那个小圆点，在上面，小圆点表示这个地方有考试"＋"我们拖动的时候，
#  这个小圆点也会同步生成，类似场景里拖动的时候"＋"这个小按键可以选择"。
issues << '时间条上没有那排考试小圆点（data-t3-marks）' unless
  page.include?('data-t3-marks') && page.include?('class="t3-timebar__marks"') &&
  js.include?('function syncMarks()')
# **点就压在滑杆那条线上**（用户 2026-10-01 后补："点放在数轴上吧"）——
# 原来是浮在滑杆上方 19px 那一条，跟左边"Z · 学习时间 / 日期"挤在同一带，糊。
# 容器 `top: 0`、点 `top: -2px`（点直径 7px，中心正好落在滑杆那条线上）；
# 挨太近而"岔开"的那个只往上挪 10px，还是贴着线那一带。
issues << '考试小圆点又浮到滑杆上方去了（用户要它压在数轴上）' unless
  page =~ /\.t3-timebar__marks \{[\s\S]{0,200}?top: 0; height: 0;/ &&
  page =~ /\.t3-timebar__mark \{[\s\S]{0,120}?top: -2px;/
issues << '考试小圆点又改成浮在滑杆上方了' if
  page.include?('top: -19px;') || js.include?("b.style.bottom = (row * 9)")
issues << '考试小圆点没按"那天在整段时间里的比例"落位（应走 tOf + 拇指行程的 calc）' unless
  js.include?('var pct = tOf(e.day) * 100;') &&
  js.include?("'calc(var(--t3-thumb) / 2 + (100% - var(--t3-thumb)) * ' + (pct / 100).toFixed(4) + ')'")
# **拖时间条时同步生成**：与场景同一把尺子（只画到"当前那一天"），而且 `syncTimebar` 里要真的调它
issues << '拖时间条时那排小圆点没跟着长（syncTimebar 里没调 syncMarks）' unless
  js =~ /function syncTimebar\(\) \{[\s\S]{0,300}?syncMarks\(\);/ &&
  js =~ /EXAMS\.filter\(function \(e\) \{ return e\.day <= state\.dayMs; \}\)\n\s+\.sort\(function \(a, b\) \{ return a\.day - b\.day; \}\);/
# **点一下就能选**（"这个小按键可以选择"）
issues << '考试小圆点点不动（应点了就选那一场）' unless
  js =~ /marksBox\.addEventListener\('click',[\s\S]{0,400}?pickExam\(id\);/
# **划过那个小圆点 → 场景里对应那块考试切片亮起来**（用户 2026-10-01："在全轴显示的状态下，
# 鼠标划过下面数轴上的点的时候，考试切片对应的选中状态表示提示"）—— 走 `state.hoverExam`
# （与"在场景里划过那块板"**同一个状态、同一个效果**），只是"提示"一下：**不动相机、也不钉住**。
issues << '划过时间条上那个小圆点，场景里那块切片没有"提示"（应设 state.hoverExam）' unless
  js =~ /marksBox\.addEventListener\('pointerover',[\s\S]{0,320}?state\.hoverExam = id;/
issues << '那个"提示"移开之后没清掉（会一直亮着）' unless
  js =~ /marksBox\.addEventListener\('pointerout',[\s\S]{0,520}?state\.hoverExam = null;/ &&
  js =~ /marksBox\.addEventListener\('pointerleave',[\s\S]{0,200}?state\.hoverExam = null;/
# 从一个点挪到另一个点不该闪断（`relatedTarget` 还在这排里就别清）
issues << '在两个小圆点之间滑会闪断（应按 relatedTarget 判断该不该清）' unless
  js =~ /if \(to && marksBox\.contains\(to\)\) \{ return; \}/
issues << '那个"提示"顺手动了相机或把它钉住了（只该亮一下，不该飞过去 / 不该钉住）' if
  js =~ /marksBox\.addEventListener\('pointerover',[\s\S]{0,320}?(pickExam\(|camTo\()/
# 场景里那块板得真的认这个状态（`hov`）
issues << '场景里的板没认这个"提示"状态（应看 state.hoverExam 决定 hov）' unless
  js.include?('var hov = state.hoverExam === e.id;')
# 同一天两场（E8 / E9）横坐标重合 —— 必须一上一下岔开，不然上面那个把下面那个盖死
issues << '挨得近的两场考试叠成一个点（同一天的会点不着）' unless
  js.include?("b.style.top = (row ? -10 : -2) + 'px';") && js.include?('row = (pct - lastPct < 1.4) ? (row ? 0 : 1) : 0;')

# ---------- 「清爽模式」（用户 2026-10-01）----------
# "然后左边，还有下边……就给隐藏了……这个按钮如果是隐藏的话，我们就永远回不来了。
#  我们在这个右边，把右边这个按钮加一个'清爽模式'……右边这一排按钮是不会消失的。"
issues << '右侧竖排少了「清爽模式」那颗（data-t3-rail-clean）' unless
  page.include?('data-t3-rail-clean') && js.include?("el('[data-t3-rail-clean]')")
issues << '「清爽模式」没有接到动作上（应切 state.clean 并同步到 <html> 上）' unless
  js =~ /railClean\.addEventListener\('click'[\s\S]{0,200}?state\.clean = !state\.clean;/ &&
  js.include?("root.setAttribute('data-t3-clean', state.clean ? 'on' : 'off');")
issues << '「清爽模式」收走的名单不对（应是左边的导航 + 底部的工具条 / 时间条）' unless
  page.include?('html[data-t3-clean="on"] .ide-rail { transform: translateX(-100%); }') &&
  page.include?('html[data-t3-clean="on"] .t3-dock {') &&
  page.include?('html[data-t3-clean="on"] .t3-timebar {')
# 左边那条 transition **必须带 `html` 前缀**（用户 2026-10-01："清爽模式 要底部和左边栏目都要动画隐藏"）——
# `ide.css` 在本页 `<style>` **之后**加载，同优先级的 `.ide-rail { transition: width, box-shadow }` 会把
# 整条 `transition` 盖掉，于是 `translateX(-100%)` 成了**瞬移**而不是滑走。
# 实测：修前本页 `.ide-rail` 算出来是 `width, box-shadow / 0.16s, 0.16s`；
# 修后是 `transform, width, box-shadow / 0.26s, 0.16s, 0.16s`（width / box-shadow 一起写上，hover 展宽动画照旧）。
issues << '清爽模式收左边导航时是"瞬移"不是滑走（.ide-rail 那条 transition 没带 html 前缀，被 ide.css 盖掉了）' unless
  page =~ /html \.ide-rail \{[\s\S]{0,220}?transform 260ms/ &&
  page =~ /html \.ide-rail \{[\s\S]{0,260}?width 160ms/ &&
  page =~ /html \.ide-rail \{[\s\S]{0,260}?box-shadow 160ms/
# 反向：**右侧那一竖排不许进收走的名单**（它要是也没了，就再也点不回来了 —— 用户特别点过这一条）
issues << '「清爽模式」把右侧那一竖排也收走了（点了就再也回不来）' if
  page =~ /html\[data-t3-clean="on"\][^{]*\.t3-rail/
issues << '「清爽模式」那颗按钮的提示没有跟着状态翻（开着时该写"恢复界面"）' unless
  js =~ /state\.clean \? '恢复界面（回到带导航的样子）' : '清爽模式（收起左边的导航与底下的工具条）'/
issues << '「适配画面」的图标不是 maximize-2（应与白板「适应内容」同一个，别用 scan / maximize）' unless
  page =~ /data-t3-fit[\s\S]{0,200}?data-lucide="maximize-2"/


# ---------- 6. 无障碍与降级 ----------
issues << '3D 页的工具条没有 role="toolbar"' unless page.include?('role="toolbar"')
issues << '分析面板没有 aria-label' unless page =~ /data-t3-examwin[^>]*aria-label="[^"]+"/
issues << '3D 页少了"尊重减少动效"的兜底' unless
  page.include?('prefers-reduced-motion')
issues << '考试浮窗没有从钉住的那一场填内容（分析 + 试卷同一页 / 收起）' unless
  js.include?('function syncReport()') && js.include?('data-t3-examwin-qlist') &&
  js.include?('function onFloatRowClick(ev)') && js.include?('state.examWin = false;')
issues << '浮窗里点一行没有落到轴上的那一格' unless
  js =~ /state\.selected = Number\(btn\.getAttribute\('data-t3-float-row'\)\);/
# 「这份试卷」= 电子卷：**按卷面逐题列**（用户 2026-09-30："点击一下就会出这次考试存的所有的试题……
# 每张考卷不是存照片，而是存一个数据"）
issues << '「这份试卷」那一页不是按卷面逐题列的（题号 · 考点 · 难度 · 满分 / 得分 · 对错）' unless
  js.include?('shown.paper.forEach(function (p, i) {') &&
  js.include?("put(row, 't3-float__num', p.score + ' / ' + p.full);") &&
  js.include?('var bad = p.score * 5 < p.full * 3;')

# ---------- 7. 原卷（扫描件）——「查看原题」（用户 2026-10-01）----------
# 用户："这个题错了，然后就框出来……让学生给他一个错因，如果学生认可，就让他点一下，
# 或者说默认是认可，除非他自己再叠加一些原因"＋"当我点击这道题，我可以加一个按钮了，
# 查看原题、查看原卷。当点击这个按钮时候，啪，我们就出来这张卷子了"。
scan = read('assets/js/exam-scan.js')
# **这一层是"后台"的位**：卷名 / 正反面 / 框的坐标全从 `WK_EXAM_SCAN` 拿，
# 3D 页里一个坐标都不许编（将来后台做好，把 exam-scan.js 换成 fetch 就行）。
issues << '原卷的数据没走 WK_EXAM_SCAN（那是后台批卷接口的位）' unless
  js.include?('var SCAN = window.WK_EXAM_SCAN || null;')
issues << '原卷那一层没有"后台接口"的样子（exam-scan.js 要导出 of / boxOf）' unless
  scan.include?('function of(examId)') && scan.include?('function boxOf(examId, q)') &&
  scan.include?('window.WK_EXAM_SCAN = { of: of, boxOf: boxOf, scans: SCANS };')
issues << '框的坐标被写进 3D 页了（坐标只许待在 exam-scan.js 里）' if
  js =~ /x:\s*13\.5\s*,\s*y:\s*19\.5/ || page.include?('13.5%')
# 框用**百分比**：换图 / 压缩 / 裁边都不用重算（后台出的也应该是同一套）。
issues << '框的坐标不是百分比（换个尺寸的图就要全部重算）' unless
  scan =~ /x:\s*13\.5,\s*y:\s*19\.5,\s*w:\s*33,\s*h:\s*8\.5/ &&
  js.include?("d.style.left = o.x + '%';") && js.include?("d.style.width = o.w + '%';")
issues << '原卷的框没铺在图上那一层里（图一缩放框就飘）' unless
  page.include?('.t3-scan__boxes { position: absolute; inset: 0; pointer-events: none; }')
# 两张图要在位（演示那一份是真实拍的五上第一单元卷）
issues << '原卷那两张图不在位（assets/img/exams/）' unless
  File.exist?(File.join(ROOT, 'assets/img/exams/wushang-u1-p1.jpg')) &&
  File.exist?(File.join(ROOT, 'assets/img/exams/wushang-u1-p2.jpg'))
# 「查看原题」= 点住**某一道题**之后才出现，而且那一道在原卷上要有框（后台只标了错题）
issues << '「查看原题」不是"点住某一道题之后才出现"（应看 state.pickedQ + 框在不在）' unless
  js =~ /var hasBox = !!\(SCAN && state\.pickedQ !== null && SCAN\.boxOf\(state\.exam, state\.pickedQ \+ 1\)\);/
# 学生那一侧：**默认就是认可**，想补就从共享词表里叠（词表只有 timeline-data.js 那一份）
issues << '原卷里"再叠一个原因"没有展开共享词表（应取 WK_LEARNING.causes）' unless
  js =~ /if \(state\.scanPick\) \{[\s\S]{0,260}?\(\(L && L\.causes\) \|\| \[\]\)\.forEach/
issues << '原卷里自己又抄了一份错因词表（词表只有 timeline-data.js 那一份）' if
  scan =~ /概念没懂|公式记错|算错|粗心漏写/
issues << '学生认领默认成了"没认可"（用户要的是默认认可）' unless
  js.include?(": (ack.ok ? '学生认可' : '默认认可');")
issues << '学生对错因的认领没有落本机（应走 wkmath.exam.scan.v1 那一份）' unless
  js.include?("var SCAN_KEY = 'wkmath.exam.scan.v1';") &&
  js =~ /scanAckSet[\s\S]{0,320}?localStorage\.setItem\(SCAN_KEY/

# ---------- 8. 实物卷：把这一场的两张卷子立到 3D 里去（用户 2026-10-01）----------
# 用户："右边加一个按钮，前提是尤且仅有他选择了单个的试卷之后，然后这个按钮才出现，
# 表示是我们这个卷子、实物的这个卷子。然后点击了之后……在立体空间当中也是竖着两张卷子，
# 一个是正面，一个是反面……然后审的那个题，各个的题目，然后就直接对应那个点。
# 点击了之后，然后这张卷子就可……在这个屏幕当中出现，平整地展开。"
issues << '「实物卷」那颗按钮不见了（右侧竖排里要有它，图标 file-image）' unless
  page =~ /data-t3-rail-paper[\s\S]{0,240}?data-lucide="file-image"/
# 前提：**只有钉住单个试卷之后才出现**（用户："尤且仅有他选择了单个的试卷之后"）
issues << '「实物卷」那颗按钮不是"钉住某一场之后才出现"' unless
  js =~ /pBtn\.hidden = !pHas;/ && js =~ /pSep\.hidden = !pHas;/
# 还得再收一道（用户 2026-10-02："我点击之后没有反应"）：钉住的这一场**得真有那张原卷**才给，
# 否则就是一颗点了没反应的死按钮（演示阶段 `WK_EXAM_SCAN.of` 只认 E13）。
issues << '「实物卷」那颗按钮在没原卷的那一场也亮着（点了没反应的死按钮）' unless
  js =~ /var pHas = !!\(shown && SCAN && SCAN\.of\(state\.exam\)\);/
# **默认不显示**（用户："默认是不显示的，可以点击之后，然后再显示"）
issues << '实物卷默认就立起来了（初值必须是 false —— 点了那颗按钮才显示）' unless
  js =~ /paper3d: false,/
# 竖着**两张**（正面 / 反面），照照片自己的长宽比
issues << '立体里那两张卷子没有按"正面 / 反面"两张画' unless
  js.include?('var pgList = paperData.pages.slice(0, 2);') &&
  js.include?("return (t ? t.ar : 2.2211) * SHEET_H;")
# 贴图要**剖格做仿射**：canvas 2D 没有四边形贴图，整张直接 drawImage 会贴不上
issues << '实物卷的贴图没有剖格（canvas 2D 贴不了四边形，得 clip + transform 一格一格来）' unless
  js.include?('function drawTexCell(tex, u0, v0, u1, v1, d) {') &&
  js =~ /drawTexCell\(tex, u0, v0, u1, v1, \[/
# 贴图要缩一份离屏的（原图 2843×1280 每帧剖格太重）
issues << '实物卷直接拿原图当纹理（要先缩到离屏 canvas 一份）' unless
  js =~ /var tw = 900;/ && js.include?('paperTex[file] = { cv: cv, w: tw, h: th, ar:')
# 卷面上批出来的错题要圈红框，并从框心牵一根线到**场景里那个考点点**
issues << '实物卷上没有把错题圈出来 / 没牵到对应的考点点' unless
  js =~ /line\(pt, rf\[\(k2 \+ 1\) % 4\], weak, on \? 1 : 0\.75/ &&
  js =~ /var tgt = p\(xx\(kk\) \+ blockOffset\(nd, item\.card\), nd\.difficulty \* 4, zOf\(pinnedInfo\.day\)\);/
# 点那张卷子 = **平整地展开**（打开平面那一层，展开点中的那一页）
issues << '点立体里那张卷子展不开（应 openScan(null, best.paperPage)）' unless
  js =~ /best\.paperPage !== undefined\) \{\n\s+\/\*[\s\S]{0,420}?openScan\(null, best\.paperPage\);/
# 命中要用**当帧**的投影（`state.paperHit` 每帧重记），否则转过视角就点不中
issues << '实物卷的命中四边形不是每帧重记的（转视角后会点不中）' unless
  js =~ /state\.paperHit = \[\];\n    var paperData = / &&
  js.include?('state.paperHit.push({ page: si, quad: [dTL, dTR, dBR, dBL] });')
# 平面视角（`axis`）里不许立卷子
issues << '平面视角里也把实物卷立起来了（那里是 2D，立不住）' unless
  js.include?("var paperData = (state.view !== 'axis' && state.paper3d && pinnedInfo && SCAN)")
# 立场（用户 2026-10-02 改的口径）：**不再摞在切片头顶**，而是"浮在空中"（切片高 21，它得远低于那个）、
# 并且**往过去挪 2.5 年**摆到另一个日期格上（E13 2025-07 → 2023 那一格）——
# 原话："他是立在上面，这是不对的……应该是往后。大约位置在 2023 年那地儿。
# 你可以把它理解为是 2023 年的其中一个切片位置。这样它这个空间关系就可以拉得开。
# ……它每一次考试基本上就和它拉开大约两年或者三年的距离""它是浮在空中，稍微浮在空中。"
# （后来又说"我还可以再往上再往上来一点" → 2 → 8。）
issues << '实物卷又摞回切片头顶去了（用户 2026-10-02 已改成"浮在空中"）' unless
  js =~ /var SHEET_BOTTOM = ([1-9]|1[0-4]);/
issues << '实物卷没按"往过去挪两三年"摆到另一个日期格上（应走 PAPER_BACK_MS）' unless
  js.include?('var zPaper = zOf(pinnedInfo.day - PAPER_BACK_MS);') &&
  js =~ /var PAPER_BACK_MS = 2\.5 \* 365\.25 \* DAY;/
# 透明度（用户 2026-10-02："默认设置它，这个是半透明的这个状态。然后鼠标滑上去的时候，它再显示
# 透明度百分之百……大约是 80% 吧，你就直接定好，默认 80%，鼠标滑上去的时候 100%"）——
# 目的是"不挡住"后面的柱子 / 点。三处得同时在场：常量、按 hover 取 100%、hover 里真的算出压没压上。
issues << '实物卷没有"默认 80% 半透明"（应 SHEET_ALPHA = 0.8）' unless
  js =~ /var SHEET_ALPHA = 0\.8;/
issues << '实物卷鼠标压上去没有变 100%（应 `state.hoverPaper ? 1 : SHEET_ALPHA`）' unless
  js.include?('var alpha = state.hoverPaper ? 1 : SHEET_ALPHA;')
issues << '没算出"鼠标压没压在实物卷上"（应 hover() 里走 hitPaper 存进 state.hoverPaper）' unless
  js.include?('var overPaper = !!hitPaper(mx, my);') &&
  js.include?('state.hoverPaper = overPaper;') &&
  js.include?('hoverPaper: false,')

puts "3D 页体检：画布 / 3D 开关 / 读数 / 原型内核（投影·取景·不夹角度·难度层·考试切片）/ 数据适配 / 分析面板 / 原卷 逐条核对"
puts issues.empty? ? '时间轴 3D 页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
exit(issues.empty? ? 0 : 1)
