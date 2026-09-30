# encoding: UTF-8
# ==========================================================================
# 掌握度色彩方案：**设计用**的小算盘（不是守线，守线是 verify_display.rb 第 6c 节）
#
#   ruby tools/checks/scheme_calc.rb
#
# 用户 2026-09-30 前后四轮，口径最后落在这里：
#   ① 一轮："预设方案一定要色相区分非常明显；要不然分不清问题的状态"
#   ② 二轮："这颜色是不是一模一样 这六组"（套与套之间也得看得出不一样）
#   ③ 三轮："一定要有明亮的颜色……红绿黄蓝紫黑 就这种纯的" → 加了深色底板用亮纯色
#   ④ 四轮："加了颜色，改颜色之后就成黑色背景了，改回去啊" → 底板撤掉
#
# 撤掉底板之后，"看得清"就得是彩条**自己挣来的**：同时压在纯白（亮色主题的底）
# 与纯黑（暗色主题的底）上都要 ≥ 3:1。绿 / 黄 / 青这一片天生亮，高饱和时压白到不了
# 3:1，只能各压深一号 —— 所以这一版是"深一号的纯色"。L 就是按这个反解出来的：
# 给定色相 / 饱和度，二分找到"压白刚好等于目标"的明度。
#
# 这里量三件事（与守恒线同口径）：
#   ① 套内相邻两档色相差 ≥ 30°
#   ② 六个彩色档压纯白 ≥ 3:1 且压纯黑 ≥ 3:1
#   ③ 套与套之间按槽位比 RGB 距离，六个槽位至少四个"明显不同"
# ==========================================================================

SLOTS  = %w[ok gold first learn review weak].freeze
LABELS = %w[精通 已掌握 初步掌握 学习中 待复习 薄弱].freeze
WANT_APART = 4

def hsl2hex(h, s, l)
  h %= 360.0
  s /= 100.0
  l /= 100.0
  c = (1 - (2 * l - 1).abs) * s
  x = c * (1 - ((h / 60.0) % 2 - 1).abs)
  m = l - c / 2
  r, g, b =
    if h < 60 then [c, x, 0]
    elsif h < 120 then [x, c, 0]
    elsif h < 180 then [0, c, x]
    elsif h < 240 then [0, x, c]
    elsif h < 300 then [x, 0, c]
    else [c, 0, x]
    end
  format('#%02x%02x%02x', ((r + m) * 255).round, ((g + m) * 255).round, ((b + m) * 255).round)
end

def rgb_of(hex)
  m = hex.match(/\A#([0-9a-fA-F]{6})\z/)[1]
  [m[0, 2].to_i(16), m[2, 2].to_i(16), m[4, 2].to_i(16)]
end

def lum(hex)
  c = rgb_of(hex).map do |v|
    x = v / 255.0
    x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055)**2.4
  end
  c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
end

def contrast(a, b)
  la = lum(a)
  lb = lum(b)
  hi, lo = [la, lb].max, [la, lb].min
  (hi + 0.05) / (lo + 0.05)
end

def hue_of(hex)
  r, g, b = rgb_of(hex).map { |v| v / 255.0 }
  return nil if (r - g).abs < 0.02 && (g - b).abs < 0.02
  mx = [r, g, b].max
  mn = [r, g, b].min
  d = mx - mn
  h = if mx == r then ((g - b) / d) % 6
      elsif mx == g then ((b - r) / d) + 2
      else ((r - g) / d) + 4
      end
  ((h * 60).round % 360)
end

# 给定色相 / 饱和度，二分出"压纯白刚好等于 target"的明度（压白随明度上升而下降）
def l_for(h, s, target)
  lo = 3.0
  hi = 92.0
  40.times do
    mid = (lo + hi) / 2
    if contrast(hsl2hex(h, s, mid), '#ffffff') >= target then lo = mid else hi = mid end
  end
  lo.round(1)
end

# 每套 = 六个色相 + 一个明度基调（target 越大越深）；饱和度 95 是"纯色"那一档
# （a11y 那套用 62：Okabe–Ito 本来就不那么艳，那是它的职责）。
PLAN = {
  'green'  => { hues: [115, 181, 240, 271, 320, 0],      tier: 3.4 },
  'blue'   => { hues: [100, 145, 240, 285, 335, 27],     tier: 5.6 },
  'violet' => { hues: [145, 210, 50, 250, 335, 14],      tier: 3.9 },
  'amber'  => { hues: [175, 32, 75, 210, 300, 0],        tier: 3.4 },
  'cyan'   => { hues: [145, 32, 100, 210, 285, 350],     tier: 5.6 },
  'a11y'   => { hues: [202, 168, 41, 205, 335, 27],      tiers: [5.0, 3.4, 3.5, 4.4, 4.4, 3.6], sat: 62 }
}.freeze

def hexes_of(name)
  plan = PLAN[name]
  sat = plan[:sat] || 95
  plan[:hues].each_with_index.map do |h, i|
    target = plan[:tiers] ? plan[:tiers][i] : plan[:tier]
    hsl2hex(h, sat, l_for(h, sat, target))
  end
end

bad = 0
PLAN.each do |name, _plan|
  puts "== #{name}"
  prev = nil
  hexes_of(name).each_with_index do |hex, i|
    w = contrast(hex, '#ffffff')
    k = contrast(hex, '#000000')
    hue = hue_of(hex)
    gap = prev ? (d = (hue - prev).abs; d > 180 ? 360 - d : d) : nil
    flag = +''
    flag << ' 压白不足 3:1' if w < 3.0
    flag << ' 压黑不足 3:1' if k < 3.0
    flag << " 色相只差 #{gap}°" if gap && gap < 30
    bad += 1 unless flag.empty?
    puts format('  %-7s %-8s %s  hue=%3d  Δh=%-4s 压白=%.2f 压黑=%.2f%s',
                SLOTS[i], LABELS[i], hex, hue, gap.to_s, w, k, flag)
    prev = hue
  end
end

hexes = PLAN.keys.to_h { |name| [name, hexes_of(name)] }

puts
puts '== 组间差异（按槽位比 RGB 欧氏距离；≥60 算看得出不同）'
pairs = {}
PLAN.keys.combination(2) do |a, b|
  dists = SLOTS.each_index.map do |i|
    ca = rgb_of(hexes[a][i])
    cb = rgb_of(hexes[b][i])
    Math.sqrt(ca.zip(cb).sum { |x, y| (x - y)**2 }).round
  end
  n = dists.count { |d| d >= 60 }
  pairs[[a, b]] = n
  puts format('  %-8s vs %-8s  %s   明显不同：%d/6%s',
              a, b, dists.map { |d| d.to_s.rjust(3) }.join(' '), n,
              n < WANT_APART ? '  <<< 太像' : '')
end

puts
puts(bad.zero? ? '组内检查：全部达标 ✓' : "组内检查：#{bad} 处不达标 ✗")
worst = pairs.min_by { |_, v| v }
puts "组间最弱的一对：#{worst[0].join(' vs ')}（#{worst[1]}/6，要求 ≥ #{WANT_APART}）"
