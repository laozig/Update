@echo off
REM 更新服务器一键式安装和启动脚本
REM 作者: laozig
REM 日期: 2024-06-04

REM 设置颜色
setlocal EnableDelayedExpansion
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do (
  set "DEL=%%a"
)

REM 显示带颜色的信息
call :colorEcho 0B "[INFO] Update Server Installation and Startup Script"
echo.
echo ================================================
echo        Update Server Installation and Startup Script
echo ================================================
echo.

REM 显示当前目录
call :colorEcho 0B "[INFO] Current directory: %cd%"
echo.

REM 检查参数
if "%1"=="install" goto :install
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="restart" goto :restart
if "%1"=="status" goto :status
if "%1"=="help" goto :help

REM 默认执行安装和启动
call :install
call :start
call :status
goto :end

:install
call :colorEcho 0B "[INFO] Starting installation..."
echo.

REM 检查node是否安装
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  call :colorEcho 0C "[ERROR] Node.js not detected, please install Node.js first"
  echo.
  exit /b 1
)

call :colorEcho 0B "[INFO] Node.js version:"
node -v
call :colorEcho 0B "[INFO] NPM version:"
npm -v
echo.

REM 安装Node.js依赖
call :colorEcho 0B "[INFO] Installing Node.js dependencies..."
echo.
call npm install

REM 确保bcryptjs模块已安装
call :colorEcho 0B "[INFO] Ensuring bcryptjs module is installed..."
echo.
call npm install bcryptjs --save

REM 创建必要的目录
call :colorEcho 0B "[INFO] Creating necessary directories..."
echo.
if not exist server\projects mkdir server\projects

REM 确保配置文件存在
call :colorEcho 0B "[INFO] Checking configuration file..."
echo.
if not exist server\config.json (
  call :colorEcho 0B "[INFO] Creating default configuration file..."
  echo.
  if exist server\config.example.json (
    copy server\config.example.json server\config.json
  ) else (
    echo {"projects":[],"users":[{"username":"admin","password":"admin","role":"admin","email":"admin@example.com","createdAt":"%date% %time%"}],"server":{"serverIp":"localhost","port":3000,"adminPort":8080,"jwtSecret":"your-secret-key-change-this-in-production","jwtExpiry":"24h"},"roles":[{"id":"admin","name":"Admin","description":"System administrator with all permissions","permissions":["all"],"isSystem":true},{"id":"user","name":"User","description":"Regular user, can only manage own projects","permissions":["manage_own_projects"],"isSystem":true}]} > server\config.json
  )
)

call :colorEcho 0A "[SUCCESS] Dependencies installed!"
echo.
exit /b 0

:start
call :colorEcho 0B "[INFO] Starting services..."
echo.

REM 检查API服务器是否已在运行
tasklist /fi "imagename eq node.exe" /v | find "server/index.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0E "[WARNING] API server is already running"
  echo.
) else (
  call :colorEcho 0B "[INFO] Starting API server..."
  echo.
  start /b cmd /c "node server/index.js > api-server.log 2>&1"
  call :colorEcho 0A "[SUCCESS] API server started"
  echo.
)

REM 检查控制面板是否已在运行
tasklist /fi "imagename eq node.exe" /v | find "server/server-ui.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0E "[WARNING] Control panel is already running"
  echo.
) else (
  call :colorEcho 0B "[INFO] Starting control panel..."
  echo.
  start /b cmd /c "node server/server-ui.js > ui-server.log 2>&1"
  call :colorEcho 0A "[SUCCESS] Control panel started"
  echo.
)

call :colorEcho 0A "[SUCCESS] All services started!"
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4"') do (
  set IP=%%a
  set IP=!IP:~1!
  goto :foundIP
)
:foundIP
call :colorEcho 0B "[INFO] API server running at: http://%IP%"
echo.
call :colorEcho 0B "[INFO] Control panel running at: http://%IP%"
echo.
echo.
call :colorEcho 0B "[INFO] Log files:"
echo.
call :colorEcho 0B "[INFO] - API server: api-server.log"
echo.
call :colorEcho 0B "[INFO] - Control panel: ui-server.log"
echo.
exit /b 0

:stop
call :colorEcho 0B "[INFO] Stopping services..."
echo.

REM 停止API服务器
tasklist /fi "imagename eq node.exe" /v | find "server/index.js" >nul
if %ERRORLEVEL% EQU 0 (
  taskkill /f /im node.exe /fi "windowtitle eq *server/index.js*" >nul 2>&1
  call :colorEcho 0A "[SUCCESS] API server stopped"
  echo.
) else (
  call :colorEcho 0E "[WARNING] API server is not running"
  echo.
)

REM 停止控制面板
tasklist /fi "imagename eq node.exe" /v | find "server/server-ui.js" >nul
if %ERRORLEVEL% EQU 0 (
  taskkill /f /im node.exe /fi "windowtitle eq *server/server-ui.js*" >nul 2>&1
  call :colorEcho 0A "[SUCCESS] Control panel stopped"
  echo.
) else (
  call :colorEcho 0E "[WARNING] Control panel is not running"
  echo.
)

call :colorEcho 0A "[SUCCESS] All services stopped"
echo.
exit /b 0

:restart
call :stop
timeout /t 2 >nul
call :start
exit /b 0

:status
echo.
call :colorEcho 0B "[INFO] Checking service status..."
echo.

REM 检查API服务器
tasklist /fi "imagename eq node.exe" /v | find "server/index.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0A "[SUCCESS] API server is running"
  echo.
) else (
  call :colorEcho 0E "[WARNING] API server is not running"
  echo.
)

REM 检查控制面板
tasklist /fi "imagename eq node.exe" /v | find "server/server-ui.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0A "[SUCCESS] Control panel is running"
  echo.
) else (
  call :colorEcho 0E "[WARNING] Control panel is not running"
  echo.
)

echo.
exit /b 0

:help
echo Usage: %0 [option]
echo.
echo Options:
echo   install    Install dependencies
echo   start      Start all services
echo   stop       Stop all services
echo   restart    Restart all services
echo   status     Check service status
echo   help       Show this help message
echo.
echo If no option is provided, install and start will be executed.
exit /b 0

:colorEcho
echo off
<nul set /p ".=%DEL%" > "%~2"
findstr /v /a:%1 /R "^$" "%~2" nul
del "%~2" > nul 2>&1
echo.
exit /b 0

:end
echo.
call :colorEcho 0A "[SUCCESS] Operation completed!"
echo.
pause 