# Shell 覆盖率基线说明

目标与范围：Shell 覆盖率的配置基线，说明本语言覆盖率工具的形态、无硬门禁的事实与统一解析的接入方式。
命令模板见同目录 commands.json；覆盖是否充分的语义判据归 spec-test-case。

## 工具与官方事实

- kcov（社区，SimonKagstrom）：https://github.com/SimonKagstrom/kcov ，man page https://github.com/SimonKagstrom/kcov/blob/master/doc/kcov.1
  - 无配置文件，全部经命令行参数（如 `--include-path`、`--exclude-path`、`--limits`、`--merge`）。
  - 包裹测试命令运行：`kcov outdir bats tests/`，产出 lcov 风格 HTML、Cobertura 兼容 XML 与通用 JSON；Cobertura 兼容 XML 供统一解析脚本判定阈值。
  - `--limits=low,high`（官方默认 25,75）只控制报告的低/高水位着色，**不构成门禁、不使命令失败**，故本语言覆盖率工具无硬门禁能力。
- bashcov（社区，infertux）：https://github.com/infertux/bashcov ，经 SimpleCov 提供阈值，配置落项目根 `.simplecov` 的 `SimpleCov.minimum_coverage`（SimpleCov 官方 https://github.com/simplecov-ruby/simplecov/blob/main/docs/Configuration.md#coverage-thresholds-and-exit-behavior ）。

## 阈值接入

- 硬门禁不由 kcov 或 bashcov 提供；由统一解析脚本读取 kcov 产出的 Cobertura 兼容 XML 判定。
- 阈值默认 80%，可被项目覆盖（改统一解析脚本的阈值入参）；依据见 DESIGN-test-baseline.md 第六节。
- 不假装工具本身会卡阈值：kcov 的 `--limits` 仅为着色水位，须与真正的阈值判据区分。
