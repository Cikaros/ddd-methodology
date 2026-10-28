@echo off
rem ============================================================
rem DDD-Methodology installer for Windows
rem   install.bat                              install or update
rem   install.bat --check                      show install status
rem   install.bat --models balanced            apply model profile
rem   install.bat --models balanced --set ddd-arbiter=GLM-5.3-Flash
rem   install.bat --models balanced --skip-verify
rem Uninstall with uninstall.bat.
rem
rem Encoding note: this file is ASCII only on purpose. cmd parses batch
rem files under the active code page, so non-ASCII bytes break line
rem markers and percent expansion. Chinese output lives in install.sh,
rem which also works from Git Bash on Windows.
rem ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SRC=%~dp0"
set "ROOT=%SRC%..\"

if not exist "%ROOT%skill\ddd-methodology\SKILL.md" (
    echo [ERROR] skill\ddd-methodology\SKILL.md not found, run from the repository.
    exit /b 1
)

set "PI_HOME=%USERPROFILE%\.pi\agent"
set "SKILL_DST=%PI_HOME%\skills\ddd-methodology"
set "AGENT_DST=%PI_HOME%\agents"

rem Fixed list: one entry per file under agents\
set DDD_AGENTS=ddd-requirements ddd-acceptance ddd-architect ddd-decomposer ddd-interface-reviewer ddd-implementer ddd-test-planner ddd-tester ddd-arbiter ddd-doc-sync ddd-auditor ddd-fixer

set "CHECK_ONLY=0"
set "MODELS_PROFILE="
set "MODEL_SETS="
set "SKIP_VERIFY="
set "PROVIDER="

:parse
if "%~1"=="" goto :parsed
if /i "%~1"=="--check" ( set "CHECK_ONLY=1" & shift & goto :parse )
if /i "%~1"=="--models" (
    if "%~2"=="" ( echo [ERROR] --models needs a profile name: balanced, quality, economy & exit /b 1 )
    set "MODELS_PROFILE=%~2" & shift & shift & goto :parse
)
if /i "%~1"=="--set" (
    if "%~2"=="" ( echo [ERROR] --set needs AGENT=MODEL & exit /b 1 )
    set "MODEL_SETS=%MODEL_SETS% --set %~2" & shift & shift & goto :parse
)
if /i "%~1"=="--skip-verify" ( set "SKIP_VERIFY=1" & shift & goto :parse )
if /i "%~1"=="--provider" (
    if "%~2"=="" ( echo [ERROR] --provider needs a value & exit /b 1 )
    set "PROVIDER=%~2" & shift & shift & goto :parse
)
shift
goto :parse
:parsed

if "%CHECK_ONLY%"=="1" goto :check

:install
echo [INSTALL] target: %PI_HOME%

if exist "%SKILL_DST%" (
    echo [INFO] previous version found, replacing.
    rmdir /s /q "%SKILL_DST%"
)
xcopy "%ROOT%skill\ddd-methodology" "%SKILL_DST%\" /e /i /q >nul
if errorlevel 1 ( echo [ERROR] skill install failed & exit /b 1 )
echo [OK] Skill -> %SKILL_DST%

if not exist "%SKILL_DST%\scripts" mkdir "%SKILL_DST%\scripts"
for %%S in (trace-check code-health governance-check fingerprint design-root) do (
    if exist "%ROOT%scripts\%%S.js" (
        copy /y "%ROOT%scripts\%%S.js" "%SKILL_DST%\scripts\%%S.js" >nul
        if errorlevel 1 ( echo [WARN] %%S copy failed ) else ( echo [OK] %%S )
    ) else (
        echo [WARN] missing %ROOT%scripts\%%S.js
    )
)

if not exist "%PI_HOME%\extensions" mkdir "%PI_HOME%\extensions"
if exist "%ROOT%extensions\ddd-governance.ts" (
    copy /y "%ROOT%extensions\ddd-governance.ts" "%PI_HOME%\extensions\ddd-governance.ts" >nul
    if errorlevel 1 ( echo [WARN] extension copy failed ) else ( echo [OK] Extension -> %PI_HOME%\extensions\ddd-governance.ts )
) else (
    echo [WARN] missing %ROOT%extensions\ddd-governance.ts
)

if exist "%ROOT%global\APPEND_SYSTEM.md" (
    where node >nul 2>nul
    if errorlevel 1 (
        echo [WARN] node not found, skipping global rules
    ) else (
        node "%ROOT%scripts\merge-append-system.js" install "%ROOT%" "%PI_HOME%\APPEND_SYSTEM.md"
    )
) else (
    echo [WARN] missing %ROOT%global\APPEND_SYSTEM.md
)

if not exist "%AGENT_DST%" mkdir "%AGENT_DST%"
set N=0
for %%A in (%DDD_AGENTS%) do (
    if exist "%ROOT%agents\%%A.md" (
        copy /y "%ROOT%agents\%%A.md" "%AGENT_DST%\%%A.md" >nul
        set /a N+=1
    ) else (
        echo [WARN] missing %ROOT%agents\%%A.md
    )
)
echo [OK] Agents -> %AGENT_DST% (!N! files)

if not "%MODELS_PROFILE%"=="" (
    if /i "%MODELS_PROFILE%"=="none" (
        echo [INFO] model profile skipped, all agents keep the default model
    ) else (
        where node >nul 2>nul
        if errorlevel 1 (
            echo [WARN] node not found, skipping model profile
        ) else (
            set "APPLY_ARGS=apply %MODELS_PROFILE% --repo "%ROOT%""
            if not "%SKIP_VERIFY%"=="" set "APPLY_ARGS=!APPLY_ARGS! --skip-verify"
            if not "%PROVIDER%"=="" set "APPLY_ARGS=!APPLY_ARGS! --provider %PROVIDER%"
            call node "%ROOT%scripts\apply-models.js" !APPLY_ARGS!
        )
    )
)

echo.
echo [DONE] installed. Use /skill:ddd-methodology in any pi session.
echo        Uninstall with scripts\uninstall.bat
exit /b 0

:check
echo [CHECK] install status:
if exist "%SKILL_DST%\SKILL.md" ( echo   Skill    : installed ) else ( echo   Skill    : missing )
set N=0
for %%A in (%DDD_AGENTS%) do (
    if exist "%AGENT_DST%\%%A.md" set /a N+=1
)
echo   Agents   : !N! / 12 installed
if exist "%SKILL_DST%\workflows\ddd-workflow.js" ( echo   Workflow : installed ) else ( echo   Workflow : missing )
for %%S in (trace-check code-health governance-check fingerprint design-root) do (
    if exist "%SKILL_DST%\scripts\%%S.js" ( echo   %%S : installed ) else ( echo   %%S : missing )
)
if exist "%PI_HOME%\extensions\ddd-governance.ts" ( echo   Extension: installed ) else ( echo   Extension: missing )
if exist "%PI_HOME%\.ddd-model-overrides.json" (
    echo   Models   : profile applied
) else (
    echo   Models   : not configured, agents use the default model
)
findstr /c:"ddd-methodology:begin" "%PI_HOME%\APPEND_SYSTEM.md" >nul 2>nul
if errorlevel 1 ( echo   Global   : not deployed ) else ( echo   Global   : block deployed )
exit /b 0
