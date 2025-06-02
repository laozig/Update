#!/bin/bash

echo "开始配置和启动服务..."

# 1. 清理旧日志
echo "清理旧日志..."
if [ -f "/opt/Update/server.log" ]; then
    # 保留最后100行日志
    tail -n 100 /opt/Update/server.log > /opt/Update/server.log.tmp
    mv /opt/Update/server.log.tmp /opt/Update/server.log
fi

# 2. 确保目录存在
echo "检查目录结构..."
mkdir -p /opt/Update/server/public
mkdir -p /opt/Update/server/projects

# 3. 配置防火墙
echo "配置防火墙..."
# 检测防火墙类型并开放端口
if command -v ufw &> /dev/null; then
    echo "配置UFW防火墙..."
    ufw status | grep -q "Status: active" && {
        echo "开放80、8080和3000端口..."
        ufw allow 80/tcp
        ufw allow 8080/tcp
        ufw allow 3000/tcp
    }
elif command -v firewall-cmd &> /dev/null; then
    echo "配置firewalld防火墙..."
    firewall-cmd --state | grep -q "running" && {
        echo "开放80、8080和3000端口..."
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=8080/tcp
        firewall-cmd --permanent --add-port=3000/tcp
        firewall-cmd --reload
    }
elif command -v iptables &> /dev/null; then
    echo "配置iptables防火墙..."
    # 检查端口是否已开放
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -A INPUT -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
    iptables -C INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
    
    # 如果有iptables-save命令，保存规则
    if command -v iptables-save &> /dev/null; then
        iptables-save > /etc/iptables/rules.v4 2>/dev/null || echo "无法保存iptables规则"
    fi
else
    echo "未检测到防火墙或不支持的防火墙类型，跳过防火墙配置"
fi

# 4. 配置Nginx
echo "配置Nginx..."

# 备份默认的Nginx配置（如果存在）
echo "备份默认的Nginx配置..."
if [ -f "/etc/nginx/conf.d/default.conf" ] && [ ! -f "/etc/nginx/conf.d/default.conf.bak" ]; then
    cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
fi

if [ -f "/etc/nginx/sites-enabled/default" ] && [ ! -f "/etc/nginx/sites-enabled/default.bak" ]; then
    cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak
fi

# 删除默认的nginx配置文件（如果存在）
echo "删除默认的Nginx配置..."
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/conf.d/default.conf

cat > /etc/nginx/conf.d/update-server.conf << 'EOL'
server {
    listen 80;
    listen [::]:80;
    server_name 103.97.179.230;
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
        proxy_send_timeout 300;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_intercept_errors on;
        error_page 502 503 504 /error.html;
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
EOL

# 5. 检查Nginx配置
echo "检查Nginx配置..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx配置错误，请检查配置文件"
    exit 1
fi

# 6. 重启Nginx
echo "重启Nginx..."
systemctl restart nginx
if [ $? -ne 0 ]; then
    echo "❌ Nginx重启失败，请检查Nginx服务状态"
    systemctl status nginx
    exit 1
fi

# 7. 安装Node.js依赖
echo "安装Node.js依赖..."
cd /opt/Update
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    echo "首次安装依赖..."
    npm install --production
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败，请检查npm错误"
        exit 1
    fi
else
    echo "检查依赖更新..."
    npm install --production --no-audit
    if [ $? -ne 0 ]; then
        echo "❌ 依赖更新失败，请检查npm错误"
        exit 1
    fi
fi

# 8. 停止已存在的进程
echo "停止已存在的进程..."
pkill -f "node server/server-ui.js" || true
pkill -f "node server/index.js" || true

# 9. 启动更新服务
echo "启动更新服务..."
cd /opt/Update
if [ -f "server/index.js" ]; then
    # 使用 pm2 启动服务（如果已安装）
    if command -v pm2 &> /dev/null; then
        pm2 delete update-api 2>/dev/null || true
        pm2 start server/index.js --name update-api
    else
        # 使用 nohup 后台运行并重定向日志
        nohup node server/index.js >> server-api.log 2>&1 &
    fi
    echo "✅ 更新服务已启动"
else
    echo "⚠️ 更新服务文件不存在，跳过启动"
fi

# 10. 启动控制面板
echo "启动控制面板..."
cd /opt/Update
if [ -f "server/server-ui.js" ]; then
    # 使用 pm2 启动服务（如果已安装）
    if command -v pm2 &> /dev/null; then
        pm2 delete update-ui 2>/dev/null || true
        pm2 start server/server-ui.js --name update-ui
    else
        # 使用 nohup 后台运行并重定向日志
        nohup node server/server-ui.js >> server.log 2>&1 &
    fi
else
    echo "❌ 控制面板文件不存在，无法启动"
    exit 1
fi

# 11. 等待服务启动
echo "等待服务启动..."
sleep 5

# 12. 检查服务状态
echo "检查服务状态..."
UI_RUNNING=false
API_RUNNING=false

if netstat -tlpn | grep :8080 > /dev/null; then
    UI_RUNNING=true
    echo "✅ 控制面板已启动 (端口 8080)"
else
    echo "❌ 控制面板未启动，请检查日志："
    tail -n 10 server.log
fi

if netstat -tlpn | grep :3000 > /dev/null; then
    API_RUNNING=true
    echo "✅ 更新服务已启动 (端口 3000)"
else
    echo "⚠️ 更新服务未启动或使用了不同端口"
fi

if $UI_RUNNING; then
    # 设置日志自动清理（每天保留最后1000行）
    if ! crontab -l | grep -q "server.log"; then
        (crontab -l 2>/dev/null; echo "0 0 * * * tail -n 1000 /opt/Update/server.log > /opt/Update/server.log.tmp && mv /opt/Update/server.log.tmp /opt/Update/server.log") | crontab -
        echo "✅ 已设置日志自动清理（每天凌晨清理，保留最后1000行）"
    fi
    
    echo ""
    echo "🎉 服务启动成功！"
    echo "📱 控制面板地址: http://103.97.179.230/"
    echo ""
    echo "如果无法访问，请检查："
    echo "1. 防火墙是否允许80端口"
    echo "2. 服务器安全组设置"
    echo "3. 网络连接"
else
    echo ""
    echo "❌ 服务启动失败，请检查日志和配置"
fi 