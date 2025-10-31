#!/bin/bash

# 多功能管理脚本：本地启动/停止/重启/状态/更新/部署 + Docker 部署
# 适用平台：Linux/macOS（建议在 WSL/容器/服务器上使用）

set -euo pipefail

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

info(){ echo -e "${BLUE}[信息]${NC} $*"; }
ok(){ echo -e "${GREEN}[成功]${NC} $*"; }
warn(){ echo -e "${YELLOW}[警告]${NC} $*"; }
err(){ echo -e "${RED}[错误]${NC} $*"; }

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

API_ENTRY="server/index.js"
UI_ENTRY="server/server-ui.js"
API_LOG="api-server.log"
UI_LOG="ui-server.log"
API_PIDFILE="api-server.pid"
UI_PIDFILE="ui-server.pid"

CONFIG_FILE="server/config.json"
DEFAULT_API_PORT=3000
DEFAULT_UI_PORT=8080

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
    "port": 3000,
    "adminPort": 8080,
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

deploy_local(){
  info "本地部署：安装依赖并重启"
  ensure_node_deps
  restart_local
}

# Docker 相关
compose_file(){
  echo "docker-compose.yml"
}

ensure_compose(){
  need_cmd docker
  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    err "未检测到 Docker Compose"
    exit 1
  fi
}

docker_cmd(){
  if docker compose version >/dev/null 2>&1; then echo "docker compose"; else echo "docker-compose"; fi
}

gen_compose_if_missing(){
  local file=$(compose_file)
  if [ -f "$file" ]; then return; fi
  info "未发现 $file，按默认端口生成..."
  local apiPort uiPort hostApiPort hostUiPort
  apiPort=$(get_port_from_config port); uiPort=$(get_port_from_config adminPort)
  [ -n "$apiPort" ] || apiPort=$DEFAULT_API_PORT
  [ -n "$uiPort" ] || uiPort=$DEFAULT_UI_PORT
  # 选择较冷门宿主机端口，避免与本地运行冲突；允许通过环境变量覆盖
  hostApiPort=${DOCKER_HOST_API_PORT:-33001}
  hostUiPort=${DOCKER_HOST_UI_PORT:-33081}

  # 检查端口占用并寻找可用端口
  is_port_in_use() {
    local p="$1"
    if command -v ss >/dev/null 2>&1; then
      ss -ltn 2>/dev/null | awk '{print $4}' | grep -E ":${p}$" -q && return 0 || return 1
    elif command -v lsof >/dev/null 2>&1; then
      lsof -i :"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 0 || return 1
    elif command -v netstat >/dev/null 2>&1; then
      netstat -ltn 2>/dev/null | awk '{print $4}' | grep -E ":${p}$" -q && return 0 || return 1
    else
      return 1
    fi
  }
  find_free_port() {
    local start="$1"; local p=$start; local limit=$((start+200))
    while [ $p -le $limit ]; do
      if ! is_port_in_use "$p"; then echo $p; return; fi
      p=$((p+1))
    done
    echo "$start"
  }
  hostApiPort=$(find_free_port "$hostApiPort")
  hostUiPort=$(find_free_port "$hostUiPort")
  info "Docker 端口映射: API ${hostApiPort}->${apiPort}, UI ${hostUiPort}->${uiPort}"
  cat > "$file" <<YML
services:
  update-api:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: ["sh","-lc","npm install --silent && node ${API_ENTRY}"]
    ports:
      - "${hostApiPort}:${apiPort}"
    environment:
      - NODE_ENV=production
  update-ui:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: ["sh","-lc","npm install --silent && node ${UI_ENTRY}"]
    ports:
      - "${hostUiPort}:${uiPort}"
    environment:
      - NODE_ENV=production
YML
  ok "已生成 $file"
}

docker_up(){ ensure_compose; gen_compose_if_missing; $(docker_cmd) up -d; ok "Docker 已启动"; }
docker_down(){ ensure_compose; $(docker_cmd) down; ok "Docker 已停止"; }
docker_restart(){ docker_down; docker_up; }
docker_logs(){ ensure_compose; $(docker_cmd) logs -f --tail=200 "$@"; }

pause_services(){ stop_local; warn "已暂停本地服务"; }
resume_services(){ start_local; ok "已恢复本地服务"; }

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
  local apiPort uiPort maxBody domain enableHttps certPath keyPath redirectWww
  apiPort=$(get_port_from_config port); uiPort=$(get_port_from_config adminPort)
  [ -n "$apiPort" ] || apiPort=$DEFAULT_API_PORT
  [ -n "$uiPort" ] || uiPort=$DEFAULT_UI_PORT
  maxBody=${NGX_MAX_BODY:-${MAX_UPLOAD_SIZE:-1g}}
  domain=${NGX_SERVER_NAME:-${SERVER_NAME:-_}}
  enableHttps=${NGX_ENABLE_HTTPS:-no}
  certPath=${NGX_SSL_CERT:-}
  keyPath=${NGX_SSL_KEY:-}
  redirectWww=${NGX_REDIRECT_WWW:-no}

  if [ "$enableHttps" = "yes" ] && [ -n "$certPath" ] && [ -n "$keyPath" ]; then
    cat <<NGX
