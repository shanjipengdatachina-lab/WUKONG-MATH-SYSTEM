# encoding: UTF-8
# 全站信息架构盘点：每个页面是从哪儿被链到的（导航 / 页脚 / 学习中心侧栏 / 正文）
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')

RAIL  = %r{<nav class="ide-rail".*?</nav>}m
FOOT  = %r{<footer.*?</footer>}m
ACCT  = %r{<aside class="acct-side".*?</aside>}m
FNAV  = %r{<section class="forum-nav".*?</section>}m

pages = Dir.glob(File.join(ROOT, '*.html')).sort.map { |p| File.basename(p) }
inbound = Hash.new { |h, k| h[k] = { nav: [], foot: [], acct: [], content: [] } }

pages.each do |name|
  html = File.read(File.join(ROOT, name), encoding: 'UTF-8')
  # 先把导航 / 页脚 / 侧栏这几块挖掉，剩下的都算正文
  rails = html.scan(RAIL).join
  foots = html.scan(FOOT).join
  accts = html.scan(ACCT).join
  fnavs = html.scan(FNAV).join
  rest = html.dup
  [rails, foots, accts, fnavs].each { |chunk| rest = rest.sub(chunk, '') if chunk && !chunk.empty? }

  { nav: rails, foot: foots + fnavs, acct: accts, content: rest }.each do |kind, text|
    text.scan(/href="([a-z0-9-]+\.html)(?:[?#][^"]*)?"/).flatten.uniq.each do |target|
      next unless pages.include?(target)
      next if target == name
      inbound[target][kind] << name
    end
  end
end

puts format('%-24s %-6s %-8s %-8s %-8s %s', '页面', '导航', '页脚', '学习中心', '正文', '判定')
puts '-' * 96
pages.each do |name|
  i = inbound[name]
  total = i[:nav].size + i[:foot].size + i[:acct].size + i[:content].size
  verdict =
    if total.zero? then '孤岛：没有任何页面链到它'
    elsif i[:content].size.zero? && i[:acct].size.zero? then '只能从导航/页脚进，正文里没人提'
    elsif i[:content].size.zero? then '靠侧栏进入，正文里没人提'
    else ''
    end
  puts format('%-24s %-6d %-8d %-8d %-8d %s', name, i[:nav].size, i[:foot].size, i[:acct].size, i[:content].size, verdict)
end

puts
puts '---- 正文里被提到最多的页面（真正的枢纽）----'
pages.map { |n| [n, inbound[n][:content].size] }.sort_by { |_, c| -c }.first(12).each do |n, c|
  puts format('  %-24s %d 处', n, c)
end
