# 应用程序自动更新系统

这个系统提供了一个简单的方式来为您的应用程序添加自动更新功能。系统主要由更新服务器组成，提供API接口供客户端检查和下载更新。

## 目录

- [系统概述](#系统概述)
- [快速开始](#快速开始)
- [服务器设置](#服务器设置)
  - [前提条件](#前提条件)
  - [安装步骤](#安装步骤)
  - [图形化控制面板](#图形化控制面板)
  - [部署到生产环境](#部署到生产环境)
  - [防火墙设置](#防火墙设置)
  - [安全性配置](#安全性配置)
- [API详细参考](#api详细参考)
- [客户端实现指南](#客户端实现指南)
- [常见问题](#常见问题)
- [注意事项](#注意事项)

## 系统概述

更新服务器系统由以下组件组成：

1. **更新服务器**：处理版本检查和文件下载请求
2. **控制面板**：图形化界面，用于管理更新服务器
3. **API接口**：供客户端应用程序调用的接口
4. **文件存储**：存储不同版本的应用程序文件

系统工作流程：

1. 开发者上传新版本的应用程序到服务器
2. 客户端应用程序定期检查服务器上的版本信息
3. 如果有新版本，客户端下载并安装更新

## 快速开始

1. **安装依赖**：
   ```
   cd server
   npm install
   ```

2. **启动控制面板**：
   ```
   npm run ui
   ```
   或双击 `run.bat` 文件

3. **在控制面板中启动服务器**

4. **上传应用程序**：
   在控制面板中切换到"上传新版本"标签

## 服务器设置

### 前提条件

- Node.js 14+ 和 npm
- Windows、Linux 或 macOS 操作系统
- 开放的网络端口（默认：3000和8080）

### 安装步骤

1. **下载代码**：
   ```
   git clone https://github.com/laozig/Update.git
   ```
   或解压下载的压缩包

2. **安装依赖**：
   ```
   cd server
   npm install
   ```

3. **启动控制面板**：
   ```
   npm run ui
   ```
   或双击 `run.bat` 文件（Windows系统）

4. **启动服务器**：
   在控制面板中点击"启动服务器"按钮

### 图形化控制面板

系统提供了一个图形化控制面板，方便您启动和管理更新服务器：

1. **启动控制面板**：
   ```
   npm run ui
   ```
   或双击 `run.bat` 文件

2. **控制面板功能**：
   - **服务器控制**：启动/停止更新服务器，查看服务器日志
   - **上传新版本**：上传新版本的应用程序文件
   - **版本管理**：查看已发布的所有版本

3. **控制面板地址**：`http://localhost:8080`

### 部署到生产环境

#### 1. 服务器准备

1. **安装Node.js**：
   - 访问 [Node.js官网](https://nodejs.org/) 下载并安装Node.js 14+
   - 验证安装：`node -v` 和 `npm -v`

2. **部署代码**：
   - 将整个`server`目录上传到服务器
   - 或使用Git克隆仓库：`git clone https://github.com/laozig/Update.git`

3. **安装依赖**：
   ```
   cd server
   npm install --production
   ```

#### 2. 配置为系统服务

##### 使用PM2（推荐）

1. **安装PM2**：
   ```
   npm install -g pm2
   ```

2. **启动更新服务器**：
   ```
   pm2 start index.js --name "update-server"
   ```

3. **启动控制面板**（可选）：
   ```
   pm2 start server-ui.js --name "update-panel"
   ```

4. **设置开机自启**：
   ```
   pm2 startup
   pm2 save
   ```

#### 3. 配置反向代理

##### Nginx配置

1. **安装Nginx**：
   ```
   sudo apt install nginx   # Debian/Ubuntu
   sudo yum install nginx   # CentOS/RHEL
   ```

2. **创建配置文件**：
   ```
   sudo nano /etc/nginx/sites-available/update-server
   ```

3. **添加以下配置**：
   ```
   server {
       listen 80;
       server_name 103.97.179.230;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **启用站点**：
   ```
   sudo ln -s /etc/nginx/sites-available/update-server /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 防火墙设置

#### Windows防火墙

1. **打开Windows防火墙设置**：
   - 控制面板 > 系统和安全 > Windows防火墙

2. **添加入站规则**：
   - 点击"高级设置" > "入站规则" > "新建规则"
   - 选择"端口" > "TCP" > 输入"3000,8080" > "允许连接" > 完成

#### Linux防火墙（UFW）

1. **安装UFW**（如果尚未安装）：
   ```
   sudo apt install ufw
   ```

2. **配置规则**：
   ```
   sudo ufw allow 22/tcp         # SSH（如果需要）
   sudo ufw allow 80/tcp         # HTTP
   sudo ufw allow 443/tcp        # HTTPS
   sudo ufw allow 3000/tcp       # 更新服务器
   sudo ufw allow 8080/tcp       # 控制面板（如果需要外部访问）
   ```

3. **启用防火墙**：
   ```
   sudo ufw enable
   ```

### 安全性配置

#### 1. 添加基本认证

##### 控制面板认证

1. **修改server-ui.js**，添加基本认证：
   ```javascript
   // 在文件顶部添加
   const basicAuth = require('express-basic-auth');
   
   // 在中间件部分添加
   app.use(basicAuth({
     users: { 'admin': 'your-password' },
     challenge: true,
     realm: 'Update Server Admin Panel',
   }));
   ```

2. **安装依赖**：
   ```
   npm install express-basic-auth --save
   ```

##### API认证

1. **修改index.js**，添加API密钥认证：
   ```javascript
   // 添加API密钥中间件
   const API_KEY = 'your-secret-api-key';
   
   const apiKeyAuth = (req, res, next) => {
     const apiKey = req.headers['x-api-key'];
     if (apiKey && apiKey === API_KEY) {
       next();
     } else {
       res.status(401).json({ error: '未授权访问' });
     }
   };
   
   // 在需要保护的路由上应用
   app.post('/api/upload', apiKeyAuth, upload.single('file'), (req, res) => {
     // 原有代码
   });
   ```

## API详细参考

### 1. 获取最新版本信息

获取服务器上当前最新版本的应用程序信息。

**请求**:
```
GET /api/version
```

**请求头**:
- `Content-Type`: application/json
- `x-api-key`: your-api-key（如果启用了认证）

**参数**: 无

**响应**:
- 状态码: 200 OK
- 内容类型: application/json

**响应体**:
```json
{
  "version": "1.0.1",              // 版本号
  "releaseDate": "2023-06-01T12:00:00.000Z",  // 发布日期
  "downloadUrl": "/download/1.0.1",  // 下载地址
  "releaseNotes": "修复了一些bug"     // 版本说明
}
```

**示例**:
```
curl -X GET http://103.97.179.230:3000/api/version
```

### 2. 上传新版本

上传新版本的应用程序到服务器。

**请求**:
```
POST /api/upload
```

**请求头**:
- `Content-Type`: multipart/form-data
- `x-api-key`: your-api-key（如果启用了认证）

**参数**:
- `file`: (必填) 应用程序文件，二进制文件
- `version`: (必填) 版本号，字符串，例如 "1.0.1"
- `releaseNotes`: (可选) 版本说明，字符串

**响应**:
- 状态码: 200 OK
- 内容类型: application/json

**响应体**:
```json
{
  "message": "版本更新成功",
  "version": {
    "version": "1.0.1",
    "releaseDate": "2023-06-01T12:00:00.000Z",
    "downloadUrl": "/download/1.0.1",
    "releaseNotes": "修复了一些bug"
  }
}
```

**示例**:
```
curl -X POST http://103.97.179.230:3000/api/upload \
  -F "file=@path/to/your/app.exe" \
  -F "version=1.0.1" \
  -F "releaseNotes=修复了一些bug"
```

### 3. 下载最新版本

下载服务器上当前最新版本的应用程序。

**请求**:
```
GET /download/latest
```

**响应**:
- 状态码: 200 OK
- 内容类型: application/octet-stream
- 内容: 二进制文件数据

**示例**:
```
curl -X GET http://103.97.179.230:3000/download/latest -o latest.exe
```

### 4. 下载指定版本

下载服务器上指定版本的应用程序。

**请求**:
```
GET /download/{version}
```

**路径参数**:
- `version`: 要下载的版本号，例如 "1.0.1"

**响应**:
- 状态码: 200 OK
- 内容类型: application/octet-stream
- 内容: 二进制文件数据

**示例**:
```
curl -X GET http://103.97.179.230:3000/download/1.0.1 -o app-1.0.1.exe
```

## 客户端实现指南

### 基本流程

客户端应用程序需要实现以下功能来支持自动更新：

1. **检查更新**：
   - 调用 `/api/version` 获取最新版本信息
   - 比较最新版本与当前版本
   - 如果有新版本，提示用户更新

2. **下载更新**：
   - 调用 `/download/latest` 或 `/download/{version}` 下载新版本
   - 保存下载的文件到临时目录

3. **安装更新**：
   - 运行下载的更新文件
   - 退出当前应用程序

### 版本比较逻辑

系统使用标准的语义化版本比较逻辑，例如：

- 1.0.1 > 1.0.0
- 1.1.0 > 1.0.9
- 2.0.0 > 1.9.9

客户端应实现类似的版本比较逻辑，以正确判断是否需要更新。

### 文件命名约定

上传到服务器的文件将被重命名为以下格式：
```
app-{version}.exe
```

例如：
- app-1.0.0.exe
- app-1.0.1.exe
- app-2.0.0.exe

## 常见问题

### 1. 服务器无法启动

**可能原因**：
- 端口被占用
- Node.js未正确安装
- 依赖包未安装

**解决方法**：
- 检查端口是否被其他程序占用：`netstat -ano | findstr 3000`
- 验证Node.js安装：`node -v`
- 重新安装依赖：`npm install`

### 2. 上传文件失败

**可能原因**：
- 文件大小超过限制
- uploads目录权限不足
- 服务器磁盘空间不足

**解决方法**：
- 检查文件大小限制设置
- 确保uploads目录有写入权限
- 检查服务器磁盘空间

### 3. 客户端无法连接服务器

**可能原因**：
- 服务器未启动
- 防火墙阻止连接
- 网络问题

**解决方法**：
- 确认服务器状态
- 检查防火墙设置
- 验证网络连接

## 注意事项

- 确保您的服务器具有足够的存储空间来存储所有版本的应用程序
- 考虑实现用户认证以保护上传API
- 在生产环境中使用HTTPS以确保安全下载
- 考虑添加数字签名验证以确保更新的真实性
- 服务器重启后会自动加载最后保存的版本信息
- 定期备份版本信息文件和上传的应用程序文件
- 考虑实现版本回滚功能，以应对紧急情况 