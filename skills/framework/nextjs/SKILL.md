---
name: framework-nextjs
description: Next.js App Router、缓存与服务端界限；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Next.js App Router

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. Server Component / Client Component 边界明确。
2. 数据缓存、动态渲染和重新验证按当前项目版本核对。
3. 认证授权在服务端强制，不能只靠客户端路由。

## 常见反例

- 误把服务器秘密传入客户端
- 缓存策略不匹配导致过期页面

## 可执行验证（先检测是否安装及配置）

- `npm run build`
- `npm test（如配置）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
