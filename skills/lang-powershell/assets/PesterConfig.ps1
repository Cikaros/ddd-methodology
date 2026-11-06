# 目标与范围：PowerShell 覆盖率的 Pester 配置基线，构造启用覆盖率、输出 Cobertura 兼容 XML 并声明目标值的配置对象。
# 部署形态：由测试入口脚本（如 run.ps1）dot-source 后传入 Invoke-Pester，或在本文件末尾直接调用；命令模板见同目录 commands.json。
# 覆盖是否充分的语义判据归 spec-test-case。
# 官方来源：https://pester.dev/docs/usage/code-coverage ，帮助源 https://github.com/pester/Pester/blob/main/src/en-US/about_PesterConfiguration.help.txt

$config = New-PesterConfiguration

# 启用覆盖率，官方属性名 CodeCoverage.Enabled（默认 $false）。
$config.CodeCoverage.Enabled = $true

# 输出格式，官方属性名 CodeCoverage.OutputFormat（默认 'JaCoCo'）。
# 取 'Cobertura'，以便统一解析脚本按同一格式判定阈值，不取默认 'JaCoCo'。
$config.CodeCoverage.OutputFormat = 'Cobertura'

# 输出路径，官方属性名 CodeCoverage.OutputPath（默认 'coverage.xml'）。
$config.CodeCoverage.OutputPath = 'coverage.xml'

# 目标值，官方属性名 CodeCoverage.CoveragePercentTarget（默认 75）。
# 取 80 作跨语言默认，可被项目覆盖。
# 语义：该项为报告目标与进度标尺，Pester 不会因未达标使进程退出非零，属软判据；
# 硬门禁由统一解析脚本读取 OutputPath 的 Cobertura 兼容 XML 补齐。
$config.CodeCoverage.CoveragePercentTarget = 80

# 被测范围，官方属性名 CodeCoverage.Path（string[]，可选）。解除注释即限定被测路径。
# $config.CodeCoverage.Path = @('./src')
