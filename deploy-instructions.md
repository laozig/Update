# 更新服务器部署指南 (Ubuntu)

本文档提供在Ubuntu服务器上部署更新服务器的详细步骤。

## 先决条件

- Ubuntu 18.04 LTS或更高版本
- Node.js 14.x或更高版本
- npm 6.x或更高版本

## 安装Node.js和npm

```bash
# 添加Node.js源
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -

# 安装Node.js和npm
sudo apt-get install -y nodejs

# 验证安装
node -v
npm -v
```

## 部署步骤

### 1. 准备应用程序

```bash
# 创建应用目录
mkdir -p /opt/update-server
cd /opt/update-server

# 上传项目文件到此目录
# 可以使用scp, rsync或git clone等方式

# 安装依赖
npm install
```

### 2. 配置服务器

确保`server/version.json`文件存在并包含有效的JSON数组：

```bash
# 如果文件不存在，创建一个空数组
echo "[]" > server/version.json

# 设置权限
chmod 755 start-update-server.sh stop-update-server.sh
```

### 3. 选择部署方式

#### 方式一：使用脚本启动（推荐用于测试）

```bash
# 启动服务器
./start-update-server.sh

# 停止服务器
./stop-update-server.sh
```

#### 方式二：使用systemd服务（推荐用于生产环境）

```bash
# 编辑服务配置文件，修改实际部署路径
sudo nano update-server.service
# 将WorkingDirectory和User修改为实际值

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

```bash
# 安装PM2
sudo npm install -g pm2

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

## 访问控制面板

服务器启动后，可以通过以下URL访问控制面板：

```
http://服务器IP:3000
```

## 防火墙配置

如果启用了防火墙，需要开放3000端口：

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

## 故障排除

1. 如果服务无法启动，检查日志：
   ```bash
   # 使用脚本方式
   cat logs/server-ui.log
   
   # 使用systemd方式
   sudo journalctl -u update-server
   
   # 使用PM2方式
   pm2 logs update-server
   ```

2. 确保端口3000未被占用：
   ```bash
   sudo netstat -tulpn | grep 3000
   ```

3. 检查Node.js版本兼容性：
   ```bash
   node -v
   ```

4. 检查文件权限：
   ```bash
   ls -la /opt/update-server
   ```

## 注意事项

- 生产环境建议使用HTTPS，可以配合Nginx反向代理实现
- 考虑添加身份验证机制保护控制面板
- 定期备份`server/version.json`和上传的应用程序文件 