# encoding: UTF-8
# ==========================================================================
# 全站换壳：把 <header class="shell-header"> 换成 IDE 外壳
#   顶部标题栏（品牌 / 面包屑 / 搜索 / 面板开关）+ 左侧活动栏（导航 + 左下角账号）
#   同时注入 assets/css/ide.css 与 assets/js/ide-shell.js
# 可重复执行：已经换过的页面会跳过
# ==========================================================================

ROOT = '/Users/liyuanyuan/Desktop/WKMATH'
DRY = ENV['DRY'] == '1'
ONLY = (ENV['ONLY'] || '').split(',')

# 活动栏条目：key => [href, 名称, 图标]
RAIL = [
  ['home',     'home.html',     '首页',   'house'],
  ['reader',   'reader.html',   '章节',   'book-open'],
  ['graph',    'graph.html',    '图谱',   'git-fork'],
  ['practice', 'practice.html', '练习',   'pencil-line'],
  ['exams',    'exams.html',    '真题',   'clipboard-list'],
  ['methods',  'methods.html',  '方法',   'lightbulb'],
  ['mistakes', 'mistakes.html', '错题本', 'bookmark']
]

# 页面文件 => 活动栏 key（页面自身已标记 data-active 的优先）
PAGE_KEY = {
  'home.html' => 'home',
  'reader.html' => 'reader',
  'chapter.html' => 'reader', 'concept.html' => 'reader', 'concept-3d.html' => 'reader',
  'graph.html' => 'graph',
  'practice.html' => 'practice', 'practice-result.html' => 'practice',
  'exams.html' => 'exams',
  'methods.html' => 'methods', 'formulas.html' => 'methods',
  'mistakes.html' => 'mistakes', 'mistake-detail.html' => 'mistakes'
}.freeze

PANEL_TOGGLES = <<~HTML
          <div class="shell-panels" role="group" aria-label="面板显示">
            <button type="button" class="shell-panel-btn" id="toggle-left" aria-pressed="true"
                    aria-controls="chapter-tree" aria-label="左栏：目录" title="左栏：目录（⌘/Ctrl + B）">
              <i data-lucide="panel-left" class="shell-panel-btn__icon"></i>
            </button>
            <button type="button" class="shell-panel-btn" id="toggle-right" aria-pressed="true"
                    aria-controls="related-quiz" aria-label="右栏：本页目录" title="右栏：本页目录（⌘/Ctrl + ⌥/Alt + B）">
              <i data-lucide="panel-right" class="shell-panel-btn__icon"></i>
            </button>
          </div>
HTML

