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
call :colorEcho 0B "[信息] 更新服务器一键式安装和启动脚本"
echo.
echo ================================================
echo        更新服务器一键式安装和启动脚本
echo ================================================
echo.

REM 显示当前目录
call :colorEcho 0B "[信息] 当前目录: %cd%"
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
call :colorEcho 0B "[信息] 开始安装依赖..."
echo.

REM 检查node是否安装
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  call :colorEcho 0C "[错误] 未检测到Node.js，请先安装Node.js"
  echo.
  exit /b 1
)

call :colorEcho 0B "[信息] Node.js版本:"
node -v
call :colorEcho 0B "[信息] NPM版本:"
npm -v
echo.

REM 安装Node.js依赖
call :colorEcho 0B "[信息] 安装Node.js依赖..."
echo.
call npm install

REM 确保bcryptjs模块已安装
call :colorEcho 0B "[信息] 确保bcryptjs模块已安装..."
echo.
call npm install bcryptjs --save

REM 创建必要的目录
call :colorEcho 0B "[信息] 创建必要的目录..."
echo.
if not exist server\projects mkdir server\projects

REM 确保配置文件存在
call :colorEcho 0B "[信息] 检查配置文件..."
echo.
if not exist server\config.json (
  call :colorEcho 0B "[信息] 创建默认配置文件..."
  echo.
  if exist server\config.example.json (
    copy server\config.example.json server\config.json
  ) else (
    echo {"projects":[],"users":[{"username":"admin","password":"admin","role":"admin","email":"admin@example.com","createdAt":"%date% %time%"}],"server":{"serverIp":"update.tangyun.lat","port":3000,"adminPort":8080,"jwtSecret":"your-secret-key-change-this-in-production","jwtExpiry":"24h"},"roles":[{"id":"admin","name":"管理员","description":"系统管理员，拥有所有权限","permissions":["all"],"isSystem":true},{"id":"user","name":"普通用户","description":"普通用户，只能管理自己的项目","permissions":["manage_own_projects"],"isSystem":true}]} > server\config.json
  )
)

call :colorEcho 0A "[成功] 依赖安装完成！"
echo.
exit /b 0

:start
call :colorEcho 0B "[信息] 正在启动服务..."
echo.

REM 检查API服务器是否已在运行
tasklist /fi "imagename eq node.exe" /v | find "server/index.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0E "[警告] API服务器已在运行中"
  echo.
) else (
  call :colorEcho 0B "[信息] 启动API服务器..."
  echo.
  start /b cmd /c "node server/index.js > api-server.log 2>&1"
  call :colorEcho 0A "[成功] API服务器已启动"
  echo.
)

REM 检查控制面板是否已在运行
tasklist /fi "imagename eq node.exe" /v | find "server/server-ui.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0E "[警告] 控制面板已在运行中"
  echo.
) else (
  call :colorEcho 0B "[信息] 启动控制面板..."
  echo.
  start /b cmd /c "node server/server-ui.js > ui-server.log 2>&1"
  call :colorEcho 0A "[成功] 控制面板已启动"
  echo.
)

call :colorEcho 0A "[成功] 所有服务已启动！"
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4"') do (
  set IP=%%a
  set IP=!IP:~1!
  goto :foundIP
)
:foundIP
call :colorEcho 0B "[信息] API服务器运行在: http://%IP%:3000"
echo.
call :colorEcho 0B "[信息] 控制面板运行在: http://%IP%:8080"
echo.
echo.
call :colorEcho 0B "[信息] 日志文件:"
echo.
call :colorEcho 0B "[信息] - API服务器: api-server.log"
echo.
call :colorEcho 0B "[信息] - 控制面板: ui-server.log"
echo.
exit /b 0

:stop
call :colorEcho 0B "[信息] 正在停止服务..."
echo.

REM 停止API服务器
tasklist /fi "imagename eq node.exe" /v | find "server/index.js" >nul
if %ERRORLEVEL% EQU 0 (
  taskkill /f /im node.exe /fi "windowtitle eq *server/index.js*" >nul 2>&1
  call :colorEcho 0A "[成功] API服务器已停止"
  echo.
) else (
  call :colorEcho 0E "[警告] API服务器未在运行"
  echo.
)

REM 停止控制面板
tasklist /fi "imagename eq node.exe" /v | find "server/server-ui.js" >nul
if %ERRORLEVEL% EQU 0 (
  taskkill /f /im node.exe /fi "windowtitle eq *server/server-ui.js*" >nul 2>&1
  call :colorEcho 0A "[成功] 控制面板已停止"
  echo.
) else (
  call :colorEcho 0E "[警告] 控制面板未在运行"
  echo.
)

call :colorEcho 0A "[成功] 所有服务已停止"
echo.
exit /b 0

:restart
call :stop
timeout /t 2 >nul
call :start
exit /b 0

:status
echo.
call :colorEcho 0B "[信息] 检查服务状态..."
echo.

REM 检查API服务器
tasklist /fi "imagename eq node.exe" /v | find "server/index.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0A "[成功] API服务器正在运行"
  echo.
) else (
  call :colorEcho 0E "[警告] API服务器未在运行"
  echo.
)

REM 检查控制面板
tasklist /fi "imagename eq node.exe" /v | find "server/server-ui.js" >nul
if %ERRORLEVEL% EQU 0 (
  call :colorEcho 0A "[成功] 控制面板正在运行"
  echo.
) else (
  call :colorEcho 0E "[警告] 控制面板未在运行"
  echo.
)

echo.
exit /b 0

:help
echo 用法: %0 [选项]
echo.
echo 选项:
echo   install    安装依赖
echo   start      启动所有服务
echo   stop       停止所有服务
echo   restart    重启所有服务
echo   status     检查服务状态
echo   help       显示此帮助信息
echo.
echo 如果不提供选项，将执行安装和启动操作。
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
call :colorEcho 0A "[成功] 操作完成！"
echo.
pause 