#!/usr/bin/env bash
# ==========================================================================
# 首次入库：把本地 悟空数学 项目推到 GitHub 仓库
#   bash tools/first-push.sh                # 用默认提交信息
#   bash tools/first-push.sh "自定义提交信息"
#
# 前置条件：命令行工具已装好（终端里 `git --version` 能打印版本）。
#   如果提示 xcrun 相关错误，先执行：xcode-select --install
#
# 推送时会让你输入账号与密码：
#   用户名 = shanjipengdatachina-lab
#   密码   = 一个 Personal Access Token（不是登录密码）
#   令牌地址：https://github.com/settings/tokens  需要 repo 写权限
# ==========================================================================
set -euo pipefail

REPO_URL="https://github.com/shanjipengdatachina-lab/WUKONG-MATH-SYSTEM.git"
BRANCH="main"
MSG="${1:-1.0：悟空数学首个完整形态（42 页 · 零构建 · 614 条自检全绿）}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v git >/dev/null 2>&1 || ! git --version >/dev/null 2>&1; then
  echo "✗ 这台机器上的 git 还不可用。"
  echo "  请先执行：xcode-select --install"
  echo "  装完再跑一次本脚本。"
  exit 1
fi

echo "→ 工作目录：$ROOT"
echo "→ git 版本：$(git --version)"

if [ ! -d .git ]; then
  echo "→ 初始化仓库（分支 $BRANCH）"
  git init -b "$BRANCH"
else
  echo "→ 已经是 git 仓库，跳过初始化"
  git checkout -B "$BRANCH" >/dev/null 2>&1 || true
fi

echo "→ 暂存文件（.gitignore 已排除自检产物、分享包、系统杂项）"
git add -A

if git diff --cached --quiet; then
  echo "→ 没有新改动，不产生新提交"
else
  git commit -m "$MSG"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi
echo "→ 远端：$(git remote get-url origin)"

echo "→ 开始推送（会要求输入用户名与 Token）"
git push -u origin "$BRANCH"

echo
echo "✓ 完成。仓库地址：https://github.com/shanjipengdatachina-lab/WUKONG-MATH-SYSTEM"
echo "  已提交文件数：$(git ls-files | wc -l | tr -d ' ')"
