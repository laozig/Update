#!/bin/bash

# 更新服务器管理脚本
# 适用平台：Linux/macOS/WSL

set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志输出函数
info(){ echo -e "${BLUE}[信息]${NC} $*"; }
ok(){ echo -e "${GREEN}[成功]${NC} $*"; }
warn(){ echo -e "${YELLOW}[警告]${NC} $*"; }
err(){ echo -e "${RED}[错误]${NC} $*"; }
step(){ echo -e "${CYAN}[步骤]${NC} $*"; }

# 工作目录
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

# 服务配置
API_ENTRY="server/index.js"
UI_ENTRY="server/server-ui.js"
API_LOG="api-server.log"
UI_LOG="ui-server.log"
API_PIDFILE="api-server.pid"
UI_PIDFILE="ui-server.pid"

# 配置文件
CONFIG_FILE="server/config.json"
DEFAULT_API_PORT=33001
DEFAULT_UI_PORT=33081

need_cmd(){ command -v "$1" >/dev/null 2>&1 || { err "未找到命令: $1"; exit 1; }; }

get_port_from_config(){
  local key="$1"
  if [ -f "$CONFIG_FILE" ] && command -v jq >/dev/null 2>&1; then
    jq -r ".server.${key} // empty" "$CONFIG_FILE" 2>/dev/null || true
  else
    echo "" # 无 jq 或无配置时返回空
  fi
}

