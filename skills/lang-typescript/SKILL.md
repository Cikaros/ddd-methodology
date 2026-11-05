---
name: lang-typescript
description: TypeScript 语言技能，只承载类型系统判不了或反直觉的语义条目，严格选项与可机械判定的 lint 条目落 assets 配置基线。当节点为 detail-design、implement 或 defect-fix 且涉及 .ts/.tsx 源码，需要决定 ?? 与 || 之分、unknown 与 any、断言与守卫、interface 与 type、enum 与字面量联合、成员可见性时读本技能。
---

# TypeScript 语义约束与配置资产

本技能只收不可机械判定或反直觉的条目：`??` 与 `||` 之分、边界处的 `unknown`、断言与类型守卫的边界、`interface` 与 `type` 择一、`enum` 与字面量联合择一、泛型约束尺度、成员可见性修饰符。严格模式选项与可机械判定的 lint 条目（`no-explicit-any`、`no-floating-promises`、`no-misused-promises`、`await-thenable`、`explicit-function-return-type`、`consistent-type-imports`、`strict-boolean-expressions`、`naming-convention`、`no-unsafe-*`、`no-namespace` 等）一律落入 `assets/tsconfig.strict.json` 与 `assets/eslint.config.mjs`，本正文不重述。

## 何时用

1. 在 detail-design、implement、defect-fix 节点撰写或修改 `.ts`、`.tsx` 文件，需要决定空值合并语义、边界类型或类型声明形态时。
2. 判断一个 TypeScript 条目该由编译器或 lint 机械拦还是只能靠人判断时。
3. 需要落地 TypeScript 配置基线，或核对某条目是否已被基线覆盖时。

## 做什么

1. **`??` 与 `||` 之分**：只在需要「仅对 `null`/`undefined` 回退」时用 `??`；用 `||` 会把 `0`、`""`、`false` 也当作缺失而意外回退。二者语义不同，按默认值的确切条件选取。（官方出处：TS 3.7 发布说明空值合并，https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing ）
2. **边界处用 `unknown`**：外部输入、反序列化结果与 catch 变量先建模为 `unknown`，再用类型守卫收窄；`any` 绕过检查且会传染，边界处不用。`no-explicit-any` 拦显式 `any`，但「边界该用 `unknown`」是判断。（官方出处：TS 收窄文档，https://www.typescriptlang.org/docs/handbook/2/narrowing.html ）
3. **断言与类型守卫边界**：跨模块边界的数据须经类型守卫（`x is T`）或运行时校验函数收窄后才能使用，不得仅凭编译期类型而信任外部输入；守卫与断言的取舍属判断，断言的机械约束由 assets 拦。（官方出处：TS 收窄文档，https://www.typescriptlang.org/docs/handbook/2/narrowing.html ）
4. **`interface` 与 `type` 择一**：需声明合并或扩展继承的对象形状用 `interface`；联合、元组、映射类型与需精确别名处用 `type`。二者在多数场景可互换，须在项目内择一原则并一致。（官方出处：TS 日常类型「类型别名与接口之别」，https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces ）
5. **`enum` 与字面量联合择一**：多数场景用字符串字面量联合，编译器可穷尽检查且无运行时产物；仅在确需反向映射或运行时常量对象时用 `enum`。（官方出处：TS 枚举文档，https://www.typescriptlang.org/docs/handbook/enums.html ）
6. **泛型约束的尺度**：对泛型参数施加最小必要约束（`extends`），不早施加无关约束；约束不足导致调用点难用、约束过强导致复用受限，均属判断。（官方出处：TS 泛型文档，https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-constraints ）
7. **类成员显式标注可见性**：类字段与方法显式写 `public`/`protected`/`private`（或 `#` 私有字段），不依赖默认公开；默认公开下模型易省略修饰符而模糊边界。（官方出处：Google TS 风格指南「可见性」，https://google.github.io/styleguide/tsguide.html ）

## 不做什么

1. 不写严格模式选项（`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 等），也不写 `no-explicit-any`、`no-floating-promises`、`no-misused-promises`、`await-thenable`、`explicit-function-return-type`、`consistent-type-imports`、`strict-boolean-expressions`、`naming-convention`、`no-unsafe-*`、`no-namespace`、`no-non-null-assertion`，那些是机械可判定条目，只在 `assets/tsconfig.strict.json` 与 `assets/eslint.config.mjs` 定义一次。
2. 不承载 JavaScript 语言条目（模块系统、`this` 绑定等），那些属 lang-javascript。
3. 不承载测试用例设计与缺陷定级，分属 spec-test-case 与 spec-defect-routing。
4. 不收录模型已下意识遵守的通用写法。
5. 不以本技能替代派发任务文本。
