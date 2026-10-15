#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 卸载脚本（Linux / macOS / Git Bash）
# 用法: ./uninstall.sh
# 仅移除本方法论安装的固定文件，不影响用户其他配置。
# ============================================================
set -euo pipefail

PI_HOME="$HOME/.pi/agent"
SKILL_DST="$PI_HOME/skills/ddd-methodology"
AGENT_DST="$PI_HOME/agents"

# 固定清单：与 agents/ 目录下的 7 个文件一一对应（防止通配符误删用户自有 ddd- 前缀代理）
DDD_AGENTS=(ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester)

echo "[卸载] 目标: $PI_HOME"

if [[ -d "$SKILL_DST" ]]; then
    rm -rf "$SKILL_DST"
    echo "[完成] 已移除 Skill: $SKILL_DST"
else
    echo "[提示] Skill 未安装"
fi

count=0
for name in "${DDD_AGENTS[@]}"; do
    f="$AGENT_DST/$name.md"
    if [[ -f "$f" ]]; then
        rm -f "$f"
        count=$((count+1))
    fi
done
echo "[完成] 已移除 ${count} 个 ddd agent 定义"

echo "[成功] 卸载完成。"
