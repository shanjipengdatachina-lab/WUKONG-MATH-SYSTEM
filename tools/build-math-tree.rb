#!/usr/bin/env ruby
# frozen_string_literal: true

# ==========================================================================
# 由四份教材结构 .md 生成脑图数据 assets/js/math-tree.js
# --------------------------------------------------------------------------
# 为什么要有这个脚本：
#   四个学段（小学 / 初中 / 高中 / 竞赛）合起来约一千三百个节点，
#   手工维护不现实，也必然与教材结构文件脱节。
#   这里把 .md 当作唯一数据源，改完 .md 重新跑一次即可。
#
# 一份 .md 的写法（四个学段完全一样）：
#   ## 七年级（上）                     ← 册 / 板块
#   > 来源: https://…                   ← 这一册的目录来源（必填，缺了会停下）
#   > 待核: 新版目录未核到               ← 可选：这一册还没核到，章节留空
#   ### 第一章 有理数 [数与代数]         ← 章；行尾方括号里是课标领域（必填）
#   ### 第一单元 5以内数的认识和加、减法 [数与代数]   ← 小学按单元编号，同样写法
#   #### 1.1 知识速查                    ← 节
#   - 知识点 正数和负数                   ← 末级条目
#
# 用法：ruby tools/build-math-tree.rb
# ==========================================================================

require 'json'

Encoding.default_external = 'UTF-8'
Encoding.default_internal = 'UTF-8'

ROOT_DIR = File.expand_path('..', __dir__)
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

# ==========================================================================
# 学段配置：四个学段各一份教材结构文件，共用一个解析器
# --------------------------------------------------------------------------
# 为什么领域写在 .md 行尾而不是这里的表里：
#   章名跨学段会撞（小学六上和初中都有「圆」），按名字查表必然出错。
#   写在行上则一一对应，而且打开文件就能核对。
# 为什么每册都要写来源：
#   这份数据会直接给学生看。来源必须能被追问，缺一个就停下。
# ==========================================================================
STAGES = [
  {
    code: 'primary', file: '人教版小学数学知识结构.md', name: '小学数学',
    fields: ['数与代数', '图形与几何', '统计与概率', '综合与实践']
  },
  {
    code: 'junior', file: '人教版初中数学知识结构.md', name: '初中数学',
    fields: ['数与代数', '图形与几何', '统计与概率']
  },
  {
    code: 'senior', file: '人教版高中数学知识结构.md', name: '高中数学',
    fields: ['预备知识', '函数', '几何与代数', '概率与统计', '数学建模活动与数学探究活动']
  },
  {
    # 竞赛没有教材，也没有课标领域：四个板块本身就是分区，所以 kind 是 track（板块），
    # 章也不编号、不带领域。章名是把竞赛大纲条目 + 公认教材目录归并出来的，
    # 不是任何单一权威的原文 —— 这一点在数据文件和源文件里都写明了。
    code: 'olympiad', file: '竞赛数学章节框架.md', name: '竞赛数学',
    track: true, fields: nil
  }
].freeze

root = { 'name' => '数学知识网络', 'kind' => 'root', 'children' => [] }
warnings = []
field_tally = Hash.new { |h, k| h[k] = Hash.new(0) }   # 学段 → 领域 → 章数

# 章行的三种写法共用一个正则：
#   ### 第一章 有理数 [数与代数]      （初中 / 高中：按章编号）
#   ### 第一单元 5以内数的认识和加、减法 [数与代数]   （小学：按单元编号）
#   ### 不等式                        （竞赛：不编号，只有章名）
# 行尾方括号里是课标领域；竞赛那栏不写（板块本身就是分区）。
CHAPTER_RE = /\A###\s+(?:第(.+?)(章|单元)\s+)?(.+?)(?:\s*\[(.+?)\])?\s*\z/
# 节行：允许选学内容的星号，如「7.3* 复数的三角表示」
SECTION_RE = /\A####\s+(.+?)\s*\z/
SECTION_NO_RE = /\A(\d+(?:\.\d+)?\*?)\s+(.+)\z/

