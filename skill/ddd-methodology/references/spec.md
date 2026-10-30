# 分治式设计驱动方法论规范

本规范按域拆分为八个文件，本文件为索引入口，承载索引、「问题与解法」与全局约定；各节与其所在文件的对照见下表。

| 节 | 所在文件 |
|---|---|
| 0. 问题与解法 | spec.md |
| 1. 角色与交接 | spec-role.md |
| 2. 质量门禁 | spec-gate.md |
| 3. 缺陷四级路由 | spec-gate.md |
| 4. 粒度与独立性 | spec-design.md |
| 5. 接口先行与冻结 | spec-design.md |
| 6. 并行实现与集成 | spec-design.md |
| 7. 实现与测试分离 | spec-design.md |
| 8. 测试阻塞防护 | spec-design.md |
| 9. 需求变更 | spec-change.md |
| 10. 二次开发 | spec-change.md |
| 11. 渐进式改造 | spec-change.md |
| 12. 声明面可验证与修剪 | spec-declare.md |
| 13. 结构与注释的机械证据 | spec-declare.md |
| 14. 本仓库适用边界 | spec-govern.md |
| 15. 状态文件 | spec-govern.md |
| 16. 结构与契约的演进治理 | spec-govern.md |
| 17. 存量重建 | spec-rebuild.md |

## 0. 问题与解法

单一巨型设计文档使子代理上下文过载，实现随之偏离设计。

解法三条：**文档随架构分治**，每个有实现内容的目录一份 DESIGN；**上下文随职责分治**，代理只加载本阶段所需；**缺陷随层级路由**，小问题就地修，只有设计级及以上才回设计层。

本文后续各节的规则均须可被 Agent 直接执行，判据就近，权威单一。
