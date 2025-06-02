# 多项目EXE程序自动更新系统

## 系统说明
这是一个支持多项目的EXE程序自动更新后端系统，支持多项目管理、版本控制和自动更新功能。

## 快速开始

### 1. 部署步骤
1. 将整个项目上传到服务器的 `/opt/Update` 目录：
```bash
scp -r ./* root@your-server:/opt/Update/
```

2. 添加脚本执行权限：
```bash
chmod +x /opt/Update/start.sh /opt/Update/stop.sh
```

3. 启动服务：
```bash
cd /opt/Update
sudo ./start.sh
```

4. 停止服务：
```bash
cd /opt/Update
sudo ./stop.sh
```

### 2. 访问控制面板
- 地址：http://your-server/
- 默认管理员账号：admin
- 默认管理员密码：admin

## 功能特性

### 多项目管理
- 支持多个项目独立管理
- 每个项目有独立的版本控制
- 支持项目级别的API密钥认证

### 版本管理
- 支持版本上传和管理
- 自动版本号比对
- 支持版本更新说明

### 实时监控
- 服务器状态自动检测（每5秒）
- 日志自动更新（每3秒）
- 自动日志清理（每天凌晨，保留最新1000行）

### 安全特性
- 基于API密钥的认证
- 管理面板密码保护
- 下载链接动态生成

## 目录结构
```
/opt/Update/
├── server/           # 服务器端代码
│   ├── index.js     # 更新服务器主程序
│   ├── server-ui.js # 控制面板服务
│   └── public/      # 前端文件
├── projects/         # 项目文件存储
├── start.sh         # 一键启动脚本
└── stop.sh          # 一键停止脚本
```

## API 接口

### 1. 获取版本信息
- URL: `/api/version/:projectId`
- 方法: GET
- 描述: 获取指定项目的最新版本信息

### 2. 下载最新版本
- URL: `/download/:projectId/latest`
- 方法: GET
- 描述: 下载指定项目的最新版本

### 3. 下载指定版本
- URL: `/download/:projectId/:version`
- 方法: GET
- 描述: 下载指定项目的特定版本

## 注意事项
1. 确保服务器已安装：
   - Node.js (v14+)
   - Nginx
   - npm

2. 端口使用：
   - 80: Nginx反向代理
   - 8080: 控制面板
   - 3000: 更新服务

3. 日志管理：
   - 日志文件：/opt/Update/server.log
   - 自动清理：每天凌晨执行
   - 保留行数：最新1000行

## 常见问题
1. 如果服务无法启动，检查：
   - 端口是否被占用
   - Node.js是否正确安装
   - 项目依赖是否完整

2. 如果无法访问控制面板，检查：
   - Nginx是否正常运行
   - 防火墙是否放行80端口
   - 服务器安全组设置

3. 如果上传版本失败，检查：
   - 文件大小是否超过限制（默认100MB）
   - 服务器磁盘空间是否充足
   - 项目目录权限是否正确

4. 如果日志不更新，检查：
   - 服务是否正常运行
   - 日志文件权限是否正确
   - 磁盘空间是否充足

# 更新服务器

这是一个为EXE程序设计的后端系统，用于自动检查更新和下载新版本。

## 功能特性

-   **版本检查**: 客户端可以查询最新版本信息。
-   **版本上传**: 通过控制面板上传新版本的EXE文件和版本信息。
-   **版本下载**: 客户端可以下载最新版本或指定版本的EXE文件。
-   **Web控制面板**: 图形化界面，用于启动/停止更新服务器、查看日志、上传和管理版本。

## 目录结构

```
Update/
├── server/
│   ├── index.js            # 主更新服务器逻辑
│   ├── server-ui.js        # Web控制面板服务器逻辑
│   ├── version.json        # 存储版本信息
│   ├── uploads/            # 存储上传的EXE文件
│   │   └── .gitkeep        # 保持uploads目录在git中
│   └── public/
│       └── index.html      # 控制面板前端页面 (由server-ui.js动态生成)
├── start-update-server.sh  # Linux启动脚本
├── stop-update-server.sh   # Linux停止脚本
├── update-server.service   # systemd服务配置文件
├── .gitignore              # Git忽略配置
├── package.json            # 项目依赖和脚本
├── package-lock.json       # 依赖版本锁定
└── README.md               # 本文档
```

## 快速开始

1.  **克隆仓库**:
    ```bash
    git clone https://github.com/laozig/Update.git
    cd Update
    ```

2.  **安装依赖**:
    ```bash
    npm install
    ```

3.  **启动控制面板**:
    ```bash
    npm run ui
    ```
    控制面板将在 `http://localhost:8080` 运行。首次访问需要输入用户名和密码，默认为 `admin` / `admin` (请在 `server/server-ui.js` 中修改)。

4.  **通过控制面板启动更新服务器**:
    -   打开 `http://localhost:8080`。
    -   输入认证凭据。
    -   点击 "启动服务器" 按钮。
    -   更新服务器将在 `http://localhost:3000` (默认) 运行。

