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
%w[build_harness.rb build_wb_harness.rb build_mm_harness.rb].each do |b|
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
  ok = fail_n.zero? && log.include?('全部通过')
  rows << [name, pass, fail_n, ok]
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
%w[verify_brand.rb verify_rail.rb verify_reader_tree.rb verify_whiteboard.rb
   verify_fullscreen.rb verify_graph.rb verify_bridges.rb verify_forum.rb
   broken_links.rb residue_final.rb ia_audit.rb].each do |b|
  path = File.join(DIR, b)
  next unless File.exist?(path)
  next unless keep?(File.basename(b, '.rb'))
  log = sh("ruby #{path}")
  puts "  --- #{b}"
  log.lines.each { |l| puts '      ' + l.delete("\n") unless l.strip.empty? }
end

# ---------- 5. 汇总 ----------
total = rows.sum { |r| r[1] }
bad   = rows.sum { |r| r[2] }
puts "\n== 汇总 =="
puts "  断言：#{total} 条，失败 #{bad} 条；JS 语法：#{syntax_ok ? '通过' : '有问题'}"
exit(bad.zero? && syntax_ok ? 0 : 1)
