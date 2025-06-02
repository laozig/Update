# Update Server Deployment Guide

This document provides detailed steps for deploying the update server on a server.

## Server Requirements

- Operating System: Linux (Recommended: Ubuntu 20.04+ or CentOS 8+)
- Memory: Minimum 1GB, Recommended 2GB+
- Storage: Minimum 10GB free space
- CPU: 1 core+
- Network: Public IP address

## Software Requirements

- Node.js 14+
- npm 6+
- Git (Optional, for pulling code from the repository)

## One-Click Deployment Steps (Using provided scripts - if available)

*Note: The `start.sh` and `stop.sh` scripts are not part of the current repository structure. The steps below are general guidelines if such scripts were provided or if you create them. For current recommended methods, see Manual Deployment and PM2 setup in README.* 

1. Clone the repository (or upload project files to the server):
```bash
git clone https://github.com/laozig/Update.git /opt/Update
```

2. Navigate to the project directory:
```bash
cd /opt/Update
```

3. Set execution permissions (if you have `start.sh`/`stop.sh`):
```bash
# chmod +x start.sh stop.sh 
# These files are not in the current project, this is a general example.
```

4. Start the service (if you have `start.sh`):
```bash
# sudo ./start.sh 
# This file is not in the current project, this is a general example.
```

5. Access the control panel:
   - URL: http://YOUR_SERVER_IP:8080/
   - Default Username: `admin` (Refer to `server/config.json`)
   - Default Password: `admin` (Refer to `server/config.json`, **change this!**)

## Manual Deployment Steps

If one-click deployment scripts are unavailable or not working, follow these manual steps:

### 1. Install Node.js and npm

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
```
Verify installation:
```bash
node -v
npm -v
```

### 2. Configure Project Directory

Choose a directory for the application, e.g., `/opt/Update`.

```bash
# Create project directory (if it doesn't exist from git clone)
sudo mkdir -p /opt/Update
# Navigate into it
cd /opt/Update 
```
If you cloned with git, the directory is already created. Ensure you are in the project root (`/opt/Update` or your chosen path).

### 3. Upload or Clone Project Files

If you haven't cloned yet:
```bash
# Clone using Git (recommended)
git clone https://github.com/laozig/Update.git .
# The . clones into the current directory (/opt/Update)
```

Or, if you uploaded a zip file (e.g., `update-server-v1.0.0.zip`):
```bash
# Example: unzip update-server-v1.0.0.zip -d /opt/Update
# Ensure the files are in /opt/Update, not /opt/Update/update-server-v1.0.0
```

### 4. Install Dependencies

Navigate to the project root directory (`/opt/Update`):
```bash
cd /opt/Update 
npm install --production
```
This installs only production dependencies defined in `package.json`.

### 5. Configure the Server

Copy the example configuration file if `config.json` does not exist:
```bash
cd server
if [ ! -f config.json ]; then cp config.example.json config.json; fi
```
Edit `server/config.json` with your settings:
```bash
nano server/config.json # or your preferred editor
```
**Crucial settings**: `serverIp`, `adminUsername`, `adminPassword`. Refer to `README.md` for details.

### 6. Starting the Services (Manual / PM2)

The recommended way to run the services in production is using PM2, as detailed in the main `README.md`.

**Manual Start (for testing/development):**

You need to start two Node.js processes:
1.  **API Service** (`server/index.js`)
2.  **Control Panel Service** (`server/server-ui.js`)

Open two terminals or use a tool like `screen` or `tmux`.

In the project root (`/opt/Update`):

Terminal 1 (API Service):
```bash
node server/index.js
```

Terminal 2 (Control Panel Service):
```bash
node server/server-ui.js
```

For backgrounding with `nohup` (less robust than PM2):
```bash
# In /opt/Update
nohup node server/index.js > server-api.log 2>&1 &

