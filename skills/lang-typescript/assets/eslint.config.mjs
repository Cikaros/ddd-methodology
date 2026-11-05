// 目标与范围：TypeScript 可机械判定条目的 typescript-eslint 扁平配置基线，
// 承载显式 any、浮空 Promise、误用 Promise、非 thenable 的 await、返回类型标注、
// 类型导入一致性、严格布尔、命名约定、不安全类型操作、命名空间与不安全断言等。
// 语义判断类条目见 ../SKILL.md。
// 需类型信息的规则要求项目在 parserOptions.project 指向 tsconfig。
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "typeLike", format: ["PascalCase"] },
      ],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
);
