#!/bin/bash

echo "停止服务..."

# 1. 停止Node.js服务
echo "停止Node.js服务..."
pkill -f "node server/server-ui.js"

# 2. 停止Nginx
echo "停止Nginx..."
systemctl stop nginx

# 3. 检查服务状态
echo "检查服务状态..."
if ! netstat -tlpn | grep :8080 > /dev/null; then
    echo "✅ Node.js服务已停止"
else
    echo "❌ Node.js服务停止失败"
fi

if ! systemctl is-active --quiet nginx; then
    echo "✅ Nginx已停止"
else
    echo "❌ Nginx停止失败"
fi 