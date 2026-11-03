#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 模型配比移除脚本（Linux / macOS / Git Bash）
#
# 职责收敛：skill、agent、扩展与 workflow 的移除已由 pi package 机制接管，
# 本脚本不再删除任何随装资源，只承担模型配比一项——调用 apply-models.js 撤回本方法论写入的模型配置。
#
# 保留 ~/.pi/agent/settings.json 的 subagents.agentOverrides：该覆写对 package agent 仍然生效，
# 脚本不触碰它；apply-models.js 只撤回本方法论记录在案的写入，用户自有配置原样保留。
#
# 移除本方法论本体：
#   pi remove ddd-methodology
#
# 用法: ./uninstall.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

if [[ ! -f "$ROOT/scripts/apply-models.js" ]]; then
    echo "[错误] 未找到 scripts/apply-models.js，请在仓库目录内运行。" >&2
    exit 1
fi

echo "[移除] 撤回本方法论写入的模型配比"
if command -v node >/dev/null 2>&1; then
    node "$ROOT/scripts/apply-models.js" clear || echo "[警告] 模型配比撤回失败" >&2
else
    echo "[警告] 未找到 node，跳过模型配比撤回" >&2
fi

echo "[成功] 模型配比移除完成。settings.json 的 subagents.agentOverrides 未改动，对 package agent 仍然生效。"
echo "       移除本方法论本体请运行：pi remove ddd-methodology"
