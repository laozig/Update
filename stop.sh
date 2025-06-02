#!/bin/bash

echo "开始停止服务..."

# 1. 停止Node.js服务
echo "停止Node.js服务..."
pkill -f "node server/server-ui.js" || true
pkill -f "node server/index.js" || true

# 如果安装了pm2，使用pm2停止服务
if command -v pm2 &> /dev/null; then
    echo "使用PM2停止服务..."
    pm2 delete update-api 2>/dev/null || true
    pm2 delete update-ui 2>/dev/null || true
fi

# 2. 停止Nginx服务
echo "停止Nginx服务..."
systemctl stop nginx

# 3. 删除Nginx配置
echo "删除Nginx配置..."
rm -f /etc/nginx/conf.d/update-server.conf
rm -f /etc/nginx/sites-enabled/update-server

# 4. 恢复默认Nginx配置（如果需要）
if [ -f "/etc/nginx/conf.d/default.conf.bak" ]; then
    echo "恢复默认Nginx配置..."
    cp /etc/nginx/conf.d/default.conf.bak /etc/nginx/conf.d/default.conf
fi

if [ -f "/etc/nginx/sites-enabled/default.bak" ]; then
    echo "恢复默认站点配置..."
    cp /etc/nginx/sites-enabled/default.bak /etc/nginx/sites-enabled/default
fi

# 5. 重启Nginx服务（使用默认配置）
echo "重启Nginx服务..."
systemctl start nginx

# 6. 清理进程
echo "清理残留进程..."
for pid in $(ps aux | grep -E 'node.*server/(index|server-ui).js' | grep -v grep | awk '{print $2}'); do
    echo "结束进程 $pid..."
    kill -9 $pid 2>/dev/null || true
done

echo "✅ 服务已停止" 