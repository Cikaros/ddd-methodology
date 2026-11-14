# CI/CD 与供应链

按仓库实际配置识别 GitHub Actions、GitLab CI、Jenkins、Argo CD、CircleCI。必须明确最小权限、密钥隔离、锁文件缓存键、不可变构建产物、测试失败停止发布。PR 来自不可信分支时谨慎使用带权限的触发条件，第三方 action 固定可审核版本；失败日志不得包含 secrets。工具如 actionlint、Trivy、Semgrep、Gitleaks、Snyk、OWASP ZAP 需依据项目类型选择并输出真实审计结果；不因缺工具而假定安全。

- 参考 https://docs.github.com/en/actions ; https://docs.gitlab.com/ci/ ; https://argo-cd.readthedocs.io/
