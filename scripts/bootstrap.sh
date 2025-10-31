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

install_node(){
  if command -v node >/dev/null 2>&1; then
    info "Node.js 已安装: $(node -v)"; return
  fi
  local pm=$(detect_pm)
  warn "未检测到 Node.js，开始安装..."
  case "$pm" in
    apt)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs ;;
    dnf)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo dnf install -y nodejs ;;
    yum)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo yum install -y nodejs ;;
    apk)
      sudo apk add --no-cache nodejs npm ;;
    *)
      warn "无法识别包管理器，尝试使用 nvm 安装 Node.js LTS"
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
      nvm install --lts
      ;;
  esac
  ok "Node.js 安装完成: $(node -v)"
}

main(){
  ensure_tools
  if [ "${INSTALL_NODE:-no}" = "yes" ]; then
    install_node
  else
    warn "未自动安装 Node.js（设置 INSTALL_NODE=yes 可自动安装）"
  fi
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

  if [ "${AUTO_DEPLOY:-no}" = "yes" ]; then
    info "开始部署（安装依赖并启动）..."
    ./manage.sh deploy
    ok "部署完成。"
  else
    warn "已完成下载与准备，但未自动启动（按你的要求）。"
  fi

  echo
  echo "下一步："
  echo "  进入目录: cd $INSTALL_DIR"
  echo "  启动（本地）: ./manage.sh deploy    # 或 update-manage deploy"
  echo "  常用命令:     ./manage.sh status | start | stop | restart | update"
  echo "               ./manage.sh nginx:setup | cert:issue"
  echo "  卸载（仅删项目配置/数据）: ./manage.sh uninstall   # 可配 UNINSTALL_PURGE=yes"

  # 可选：创建全局可执行入口，方便任意目录运行
  if [ "${CREATE_WRAPPER:-no}" = "yes" ]; then
    WRAP=/usr/local/bin/update-manage
    if [ -w "/usr/local/bin" ] || sudo -n true 2>/dev/null; then
      info "创建全局入口: $WRAP"
      sudo tee "$WRAP" >/dev/null <<WRAP
#!/usr/bin/env bash
cd "$INSTALL_DIR" && exec ./manage.sh "$@"
WRAP
      sudo chmod +x "$WRAP" || true
      ok "已创建入口。现在可在任意目录运行： update-manage status"
    else
      warn "无法写入 /usr/local/bin（无 sudo 权限），跳过创建全局入口。"
    fi
  fi
}

main "$@"


