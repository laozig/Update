# Node.js Update Server

[![node-lts](https://img.shields.io/node/v-lts/express.svg?style=flat-square)](https://nodejs.org/en/about/releases/)
[![GitHub last commit](https://img.shields.io/github/last-commit/laozig/Update.svg?style=flat-square)](https://github.com/laozig/Update/commits/main)

**[English](README.en.md) | 中文**

一个基于 Node.js 和 Express.js 的简单通用应用程序自动更新服务器，带有一个图形化的Web控制面板，用于管理更新、项目和版本。

## 特性

*   **多项目支持**: 通过项目ID和API密钥隔离管理多个不同的应用程序更新。
*   **版本控制**: 轻松上传和管理应用程序的不同版本。
*   **Web 控制面板**: 图形化界面，用于启动/停止更新服务、管理项目、上传版本、查看API密钥和监控基本日志。
*   **API 驱动**: 清晰的API端点，用于客户端检查更新、下载文件和（受保护地）上传新版本。
*   **易于部署**: 可以作为独立的 Node.js 应用运行，推荐使用 PM2 进行生产环境管理。
*   **自定义配置**: 通过 `server/config.json` 进行端口、服务器IP/域名和项目特定设置的配置。
*   **文件名编码处理**: 经过优化的文件名处理逻辑，以支持包括中文在内的非ASCII字符文件名。

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

3.  **配置服务器**:
    *   复制或重命名 `server/config.example.json` 为 `server/config.json` (如果 `config.json` 尚不存在)。
    *   编辑 `server/config.json`，至少设置 `server.serverIp` 为您的服务器公网IP地址或域名，并修改 `server.adminPassword`。
        ```json
        {
          "projects": [
            {
              "id": "project1_test",
              "name": "My Test Project",
              "description": "This is a sample project for testing purposes.",
              "apiKey": "your-secure-api-key-for-project1_test", // 生成或设置一个安全的API密钥
              "icon": "icons/default.png"
            }
          ],
          "server": {
            "serverIp": "YOUR_SERVER_IP_OR_DOMAIN", // 例如 "192.168.1.100" 或 "update.example.com"
            "port": 3000,
            "adminPort": 8080,
            "adminUsername": "admin",
            "adminPassword": "your-strong-password" // 请务必修改此密码!
          }
        }
        ```

4.  **启动服务**:
    *   **API 服务**:
        ```bash
        node server/index.js
        ```
    *   **控制面板服务** (在另一个终端中):
        ```bash
        node server/server-ui.js
        ```
    *   生产环境推荐使用 PM2 管理 (详见部署说明)。

5.  **访问控制面板**: 打开浏览器并访问 `http://localhost:8080` (如果服务器在本地运行) 或 `http://YOUR_SERVER_IP_OR_DOMAIN:8080`。使用您在 `config.json` 中设置的 `adminUsername` 和 `adminPassword` 登录。

## 主要API端点

*   `GET /api/version/:projectId`: 获取指定项目的最新版本信息。
*   `GET /download/:projectId/latest`: 下载指定项目的最新版本文件。
*   `GET /download/:projectId/:version`: 下载指定项目的特定版本文件。
*   `POST /api/upload/:projectId`: (需要 `x-api-key` 认证) 上传新版本文件。
*   `GET /api/projects`: 获取公开的项目列表（不含API密钥）。

## 文档与深入了解

*   **[部署说明 (Deploy Instructions)](./deploy-instructions.md)**: 详细的服务器部署指南，包括使用 PM2、防火墙配置和反向代理建议。
*   **[多项目设计 (Multi-Project Design)](./multi-project-design.md)**: 关于服务器如何支持和管理多个项目的技术设计和实现细节。

## 目录结构

```
Update/
├── server/
│   ├── index.js                # 主API更新服务器逻辑
│   ├── server-ui.js            # Web控制面板服务器逻辑
│   ├── config.json             # 系统配置文件 (重要: 请勿直接提交敏感信息到公共仓库)
│   ├── config.example.json     # config.json 的示例模板
│   ├── projects/               # 多项目数据存储根目录
│   │   ├── [projectId]/        # 单个项目的目录
│   │   │   ├── version.json    # 该项目的版本信息
│   │   │   └── uploads/        # 该项目上传的更新文件
│   │   │       └── .gitkeep    # 确保目录被git追踪
│   │   └── .gitkeep
│   ├── public/                 # 控制面板的前端静态文件 (HTML, CSS, JS)
│   │   └── icons/              # 项目图标目录
│   └── ...                     # 其他服务器端辅助文件
├── .gitignore                  # Git忽略文件配置
├── package.json
├── package-lock.json
├── README.md                   # 本文档 (中文)
├── README.en.md                # 英文版README
├── deploy-instructions.md      # 部署指南
└── multi-project-design.md     # 多项目设计文档
```

## 注意事项

*   **安全**: 请务必修改 `server/config.json` 中的默认管理员密码，并为每个项目生成强API密钥。
*   **备份**: 定期备份 `server/config.json` 文件以及整个 `server/projects/` 目录，因为它们包含了所有项目配置、版本历史和上传的更新文件。
*   **日志**: API服务 (`server/index.js`) 和控制面板服务 (`server/server-ui.js`) 都会在控制台输出日志。控制面板服务还会将一些操作记录到 `server.log` 文件中。

## 贡献

欢迎提交 Pull Requests 或 Issues 来改进此项目。

## 许可证

[MIT](LICENSE) 