ensure_node_deps(){
  need_cmd node; need_cmd npm
  info "安装 Node 依赖..."
  npm install --silent
  # 兼容旧脚本行为，确保 bcryptjs 存在
  if ! node -e "require('bcryptjs')" >/dev/null 2>&1; then
    info "安装缺失依赖 bcryptjs..."
    npm install bcryptjs --save --silent || true
  fi
  [ -d server/projects ] || mkdir -p server/projects
  if [ ! -f "$CONFIG_FILE" ]; then
    warn "未找到 $CONFIG_FILE，创建默认配置..."
    mkdir -p server
    cat > "$CONFIG_FILE" <<'JSON'
{
  "projects": [],
  "users": [
    {
      "username": "admin",
      "password": "admin",
      "role": "admin",
      "email": "admin@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "server": {
    "serverIp": "localhost",
    "port": 33001,
    "adminPort": 33081,
    "jwtSecret": "change-me",
    "jwtExpiry": "24h"
  }
}
JSON
  fi
}

start_local(){
  ensure_node_deps
  info "启动本地服务..."
  # 使用冷门端口（可通过环境变量覆盖）
  export PORT=${LOCAL_API_PORT:-33001}
  export ADMIN_PORT=${LOCAL_UI_PORT:-33081}
  if pgrep -f "node ${API_ENTRY}" >/dev/null; then
    warn "API 已在运行"
  else
    nohup node "${API_ENTRY}" >"${API_LOG}" 2>&1 & echo $! >"${API_PIDFILE}"
    ok "API 启动，PID $(cat ${API_PIDFILE})"
  fi
  if pgrep -f "node ${UI_ENTRY}" >/dev/null; then
    warn "UI 已在运行"
  else
    nohup node "${UI_ENTRY}" >"${UI_LOG}" 2>&1 & echo $! >"${UI_PIDFILE}"
    ok "UI 启动，PID $(cat ${UI_PIDFILE})"
  fi
  print_access_local
}

print_access_local(){
  local hostIp
  if command -v hostname >/dev/null 2>&1; then
    hostIp=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  [ -n "$hostIp" ] || hostIp="127.0.0.1"
  echo ""
  info "本地运行访问地址:"
  echo "- UI:  http://${hostIp}:${ADMIN_PORT}"
  echo "- API: http://${hostIp}:${PORT}"
  echo ""
}

stop_local(){
  info "停止本地服务..."
  pgrep -f "node ${API_ENTRY}" >/dev/null && pkill -f "node ${API_ENTRY}" && ok "API 已停止" || warn "API 未运行"
  pgrep -f "node ${UI_ENTRY}" >/dev/null && pkill -f "node ${UI_ENTRY}" && ok "UI 已停止" || warn "UI 未运行"
  rm -f "${API_PIDFILE}" "${UI_PIDFILE}"
}

restart_local(){ stop_local; sleep 1; start_local; }

status_local(){
  if pgrep -f "node ${API_ENTRY}" >/dev/null; then ok "API 运行中 (PID $(pgrep -f "node ${API_ENTRY}" | paste -sd, -))"; else warn "API 未运行"; fi
  if pgrep -f "node ${UI_ENTRY}" >/dev/null; then ok "UI 运行中 (PID $(pgrep -f "node ${UI_ENTRY}" | paste -sd, -))"; else warn "UI 未运行"; fi
}

update_code(){
  if [ -d .git ]; then
    info "更新代码 (git pull)..."
    git pull --rebase --autostash || true
    info "安装更新后的依赖..."
    npm install --silent || true
    ok "代码与依赖更新完成"
  else
    warn "未检测到 .git，跳过更新"
  fi
}

install_deploy(){
  # 安装部署：安装依赖并启动服务
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}   安装部署向导${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  
  step "1/3 检查 Node.js 环境..."
  if ! command -v node >/dev/null 2>&1; then
    err "未检测到 Node.js，请先安装 Node.js"
    err "安装方法:"
    err "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    err "  CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
    err "  或使用 nvm: curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    return 1
  fi
  info "Node.js 版本: $(node -v)"
  info "npm 版本: $(npm -v)"
  
  step "2/3 安装项目依赖..."
  ensure_node_deps
  
  step "3/3 启动服务..."
  start_local
  
  echo ""
  ok "安装部署完成!"
  echo ""
  info "服务已启动，可通过以下地址访问:"
  print_access_local
}

## Docker 支持已移除（如需恢复请使用历史版本）

# 彻底移除与本项目相关的 Docker 资源（容器/网络/镜像）并删除 compose 文件
docker_purge(){
  warn "即将移除与本项目相关的 Docker 资源..."
  # 先尝试正常 down
  if [ -f "$(compose_file)" ]; then
    $(docker_cmd) down || true
    rm -f "$(compose_file)" || true
  fi
  # 按名称特征清理容器/镜像/网络
  # 容器名称可能为 update、update-update-api-1、update-update-ui-1 等
  docker ps -a --format '{{.Names}}' | awk '/^update($|-)/{print $0}' | xargs -r -I{} docker rm -f {} || true
  docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '/^update($|:)/{print $2}' | xargs -r docker rmi -f || true
  docker network ls --format '{{.Name}}' | awk '/^update_default$/{print $0}' | xargs -r docker network rm || true
  ok "Docker 相关资源已清理；已删除 docker-compose.yml。"
}

pause_services(){ 
  stop_local
  warn "服务已暂停"
}

# ---------------- Nginx 反向代理 ----------------
detect_os_pkg(){
  if command -v apt >/dev/null 2>&1; then echo apt; return; fi
  if command -v apt-get >/dev/null 2>&1; then echo apt; return; fi
  if command -v yum >/dev/null 2>&1; then echo yum; return; fi
  if command -v dnf >/dev/null 2>&1; then echo dnf; return; fi
  if command -v apk >/dev/null 2>&1; then echo apk; return; fi
  echo unknown
}

# ---------------- 卸载逻辑 ----------------
uninstall_cmd(){
  warn "将删除本项目相关配置与文件（不卸载 Docker/Nginx 程序）。"
  # 停止本地服务（仅当前项目的 Node 进程）
  stop_local || true
  
  # 删除 Nginx 站点配置（仅本站点），并重载
  nginx_disable || true

  # 询问是否清理数据
  if [ "${UNINSTALL_PURGE:-no}" = "yes" ]; then
    _ans="YES"
  else
    read -rp "是否删除生成的数据与依赖（server/projects, server/config.json, node_modules, 日志等）? 输入 YES 确认: " _ans || true
  fi
  if [ "${_ans}" = "YES" ]; then
    info "删除生成数据与依赖..."
    rm -rf server/projects || true
    rm -f server/config.json || true
    rm -rf node_modules || true
    rm -f api-server.log ui-server.log server.log || true
    rm -f api-server.pid ui-server.pid || true
    # 仅删除 compose 文件，不操作 Docker 容器
    rm -f docker-compose.yml || true
    ok "数据清理完成"
  else
    warn "已跳过数据清理"
  fi

  ok "卸载完成：已删除站点配置及项目文件（按选择）。未卸载 Docker/Nginx 程序本身。"
}

nginx_install(){
  if command -v nginx >/dev/null 2>&1; then ok "已安装 Nginx"; return; fi
  local pm=$(detect_os_pkg)
  warn "未检测到 Nginx，开始安装（需要 root 权限）..."
  case "$pm" in
    apt)
      sudo apt update -y && sudo apt install -y nginx ;;
    yum)
      sudo yum install -y epel-release || true
      sudo yum install -y nginx ;;
    dnf)
      sudo dnf install -y nginx ;;
    apk)
      sudo apk add --no-cache nginx ;;
    *)
      err "无法识别包管理器，请手动安装 Nginx"; exit 1 ;;
  esac
  ok "Nginx 安装完成"
}

