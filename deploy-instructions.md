# 更新服务器部署指南

本文档提供在服务器上部署更新服务器的详细步骤。

## 服务器要求

- 操作系统: Linux（推荐Ubuntu 20.04+或CentOS 8+）
- 内存: 最低1GB，推荐2GB+
- 存储: 最低10GB可用空间
- CPU: 1核心+
- 网络: 公网IP

## 软件要求

- Node.js 14+
- npm 6+
- Git（可选，用于从仓库拉取代码）

## 一键部署步骤

1. 克隆仓库（或上传项目文件到服务器）:
```bash
git clone https://github.com/laozig/Update.git /opt/Update
```

2. 进入项目目录:
```bash
cd /opt/Update
```

3. 设置执行权限:
```bash
chmod +x manage.sh
```

4. 启动服务:
```bash
./manage.sh install   # 安装依赖并启动
# 或
./manage.sh           # 显示菜单后选择"安装部署"
```

5. 访问控制面板:
   - URL: http://服务器IP地址:33081/ (默认端口)
   - 首次启动时会自动创建管理员账户，查看 `server/first-run-admin.txt` 获取初始凭据
   - 或通过环境变量 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 预设

> 提示：生产环境可设置环境变量 `BASE_URL`（如 `https://updates.example.com`），并在反向代理（如 Nginx）中传递 `X-Forwarded-Proto/Host`，以确保生成的下载链接协议与域名正确。

## 手动部署步骤

如果一键部署脚本无法正常工作，可以按照以下步骤手动部署:

### 1. 安装Node.js和npm

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
```

### 2. 配置项目目录

```bash
# 创建项目目录
sudo mkdir -p /opt/Update
sudo mkdir -p /opt/Update/server/projects
sudo mkdir -p /opt/Update/server/public

# 设置目录权限
sudo chown -R $(whoami):$(whoami) /opt/Update
```

### 3. 上传或克隆项目文件

```bash
# 使用Git克隆
git clone https://github.com/laozig/Update.git /opt/Update

# 或者上传项目文件后解压
# unzip update.zip -d /opt/Update
```

### 4. 安装依赖

```bash
cd /opt/Update
npm install --production
```

### 5. 启动服务

推荐使用管理脚本启动（自动管理 PID 和日志）:
```bash
cd /opt/Update
./manage.sh start
```

或者使用管理脚本安装部署（会自动安装依赖并启动）:
```bash
cd /opt/Update
./manage.sh install
```

如需手动启动（不推荐）:
```bash
cd /opt/Update
nohup node server/index.js > api-server.log 2>&1 &
nohup node server/server-ui.js > ui-server.log 2>&1 &
```

### 6. 设置开机自启

1. 创建systemd服务文件:
```bash
sudo nano /etc/systemd/system/update-server.service
```

2. 添加以下内容:
```
[Unit]
Description=Update Server Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/Update
ExecStart=/bin/bash -c 'cd /opt/Update && ./manage.sh start'
ExecStop=/bin/bash -c 'cd /opt/Update && ./manage.sh pause'
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=update-server

[Install]
WantedBy=multi-user.target
```

3. 启用服务:
```bash
sudo systemctl daemon-reload
sudo systemctl enable update-server
sudo systemctl start update-server
```

## 常见问题排查

### 1. 无法访问控制面板

检查以下几点:

1. 确认服务正在运行:
```bash
ps aux | grep node
```

2. 检查端口是否正常监听:
```bash
netstat -tlpn | grep -E ':33081|:33001'
# 或使用 ss 命令
ss -tlnp | grep -E ':33081|:33001'
```

3. 确认防火墙允许访问这些端口:
```bash
sudo ufw status  # Ubuntu
sudo firewall-cmd --list-all  # CentOS
```

### 2. 服务启动失败

1. 检查Node.js版本:
```bash
node -v
```

2. 检查依赖是否安装:
```bash
cd /opt/Update
npm install --production
```

3. 检查端口占用:
```bash
netstat -tlpn | grep -E ':8080|:3000'
```

4. 查看日志:
```bash
# 使用管理脚本查看实时日志
cd /opt/Update
./manage.sh status   # 显示服务状态，可选择查看实时日志

# 或手动查看日志文件
tail -f /opt/Update/ui-server.log
tail -f /opt/Update/api-server.log
```

### 3. 防火墙问题

1. 检查并配置UFW (Ubuntu):
```bash
sudo ufw status
sudo ufw allow 33081/tcp  # 控制面板端口
sudo ufw allow 33001/tcp  # API服务端口
```

2. 检查并配置Firewalld (CentOS):
```bash
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=33081/tcp  # 控制面板端口
sudo firewall-cmd --permanent --add-port=33001/tcp  # API服务端口
sudo firewall-cmd --reload
```

## 更新部署

1. 停止服务:
```bash
cd /opt/Update
./manage.sh pause
```

2. 更新代码（推荐使用内置更新功能）:
```bash
cd /opt/Update
./manage.sh update   # 自动检查更新、拉取代码并安装依赖
# 或手动更新
git pull origin main
npm install
```

3. 重新启动服务:
```bash
cd /opt/Update
./manage.sh restart
```

## 注意事项

- 考虑添加身份验证机制保护控制面板
- 定期备份`server/version.json`和上传的应用程序文件 