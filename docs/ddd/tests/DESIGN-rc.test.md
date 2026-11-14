---
doc: design
level: file
target: tests/rc.test.mjs
status: frozen
landed: true
covers: [node --experimental-strip-types --test tests/rc.test.mjs]
updated: 2026-11-14
---

# 文件设计：tests/rc.test.mjs — 重构收尾反例集

## 定位与边界

临时目录建立受控项目；验证状态机、用量记录、真实脚本、证据、记忆、子代理以及 RPC；不得联网且不会改变实际仓库代码。

## 输入输出与约束

公开能力：`node --experimental-strip-types --test tests/rc.test.mjs`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

16 个新反例场景，失败必须产生非零退出码。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。
