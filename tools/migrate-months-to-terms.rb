# encoding: UTF-8
# ==========================================================================
# 时间段这一层的粒度：**月 → 学期**（用户 2026-09-30 定的）
#
#   ruby tools/migrate-months-to-terms.rb
#
# 为什么改：演示数据的"实际学时"要拉长到 K12 的真实跨度（2020-09 → 2026-06），
# 按月切就是 69 个格子 —— 时间段对比卡要列 69 行、筛选要摆 69 个胶囊，没法用了。
# 按学期切是 12 个（一学年两学期），正好对上"一个学期一次期中 / 期末"的真实节奏。
#
# 顺带把**名字**也改对：存进去的既然是"学年 + 上/下"，就不该再叫 month。
# 与 `tools/migrate-titles.rb` 同一套路：幂等，重复跑不产生任何改动。
# ==========================================================================

ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('..', __dir__)).dup.force_encoding('UTF-8')

FILES = %w[
  assets/js/timeline.js
  assets/js/timeline-data.js
  timeline.html
  tools/checks/verify_timeline.rb
  tools/checks/tl-harness-head.js
  tools/checks/tl-harness-tail.js
].freeze

# 长的先替（months 要在 month 之前），大小写各一套
PAIRS = [['months', 'terms'], ['Months', 'Terms'], ['month', 'term'], ['Month', 'Term']].freeze

changed = []
FILES.each do |rel|
  path = File.join(ROOT, rel)
  unless File.file?(path)
    puts "✗ 找不到 #{rel}（守线要跟着改）"
    exit 1
  end
  src = File.read(path, encoding: 'UTF-8')
  out = src.dup
  PAIRS.each { |a, b| out = out.gsub(a, b) }
  next if out == src
  File.write(path, out)
  changed << rel
end

if changed.empty?
  puts '已经是"学期"口径，无需改动 ✓'
else
  puts '改了这些文件：'
  changed.each { |f| puts "  · #{f}" }
end
