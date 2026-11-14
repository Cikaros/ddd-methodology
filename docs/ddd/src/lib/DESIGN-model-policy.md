---
doc: design
level: file
target: src/lib/model-policy.ts
status: frozen
landed: true
covers: [isFlash, contextBudget, asData, composeContext]
updated: 2026-11-14
---

# 文件设计：src/lib/model-policy.ts

## 定位与边界

根据当前模型身份限制插件自身的动态上下文，不改变宿主模型选择或推理协议。

## 对外暴露接口

识别 deepseek-flash 别名，按预算将切片定位、看板、记忆和证据错误压入单个系统片段。

## 需引入的依赖

只依赖 TypeScript；context hook 调用，具体入口由 OpenCode 宿主执行。

## 调用的模块能力及接口

遵循方法论的文档先行原则；可机械验证的断言必须基于当前实物。业务语义无法通过静态扫描证明时不声称通过。

## 2.0.0 阶段预算

按 Flash 识别、phase 与意图选择额外字符额度；`estimateTokens` 仅为粗估不能代替宿主 tokenizer。保持固定 runtime 前缀，按优先级放置错误、检查点、切片、看板与记忆，不修改 DeepSeek 推理或 tools 参数。

## 2.0.0 收尾契约（2026-11-14）

**Flash 上下文预算与任务数据封装**：按模式/复杂度/配置档位分配 extra context 字符上界，动态证据优先；以 estimateTokens 估算，仅作近似，不宣称准确 token 或缓存收益。

## 2.0.1 补充

`composeContext` 可选 `skills` ID 数组（最多五项），作为阶段化小体积元数据；不得将全部 Skill 正文写入 Flash 的上下文。
