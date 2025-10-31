# 多项目支持设计（简版）

本文档说明更新服务器在单实例下支持多个项目（应用）的核心设计与实现要点。

## 1. 核心概念
- **项目隔离**：每个项目有独立的版本历史与文件目录；通过 `projectId` 区分与访问。
- **认证模型**：
  - 客户端上传使用项目级 `x-api-key`。
  - 控制面板使用 JWT（管理员/项目所有者权限）。
- **链接生成**：下载链接优先使用 `BASE_URL`，否则根据请求动态识别协议与主机名（启用 `trust proxy`）。

## 2. 配置 (`server/config.json`)
- `projects[]`: `{ id, name, description?, apiKey, icon? }`
- `server`: `{ port, adminPort }`（对外地址不再使用 `serverIp`，外部可通过 `BASE_URL` 环境变量指定）

## 3. 磁盘数据结构
```
server/projects/
  └── <projectId>/
      ├── version.json    # 版本列表（数组，新在前）
      └── uploads/        # 上传的安装包文件（文件名含版本）
```

版本对象示例：
```json
{
  "version": "1.0.1",
  "releaseDate": "2024-07-01T10:00:00.000Z",
  "downloadUrl": "/download/myapp/1.0.1",   // 存储相对路径；对外响应时可拼成绝对URL
  "releaseNotes": "修复若干问题",
  "fileName": "MyApp_1.0.1.exe",
  "originalFileName": "MyApp"
}
```

## 4. 关键接口
- `GET /api/version/:projectId`：获取最新版本（控制面板/客户端公共）
- `POST /api/upload/:projectId`：上传版本（需 `x-api-key` 或在控制面板内使用 JWT）
- `GET /download/:projectId/:version`、`GET /download/:projectId/latest`：下载指定/最新版本

## 5. 文件名与安全
- 上传采用 `multer` 保存到项目 `uploads/`；保存时在原名后拼接 `_version`。
- 进行文件名解码与转码修复；限制路径（仅基名）与体积（默认100MB，可调）。

## 6. 版本排序与兼容
- 版本数组按版本号数值逆序；兼容旧数据自动补足 `downloadUrl`、`originalFileName`。

## 7. 生产部署要点
- 反向代理时设置 `app.set('trust proxy', 1)` 并传递 `X-Forwarded-Proto/Host`。
- 推荐设置 `BASE_URL`（如 `https://updates.example.com`）。
- 日志采用轮转策略；可配合 PM2 进行守护与日志管理。

以上设计保证多项目数据彼此隔离、接口清晰、部署方式灵活。