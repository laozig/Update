# Nginx 配置说明

## 1. 安装 Nginx（如果尚未安装）
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install epel-release
sudo yum install nginx
```

## 2. 配置 Nginx

1. 将 `nginx.conf` 文件复制到 Nginx 配置目录：
```bash
# Ubuntu/Debian
sudo cp nginx.conf /etc/nginx/sites-available/update-server
sudo ln -s /etc/nginx/sites-available/update-server /etc/nginx/sites-enabled/

# CentOS/RHEL
sudo cp nginx.conf /etc/nginx/conf.d/update-server.conf
```

2. 测试配置文件是否正确：
```bash
sudo nginx -t
```

3. 如果测试通过，重启 Nginx：
```bash
sudo systemctl restart nginx
```

## 3. 防火墙设置

如果服务器开启了防火墙，需要允许 80 端口：

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 80/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload
```

## 4. 验证配置

配置完成后，您应该可以通过以下地址访问服务：

- 控制面板：http://103.97.179.230/
- API 示例：http://103.97.179.230/api/version/project1
- 下载示例：http://103.97.179.230/download/project1/latest

## 5. 故障排查

1. 检查 Nginx 日志：
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

2. 检查 Nginx 状态：
```bash
sudo systemctl status nginx
```

3. 确保更新服务正在运行：
```bash
# 检查 3000 端口
netstat -tlpn | grep :3000

# 检查 8080 端口
netstat -tlpn | grep :8080
```

## 注意事项

1. 确保更新服务器（端口3000）和控制面板（端口8080）都在运行
2. 如果使用了其他端口，请相应修改 nginx.conf 中的配置
3. 如果服务器有多个域名或IP，请相应修改 server_name
4. 建议后续配置 SSL 证书，启用 HTTPS 