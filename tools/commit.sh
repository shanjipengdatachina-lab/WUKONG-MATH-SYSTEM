#!/usr/bin/env bash
# ==========================================================================
# 一次标准提交：自检 → 提交 → 推送
#
#   bash tools/commit.sh "这次改了什么"
#
# 约定（见 docs/1.0-版本日志.md 第 5.5 节）：
#   1) 先跑全量自检，不过就中断，绝不把红线代码推进仓库
#   2) .gitignore 已排除自检产物、页面分享包、系统杂项
#   3) 推送走 macOS 钥匙串，不需要再输令牌
#
# 发版（打标签 + 建 Release）不在这里做，见 5.5 节第 5–7 步。
# ==========================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "✗ 缺一句提交说明。用法：bash tools/commit.sh \"这次改了什么\""
  exit 1
fi

echo "→ 1/3 全量自检（不过就不提交）"
set +e
ruby tools/checks/run_all.rb | tail -3
CHECK=${PIPESTATUS[0]}
set -e
if [ "$CHECK" -ne 0 ]; then
  echo
  echo "✗ 自检没通过（退出码 $CHECK），已中断，没有产生提交。"
  echo "  先修问题，再重跑本脚本。"
  exit 1
fi

echo
echo "→ 2/3 提交"
git add -A
if git diff --cached --quiet; then
  echo "  工作区没有新改动，跳过提交"
else
  git commit -m "$MSG"
fi

echo
echo "→ 3/3 推送"
git push

echo
echo "✓ 完成"
echo "  提交：$(git log --oneline -1)"
echo "  状态：$(git status -sb | head -1)"
