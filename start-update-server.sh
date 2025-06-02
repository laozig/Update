#!/bin/bash

# 更新服务器启动脚本
# 作者：Claude
# 日期：2023-06-02

# 设置工作目录
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $APP_DIR

# 创建日志目录
mkdir -p logs

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 检查是否已经在运行
PID=$(pgrep -f "node server/server-ui.js")
if [ ! -z "$PID" ]; then
    echo "更新服务器已经在运行，PID: $PID"
    exit 0
fi

# 启动控制面板服务器
echo "正在启动更新服务器控制面板..."
nohup node server/server-ui.js > logs/server-ui.log 2>&1 &
UI_PID=$!
echo "控制面板服务器已启动，PID: $UI_PID"

# 等待几秒钟确保服务器正常运行
sleep 2

# 检查服务器是否成功启动
if ps -p $UI_PID > /dev/null; then
    echo "更新服务器控制面板已成功启动"
    echo "可以通过 http://服务器IP:3000 访问控制面板"
    echo "日志文件位于: $APP_DIR/logs/server-ui.log"
else
    echo "更新服务器启动失败，请检查日志文件"
    exit 1
fi

# 保存PID到文件中，方便后续停止服务
echo $UI_PID > $APP_DIR/server.pid

exit 0 