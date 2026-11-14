# 消息队列与事件集成

Kafka、RabbitMQ、NATS、Pulsar 使用时明确消息键、顺序性、重复消费处理、确认与重试、死信队列、背压和观察指标。生产消费者变更要验证消费位点和幂等键，防止重放造成重复写入。接口契约采用 OpenAPI、GraphQL、Protocol Buffers 等项目已有规范；配置 YAML、TOML、JSON Schema、HCL 均须由对应解析器校验。

- 参考 https://kafka.apache.org/documentation/ ; https://www.rabbitmq.com/docs ; https://docs.nats.io/ ; https://pulsar.apache.org/docs/
