# Docker部署详细指南

本文档提供了使用Docker部署更新服务器的详细步骤和最佳实践。

## 1. 前提条件

- 已安装Docker（推荐版本19.03或更高）
- 已安装Docker Compose（推荐版本1.27.0或更高）
- 基本了解Docker容器和卷的概念

> **注意**: 如果您尚未安装Docker和Docker Compose，请参考 [Docker安装指南](./INSTALL.md) 进行安装。

## 2. 目录结构

```
docker/
├── Dockerfile                        # 基本镜像构建定义文件
├── Dockerfile.multistage             # 多阶段构建优化的Dockerfile
├── docker-compose.yml                # 基本服务编排配置
├── docker-compose.prod.yml           # 生产环境优化配置
├── docker-compose.override.example.yml # 开发环境自定义配置示例
├── nginx.conf                        # Nginx反向代理配置
├── env.example                       # 环境变量示例文件
├── INSTALL.md                        # Docker安装指南
└── README.md                         # 本文档
```

## 3. 详细部署步骤

### 3.1 准备配置文件

在构建Docker镜像前，确保已经创建并配置了`server/config.json`文件：

```bash
# 如果config.json不存在，从示例复制一份
cp server/config.example.json server/config.json

# 编辑配置文件
nano server/config.json  # 或使用其他编辑器
```

确保在`config.json`中设置了正确的`serverIp`（可以是Docker主机的IP或域名）。

### 3.2 构建和启动容器

从项目根目录执行以下命令：

```bash
# 使用docker-compose构建并启动容器
cd docker
docker-compose up -d
```

这将：
1. 构建Docker镜像（如果不存在或有更改）
2. 创建并启动API服务和UI服务的容器
3. 以后台模式运行（-d参数）

### 3.3 验证部署

检查容器是否正常运行：

```bash
docker-compose ps
```

查看容器日志：

```bash
# 查看API服务日志
docker-compose logs update-api

# 查看UI服务日志
docker-compose logs update-ui

# 实时跟踪日志
docker-compose logs -f
```

### 3.4 访问服务

- API服务：`http://<主机IP>:3000`
- 控制面板：`http://<主机IP>:8080`

## 4. 容器管理

### 4.1 停止服务

```bash
docker-compose down
```

### 4.2 重启服务

```bash
docker-compose restart
```

### 4.3 重建镜像

如果代码有更新，需要重新构建镜像：

```bash
docker-compose build
docker-compose up -d
```

### 4.4 查看容器资源使用情况

```bash
docker stats
```

## 5. 数据持久化

Docker部署使用卷挂载来持久化数据：

- `server/config.json`：配置文件
- `server/projects/`：项目数据和上传的文件
- `server.log`：日志文件

这些文件存储在主机上，即使容器被删除也不会丢失。

## 6. 高级配置

### 6.1 环境变量

可以通过创建`.env`文件或在`docker-compose.yml`中添加环境变量来自定义配置：

```yaml
services:
  update-api:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
```

### 6.2 资源限制

为容器设置资源限制：

```yaml
services:
  update-api:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### 6.3 网络配置

默认情况下，两个服务使用同一网络。可以自定义网络：

```yaml
services:
  update-api:
    networks:
      - backend
  update-ui:
    networks:
      - frontend
      - backend

networks:
  frontend:
  backend:
```

## 7. 使用Nginx反向代理

对于生产环境，建议使用Nginx作为反向代理，处理SSL终止和请求路由：

```yaml
version: '3'
services:
  # API和UI服务配置...
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - update-api
      - update-ui
    restart: unless-stopped
```

Nginx配置示例（`nginx.conf`）：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # API服务
    location /api/ {
        proxy_pass http://update-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 下载路径
    location /download/ {
        proxy_pass http://update-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 控制面板
    location / {
        proxy_pass http://update-ui:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 8. 安全最佳实践

### 8.1 使用非root用户

修改Dockerfile，使用非root用户运行应用：

```dockerfile
FROM node:16-alpine

# 创建应用目录
WORKDIR /app

# 添加非root用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 复制应用文件
COPY package*.json ./
RUN npm install
COPY . .

# 设置权限
RUN chown -R appuser:appgroup /app

# 切换到非root用户
USER appuser

EXPOSE 3000 8080
CMD ["node", "server/index.js"]
```

### 8.2 使用多阶段构建

优化镜像大小和安全性：

```dockerfile
# 构建阶段
FROM node:16-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 运行阶段
FROM node:16-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app .
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000 8080
CMD ["node", "server/index.js"]
```

### 8.3 定期更新基础镜像

确保定期更新基础镜像以获取安全补丁：

```bash
docker-compose pull
docker-compose build --no-cache
docker-compose up -d
```

## 9. 故障排除

### 9.1 容器无法启动

检查日志：

```bash
docker-compose logs
```

常见问题：
- 端口冲突：确保主机上的3000和8080端口未被占用
- 配置文件问题：检查config.json是否存在且格式正确
- 权限问题：检查挂载的卷的权限

### 9.2 无法连接到服务

- 检查Docker网络：`docker network ls`
- 验证端口映射：`docker-compose ps`
- 检查防火墙设置：确保允许相关端口的流量

### 9.3 数据持久化问题

如果上传的文件或配置更改在容器重启后丢失：
- 确认卷挂载配置正确
- 检查主机上的目录权限
- 验证Docker卷：`docker volume ls`

## 10. 生产环境优化

- 使用Docker Swarm或Kubernetes进行容器编排
- 实施健康检查和自动重启策略
- 设置日志轮转以避免磁盘空间耗尽
- 使用Docker Secrets管理敏感信息
- 实施容器监控（如Prometheus和Grafana）

## 11. 备份策略

### 11.1 配置和数据备份

```bash
# 备份配置文件
cp server/config.json server/config.json.bak

# 备份项目数据
tar -czf projects_backup.tar.gz server/projects/
```

### 11.2 Docker卷备份

```bash
# 创建备份容器
docker run --rm -v update_data:/data -v $(pwd):/backup alpine tar -czf /backup/data_backup.tar.gz /data
```

## 12. 更新与升级

### 12.1 更新应用代码

```bash
# 拉取最新代码
git pull origin main

# 重建并重启容器
cd docker
docker-compose build
docker-compose up -d
```

### 12.2 滚动更新（零停机时间）

对于生产环境，可以使用Docker Swarm或Kubernetes实现零停机时间部署。 