nginx_paths(){
  # 输出三个值：sites_available sites_enabled conf_d
  if [ -d "/etc/nginx/sites-available" ]; then
    echo "/etc/nginx/sites-available" "/etc/nginx/sites-enabled" "/etc/nginx/conf.d"
  else
    echo "" "" "/etc/nginx/conf.d"
  fi
}

nginx_conf_content(){
  local apiPort uiPort maxBody domain enableHttps certPath keyPath
  # 解析上游端口：优先使用环境变量，其次使用默认值
  # 注意：不读取配置文件中的端口，因为配置文件中的端口可能与实际启动端口不一致
  apiPort=${PORT:-${LOCAL_API_PORT:-$DEFAULT_API_PORT}}
  uiPort=${ADMIN_PORT:-${LOCAL_UI_PORT:-$DEFAULT_UI_PORT}}
  maxBody=${NGX_MAX_BODY:-${MAX_UPLOAD_SIZE:-1g}}
  domain=${NGX_SERVER_NAME:-${SERVER_NAME:-_}}
  enableHttps=${NGX_ENABLE_HTTPS:-no}
  certPath=${NGX_SSL_CERT:-}
  keyPath=${NGX_SSL_KEY:-}

  if [ "$enableHttps" = "yes" ] && [ -n "$certPath" ] && [ -n "$keyPath" ]; then
    # HTTPS 配置
    cat <<NGX
# HTTP 重定向到 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # ACME 验证目录（Let's Encrypt）
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # 所有其他请求重定向到 HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS 服务器配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${domain};

    # SSL 证书配置
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};

    # SSL 协议和加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 文件上传大小限制
    client_max_body_size ${maxBody};
    client_body_buffer_size 128k;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # 代理超时设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    # API 接口代理
    location /api/ {
        proxy_pass http://127.0.0.1:${apiPort}/api/;
        proxy_http_version 1.1;
        
        # 保留原始请求头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        proxy_set_header Connection "";
        
        # 禁用缓冲（适用于流式传输）
        proxy_buffering off;
        
        # 错误页面
        proxy_intercept_errors on;
        error_page 502 503 504 /50x.html;
    }

    # 文件下载代理
    location /download/ {
        proxy_pass http://127.0.0.1:${apiPort}/download/;
        proxy_http_version 1.1;
        
        # 保留原始请求头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # 下载优化
        proxy_buffering off;
        proxy_request_buffering off;
        
        # 大文件下载支持
        proxy_max_temp_file_size 0;
        
        # 设置下载超时（大文件可能需要更长时间）
        proxy_read_timeout 300s;
    }

        # 控制面板代理
    location / {
        proxy_pass http://127.0.0.1:${uiPort}/;
        proxy_http_version 1.1;
        
        # 保留原始请求头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # WebSocket 支持（如果将来需要）
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 错误页面
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }

    # 日志配置
    access_log /var/log/nginx/update-server-access.log;
    error_log /var/log/nginx/update-server-error.log;
}
NGX
  else
    # HTTP 配置
    cat <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # 文件上传大小限制
    client_max_body_size ${maxBody};
    client_body_buffer_size 128k;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # 代理超时设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    # ACME 验证目录（Let's Encrypt）
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # API 接口代理
    location /api/ {
        proxy_pass http://127.0.0.1:${apiPort}/api/;
        proxy_http_version 1.1;
        
        # 保留原始请求头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        proxy_set_header Connection "";
        
        # 禁用缓冲
        proxy_buffering off;
        
        # 错误页面
        proxy_intercept_errors on;
        error_page 502 503 504 /50x.html;
    }

    # 文件下载代理
    location /download/ {
        proxy_pass http://127.0.0.1:${apiPort}/download/;
        proxy_http_version 1.1;
        
        # 保留原始请求头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # 下载优化
        proxy_buffering off;
        proxy_request_buffering off;
        
        # 大文件下载支持
        proxy_max_temp_file_size 0;
        
        # 设置下载超时
        proxy_read_timeout 300s;
    }

    # 控制面板代理
    location / {
        proxy_pass http://127.0.0.1:${uiPort}/;
        proxy_http_version 1.1;
        
        # 保留原始请求头
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # WebSocket 支持
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 错误页面
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }

    # 日志配置
    access_log /var/log/nginx/update-server-access.log;
    error_log /var/log/nginx/update-server-error.log;
}
NGX
  fi
}

