#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 安装脚本（Linux / macOS / Git Bash）
# 用法:
#   ./install.sh            全新安装 / 覆盖更新（幂等，自动替换旧版）
#   ./install.sh --check    检查当前安装状态与版本
# 卸载请使用 uninstall.sh。
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

# 固定清单：与 agents/ 目录下的 8 个文件一一对应（防止通配符覆盖用户自有 ddd- 前缀代理）
DDD_AGENTS=(ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester)

if [[ "${1:-}" == "--check" ]]; then
    echo "[检查] 安装状态："
    if [[ -f "$SKILL_DST/SKILL.md" ]]; then
        echo "  Skill    : 已安装 ($SKILL_DST)"
    else
        echo "  Skill    : 未安装"
    fi
    ok=0
    for name in "${DDD_AGENTS[@]}"; do
        [[ -f "$AGENT_DST/$name.md" ]] && ok=$((ok+1))
    done
    echo "  Agents   : $ok / ${#DDD_AGENTS[@]} 已安装"
    if [[ -f "$SKILL_DST/workflows/ddd-workflow.js" ]]; then
        echo "  Workflow : 已安装 ($SKILL_DST/workflows/ddd-workflow.js)"
    else
        echo "  Workflow : 未安装"
    fi
    exit 0
fi

echo "[安装] 目标: $PI_HOME（已存在旧版将自动覆盖更新）"

# 1. 安装 Skill（整个目录替换，幂等）
if [[ -d "$SKILL_DST" ]]; then
    echo "[提示] 检测到旧版，覆盖更新。"
    rm -rf "$SKILL_DST"
fi
mkdir -p "$(dirname "$SKILL_DST")"
cp -r "$ROOT/skill/ddd-methodology" "$SKILL_DST"
echo "[完成] Skill  -> $SKILL_DST"

# 1.5 安装 Workflow 加速档脚本（仓库根 workflows/ → skill 包内 workflows/）
if [[ -d "$ROOT/workflows" ]]; then
    mkdir -p "$SKILL_DST/workflows"
    cp -r "$ROOT"/workflows/* "$SKILL_DST/workflows/"
    echo "[完成] Workflow -> $SKILL_DST/workflows/"
fi

# 1.6 安装追溯校验脚本（G2/G4/G5 门禁证据工具）
if [[ -f "$ROOT/scripts/trace-check.js" ]]; then
    mkdir -p "$SKILL_DST/scripts"
    cp -f "$ROOT/scripts/trace-check.js" "$SKILL_DST/scripts/"
    echo "[完成] trace-check -> $SKILL_DST/scripts/trace-check.js"
fi

# 2. 安装 8 个 agent 定义（按固定清单，仅覆盖本方法论文件）
mkdir -p "$AGENT_DST"
count=0
for name in "${DDD_AGENTS[@]}"; do
    src="$ROOT/agents/$name.md"
    if [[ -f "$src" ]]; then
        cp -f "$src" "$AGENT_DST/$name.md"
        count=$((count+1))
    else
        echo "[警告] 缺少 $src" >&2
    fi
done
echo "[完成] Agents -> $AGENT_DST （${count} 个）"

echo
echo "[成功] 安装完成。在任意 pi 会话中可通过 /skill:ddd-methodology 调用，"
echo "       或直接说\"按 ddd 方法论开发\"触发。卸载请运行 scripts/uninstall.sh。"
