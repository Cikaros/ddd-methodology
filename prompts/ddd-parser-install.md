---
description: 解析器安装入口。当签名级符合性校验所需解析器缺失时使用，先打印安装计划再执行安装。仅由用户显式调用，不自动触发。
---

安装签名级符合性校验所需的解析器与 grammar。

两步依次执行，任一步失败即报错并中止，不继续下一步：

1. 运行 `node <包根>/skills/ddd-methodology/scripts/install-parser.js` 打印安装计划，输出将安装的包清单与安装位置，不触盘。
2. 计划无误后运行 `node <包根>/skills/ddd-methodology/scripts/install-parser.js --install` 执行安装，把锁定版本的包与 grammar 装到用户固定位置。

安装逻辑与版本清单的唯一实现在 `skills/ddd-methodology/scripts/install-parser.js`，本模板只按上述顺序调用，不另写一套。解析器须装在本仓库之外的用户固定位置，否则会被 pi 的 git clean 清除。
