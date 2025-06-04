#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 打印带颜色的信息
info() {
    echo -e "${GREEN}[信息] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[警告] $1${NC}"
}

error() {
    echo -e "${RED}[错误] $1${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        error "$1 未安装"
        return 1
    fi
}

# 检查是否是root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "请使用root用户运行此脚本"
        error "使用方法: sudo ./deploy.sh"
        exit 1
    fi
}

# 安装依赖
install_dependencies() {
    info "开始安装依赖..."
    
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt update
        apt install -y git docker.io docker-compose curl
    elif [ -f /etc/redhat-release ]; then
        # CentOS
        yum install -y git docker docker-compose curl
        systemctl enable docker
        systemctl start docker
    else
        error "不支持的操作系统"
        exit 1
    fi
    
    info "依赖安装完成"
}

# 配置Docker
setup_docker() {
    info "配置Docker..."
    
    # 添加当前用户到docker组
    usermod -aG docker $SUDO_USER
    
    # 启动Docker服务
    systemctl start docker
    systemctl enable docker
    
    # 验证Docker是否正常运行
    if ! docker info > /dev/null 2>&1; then
        error "Docker服务未正常运行"
        error "请尝试手动运行: systemctl status docker"
        exit 1
    fi
    
    info "Docker配置完成"
}

# 部署项目
deploy_project() {
    info "开始部署项目..."
    
    # 创建项目目录
    mkdir -p /opt/Update
    cd /opt/Update || exit 1
    
    # 克隆项目
    if [ -d ".git" ]; then
        info "更新项目代码..."
        if ! git pull; then
            error "更新代码失败"
            exit 1
        fi
    else
        info "克隆项目代码..."
        if ! git clone https://github.com/laozig/Update.git .; then
            error "克隆代码失败"
            exit 1
        fi
    fi
    
    # 创建必要的目录
    mkdir -p server/projects
    mkdir -p docker/ssl
    
    # 配置环境文件
    cd docker || exit 1
    if [ ! -f ".env" ]; then
        if [ ! -f "env.example" ]; then
            error "env.example 文件不存在"
            exit 1
        fi
        cp env.example .env
        # 获取服务器IP
        SERVER_IP=$(curl -s ifconfig.me)
        # 更新.env文件
        sed -i "s/update-server.example.com/$SERVER_IP/g" .env
    fi
    
    # 停止现有容器
    info "停止现有容器..."
    docker compose -f docker-compose.prod.yml down
    
    # 清理旧的镜像
    info "清理旧的镜像..."
    docker system prune -f
    
    # 构建Docker镜像
    info "构建Docker镜像..."
    if ! docker compose -f docker-compose.prod.yml build; then
        error "构建Docker镜像失败"
        error "请检查docker-compose.prod.yml文件是否正确"
        exit 1
    fi
    
    # 启动Docker容器
    info "启动Docker容器..."
    if ! docker compose -f docker-compose.prod.yml up -d; then
        error "启动Docker容器失败"
        error "请检查端口是否被占用"
        docker compose -f docker-compose.prod.yml logs
        exit 1
    fi
    
    # 配置防火墙
    info "配置防火墙..."
    if [ -f /etc/debian_version ]; then
        # Ubuntu
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 3000/tcp
        ufw allow 8080/tcp
    elif [ -f /etc/redhat-release ]; then
        # CentOS
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --permanent --add-port=3000/tcp
        firewall-cmd --permanent --add-port=8080/tcp
        firewall-cmd --reload
    fi
}

# 检查部署状态
check_deployment() {
    info "检查部署状态..."
    
    # 等待服务启动
    info "等待服务启动..."
    sleep 15
    
    # 显示所有容器状态
    info "当前运行的容器："
    docker ps -a
    
    # 检查容器状态
    if docker ps | grep -q "update-api"; then
        info "API服务运行正常"
    else
        error "API服务未正常运行"
        error "API服务日志："
        docker compose -f docker-compose.prod.yml logs update-api
    fi
    
    if docker ps | grep -q "update-ui"; then
        info "UI服务运行正常"
    else
        error "UI服务未正常运行"
        error "UI服务日志："
        docker compose -f docker-compose.prod.yml logs update-ui
    fi
    
    # 检查端口状态
    info "检查端口状态..."
    netstat -tlpn | grep -E ':80|:443|:3000|:8080' || true
    
    # 获取服务器IP
    SERVER_IP=$(curl -s ifconfig.me)
    
    info "部署完成！"
    info "请使用浏览器访问: http://$SERVER_IP"
    info "默认登录信息："
    info "用户名: admin"
    info "密码: admin123"
    
    # 显示如何查看日志的提示
    info "查看服务日志："
    info "API服务日志: docker compose -f /opt/Update/docker/docker-compose.prod.yml logs -f update-api"
    info "UI服务日志: docker compose -f /opt/Update/docker/docker-compose.prod.yml logs -f update-ui"
}

# 创建更新脚本
create_update_script() {
    info "创建更新脚本..."
    
    cat > /opt/Update/update.sh << 'EOF'
#!/bin/bash
cd /opt/Update
git pull
cd docker
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
EOF
    
    chmod +x /opt/Update/update.sh
    
    info "更新脚本已创建: /opt/Update/update.sh"
}

# 主函数
main() {
    info "开始部署更新服务器..."
    
    # 检查root权限
    check_root
    
    # 检查必要的命令
    check_command git || install_dependencies
    check_command docker || install_dependencies
    check_command docker-compose || install_dependencies
    
    # 配置Docker
    setup_docker
    
    # 部署项目
    deploy_project
    
    # 创建更新脚本
    create_update_script
    
    # 检查部署状态
    check_deployment
}

# 运行主函数
main 