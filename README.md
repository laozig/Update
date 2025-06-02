# 多项目EXE程序自动更新系统

## 仓库信息
- **仓库地址**: https://github.com/laozig/Update.git
- **克隆仓库**: `git clone https://github.com/laozig/Update.git`
- **拉取更新**: `git pull origin main`

## 快速部署
```bash
# 克隆仓库
git clone https://github.com/laozig/Update.git

# 进入目录
cd Update

# 设置脚本权限
chmod +x start.sh stop.sh

# 启动服务
./start.sh
```

## 系统说明
这是一个支持多项目的EXE程序自动更新后端系统，支持多项目管理、版本控制和自动更新功能。系统采用Node.js开发，通过Nginx反向代理提供服务，支持多个项目的独立版本管理和更新。

## 系统架构

### 核心组件
- **更新服务器** (server/index.js): 处理版本检查和文件下载请求
- **控制面板** (server/server-ui.js): 提供Web界面管理项目和版本
- **Nginx反向代理**: 统一端口访问，提供HTTP服务
- **项目配置** (server/config.json): 存储系统和项目配置
- **版本管理** (server/projects/*/version.json): 各项目版本信息

### 数据流
1. 客户端请求版本信息 → 更新服务器 → 返回最新版本信息
2. 客户端请求下载 → 更新服务器 → 提供对应版本文件
3. 管理员上传新版本 → 控制面板 → 更新版本信息和文件

## 快速开始

### 1. 服务器环境准备
确保服务器已安装：
- Node.js (v14+)
- Nginx
- npm

### 2. 部署步骤
1. 将整个项目上传到服务器：
```bash
scp -r ./* root@your-server:/opt/Update/
```

2. 设置脚本权限：
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

### 3. 访问控制面板
- 地址：http://your-server/
- 默认管理员账号：admin
- 默认管理员密码：admin

## 功能特性

### 多项目管理
- 支持多个项目独立管理
- 每个项目有独立的版本控制
- 支持项目级别的API密钥认证
- 支持项目添加、编辑和删除
- 项目数据完全隔离

### 版本管理
- 支持版本上传和管理
- 自动版本号比对和排序
- 支持版本更新说明
- 支持查看历史版本
- 支持下载特定版本

### 实时监控
- 服务器状态自动检测（每5秒）
- 日志自动更新（每3秒）
- 自动日志清理（每天凌晨，保留最新1000行）
- 服务器启动/停止状态显示

### 安全特性
- 基于API密钥的认证
- 管理面板密码保护
- 下载链接动态生成
- 项目隔离访问控制

## 目录结构
```
/opt/Update/
├── server/                # 服务器端代码
│   ├── index.js           # 更新服务器主程序
│   ├── server-ui.js       # 控制面板服务
│   ├── config.json        # 系统配置文件
│   ├── projects/          # 项目数据目录
│   │   ├── project1/      # 项目1数据
│   │   │   ├── version.json  # 项目1版本信息
│   │   │   └── uploads/      # 项目1上传文件
│   │   └── project2/      # 项目2数据
│   │       ├── version.json  # 项目2版本信息
│   │       └── uploads/      # 项目2上传文件
│   └── public/            # 前端文件
│       └── index.html     # 控制面板页面
├── start.sh               # 一键启动脚本
└── stop.sh                # 一键停止脚本
```

## 配置详解

### config.json
```json
{
  "projects": [
    {
      "id": "project1",
      "name": "项目一",
      "description": "项目一描述",
      "apiKey": "api-key-project1-123456",
      "icon": "icons/default.png"
    },
    {
      "id": "project2",
      "name": "项目二",
      "description": "项目二描述",
      "apiKey": "api-key-project2-123456",
      "icon": "icons/default.png"
    }
  ],
  "server": {
    "port": 3000,
    "adminPort": 8080,
    "adminUsername": "admin",
    "adminPassword": "admin"
  }
}
```

### version.json
```json
[
  {
    "version": "1.0.1",
    "releaseDate": "2024-06-02T10:00:00.000Z",
    "downloadUrl": "/download/project1/1.0.1",
    "releaseNotes": "修复了一些bug",
    "fileName": "app-1.0.1.exe"
  },
  {
    "version": "1.0.0",
    "releaseDate": "2024-06-01T10:00:00.000Z",
    "downloadUrl": "/download/project1/1.0.0",
    "releaseNotes": "初始版本",
    "fileName": "app-1.0.0.exe"
  }
]
```

## 脚本说明

### start.sh
一键启动脚本，自动完成：
- 清理旧日志
- 配置Nginx反向代理
- 安装Node.js依赖
- 启动Node.js服务
- 设置日志自动清理

### stop.sh
一键停止脚本，自动完成：
- 停止Node.js服务
- 停止Nginx服务
- 清理进程

## API 接口

### 1. 获取版本信息
- URL: `/api/version/:projectId`
- 方法: GET
- 参数: 
  - projectId: 项目ID
- 描述: 获取指定项目的最新版本信息
- 响应示例:
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-06-02T10:00:00.000Z",
  "downloadUrl": "/download/project1/1.0.1",
  "releaseNotes": "修复了一些bug",
  "fileName": "app-1.0.1.exe"
}
```

### 2. 下载最新版本
- URL: `/download/:projectId/latest`
- 方法: GET
- 参数:
  - projectId: 项目ID
- 描述: 下载指定项目的最新版本
- 响应: 二进制文件流

### 3. 下载指定版本
- URL: `/download/:projectId/:version`
- 方法: GET
- 参数:
  - projectId: 项目ID
  - version: 版本号
- 描述: 下载指定项目的特定版本
- 响应: 二进制文件流

### 4. 获取项目列表
- URL: `/api/projects`
- 方法: GET
- 描述: 获取所有项目的基本信息
- 响应示例:
```json
[
  {
    "id": "project1",
    "name": "项目一",
    "description": "项目一描述",
    "icon": "icons/default.png"
  },
  {
    "id": "project2",
    "name": "项目二",
    "description": "项目二描述",
    "icon": "icons/default.png"
  }
]
```

### 5. 获取项目详情
- URL: `/api/projects/:projectId`
- 方法: GET
- 参数:
  - projectId: 项目ID
- 描述: 获取指定项目的详细信息
- 响应示例:
```json
{
  "id": "project1",
  "name": "项目一",
  "description": "项目一描述",
  "apiKey": "api-key-project1-123456",
  "icon": "icons/default.png"
}
```

### 6. 添加项目
- URL: `/api/projects`
- 方法: POST
- 描述: 添加新项目
- 请求体示例:
```json
{
  "id": "project3",
  "name": "项目三",
  "description": "项目三描述"
}
```

### 7. 编辑项目
- URL: `/api/projects/:projectId`
- 方法: PUT
- 参数:
  - projectId: 项目ID
- 描述: 更新项目信息
- 请求体示例:
```json
{
  "name": "项目三更新",
  "description": "项目三描述更新"
}
```

### 8. 删除项目
- URL: `/api/projects/:projectId`
- 方法: DELETE
- 参数:
  - projectId: 项目ID
- 描述: 删除指定项目

### 9. 重置项目API密钥
- URL: `/api/projects/:projectId/reset-key`
- 方法: POST
- 参数:
  - projectId: 项目ID
- 描述: 重置项目的API密钥
- 响应示例:
```json
{
  "apiKey": "api-key-project1-987654"
}
```

### 10. 获取项目版本列表
- URL: `/api/versions/:projectId`
- 方法: GET
- 参数:
  - projectId: 项目ID
- 描述: 获取指定项目的所有版本信息
- 响应示例:
```json
{
  "versions": [
    {
      "version": "1.0.1",
      "releaseDate": "2024-06-02T10:00:00.000Z",
      "downloadUrl": "/download/project1/1.0.1",
      "releaseNotes": "修复了一些bug",
      "fileName": "app-1.0.1.exe"
    },
    {
      "version": "1.0.0",
      "releaseDate": "2024-06-01T10:00:00.000Z",
      "downloadUrl": "/download/project1/1.0.0",
      "releaseNotes": "初始版本",
      "fileName": "app-1.0.0.exe"
    }
  ]
}
```

### 11. 上传新版本
- URL: `/api/upload/:projectId`
- 方法: POST
- 参数:
  - projectId: 项目ID
- 描述: 上传新版本文件
- 请求体(form-data):
  - version: 版本号
  - releaseNotes: 版本说明
  - file: 应用程序文件

## 控制面板功能

### 项目管理
- 查看所有项目列表
- 添加新项目
- 编辑项目信息
- 删除项目
- 重置项目API密钥

### 服务器控制
- 启动/停止更新服务器
- 查看服务器状态
- 查看实时日志
- 查看服务器信息

### 版本管理
- 查看项目版本列表
- 上传新版本
- 下载特定版本
- 查看版本详情

## 端口说明
- 80: Nginx反向代理
- 8080: 控制面板
- 3000: 更新服务

## 日志管理
- 位置：/opt/Update/server.log
- 自动清理：每天凌晨执行
- 保留行数：最新1000行
- 格式：纯文本

## 客户端集成

### C#客户端示例
```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Text.Json;

public class UpdateChecker
{
    private readonly string _apiUrl;
    private readonly string _projectId;
    
    public UpdateChecker(string apiUrl, string projectId)
    {
        _apiUrl = apiUrl;
        _projectId = projectId;
    }
    
    public async Task<VersionInfo> CheckForUpdateAsync()
    {
        using var client = new HttpClient();
        var response = await client.GetStringAsync($"{_apiUrl}/api/version/{_projectId}");
        return JsonSerializer.Deserialize<VersionInfo>(response);
    }
    
    public async Task DownloadUpdateAsync(string version, string savePath)
    {
        using var client = new HttpClient();
        var response = await client.GetAsync($"{_apiUrl}/download/{_projectId}/{version}");
        response.EnsureSuccessStatusCode();
        
        using var fs = new System.IO.FileStream(savePath, System.IO.FileMode.Create);
        await response.Content.CopyToAsync(fs);
    }
}

public class VersionInfo
{
    public string Version { get; set; }
    public DateTime ReleaseDate { get; set; }
    public string DownloadUrl { get; set; }
    public string ReleaseNotes { get; set; }
    public string FileName { get; set; }
}
```

## 常见问题

### 1. 服务无法启动
检查：
- 端口是否被占用
- Node.js是否正确安装
- 项目依赖是否完整
- 目录权限是否正确
- 日志文件是否可写

解决：
```bash
# 检查端口占用
netstat -tlpn | grep -E ':80|:8080|:3000'

# 检查Node.js版本
node -v

# 重新安装依赖
cd /opt/Update
npm install --production
```

### 2. 无法访问控制面板
检查：
- Nginx是否正常运行
- 防火墙是否放行80端口
- 服务器安全组设置
- 配置文件是否正确

解决：
```bash
# 检查Nginx状态
systemctl status nginx

# 检查配置
nginx -t

# 检查防火墙
ufw status
```

### 3. 上传版本失败
检查：
- 文件大小是否超过限制（默认100MB）
- 服务器磁盘空间是否充足
- 项目目录权限是否正确
- 版本号是否已存在

解决：
```bash
# 检查磁盘空间
df -h

# 检查目录权限
ls -la /opt/Update/server/projects/

# 修改上传限制
# 编辑server/server-ui.js中的multer配置
```

### 4. 日志不更新
检查：
- 服务是否正常运行
- 日志文件权限是否正确
- 磁盘空间是否充足

解决：
```bash
# 检查服务状态
ps aux | grep node

# 检查日志文件权限
ls -la /opt/Update/server.log

# 手动清理日志
echo "" > /opt/Update/server.log
```

### 5. 项目配置问题
检查：
- config.json文件是否正确
- 项目ID是否唯一
- 项目目录是否存在

解决：
```bash
# 检查配置文件
cat /opt/Update/server/config.json

# 创建项目目录
mkdir -p /opt/Update/server/projects/your-project-id/uploads
```

## 安全建议

1. 修改默认管理员密码
2. 使用强API密钥
3. 配置HTTPS
4. 限制IP访问
5. 定期备份数据 