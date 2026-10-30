#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 卸载脚本（Linux / macOS / Git Bash）
# 用法: ./uninstall.sh
# 仅移除本方法论安装的固定文件，不影响用户其他配置。
# 固定清单：agents 段为 12 个 ddd 前缀代理；skill 段为下列清单内的三个 skill 目录。
# 白名单语义：卸载逐个移除清单内的 skill 目录，绝不递归删除整个 $PI_HOME/skills/，
# 以免误删用户自有 skill。skill 包整目录移除，故 scripts 段的 ref-check.js 等脚本与共享层
# scripts/lib/text.js、scripts/lib/walk.js 随包一并移除，不另列第二份清单，也不递归删除整个 scripts 目录。
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

PI_HOME="$HOME/.pi/agent"
AGENT_DST="$PI_HOME/agents"

# 固定清单：与 agents/ 目录下的 12 个文件一一对应（防止通配符误删用户自有 ddd- 前缀代理）
DDD_AGENTS=(ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester ddd-arbiter ddd-doc-sync ddd-auditor ddd-fixer)

# 固定清单：本方法论自带的 skill 目录，逐个移除（白名单，不递归删除整个 skills/）
DDD_SKILLS=(ddd-methodology ddd-rebuild ddd-refactor)

echo "[卸载] 目标: $PI_HOME"

if command -v node >/dev/null 2>&1; then
    node "$ROOT/scripts/apply-models.js" clear || echo "[警告] 模型配置移除失败" >&2
    node "$ROOT/scripts/merge-append-system.js" remove "$PI_HOME/APPEND_SYSTEM.md" || echo "[警告] 全局规则移除失败" >&2
else
    echo "[警告] 未找到 node，跳过全局规则移除" >&2
fi

for name in "${DDD_SKILLS[@]}"; do
    dst="$PI_HOME/skills/$name"
    if [[ -d "$dst" ]]; then
        rm -rf "$dst"
        echo "[完成] 已移除 Skill: $dst"
    else
        echo "[提示] Skill 未安装: $name"
    fi
done

EXT_FILE="$PI_HOME/extensions/ddd-governance.ts"
if [[ -f "$EXT_FILE" ]]; then
    rm -f "$EXT_FILE"
    echo "[完成] 已移除运行时守卫扩展: $EXT_FILE"
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
