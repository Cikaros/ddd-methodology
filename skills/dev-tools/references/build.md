# 构建工具

识别配置再运行：package.json scripts；vite.config.* → Vite；next.config.* → Next.js；pom.xml → Maven；build.gradle* → Gradle；Cargo.toml → Cargo；go.mod → Go；*.sln / *.csproj → dotnet；pubspec.yaml → Flutter；Makefile/CMakeLists.txt → Make/CMake。JS 生态还可见 Webpack、Rollup、esbuild、Turborepo、Nx、Turbopack；先读取现有脚本，不擅自替换构建器。报告构建命令、退出码、生成产物和失败日志。生产发布不得仅凭开发服务器可运行认定成功。

- 参考 https://vite.dev/guide/ ; https://webpack.js.org/concepts/ ; https://rollupjs.org/ ; https://esbuild.github.io/ ; https://turbo.build/ ; https://nx.dev/
