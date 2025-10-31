# Node.js 多项目自动更新服务器（一键脚本 / Nginx / HTTPS / Docker）

基于 Node.js + Express 的多项目更新分发服务，内置图形化控制面板；支持多用户与项目隔离、API 上传/下载、Nginx 反代、Let’s Encrypt 一键证书与自动续签、Docker 一键部署。

仓库：`https://github.com/laozig/Update.git`

## 功能特性
- 多项目隔离：`projectId` + `x-api-key`
- 多用户/权限：管理员与普通用户，项目所有权校验
- 版本管理：上传包自动重命名附加版本号，生成下载链接
- 控制面板：浏览器管理项目/版本/日志
- 首启安全：无用户时自动生成随机管理员（写入 `server/first-run-admin.txt`）或用环境变量创建
- Nginx 一键反代：交互式生成/启用站点；可选 HTTPS
- Let’s Encrypt：一键申请证书并自动配置续签（cron）
- Docker：本地开发与简单部署一键 Compose
- 大文件优化：可配置上传上限（支持 `1g`/`500m` 等）

## 快速开始
一键安装（Linux/macOS/WSL）：
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/laozig/Update/main/scripts/bootstrap.sh)
```
可选：`INSTALL_DIR` `SERVER_NAME` `MAX_UPLOAD_SIZE`
### Windows（推荐）
```bat
git clone https://github.com/laozig/Update.git
cd Update
manage.bat deploy   :: 安装依赖并启动（等同 ./manage.sh deploy）
manage.bat status   :: 查看状态
```
- 常用：`manage.bat start|stop|restart|update|docker:up|nginx:setup|cert:issue`
- 若提示未找到 Bash/WSL，请安装 Git Bash 或启用 WSL

### Linux/macOS
```bash
git clone https://github.com/laozig/Update.git
cd Update
./manage.sh deploy   # 安装依赖并启动 API/UI
./manage.sh status
```
- 常用：`./manage.sh start|stop|restart|update|docker:up|nginx:setup|cert:issue`
 - 卸载：`./manage.sh uninstall`（删除本项目 Nginx 站点与 compose 文件；可选清理数据，`UNINSTALL_PURGE=yes` 跳过确认）

## 环境变量（推荐）
- `BASE_URL`：对外地址（如 `https://updates.example.com`）；未设时按请求自动推断
- `JWT_SECRET`：JWT 密钥（强随机值）
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`：首启创建固定管理员（未提供则自动生成随机管理员并写入 `server/first-run-admin.txt`）
- `MAX_UPLOAD_SIZE`：上传大小上限（如 `1gb`、`500mb`，默认 100MB）

## 一键脚本命令（节选）
- 本地：`start` `stop` `restart` `status` `deploy` `update` `pause` `resume`
- Docker：`docker:up` `docker:down` `docker:restart` `docker:logs [svc]`
- Nginx：`nginx:setup`（交互式向导） `nginx:enable` `nginx:disable` `nginx:reload`
- 证书：`cert:issue`（申请并自动续签） `cert:renew`

## Nginx 与证书（一键）
- 反代向导：
```bash
sudo ./manage.sh nginx:setup
# 交互输入域名、最大上传大小，选择是否启用 HTTPS（可填已有证书路径）
```
- 申请证书并自动续签：
```bash
sudo ./manage.sh cert:issue
# webroot 模式申请 Let’s Encrypt；自动写入 Nginx 配置并开启 443
# 自动写入 cron：每天 3:00 续签并重载 Nginx
```

## Docker（可选）
```bash
./manage.sh docker:up       # 生成/启动 compose（缺失时自动生成，挂载源码，容器内 npm install）
./manage.sh docker:logs     # 查看日志
./manage.sh docker:down     # 停止
```

## 首次启动与安全
- 首次无用户：自动生成 `admin-xxxxxx` 与 16 位强密码，写入 `server/first-run-admin.txt`（仅一次性提示），`config.json` 中存储 bcrypt 哈希
- 或通过环境变量预置：`ADMIN_USERNAME` + `ADMIN_PASSWORD`
- 设置强随机 `JWT_SECRET`，生产务必启用 HTTPS

## 核心 API
- `GET /api/version/:projectId` 获取最新版本（公开）
- `GET /download/:projectId/latest` 下载最新版本
- `GET /download/:projectId/:version` 下载指定版本
- `POST /api/upload/:projectId` 上传版本（需 `x-api-key`）；表单字段：`file`、`version`、`releaseNotes?`

## 目录结构（简）
```
Update/
├── server/
│   ├── index.js          # API
│   ├── server-ui.js      # 控制面板
│   ├── config.json       # 运行期生成/维护
│   └── projects/         # 每项目的 version.json 与 uploads/
├── manage.sh             # 核心一键脚本（Linux/macOS/WSL）
├── manage.bat            # Windows 入口（调用 manage.sh）
├── package.json
└── README.md
```

## 常见问题（FAQ）
- 上传超过限制？设置 `MAX_UPLOAD_SIZE=1gb`，并在 Nginx 中匹配 `client_max_body_size`
- 首次登录账号？未配置 `ADMIN_PASSWORD` 时，查看 `server/first-run-admin.txt`
- 下载链接不正确？设置 `BASE_URL=https://你的域名`，并确保反向代理传递 `X-Forwarded-*` 头
- Windows 脚本？用 `manage.bat <命令>`，需要 Git Bash 或 WSL

