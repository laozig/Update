#!/bin/bash

# 更新服务器一键式安装和启动脚本
# 作者: laozig
# 日期: 2024-06-04

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示带颜色的信息
info() {
  echo -e "${BLUE}[信息]${NC} $1"
}

success() {
  echo -e "${GREEN}[成功]${NC} $1"
}

warning() {
  echo -e "${YELLOW}[警告]${NC} $1"
}

error() {
  echo -e "${RED}[错误]${NC} $1"
}

# 显示脚本标题
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}       更新服务器一键式安装和启动脚本           ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

# 检查是否为root用户运行
if [ "$(id -u)" -eq 0 ]; then
  warning "您正在以root用户运行此脚本。建议使用普通用户运行。"
  read -p "是否继续? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "已取消操作"
    exit 1
  fi
fi

# 显示当前目录
info "当前目录: $(pwd)"

# 安装函数
install_dependencies() {
  info "开始安装依赖..."
  
  # 检查node是否安装
  if ! command -v node &> /dev/null; then
    error "未检测到Node.js，请先安装Node.js"
    exit 1
  fi
  
  info "Node.js版本: $(node -v)"
  info "NPM版本: $(npm -v)"
  
  # 安装Node.js依赖
  info "安装Node.js依赖..."
  npm install
  
  # 确保bcryptjs模块已安装
  info "确保bcryptjs模块已安装..."
  npm install bcryptjs --save
  
  # 创建必要的目录
  info "创建必要的目录..."
  mkdir -p server/projects
  
  # 确保配置文件存在
  info "检查配置文件..."
  if [ ! -f server/config.json ]; then
    info "创建默认配置文件..."
    cp server/config.example.json server/config.json 2>/dev/null || echo '{"projects":[],"users":[{"username":"admin","password":"admin","role":"admin","email":"admin@example.com","createdAt":"'$(date -Iseconds)'"}],"server":{"serverIp":"localhost","port":3000,"adminPort":8080,"jwtSecret":"your-secret-key-change-this-in-production","jwtExpiry":"24h"},"roles":[{"id":"admin","name":"管理员","description":"系统管理员，拥有所有权限","permissions":["all"],"isSystem":true},{"id":"user","name":"普通用户","description":"普通用户，只能管理自己的项目","permissions":["manage_own_projects"],"isSystem":true}]}' > server/config.json
  fi
  
  success "依赖安装完成！"
}

# 启动服务函数
start_services() {
  info "正在启动服务..."
  
  # 检查是否已有服务在运行
  if pgrep -f "node server/index.js" > /dev/null; then
    warning "API服务器已在运行中"
  else
    info "启动API服务器..."
    nohup node server/index.js > api-server.log 2>&1 &
    API_PID=$!
    echo $API_PID > api-server.pid
    success "API服务器已启动，PID: $API_PID"
  fi
  
  if pgrep -f "node server/server-ui.js" > /dev/null; then
    warning "控制面板已在运行中"
  else
    info "启动控制面板..."
    nohup node server/server-ui.js > ui-server.log 2>&1 &
    UI_PID=$!
    echo $UI_PID > ui-server.pid
    success "控制面板已启动，PID: $UI_PID"
  fi
  
  echo ""
  success "所有服务已启动！"
  info "API服务器运行在: http://$(hostname -I | awk '{print $1}')"
  info "控制面板运行在: http://$(hostname -I | awk '{print $1}')"
  echo ""
  info "日志文件:"
  info "- API服务器: api-server.log"
  info "- 控制面板: ui-server.log"
}

# 停止服务函数
stop_services() {
  info "正在停止服务..."
  
  # 停止API服务器
  if pgrep -f "node server/index.js" > /dev/null; then
    pkill -f "node server/index.js"
    success "API服务器已停止"
  else
    warning "API服务器未在运行"
  fi
  
  # 停止控制面板
  if pgrep -f "node server/server-ui.js" > /dev/null; then
    pkill -f "node server/server-ui.js"
    success "控制面板已停止"
  else
    warning "控制面板未在运行"
  fi
  
  # 删除PID文件
  rm -f api-server.pid ui-server.pid
  
  success "所有服务已停止"
}

# 检查服务状态函数
check_status() {
  echo ""
  info "检查服务状态..."
  
  # 检查API服务器
  if pgrep -f "node server/index.js" > /dev/null; then
    PID=$(pgrep -f "node server/index.js")
    success "API服务器正在运行 (PID: $PID)"
  else
    warning "API服务器未在运行"
  fi
  
  # 检查控制面板
  if pgrep -f "node server/server-ui.js" > /dev/null; then
    PID=$(pgrep -f "node server/server-ui.js")
    success "控制面板正在运行 (PID: $PID)"
  else
    warning "控制面板未在运行"
  fi
  
  echo ""
}

# 显示帮助信息
show_help() {
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  install    安装依赖"
  echo "  start      启动所有服务"
  echo "  stop       停止所有服务"
  echo "  restart    重启所有服务"
  echo "  status     检查服务状态"
  echo "  help       显示此帮助信息"
  echo ""
  echo "如果不提供选项，将执行安装和启动操作。"
}

# 主逻辑
case "$1" in
  install)
    install_dependencies
    ;;
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    sleep 2
    start_services
    ;;
  status)
    check_status
    ;;
  help)
    show_help
    ;;
  *)
    # 默认执行安装和启动
    install_dependencies
    start_services
    check_status
    ;;
esac

exit 0 