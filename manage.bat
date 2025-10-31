@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Windows 一键入口：调用 manage.sh（优先 Git Bash，其次 WSL）
cd /d "%~dp0"

where bash >nul 2>&1
if %ERRORLEVEL%==0 (
  bash -c "./manage.sh %*"
  exit /b %ERRORLEVEL%
)

where wsl >nul 2>&1
if %ERRORLEVEL%==0 (
  for /f "delims=" %%P in ('wsl wslpath "%CD%"') do set "WPATH=%%P"
  wsl bash -lc "cd \"!WPATH!\" && ./manage.sh %*"
  exit /b %ERRORLEVEL%
)

echo 未检测到 Bash 或 WSL，请安装 Git Bash 或启用 WSL 后重试。
exit /b 1