nginx_write_conf(){
  read -r sites_av sites_en conf_d < <(nginx_paths)
  local name="update-server"
  if [ -n "$sites_av" ]; then
    # Debian/Ubuntu 风格
    local conf="$sites_av/${name}"
    info "写入 Nginx 配置: $conf"
    nginx_conf_content | sudo tee "$conf" >/dev/null
    echo "$conf"
  else
    # RHEL/Alpine 风格
    local conf="$conf_d/${name}.conf"
    info "写入 Nginx 配置: $conf"
    nginx_conf_content | sudo tee "$conf" >/dev/null
    echo "$conf"
  fi
}

nginx_enable(){
  nginx_install
  read -r sites_av sites_en conf_d < <(nginx_paths)
  local name="update-server"
  local conf_path
  if [ -n "$sites_av" ]; then
    conf_path="$sites_av/${name}"
    if [ ! -f "$conf_path" ]; then nginx_write_conf >/dev/null; fi
    sudo ln -sf "$conf_path" "$sites_en/${name}"
  else
    conf_path="$conf_d/${name}.conf"
    if [ ! -f "$conf_path" ]; then nginx_write_conf >/dev/null; fi
  fi
  sudo nginx -t
  sudo systemctl enable nginx >/dev/null 2>&1 || true
  sudo systemctl restart nginx || sudo service nginx restart || sudo nginx -s reload
  ok "Nginx 配置已启用并重载"
}

nginx_disable(){
  read -r sites_av sites_en conf_d < <(nginx_paths)
  local name="update-server"
  if [ -n "$sites_en" ] && [ -L "$sites_en/${name}" ]; then
    sudo rm -f "$sites_en/${name}"
  fi
  if [ -f "$conf_d/${name}.conf" ]; then
    sudo rm -f "$conf_d/${name}.conf"
  fi
  sudo nginx -t || true
  sudo nginx -s reload || sudo systemctl reload nginx || true
  ok "Nginx 配置已禁用"
}

