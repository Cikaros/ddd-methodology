---
name: lang-java
description: Java 语言技能，只承载 checkstyle 判不了或不宜由它判的语义条目，可机械判定的条目落 assets 配置基线。当节点为 detail-design、implement 或 defect-fix 且涉及 .java 源码，需要决定 Javadoc 摘要句式、异常分类边界、Optional 用法边界、静态成员引用与不可变策略时读本技能。
---

# Java 语义约束与配置资产

本技能只收不可机械判定或仅部分可判定的条目：Javadoc 摘要句式、检查型与非检查型异常的边界、对象合约的非机械面、Optional 用法边界、不可变与防御性拷贝、时间 API 选型、可见性与 `var` 使用边界、静态成员引用、`switch` 完备性、局部变量声明位置。导入顺序、通配导入、未使用导入、行长、块缩进与大括号、空 catch、冗余修饰符、`equals`/`hashCode` 成对、`finalize` 等内容一律落入 `assets/checkstyle.xml`，本正文不重述。

## 何时用

1. 在 detail-design、implement、defect-fix 节点撰写或修改 `.java` 文件，需要决定异常分类、对象合约或文档注释句式时。
2. 判断一个 Java 条目该由 checkstyle 机械拦还是只能靠人判断时。
3. 需要落地 Java 配置基线，或核对某条目是否已被基线覆盖时。

## 做什么

1. **Javadoc 摘要句式**：公开类型与成员的文档注释以摘要片段开头，用第三人称、动词开头的完整句，以句号结尾；摘要不重复签名已能表达的信息。句法取向无完整机械判据。（官方出处：Google Java Style 第 7.1.2 节，https://google.github.io/styleguide/javaguide.html#s7.1.2-javadoc ）
2. **异常分类边界择一**：调用方能合理恢复的失败用检查型异常并写入 `throws`；编程错误、前置条件被违反用非检查型异常。同类失败在全项目按同一判据归类，不得同因异判。（官方出处：Oracle 异常教程，https://docs.oracle.com/javase/tutorial/essential/exceptions/ ）
3. **对象合约的非机械面**：参与相等判定的字段须为不变式字段；`toString` 供诊断，不承担解析契约。成对重写 `equals`/`hashCode` 属机械条目，由 `assets/checkstyle.xml` 的 `EqualsHashCode` 拦，本正文不重述。（官方出处：`Object` API「equals 合约」，https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Object.html#equals(java.lang.Object) ）
4. **Optional 用法边界**：`Optional` 只用于可能无值的返回值；不用于字段、方法参数与集合元素，也不用 `Optional.get()` 前不判空。这些是设计约束，非静态检查能全判。（官方出处：`Optional` API，https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Optional.html ）
5. **不可变与防御性拷贝**：公开的集合字段在构造与返回时做防御性拷贝或返回不可变视图，避免外部改写内部状态；不可变类字段用 `final` 并在构造期校验。（官方出处：Oracle 类设计教程，https://docs.oracle.com/javase/tutorial/java/javaOO/ ）
6. **时间 API 择一**：新代码用 `java.time`（`Instant`、`LocalDate`、`Duration`），不用旧 `Date`/`Calendar`/`SimpleDateFormat`。择一后不混用两套 API。（官方出处：Oracle 日期时间教程，https://docs.oracle.com/javase/tutorial/datetime/overview/index.html ）
7. **可见性最小化与 `var` 边界**：无外部消费方的成员取包私有而非 `public`；`var` 只用于右侧类型一目了然的局部变量，公开签名与字段不用 `var`。（官方出处：Oracle 局部变量类型推断，https://docs.oracle.com/en/java/javase/17/language/local-variable-type-inference.html ）
8. **静态成员经类名限定**：静态字段与方法用类名限定引用，不用实例引用访问静态成员。编译器不报错，属语义正确但风格易忽略的约束。（官方出处：Google Java Style 第 6.3 节，https://google.github.io/styleguide/javaguide.html#s6.3-static-members ）
9. **`switch` 覆盖完备**：`switch` 语句须覆盖所有情况或含 `default`；漏 `default` 不触发编译错误，属非强制语法约束。（官方出处：Google Java Style 第 4.8.4 节，https://google.github.io/styleguide/javaguide.html#s4.8.4-switch ）
10. **局部变量就近声明**：局部变量在首次使用时声明、一次声明一个，避免集中堆叠在方法或块头部。（官方出处：Google Java Style 第 4.8.2 节，https://google.github.io/styleguide/javaguide.html#s4.8.2-variable-declarations ）

## 不做什么

1. 不写导入顺序、通配导入、未使用导入、行长、块缩进与大括号风格、空 catch、冗余修饰符、`equals`/`hashCode` 成对与 `finalize`，那些是机械可判定条目，只在 `assets/checkstyle.xml` 定义一次。
2. 不定义 Javadoc 存在性与句号的机械规则，那属 checkstyle 配置；本技能只给句式取向。
3. 不承载测试用例设计与缺陷定级，分属 spec-test-case 与 spec-defect-routing。
4. 不收录模型已下意识遵守的通用写法。
5. 不以本技能替代派发任务文本。
