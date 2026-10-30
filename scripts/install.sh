#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 安装脚本（Linux / macOS / Git Bash）
# 用法:
#   ./install.sh                                  全新安装或覆盖更新
#   ./install.sh --check                          检查安装状态
#   ./install.sh --models <配比>                 应用模型配比，配比见 profiles/models.json
#   ./install.sh --models <配比> --set 代理=模型  在配比基础上改单个代理，可重复
#   ./install.sh --models none                   显式跳过模型配比
#   ./install.sh --models <配比> --skip-verify    跳过可用性冒烟
#   ./install.sh --models <配比> --provider <p>   指定 provider，默认取配比文件值
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

# 固定清单：与 agents/ 目录下的 12 个文件一一对应（防止通配符覆盖用户自有 ddd- 前缀代理）
DDD_AGENTS=(ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester ddd-arbiter ddd-doc-sync ddd-auditor ddd-fixer)

# 参数解析：模型配比为可选，不传则不触碰模型设置
CHECK_ONLY=0
MODELS_PROFILE=""
MODEL_SETS=()
SKIP_VERIFY=0
PROVIDER=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) CHECK_ONLY=1; shift ;;
        --models)
            [[ -z "${2:-}" ]] && { echo "[错误] --models 需要配比名，可用：balanced、quality、economy" >&2; exit 1; }
            MODELS_PROFILE="$2"; shift 2 ;;
        --models=*) MODELS_PROFILE="${1#*=}"; shift ;;
        --set)
            [[ -z "${2:-}" ]] && { echo "[错误] --set 需要 代理=模型 形式" >&2; exit 1; }
            MODEL_SETS+=("$2"); shift 2 ;;
        --set=*) MODEL_SETS+=("${1#*=}"); shift ;;
        --skip-verify) SKIP_VERIFY=1; shift ;;
        --provider)
            [[ -z "${2:-}" ]] && { echo "[错误] --provider 需要取值" >&2; exit 1; }
            PROVIDER="$2"; shift 2 ;;
        *) shift ;;
    esac
done

if [[ "$CHECK_ONLY" == "1" ]]; then
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
    for s in trace-check code-health governance-check fingerprint design-root decision-tables ref-check; do
        if [[ -f "$SKILL_DST/scripts/$s.js" ]]; then
            echo "  $s : 已安装"
        else
            echo "  $s : 未安装"
        fi
    done
    if [[ -f "$PI_HOME/extensions/ddd-governance.ts" ]]; then
        echo "  扩展     : 已安装 ($PI_HOME/extensions/ddd-governance.ts)"
    else
        echo "  扩展     : 未安装"
    fi
    if [[ -f "$PI_HOME/.ddd-model-overrides.json" ]]; then
        if command -v node >/dev/null 2>&1; then
            prof=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).profile||'未知')}catch(e){console.log('未知')}" "$PI_HOME/.ddd-model-overrides.json" 2>/dev/null || echo 未知)
            echo "  模型配比 : 已应用，配比 $prof"
        else
            echo "  模型配比 : 已应用"
        fi
    else
        echo "  模型配比 : 未配置，全部代理沿用默认模型"
    fi
    if grep -q "ddd-methodology:begin" "$PI_HOME/APPEND_SYSTEM.md" 2>/dev/null; then
        echo "  全局规则 : 标记区块已部署 ($PI_HOME/APPEND_SYSTEM.md)"
    else
        echo "  全局规则 : 未部署"
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

# 1.6 安装门禁证据脚本
mkdir -p "$SKILL_DST/scripts"
for s in trace-check code-health governance-check fingerprint design-root decision-tables ref-check; do
    if [[ -f "$ROOT/scripts/$s.js" ]]; then
        cp -f "$ROOT/scripts/$s.js" "$SKILL_DST/scripts/"
        echo "[完成] $s -> $SKILL_DST/scripts/$s.js"
    else
        echo "[警告] 缺少 $ROOT/scripts/$s.js" >&2
    fi
done

# 1.7 安装运行时守卫扩展，仅本方法论的固定文件，不触碰用户其他扩展
EXT_DST="$PI_HOME/extensions"
if [[ -f "$ROOT/extensions/ddd-governance.ts" ]]; then
    mkdir -p "$EXT_DST"
    cp -f "$ROOT/extensions/ddd-governance.ts" "$EXT_DST/ddd-governance.ts"
    echo "[完成] 扩展 -> $EXT_DST/ddd-governance.ts"
else
    echo "[警告] 缺少 $ROOT/extensions/ddd-governance.ts" >&2
fi

# 1.8 安装全局规则区块，块级标记合并，区块外用户自定义内容保留
if [[ -f "$ROOT/global/APPEND_SYSTEM.md" ]]; then
    if command -v node >/dev/null 2>&1; then
        node "$ROOT/scripts/merge-append-system.js" install "$ROOT" "$PI_HOME/APPEND_SYSTEM.md" || echo "[警告] 全局规则合并失败" >&2
    else
        echo "[警告] 未找到 node，跳过全局规则安装" >&2
    fi
else
    echo "[警告] 缺少 $ROOT/global/APPEND_SYSTEM.md" >&2
fi

# 2. 安装 12 个 agent 定义（按固定清单，仅覆盖本方法论文件）
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

# 1.9 按代理应用模型配比，仅当用户显式传入 --models 时执行，不传则不动模型设置
if [[ -n "$MODELS_PROFILE" && "$MODELS_PROFILE" != "none" ]]; then
    if command -v node >/dev/null 2>&1; then
        APPLY_ARGS=(apply "$MODELS_PROFILE" --repo "$ROOT")
        [[ "$SKIP_VERIFY" == "1" ]] && APPLY_ARGS+=(--skip-verify)
        [[ -n "$PROVIDER" ]] && APPLY_ARGS+=(--provider "$PROVIDER")
        for s in "${MODEL_SETS[@]:-}"; do
            [[ -n "$s" ]] && APPLY_ARGS+=(--set "$s")
        done
        node "$ROOT/scripts/apply-models.js" "${APPLY_ARGS[@]}"
    else
        echo "[警告] 未找到 node，跳过模型配比应用" >&2
    fi
elif [[ -n "$MODELS_PROFILE" ]]; then
    echo "[提示] 已跳过模型配比，全部代理沿用默认模型"
fi

echo
echo "[成功] 安装完成。在任意 pi 会话中可通过 /skill:ddd-methodology 调用，"
echo "       或直接说\"按 ddd 方法论开发\"触发。卸载请运行 scripts/uninstall.sh。"