nginx_reload(){
  sudo nginx -t
  sudo nginx -s reload || sudo systemctl reload nginx || true
  ok "Nginx 已重载"
}

nginx_setup_with_cert(){
  # Nginx 反向代理配置向导（自动申请证书）
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}   Nginx 反向代理配置向导${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  
  # 检查服务是否已启动
  if ! pgrep -f "node ${API_ENTRY}" >/dev/null || ! pgrep -f "node ${UI_ENTRY}" >/dev/null; then
    warn "检测到服务未运行，请先启动服务（菜单选项 1 或 2）"
    read -rp "是否现在启动服务? (Y/n): " start_now
    if [[ "${start_now,,}" != "n" && "${start_now,,}" != "no" ]]; then
      start_local
    else
      warn "已取消配置"
      return 1
    fi
  fi
  
  # 输入域名
  local domain=""
  while [ -z "$domain" ]; do
    read -rp "请输入域名 (例如: updates.example.com): " domain
    if [ -z "$domain" ]; then
      err "域名不能为空"
    fi
  done
  
  # 输入邮箱
  local email=""
  while [ -z "$email" ]; do
    read -rp "请输入管理员邮箱 (用于证书到期提醒): " email
    if [ -z "$email" ]; then
      err "邮箱不能为空"
    fi
  done
  
  # 上传大小限制
  read -rp "最大上传大小 (默认: 1g, 可填 500m/2g 等): " upload_size
  upload_size=${upload_size:-1g}
  
  # 显示配置摘要和端口信息
  local current_api_port=${PORT:-${LOCAL_API_PORT:-$DEFAULT_API_PORT}}
  local current_ui_port=${ADMIN_PORT:-${LOCAL_UI_PORT:-$DEFAULT_UI_PORT}}
  echo ""
  info "配置摘要:"
  echo "  域名: ${domain}"
  echo "  邮箱: ${email}"
  echo "  上传限制: ${upload_size}"
  echo "  API 端口: ${current_api_port}"
  echo "  UI 端口: ${current_ui_port}"
  echo "  SSL 证书: 将自动申请 Let's Encrypt 证书"
  echo ""
  read -rp "确认以上配置? (Y/n): " confirm
  if [[ "${confirm,,}" == "n" || "${confirm,,}" == "no" ]]; then
    warn "已取消配置"
    return
  fi
  
  # 安装 Nginx 和 Certbot
  step "1/6 安装 Nginx..."
  nginx_install
  step "2/6 安装 Certbot..."
  certbot_install
  
  # 确保 webroot 目录存在
  step "3/6 准备 ACME 验证目录..."
  sudo mkdir -p /var/www/html
  sudo chown -R root:root /var/www/html
  sudo chmod -R 755 /var/www/html
  
  # 先配置 HTTP 版本的 Nginx（用于证书验证）
  step "4/6 配置临时 HTTP 服务..."
  export NGX_SERVER_NAME="${domain}"
  export NGX_MAX_BODY="${upload_size}"
  export NGX_ENABLE_HTTPS=no
  # 确保端口环境变量已设置
  export PORT="${current_api_port}"
  export ADMIN_PORT="${current_ui_port}"
  nginx_write_conf >/dev/null
  nginx_enable
  
  # 等待 Nginx 完全启动
  sleep 2
  
  # 检查域名是否可以访问
  info "验证域名 ${domain} 是否已正确解析到此服务器..."
  if ! nslookup "${domain}" >/dev/null 2>&1 && ! getent hosts "${domain}" >/dev/null 2>&1; then
    warn "无法解析域名 ${domain}，请确保 DNS 已正确配置"
    read -rp "继续申请证书? (y/N): " continue_anyway
    if [[ "${continue_anyway,,}" != "y" && "${continue_anyway,,}" != "yes" ]]; then
      err "已取消配置"
      nginx_disable
      return 1
    fi
  fi
  
  # 申请证书
  step "5/6 申请 Let's Encrypt 证书..."
  info "正在申请证书，请稍候..."
  if sudo certbot certonly --non-interactive --agree-tos --email "${email}" \
    --webroot -w /var/www/html -d "${domain}" 2>&1 | tee /tmp/certbot.log; then
    ok "证书申请成功"
  else
    err "证书申请失败"
    warn "请检查:"
    warn "  1. 域名 ${domain} 是否已正确解析到此服务器"
    warn "  2. 80 端口是否已开放"
    warn "  3. 是否有其他服务占用 80 端口"
    warn "  4. 防火墙是否允许 Let's Encrypt 访问验证目录"
    nginx_disable
    return 1
  fi
  
  # 获取证书路径
  local cert="/etc/letsencrypt/live/${domain}/fullchain.pem"
  local key="/etc/letsencrypt/live/${domain}/privkey.pem"
  
  if [ ! -f "$cert" ] || [ ! -f "$key" ]; then
    err "证书文件不存在：$cert 或 $key"
    nginx_disable
    return 1
  fi
  
  # 配置 HTTPS
  step "6/6 配置 HTTPS 并启用..."
  export NGX_ENABLE_HTTPS=yes
  export NGX_SSL_CERT="$cert"
  export NGX_SSL_KEY="$key"
  # 确保端口环境变量已设置
  export PORT="${current_api_port}"
  export ADMIN_PORT="${current_ui_port}"
  nginx_write_conf >/dev/null
  nginx_enable
  
  # 设置自动续签
  cert_setup_auto_renew
  
  # 测试证书续签
  info "测试证书自动续签..."
  sudo certbot renew --dry-run --quiet || true
  
  echo ""
  ok "Nginx 反向代理配置完成!"
  echo ""
  info "访问地址:"
  echo "  HTTP:  http://${domain} (将自动重定向到 HTTPS)"
  echo "  HTTPS: https://${domain}"
  echo ""
  info "证书信息:"
  echo "  证书路径: ${cert}"
  echo "  私钥路径: ${key}"
  echo "  自动续签: 已配置（每天 3:00）"
  echo ""
  warn "请确保防火墙已开放 80 和 443 端口"
  info "提示: 如果访问出现问题，请检查服务是否在运行（菜单选项 5）"
}

