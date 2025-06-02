# 多项目更新管理系统设计

本文档描述了如何将现有的单项目更新服务器扩展为支持多个项目的更新管理系统。

## 1. 系统架构

### 1.1 目录结构

```
Update/
├── server/
│   ├── index.js                # 主更新服务器逻辑
│   ├── server-ui.js            # Web控制面板服务器逻辑
│   ├── projects/               # 多项目存储目录
│   │   ├── project1/           # 项目1目录
│   │   │   ├── version.json    # 项目1版本信息
│   │   │   └── uploads/        # 项目1上传文件存储
│   │   ├── project2/           # 项目2目录
│   │   │   ├── version.json    # 项目2版本信息
│   │   │   └── uploads/        # 项目2上传文件存储
│   │   └── ...
│   ├── config.json             # 系统配置文件，包含项目列表
│   └── public/
│       └── index.html          # 控制面板前端页面
├── start-update-server.sh      # Linux启动脚本
├── stop-update-server.sh       # Linux停止脚本
└── update-server.service       # systemd服务配置文件
```

### 1.2 数据结构

#### config.json
```json
{
  "projects": [
    {
      "id": "project1",
      "name": "项目一",
      "description": "第一个项目的描述",
      "apiKey": "api-key-for-project1",
      "icon": "icon-path.png"
    },
    {
      "id": "project2",
      "name": "项目二",
      "description": "第二个项目的描述",
      "apiKey": "api-key-for-project2",
      "icon": "icon-path.png"
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

#### 项目版本文件 (version.json)
```json
[
  {
    "version": "1.0.1",
    "releaseDate": "2024-06-02T12:00:00.000Z",
    "downloadUrl": "/download/project1/1.0.1",
    "releaseNotes": "版本说明",
    "fileName": "app-1.0.1.exe"
  }
]
```

## 2. API设计

### 2.1 版本检查API

```
GET /api/version/:projectId
```

**参数**:
- `projectId`: 项目ID

**响应**:
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-06-02T12:00:00.000Z",
  "downloadUrl": "/download/project1/1.0.1",
  "releaseNotes": "版本说明",
  "fileName": "app-1.0.1.exe"
}
```

### 2.2 下载API

```
GET /download/:projectId/:version
GET /download/:projectId/latest
```

**参数**:
- `projectId`: 项目ID
- `version`: 版本号（或"latest"表示最新版本）

### 2.3 上传API

```
POST /api/upload/:projectId
```

**参数**:
- `projectId`: 项目ID

**Headers**:
- `x-api-key`: 项目特定的API密钥

**Body** (form-data):
- `version`: 版本号
- `releaseNotes`: 版本说明
- `file`: 可执行文件

## 3. 控制面板设计

### 3.1 项目选择界面

- 显示所有可用项目的列表
- 每个项目显示名称、描述和图标
- 点击项目进入该项目的管理界面

### 3.2 项目管理界面

- 显示所选项目的信息和版本历史
- 提供上传新版本的功能
- 显示项目特定的API端点信息
- 提供返回项目列表的选项

### 3.3 项目配置界面

- 添加新项目
- 编辑现有项目信息
- 生成/重置项目API密钥
- 删除项目（需确认）

## 4. 实现步骤

### 4.1 服务器端实现

1. **修改目录结构**
   - 创建 `projects` 目录
   - 为每个项目创建子目录

2. **实现配置管理**
   - 创建 `config.json` 文件
   - 实现读取和写入配置的功能

3. **修改API路由**
   - 更新所有API路由以包含项目ID
   - 实现项目特定的API密钥验证

4. **实现版本管理**
   - 为每个项目单独管理版本信息
   - 确保文件存储在正确的项目目录中

### 4.2 前端实现

1. **项目选择界面**
   - 实现项目列表视图
   - 添加项目卡片组件

2. **项目管理界面**
   - 修改现有界面以适应多项目
   - 添加项目导航和切换功能

3. **项目配置界面**
   - 实现项目CRUD操作
   - 添加API密钥管理功能

## 5. 安全考虑

1. **项目隔离**
   - 确保每个项目的数据和文件相互隔离
   - 防止未授权访问其他项目的资源

2. **API密钥管理**
   - 为每个项目使用单独的API密钥
   - 实现密钥轮换和重置功能

3. **访问控制**
   - 实现基于角色的访问控制
   - 可选择性地为不同项目分配不同管理员

## 6. 迁移计划

1. **数据迁移**
   - 将现有版本数据迁移到新的项目结构
   - 创建默认项目配置

2. **API兼容性**
   - 保持向后兼容的API路由
   - 为旧客户端提供过渡期支持

3. **部署策略**
   - 分阶段部署新功能
   - 提供回滚机制

## 7. 客户端适配

1. **更新客户端代码**
   - 修改客户端以支持项目ID参数
   - 更新API调用路径

2. **配置管理**
   - 在客户端存储项目ID
   - 提供项目选择或自动检测功能

## 8. 未来扩展

1. **项目分组**
   - 实现项目分组和分类功能
   - 添加标签和搜索功能

2. **高级统计**
   - 为每个项目提供下载统计
   - 实现版本采用率分析

3. **通知系统**
   - 项目特定的更新通知
   - 管理员提醒和警报 