## 许可证
MIT
# Node.js 多项目自动更新服务器

[![node-lts](https://img.shields.io/node/v-lts/express.svg?style=flat-square)](https://nodejs.org/en/about/releases/)
[![GitHub last commit](https://img.shields.io/github/last-commit/laozig/Update.svg?style=flat-square)](https://github.com/laozig/Update/commits/main)

中文

一个基于 Node.js 和 Express.js 的简单、通用、支持多项目的应用程序自动更新服务器，配备图形化Web控制面板，用于管理项目、版本、上传更新文件及监控服务。

## 1. 仓库与代码管理

*   **仓库地址**: `https://github.com/laozig/Update.git`
*   **克隆仓库**: 
    ```bash
    git clone https://github.com/laozig/Update.git
    ```
*   **进入项目目录**:
    ```bash
    cd Update
    ```
*   **拉取最新更新**:
    ```bash
    git pull origin main
    ```

## 2. 功能特性

*   **多用户支持**: 支持用户注册和登录，每个用户只能管理自己创建的项目。
*   **权限控制**: 管理员可以查看和管理所有项目，普通用户只能管理自己的项目。
*   **多项目支持**: 通过项目ID和API密钥隔离管理多个不同的应用程序更新。
*   **版本控制**: 轻松上传和管理应用程序的不同版本，支持版本说明。
*   **Web 控制面板**: 图形化界面，用于：
    *   启动/停止核心API更新服务。
    *   实时查看服务状态和日志。
    *   管理项目（增删改查）。
    *   为指定项目上传新版本文件。
    *   查看和重置项目API密钥。
*   **API 驱动**: 清晰的API端点，供客户端应用程序检查更新、下载文件；以及供（受保护的）管理工具上传新版本。
*   **易于部署**: 可以作为独立的 Node.js 应用运行。推荐使用 PM2 进行生产环境管理以实现进程守护和日志管理。
*   **自定义配置**: 通过 `server/config.json` 配置端口与项目；对外地址优先使用环境变量 `BASE_URL`，未设置时由服务自动根据请求识别协议与主机名（已启用 `trust proxy`）。
*   **文件名编码处理**: 优化了文件名处理逻辑，以正确支持包括中文在内的非ASCII字符文件名。
*   **日志管理**: 控制面板服务会将操作日志记录到 `server.log`，并提供日志查看功能。主API服务日志输出到控制台。
*   **JWT认证**: 使用JWT令牌进行用户认证，提高安全性。
*   **密码安全存储**: 使用bcrypt对用户密码进行哈希存储，保障账户安全。

## 3. 最新功能更新

### 3.1. 多用户系统 (2024年6月)

*   **用户注册**: 新增用户注册功能，支持创建个人账户。
*   **用户登录**: 使用JWT令牌进行安全认证，密码采用bcrypt哈希存储。
*   **项目所有权**: 每个项目都有明确的所有者，确保数据隔离。
*   **权限控制**: 
    *   管理员可以查看和管理所有项目与用户
    *   普通用户只能查看和管理自己创建的项目
    *   项目操作（编辑、删除、上传版本）都需要所有者或管理员权限
*   **用户角色管理**:
    *   管理员可以设置或更改其他用户的角色
    *   系统确保至少保留一个管理员账户
*   **用户界面改进**:
    *   新增登录和注册页面
    *   显示当前登录用户信息和角色
    *   根据用户角色动态显示可用功能
    *   支持退出登录功能

### 3.2. API密钥管理优化

*   **自动生成**: 创建项目时自动生成安全的API密钥
*   **重置功能**: 支持一键重置项目的API密钥
*   **可视化管理**: 在项目设置中直观显示API密钥
*   **权限保护**: 只有项目所有者和管理员可以查看和重置API密钥
*   **安全传输**: API密钥通过HTTPS和JWT认证保护传输

## 4. 系统架构与组件

*   **核心API服务 (`server/index.js`)**: 处理客户端的版本检查 (`/api/version/:projectId`)、文件下载 (`/download/...`) 和（经认证的）版本上传 (`/api/upload/:projectId`) 请求。默认监听端口 `3000`。
*   **Web控制面板服务 (`server/server-ui.js`)**: 提供基于Web的管理界面。负责项目管理、版本上传（通过调用核心API或内部逻辑）、API服务启停控制、日志查看等。默认监听端口 `8080`。
*   **配置文件 (`server/config.json`)**: 存储系统级配置（如服务端口、用户账户）和所有项目的详细信息（ID, 名称, API密钥, 图标等）。
*   **项目数据存储 (`server/projects/`)**: 每个项目在此目录下拥有一个以其 `projectId` 命名的子目录，包含：
    *   `version.json`: 该项目的版本历史和元数据。
    *   `uploads/`: 该项目上传的实际更新文件。
*   **用户认证系统**: 使用JWT (JSON Web Token)进行用户身份验证，支持登录、注册和权限控制。
*   **前端界面**: 基于Bootstrap的响应式Web界面，包括登录页、注册页和主控制面板。

## 5. 用户和权限管理

### 5.1. 用户角色

*   **管理员 (admin)**: 
    *   可以查看和管理所有项目
    *   可以查看和管理所有用户
    *   可以更改用户角色
    *   可以访问所有API密钥
    *   可以控制服务器启停
*   **普通用户 (user)**:
    *   只能查看和管理自己创建的项目
    *   可以为自己的项目上传新版本
    *   可以管理自己项目的API密钥
    *   不能查看或管理其他用户的项目
    *   不能访问用户管理功能

### 5.2. 用户注册和登录

*   **注册流程**:
    1. 访问 `/register.html` 页面
    2. 填写用户名、邮箱和密码
    3. 系统验证信息并创建账户
    4. 新用户默认为普通用户角色
*   **登录流程**:
    1. 访问 `/login.html` 页面
    2. 输入用户名和密码
    3. 验证成功后获取JWT令牌
    4. 使用令牌访问受保护的资源

### 5.3. 项目权限控制

*   **创建项目**: 项目创建者自动成为项目所有者
*   **项目访问**: 只有项目所有者和管理员可以:
    *   查看项目详情
    *   编辑项目信息
    *   上传新版本
    *   查看和重置API密钥
    *   删除项目
*   **API密钥**: 用于客户端应用上传新版本，只有项目所有者和管理员可以查看和重置

## 6. 系统架构与组件

*   **核心API服务 (`server/index.js`)**: 处理客户端的版本检查 (`/api/version/:projectId`)、文件下载 (`/download/...`) 和（经认证的）版本上传 (`/api/upload/:projectId`) 请求。默认监听端口 `3000`。
*   **Web控制面板服务 (`server/server-ui.js`)**: 提供基于Web的管理界面。负责项目管理、版本上传（通过调用核心API或内部逻辑）、API服务启停控制、日志查看等。默认监听端口 `8080`。
*   **配置文件 (`server/config.json`)**: 存储系统级配置（如服务端口、用户账户）和所有项目的详细信息（ID, 名称, API密钥, 图标等）。
*   **项目数据存储 (`server/projects/`)**: 每个项目在此目录下拥有一个以其 `projectId` 命名的子目录，包含：
    *   `version.json`: 该项目的版本历史和元数据。
    *   `uploads/`: 该项目上传的实际更新文件。

## 7. 部署指南

### 7.1. 服务器环境准备
*   **操作系统**: 推荐使用 Linux (如 Ubuntu, CentOS, Debian)。
*   **Node.js**: 版本 14.x 或更高版本。
    ```bash
    # 检查Node.js版本
    node -v
    npm -v
    ```
    如果未安装，可以通过 `nvm` (Node Version Manager) 或系统包管理器安装。
*   **Git**: 用于克隆代码。

### 7.2. 部署步骤

1.  **克隆或更新代码**:
    ```bash
    # 如果首次部署
    git clone https://github.com/laozig/Update.git
    cd Update
    # 如果是更新现有部署
    # cd /path/to/your/Update_directory
    # git pull origin main
    ```

2.  **安装依赖**: 在项目根目录下执行：
    ```bash
    npm install
    ```
    或者，如果项目包含 `package-lock.json` 或 `yarn.lock` 并希望精确复现依赖，可使用 `npm ci` 或 `yarn install --frozen-lockfile`。

3.  **配置服务器 (`server/config.json`)**:
    *   如果 `server/config.json` 不存在，复制 `server/config.example.json` 为 `server/config.json`。
    *   **重要**: 打开并编辑 `server/config.json`：
        *   按需配置 `server.port` (API 服务端口) 和 `server.adminPort` (控制面板端口)。
        *   在 `projects` 数组中定义您的项目。每个项目应有唯一的 `id` 和安全的 `apiKey`。
        *   可选：设置环境变量 `BASE_URL`（如 `https://updates.example.com`）固定对外地址；未设置时，服务将根据请求自动识别协议与主机名。
        ```json
        // server/config.json 示例片段
        {
          "projects": [
            {
              "id": "myFirstApp",
              "name": "My First Application",
              "description": "An awesome application.",
              "apiKey": "generated-secure-api-key-for-myFirstApp",
              "icon": "icons/default.png"
            }
            // 可以添加更多项目...
          ],
          "server": {
            "port": 3000,
            "adminPort": 8080,
            "adminUsername": "admin",
            "adminPassword": "ChangeThisStrongPassword!"
          }
        }
        ```

4.  **目录权限** (如果需要):
    确保运行Node.js服务的用户对 `server/projects/` 目录有写权限，以便能自动创建项目子目录、`version.json` 和 `uploads` 文件夹。

### 7.3. 启动服务

您需要启动两个Node.js进程：API服务和控制面板服务。

*   **直接使用 Node (开发或简单测试)**: (需要打开两个终端)
    ```bash
    # 终端1: 启动 API 服务
    node server/index.js
    ```
    ```bash
    # 终端2: 启动控制面板服务
    node server/server-ui.js
    ```
*   **使用 `package.json` 脚本 (如果已定义)**:
    查看 `package.json` 中的 `scripts` 部分，可能有类似 `start:api` 和 `start:ui` 的命令。
    ```bash
    npm run start-api 
    npm run start-ui
    ```
*   **使用 PM2 (生产环境推荐)**:
    PM2 可以管理Node.js进程，提供日志管理、自动重启等功能。
    1.  全局安装 PM2 (如果尚未安装):
        ```bash
        npm install pm2 -g
        ```
    2.  使用PM2启动服务:
        ```bash
        pm2 start server/index.js --name update-api-server
        pm2 start server/server-ui.js --name update-control-panel
        ```
    3.  设置PM2开机自启 (按提示操作):
        ```bash
        pm2 startup
        ```
    4.  保存当前PM2进程列表:
        ```bash
        pm2 save
        ```
    5.  查看PM2管理的进程: `pm2 list`
    6.  查看日志: `pm2 logs update-api-server` 或 `pm2 logs update-control-panel`

### 7.4. 停止服务

*   **直接使用 Node**: 在对应的终端按 `Ctrl+C`。
*   **使用 PM2**:
    ```bash
    pm2 stop update-api-server
    pm2 stop update-control-panel
    # 或者 pm2 delete update-api-server update-control-panel 从PM2列表移除
    ```

### 7.5. 访问控制面板

*   在浏览器中打开: `http://<YOUR_SERVER_IP_OR_DOMAIN>:<adminPort>` (例如 `http://yourserver.com:8080`)。
*   使用您在 `server/config.json` 中设置的 `adminUsername` 和 `adminPassword` 登录。

### 7.6. Nginx 反向代理配置

在生产环境中，强烈建议使用 Nginx 作为反向代理服务器，这样可以提供 HTTPS 支持、更好的安全性以及隐藏内部服务端口。

#### 7.6.1. Nginx 安装

```bash
# Debian/Ubuntu 系统
sudo apt update
sudo apt install nginx

# CentOS/RHEL 系统
sudo yum install epel-release
sudo yum install nginx
```

#### 7.6.2. 创建 Nginx 配置

创建配置文件 `/etc/nginx/conf.d/update-server.conf` 或 `/etc/nginx/sites-available/update-server.conf`：

```nginx
# 定义上游服务器 - 内部API服务 (server/index.js)
upstream update_api {
    server 127.0.0.1:3000;
    keepalive 64;  # 保持连接数
}

# 定义上游服务器 - 内部控制面板 (server/server-ui.js)
upstream update_admin {
    server 127.0.0.1:8080;
    keepalive 64;  # 保持连接数
}

# 静态资源和上传文件的缓存设置
proxy_cache_path /var/cache/nginx/update_server levels=1:2 keys_zone=update_cache:10m max_size=1g inactive=60m;
proxy_temp_path /var/cache/nginx/update_temp;

# 基本 HTTP 服务器配置 - 重定向到 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;  # 替换为您的实际域名
    
    # 支持 ACME 验证 (Let's Encrypt)
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
    
    # 全站重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# 主 HTTPS 服务器配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;  # 替换为您的实际域名
    
    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;      # 替换为您的证书路径
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;    # 替换为您的私钥路径
    ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;  # 替换为您的链证书路径
    
    # SSL 配置优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # HSTS (可选，但推荐)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # 安全相关头部
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "same-origin" always;
    
    # 根路径 - 控制面板
    location / {
        proxy_pass http://update_admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering on;
        
        # 客户端超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API 路径 - 版本检查、更新等
    location /api/ {
        proxy_pass http://update_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 特定 API 路径的缓存设置
        location /api/version/ {
            proxy_cache update_cache;
            proxy_cache_valid 200 1m;  # 缓存有效期为1分钟
            proxy_pass http://update_api;
        }
        
        # 不缓存上传 API
        location /api/upload/ {
            proxy_pass http://update_api;
            proxy_request_buffering off;  # 关闭请求缓冲，适合大文件上传
            client_max_body_size 1000m;   # 允许的最大上传文件大小
            proxy_connect_timeout 300s;   # 上传超时设置
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }
    }
    
    # 下载路径 - 静态文件
    location /download/ {
        proxy_pass http://update_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 下载相关配置
        proxy_cache update_cache;
        proxy_cache_valid 200 1d;  # 缓存有效期为1天
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_lock on;
        expires 30d;  # 客户端缓存
        
        # 优化大文件下载
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # 下载限制和超时
        client_max_body_size 0;    # 无限制下载大小
        proxy_read_timeout 600s;   # 下载超时设置
    }
    
    # 静态资源 - 图标等
    location ~* \.(ico|jpg|jpeg|png|gif|svg|js|css|html)$ {
        proxy_pass http://update_admin;
        proxy_cache update_cache;
        proxy_cache_valid 200 1d;
        expires 7d;
    }
    
    # 错误页面
    error_page 404 /error.html;
    error_page 500 502 503 504 /error.html;
    location = /error.html {
        root /var/www/update-server/server/public;
        internal;
    }
    
    # 访问日志和错误日志
    access_log /var/log/nginx/update-access.log combined buffer=64k flush=5m;
    error_log /var/log/nginx/update-error.log warn;
}
```

#### 7.6.3. 部署步骤

1. **创建配置文件**:

```bash
# Debian/Ubuntu
sudo nano /etc/nginx/sites-available/update-server.conf
# 粘贴上述配置，替换 your-domain.com 为您的域名

# 启用配置
sudo ln -s /etc/nginx/sites-available/update-server.conf /etc/nginx/sites-enabled/
```

```bash
# CentOS/RHEL
sudo nano /etc/nginx/conf.d/update-server.conf
# 粘贴上述配置，替换 your-domain.com 为您的域名
```

2. **创建缓存目录**:

```bash
sudo mkdir -p /var/cache/nginx/update_server
sudo mkdir -p /var/cache/nginx/update_temp
sudo chown -R nginx:nginx /var/cache/nginx
```

3. **配置SSL证书** (使用Let's Encrypt):

```bash
sudo apt install certbot python3-certbot-nginx  # Debian/Ubuntu
# 或
sudo yum install certbot python3-certbot-nginx  # CentOS/RHEL

# 创建验证目录
sudo mkdir -p /var/www/letsencrypt
sudo chown nginx:nginx /var/www/letsencrypt

# 获取证书
sudo certbot certonly --webroot -w /var/www/letsencrypt -d your-domain.com
```

4. **验证并测试配置**:

```bash
sudo nginx -t
```

5. **重启Nginx**:

```bash
sudo systemctl restart nginx
```

#### 7.6.4. 配置说明

* **隐藏内部端口**: Nginx代理将隐藏内部服务的端口(3000和8080)，外部用户只需通过标准HTTP(80)和HTTPS(443)端口访问。

* **路径分发**:
  * `/` - 所有根路径请求会转发到控制面板服务(8080)
  * `/api/` - API请求转发到API服务(3000)
  * `/download/` - 下载请求转发到API服务(3000)

* **安全增强**:
  * 启用HTTPS加密通信
  * 配置现代TLS协议和加密套件
  * 添加安全相关HTTP头部
  * 实现HTTPS强制重定向

* **性能优化**:
  * 配置合适的缓存策略
  * 优化大文件上传和下载
  * 启用HTTP/2协议

#### 7.6.5. 注意事项

* **域名设置**: 确保使用配置的域名替换`your-domain.com`。
* **SSL证书**: 证书路径需要根据您的实际环境进行调整。
* **防火墙**: 确保防火墙允许80和443端口的入站流量。
* **系统配置**: 根据需要修改`client_max_body_size`，以适应您的最大上传文件大小。
* **用户权限**: 确保Nginx有权限访问缓存目录和日志目录。

## 8. 主要API端点



*   `GET /api/version/:projectId`:
    *   描述: 获取指定项目的最新版本信息。
    *   示例: `http://yourserver.com:3000/api/version/myFirstApp`
*   `GET /download/:projectId/latest`:
    *   描述: 下载指定项目的最新版本文件。
*   `GET /download/:projectId/:version`:
    *   描述: 下载指定项目的特定版本文件。
*   `POST /api/upload/:projectId`:
    *   描述: 上传新版本文件。 **需要 `x-api-key` 请求头** 包含对应项目的API密钥。
    *   请求体: `multipart/form-data`，包含 `file` (文件本身), `version` (版本号字符串), `releaseNotes` (可选的版本说明)。
*   `GET /api/projects`:
    *   描述: (供控制面板使用) 获取所有已配置项目的列表（不含API密钥）。

## 9. 详细文档

有关更深入的技术细节和高级配置，请参阅以下文档：

*   **[部署说明 (Deploy Instructions)](./deploy-instructions.md)**: 包含更详细的服务器部署步骤、防火墙配置、使用PM2的最佳实践以及反向代理（如Nginx）的配置建议。
*   **[多项目设计 (Multi-Project Design)](./multi-project-design.md)**: 深入解释服务器如何架构以支持和隔离管理多个项目的数据和更新流程。

## 10. 目录结构概览

```
Update/
├── server/
│   ├── index.js                # 主API更新服务器逻辑
│   ├── server-ui.js            # Web控制面板服务器逻辑
│   ├── config.json             # 系统配置文件 (重要!)
│   ├── config.example.json     # config.json 的示例模板
│   ├── projects/               # 多项目数据存储根目录
│   │   ├── [projectId]/        # 单个项目的目录 (例如 myFirstApp/)
│   │   │   ├── version.json    # 该项目的版本信息文件
│   │   │   └── uploads/        # 该项目上传的更新文件存放处
│   │   │       └── .gitkeep    # 确保空目录被git追踪
│   │   └── .gitkeep
│   ├── public/                 # 控制面板的前端静态文件 (HTML, CSS, JS, icons)
│   └── ...                     # 其他服务器端辅助文件
├── .gitignore                  # Git忽略文件配置
├── package.json
├── package-lock.json           # 或 yarn.lock
├── README.md                   # 本文档 (中文)
├── README.en.md                # 英文版README
├── deploy-instructions.md      # 详细部署指南 (中文)
├── deploy-instructions.en.md   # 详细部署指南 (英文)
├── multi-project-design.md     # 多项目架构设计文档 (中文)
└── multi-project-design.en.md  # 多项目架构设计文档 (英文)
```

## 11. 配置详解

### 11.1. `server/config.json`

这是核心配置文件，控制着服务器的行为和项目定义。

*   `projects` (Array): 项目列表。
    *   `id` (String): 项目的唯一标识符。用于API调用和目录名。
    *   `name` (String): 项目的可读名称，显示在控制面板。
    *   `description` (String, Optional): 项目描述。
    *   `apiKey` (String): 用于该项目上传API的认证密钥。**必须保密**。
    *   `icon` (String, Optional): 指向 `server/public/icons/` 目录下项目图标的路径。
*   `server` (Object): 服务器全局配置。
    *   对外地址：优先使用环境变量 `BASE_URL`；未设置则根据请求自动识别（已启用 `trust proxy`）。
    *   `port` (Number): API服务监听的端口。
    *   `adminPort` (Number): 控制面板服务监听的端口。
    *   `adminUsername` (String): 控制面板登录用户名。
    *   `adminPassword` (String): 控制面板登录密码。**请务必修改为强密码**。

### 11.2. `server/projects/[projectId]/version.json`

每个项目独立的版本历史文件，是一个JSON数组，每个对象代表一个版本。

```json
// 示例: server/projects/myFirstApp/version.json
[
  {
    "version": "1.0.1",
    "releaseDate": "2024-07-01T10:00:00.000Z", // ISO 8601 日期格式
    "downloadUrl": "http://yourserver.com:3000/download/myFirstApp/1.0.1",
    "releaseNotes": "修复了bug A，优化了性能B。",
    "fileName": "MyApplication_1.0.1.exe",
    "originalFileName": "MyApplication" // 不含版本号和扩展名的原始基础名
  },
  {
    "version": "1.0.0",
    // ... 其他字段 ...
  }
]
```
*   `version` (String): 版本号 (例如 "1.0.0", "2.3.4-beta")。
*   `releaseDate` (String): 版本发布日期 (ISO 8601格式)。
*   `downloadUrl` (String): 完整的可下载此版本文件的URL。
*   `releaseNotes` (String, Optional): 版本更新说明。
*   `fileName` (String): 此版本在服务器上存储的完整文件名 (包含版本号和扩展名)。
*   `originalFileName` (String): 上传时确定的、不含版本号和扩展名的原始基础文件名。

## 12. 日志与监控

*   **API服务 (`server/index.js`)**: 主要将日志输出到标准控制台 (stdout/stderr)。如果使用PM2管理，PM2会自动收集这些日志。
*   **控制面板服务 (`server/server-ui.js`)**: 
    *   在控制台输出日志。
    *   重要的操作日志（如项目创建、版本上传、服务启停）会记录到项目根目录下的 `server.log` 文件中。
    *   控制面板界面提供日志查看功能，显示 `server.log` 的内容。
*   **服务状态**: 控制面板会显示核心API服务的运行状态（通过尝试连接API端口检测）。

## 13. 安全建议

*   **强凭据**: 务必为控制面板管理员 (`server.adminPassword`) 设置强密码。
*   **API密钥**: 为每个项目生成并使用唯一的、难以猜测的API密钥。妥善保管，不要硬编码到客户端的公开发布版本中。
*   **HTTPS**: 在生产环境中，强烈建议使用HTTPS。可以通过Nginx等反向代理来实现SSL/TLS终止。
*   **防火墙**: 仅开放必要的端口（例如API服务端口、控制面板端口、SSH端口）。
*   **定期更新**: 保持Node.js、npm/yarn以及操作系统依赖项的更新。
*   **输入验证**: 服务器端代码已包含对输入参数的一些基本验证。
*   **备份**: 定期备份 `server/config.json` 和整个 `server/projects/` 目录。

## 14. 常见问题 (FAQ)

*   **Q: 控制面板无法访问？**
    *   A: 检查 `server/server-ui.js` 是否已启动。检查 `server/config.json` 中的 `adminPort` 是否正确。检查服务器防火墙是否允许该端口的入站连接。查看 `server-ui.js` 的控制台输出或PM2日志有无错误。
*   **Q: 上传文件失败？**
    *   A: 确认请求头中 `x-api-key` 是否正确提供了对应项目的API密钥。检查上传文件的大小是否超过 `multer` 的限制（默认为100MB，可在代码中调整）。查看服务器磁盘空间。查看API服务 (`server/index.js`) 的日志获取详细错误。
*   **Q: 客户端获取到的下载链接无效？**
    *   A: 生产环境建议设置 `BASE_URL`（如 `https://updates.example.com`）；如果未设置，请确认反向代理正确传递 `X-Forwarded-Proto/Host`，并且客户端可以从公网访问对应域名和端口。
*   **Q: 中文文件名显示乱码？**
    *   A: 最新版本已包含针对中文文件名的解码优化。如果仍有问题，请确保您使用的是最新代码，并检查客户端上传文件时是如何编码文件名的。清除旧的乱码文件和版本条目后重试。

## 15. 贡献

欢迎通过提交 Pull Requests 或 Issues 来帮助改进此项目！

## 16. 许可证

[MIT](LICENSE)

## 17. 代码仓库管理

### 17.1. Git版本控制

本项目使用Git进行版本控制。以下文件和目录被配置为不会提交到Git仓库中：

#### 17.1.1. 配置和敏感信息
- **`server/config.json`**: 包含服务器配置、API密钥和用户信息，属于敏感信息
- **`.env` 和 `.env.*`文件**: 环境变量配置，可能包含密钥和密码
- **证书文件**: 如`.pem`, `.key`, `.cert`, `.crt`等SSL/TLS证书文件

#### 17.1.2. 项目数据
- **`server/projects/*/uploads/*`**: 各项目上传的应用程序文件，这些通常体积较大且应由服务器动态管理
- **`server/projects/*/version.json`**: 项目版本记录，应由运行中的服务器维护而非版本控制
- **应用程序文件**: 如`.exe`, `.zip`, `.dmg`, `.pkg`, `.msi`, `.deb`, `.rpm`, `.appimage`等

#### 17.1.3. 依赖和生成文件
- **`node_modules/`**: npm依赖目录，应通过`npm install`重新生成
- **`package-lock.json`**: npm依赖锁定文件，可能因环境差异导致冲突
- **构建输出**: 如`dist/`, `build/`, `out/`等编译生成的目录

#### 17.1.4. 日志和临时文件
- **`logs/`和`*.log`文件**: 服务器运行日志，包括`server.log`
- **临时文件**: 如`.temp/`, `.tmp/`, `*.tmp`等临时生成的文件
- **缓存文件**: 如`.cache/`等缓存目录

#### 17.1.5. 开发环境文件
- **IDE配置**: 如`.idea/`, `.vscode/`等编辑器特定配置
- **系统文件**: 如`.DS_Store`, `Thumbs.db`等操作系统生成的文件

### 17.2. 目录结构保留

为了确保项目结构完整，以下空目录会通过`.gitkeep`文件保留在仓库中：

- **`server/projects/*/uploads/`**: 通过`!server/projects/*/uploads/.gitkeep`保留
- **其他空目录**: 通过`!.gitkeep`保留

### 17.3. 首次部署注意事项

首次部署时，需要手动创建以下文件：

1. **`server/config.json`**: 从`server/config.example.json`复制并修改
2. **项目目录结构**: 服务器会自动创建`server/projects/[项目ID]/uploads/`目录

### 17.4. 更新部署流程

更新现有部署时，请注意以下事项：

1. **备份配置**: 更新前备份`server/config.json`
2. **拉取更新**: 使用`git pull origin main`获取最新代码
3. **还原配置**: 如果配置文件被覆盖，还原备份的配置
4. **更新依赖**: 运行`npm install`更新依赖
5. **重启服务**: 重启API服务和控制面板服务 