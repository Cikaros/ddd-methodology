@echo off
rem ============================================================
rem DDD-Methodology 卸载脚本（Windows）
rem 用法: uninstall.bat
rem 仅移除本方法论安装的固定文件，不影响用户其他配置。
rem ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SRC=%~dp0"
set "ROOT=%SRC%..\"

set "PI_HOME=%USERPROFILE%\.pi\agent"
set "SKILL_DST=%PI_HOME%\skills\ddd-methodology"
set "AGENT_DST=%PI_HOME%\agents"

rem 固定清单：与 agents\ 目录下 12 个文件一一对应（防止通配符误删用户自有 ddd- 前缀代理）
set DDD_AGENTS=ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester ddd-arbiter ddd-doc-sync ddd-auditor ddd-fixer

echo [卸载] 目标: %PI_HOME%

where node >nul 2>nul
if errorlevel 1 (
    echo [警告] 未找到 node，跳过全局规则移除
) else (
    node "%ROOT%scripts\merge-append-system.js" remove
)

for %%S in (ddd-defect-routing ddd-coding-discipline) do (
    if exist "%PI_HOME%\skills\%%S" (
        rmdir /s /q "%PI_HOME%\skills\%%S"
        echo [完成] 已移除切片 %%S
    )
)
if exist "%SKILL_DST%" (
    rmdir /s /q "%SKILL_DST%"
    echo [完成] 已移除 Skill: %SKILL_DST%
) else (
    echo [提示] Skill 未安装
)

set N=0
for %%A in (%DDD_AGENTS%) do (
    if exist "%AGENT_DST%\%%A.md" (
        del /q "%AGENT_DST%\%%A.md"
        set /a N+=1
    )
)
echo [完成] 已移除 !N! 个 ddd agent 定义

echo [成功] 卸载完成。
exit /b 0
