# encoding: UTF-8
Encoding.default_external = Encoding::UTF_8 if Encoding.default_external != Encoding::UTF_8
$stdout.set_encoding('UTF-8') if $stdout.respond_to?(:set_encoding)

# 一键自检：拼装断言脚本 → 跑 JS 断言 → 跑静态体检 → 输出汇总
#   ruby tools/checks/run_all.rb            # 全部
#   ruby tools/checks/run_all.rb wb graph   # 只跑名字里含 wb / graph 的
# 说明：JS 断言用 osascript（JavaScript for Automation）跑，不需要浏览器。
DIR  = __dir__
OUT  = File.join(DIR, '_build')
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
FILTER = ARGV

def keep?(name)
  FILTER.empty? || FILTER.any? { |f| name.include?(f) }
end

def sh(cmd)
  `#{cmd} 2>&1`.force_encoding('UTF-8')
end

# ---------- 1. 拼装断言脚本 ----------
puts '== 拼装 =='
%w[build_harness.rb build_wb_harness.rb build_mm_harness.rb build_bn_harness.rb].each do |b|
  path = File.join(DIR, b)
  next unless File.exist?(path)
  puts "  #{b}"
  abort("拼装失败：#{b}") unless system("ruby #{path}")
end

# ---------- 2. JS 断言（osascript） ----------
rows = []
puts "\n== 断言 =="
Dir[File.join(OUT, '*.js')].sort.each do |file|
  name = File.basename(file, '.js')
  next unless keep?(name)
  log = sh("osascript -l JavaScript #{file}")
  pass = log.scan(/^PASS/).size
  fail_n = log.scan(/^FAIL/).size
  # 跑到收尾 = 打出了 RESULT 行（无论结论是"全部通过"还是"有失败项"）。
  # 没有 RESULT 行 = 中间抛错 / 被中断 —— 这才是"没跑完"，要和"跑了但红了"分开报。
  finished = log.include?('RESULT:')
  ok = fail_n.zero? && log.include?('RESULT: 全部通过')
  rows << [name, pass, fail_n, ok, finished]
  puts format('  %-26s 通过 %-4d 失败 %-3d %s', name, pass, fail_n, ok ? '✔' : '✘')
  puts log.lines.grep(/^FAIL/).map { |l| '      ' + l.delete("\n") }.join("\n") if fail_n > 0
end

# ---------- 3. JS 语法体检 ----------
puts "\n== 语法 =="
files = Dir[File.join(ROOT, 'assets/js/*.js')].reject { |f| f.include?('lucide.min.js') }
log = sh("osascript -l JavaScript #{File.join(DIR, 'js_syntax_check.js')} #{files.join(' ')}")
log.lines.each { |l| puts '  ' + l.delete("\n") if l =~ /^(ERROR|MISS|RESULT)/ }
syntax_ok = log.include?('RESULT: 全部通过')

# ---------- 4. 静态体检（Ruby） ----------
puts "\n== 体检 =="
# 体检脚本的失败标记统一是「✗」。这些红灯原来不吃进退出码，于是"页面被改坏了"
# 也照样退出 0 —— 2026-09-28 就因为这条差点漏过一次（reader.html 被误删了正文，
# 断言全绿、退出码 0，只有 verify_bridges 在喊）。现在红灯单独统计、单独报、也影响退出码。
problems = []
%w[verify_brand.rb verify_rail.rb verify_reader_tree.rb verify_whiteboard.rb
   verify_fullscreen.rb verify_graph.rb verify_bridges.rb verify_forum.rb
   broken_links.rb residue_final.rb ia_audit.rb].each do |b|
  path = File.join(DIR, b)
  next unless File.exist?(path)
  next unless keep?(File.basename(b, '.rb'))
  log = sh("ruby #{path}")
  puts "  --- #{b}"
  log.lines.each { |l| puts '      ' + l.delete("\n") unless l.strip.empty? }
  red = log.lines.grep(/✗/).size
  problems << [b, red] if red.positive?
end

# ---------- 5. 汇总 ----------
total    = rows.sum { |r| r[1] }
bad      = rows.sum { |r| r[2] }
crashed  = rows.reject { |r| r[4] }.map { |r| r[0] }   # 连 RESULT 行都没打到：没跑完
puts "\n== 汇总 =="
puts "  断言：#{total} 条，失败 #{bad} 条；JS 语法：#{syntax_ok ? '通过' : '有问题'}"
if problems.empty?
  puts "  体检：无红灯"
else
  puts "  体检红灯：#{problems.map { |b, n| "#{b} #{n} 条" }.join('、')}"
end
# 断言包没跑到收尾（中间抛错 / 被中断）时，它既没有 PASS 到底、也没有 FAIL 行，
# 只统计 bad 就会把它当成"失败 0 条"放过去 —— 所以"没跑完"必须单独算红灯。
unless crashed.empty?
  puts "  未跑完的断言包：#{crashed.join('、')}（多半是中间抛错，看上面那行的 ✘）"
end
exit(bad.zero? && syntax_ok && crashed.empty? && problems.empty? ? 0 : 1)
