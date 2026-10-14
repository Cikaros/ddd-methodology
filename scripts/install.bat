@echo off
rem ============================================================
rem DDD-Methodology 安装/卸载脚本（Windows）
rem 用法:
rem   install.bat          全局安装（skill + 7个agent定义）
rem   install.bat uninstall 全局卸载
rem ============================================================
setlocal enabledelayedexpansion

rem 定位仓库根目录（本脚本所在目录的上一级若含 skill\agents 则取上一级）
set "SRC=%~dp0"
if exist "%SRC%skill\ddd-methodology\SKILL.md" (
    set "ROOT=%SRC%"
) else if exist "%SRC%..\skill\ddd-methodology\SKILL.md" (
    set "ROOT=%~dp0..\"
) else (
    echo [错误] 未找到 skill\ddd-methodology\SKILL.md，请在仓库目录内运行。
    exit /b 1
)

set "PI_HOME=%USERPROFILE%\.pi\agent"
set "SKILL_DST=%PI_HOME%\skills\ddd-methodology"
set "AGENT_DST=%PI_HOME%\agents"

if "%1"=="uninstall" goto :uninstall

:install
echo [安装] 目标: %PI_HOME%

rem 1. 安装 Skill（整个目录复制）
if exist "%SKILL_DST%" (
    echo [提示] 已存在 %SKILL_DST%，先移除旧版。
    rmdir /s /q "%SKILL_DST%"
)
xcopy "%ROOT%skill\ddd-methodology" "%SKILL_DST%\" /e /i /q >nul
if errorlevel 1 ( echo [错误] Skill 安装失败 & exit /b 1 )
echo [完成] Skill  -^> %SKILL_DST%

rem 2. 安装 7 个 agent 定义
if not exist "%AGENT_DST%" mkdir "%AGENT_DST%"
set N=0
for %%F in ("%ROOT%agents\ddd-*.md") do (
    copy /y "%%F" "%AGENT_DST%\" >nul
    set /a N+=1
)
echo [完成] Agents -^> %AGENT_DST% （!N! 个）

echo.
echo [成功] 安装完成。在任意 pi 会话中可通过 /skill:ddd-methodology 调用，
echo        或直接说"按 ddd 方法论开发"触发。
exit /b 0

:uninstall
echo [卸载] 目标: %PI_HOME%
if exist "%SKILL_DST%" ( rmdir /s /q "%SKILL_DST%" & echo [完成] 已移除 Skill ) else ( echo [提示] Skill 未安装 )
set N=0
for %%F in ("%AGENT_DST%\ddd-*.md") do (
    del /q "%%F" 2>nul
    set /a N+=1
)
echo [完成] 已移除 !N! 个 ddd-* agent 定义
echo [成功] 卸载完成。
exit /b 0
