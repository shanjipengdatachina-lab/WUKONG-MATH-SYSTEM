# encoding: UTF-8
# 品牌体检：悟空数学 / logo「悟」
#   1) 42 个页面的品牌面必须统一为「悟 + 悟空数学 + 知识图谱」
#   2) 旧的品牌串不得残留
#   3) 学科文案（人教版初中数学、教材结构文档名）必须原样保留
#   4) 浏览器标签统一为「页面名 · 悟空数学」—— 含**运行时**改标题的那几处 JS
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
pages = Dir.glob(File.join(ROOT, '*.html')).sort

# 独立文档（白板功能规划）按设计没有侧栏，单独按自己的品牌面核对
RAILLESS = %w[白板功能规划.html]

MARK   = '<span class="ide-rail__mark" aria-hidden="true">悟</span>'
NAME   = '<span class="ide-rail__brand-name">悟空数学</span>'
BTITLE = 'title="悟空数学 · 知识图谱"'
FOOT   = 'shell-footer__legal">悟空数学'

issues = []
rail_ok = 0
foot_ok = 0

pages.each do |path|
  base = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')

  unless RAILLESS.include?(base)
    miss = []
    miss << 'logo 字标' unless html.include?(MARK)
    miss << '侧栏品牌名' unless html.include?(NAME)
    miss << '侧栏品牌 title' unless html.include?(BTITLE)
    if miss.empty? then rail_ok += 1 else issues << "#{base}: 侧栏缺 #{miss.join(' / ')}" end
  end

  foot_ok += 1 if html.include?(FOOT)

  # 旧品牌串残留
  {
    '旧 logo 字标' => '<span class="ide-rail__mark" aria-hidden="true">初</span>',
    '旧侧栏品牌名' => '<span class="ide-rail__brand-name">初中数学</span>',
    '旧侧栏 title' => 'title="初中数学 · 知识图谱"',
    '旧页脚品牌' => 'shell-footer__legal">初中数学',
    '旧知识卡片品牌条' => '<span class="kp-brand__name">初中数学</span>',
    '旧首页大标题' => 'id="hero-title">初中数学<',
    '旧副标题/协议品牌' => '你的初中数学知识图谱'
  }.each do |label, token|
    issues << "#{base}: 仍有#{label}" if html.include?(token)
  end
end

# 学科文案必须保留（这是数学内容，不是品牌）
must_keep = {
  'about.html'   => '人教版初中数学教材',
  'concept.html' => '初中数学「数形结合」',
  'concept.html#2' => '人教版初中数学知识结构.md'
}
must_keep.each do |key, token|
  base = key.split('#').first
  html = File.read(File.join(ROOT, base), encoding: 'UTF-8')
  issues << "#{base}: 学科文案被误改（#{token}）" unless html.include?(token)
end

# ---- 浏览器标签：「页面名 · 悟空数学」 ----
# 原来 42 页里只有 whiteboard.html 一条是按这个规则写的，其余各写各的（「首页」「关于本站」
# 「数轴 · 知识点」…），浏览器上开十来个标签既认不出品牌也认不出哪条是这个站。
TITLE_SUFFIX = ' · 悟空数学'
# 代码里那句字面量的**结尾**（连收尾单引号一起）：
# 拼接写法（chapter.name + ' · 悟空数学'）与整串字面量（'数轴 · 悟空数学'）都以它收尾。
# 不能拿 TITLE_SUFFIX 去 include? 判：'数轴 · 悟空数学' 里就**不含** "' · 悟空数学'"
# （那一段前面是「数轴」而不是引号）—— 用过一版 include?，当场把正确的那句误判成不合规。
TITLE_LIT    = "· 悟空数学'"
title_ok = 0
pages.each do |path|
  base = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')
  t = html[/<title>(.*?)<\/title>/m, 1]
  if t.nil?
    issues << "#{base}: 没有 <title>"
    next
  end
  t = t.strip
  # 判据就两条，别写三个分支 —— 第一版在中间塞了个"只有品牌、没有页面名"的分支，
  # 但 t 已经 strip 过（' · 悟空数学' 会被剥成 '· 悟空数学'），那个分支永远进不去，是死代码。
  # 现在：后缀出现两次以上单独报（好认），其余一律落到"不是「页面名 · 悟空数学」"这一条。
  page_name = t.sub(/\s*#{Regexp.escape(TITLE_SUFFIX)}\z/, '').strip
  if t.scan(TITLE_SUFFIX).size > 1
    # 注意用 scan 数"出现几次" —— String#count 数的是字符集合，拿它数子串会静默数错
    issues << "#{base}: 标签页标题里「#{TITLE_SUFFIX}」出现了不止一次（「#{t}」）"
  elsif page_name.empty? || t != page_name + TITLE_SUFFIX
    issues << "#{base}: 标签页标题不是「页面名 · 悟空数学」（现在是「#{t}」）"
  else
    title_ok += 1
  end
end

# 运行时改标题的那几处也得同一条规则：原来阅读器写「· 章节阅读」、搜索页写「· 搜索结果」，
# 于是同一个站里两套后缀 —— 静态页一条、JS 跑完之后又变一条。
JS_TITLED = {
  'assets/js/reader-live.js' => '阅读器（按章名 / 学段换标题）',
  'assets/js/pages.js'       => '搜索页（按关键词换标题）',
  'assets/js/forum.js'       => '论坛（按帖子 / 专题换标题）'
}.freeze
# 注意别写成 %w[· 章节阅读]：%w 按空白切词，会切成「·」和「章节阅读」两条，
# 单一个「·」到处都命中 —— 第一版就是这么写的，一跑就误报四条。
OLD_SUFFIX = ['· 章节阅读', '· 搜索结果'].freeze
JS_TITLED.each do |rel, label|
  js = File.read(File.join(ROOT, rel), encoding: 'UTF-8')
  old = OLD_SUFFIX.select { |tok| js.include?(tok) }
  issues << "#{label}：#{rel} 里还留着旧后缀 #{old.join(' / ')}" unless old.empty?
  js.scan(/document\.title\s*=\s*([^;]+);/m).each do |(expr)|
    e = expr.to_s.strip
    issues << "#{label}：#{rel} 里这句没带品牌后缀 → #{e[0, 70]}" unless e.end_with?(TITLE_LIT)
  end
end

puts "页面总数: #{pages.size}"
puts "侧栏品牌统一: #{rail_ok}/#{pages.size - RAILLESS.size} 页（另 #{RAILLESS.size} 页无侧栏按设计跳过）"
puts "页脚品牌统一: #{foot_ok}/#{pages.size} 页"
puts "标签页标题统一: #{title_ok}/#{pages.size} 页（「页面名 · 悟空数学」）"
puts issues.empty? ? '品牌体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")

# 顺带核对：脑图根节点与教材结构文档仍用学科名（项目名 ≠ 学科名）
tree = File.read(File.join(ROOT, 'assets/js/math-tree.js'), encoding: 'UTF-8')
puts "脑图根节点: #{tree[/name: "([^"]+)", kind: "root"/, 1]}（学科名，非品牌名）"
puts "教材结构文档: #{File.exist?(File.join(ROOT, '人教版初中数学知识结构.md')) ? '在' : '缺失'}"

# 有问题就非零退出（跟 verify_rail 一致）：run_all 那条"退出码非 0 且零 ✗ = 崩了"的判据要靠它
# 区分"跑完了、有问题"和"没跑完"；单独直接跑这个脚本时，退出码也是给 CI / 眼睛用的信号。
exit 1 unless issues.empty?