# ---------------- 证书管理（Certbot） ----------------
certbot_install(){
  if command -v certbot >/dev/null 2>&1; then return; fi
  local pm=$(detect_os_pkg)
  info "安装 certbot..."
  case "$pm" in
    apt)
      sudo apt update -y && sudo apt install -y certbot ;; # 使用 webroot 插件无需额外包
    yum)
      sudo yum install -y certbot ;; 
    dnf)
      sudo dnf install -y certbot ;;
    apk)
      sudo apk add --no-cache certbot ;;
    *) err "无法自动安装 certbot，请手动安装"; exit 1 ;;
  esac
}

cert_issue(){
  nginx_install
  certbot_install
  # 确保有可用的 webroot
  sudo mkdir -p /var/www/html
  sudo chown root:root /var/www/html

  echo "—— 证书申请向导（Let’s Encrypt）——"
  read -rp "域名（例如 updates.example.com）: " _dom
  read -rp "管理员邮箱（用于到期提醒）: " _email
  if [ -z "$_dom" ] || [ -z "$_email" ]; then err "域名与邮箱均不能为空"; exit 1; fi

  # 写入/启用临时 80 端口配置，暴露 .well-known
  export NGX_SERVER_NAME="${_dom}"
  export NGX_MAX_BODY="${NGX_MAX_BODY:-${MAX_UPLOAD_SIZE:-1g}}"
  export NGX_ENABLE_HTTPS=no
  nginx_write_conf >/dev/null
  nginx_enable

  # 请求证书（webroot 模式，不中断 Nginx）
  sudo certbot certonly --non-interactive --agree-tos --email "${_email}" \
    --webroot -w /var/www/html -d "${_dom}" || { err "证书申请失败"; exit 1; }

  # 获取证书路径
  local cert="/etc/letsencrypt/live/${_dom}/fullchain.pem"
  local key="/etc/letsencrypt/live/${_dom}/privkey.pem"
  if [ ! -f "$cert" ] || [ ! -f "$key" ]; then err "证书文件不存在：$cert 或 $key"; exit 1; fi

  # 重新生成启用 HTTPS 的 Nginx 配置
  export NGX_ENABLE_HTTPS=yes
  export NGX_SSL_CERT="$cert"
  export NGX_SSL_KEY="$key"
  nginx_write_conf >/dev/null
  nginx_enable
  ok "证书已申请并配置成功：https://${_dom}"
  # 设置自动续签 & 进行一次干跑自检
  cert_setup_auto_renew
  info "进行续签干跑检测（不实际更换证书）..."
  sudo certbot renew --dry-run --quiet || true
  ok "证书申请与自动续签配置完成"
}

