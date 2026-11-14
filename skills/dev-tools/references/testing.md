# 自动化测试

从项目脚本及已安装依赖确定 Runner：Node 的 Vitest/Jest；Web E2E 的 Playwright/Cypress；Python pytest；Java JUnit、Mockito、WireMock、Testcontainers；Go go test；Rust cargo test；.NET dotnet test；API 契约 Pact；压力测试 k6。先最小相关测试，再全量回归。记录命令、退出码、关键失败、项目版本，不接受“AI 看起来没问题”作为验收。对 E2E 避免固定 sleep 与共享账户导致的假不稳定。

- 参考 https://playwright.dev/docs/intro ; https://docs.pytest.org/ ; https://testcontainers.com/ ; https://grafana.com/docs/k6/latest/
