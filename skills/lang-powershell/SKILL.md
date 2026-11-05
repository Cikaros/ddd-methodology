---
name: lang-powershell
description: PowerShell 语言技能，只承载 PSScriptAnalyzer 判不了或反直觉的语义条目，可机械判定的条目落 assets 配置基线。当节点为 detail-design、implement 或 defect-fix 且涉及 .ps1/.psm1 源码，需要决定错误处理策略、$null 比较、输出流、数组展开、ShouldProcess 与引擎版本兼容时读本技能。
---

# PowerShell 语义约束与配置资产

本技能只收不可机械判定或反直觉的条目：错误处理策略择一、`$null` 置于比较左端、输出流择一、单元素自动展开、状态变更函数的 `ShouldProcess`、引擎版本兼容目标。批准动词、cmdlet 别名、单数名词、全局变量、空 catch、位置参数、`[CmdletBinding()]` 与参数属性、尾随空白与缩进等可机械判定的条目一律落入 `assets/PSScriptAnalyzerSettings.psd1`，本正文不重述。

## 何时用

1. 在 detail-design、implement、defect-fix 节点撰写或修改 `.ps1`、`.psm1` 文件，需要决定错误处理、输出契约或版本兼容时。
2. 判断一个 PowerShell 条目该由 PSScriptAnalyzer 机械拦还是只能靠人判断时。
3. 需要落地 PowerShell 配置基线，或核对某条目是否已被基线覆盖时。

## 做什么

1. **错误处理策略择一**：cmdlet 失败默认不抛异常，须在项目内择一——`-ErrorAction Stop` 使其可被 `try/catch` 捕获，或统一设 `$ErrorActionPreference`；同一脚本内不混用两种语义。（官方出处：about_Preference_Variables，https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables ）
2. **`$null` 置于比较左端**：数组与集合在比较左侧会被逐元素展开而返回意外结果，故恒写 `$null -eq $x` 与 `$null -ne $x`，不写 `$x -eq $null`。（官方出处：about_Comparison_Operators，https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comparison_operators ）
3. **输出流择一**：面向管道的数据用 `Write-Output`（或裸表达式）；面向用户的信息用 `Write-Information`；诊断用 `Write-Verbose`/`Write-Warning`/`Write-Error`。功能函数不向管道写日志。（官方出处：Write-Output，https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/write-output ）
4. **单元素自动展开**：函数或管道可能产出单元素时会被解包为标量，须用 `@()` 或 `,` 强制为数组，或声明 `[OutputType([object[]])]` 并在消费端用 `@()` 归一化。（官方出处：about_Arrays，https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_arrays ）
5. **状态变更函数的识别**：判定哪些函数属「状态变更」须按副作用而非命名——凡写入持久存储、删除数据、改变会话或产生不可逆外部效果者皆属；识别准了才能对其施加 `-WhatIf`/`-Confirm` 支持。宣言与调用由 assets 规则拦，识别本身无法机械判定，模型易把只读函数误判为变更或反之。（官方出处：about_Functions_Advanced_Methods，https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_functions_advanced_methods ）
6. **引擎版本兼容目标择一**：脚本声明目标——PowerShell 7（`#requires -Version 7`）或 Windows PowerShell 5.1；择一后不使用非目标特性，也不写只对单版本生效的兼容分支。（官方出处：about_Requires，https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_requires ）

## 不做什么

1. 不写批准动词、cmdlet 别名、单复数名词、全局变量、空 catch、位置参数、`[CmdletBinding()]` 与参数属性、`OutputType` 一致性、尾随空白与缩进风格，那些是机械可判定条目，只在 `assets/PSScriptAnalyzerSettings.psd1` 定义一次。
2. 不承载 shell 脚本条目，那些属 lang-shell。
3. 不承载测试用例设计与缺陷定级，分属 spec-test-case 与 spec-defect-routing。
4. 不收录模型已下意识遵守的通用写法。
5. 不以本技能替代派发任务文本。