nohup node server/server-ui.js > server-ui.log 2>&1 & 
# Note: server-ui.js already logs to server.log, so redirecting its stdout/stderr might be redundant or can be directed elsewhere.
```

**Using PM2 (Recommended for Production):**

Refer to Section 4.3 of `README.md` or `README.en.md` for detailed PM2 instructions.
```bash
# In /opt/Update
pm2 start server/index.js --name update-api-server
pm2 start server/server-ui.js --name update-control-panel
pm2 save
pm2 startup # To ensure PM2 starts on system boot
```

### 7. Setting up Systemd Service (Alternative to PM2 for basic autostart)

If you prefer not to use PM2 and want to use `systemd` directly (this example assumes you have `start.sh` and `stop.sh` scripts, which are NOT currently in the repo. You'd need to create them to manage both Node processes).

1.  Create `start.sh` in `/opt/Update`:
    ```bash
    #!/bin/bash
    cd /opt/Update
    node server/index.js > server-api.log 2>&1 &
    node server/server-ui.js > server-ui.log 2>&1 &
    echo "Update services started"
    ```
2.  Create `stop.sh` in `/opt/Update`:
    ```bash
    #!/bin/bash
    echo "Stopping Update services..."
    pkill -f "node server/index.js"
    pkill -f "node server/server-ui.js"
    echo "Update services stopped"
    ```
3.  Make them executable:
    ```bash
    chmod +x /opt/Update/start.sh
    chmod +x /opt/Update/stop.sh
    ```

4.  Create a systemd service file:
    ```bash
    sudo nano /etc/systemd/system/update-server.service
    ```

5.  Add the following content. Adjust `User` if you run Node as a non-root user (recommended for security).
    ```ini
    [Unit]
    Description=Update Server (API and UI)
    After=network.target
    
    [Service]
    Type=forking # Use forking if start.sh backgrounds processes
    User=root # Or your dedicated node user
    WorkingDirectory=/opt/Update
    ExecStart=/opt/Update/start.sh
    ExecStop=/opt/Update/stop.sh
    Restart=on-failure
    RestartSec=10
    # StandardOutput=syslog # Output is handled by scripts
    # StandardError=syslog
    # SyslogIdentifier=update-server
    
    [Install]
    WantedBy=multi-user.target
    ```
    *Note: If `start.sh` doesn't background itself (e.g., you run `node ...` directly without `&`), use `Type=simple` and PM2 or similar for process management is better.* 

6.  Enable and start the service:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable update-server.service
    sudo systemctl start update-server.service
    sudo systemctl status update-server.service
    ```

## Troubleshooting Common Issues

### 1. Cannot Access Control Panel

Check the following:

1.  Confirm services are running (using PM2 or `ps`):
    ```bash
    pm2 list
    # or
    ps aux | grep node
    ```

2.  Check if ports are listening:
    The default ports are `3000` (API) and `8080` (Control Panel), verify in `server/config.json`.
    ```bash
    sudo netstat -tlpn | grep -E ':8080|:3000'
    # Or ss -tlpn | grep -E ':8080|:3000'
    ```

3.  Confirm firewall allows traffic on these ports:
    ```bash
    # For UFW (Ubuntu)
    sudo ufw status
    
    # For firewalld (CentOS/RHEL)
    sudo firewall-cmd --list-all
    ```

### 2. Service Fails to Start

1.  **Check Node.js version**:
    ```bash
    node -v
    ```
    Ensure it meets the requirement (14+).

2.  **Ensure dependencies are installed**:
    Navigate to project root (`/opt/Update`):
    ```bash
    npm install --production
    ```

3.  **Check for port conflicts**:
    If another service is using port `3000` or `8080`.
    ```bash
    sudo netstat -tlpn | grep -E ':8080|:3000'
    ```
    If so, change `port` or `adminPort` in `server/config.json` or stop the conflicting service.

4.  **View logs**:
    *   If using PM2: `pm2 logs update-api-server` and `pm2 logs update-control-panel`.
    *   If using `nohup`: Check `server-api.log` and `server-ui.log` (or `server.log` as configured in `server-ui.js`).
    *   If using `systemd`: `sudo journalctl -u update-server.service -f`.

### 3. Firewall Issues

1.  **Configure UFW (Ubuntu)**:
    ```bash
    sudo ufw status # Check status
    sudo ufw allow 8080/tcp # Allow control panel port
    sudo ufw allow 3000/tcp # Allow API port
    sudo ufw enable # If not already enabled
    sudo ufw reload # If rules were added
    ```

2.  **Configure Firewalld (CentOS/RHEL)**:
    ```bash
    sudo firewall-cmd --state # Check status
    sudo firewall-cmd --permanent --add-port=8080/tcp
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --reload
    ```
Remember to replace `8080` and `3000` if you have customized the ports in `server/config.json`.

## Nginx Reverse Proxy (Optional but Recommended)

For production, it's good practice to run Node.js applications behind a reverse proxy like Nginx. This allows you to:
*   Use standard ports (80 for HTTP, 443 for HTTPS).
*   Easily implement SSL/TLS (HTTPS).
*   Serve static content efficiently.
*   Provide load balancing (if needed in the future).

Refer to the `README.md` or `README.en.md` which may link to more specific Nginx setup instructions if available, or search for standard Nginx reverse proxy configurations for Node.js applications.

A basic example for proxying to the control panel (port 8080) and API (port 3000):

```nginx
# /etc/nginx/sites-available/update.yourdomain.com

server {
    listen 80;
    server_name update.yourdomain.com;

    # Optional: Redirect HTTP to HTTPS (if SSL is configured)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:8080; # Control Panel UI
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /download/ {
        proxy_pass http://127.0.0.1:3000/download/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Add SSL configuration here for HTTPS
    # listen 443 ssl;
    # ssl_certificate /path/to/your/fullchain.pem;
    # ssl_certificate_key /path/to/your/privkey.pem;
    # ... other SSL settings ...
}
```

Enable this configuration:
```bash
sudo ln -s /etc/nginx/sites-available/update.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t # Test configuration
sudo systemctl restart nginx
```

Remember to obtain an SSL certificate (e.g., via Let's Encrypt) for HTTPS. 