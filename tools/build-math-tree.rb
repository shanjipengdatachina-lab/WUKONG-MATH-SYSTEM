#!/usr/bin/env ruby
# frozen_string_literal: true

# ==========================================================================
# 由《人教版初中数学知识结构.md》生成脑图数据 assets/js/math-tree.js
# --------------------------------------------------------------------------
# 为什么要有这个脚本：
#   脑图共有约 780 个节点（6 册 / 29 章 / 若干节 / 500+ 知识点），
#   手工维护不现实，也必然与教材结构文件脱节。
#   这里把 .md 当作唯一数据源，改完 .md 重新跑一次即可。
#
# 用法：ruby tools/build-math-tree.rb
# ==========================================================================

require 'json'

Encoding.default_external = 'UTF-8'
Encoding.default_internal = 'UTF-8'

ROOT_DIR = File.expand_path('..', __dir__)
SOURCE = File.join(ROOT_DIR, '人教版初中数学知识结构.md')
TARGET = File.join(ROOT_DIR, 'assets', 'js', 'math-tree.js')

CN_DIGITS = {
  '一' => 1, '二' => 2, '三' => 3, '四' => 4, '五' => 5,
  '六' => 6, '七' => 7, '八' => 8, '九' => 9, '十' => 10
}.freeze

# 中文数字 -> 阿拉伯数字（覆盖 一 到 二十九）
def cn_to_int(text)
  return CN_DIGITS[text] if CN_DIGITS.key?(text)
  return 0 unless text.include?('十')

  head, tail = text.split('十', 2)
  tens = head.to_s.empty? ? 1 : CN_DIGITS[head].to_i
  ones = tail.to_s.empty? ? 0 : CN_DIGITS[tail].to_i
  tens * 10 + ones
end

# 叶子节点前缀 -> kind
LEAF_KINDS = {
  '知识点' => 'point',
  '方法' => 'method',
  '易错点' => 'error',
  '考点' => 'exam'
}.freeze

# 章节末尾的栏目名 -> kind
GROUP_KINDS = {
  '方法速学' => 'method',
  '易错速析' => 'error',
  '真题速练' => 'exam'
}.freeze

# 章 -> 课标领域。图谱要能"按几何代数分"，而源文件里没有这一栏 ——
# 所以在这里显式登记，生成时写进每一个章节点。
# 判定按人教社 / 课标的三个领域走；「平面直角坐标系」归图形与几何
# （课标把"图形与坐标"放在几何里），这是唯一容易被觉得"应该算代数"的一章。
FIELDS = {
  '有理数' => '数与代数',
  '整式的加减' => '数与代数',
  '一元一次方程' => '数与代数',
  '实数' => '数与代数',
  '二元一次方程组' => '数与代数',
  '不等式与不等式组' => '数与代数',
  '整式的乘法与因式分解' => '数与代数',
  '分式' => '数与代数',
  '二次根式' => '数与代数',
  '一次函数' => '数与代数',
  '一元二次方程' => '数与代数',
  '二次函数' => '数与代数',
  '反比例函数' => '数与代数',

  '几何图形初步' => '图形与几何',
  '相交线与平行线' => '图形与几何',
  '平面直角坐标系' => '图形与几何',
  '三角形' => '图形与几何',
  '全等三角形' => '图形与几何',
  '轴对称' => '图形与几何',
  '勾股定理' => '图形与几何',
  '平行四边形' => '图形与几何',
  '旋转' => '图形与几何',
  '圆' => '图形与几何',
  '相似' => '图形与几何',
  '锐角三角函数' => '图形与几何',
  '投影与视图' => '图形与几何',

  '数据的收集、整理与描述' => '统计与概率',
  '数据的分析' => '统计与概率',
  '概率初步' => '统计与概率'
}.freeze

# 领域在图谱里的短名（列表与工具条上用它，图里的节点名仍用课标全称）
FIELD_SHORT = {
  '数与代数' => '代数',
  '图形与几何' => '几何',
  '统计与概率' => '统计与概率'
}.freeze

root = { 'name' => '初中数学', 'kind' => 'root', 'children' => [] }
books = []
warnings = []

