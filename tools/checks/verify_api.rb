# encoding: UTF-8
# 接口层体检（assets/js/api.js + 四张读树的页面 + 四个视图模块）
#
# 背景（用户 2026-10-05）：学生端从"读静态文件 math-tree.js"改成"读后台接口"。
#   用户原话："原来设定的那些是静态的。现在要都改成和服务器对接。用户那边需要到服务器。"
#             "章节 图谱 时间轴的数据都是从后台才录入的。"
#
# 这一层只有一件事要做，但它有三个必须同时成立的约束，所以守线也按这三条写：
#   ① **零构建**：就是一个普通 <script>。出现打包产物（import/export/require）就是违约。
#   ② **不许白屏**：拉不到退只读缓存；缓存也没有，出兜底页。
#      —— 「缓存也没有」这条最容易做漏：写代码时手边总是有网，脑子里想的都是"能拉到"。
#   ③ **一处取数**：只有 api.js 允许取那棵树。别的模块各拉一份，缓存与版本就各说各话。
#
# 另外钉一条**和测试有关**的：四个视图模块必须保留"没有 api.js 就同步跑"的兜底分支 ——
#   三个测试脚手架（build_harness / build_tl_harness / build_mm_harness）是把
#   math-tree.js + 模块拼成一个文件跑的，那里没有 WK_API。不留兜底，脚手架全崩。
#
# ---------------------------------------------------------------------------
# 写反向守线的一条纪律（本次会话踩了三次才定下来）：
#   **不要用裸 include? 找禁词** —— 注释里解释"为什么不许用它"就会把自己绊倒
#   （shadowBlur / math-tree.js / If-None-Match 三次误报都是这么来的）。
#   改成**只认真正的写法**：模块语法必须在行首、请求头必须是带引号的字符串、
#   状态码必须出现在比较里 —— 散文里提到这些词，不带引号、不在行首，就不会误报。
# ---------------------------------------------------------------------------
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

def read(rel)
  File.read(File.join(ROOT, rel), encoding: 'UTF-8')
end

api   = read('assets/js/api.js')
pages = %w[reader.html graph.html timeline.html timeline-3d.html]
mods  = {
  'reader.html'      => ['assets/js/reader-live.js', '__wkReader'],
  'graph.html'       => ['assets/js/mindmap.js',     '__wkGraph'],
  'timeline.html'    => ['assets/js/timeline.js',    '__wkTimeline'],
  'timeline-3d.html' => ['assets/js/timeline-3d.js', '__wkTimeline3d'],
}

issues = []

# ---------- 1. 零构建 ----------
issues << 'api.js 里出现了模块语法（import / export / require）—— 学生端零构建，不许有打包产物' if
  api =~ /^\s*(import|export)\s/ || api.include?('require(')
