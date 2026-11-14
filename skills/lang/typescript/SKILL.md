---
name: lang-typescript
description: TypeScript 静态类型、模块与项目构建；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# TypeScript 静态类型

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 严格类型与边界类型先行；优先 unknown + 类型缩小，禁止用 any 掩盖错误。
2. 接口/DTO 使用清晰的可导出类型，避免运行时与类型声明不一致。
3. 模块解析以项目 tsconfig 的 moduleResolution 为准，不擅自改成 CommonJS。

## 常见反例

- tsconfig 与 ESM/CJS 不兼容
- 类型仅存在编译期，外部输入需运行时校验

## 可执行验证（先检测是否安装及配置）

- `npx tsc --noEmit`
- `npm test（按 package.json scripts）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