server {
  listen 80;
  server_name ${domain};
  client_max_body_size ${maxBody};
  location /.well-known/acme-challenge/ { root /var/www/html; }
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name ${domain};
  client_max_body_size ${maxBody};
  ssl_certificate ${certPath};
  ssl_certificate_key ${keyPath};
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  location /api/ {
    proxy_pass http://127.0.0.1:${apiPort}/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /download/ {
    proxy_pass http://127.0.0.1:${apiPort}/download/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:${uiPort}/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGX
  else
    cat <<NGX
server {
  listen 80;
  server_name ${domain};
  client_max_body_size ${maxBody};

  location /api/ {
    proxy_pass http://127.0.0.1:${apiPort}/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /download/ {
    proxy_pass http://127.0.0.1:${apiPort}/download/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:${uiPort}/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
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

nginx_setup(){
  # 引导交互
  echo "—— Nginx 反向代理配置向导 ——"
  read -rp "请输入域名(可留空为 _ ): " _dom
  read -rp "最大上传大小(默认 1g，可填 500m/2g 等): " _size
  read -rp "是否启用 HTTPS 并使用已有证书? (y/N): " _https
  if [[ "${_https,,}" == "y" || "${_https,,}" == "yes" ]]; then
    read -rp "证书文件路径 (ssl_certificate): " _cert
    read -rp "私钥文件路径 (ssl_certificate_key): " _key
    export NGX_ENABLE_HTTPS=yes
    export NGX_SSL_CERT="${_cert}"
    export NGX_SSL_KEY="${_key}"
  else
    export NGX_ENABLE_HTTPS=no
  fi
  [ -n "${_dom}" ] && export NGX_SERVER_NAME="${_dom}" || true
  [ -n "${_size}" ] && export NGX_MAX_BODY="${_size}" || true

  nginx_install
  nginx_write_conf >/dev/null
  nginx_enable
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
用法: $0 <命令> [选项]

本地管理:
  start             启动本地服务
  stop              停止本地服务
  restart           重启本地服务
  status            查看本地服务状态
  deploy            本地部署（安装依赖 + 重启）
  update            拉取最新代码（git pull）
  pause             暂停（等同 stop）
  resume            恢复（等同 start）

Docker:
  docker:up         以 Docker Compose 启动
  docker:down       停止并移除
  docker:restart    重启
  docker:logs [svc] 查看日志（可选指定服务名）

Nginx 反向代理:
  nginx:setup       安装 Nginx 并生成/启用反代配置（API/UI）
  nginx:enable      启用站点配置并重载 Nginx
  nginx:disable     禁用站点配置并重载 Nginx
  nginx:reload      重载 Nginx 配置

证书管理（Let’s Encrypt）:
  cert:issue        交互式申请并配置 HTTPS 证书（webroot 模式）
  cert:renew        立即尝试续期证书并重载（系统建议用 cron 定时）

卸载:
  uninstall         删除本项目相关配置（Nginx 站点、compose 文件等），并可选清理数据

其他:
  help              显示帮助

无参数时：执行启动流程（安装依赖 + 启动），随后显示状态。
EOF
}

menu(){
  echo -e "${GREEN}================ 管理菜单 ================${NC}"
  echo "1) 启动 (本地)"
  echo "2) 停止 (本地)"
  echo "3) 重启 (本地)"
  echo "4) 状态"
  echo "5) 本地部署"
  echo "6) 更新代码"
  echo "7) 暂停"
  echo "8) 恢复"
  echo "9) Docker 启动"
  echo "10) Docker 停止"
  echo "11) Docker 重启"
  echo "12) Docker 日志"
  echo "13) Nginx 安装与配置"
  echo "14) 申请 HTTPS 证书 (Let’s Encrypt)"
  echo "15) 续期证书"
  echo "16) 卸载 (删除项目相关配置，可选清理数据)"
  echo "0) 退出"
  read -rp "请选择: " choice
  case "$choice" in
    1) start_local;;
    2) stop_local;;
    3) restart_local;;
    4) status_local;;
    5) deploy_local;;
    6) update_code;;
    7) pause_services;;
    8) resume_services;;
    9) docker_up;;
    10) docker_down;;
    11) docker_restart;;
    12) docker_logs;;
    13) nginx_setup;;
    14) cert_issue;;
    15) cert_renew;;
    16) uninstall_cmd;;
    0) exit 0;;
    *) warn "无效选择";;
  esac
}

cmd=${1:-}
case "$cmd" in
  start) start_local ;;
  stop) stop_local ;;
  restart) restart_local ;;
  status) status_local ;;
  deploy) deploy_local ;;
  update) update_code ;;
  pause) pause_services ;;
  resume) resume_services ;;
  docker:up) docker_up ;;
  docker:down) docker_down ;;
  docker:restart) docker_restart ;;
  docker:logs) shift || true; docker_logs "$@" ;;
  nginx:setup) nginx_setup ;;
  nginx:enable) nginx_enable ;;
  nginx:disable) nginx_disable ;;
  nginx:reload) nginx_reload ;;
  cert:issue) cert_issue ;;
  cert:renew) cert_renew ;;
  uninstall) uninstall_cmd ;;
  help|-h|--help) show_help ;;
  "") deploy_local; status_local ;;
  *) err "未知命令: $cmd"; echo; show_help; exit 1 ;;
esac

