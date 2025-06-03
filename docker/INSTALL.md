# Docker 安装指南

本文档提供了在不同操作系统上安装 Docker 和 Docker Compose 的详细步骤。

## 1. Windows 安装 Docker

### 1.1 系统要求

- Windows 10 64位: 专业版、企业版或教育版（Build 16299或更高版本）
- 启用Hyper-V和容器功能
- 至少4GB RAM

### 1.2 安装 Docker Desktop for Windows

1. 访问 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop) 下载安装程序
2. 双击下载的 `Docker Desktop Installer.exe` 文件
3. 按照安装向导进行安装，建议使用默认设置
4. 安装完成后，Docker 会自动启动
5. 在系统托盘中可以看到 Docker 图标，表示 Docker 正在运行

### 1.3 验证安装

打开命令提示符或 PowerShell，运行以下命令：

```powershell
docker --version
docker-compose --version
docker run hello-world
```

## 2. macOS 安装 Docker

### 2.1 系统要求

- macOS 10.14 (Mojave) 或更高版本
- 至少4GB RAM

### 2.2 安装 Docker Desktop for Mac

1. 访问 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop) 下载安装程序
2. 将下载的 `.dmg` 文件拖到应用程序文件夹
3. 双击应用程序文件夹中的 Docker.app 启动 Docker
4. 在菜单栏中可以看到 Docker 图标，表示 Docker 正在运行

### 2.3 验证安装

打开终端，运行以下命令：

```bash
docker --version
docker-compose --version
docker run hello-world
```

## 3. Linux 安装 Docker

### 3.1 Ubuntu 安装 Docker

#### 系统要求
- Ubuntu 20.04, 22.04 或更高版本
- 64位系统

#### 安装步骤

1. 更新软件包索引并安装必要的依赖：

```bash
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
```

2. 添加 Docker 的官方 GPG 密钥：

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
```

3. 设置稳定版仓库：

```bash
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

4. 安装 Docker Engine：

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io
```

5. 将当前用户添加到 docker 组（避免每次使用 docker 命令都需要 sudo）：

```bash
sudo usermod -aG docker $USER
```
注意：添加用户到组后需要注销并重新登录才能生效。

6. 验证安装：

```bash
docker --version
docker run hello-world
```

### 3.2 CentOS 安装 Docker

#### 系统要求
- CentOS 7 或 8
- 64位系统

#### 安装步骤

1. 安装必要的依赖：

```bash
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
```

2. 添加 Docker 仓库：

```bash
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

3. 安装 Docker Engine：

```bash
sudo yum install -y docker-ce docker-ce-cli containerd.io
```

4. 启动 Docker：

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

5. 将当前用户添加到 docker 组：

```bash
sudo usermod -aG docker $USER
```
注意：添加用户到组后需要注销并重新登录才能生效。

6. 验证安装：

```bash
docker --version
docker run hello-world
```

### 3.3 Debian 安装 Docker

#### 系统要求
- Debian 10 (Buster) 或 11 (Bullseye)
- 64位系统

#### 安装步骤

1. 更新软件包索引并安装必要的依赖：

```bash
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
```

2. 添加 Docker 的官方 GPG 密钥：

```bash
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
```

3. 设置稳定版仓库：

```bash
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

4. 安装 Docker Engine：

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io
```

5. 将当前用户添加到 docker 组：

```bash
sudo usermod -aG docker $USER
```
注意：添加用户到组后需要注销并重新登录才能生效。

6. 验证安装：

```bash
docker --version
docker run hello-world
```

## 4. 安装 Docker Compose

### 4.1 Linux 安装 Docker Compose

1. 下载当前稳定版本的 Docker Compose：

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
```

2. 添加可执行权限：

```bash
sudo chmod +x /usr/local/bin/docker-compose
```

3. 验证安装：

```bash
docker-compose --version
```

### 4.2 Windows 和 macOS

Docker Desktop for Windows 和 Docker Desktop for Mac 已经包含了 Docker Compose，无需单独安装。

## 5. 常见问题排解

### 5.1 Docker 守护进程无法启动

```bash
# 检查 Docker 服务状态
sudo systemctl status docker

# 查看 Docker 日志
sudo journalctl -u docker
```

### 5.2 权限问题

如果遇到 "Permission denied" 错误：

```bash
# 确保当前用户在 docker 组中
sudo usermod -aG docker $USER

# 重新加载组成员关系（无需注销）
newgrp docker
```

### 5.3 存储空间不足

清理未使用的 Docker 资源：

```bash
# 删除所有停止的容器
docker container prune

# 删除未使用的镜像
docker image prune

# 删除所有未使用的对象（容器、镜像、网络、卷）
docker system prune -a
```

### 5.4 网络问题

如果 Docker 无法拉取镜像，可能是网络或 DNS 问题：

```bash
# 编辑 Docker 守护进程配置
sudo nano /etc/docker/daemon.json

# 添加以下内容（使用公共 DNS）
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}

# 重启 Docker
sudo systemctl restart docker
```

## 6. 设置 Docker 自启动

### 6.1 Linux

```bash
sudo systemctl enable docker
```

### 6.2 Windows

Docker Desktop 默认设置为开机自启动。可以在 Docker Desktop 设置中修改。

### 6.3 macOS

Docker Desktop 默认设置为登录时启动。可以在 Docker Desktop 偏好设置中修改。

## 7. 安装后配置

### 7.1 配置镜像加速（中国用户）

#### Linux

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://registry.docker-cn.com",
    "https://mirror.baidubce.com",
    "https://hub-mirror.c.163.com"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

#### Windows/macOS

在 Docker Desktop 的设置/首选项中，找到 "Docker Engine" 配置，添加以下内容：

```json
{
  "registry-mirrors": [
    "https://registry.docker-cn.com",
    "https://mirror.baidubce.com",
    "https://hub-mirror.c.163.com"
  ]
}
```

### 7.2 限制 Docker 资源使用

#### Linux

创建或编辑 `/etc/docker/daemon.json`：

```json
{
  "default-shm-size": "64M",
  "storage-opts": [
    "dm.basesize=20G"
  ]
}
```

#### Windows/macOS

在 Docker Desktop 设置中，可以调整分配给 Docker 的 CPU、内存和磁盘空间。

## 8. 卸载 Docker

### 8.1 Windows

1. 在控制面板中找到"程序和功能"
2. 选择 Docker Desktop，点击卸载
3. 按照向导完成卸载

### 8.2 macOS

1. 从应用程序文件夹中删除 Docker.app
2. 运行以下命令清理剩余文件：

```bash
rm -rf ~/Library/Group\ Containers/group.com.docker
rm -rf ~/Library/Containers/com.docker.docker
rm -rf ~/.docker
```

### 8.3 Linux (Ubuntu/Debian)

```bash
# 卸载 Docker Engine 和相关包
sudo apt purge docker-ce docker-ce-cli containerd.io

# 删除所有镜像、容器和卷
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
```

### 8.4 Linux (CentOS)

```bash
# 卸载 Docker Engine 和相关包
sudo yum remove docker-ce docker-ce-cli containerd.io

# 删除所有镜像、容器和卷
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
``` 