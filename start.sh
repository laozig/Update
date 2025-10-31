#!/bin/bash

echo "此脚本已迁移为多功能 manage.sh。"
echo "常用命令示例："
echo "  ./manage.sh start        # 启动本地"
echo "  ./manage.sh stop         # 停止本地"
echo "  ./manage.sh restart      # 重启本地"
echo "  ./manage.sh status       # 查看状态"
echo "  ./manage.sh deploy       # 本地部署（安装依赖+重启）"
echo "  ./manage.sh docker:up    # Docker 启动"
echo "  ./manage.sh docker:down  # Docker 停止"
echo
exec bash ./manage.sh start