#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 安装/卸载脚本（Linux / macOS / Git Bash）
# 用法:
#   ./install.sh            全局安装（skill + 7个agent定义）
#   ./install.sh uninstall  全局卸载
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 仓库根：脚本位于 scripts/ 下
ROOT="$(dirname "$SCRIPT_DIR")"

if [[ ! -f "$ROOT/skill/ddd-methodology/SKILL.md" ]]; then
    echo "[错误] 未找到 skill/ddd-methodology/SKILL.md，请在仓库目录内运行。" >&2
    exit 1
fi

PI_HOME="$HOME/.pi/agent"
SKILL_DST="$PI_HOME/skills/ddd-methodology"
AGENT_DST="$PI_HOME/agents"

if [[ "${1:-install}" == "uninstall" ]]; then
    echo "[卸载] 目标: $PI_HOME"
    if [[ -d "$SKILL_DST" ]]; then
        rm -rf "$SKILL_DST"
        echo "[完成] 已移除 Skill: $SKILL_DST"
    else
        echo "[提示] Skill 未安装"
    fi
    count=0
    if [[ -d "$AGENT_DST" ]]; then
        for f in "$AGENT_DST"/ddd-*.md; do
            [[ -e "$f" ]] || continue
            rm -f "$f"
            count=$((count+1))
        done
    fi
    echo "[完成] 已移除 ${count} 个 ddd-* agent 定义"
    echo "[成功] 卸载完成。"
    exit 0
fi

echo "[安装] 目标: $PI_HOME"

# 1. 安装 Skill
if [[ -d "$SKILL_DST" ]]; then
    echo "[提示] 已存在 $SKILL_DST，先移除旧版。"
    rm -rf "$SKILL_DST"
fi
mkdir -p "$(dirname "$SKILL_DST")"
cp -r "$ROOT/skill/ddd-methodology" "$SKILL_DST"
echo "[完成] Skill  -> $SKILL_DST"

# 1.5 安装 Workflow 脚本（作为 skill 包的一部分，供 subagent workflow 调用）
if [[ -d "$ROOT/workflows" ]]; then
    mkdir -p "$SKILL_DST/workflows"
    cp -r "$ROOT"/workflows/* "$SKILL_DST/workflows/"
    echo "[完成] Workflow -> $SKILL_DST/workflows"
fi

# 2. 安装 agent 定义
mkdir -p "$AGENT_DST"
count=0
for f in "$ROOT"/agents/ddd-*.md; do
    cp -f "$f" "$AGENT_DST/"
    count=$((count+1))
done
echo "[完成] Agents -> $AGENT_DST （${count} 个）"

echo
echo "[成功] 安装完成。在任意 pi 会话中可通过 /skill:ddd-methodology 调用，"
echo "       或直接说\"按 ddd 方法论开发\"触发。"
