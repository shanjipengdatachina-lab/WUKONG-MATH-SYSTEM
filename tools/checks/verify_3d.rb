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
issues << '3D 页没有读数（划过哪一格读哪一格）' unless
  page.include?('data-t3-now') && page.include?('data-t3-sub')
issues << '3D 页没有左上角"这一轴是谁的"' unless page.include?('data-t3-who')
# 图例 2026-09-30 先撤掉了（用户："先去掉这个什么首学、复习、纠错、一次考试、课程计划线，
# 把这个去掉。我们一个个的来做"）—— 所以这里不再要求它存在，也不许悄悄长回来。
issues << '3D 页的图例又加回来了（用户要求先撤掉、一个个来做）' if page.include?('t3-legend')
issues << '3D 页没有回平面时间轴的入口（回不去 = 死胡同）' unless
  page.include?('href="timeline.html"')
issues << '平面那页没有 3D 入口（用户点不到这个视图）' unless
  flat.include?('href="timeline-3d.html"')
# 考试分析面板（用户 2026-09-30："每个考试的面……点击之后……弹出一个面板……出这次考试的分析报告"）
issues << '3D 页没有考试分析面板（点住一场考试要弹出这一场的分析报告）' unless
  page.include?('data-t3-report') && page.include?('data-t3-report-list') &&
  page.include?('data-t3-report-close') && page.include?('data-t3-report-stats')
# 工具条：3D/平面 · 透视/正交 · 柱/曲线 · 着色 · 考试层 · 缩小/读数/放大 · 重置 · 帮助 · 回平面
#（难度层 2026-09-30 从工具条搬走了 —— 它现在是**右侧那排竖按钮**，见下面第 5c 段）
%w[data-t3-toggle data-t3-proj data-t3-render data-t3-color data-t3-exams
   data-t3-zoom-out data-t3-zoom data-t3-zoom-in data-t3-reset data-t3-help-btn].each do |k|
  issues << "3D 页工具条缺 #{k} 这个按钮" unless page.include?(k)
end
# 工具条照白板：**只有图标**，汉字说明 hover 时才出（用户 2026-09-30："底部按钮参考白板的样子，
# 汉字解释 hover 的时候出现"）。所以按钮上不许再挂常显的汉字标签，tip 必须齐。
issues << '工具条按钮上又挂了常显的汉字（应只有图标，汉字走 data-t3-tip 在 hover 时出）' if
  page.include?('t3-dock__label')
issues << '工具条按钮没有 hover 气泡（每个按钮都要有 data-t3-tip）' unless
  page.scan(/<button[^>]*t3-dock__btn[^>]*>/).all? { |tag| tag.include?('data-t3-tip=') }
# 划过浮现的小卡（照参照原型那个 hover 气泡；用户："知识点划过，出现考试的考点"）
issues << '没有"划过浮现的小卡"（data-t3-hover）' unless page.include?('data-t3-hover')
issues << '划过的小卡没有在 hover 时填内容（syncHoverCard / .show）' unless
  js.include?('function syncHoverCard(n)') && js.include?("box.classList.add('show')") &&
  js.include?('syncHoverCard(id === null ? null : NODES[id]);')
issues << '小卡里没有"考到哪几场"（用户要知识点划过时出现考试的考点）' unless
  js.include?('function examHits(i)') && js.include?("'考到 ' + hits.length + ' 场：'")
# 考试的名字默认不写，划到或钉住之后才出现
issues << '考试名字默认就写出来了（应划到 / 钉住之后才出现）' unless
  js.include?("if (hot || hov) { text(e.name, { x: pts[3].x, y: pts[3].y - 10 }, accent, 'left', 12); }")

# ---------- 2. 三条口径 ----------
# 默认是 **3D**（用户 2026-09-30："柱状图默认是平面的，对吧？……直接进来就是 3D 的"）
issues << '默认视角不是 3D（state.view 初值必须是 space）' unless
  js =~ /view: 'space',/
issues << '3D 页在写学习记录（这一层是只读的：标记 / 掌握度 / 筛选都留在 2D）' if
  js.include?('localStorage') || js =~ /\.marks\s*=/ || js.include?('setMarks')
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
  js.include?("var cy = state.view === 'axis' ? y : y - 11;") &&
  js.include?('var rx = cx * cos + cz * sin;') &&
  js.include?('var rz = -cx * sin + cz * cos;') &&
  js.include?('var ry = cy * cp + rz * sp;') &&
  js.include?('var depth = rz * cp - cy * sp;') &&
  js.include?('cameraDistance / Math.max(8, cameraDistance + depth)')
