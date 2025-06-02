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

# 2. 清理进程
echo "清理残留进程..."
for pid in $(ps aux | grep -E 'node.*server/(index|server-ui).js' | grep -v grep | awk '{print $2}'); do
    echo "结束进程 $pid..."
    kill -9 $pid 2>/dev/null || true
done

echo "✅ 服务已停止" 