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
