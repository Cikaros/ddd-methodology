@echo off
rem ============================================================
rem DDD-Methodology uninstaller for Windows
rem   uninstall.bat
rem Removes only files installed by this methodology, plus the
rem global rule block and the model overrides it wrote.
rem Fixed list: agents\ holds 12 ddd-prefixed agents; the skill package is
rem removed wholesale, so scripts\ref-check.js and the other scripts go with it.
rem
rem Encoding note: ASCII only on purpose, see install.bat.
rem Run it from the repository: it calls scripts\apply-models.js
rem and scripts\merge-append-system.js, which are not installed
rem into the skill directory.
rem ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SRC=%~dp0"
set "ROOT=%SRC%..\"

set "PI_HOME=%USERPROFILE%\.pi\agent"
set "SKILL_DST=%PI_HOME%\skills\ddd-methodology"
set "AGENT_DST=%PI_HOME%\agents"

rem Fixed list: one entry per file under agents\
set DDD_AGENTS=ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester ddd-arbiter ddd-doc-sync ddd-auditor ddd-fixer

echo [UNINSTALL] target: %PI_HOME%

where node >nul 2>nul
if errorlevel 1 (
    echo [WARN] node not found, skipping model overrides
    echo [WARN] node not found, skipping global rules
) else (
    node "%ROOT%scripts\apply-models.js" clear
    node "%ROOT%scripts\merge-append-system.js" remove "%PI_HOME%\APPEND_SYSTEM.md"
)

if exist "%SKILL_DST%" (
    rmdir /s /q "%SKILL_DST%"
    echo [OK] removed Skill: %SKILL_DST%
) else (
    echo [INFO] Skill not installed
)

if exist "%PI_HOME%\extensions\ddd-governance.ts" (
    del /q "%PI_HOME%\extensions\ddd-governance.ts"
    echo [OK] removed runtime guard extension
)

set N=0
for %%A in (%DDD_AGENTS%) do (
    if exist "%AGENT_DST%\%%A.md" (
        del /q "%AGENT_DST%\%%A.md"
        set /a N+=1
    )
)
echo [OK] removed !N! ddd agent definitions

echo [DONE] uninstalled.
exit /b 0
