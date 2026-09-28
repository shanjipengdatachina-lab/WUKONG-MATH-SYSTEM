# encoding: UTF-8
# 把白板工具条 / 浮层 / 悬浮面板的样式，原样搬到图谱页，类名换成 mm- 前缀。
# 目的：两页共用同一套形状与尺寸，值不靠手抄，避免走样。
# 可重复执行：只替换 graph.html 里 MM-SHARED 标记之间的内容。

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
WB = File.join(ROOT, 'whiteboard.html')
GR = File.join(ROOT, 'graph.html')

css = File.read(WB, encoding: 'UTF-8')[/<style id="wb-styles">(.*?)<\/style>/m, 1]
abort '找不到白板的样式块' unless css

# ---- 把 CSS 拆成顶层规则 / at 块（按花括号配对） ----
def split_blocks(text)
  blocks = []
  i = 0
  len = text.length
  while i < len
    j = text.index('{', i)
    break unless j
    head = text[i...j].strip
    depth = 1
    k = j + 1
    while k < len && depth > 0
      depth += 1 if text[k] == '{'
      depth -= 1 if text[k] == '}'
      k += 1
    end
    body = text[(j + 1)...(k - 1)]
    blocks << [head, body]
    i = k
  end
  blocks
end

TOKENS = {
  '.wb-dock' => '.mm-dock',
  '.wb-flyout' => '.mm-flyout',
  '.wb-bank' => '.mm-card',
  '[data-wb-tip]' => '[data-mm-tip]'
}

def wanted?(sel)
  TOKENS.keys.any? { |t| sel.include?(t) }
end

def rename(sel)
  out = sel.dup
  TOKENS.each { |from, to| out = out.gsub(from, to) }
  out
end

# 声明体里也有一处必须改：`content:attr(data-wb-tip)` 引用的是**属性名**。
# 只改选择器、不改这里的话，气泡的内容永远是空字符串 ——
# 图谱底部一排按钮鼠标滑过去一条提示都看不见（真出过这个 bug）。
BODY_TOKENS = {
  'attr(data-wb-tip)' => 'attr(data-mm-tip)'
}

def rename_body(body)
  out = body.dup
  BODY_TOKENS.each { |from, to| out = out.gsub(from, to) }
  out
end

# 只保留与目标类名相关的规则；其余（画布、笔迹、题库列表等）不要
def pick(body)
  split_blocks(body).map { |head, inner| [head, inner] }
end

lines = []
picked = []

split_blocks(css).each do |head, body|
  if head.start_with?('@')
    inner = pick(body).select { |h, _| wanted?(h) }
    next if inner.empty?
    lines << "#{head}{"
    inner.each do |h, b|
      lines << "  #{rename(h)}{#{rename_body(b.strip)}}"
      picked << h.strip
    end
    lines << '}'
  elsif wanted?(head)
    lines << "#{rename(head)}{#{rename_body(body.strip)}}"
    picked << head.strip
  end
end

shared = lines.join("\n")

html = File.read(GR, encoding: 'UTF-8')
abort 'graph.html 里找不到 MM-SHARED 标记' unless html.include?('/* MM-SHARED-BEGIN */')
html2 = html.sub(/\/\* MM-SHARED-BEGIN \*\/.*?\/\* MM-SHARED-END \*\//m,
                 "/* MM-SHARED-BEGIN */\n#{shared}\n/* MM-SHARED-END */")
# 白板没动过的时候，产物跟上一次一模一样 —— 这**不是错误**（脚本本来就该能重复跑）。
# 原来这里用"没变化"当"找不到标记"的判据，重跑一次就会报"找不到 MM-SHARED 标记"，
# 把人往错的方向带（真出过：以为标记丢了，其实是本来就同步好了）。
if html2 == html
  puts "共享样式已经是最新的（#{picked.size} 条规则，没有改动）"
  exit 0
end
File.write(GR, html2)

puts "已写入 #{picked.size} 条规则（类名前缀 wb- → mm-）："
picked.each { |p| puts "  #{p}" }
