@echo off
rem ============================================================
rem DDD-Methodology model profile script for Windows
rem
rem Scope narrowed: installing skills, agents, extensions and the
rem workflow is handled by the pi package mechanism. This script no
rem longer copies any resource; it only applies the model profile by
rem calling scripts\apply-models.js.
rem
rem Install the package itself with:
rem   pi install git:github.com/Cikaros/ddd-methodology@v0.1.0
rem
rem   install.bat --check                    show model profile status
rem   install.bat --models balanced          apply model profile
rem   install.bat --models balanced --set ddd-arbiter=GLM-5.3-Flash
rem   install.bat --models balanced --skip-verify
rem   install.bat --models balanced --provider <provider>
rem
rem Remove the model profile with uninstall.bat.
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

if not exist "%ROOT%scripts\apply-models.js" (
    echo [ERROR] scripts\apply-models.js not found, run from the repository.
    exit /b 1
)

set "PI_HOME=%USERPROFILE%\.pi\agent"

set "CHECK_ONLY=0"
set "MODELS_PROFILE="
set "MODEL_SETS="
set "SKIP_VERIFY="
set "PROVIDER="

:parse
if "%~1"=="" goto :parsed
if /i "%~1"=="--check" ( set "CHECK_ONLY=1" & shift & goto :parse )
if /i "%~1"=="--models" (
    if "%~2"=="" ( echo [ERROR] --models needs a profile name: balanced, quality & exit /b 1 )
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

if "%MODELS_PROFILE%"=="" (
    echo [INFO] no --models given, model settings untouched.
    echo        Install the package itself with: pi install git:github.com/Cikaros/ddd-methodology@v0.1.0
    exit /b 0
)
if /i "%MODELS_PROFILE%"=="none" (
    echo [INFO] model profile skipped, all agents keep the default model
    exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
    echo [WARN] node not found, skipping model profile
    exit /b 0
)
set "APPLY_ARGS=apply %MODELS_PROFILE% --repo "%ROOT%""
if not "%SKIP_VERIFY%"=="" set "APPLY_ARGS=!APPLY_ARGS! --skip-verify"
if not "%PROVIDER%"=="" set "APPLY_ARGS=!APPLY_ARGS! --provider %PROVIDER%"
if not "%MODEL_SETS%"=="" set "APPLY_ARGS=!APPLY_ARGS!%MODEL_SETS%"
call node "%ROOT%scripts\apply-models.js" !APPLY_ARGS!
exit /b 0

:check
echo [CHECK] model profile status:
if exist "%PI_HOME%\.ddd-model-overrides.json" (
    echo   Models   : profile applied
) else (
    echo   Models   : not configured, agents use the default model
)
exit /b 0