STAGES.each do |stage|
  source = File.join(ROOT_DIR, stage[:file])
  unless File.exist?(source)
    abort("找不到教材结构文件：#{stage[:file]}\n" \
          "四个学段各要一份（见 STAGES 配置）。")
  end

  book = nil
  chapter = nil
  section = nil
  in_stage = 0

  File.foreach(source, chomp: true).with_index(1) do |line, lineno|
    case line
    when /\A#\s+/                                   # 文件标题：这棵树的名字，忽略
      next

    when /\A##\s+(.+?)\s*\z/                        # 册 / 板块
      name = Regexp.last_match(1)
      book = {
        'name' => name,
        'kind' => stage[:track] ? 'track' : 'book',
        'stage' => stage[:code],
        'children' => []
      }
      root['children'] << book
      chapter = nil
      section = nil
      in_stage += 1

    when /\A>\s*来源[:：]\s*(\S+)\s*\z/             # 册的来源（写在该册的章之前）
      if book.nil?
        warnings << "#{stage[:file]} 第 #{lineno} 行：来源写在任何册之前"
      else
        book['source'] = Regexp.last_match(1)
      end

    when /\A>\s*待核[:：]\s*(.+?)\s*\z/             # 目录还没核到（写在哪一级下面就算哪一级）
      # 写在章标题下面 → 属于这一章（常见：单元名核到了、课时小节没核到）
      # 写在册标题下面 → 属于这一册（常见：整册的新版目录还没公布）
      target = chapter || book
      if target.nil?
        warnings << "#{stage[:file]} 第 #{lineno} 行：待核写在任何册之前"
      else
        target['pending'] = Regexp.last_match(1)
      end

    when CHAPTER_RE                                 # 章 / 单元
      if book.nil?
        warnings << "#{stage[:file]} 第 #{lineno} 行：章出现在任何册之前"
        next
      end
      cn, suffix = Regexp.last_match(1), Regexp.last_match(2)
      name, field = Regexp.last_match(3), Regexp.last_match(4)
      no = cn ? cn_to_int(cn) : 0

      if stage[:fields]
        # 领域没写、或写了不在本学段允许的集合里 -> 停下。
        # 漏一章不会崩，只会让"按领域分"的那一栏安静地少一块，最难发现。
        unless field && stage[:fields].include?(field)
          abort(<<~MSG)
            #{stage[:file]} 第 #{lineno} 行：「#{name}」的课标领域不对。
            行尾要写成 [领域]，且必须是本学段的其中一个：#{stage[:fields].join(' / ')}
            （实际读到：#{field || '没写'}）
          MSG
        end
      elsif field
        abort("#{stage[:file]} 第 #{lineno} 行：「#{name}」不该带课标领域 ——\n" \
              "本学段（#{stage[:name]}）没有课标领域，分区就是板块本身。")
      end

      chapter = {
        'name' => name,
        'kind' => 'chapter',
        'no' => no.zero? ? nil : format('%02d', no),
        'cn' => cn,
        'children' => []
      }
      # 小学按「单元」编号，其余按「章」。阅读器标题要跟着说对，不然会写成「第 3 章 小数除法」。
      chapter['unit'] = true if suffix == '单元'
      chapter['field'] = field if field
      field_tally[stage[:code]][field] += 1 if field
      book['children'] << chapter
      section = nil

    when SECTION_RE                                 # 节 / 栏目
      title = Regexp.last_match(1)
      if chapter.nil?
        warnings << "#{stage[:file]} 第 #{lineno} 行：节出现在任何章之前"
        next
      end
      if stage[:track]
        # 竞赛只做到"章"这一级（用户要的"章节框架类数据"）。
        # 真出现节就停下 —— 否则会悄悄长出一层没人审过的内容。
        abort("#{stage[:file]} 第 #{lineno} 行：竞赛只到「章」一级，不该有节（#{title}）。")
      end
      if title =~ SECTION_NO_RE
        node = { 'name' => Regexp.last_match(2), 'kind' => 'section', 'no' => Regexp.last_match(1), 'children' => [] }
      elsif GROUP_KINDS.key?(title)
        node = { 'name' => title, 'kind' => 'group', 'tone' => GROUP_KINDS[title], 'children' => [] }
      else
        node = { 'name' => title, 'kind' => 'section', 'no' => nil, 'children' => [] }
      end
      chapter['children'] << node
      section = node

    when /\A-\s+(.+?)\s*\z/                         # 知识点 / 方法 / 易错点 / 考点
      if section.nil?
        warnings << "#{stage[:file]} 第 #{lineno} 行：条目出现在任何节之前"
        next
      end
      body = Regexp.last_match(1)
      if body =~ /\A(知识点|方法|易错点|考点)\s*(\d*)\s*(.*)\z/
        label, no, name = Regexp.last_match(1), Regexp.last_match(2), Regexp.last_match(3)
        name = label if name.to_s.empty?
        section['children'] << {
          'name' => name,
          'kind' => LEAF_KINDS[label],
          'no' => no.to_s.empty? ? nil : no
        }
      else
        warnings << "#{stage[:file]} 第 #{lineno} 行：无法识别的条目「#{body}」"
      end
    end
  end

  # 每册必须有来源：这份数据要给学生看，来源得能被追问
  root['children'].last(in_stage).each do |b|
    next if b['source']
    abort(<<~MSG)
      #{stage[:file]}：「#{b['name']}」没写来源。
      在册名下面加一行：> 来源: <URL>
      没有来源的教材数据不许进生成物 —— 说出来源才有人能核对。
    MSG
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

