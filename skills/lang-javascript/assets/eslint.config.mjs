// 目标与范围：JavaScript 机械可判定条目的 ESLint 扁平配置基线，承载未使用变量、
// 未定义全局、严格模式、分号与尾逗号、构造器误用、键引号、parseInt 基数、isNaN、
// for...in 守卫、异步残留、冗余 await、console、宽松 null 比较与复杂度/嵌套阈值。
// 语义判断类条目见 ../SKILL.md。
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": ["error", { args: "after-used" }],
      "no-undef": "error",
      "no-implicit-globals": "error",
      strict: ["error", "safe"],
      semi: ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "no-array-constructor": "error",
      "no-object-constructor": "error",
      "quote-props": ["error", "as-needed"],
      "no-throw-literal": "error",
      radix: "error",
      "use-isnan": "error",
      "no-prototype-builtins": "error",
      "no-new-wrappers": "error",
      "guard-for-in": "error",
      "no-fallthrough": "error",
      "require-await": "error",
      "no-return-await": "error",
      "no-console": "error",
      "no-eq-null": "error",
      complexity: ["error", 10],
      "max-depth": ["error", 4],
    },
  },
];
