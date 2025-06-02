#!/bin/bash

echo "开始配置和启动服务..."

# 1. 清理旧日志
echo "清理旧日志..."
if [ -f "/opt/Update/server.log" ]; then
    # 保留最后100行日志
    tail -n 100 /opt/Update/server.log > /opt/Update/server.log.tmp
    mv /opt/Update/server.log.tmp /opt/Update/server.log
fi

# 2. 配置Nginx
echo "配置Nginx..."
cat > /etc/nginx/conf.d/update-server.conf << 'EOL'
server {
    listen 80;
    listen [::]:80;
    server_name 103.97.179.230;

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

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /download/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOL

# 3. 重启Nginx
echo "重启Nginx..."
systemctl restart nginx

# 4. 安装Node.js依赖
echo "安装Node.js依赖..."
cd /opt/Update
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    echo "首次安装依赖..."
    npm install --production
else
    echo "检查依赖更新..."
    npm install --production --no-audit
fi

# 5. 启动Node.js服务
echo "启动Node.js服务..."

# 停止已存在的进程
pkill -f "node server/server-ui.js"

# 使用 pm2 启动服务（如果已安装）
if command -v pm2 &> /dev/null; then
    pm2 delete update-server 2>/dev/null || true
    pm2 start server/server-ui.js --name update-server
else
    # 使用 nohup 后台运行并重定向日志
    nohup node server/server-ui.js >> server.log 2>&1 &
fi

# 6. 等待服务启动
sleep 3

# 7. 检查服务状态
echo "检查服务状态..."
if netstat -tlpn | grep :8080 > /dev/null; then
    echo "✅ 服务启动成功！"
    echo "📱 控制面板地址: http://103.97.179.230/"
    
    # 设置日志自动清理（每天保留最后1000行）
    if ! crontab -l | grep -q "server.log"; then
        (crontab -l 2>/dev/null; echo "0 0 * * * tail -n 1000 /opt/Update/server.log > /opt/Update/server.log.tmp && mv /opt/Update/server.log.tmp /opt/Update/server.log") | crontab -
        echo "✅ 已设置日志自动清理（每天凌晨清理，保留最后1000行）"
    fi
else
    echo "❌ 服务启动失败，请检查日志："
    tail -n 10 server.log
fi 