# encoding: UTF-8
# 全站搜索旧头部 / 抽屉的残留
root = '/Users/liyuanyuan/Desktop/WKMATH'
tokens = %w[shell-header shell-brand shell-nav shell-burger shell-drawer initDrawer]
hits = Hash.new { |h, k| h[k] = [] }

Dir.glob(File.join(root, '**', '*.{html,css,js}')).sort.each do |f|
  next if f.include?('lucide.min.js')
  s = File.read(f, encoding: 'UTF-8')
  tokens.each do |t|
    n = s.scan(/#{t}/).length
    hits[t] << [File.basename(f), n] if n.positive?
  end
end

if hits.empty?
  puts '全站已无旧头部 / 抽屉残留 ✓'
else
  hits.each do |t, files|
    puts "#{t}: #{files.map { |f, n| "#{f}(#{n})" }.join(', ')}"
  end
end