File.foreach(SOURCE, chomp: true).with_index(1) do |line, lineno|
  case line
  when /\A##\s+(.+?)\s*\z/                       # 册
    books << { 'name' => Regexp.last_match(1), 'kind' => 'book', 'children' => [] }
    root['children'] << books.last

  when /\A###\s+第(.+?)章\s+(.+?)\s*\z/          # 章
    if books.empty?
      warnings << "第 #{lineno} 行：章出现在任何册之前"
      next
    end
    no = cn_to_int(Regexp.last_match(1))
    no = 0 if no.zero?
    name = Regexp.last_match(2)
    field = FIELDS[name]
    # 新加一章却忘了登记领域 -> 直接停下，不要生成一份"有一章按领域分不出来"的数据。
    # 图谱的"几何代数"那一栏就是靠这个字段分组，漏一章会安静地少一块。
    unless field
      abort(<<~MSG)
        第 #{lineno} 行：「#{name}」没有登记课标领域。
        请在 tools/build-math-tree.rb 的 FIELDS 表里补一行（数与代数 / 图形与几何 / 统计与概率）。
      MSG
    end
    chapter = {
      'name' => name,
      'kind' => 'chapter',
      'no' => format('%02d', no),
      'field' => field,
      'cn' => Regexp.last_match(1),
      'children' => []
    }
    books.last['children'] << chapter
    @chapter = chapter

  when /\A####\s+(.+?)\s*\z/                      # 节 / 栏目
    if @chapter.nil?
      warnings << "第 #{lineno} 行：节出现在任何章之前"
      next
    end
    title = Regexp.last_match(1)
    if title =~ /\A(\d+(?:\.\d+)?)\s+(.+)\z/
      node = { 'name' => Regexp.last_match(2), 'kind' => 'section', 'no' => Regexp.last_match(1), 'children' => [] }
    elsif GROUP_KINDS.key?(title)
      node = { 'name' => title, 'kind' => 'group', 'tone' => GROUP_KINDS[title], 'children' => [] }
    else
      node = { 'name' => title, 'kind' => 'section', 'no' => nil, 'children' => [] }
    end
    @chapter['children'] << node
    @section = node

  when /\A-\s+(.+?)\s*\z/                         # 知识点 / 方法 / 易错点 / 考点
    if @section.nil?
      warnings << "第 #{lineno} 行：条目出现在任何节之前"
      next
    end
    body = Regexp.last_match(1)
    if body =~ /\A(知识点|方法|易错点|考点)\s*(\d*)\s*(.*)\z/
      label, no, name = Regexp.last_match(1), Regexp.last_match(2), Regexp.last_match(3)
      name = label if name.to_s.empty?
      @section['children'] << {
        'name' => name,
        'kind' => LEAF_KINDS[label],
        'no' => no.to_s.empty? ? nil : no
      }
    else
      warnings << "第 #{lineno} 行：无法识别的条目「#{body}」"
    end
  end
end

# ---------- 统计与体检 ----------
def walk(node, depth, depth_counts)
  depth_counts[depth] = depth_counts.fetch(depth, 0) + 1
  (node['children'] || []).each { |child| walk(child, depth + 1, depth_counts) }
end

def collect(node, kind, out = [])
  out << node if node['kind'] == kind
  (node['children'] || []).each { |child| collect(child, kind, out) }
  out
end

depth_counts = {}
walk(root, 0, depth_counts)

# 三个课标领域各多少章（按 FIELDS 里登记的顺序输出，不按出现顺序）
field_counts = collect(root, 'chapter').group_by { |c| c['field'] }
                          .transform_values(&:size)
                          .sort_by { |name, _| [FIELDS.values.index(name) || 99, name] }.to_h

# 同一父节点下的重名子节点（源文件里存在的重复列举）
duplicates = []
def scan_duplicates(node, duplicates)
  children = node['children'] || []
  seen = {}
  children.each do |child|
    key = child['name']
    duplicates << "#{node['name']} → 「#{key}」" if seen[key]
    seen[key] = true
    scan_duplicates(child, duplicates)
  end
end
scan_duplicates(root, duplicates)

# ---------- 输出 ----------
def dump(node, indent)
  lines = []
  lines << %(name: "#{node['name']}")
  lines << %(kind: "#{node['kind']}")
  lines << %(no: "#{node['no']}") if node['no']
  lines << %(field: "#{node['field']}") if node['field']
  lines << %(cn: "#{node['cn']}") if node['cn']
  lines << %(tone: "#{node['tone']}") if node['tone']
  children = node['children']
  if children && !children.empty?
    inner = children.map { |child| dump(child, indent + 1) }.join(",\n")
    lines << "children: [\n#{inner}\n#{'  ' * (indent + 1)}]"
  end
  "{ #{lines.join(', ')} }"
end

File.write(TARGET, <<~JS)
  /* ==========================================================================
     初中数学知识网络 —— 脑图数据
     --------------------------------------------------------------------------
     本文件由 tools/build-math-tree.rb 自动生成，请勿手工编辑。
     数据源：人教版初中数学知识结构.md（本站自己的教材结构资料）
     重新生成：ruby tools/build-math-tree.rb
     ========================================================================== */

  window.MATH_TREE = #{dump(root, 0).gsub(/^/, '')};
JS

puts "已生成 #{TARGET.sub(ROOT_DIR + '/', '')}"
puts "  册      : #{collect(root, 'book').size}"
puts "  章      : #{collect(root, 'chapter').size}"
puts "  节/栏目 : #{collect(root, 'section').size + collect(root, 'group').size}"
puts "  末级条目: #{collect(root, 'point').size + collect(root, 'method').size + collect(root, 'error').size + collect(root, 'exam').size}"
puts "    其中知识点 #{collect(root, 'point').size} · 方法 #{collect(root, 'method').size} · 易错 #{collect(root, 'error').size} · 考点 #{collect(root, 'exam').size}"
puts "  各层节点数: #{depth_counts.sort.to_h.map { |k, v| "L#{k}=#{v}" }.join(' ')}"
puts "  课标领域: #{field_counts.map { |k, v| "#{k} #{v} 章（#{FIELD_SHORT[k]}）" }.join(' · ')}"
puts "  文件大小: #{(File.size(TARGET) / 1024.0).round(1)} KB"

unless warnings.empty?
  puts "\n解析告警 #{warnings.size} 条："
  warnings.first(10).each { |w| puts "  · #{w}" }
end

unless duplicates.empty?
  puts "\n源文件中同一父节点下的重名条目 #{duplicates.size} 条（建议在 .md 里清理）："
  duplicates.each { |d| puts "  · #{d}" }
end
