#!/usr/bin/env bash
set -euo pipefail

# 一键安装与启动脚本（Linux/macOS/WSL）
# 用法：
#   bash <(curl -fsSL https://raw.githubusercontent.com/laozig/Update/main/scripts/bootstrap.sh)
# 可选环境变量：
#   INSTALL_DIR=/opt/update-server  SERVER_NAME=updates.example.com  MAX_UPLOAD_SIZE=1g

REPO_URL="https://github.com/laozig/Update.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Update}"

info(){ echo -e "\033[0;34m[信息]\033[0m $*"; }
ok(){ echo -e "\033[0;32m[成功]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[警告]\033[0m $*"; }
err(){ echo -e "\033[0;31m[错误]\033[0m $*"; }

detect_pm(){
  command -v apt >/dev/null 2>&1 && { echo apt; return; }
  command -v apt-get >/dev/null 2>&1 && { echo apt; return; }
  command -v dnf >/dev/null 2>&1 && { echo dnf; return; }
  command -v yum >/dev/null 2>&1 && { echo yum; return; }
  command -v apk >/dev/null 2>&1 && { echo apk; return; }
  echo unknown
}

ensure_tools(){
  local pm=$(detect_pm)
  for tool in git curl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      warn "未检测到 $tool，准备安装..."
      case "$pm" in
        apt) sudo apt update -y && sudo apt install -y "$tool" ;;
        dnf) sudo dnf install -y "$tool" ;;
        yum) sudo yum install -y "$tool" ;;
        apk) sudo apk add --no-cache "$tool" ;;
        *) err "无法自动安装 $tool，请先手动安装后重试"; exit 1 ;;
      esac
    fi
  done
}

main(){
  ensure_tools
  info "安装目录: $INSTALL_DIR"
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "检测到已有仓库，执行更新..."
    git -C "$INSTALL_DIR" pull --rebase --autostash || true
  else
    mkdir -p "$INSTALL_DIR"
    info "克隆仓库..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"
  chmod +x manage.sh || true

  info "开始部署（安装依赖并启动）..."
  ./manage.sh deploy
  ok "部署完成。常用命令：./manage.sh status | start | stop | nginx:setup | cert:issue"
}

main "$@"