5.  **上传新版本**:
    -   在控制面板中，切换到 "上传新版本" 标签页。
    -   填写版本号、版本说明，并选择EXE文件。
    -   点击 "上传版本"。

## API 参考

基础 URL: `http://103.97.179.230:3000` (请根据你的服务器IP或域名修改)

### 1. 获取最新版本信息

-   **URL**: `/api/version`
-   **方法**: `GET`
-   **描述**: 获取当前最新的版本信息。
-   **成功响应 (200 OK)**:
    ```json
    {
      "version": "1.0.1",
      "releaseDate": "2024-07-27T12:00:00.000Z",
      "downloadUrl": "/download/1.0.1",
      "releaseNotes": "修复了一些bug，增加了新功能。",
      "fileName": "app-1.0.1.exe"
    }
    ```
-   **失败响应 (404 Not Found)**:
    ```json
    {
      "error": "暂无版本信息"
    }
    ```

### 2. 下载最新版本

-   **URL**: `/download/latest`
-   **方法**: `GET`
-   **描述**: 下载最新版本的EXE文件。
-   **成功响应**: 直接下载文件。
-   **失败响应 (404 Not Found)**:
    ```json
    {
      "error": "暂无版本可供下载"
    }
    // 或
    {
      "error": "文件 app-1.0.1.exe 不存在"
    }
    ```

### 3. 下载指定版本

-   **URL**: `/download/:version` (例如: `/download/1.0.0`)
-   **方法**: `GET`
-   **描述**: 下载指定版本的EXE文件。
-   **成功响应**: 直接下载文件。
-   **失败响应 (404 Not Found)**:
    ```json
    {
      "error": "版本 1.0.0 不存在"
    }
    // 或
    {
      "error": "文件 app-1.0.0.exe 不存在"
    }
    ```

### 4. 上传新版本 (内部API，通过控制面板使用)

此API主要由Web控制面板使用，并受API密钥保护（如果已配置）。

-   **URL**: `/api/upload`
-   **方法**: `POST`
-   **Headers**:
    -   `x-api-key`: `your-secret-api-key` (在 `server/index.js` 中配置的API密钥)
-   **Body (form-data)**:
    -   `version` (string, required): 版本号 (例如: "1.0.1")
    -   `releaseNotes` (string, optional): 版本说明
    -   `file` (file, required): EXE应用程序文件
-   **成功响应 (200 OK)**:
    ```json
    {
      "message": "版本更新成功",
      "version": {
        "version": "1.0.1",
        "releaseDate": "2024-07-27T12:00:00.000Z",
        "downloadUrl": "/download/1.0.1",
        "releaseNotes": "新版本说明",
        "fileName": "app-1.0.1.exe"
      }
    }
    ```
-   **失败响应**:
    -   `400 Bad Request`: 缺少版本号、文件，或版本已存在。
    -   `401 Unauthorized`: API密钥无效或未提供。
    -   `500 Internal Server Error`: 服务器内部错误。

## 控制面板 (`server-ui.js`)

控制面板运行在 `http://localhost:8080` (默认)。

### 功能:

-   **服务器控制**: 启动和停止主更新服务器 (`server/index.js`)。
-   **日志查看**: 显示主更新服务器的实时日志。
-   **版本上传**: 上传新的EXE文件，并指定版本号和版本说明。
-   **版本管理**: 查看已上传的版本列表。

### 安全:

-   **基本认证**: 控制面板受基本HTTP认证保护。
    -   默认用户名: `admin`
    -   默认密码: `admin`
    -   **重要**: 请在 `server/server-ui.js` 文件中修改 `users` 对象以更改凭据，例如：
        ```javascript
        // server/server-ui.js
        // ...
        app.use(basicAuth({
          users: { 'your_username': 'your_strong_password' }, // 修改这里
          challenge: true,
          realm: 'UpdateServerAdminPanel',
        }));
        // ...
        ```

## 主更新服务器 (`server/index.js`)

主更新服务器运行在 `http://localhost:3000` (默认)。

### 安全:

-   **API密钥认证**: `/api/upload` 端点可以通过API密钥进行保护。
    -   在 `server/index.js` 文件顶部配置 `API_KEY`。
        ```javascript
        // server/index.js
        const API_KEY = 'your-super-secret-and-long-api-key'; // 修改或设置为空字符串以禁用
        ```
    -   如果 `API_KEY` 为空字符串或 `null`，则 `/api/upload` 端点将不进行API密钥检查（不推荐用于生产环境）。
    -   客户端（如控制面板或其他上传工具）在请求时需要在Header中包含 `x-api-key`。
-   **CORS**: 跨域资源共享已配置为允许来自控制面板 (`http://localhost:8080`) 和服务器自身 (`http://localhost:3000`) 以及生产环境IP (`http://103.97.179.230`) 的请求。如有需要，可在 `server/index.js` 中修改 `cors` 配置。
-   **文件大小限制**: 上传文件默认限制为100MB，可在 `server/index.js` 和 `server/server-ui.js` 中的 `multer` 配置中调整。

## 部署到生产环境

### Windows服务器部署

1. **服务器准备**
   - 确保服务器上已安装 Node.js 和 npm。
   - 将项目文件上传到服务器。

