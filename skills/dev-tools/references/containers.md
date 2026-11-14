# 容器与编排

Docker / Docker Compose 检查镜像来源、卷和端口、环境变量注入；避免将 secrets 写入 Dockerfile 或日志。Kubernetes 使用 kubectl、Helm、Kustomize（或 Podman 作为容器替代）时先检查 namespace 和当前 context，生产变更先 diff/dry-run；部署资源请求、探针、就绪与回滚均要可验证。Terraform/OpenTofu/Ansible/Packer 属基础设施管理，先 plan / check，再经过授权 apply。

- 参考 https://docs.docker.com/ ; https://kubernetes.io/docs/ ; https://helm.sh/docs/ ; https://developer.hashicorp.com/terraform/docs ; https://opentofu.org/docs/