# 按学段分组统计领域章数（解析时顺手记，省得回头再去树上找父节点）
# 注意：本机是 Ruby 2.6（系统自带），没有 filter_map / tally，用 map + compact。
field_counts = STAGES.each_with_object({}) do |stage, out|
  counts = field_tally[stage[:code]] || {}
  next if counts.empty?
  out[stage[:name]] = (stage[:fields] || []).map { |f| [f, counts[f]] if counts[f] }.compact
end

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
# 字符串一律走 JSON.generate：源文件里的中文引号、半角引号、反斜杠都能安全落地。
# （这里踩过一次：待核说明里写了半角双引号，直接把生成的 JS 字符串截断，
#   整个 math-tree.js 语法报错 —— 生成器必须替数据兜住这件事。）
def js_str(value)
  JSON.generate(value.to_s)
end

def dump(node, indent)
  lines = []
  lines << "name: #{js_str(node['name'])}"
  lines << "kind: #{js_str(node['kind'])}"
  lines << "stage: #{js_str(node['stage'])}" if node['stage']
  lines << "source: #{js_str(node['source'])}" if node['source']
  lines << "pending: #{js_str(node['pending'])}" if node['pending']
  lines << "no: #{js_str(node['no'])}" if node['no']
  lines << "field: #{js_str(node['field'])}" if node['field']
  lines << "cn: #{js_str(node['cn'])}" if node['cn']
  lines << 'unit: true' if node['unit']
  lines << "tone: #{js_str(node['tone'])}" if node['tone']
  children = node['children']
  if children && !children.empty?
    inner = children.map { |child| dump(child, indent + 1) }.join(",\n")
    lines << "children: [\n#{inner}\n#{'  ' * (indent + 1)}]"
  end
  "{ #{lines.join(', ')} }"
end

File.write(TARGET, <<~JS)
  /* ==========================================================================
     数学知识网络 —— 脑图数据（小学 / 初中 / 高中 / 竞赛）
     --------------------------------------------------------------------------
     本文件由 tools/build-math-tree.rb 自动生成，请勿手工编辑。
     数据源：四份教材结构文件（见生成器里的 STAGES）——
       人教版小学数学知识结构.md / 人教版初中数学知识结构.md
       人教版高中数学知识结构.md / 竞赛数学章节框架.md
     重新生成：ruby tools/build-math-tree.rb

     每个"册"节点带 stage（学段）与 source（目录来源），章带 field（课标领域）。
     图谱的学段切换与"按领域分"都靠这两栏。
     ========================================================================== */

  window.MATH_TREE = #{dump(root, 0).gsub(/^/, '')};
JS

puts "已生成 #{TARGET.sub(ROOT_DIR + '/', '')}"
STAGES.each do |stage|
  books = root['children'].select { |b| b['stage'] == stage[:code] }
  chapters = books.sum { |b| (b['children'] || []).size }
  sections = books.sum { |b| (b['children'] || []).sum { |c| (c['children'] || []).size } }
  empty = books.select { |b| (b['children'] || []).empty? }.map { |b| b['name'] }
  puts format('  %-4s 册 %-3d 章 %-4d 节 %-4d%s',
              stage[:name].sub('数学', ''), books.size, chapters, sections,
              empty.empty? ? '' : "  ← 待核未填：#{empty.join('、')}")
end
puts "  合计   册 #{collect(root, 'book').size + collect(root, 'track').size} · " \
     "章 #{collect(root, 'chapter').size} · " \
     "节/栏目 #{collect(root, 'section').size + collect(root, 'group').size} · " \
     "末级条目 #{collect(root, 'point').size + collect(root, 'method').size + collect(root, 'error').size + collect(root, 'exam').size}"
puts "  各层节点数: #{depth_counts.sort.to_h.map { |k, v| "L#{k}=#{v}" }.join(' ')}"
field_counts.each do |stage_name, counts|
  puts "  #{stage_name}领域: #{counts.map { |k, v| "#{k} #{v} 章" }.join(' · ')}"
end
puts "  文件大小: #{(File.size(TARGET) / 1024.0).round(1)} KB"

unless warnings.empty?
  puts "\n解析告警 #{warnings.size} 条："
  warnings.first(10).each { |w| puts "  · #{w}" }
end

unless duplicates.empty?
  puts "\n源文件中同一父节点下的重名条目 #{duplicates.size} 条（建议在 .md 里清理）："
  duplicates.each { |d| puts "  · #{d}" }
end
