# 包管理器使用约定

## 锁文件

- 锁文件（`package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`/`Cargo.lock`）**必入版本控制**且与清单同步。
- 依赖变更须与锁文件一并提交，禁止手工编辑锁文件。

## 版本纪律

- 新增依赖先查形态（peer / dev / 运行期外部）并写入 `docs/ARCHITECTURE.md`。
- 不盲升大版本；升版本属变更，走变更流与版本落点三处（§十一）。

## 常用

- Node：`npm ci`（干净安装）/ `npm install <pkg> --save-dev`。
- Python：`python -m venv .venv` + `pip install -r requirements.txt`；锁用 `pip freeze` 或 `uv`.
- Rust：`cargo add` / `cargo update`；锁文件随提交。

> 只写用法与判断，不复制工具默认配置。
