@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Check if manage.sh exists
if not exist "manage.sh" (
    echo [Error] manage.sh not found
    echo Please make sure you are in the correct directory
    pause
    exit /b 1
)

REM Try Git Bash first
where bash >nul 2>&1
if !errorlevel! equ 0 (
    echo [Info] Using Git Bash...
    REM 确保 manage.sh 有执行权限（在 Git Bash 中）
    bash -c "chmod +x manage.sh 2>/dev/null || true" >nul 2>&1
    REM 执行 manage.sh，传递所有参数
    bash manage.sh %*
    set "EXIT_CODE=!errorlevel!"
    REM 只有无参数时才暂停
    if "%~1"=="" (
        pause
    )
    exit /b !EXIT_CODE!
)

REM Try WSL only if Git Bash failed
where wsl >nul 2>&1
if !errorlevel! equ 0 (
    echo [Info] Git Bash not found, trying WSL...
    REM 检查 WSL 是否已安装分发版
    wsl --list --quiet >nul 2>&1
    if !errorlevel! neq 0 (
        echo [Error] WSL is installed but no distribution is installed.
        echo Please install a WSL distribution first:
        echo   wsl --install -d Ubuntu
        echo.
        pause
        exit /b 1
    )
    REM 转换 Windows 路径为 WSL 路径
    for /f "delims=" %%P in ('wsl wslpath "%CD%" 2^>nul') do set "WPATH=%%P"
    if "!WPATH!"=="" (
        echo [Error] Failed to convert Windows path to WSL path
        pause
        exit /b 1
    )
    REM 执行 manage.sh in WSL
    wsl bash -c "cd \"!WPATH!\" && chmod +x manage.sh 2>/dev/null || true && ./manage.sh %*"
    set "EXIT_CODE=!errorlevel!"
    if "%~1"=="" (
        pause
    )
    exit /b !EXIT_CODE!
)

REM Error: No Bash or WSL found
echo.
echo [Error] Bash or WSL not found
echo.
echo Please install one of the following:
echo   1. Git for Windows: https://git-scm.com/download/win
echo   2. Or WSL: wsl --install -d Ubuntu
echo.
pause
exit /b 1
