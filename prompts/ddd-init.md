---
description: 初始化 DDD 项目骨架：落 AGENTS.md、GLOSSARY.md 与两份项目级代理定义。当首次在项目中启用本方法论时使用。
---

在当前项目初始化 DDD 项目级骨架。

下列四项逐项幂等落盘，已存在即跳过且不覆盖，因为初始化后四项归项目所有，项目可自迭代，插件不得回写：

1. 项目级审计者代理定义，落 `<项目根>/.pi/agents/ddd-auditor.md`，模板取 `skills/ddd-methodology/assets/agent-templates/ddd-auditor.md`。
2. 项目级文档同步者代理定义，落 `<项目根>/.pi/agents/ddd-doc-sync.md`，模板取 `skills/ddd-methodology/assets/agent-templates/ddd-doc-sync.md`。
3. 项目级指令文件 `<项目根>/AGENTS.md`，模板取 `skills/ddd-methodology/assets/project-templates/AGENTS.md`。
4. 项目术语表 `<项目根>/GLOSSARY.md`，模板取 `skills/ddd-methodology/assets/project-templates/GLOSSARY.md`。

初始化只落骨架，填充归对应阶段：`AGENTS.md` 五节内容与 `GLOSSARY.md` 术语条目由架构设计者产出初版，此后按项目级维护机制演进。术语的唯一权威处只有 `<项目根>/GLOSSARY.md` 一处，其他产物引用术语须与之一致。

执行前先核对宿主前置：本包已由 `pi install` 安装，且宿主 pi 版本落于 `docs/COMPATIBILITY.md` 声明的范围内；缺失任一项即停止并提示补足。