2. **配置**
   - **修改IP/域名**: 在 `README.md` (API示例) 和 `server/index.js` (CORS配置) 中，将 `103.97.179.230` 替换为你的服务器实际IP地址或域名。
   - **修改端口**: 如果需要，可以在 `server/index.js` (主服务器) 和 `server/server-ui.js` (控制面板) 中修改端口号。
   - **安全凭据**:
     - **控制面板认证**: 修改 `server/server-ui.js` 中的基本认证用户名和密码。
     - **API密钥**: 在 `server/index.js` 中设置一个强 `API_KEY`。

3. **运行应用**
   推荐使用进程管理器如 `pm2` 来保持应用在后台运行并自动重启。

   - **安装 pm2** (如果未安装):
     ```bash
     npm install pm2 -g
     ```
   - **启动主更新服务器**:
     ```bash
     pm2 start server/index.js --name update-server
     ```
   - **启动控制面板服务器**:
     ```bash
     pm2 start server/server-ui.js --name update-server-ui
     ```
   - **查看应用状态**:
     ```bash
     pm2 list
     ```
   - **查看日志**:
     ```bash
     pm2 logs update-server
     pm2 logs update-server-ui
     ```
   - **保存pm2进程列表** (以便服务器重启后自动恢复):
     ```bash
     pm2 save
     pm2 startup # (根据提示执行相应的命令)
     ```

4. **防火墙配置**
   确保服务器防火墙允许外部访问你配置的端口 (例如: 3000 和 8080)。

   - **Windows 防火墙**:
     - 打开 "高级安全 Windows Defender 防火墙"。
     - 创建新的入站规则，允许 TCP 端口 3000 和 8080 (或你选择的端口)。

### Ubuntu服务器部署

本项目提供了三种在Ubuntu服务器上部署的方式：

#### 方式一：使用脚本启动（推荐用于测试）

1. **准备工作**
   ```bash
   # 创建版本文件
   echo "[]" > server/version.json
   
   # 设置脚本权限
   chmod 755 start-update-server.sh stop-update-server.sh
   ```

2. **启动和停止服务**
   ```bash
   # 启动服务器
   ./start-update-server.sh
   
   # 停止服务器
   ./stop-update-server.sh
   ```

#### 方式二：使用systemd服务（推荐用于生产环境）

1. **编辑服务配置**
   ```bash
   # 编辑服务配置文件，修改实际部署路径
   sudo nano update-server.service
   # 将WorkingDirectory和User修改为实际值
   ```

2. **安装和启动服务**
   ```bash
   # 复制服务文件到systemd目录
   sudo cp update-server.service /etc/systemd/system/
   
   # 重新加载systemd配置
   sudo systemctl daemon-reload
   
   # 启用服务（开机自启）
   sudo systemctl enable update-server
   
   # 启动服务
   sudo systemctl start update-server
   
   # 检查服务状态
   sudo systemctl status update-server
   ```

#### 方式三：使用PM2进程管理器（适合Node.js应用）

1. **安装PM2**
   ```bash
   sudo npm install -g pm2
   ```

2. **启动和管理应用**
   ```bash
   # 启动应用
   pm2 start server/server-ui.js --name "update-server"
   
   # 设置开机自启
   pm2 startup
   pm2 save
   
   # 查看应用状态
   pm2 status
   
   # 查看日志
   pm2 logs update-server
   ```

3. **防火墙配置**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 8080/tcp
   sudo ufw enable
   sudo ufw status
   ```

更多详细的部署说明，请参考 `deploy-instructions.md` 文件。

## 常见问题 (FAQ)

-   **Q: 如何修改控制面板的登录凭据?**
    A: 编辑 `server/server-ui.js` 文件，找到 `app.use(basicAuth(...))` 部分，修改 `users` 对象中的用户名和密码。

-   **Q: 如何修改API密钥?**
    A: 编辑 `server/index.js` 文件，修改顶部的 `API_KEY` 常量的值。如果设置为空字符串，则禁用API密钥检查。

-   **Q: 上传文件大小有限制吗?**
    A: 是的，默认为100MB。可以在 `server/index.js` 和 `server/server-ui.js` 中的 `multer` 配置里修改 `fileSize`限制。

-   **Q: 控制面板和主服务器必须在同一台机器上运行吗?**
    A: 不是必须的，但当前实现是这样设计的。如果分开部署，需要适当配置CORS策略和API调用地址。

-   **Q: 如果服务器重启，上传的文件和版本信息会丢失吗?**
    A: 上传的EXE文件存储在 `server/uploads/` 目录中，版本信息存储在 `server/version.json` 文件中。只要这些文件没有被删除，重启服务器后数据依然存在。

-   **Q: 如何备份版本数据?**
    A: 定期备份 `server/uploads/` 目录和 `server/version.json` 文件。

-   **Q: 如何在Ubuntu服务器上后台运行更新服务器?**
    A: 可以使用提供的 `start-update-server.sh` 脚本，或者使用systemd服务，或者使用PM2进程管理器。详情参见部署说明。

---

*最后更新: 2024-06-02* 