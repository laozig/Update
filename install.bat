@echo off
REM 更新服务器Windows安装脚本

echo 开始安装更新服务器...
echo 当前目录: %cd%

REM 安装Node.js依赖
echo 安装Node.js依赖...
call npm install

REM 确保bcryptjs模块已安装
echo 确保bcryptjs模块已安装...
call npm install bcryptjs --save

REM 创建必要的目录
echo 创建必要的目录...
if not exist server\projects mkdir server\projects

REM 确保配置文件存在
echo 检查配置文件...
if not exist server\config.json (
  echo 创建默认配置文件...
  if exist server\config.example.json (
    copy server\config.example.json server\config.json
  ) else (
    echo {"projects":[],"users":[{"username":"admin","password":"admin","role":"admin","email":"admin@example.com","createdAt":"%date% %time%"}],"server":{"serverIp":"update.tangyun.lat","port":3000,"adminPort":8080,"jwtSecret":"your-secret-key-change-this-in-production","jwtExpiry":"24h"},"roles":[{"id":"admin","name":"管理员","description":"系统管理员，拥有所有权限","permissions":["all"],"isSystem":true},{"id":"user","name":"普通用户","description":"普通用户，只能管理自己的项目","permissions":["manage_own_projects"],"isSystem":true}]} > server\config.json
  )
)

echo 安装完成！
echo 使用以下命令启动服务器：
echo   API服务器: node server/index.js
echo   控制面板: node server/server-ui.js
echo 或者使用npm脚本：
echo   API服务器: npm run start:api
echo   控制面板: npm run start:ui
echo   两者同时: npm run start:all

pause 