# 包管理与运行时

检测锁文件而非猜测：package-lock.json→npm ci，pnpm-lock.yaml→pnpm install --frozen-lockfile，yarn.lock→与仓库 Yarn 版本一致；禁止混用锁文件。前端还可能使用 Bun（bun.lock/bun.lockb）或 Deno（deno.json/deno.lock），必须先探测版本与仓库脚本。Python 依赖管理按 pyproject.toml / uv.lock / poetry.lock / pdm.lock 选择 uv、Poetry 或 PDM；PHP 使用 Composer；.NET 使用 NuGet；Rust 使用 Cargo。安装执行可能触发生命周期脚本，需审查可信来源。对 DeepSeek Flash 只给对应生态的命令，不注入全套工具说明。

- 参考 https://docs.npmjs.com/cli/ ; https://pnpm.io/ ; https://bun.sh/docs ; https://docs.deno.com/ ; https://docs.astral.sh/uv/ ; https://python-poetry.org/docs/ ; https://pdm-project.org/ ; https://getcomposer.org/doc/ ; https://learn.microsoft.com/nuget/
