#!/bin/bash

# 更新服务器停止脚本
# 作者：Claude
# 日期：2023-06-02

# 设置工作目录
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $APP_DIR

# 从PID文件中读取进程ID
if [ -f "$APP_DIR/server.pid" ]; then
    PID=$(cat $APP_DIR/server.pid)
    if ps -p $PID > /dev/null; then
        echo "正在停止更新服务器，PID: $PID"
        kill $PID
        sleep 2
        
        # 检查进程是否已经停止
        if ps -p $PID > /dev/null; then
            echo "服务器未能正常停止，尝试强制终止..."
            kill -9 $PID
            sleep 1
        fi
        
        # 再次检查
        if ps -p $PID > /dev/null; then
            echo "无法停止服务器进程，请手动检查"
            exit 1
        else
            echo "更新服务器已成功停止"
            rm -f $APP_DIR/server.pid
        fi
    else
        echo "服务器进程已不存在"
        rm -f $APP_DIR/server.pid
    fi
else
    # 尝试通过进程名查找
    PID=$(pgrep -f "node server/server-ui.js")
    if [ ! -z "$PID" ]; then
        echo "找到更新服务器进程，PID: $PID"
        echo "正在停止..."
        kill $PID
        sleep 2
        
        # 检查进程是否已经停止
        if ps -p $PID > /dev/null; then
            echo "服务器未能正常停止，尝试强制终止..."
            kill -9 $PID
        fi
        echo "更新服务器已停止"
    else
        echo "未找到运行中的更新服务器进程"
    fi
fi

exit 0 