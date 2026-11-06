---
description: 初始化 DDD 项目骨架：落 AGENTS.md、GLOSSARY.md 与两份项目级代理定义，并探测本机工具链落环境记录。当首次在项目中启用本方法论时使用。
---

在当前项目初始化 DDD 项目级骨架。

下列四项骨架逐项幂等落盘，已存在即跳过且不覆盖，因为初始化后四项归项目所有，项目可自迭代，插件不得回写：

1. 项目级审计者代理定义，落 `<项目根>/.pi/agents/ddd-auditor.md`，模板取 `skills/ddd-methodology/assets/agent-templates/ddd-auditor.md`。
2. 项目级文档同步者代理定义，落 `<项目根>/.pi/agents/ddd-doc-sync.md`，模板取 `skills/ddd-methodology/assets/agent-templates/ddd-doc-sync.md`。
3. 项目级指令文件 `<项目根>/AGENTS.md`，模板取 `skills/ddd-methodology/assets/project-templates/AGENTS.md`。
4. 项目术语表 `<项目根>/GLOSSARY.md`，模板取 `skills/ddd-methodology/assets/project-templates/GLOSSARY.md`。

环境探测顺次列于四项之后，与前四项同一批执行，但幂等策略不同：

5. 运行 `node skills/ddd-methodology/scripts/env-probe.js <项目根绝对路径>`，把四类工具的路径、版本与可用性，各工具的管理器与可用版本清单及当前激活版本，以及由工具推导出的各语言可用命令形态写入机读件 `<项目根>/docs/.ddd-env.json`（顶层结构固定为 `probedAt`、`tools`、`languages` 三键；`tools` 每项六键：`path`、`version`、`available`、`manager`、`versions`、`active`；项目声明的所需版本以可选的 `required` 字段给出）。该件反映本机工具链，随机器而异，已存在即重新探测并覆盖，不得沿用陈旧记录——沿用会让后续节点按过时的形态组装命令。该件不纳入版本控制，理由见项目级指令文件的环境记录指针与 `skills/ddd-methodology/references/spec-govern.md` 的状态文件节。

同一工具的多个版本共存时一并记录：`nvm`、`fnm`、`volta`、`uv`、`pyenv`、`sdkman`、`jenv` 及通用管理器 `mise`、`asdf` 在位者，经其列出命令取可用版本清单记入 `versions`，取不到时只降级为单一版本文本，不报缺陷；不在位者只记单一命令与版本文本。`manager` 记管理器名或空串，`active` 记当前激活版本，恒与 `version` 同值。

后续节点的命令经两级解析组装：先由所需版本与切换形态得版本前缀，再与环境形态拼合（例：python 由 `uv` 管理而所需为 `3.11` 时，`{runner} -m pytest` 解析为 `uv run --python 3.11 -m pytest`）。所需版本可写入该件的 `required` 字段或本节文本，两者同时存在时以机读件为准；**未声明时不拦，只按激活版本执行**，声明时须落在该工具的 `versions` 清单内。切换只以逐命令形态表达，不得为取版本而改动全局激活状态。

探测只查本机，不访问网络；某项工具缺失不报缺陷，只在该件中记为不可用。后续节点的测试与覆盖率命令按该件解析后组装，不得回落到写死的调用形态。

初始化只落骨架，填充归对应阶段：`AGENTS.md` 五节内容与 `GLOSSARY.md` 术语条目由架构设计者产出初版，此后按项目级维护机制演进。术语的唯一权威处只有 `<项目根>/GLOSSARY.md` 一处，其他产物引用术语须与之一致。

执行前先核对宿主前置：本包已由 `pi install` 安装，且宿主 pi 版本落于 `docs/COMPATIBILITY.md` 声明的范围内；缺失任一项即停止并提示补足。
