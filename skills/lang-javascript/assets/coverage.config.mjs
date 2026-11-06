// 目标与范围：JavaScript 覆盖率的配置基线，启用覆盖率、只输出 Cobertura 兼容报告并声明阈值。
// 部署形态：项目选用 Jest 时更名为 jest.config.mjs（或并入 package.json 的 "jest" 键）；本资产名 coverage.config.mjs 使跨语言引用统一。
// 命令模板见同目录 commands.json；覆盖是否充分的语义判据归 spec-test-case。
// 官方来源：Jest 配置文档 https://jestjs.io/docs/configuration

/** @type {import('jest').Config} */
export default {
  // 启用覆盖率采集，官方选项名 collectCoverage（reference-test-coverage.md 1.1 记 CLI 别名 --collectCoverage）。
  collectCoverage: true,
  // 只保留 Cobertura 兼容报告，官方选项名 coverageReporters；
  // 不取默认报告集 ["clover","json","lcov","text"]，以便统一解析脚本按同一格式判定阈值。
  coverageReporters: ["cobertura"],
  // 阈值，官方选项名 coverageThreshold（https://jestjs.io/docs/configuration#coveragethreshold-object）。
  // 默认 80，可被项目覆盖；依据：Jest 官方示例即以 80 为起点（DESIGN-test-baseline.md 第六节）。
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 },
  },
};
