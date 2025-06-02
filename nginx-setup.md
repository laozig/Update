# Nginx配置说明

## 配置文件位置
Nginx配置文件通常位于以下位置之一：
- `/etc/nginx/conf.d/update-server.conf`
- `/etc/nginx/sites-available/update-server` (需要软链接到sites-enabled目录)

## 配置内容
将以下配置添加到Nginx配置文件中：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 103.97.179.230;
    client_max_body_size 100M;

    # 控制面板 - 转发到8080端口
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_intercept_errors on;
        error_page 502 503 504 /error.html;
    }

    # 更新服务API - 转发到3000端口
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 下载路由 - 转发到3000端口
    location /download/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 错误页面
    location = /error.html {
        root /opt/Update/server/public;
        internal;
    }
}
```

## 手动部署步骤

1. 安装Nginx（如果尚未安装）：
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install epel-release
sudo yum install nginx
```

2. 创建配置文件：
```bash
sudo nano /etc/nginx/conf.d/update-server.conf
# 粘贴上面的配置内容
```

3. 检查配置是否有语法错误：
```bash
sudo nginx -t
```

4. 重启Nginx应用配置：
```bash
sudo systemctl restart nginx
```

5. 确保Nginx开机自启：
```bash
sudo systemctl enable nginx
```

## 防火墙配置

确保服务器防火墙允许80端口通过：

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

## 常见问题排查

1. 无法访问服务：
```bash
# 检查Nginx是否运行
sudo systemctl status nginx

# 检查端口是否被占用
sudo netstat -tlpn | grep -E ':80|:8080|:3000'

# 检查防火墙状态
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-all  # CentOS/RHEL
```

2. 502/504错误：
```bash
# 检查Node.js服务是否运行
ps aux | grep node

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

3. 权限问题：
```bash
# 确保Nginx用户有权限访问应用目录
sudo chown -R www-data:www-data /opt/Update/server/public
```

## 性能优化

对于高流量站点，可以考虑以下优化：

1. 启用Gzip压缩：
```nginx
gzip on;
gzip_comp_level 5;
gzip_min_length 256;
gzip_proxied any;
gzip_types application/javascript application/json text/css text/plain text/xml;
```

2. 添加缓存控制：
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, no-transform";
}
```

3. 增加工作进程数：
```nginx
# 在nginx.conf中设置
worker_processes auto;
``` 