# encoding: UTF-8
# 动线体检：把「读 → 练 → 问 → 画 → 回到知识点」这几座桥焊死
#   1) 首页：练 / 问 / 画 三个出口
#   2) 练习页：去论坛问
#   3) 白板：回到知识点（带来源）
#   4) 图谱：接得住 ?q= 点名
ROOT = (ENV['WKMATH_ROOT'] || File.expand_path('../..', __dir__)).dup.force_encoding('UTF-8')
issues = []

def read(*parts)
  File.read(File.join(ROOT, *parts), encoding: 'UTF-8')
end

home     = read('home.html')
practice = read('practice.html')
wb       = read('whiteboard.html')
wbjs     = read('assets/js/whiteboard.js')
mm       = read('assets/js/mindmap.js')

# ---------- 1. 首页：练 / 问 / 画 三个出口 ----------
{
  'quick-practice' => 'practice.html',
  'quick-forum'    => 'forum-compose.html',
  'quick-board'    => 'whiteboard.html'
}.each do |dom, href|
  unless home =~ /href="#{Regexp.escape(href)}"\s+data-dom-id="#{dom}"/
    issues << "首页出口 ##{dom} 缺失或没指向 #{href}"
  end
end
issues << '首页出口没有收进 .quick-list 区块' unless home.include?('class="quick-list"')
issues << '首页出口区块缺标题（无障碍/结构）' unless home.include?('aria-labelledby="quick-title"')
%w[练 问 画].each do |word|
  issues << "首页出口少了「#{word}」这个字" unless home =~ /quick__name">#{word} · /
end

# ---------- 2. 练习页：做完题能直接去问 ----------
unless practice =~ /href="forum-compose\.html"\s+data-dom-id="open-forum"/
  issues << '练习页缺「去论坛问」出口'
end
issues << '练习页两个出口没放进同一个 CTA 块' unless practice.include?('class="side__block side__block--cta"')
issues << '练习页 CTA 块缺纵向排布样式' unless practice.include?('.side__block--cta{display:flex;flex-direction:column;gap:10px}')
issues << '练习页原来的「回到章节」丢了' unless practice.include?('data-dom-id="open-reader"')

# ---------- 3. 白板：回到知识点 ----------
issues << '白板工具条缺「回到知识点」按钮' unless wb.include?('class="wb-dock__btn" id="wb-jump-kp"')
issues << '「回到知识点」用了系统 title 气泡' if wb[/id="wb-jump-kp"[^>]*\stitle="/]
issues << '「回到知识点」没带自绘提示' unless wb[/id="wb-jump-kp"[^>]*data-wb-tip="/]

dock = wb[/<div class="wb-dock".*?<div class="wb-pop"/m].to_s
order = %w[wb-bank-toggle wb-jump-kp wb-settings]
pos = order.map { |id| dock.index(%(id="#{id}")) }
issues << '「回到知识点」没排在题库与设置之间' if pos.any?(&:nil?) || !(pos == pos.sort)

issues << 'whiteboard.js 没定义 kpKeyword（从来源里取知识点名）' unless wbjs.include?('function kpKeyword')
issues << 'whiteboard.js 没定义 jumpToKp' unless wbjs.include?('function jumpToKp')
issues << '「回到知识点」按钮没绑定' unless wbjs.include?("bind('wb-jump-kp', jumpToKp)")
issues << '目标地址没带 ?q= 参数' unless wbjs.include?("'graph.html?q=' + encodeURIComponent(key)")
issues << '没有来源时没退回图谱首页' unless wbjs.include?("return key ? 'graph.html?q=' + encodeURIComponent(key) : 'graph.html'")
issues << '按钮提示没跟着来源更新' unless wbjs.include?("'回到知识点 · ' + key")

# ---------- 4. 图谱：接得住点名 ----------
issues << '图谱没解析 ?q= 参数' unless mm.include?('function queryParam')
issues << '图谱没实现 applyDeepLink' unless mm.include?('function applyDeepLink')
issues << '启动时没有调用 applyDeepLink' unless mm =~ /render\(\{ fit: true \}\);\s*\n\s*applyDeepLink\(\);/
issues << '点名没命中时没有提示' unless mm.include?("图谱里没有「")
issues << '自查接口没暴露 deepLink（测试要用）' unless mm.include?('deepLink: applyDeepLink')

# ---------- 5. 「公式速查 / 易错速析」在正文里真的走得到 ----------
# 背景：这两个页面不在侧栏导航里，如果正文也不给入口，学生就永远发现不了。
chapter = read('chapter.html')
reader  = read('reader.html')
concept = read('concept.html')

# 章节页：本章配套的四个模块卡片
issues << '章节页「方法速学」错链到 pitfalls.html（应是 methods.html）' unless
  chapter =~ /href="methods\.html"\s+data-dom-id="chapter-open-methods"/
issues << '章节页缺「易错速析」入口' unless
  chapter =~ /href="pitfalls\.html"\s+data-dom-id="chapter-open-pitfalls"/
issues << '章节页缺「公式速查」入口' unless
  chapter =~ /href="formulas\.html"\s+data-dom-id="chapter-open-formulas"/
issues << '章节页配套区标题仍叫「方法速学」，但里面装了四类东西' if
  chapter =~ /sec__title">方法速学<\/h2>\s*<span class="sec__note">8 条/

# 阅读器右栏：与「方法速学 / 易错速析」同一套折叠块结构
issues << '阅读器右栏缺「公式速查」入口' unless reader.include?('data-dom-id="open-formulas"')
issues << '阅读器的公式块没沿用折叠块结构（应 side-block--fold + side-block__head）' unless
  reader =~ /<section class="side-block side-block--fold">\s*<div class="side-block__head">\s*<h2 class="side-block__title">公式速查<\/h2>/

# 知识点卡片：「关联」列表
issues << '知识点卡片的「关联」里缺公式速查' unless
  concept =~ /<a href="formulas\.html"><span>公式速查<\/span>/

# 练习页：做题帮手
issues << '练习页缺「做题帮手」块' unless practice.include?('做题帮手')
%w[practice-formulas practice-pitfalls].each do |dom|
  issues << "练习页「做题帮手」缺 ##{dom}" unless practice.include?("data-dom-id=\"#{dom}\"")
end
issues << '练习页「做题帮手」缺纵向排布样式' unless
  practice.include?('.side__links{display:flex;flex-direction:column;gap:10px}')

# 反面：谁也不许把公式速查偷偷塞回侧栏导航（它靠正文入口被发现）
issues << '有人把公式速查加进侧栏导航了（应按设计只从正文进）' if
  home.include?('data-nav-key="formulas"')

puts issues.empty? ? '动线体检通过 ✓（首页三出口 / 练习去论坛 / 白板回知识点 / 图谱接点名 / 公式与易错在正文可达）'
                   : issues.map { |i| "  ✗ #{i}" }.join("\n")
