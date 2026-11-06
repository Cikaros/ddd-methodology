// 目标与范围：TypeScript 覆盖率的配置基线，启用覆盖率、只输出 Cobertura 兼容报告、声明阈值，并注 source map 重映射要求。
// 部署形态：项目更名为 vitest.config.mjs（或并入 vite.config.* 的 test 键）；本资产名 coverage.config.mjs 使跨语言引用统一。
// 命令模板见同目录 commands.json；覆盖是否充分的语义判据归 spec-test-case。
// 官方来源：Vitest 覆盖率指南 https://vitest.dev/guide/coverage ，配置 https://vitest.dev/config/#coverage
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      // 只保留 Cobertura 兼容报告，官方选项名 coverage.reporter；
      // 不取默认报告集 ['text','html','clover','json']，以便统一解析脚本按同一格式判定阈值。
      reporter: ["cobertura"],
      // 阈值，官方选项名 coverage.thresholds（https://vitest.dev/config/#coverage-thresholds）。
      // 默认 80，可被项目覆盖；依据：80 在 Jest 与 JaCoCo 官方示例中即为起点（DESIGN-test-baseline.md 第六节）。
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
      // source map 要求：TS 须把覆盖率重映射回 .ts 源文件，否则阈值判定的对象是编译产物；
      // 前提是 tsconfig.json 产出 source map（reference-test-coverage.md 1.2）。
    },
  },
});
