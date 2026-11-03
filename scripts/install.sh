#!/usr/bin/env bash
# ============================================================
# DDD-Methodology 模型配比脚本（Linux / macOS / Git Bash）
#
# 职责收敛：skill、agent、扩展与 workflow 的安装已由 pi package 机制接管，
# 本脚本不再复制任何资源，只承担模型配比一项——调用 apply-models.js 应用 profiles/models.json 的配比。
#
# 安装本方法论本体：
#   pi install git:github.com/Cikaros/ddd-methodology@v0.1.0
#
# 用法:
#   ./install.sh --check                          查看模型配比是否已应用
#   ./install.sh --models <配比>                  应用模型配比，配比见 profiles/models.json
#   ./install.sh --models <配比> --set 代理=模型  在配比基础上改单个代理，可重复
#   ./install.sh --models none                    显式跳过模型配比
#   ./install.sh --models <配比> --skip-verify    跳过可用性冒烟
#   ./install.sh --models <配比> --provider <p>   指定 provider，默认取配比文件值
#
# 移除模型配比请运行 uninstall.sh。
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 仓库根：脚本位于 scripts/ 下，apply-models.js 与 profiles/ 均相对它定位
ROOT="$(dirname "$SCRIPT_DIR")"

if [[ ! -f "$ROOT/scripts/apply-models.js" ]]; then
    echo "[错误] 未找到 scripts/apply-models.js，请在仓库目录内运行。" >&2
    exit 1
fi

PI_HOME="$HOME/.pi/agent"

# 参数解析：模型配比为可选，不传则不改动模型设置
CHECK_ONLY=0
MODELS_PROFILE=""
MODEL_SETS=()
SKIP_VERIFY=0
PROVIDER=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) CHECK_ONLY=1; shift ;;
        --models)
            [[ -z "${2:-}" ]] && { echo "[错误] --models 需要配比名，可用：balanced、quality" >&2; exit 1; }
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
    echo "[检查] 模型配比状态："
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
    exit 0
fi

# 唯一动作：按代理应用模型配比，仅当用户显式传入 --models 时执行，不传则不动模型设置
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
else
    echo "[提示] 未指定 --models，未改动模型设置。"
    echo "       安装本方法论本体请运行：pi install git:github.com/Cikaros/ddd-methodology@v0.1.0"
fi
