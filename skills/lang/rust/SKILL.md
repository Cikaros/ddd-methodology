---
name: lang-rust
description: Rust 所有权、错误边界及 Cargo 工程；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Rust 所有权

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 公开 API 优先 Result/Option，不用 unwrap/expect 掩盖可恢复错误。
2. 所有权与生命周期优先简化数据流，避免不必要的 clone。
3. unsafe 必须限定范围并说明不变量。

## 常见反例

- 错误链丢失
- 异步生命周期或 Send/Sync 约束未满足

## 可执行验证（先检测是否安装及配置）

- `cargo fmt --check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