cert_renew(){
  certbot_install
  sudo certbot renew --quiet || true
  nginx_reload
  ok "已尝试续期并重载 Nginx"
}

# 为 root 配置自动续签（每天 3:00），若已存在则跳过
cert_setup_auto_renew(){
  local entry='0 3 * * * certbot renew --quiet && nginx -s reload'
  local has_cron
  has_cron=$(sudo crontab -l 2>/dev/null | grep -F "${entry}" || true)
  if [ -z "$has_cron" ]; then
    info "配置证书自动续签（cron，每天 3:00）..."
    (sudo crontab -l 2>/dev/null; echo "$entry") | sudo crontab -
  else
    info "已存在证书自动续签任务，跳过"
  fi
}

show_help(){
  cat <<EOF
用法: $0 <命令>

命令列表:
  install           安装部署（安装依赖并启动服务）
  start             启动服务
  pause             暂停服务
  restart           重启服务
  status            查看服务状态
  nginx             配置 Nginx 反向代理（自动申请证书）

其他:
  help              显示帮助

无参数时：显示交互式菜单。
EOF
}

menu(){
  while true; do
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}        更新服务器管理菜单${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "1) 安装部署"
    echo "2) 启动服务"
    echo "3) 暂停服务"
    echo "4) 重启服务"
    echo "5) 服务状态"
    echo "6) Nginx 反向代理"
    echo "0) 退出"
    echo ""
    read -rp "请选择 [0-6]: " choice
    
    case "$choice" in
      1) 
        install_deploy
        read -rp "按回车键继续..." 
        ;;
      2) 
        start_local
        read -rp "按回车键继续..."
        ;;
      3) 
        pause_services
        read -rp "按回车键继续..."
        ;;
      4) 
        restart_local
        read -rp "按回车键继续..."
        ;;
      5) 
        echo ""
        status_local
        echo ""
        read -rp "按回车键继续..."
        ;;
      6) 
        nginx_setup_with_cert
        read -rp "按回车键继续..."
        ;;
      0) 
        echo ""
        info "再见!"
        exit 0
        ;;
      *) 
        warn "无效选择，请重新输入"
        sleep 1
        ;;
    esac
  done
}

# 命令处理
cmd=${1:-}
case "$cmd" in
  install)
    install_deploy
    ;;
  start)
    start_local
    ;;
  pause|stop)
    pause_services
    ;;
  restart)
    restart_local
    ;;
  status)
    status_local
    ;;
  nginx)
    nginx_setup_with_cert
    ;;
  help|-h|--help)
    show_help
    ;;
  "")
    menu
    ;;
  *)
    err "未知命令: $cmd"
    echo ""
    show_help
    exit 1
    ;;
esac

