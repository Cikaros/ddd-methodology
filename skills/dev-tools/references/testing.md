# 测试运行器使用约定

## 各生态

- **vitest**（前端/TS）：`npx vitest run`；单文件 `npx vitest run path`。
- **jest**：`npx jest`；单文件 `npx jest path`。
- **pytest**：`python -m pytest -q`；单测 `pytest path::test_name`。
- **junit**（Java）：`mvn -q test` 或 `./gradlew test`；单测 `-Dtest=Name`。
- **node:test**（本仓无模型自测）：`node --test "test/**/*.test.js"`。

## 失败定位

- 先看\*\*首个失败\*\*与断言差异，不追末端连锁失败。
- 区分「**未落地**」（用例尚未实现，报“待落地”）与「**缺陷**」（实现错）——两个读数。

## 纪律

- 测试以 `node`/语言运行时**具名启动**，不得以宿主进程身份启动（§8.7）。
- 测试运行器失败即门禁 `block`（G5 / §十二），带 remedy。
