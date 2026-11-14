# 监控、性能与问题定位

按环境选择 Prometheus、Grafana、OpenTelemetry、Sentry、Loki、ELK。用 traceId 将日志、指标、追踪关联，不把 PII、认证信息或高基数无限标签写入观测系统。接口测试与调试可用 curl、HTTPie、Postman、Insomnia、Bruno、Swagger UI、grpcurl。CLI 辅助工具包括 jq、yq、ripgrep、fd、gh、glab。k6 负载测试需先限定压测环境和请求上限。

- 参考 https://opentelemetry.io/docs/ ; https://prometheus.io/docs/ ; https://grafana.com/docs/
