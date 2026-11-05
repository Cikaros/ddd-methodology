# 分治式设计驱动方法论规范

本规范按域拆分为七份文件，本文件为索引入口，承载索引、设计原则与全局约定。治理类判据不在此列，另立 governance-* 四份技能，其条目见对应技能目录。

| 节 | 所在文件 |
|---|---|
| 0. 问题与解法 | spec.md |
| 1. 角色与交接 | spec-role.md |
| 2. 质量门禁 | spec-gate.md |
| 3. 缺陷四级路由 | spec-gate.md |
| 4. 内敛次序 | spec-design.md |
| 6. 接口先行与冻结 | spec-design.md |
| 7. 并行实现与集成 | spec-design.md |
| 8. 实现与测试分离 | spec-design.md |
| 9. 测试阻塞防护 | spec-design.md |
| 10. 需求变更 | spec-change.md |
| 11. 二次开发 | spec-change.md |
| 12. 渐进式改造 | spec-change.md |
| 13. 声明面可验证与修剪 | spec-declare.md |
| 14. 结构与注释的机械证据 | spec-declare.md |
| 15. 本仓库适用边界 | spec-govern.md |
| 16. 状态文件 | spec-govern.md |
| 17. 结构与契约的演进治理 | spec-govern.md |
| 18. 存量重建 | spec-rebuild.md |
| 19. 绩效度量 | spec-metrics.md |
| 20. 表述与术语 | spec-language.md |

序号 5「粒度与独立性」已撤销，其判据按对象三分：代码粒度、运行时例外与独立性归 governance-code 技能，文档粒度归 governance-document 技能，接近上限口径归 governance-code 技能。序号 13.1「存量债务的登记与清偿」与序号 17 的 17.3、17.5 两条同理移出，见 governance-declaration、governance-code 与 governance-document 技能，故不再列入子节对照。序号留空不重排，使跨文档引用的旧编号可回溯。

## 子节对照

代理提示词与 `SKILL.md` 实际引用的子节在此定位，名称与规范实际标题逐字一致。

| 子节 | 所在文件 |
|---|---|
| 17.1 冻结锚点与接口节 diff | spec-govern.md |
| 18.8 开放与约束 | spec-rebuild.md |
| 18.9 防堆叠约束 | spec-rebuild.md |
| 20.1 分层表述与摘要 | spec-language.md |
| 20.2 术语表 | spec-language.md |
| 20.3 术语的消费与定级 | spec-language.md |
| 20.4 产出者自检 | spec-language.md |

## 0. 问题与解法

单一巨型设计文档使子代理上下文过载，实现随之偏离设计。

解法三条：**文档随架构分治**，每个有实现内容的目录一份 DESIGN；**上下文随职责分治**，代理只加载本阶段所需；**缺陷随层级路由**，小问题就地修，只有设计级及以上才回设计层。

设计原则三条，本节为唯一权威定义处，其余位置只留指针：

1. **判据就近权威单一**：同一事实只在一处定义，其余位置只留指针；判据与执行者就近。
2. **内联即副本且副本受机械校验**：内联摘要是权威的副本，副本漂移由机械校验与文档巡检拦截，冲突时以规范为准。
3. **显式优于隐含**：约定、时序与边界须显式声明，未声明不得推定。

本文后续各节的规则均须可被 Agent 直接执行，判据就近，权威单一。上述三条同时适用于技能本体：同一约束只在一份技能里定义，其余技能只留指针。
