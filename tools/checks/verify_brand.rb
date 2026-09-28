# encoding: UTF-8
# 品牌体检：悟空数学 / logo「悟」
#   1) 42 个页面的品牌面必须统一为「悟 + 悟空数学 + 知识图谱」
#   2) 旧的品牌串不得残留
#   3) 学科文案（人教版初中数学、教材结构文档名）必须原样保留
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

puts "页面总数: #{pages.size}"
puts "侧栏品牌统一: #{rail_ok}/#{pages.size - RAILLESS.size} 页（另 #{RAILLESS.size} 页无侧栏按设计跳过）"
puts "页脚品牌统一: #{foot_ok}/#{pages.size} 页"
puts issues.empty? ? '品牌体检全部通过 ✓' : issues.map { |i| "  ✗ #{i}" }.join("\n")

# 顺带核对：脑图根节点与教材结构文档仍用学科名（项目名 ≠ 学科名）
tree = File.read(File.join(ROOT, 'assets/js/math-tree.js'), encoding: 'UTF-8')
puts "脑图根节点: #{tree[/name: "([^"]+)", kind: "root"/, 1]}（学科名，非品牌名）"
puts "教材结构文档: #{File.exist?(File.join(ROOT, '人教版初中数学知识结构.md')) ? '在' : '缺失'}"
