# 格式化、静态检查

使用仓库现成配置优先：ESLint / Prettier / Biome / Stylelint；Python Ruff、Black、mypy、Pyright；Go gofmt / go vet / golangci-lint；Rust rustfmt / Clippy；C# dotnet format；PHP PHPStan / PHP-CS-Fixer。区分自动修复与只读检查；先运行 check，修复后再次确认。不能因工具不存在而标记“通过”，应标记 unverified 并给出探测事实。风格工具不替代编译和行为测试。

- 参考 https://eslint.org/docs/latest/ ; https://biomejs.dev/ ; https://docs.astral.sh/ruff/ ; https://mypy.readthedocs.io/ ; https://github.com/golangci/golangci-lint