issues << 'api.js 不是普通 <script> 能直接跑的样子（开头应是 (function () 这种立即执行）' unless
  api =~ /^\(function\s*\(/
# 同步 XHR 能把首屏卡死，是上一代做法 —— 这里用了就报
issues << 'api.js 用了同步 XHR —— 那会把首屏卡住' if
  api =~ /new\s+XMLHttpRequest/ && api =~ /async\s*:\s*false/

# ---------- 2. 只有一扇门 ----------
%w[tree: ready: boot: showFailure:].each do |k|
  issues << "api.js 没有对外暴露 #{k}（视图模块只等这一扇门）" unless api.include?(k)
end
issues << 'api.js 没有把 window.WK_API 挂出去' unless api.include?('window.WK_API = {')
# 只有 api.js 能取那棵树：别的模块自己 fetch 一份，缓存与版本就会各说各话
Dir.glob(File.join(ROOT, 'assets/js/*.js')).sort.each do |f|
  base = File.basename(f)
  next if base == 'api.js'
  src = File.read(f, encoding: 'UTF-8')
  issues << "#{base} 自己也在 fetch 知识树 —— 取数只该有 api.js 一处" if src =~ %r{fetch\([^)]*/tree}
end

# ---------- 3. 只读缓存：处处包 try，且不许写回服务器 ----------
issues << 'api.js 没有缓存键（CACHE_KEY）' unless api.include?('CACHE_KEY')
%w[readCache writeCache].each do |fn|
  issues << "api.js 没有 #{fn}()" unless api.include?(fn)
end
issues << 'api.js 读 / 写缓存没有包 try —— 隐私模式或配额满时 localStorage 会抛异常，那会把整页带崩' unless
  api.scan(/function (readCache|writeCache)/).size == 2 &&
  api.scan(/catch \(e\)/).size >= 2
# 取数那一层**不许改服务器上的东西**。
# 原先是"连 POST 都不许"（那会儿这一层只读一棵树）；M4 起它成了学生端的接口客户端，
# 做题要提交答案 —— 所以口径收窄成：**改内容的那几个动词**（PUT / PATCH / DELETE）一律不许，
# POST 只能出现在 request() 的调用里（提交答案、发帖这类"动作"），不许拿来改一条已有记录。
# 这条不是形式主义：`PUT /tree` 这种写法一出现，就意味着有人打算把本地当源头写回去。
["method: 'PUT'", "method: 'PATCH'", "method: 'DELETE'"].each do |bad|
  issues << "api.js 里有 #{bad} —— 这一层不许改服务器上的东西（改走后台）" if api.include?(bad)
end

# ---------- 4. 版本协商 + 超时 ----------
# 版本走**查询参数**，不走 If-None-Match —— 这条是踩出来的，钉死：
#   `If-None-Match` 不在 CORS 安全名单里，浏览器每次都得先发一个 OPTIONS 预检；
#   实测那一路在 Chrome 里以 net::ERR_ABORTED 收场（服务端其实老实回了 304），
#   结果是**每个页面白跑一趟预检、还退回缓存**。查询参数不触发预检，一次往返就够。
issues << 'api.js 又用上 If-None-Match 了（不在 CORS 安全名单里，会触发预检 —— 见文件头那段注释）' if
  api =~ /['"]If-None-Match['"]/
issues << 'api.js 没把版本带上（应是 ?version=；不带就等于每次全量重下 200KB）' unless
  api.include?("'?version='")
issues << 'api.js 没处理 304（带了版本却不认 304，等于白带）' unless api =~ /===\s*304/
issues << 'api.js 没给请求设超时（接口挂着不动时，页面会一直等）' unless
  api.include?('AbortController') && api.include?('TIMEOUT_MS')
# 服务端也得认这个参数，否则客户端白带 —— 但服务端在**另一个仓库**，这里够不到，
# 所以那条契约由服务端自己的检查兜（见计划「执行记录」里的 curl 验收）。

# ---------- 5. 不许白屏 ----------
issues << 'boot() 没有在失败分支走兜底页（拉不到又不兜底 = 白屏）' unless
  api =~ /function boot\([\s\S]{0,200}?showFailure\(/
issues << 'showFailure 没有自己注入样式（出这页时页面自己的 CSS 可能压根没生效）' unless
  api.include?("createElement('style')") && api.include?('.wk-api-fail')
issues << '兜底页没告诉人「出了什么事 / 为什么 / 怎么办」（缺重试按钮）' unless
  api.include?('wk-api-retry')

# ---------- 6. 四张页面：挂 api.js、不挂 math-tree.js、顺序对 ----------
pages.each do |p|
  page = read(p)
  view = mods[p][0]
  # 比的是**脚本标签**的位置，不是文件名第一次出现的位置 —— 注释里提到文件名是常事，
  # 用裸串 index 找会被注释骗（这个坑也踩过一次）。
  api_at  = page.index('<script src="assets/js/api.js">')
  view_at = page.index(%(<script src="#{view}">))
  issues << "#{p} 没挂 assets/js/api.js" if api_at.nil?
  issues << "#{p} 没挂 #{view}" if view_at.nil?
  issues << "#{p} 还挂着 math-tree.js（知识树已改成从接口取）" if
    page.include?('<script src="assets/js/math-tree.js">')
  issues << "#{p} 里 api.js 没排在 #{File.basename(view)} 之前（树要由 api.js 填上，模块才有得读）" if
    api_at && view_at && api_at > view_at
end

# ---------- 7. 四个模块：走 boot，且保留同步兜底 ----------
mods.each_value do |(src, g)|
  js = read(src)
  issues << "#{src} 没有通过 WK_API.boot 启动（页面会等不到树）" unless
    js.include?("window.WK_API.boot(#{g})")
  issues << "#{src} 没有「没有 api.js 就同步跑」的兜底分支 —— 测试脚手架是把本文件拼进去跑的，那里没有 WK_API" unless
    js.include?("else { #{g}(); }")
  # 视图模块一律不许自己碰接口地址
  issues << "#{src} 里出现了接口地址（取数只该经 api.js）" if js =~ %r{/\?version=|fetch\(base}
end

puts '接口层体检：零构建 / 只有一扇门（只有 api.js 取树）/ 只读缓存且处处包 try / 版本走查询参数(+304)+超时 / 拉不到走兜底页不白屏 / 四张页面挂 api.js 不挂 math-tree.js / 四个模块走 boot 且保留同步兜底'
puts issues.empty? ? '接口层体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")
exit(issues.empty? ? 0 : 1)
