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
  local apiPort uiPort
  apiPort=$(get_port_from_config port); uiPort=$(get_port_from_config adminPort)
  [ -n "$apiPort" ] || apiPort=$DEFAULT_API_PORT
  [ -n "$uiPort" ] || uiPort=$DEFAULT_UI_PORT
  cat > "$file" <<YML
services:
  update-api:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: ["sh","-lc","npm install --silent && node ${API_ENTRY}"]
    ports:
      - "${apiPort}:${apiPort}"
    environment:
      - NODE_ENV=production
  update-ui:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: ["sh","-lc","npm install --silent && node ${UI_ENTRY}"]
    ports:
      - "${uiPort}:${uiPort}"
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

其他:
  help              显示帮助

无参数时将显示交互式菜单。
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
  help|-h|--help) show_help ;;
  "") show_help; menu ;;
  *) err "未知命令: $cmd"; echo; show_help; exit 1 ;;
esac


