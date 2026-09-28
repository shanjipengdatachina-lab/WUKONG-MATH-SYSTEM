# encoding: UTF-8
# 拼装两个自检：图谱引擎、会话
WORK = __dir__
OUT  = File.join(__dir__, '_build')
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
Dir.mkdir(OUT) unless Dir.exist?(OUT)
HEAD = File.join(WORK, 'mm-harness-head.js')

jobs = {
  'mm-check.js' => [HEAD, File.join(ROOT, 'assets/js/math-tree.js'), File.join(ROOT, 'assets/js/mindmap.js'), File.join(WORK, 'mm-harness-tail.js')],
  'is-check.js' => [HEAD, File.join(ROOT, 'assets/js/ide-shell.js'), File.join(WORK, 'is-harness-tail.js')]
}

jobs.each do |out, parts|
  text = parts.map { |p| File.read(p, encoding: 'UTF-8') }.join("\n")
  File.write(File.join(OUT, out), text)
  puts "#{out} 已生成（#{text.lines.size} 行）"
end