# 旋转的**焦点**：没选中时是时间轴中心；选中某一场 → 焦点搬到那一场（x 中心 + 它那天）
issues << '旋转焦点没跟着选中的考试走（选中要把焦点搬到那一场，取消要回到中心）' unless
  js.include?("var cz = state.view === 'axis' ? z : z - pivotZ;") &&
  js.include?('pivotX = xx((pinnedInfo.range[0] + pinnedInfo.range[1]) / 2);') &&
  js.include?('pivotZ = zOf(pinnedInfo.day);') &&
  js.include?('var pivotX = 0;') && js.include?('var pivotZ = 10;')
issues << '取景盒子不是原型的 100 × 22 × 20' unless
  js.include?('[-50, 50][cx]') && js.include?('[0, 22][cyy]') && js.include?('[0, 20][czz]')
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
  js.include?('p(xx(k), NODES[k].difficulty * 4, z)')
issues << '考试覆盖点没区分对错（做错的要用"薄弱"色点出来）' unless
  js.include?('function seedColor(i, ex) { return ex.wrong[i] ? weak : accent; }')
issues << '考试层没有开关（原型有图层设置）' unless
  js.include?('layers: { exams: true }')
# 柱子：站在"当前那一天"那一刀上（跟着底部时间条走），X 轴与年级名跟着它
issues << '柱子没站在"当前那一天"那一刀上（时间条挪动时这堵墙要跟着滑）' unless
  js.include?("var currentZ = state.view === 'axis' ? 0 : zOf(state.dayMs);") &&
  js.include?('var base = p(xx(n.id), 0, currentZ);')
issues << 'X 轴 / 年级名没跟着柱子那条 z（应画在 currentZ 上）' unless
  js.include?('line(p(minX, 0, currentZ), p(maxX, 0, currentZ), muted, 0.45, 1);') &&
  js.include?('p(xx((start + end) / 2), -3.2, currentZ)')
issues << '知识柱没画"基点 + 竖线"（原型是 line(base,pos) 再加一个点）' unless
  js.include?('line(base, pos, off ? grid : color, alpha,') &&
  js.include?('dots.push({ x: pos.x, y: pos.y, id: n.id, base: base, r: 5 });')
issues << '指针命中不是"22px 以内取最近"（原型的判定）' unless
  js.include?('var dist = 22;') && js.include?('function hit(e)')

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
# 选中某一场：板上考点用**曲线**连到对应柱子的顶；底部再排一串考点点 + 名字
issues << '选中某一场后，考点没有用曲线连到对应的柱子' unless
  js.include?('c.bezierCurveTo(pt.x, pt.y - 22, top.x, top.y - 22, top.x, top.y);') &&
  js.include?('var top = p(xx(k), NODES[k].difficulty * 4, currentZ);')
issues << '选中某一场后，柱子底部没有排出考点点 + 知识点名字' unless
  js.include?('var q = p(xx(k), 0, currentZ + 2.5 + row * 2.2);') &&
  js.include?('text(nd.name, { x: q.x, y: q.y + (row ? 27 : 16) }, bad ? weak : ink, \'center\', 11);')
issues << '底部那些考点点没有按难度档上色 / 没有标出错题' unless
  js.include?('var lc = levelColor(nd.difficulty);') && js.include?('c.strokeStyle = weak;')

# ---------- 6. 无障碍与降级 ----------
issues << '3D 页的工具条没有 role="toolbar"' unless page.include?('role="toolbar"')
issues << '分析面板没有 aria-label' unless page =~ /data-t3-report[^>]*aria-label="[^"]+"/
issues << '3D 页少了"尊重减少动效"的兜底' unless
  page.include?('prefers-reduced-motion')
issues << '分析面板没有从钉住的那一场填内容（syncReport / 点行定位 / 收起）' unless
  js.include?('function syncReport()') && js.include?('function onReportClick(ev)') &&
  js.include?("btn.setAttribute('data-t3-report-row'") && js.include?('state.exam = null;')
issues << '分析面板里点一行没有落到轴上的那一格' unless
  js =~ /state\.selected = Number\(btn\.getAttribute\('data-t3-report-row'\)\);/

puts "3D 页体检：画布 / 3D 开关 / 读数 / 原型内核（投影·取景·不夹角度·难度层·考试切片）/ 数据适配 / 分析面板 逐条核对"
puts issues.empty? ? '时间轴 3D 页体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
exit(issues.empty? ? 0 : 1)
