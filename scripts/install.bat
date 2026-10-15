@echo off
rem ============================================================
rem DDD-Methodology 安装脚本（Windows）
rem 用法:
rem   install.bat           全新安装 / 覆盖更新（幂等）
rem   install.bat --check   检查安装状态
rem 卸载请使用 uninstall.bat。
rem ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

rem 定位仓库根目录（本脚本所在目录的上一级）
set "SRC=%~dp0"
set "ROOT=%SRC%..\"

if not exist "%ROOT%skill\ddd-methodology\SKILL.md" (
    echo [错误] 未找到 skill\ddd-methodology\SKILL.md，请在仓库目录内运行。
    exit /b 1
)

set "PI_HOME=%USERPROFILE%\.pi\agent"
set "SKILL_DST=%PI_HOME%\skills\ddd-methodology"
set "AGENT_DST=%PI_HOME%\agents"

rem 固定清单：与 agents\ 目录下 9 个文件一一对应（防止通配符覆盖用户自有 ddd- 前缀代理）
set DDD_AGENTS=ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester ddd-arbiter

if "%~1"=="--check" goto :check

:install
echo [安装] 目标: %PI_HOME%（已存在旧版将自动覆盖更新）

rem 1. 安装 Skill（整个目录替换，幂等；workflow 随目录一并安装）
if exist "%SKILL_DST%" (
    echo [提示] 检测到旧版，覆盖更新。
    rmdir /s /q "%SKILL_DST%"
)
xcopy "%ROOT%skill\ddd-methodology" "%SKILL_DST%\" /e /i /q >nul
if errorlevel 1 ( echo [错误] Skill 安装失败 & exit /b 1 )
echo [完成] Skill  -^> %SKILL_DST%

rem 1.5 安装 Workflow 加速档脚本（仓库根 workflows\ → skill 包内 workflows\）
if exist "%ROOT%workflows" (
    if not exist "%SKILL_DST%\workflows" mkdir "%SKILL_DST%\workflows"
    xcopy "%ROOT%workflows" "%SKILL_DST%\workflows\" /e /i /q >nul
    echo [完成] Workflow -^> %SKILL_DST%\workflows\
)

rem 1.6 安装追溯校验脚本（G2/G4/G5 门禁证据工具）
if exist "%ROOT%scripts\trace-check.js" (
    if not exist "%SKILL_DST%\scripts" mkdir "%SKILL_DST%\scripts"
    copy /y "%ROOT%scripts\trace-check.js" "%SKILL_DST%\scripts\" >nul
    echo [完成] trace-check -^> %SKILL_DST%\scripts\trace-check.js
)

rem 2. 安装 9 个 agent 定义（按固定清单，仅覆盖本方法论文件）
if not exist "%AGENT_DST%" mkdir "%AGENT_DST%"
set N=0
for %%A in (%DDD_AGENTS%) do (
    if exist "%ROOT%agents\%%A.md" (
        copy /y "%ROOT%agents\%%A.md" "%AGENT_DST%\%%A.md" >nul
        set /a N+=1
    ) else (
        echo [警告] 缺少 %ROOT%agents\%%A.md
    )
)
echo [完成] Agents -^> %AGENT_DST% （!N! 个）

echo.
echo [成功] 安装完成。卸载请运行 scripts\uninstall.bat
exit /b 0

:check
echo [检查] 安装状态：
if exist "%SKILL_DST%\SKILL.md" ( echo   Skill    : 已安装 ) else ( echo   Skill    : 未安装 )
set N=0
for %%A in (%DDD_AGENTS%) do (
    if exist "%AGENT_DST%\%%A.md" set /a N+=1
)
echo   Agents   : !N! / 7 已安装
if exist "%SKILL_DST%\workflows\ddd-workflow.js" ( echo   Workflow : 已安装 ) else ( echo   Workflow : 未安装 )
exit /b 0
