# 更新服务器部署指南 (Ubuntu)

本文档提供在Ubuntu服务器上部署更新服务器的详细步骤。

## 服务器要求

- 操作系统: Linux（推荐Ubuntu 20.04+或CentOS 8+）
- 内存: 最低1GB，推荐2GB+
- 存储: 最低10GB可用空间
- CPU: 1核心+
- 网络: 公网IP，80端口开放

## 软件要求

- Node.js 14+
- npm 6+
- Nginx 1.18+
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
chmod +x start.sh stop.sh
```

4. 启动服务:
```bash
sudo ./start.sh
```

5. 访问控制面板:
   - URL: http://服务器IP地址/
   - 默认账号: admin
   - 默认密码: admin

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

### 2. 安装Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y epel-release
sudo yum install -y nginx
```

### 3. 配置项目目录

```bash
# 创建项目目录
sudo mkdir -p /opt/Update
sudo mkdir -p /opt/Update/server/projects
sudo mkdir -p /opt/Update/server/public

# 设置目录权限
sudo chown -R $(whoami):$(whoami) /opt/Update
```

### 4. 上传或克隆项目文件

```bash
# 使用Git克隆
git clone https://github.com/laozig/Update.git /opt/Update

# 或者上传项目文件后解压
# unzip update.zip -d /opt/Update
```

### 5. 安装依赖

```bash
cd /opt/Update
npm install --production
```

### 6. 配置Nginx

1. 备份默认配置（如果需要）:
```bash
sudo cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak
sudo cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true
```

2. 删除默认配置:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
```

3. 创建新的配置文件:
```bash
sudo nano /etc/nginx/conf.d/update-server.conf
```

4. 添加以下内容:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 103.97.179.230;  # 替换为您的服务器IP或域名
    client_max_body_size 100M;

    # 控制面板 - 转发到8080端口
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 更新服务API - 转发到3000端口
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 下载路由 - 转发到3000端口
    location /download/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 错误页面
    location = /error.html {
        root /opt/Update/server/public;
        internal;
    }
}
```

5. 检查并重启Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 7. 启动服务

1. 启动更新服务:
```bash
cd /opt/Update
nohup node server/index.js > server-api.log 2>&1 &
```

2. 启动控制面板:
```bash
cd /opt/Update
nohup node server/server-ui.js > server.log 2>&1 &
```

### 8. 设置开机自启

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
ExecStart=/bin/bash -c 'cd /opt/Update && ./start.sh'
ExecStop=/bin/bash -c 'cd /opt/Update && ./stop.sh'
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

如果访问 http://服务器IP/ 显示Nginx默认欢迎页面:

1. 检查默认配置是否已删除:
```bash
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/conf.d/
```

2. 检查当前使用的配置:
```bash
nginx -T | grep "server_name"
nginx -T | grep "update-server.conf"
```

3. 确认配置文件正确加载:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/conf.d/default.conf
sudo systemctl restart nginx
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
netstat -tlpn | grep -E ':80|:8080|:3000'
```

4. 查看日志:
```bash
tail -f /opt/Update/server.log
tail -f /opt/Update/server-api.log
```

### 3. 防火墙问题

1. 检查并配置UFW (Ubuntu):
```bash
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 3000/tcp
```

2. 检查并配置Firewalld (CentOS):
```bash
sudo firewall-cmd --list-all
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 更新部署

1. 停止服务:
```bash
cd /opt/Update
sudo ./stop.sh
```

2. 更新代码:
```bash
cd /opt/Update
git pull origin main
```

3. 重新启动服务:
```bash
cd /opt/Update
sudo ./start.sh
```

## 注意事项

- 生产环境建议使用HTTPS，可以配合Nginx反向代理实现
- 考虑添加身份验证机制保护控制面板
- 定期备份`server/version.json`和上传的应用程序文件 