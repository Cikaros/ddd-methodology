@echo off
rem ============================================================
rem DDD-Methodology model profile removal for Windows
rem
rem Scope narrowed: removing skills, agents, extensions and the
rem workflow is handled by the pi package mechanism. This script no
rem longer deletes any installed resource; it only withdraws the model
rem profile written by this methodology through scripts\apply-models.js.
rem
rem The subagents.agentOverrides entry in settings.json is kept: it still
rem applies to the package agents, so this script never touches it.
rem
rem Remove the package itself with:
rem   pi remove ddd-methodology
rem
rem Encoding note: ASCII only on purpose, see install.bat.
rem Run it from the repository: it calls scripts\apply-models.js, which
rem is not installed into the skill directory.
rem ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SRC=%~dp0"
set "ROOT=%SRC%..\"

echo [REMOVE] withdrawing the model profile written by this methodology

where node >nul 2>nul
if errorlevel 1 (
    echo [WARN] node not found, skipping model profile removal
    exit /b 0
)
node "%ROOT%scripts\apply-models.js" clear

echo [DONE] model profile removed. settings.json subagents.agentOverrides untouched.
echo        Remove the package itself with: pi remove ddd-methodology
exit /b 0
