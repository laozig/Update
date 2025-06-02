#!/bin/bash

echo "停止服务..."

# 1. 停止Node.js服务
echo "停止Node.js服务..."
if command -v pm2 &> /dev/null; then
    echo "使用PM2停止服务..."
    pm2 delete update-ui 2>/dev/null || true
    pm2 delete update-api 2>/dev/null || true
    pm2 delete update-server 2>/dev/null || true
else
    echo "使用pkill停止服务..."
    pkill -f "node server/server-ui.js" || true
    pkill -f "node server/index.js" || true
fi

# 2. 停止Nginx
echo "停止Nginx..."
systemctl stop nginx

# 3. 检查服务状态
echo "检查服务状态..."
if ! netstat -tlpn | grep :8080 > /dev/null; then
    echo "✅ 控制面板已停止"
else
    echo "❌ 控制面板停止失败，尝试强制终止..."
    pkill -9 -f "node server/server-ui.js" || true
fi

if ! netstat -tlpn | grep :3000 > /dev/null; then
    echo "✅ 更新服务已停止"
else
    echo "❌ 更新服务停止失败，尝试强制终止..."
    pkill -9 -f "node server/index.js" || true
fi

if ! systemctl is-active --quiet nginx; then
    echo "✅ Nginx已停止"
else
    echo "❌ Nginx停止失败，请手动检查"
fi

echo "所有服务已停止" 