def build_shell(page_name, html)
  # 页面标题
  title = html[/<title>(.*?)<\/title>/m, 1].to_s.strip

  # 活跃 key：优先页面自身标记，其次按文件名
  key = html[/data-nav-key="(\w+)"[^>]*data-active="true"/, 1] || PAGE_KEY[page_name]
  label = RAIL.find { |r| r[0] == key }&.dig(2)

  # 旧头部里的搜索链接与其他动作链接，原样保留
  old_actions = html[%r{<div class="shell-header__actions">(.*?)</div>}m, 1].to_s
  search = old_actions[%r{<a class="shell-search".*?</a>}m].to_s.strip
  extras = old_actions.scan(%r{<a (?!class="shell-search")[^>]*>.*?</a>}m).map(&:strip)

  rails = RAIL.map do |k, href, name, icon|
    active = (k == key)
    attrs = active ? ' data-active="true" aria-current="page"' : ''
    %(        <a class="ide-rail__item" href="#{href}" data-nav-key="#{k}"#{attrs} ) +
      %(title="#{name}" aria-label="#{name}"><i data-lucide="#{icon}" class="ide-rail__icon"></i></a>)
  end.join("\n")

  crumbs = []
  crumbs << %(          <span class="ide-bar__crumb">#{label}</span>\n          <span class="ide-bar__sep">/</span>) if label
  crumbs << %(          <span class="ide-bar__crumb" data-current="true">#{title}</span>) if title
  crumbs_html = crumbs.empty? ? '' : "\n" + crumbs.join("\n") + "\n        "

  actions = []
  actions << '          ' + search if !search.empty?
  extras.each { |e| actions << '          ' + e }
  actions << PANEL_TOGGLES.rstrip if html.include?('class="reader-shell"')

  <<~HTML

    <header class="ide-bar">
      <div class="ide-bar__inner">
        <a class="ide-bar__brand" href="home.html" data-dom-id="nav-home">
          <span class="ide-bar__mark" aria-hidden="true">初</span>
          <span class="ide-bar__text">
            <span class="ide-bar__name">悟空数学</span>
            <span class="ide-bar__sub">知识图谱</span>
          </span>
        </a>

        <nav class="ide-bar__crumbs" aria-label="当前位置">#{crumbs_html}</nav>

        <div class="ide-bar__actions">
    #{actions.join("\n")}
        </div>
      </div>
    </header>

    <nav class="ide-rail" aria-label="主导航">
      <div class="ide-rail__group">
    #{rails}
      </div>
      <div class="ide-rail__foot">
        <a class="ide-rail__account" href="login.html" title="登录 / 注册" aria-label="登录 / 注册">
          <i data-lucide="user" class="ide-rail__account-icon"></i>
        </a>
        <a class="ide-rail__item" href="settings.html" title="设置" aria-label="设置">
          <i data-lucide="settings" class="ide-rail__icon"></i>
        </a>
      </div>
    </nav>
  HTML
end

changed = []
skipped = []
Dir.glob(File.join(ROOT, '*.html')).sort.each do |path|
  name = File.basename(path)
  html = File.read(path, encoding: 'UTF-8')

  if html.include?('class="ide-rail"')
    skipped << name
    next
  end

  shell = build_shell(name, html)

  if DRY
    next unless ONLY.empty? || ONLY.include?(name)
    puts "===== #{name} ====="
    puts shell
    next
  end

  if html =~ %r{<header class="shell-header">.*?</header>}m
    html = html.sub(%r{[ \t]*<header class="shell-header">.*?</header>\n}m, shell)
  else
    # 没有标准头部的页面（concept.html）：外壳插到 <body> 之后，保留页面自带顶栏
    html = html.sub(/(<body[^>]*>\n)/) { "#{Regexp.last_match(1)}#{shell}" }
  end

  # 注入资源：ide.css 紧跟 shell.css，ide-shell.js 紧跟 shell.js
  inserted_css = false
  inserted_js = false
  lines = html.lines
  out = lines.flat_map do |line|
    buf = [line]
    if !inserted_css && line.include?('assets/css/shell.css')
      indent = line[/^\s*/]
      buf << "#{indent}<link rel=\"stylesheet\" href=\"assets/css/ide.css\">\n"
      inserted_css = true
    end
    if !inserted_js && line.include?('assets/js/shell.js')
      indent = line[/^\s*/]
      buf << "#{indent}<script src=\"assets/js/ide-shell.js\"></script>\n"
      inserted_js = true
    end
    buf
  end
  html = out.join

  unless inserted_css && inserted_js
    indent = '    '
    html = html.sub(%r{</body>}) do
      extra = +''
      extra << "#{indent}<link rel=\"stylesheet\" href=\"assets/css/ide.css\">\n" unless inserted_css
      extra << "#{indent}<script src=\"assets/js/ide-shell.js\"></script>\n" unless inserted_js
      extra + '</body>'
    end
  end

  File.write(path, html, encoding: 'UTF-8')
  changed << name
end

puts "换壳完成: #{changed.length} 个页面"
changed.each { |c| puts "  ✓ #{c}" }
puts "已跳过（先前已换）: #{skipped.length}"
skipped.each { |s| puts "  · #{s}" } unless skipped.empty?
