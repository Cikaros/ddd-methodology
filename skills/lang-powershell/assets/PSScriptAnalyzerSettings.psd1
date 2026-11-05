# 目标与范围：PowerShell 机械可判定条目的 PSScriptAnalyzer 配置基线，承载批准动词、
# cmdlet 别名、单数名词、全局变量、空 catch、位置参数、Write-Host、输出类型、命令用法、
# 分号/引号/缩进/空白/花括号/尾随空白等格式，以及明文密码、注释帮助与强制参数默认值。
# 语义判断类条目见 ../SKILL.md。
@{
    Severity     = @('Error', 'Warning')
    IncludeRules = @(
        'PSUseApprovedVerbs'
        'PSUseSingularNouns'
        'PSAvoidUsingCmdletAliases'
        'PSUseCmdletCorrectly'
        'PSAvoidUsingWriteHost'
        'PSUseOutputTypeCorrectly'
        'PSAvoidGlobalVars'
        'PSAvoidUsingEmptyCatchBlock'
        'PSAvoidUsingPositionalParameters'
        'PSUseDeclaredVarsMoreThanAssignments'
        'PSAvoidSemicolonsAsLineTerminators'
        'PSAvoidUsingDoubleQuotesForConstantString'
        'PSUseConsistentIndentation'
        'PSUseConsistentWhitespace'
        'PSPlaceOpenBrace'
        'PSPlaceCloseBrace'
        'PSAvoidTrailingWhitespace'
        'PSAvoidUsingPlainTextForPassword'
        'PSAvoidUsingConvertToSecureStringWithPlainText'
        'PSProvideCommentHelp'
        'PSAvoidDefaultValueForMandatoryParameter'
    )
}
