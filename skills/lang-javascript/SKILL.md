---
name: lang-javascript
description: JavaScript 语言技能，只承载 eslint 判不了或不宜由它判的语义条目，可机械判定的条目落 assets 配置基线。当节点为 detail-design、implement 或 defect-fix 且涉及 .js/.jsx/.mjs/.cjs 源码，需要决定模块系统、可选链使用边界、this 绑定、枚举对象的替代、BigInt 与不可变策略时读本技能。
---

# JavaScript 语义约束与配置资产

本技能只收不可机械判定或仅部分可判定的条目：模块系统择一、可选链使用边界、`this` 绑定方式、数值精度边界、不可变策略、异步拒绝处理与枚举对象替代。`no-unused-vars`、`no-undef`、`radix`、`use-isnan`、`guard-for-in`、`no-prototype-builtins`、`no-throw-literal`、严格模式、分号、尾逗号、构造器误用、键引号、`require-await`、`no-return-await`、`no-console` 与复杂度/嵌套阈值等可机械判定的条目一律落入 `assets/eslint.config.mjs`，本正文不重述。

## 何时用

1. 在 detail-design、implement、defect-fix 节点撰写或修改 `.js`、`.jsx`、`.mjs`、`.cjs` 文件，需要决定模块系统、异步处理或相等之外的语义时。
2. 判断一个 JavaScript 条目该由 eslint 机械拦还是只能靠人判断时。
3. 需要落地 JavaScript 配置基线，或核对某条目是否已被基线覆盖时。

## 做什么

1. **模块系统择一**：新代码用 ESM（`import`/`export`），由 `package.json` 的 `type` 字段与文件扩展名（`.mjs`/`.cjs`）声明边界；不得在同一文件混用 `import` 与 `require`。择一后全项目一致。（官方出处：Node 包文档 `type` 字段，https://nodejs.org/api/packages.html#type ）
2. **可选链使用边界**：`?.` 只用于「值确实可能缺失」的路径；把必需存在的属性写成可选链会掩盖缺陷，宜让其抛出或断言。无 lint 判据。（官方出处：MDN 可选链，https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining ）
3. **`this` 绑定择一**：需捕获定义处 `this` 的回调用箭头函数；需动态 `this`（如方法被 `.call`/`.apply` 调用）用普通函数。二者语义不同，不得因省事互替。（官方出处：MDN `this`，https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this ）
4. **数值精度边界**：超出 `Number.MAX_SAFE_INTEGER` 的整数、金融计算与超过 53 位精度的场景改用 `BigInt` 或十进制库；浮点结果不直接判等，按 `Number.EPSILON` 比较。（官方出处：MDN BigInt，https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt ）
5. **不可变策略**：跨模块共享的对象在交付前用 `Object.freeze` 或复制隔离；注意 `Object.freeze` 是浅冻结，嵌套对象仍可变，深层不可变须递归或改用不可变库。（官方出处：MDN `Object.freeze`，https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze ）
6. **异步拒绝显式处理**：每个 `async` 调用链须显式处置拒绝——`await` 配 `try`、或 `.catch`、或交 `Promise.allSettled`；不得放任浮空 Promise。通用 JS 环境下无等价于类型检查器的强制手段。（官方出处：MDN Promise，https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise ）
7. **以模式替代枚举对象**：JS 无原生枚举，多用字符串常量与字面量联合语义的常量表替代；确需受限集合时用 `Object.freeze` 的常量映射，不手写可变的「枚举对象」，不依赖对象键存在性做分支。无检查器，且训练语料常含枚举对象。（官方出处：Google JavaScript Style §5.6，https://google.github.io/styleguide/jsguide.html#features-object-literals ）

## 不做什么

1. 不写未使用变量、未定义全局、`parseInt` 基数、`isNaN`、`for...in` 守卫、原型内置方法、抛字符串字面量、严格模式、分号、尾逗号、构造器误用、键引号、`require-await`、`no-return-await`、`no-console`、复杂度与嵌套阈值，那些是机械可判定条目，只在 `assets/eslint.config.mjs` 定义一次。
2. 不承载 TypeScript 的类型系统条目，那些属 lang-typescript。
3. 不承载测试用例设计与缺陷定级，分属 spec-test-case 与 spec-defect-routing。
4. 不收录模型已下意识遵守的通用写法。
5. 不以本技能替代派发任务文本。
