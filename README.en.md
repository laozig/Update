# Node.js Multi-Project Update Server

[![node-lts](https://img.shields.io/node/v-lts/express.svg?style=flat-square)](https://nodejs.org/en/about/releases/)
[![GitHub last commit](https://img.shields.io/github/last-commit/laozig/Update.svg?style=flat-square)](https://github.com/laozig/Update/commits/main)

**English | [中文](README.md)**

A simple, general-purpose, multi-project application update server based on Node.js and Express.js, equipped with a graphical web control panel for managing projects, versions, uploading update files, and monitoring services.

## 1. Repository and Code Management

*   **Repository URL**: `https://github.com/laozig/Update.git`
*   **Clone Repository**: 
    ```bash
    git clone https://github.com/laozig/Update.git
    ```
*   **Enter Project Directory**:
    ```bash
    cd Update
    ```
*   **Pull Latest Updates**:
    ```bash
    git pull origin main
    ```

## 2. Features

*   **Multi-user Support**: Supports user registration and login, with each user only able to manage their own projects.
*   **Permission Control**: Administrators can view and manage all projects, while regular users can only manage their own projects.
*   **Multi-Project Support**: Isolate and manage multiple different application updates through project IDs and API keys.
*   **Version Control**: Easily upload and manage different versions of applications with support for release notes.
*   **Web Control Panel**: Graphical interface for:
    *   Starting/stopping the core API update service.
    *   Real-time viewing of service status and logs.
    *   Managing projects (CRUD operations).
    *   Uploading new version files for specified projects.
    *   Viewing and resetting project API keys.
*   **API-Driven**: Clear API endpoints for client applications to check for updates, download files, and for (protected) management tools to upload new versions.
*   **Easy Deployment**: Can run as a standalone Node.js application. PM2 is recommended for production environment management to achieve process monitoring and log management.
*   **Custom Configuration**: Flexible configuration of server ports, IP/domain, user accounts, and specific settings for each project through `server/config.json`.
*   **Filename Encoding Handling**: Optimized file name handling logic to correctly support non-ASCII character file names, including Chinese.
*   **Log Management**: The control panel service logs operations to `server.log` and provides log viewing functionality. The main API service logs output to the console.
*   **JWT Authentication**: Uses JWT tokens for user authentication, enhancing security.
*   **Password Security**: Uses bcrypt for password hashing, ensuring account security.

## 3. Latest Feature Updates

### 3.1. Multi-User System (June 2024)

*   **User Registration**: Added user registration functionality, supporting the creation of personal accounts.
*   **User Login**: Secure authentication using JWT tokens, with passwords stored using bcrypt hashing.
*   **Project Ownership**: Each project has a clear owner, ensuring data isolation.
*   **Permission Control**: 
    *   Administrators can view and manage all projects and users
    *   Regular users can only view and manage their own projects
    *   Project operations (editing, deleting, uploading versions) require owner or administrator permissions
*   **User Role Management**:
    *   Administrators can set or change the roles of other users
    *   The system ensures at least one administrator account is retained
*   **User Interface Improvements**:
    *   Added login and registration pages
    *   Display current logged-in user information and role
    *   Dynamically display available features based on user role
    *   Support for logout functionality

### 3.2. API Key Management Optimization

*   **Automatic Generation**: Automatically generate secure API keys when creating projects
*   **Reset Functionality**: Support one-click reset of project API keys
*   **Visual Management**: Intuitively display API keys in project settings
*   **Permission Protection**: Only project owners and administrators can view and reset API keys
*   **Secure Transmission**: API keys are protected during transmission through HTTPS and JWT authentication

## 4. System Architecture and Components

*   **Core API Service (`server/index.js`)**: Handles client version check (`/api/version/:projectId`), file download (`/download/...`), and (authenticated) version upload (`/api/upload/:projectId`) requests. Default listening port `3000`.
*   **Web Control Panel Service (`server/server-ui.js`)**: Provides a web-based management interface. Responsible for project management, version uploads (by calling the core API or internal logic), API service start/stop control, log viewing, etc. Default listening port `8080`.
*   **Configuration File (`server/config.json`)**: Stores system-level configuration (such as service ports, user accounts) and detailed information for all projects (ID, name, API key, icon, etc.).
*   **Project Data Storage (`server/projects/`)**: Each project has a subdirectory named after its `projectId` in this directory, containing:
    *   `version.json`: Version history and metadata for the project.
    *   `uploads/`: Actual update files uploaded for the project.
*   **User Authentication System**: Uses JWT (JSON Web Token) for user authentication, supporting login, registration, and permission control.
*   **Frontend Interface**: Bootstrap-based responsive web interface, including login page, registration page, and main control panel.

## 5. User and Permission Management

### 5.1. User Roles

*   **Administrator (admin)**: 
    *   Can view and manage all projects
    *   Can view and manage all users
    *   Can change user roles
    *   Can access all API keys
    *   Can control server start/stop
*   **Regular User (user)**:
    *   Can only view and manage projects they created
    *   Can upload new versions for their own projects
    *   Can manage API keys for their own projects
    *   Cannot view or manage other users' projects
    *   Cannot access user management functionality

### 5.2. User Registration and Login

*   **Registration Process**:
    1. Visit the `/register.html` page
    2. Fill in username, email, and password
    3. System validates information and creates account
    4. New users default to regular user role
*   **Login Process**:
    1. Visit the `/login.html` page
    2. Enter username and password
    3. Upon successful verification, obtain JWT token
    4. Use token to access protected resources

### 5.3. Project Permission Control

*   **Project Creation**: Project creator automatically becomes project owner
*   **Project Access**: Only project owners and administrators can:
    *   View project details
    *   Edit project information
    *   Upload new versions
    *   View and reset API keys
    *   Delete projects
*   **API Keys**: Used for client applications to upload new versions, only viewable and resettable by project owners and administrators

## 6. System Architecture and Components

*   **Core API Service (`server/index.js`)**: Handles client version check (`/api/version/:projectId`), file download (`/download/...`), and (authenticated) version upload (`/api/upload/:projectId`) requests. Default listening port `3000`.
*   **Web Control Panel Service (`server/server-ui.js`)**: Provides a web-based management interface. Responsible for project management, version uploads (by calling the core API or internal logic), API service start/stop control, log viewing, etc. Default listening port `8080`.
*   **Configuration File (`server/config.json`)**: Stores system-level configuration (such as service ports, user accounts) and detailed information for all projects (ID, name, API key, icon, etc.).
*   **Project Data Storage (`server/projects/`)**: Each project has a subdirectory named after its `projectId` in this directory, containing:
    *   `version.json`: Version history and metadata for the project.
    *   `uploads/`: Actual update files uploaded for the project.

## 7. Deployment Guide

### 7.1. Server Environment Preparation
*   **Operating System**: Linux is recommended (such as Ubuntu, CentOS, Debian).
*   **Node.js**: Version 14.x or higher.
    ```bash
    # Check Node.js version
    node -v
    npm -v
    ```
    If not installed, you can install it via `nvm` (Node Version Manager) or system package manager.
*   **Git**: For cloning code.

### 7.2. Deployment Steps

1.  **Clone or Update Code**:
    ```bash
    # If first deployment
    git clone https://github.com/laozig/Update.git
    cd Update
    # If updating existing deployment
    # cd /path/to/your/Update_directory
    # git pull origin main
    ```

2.  **Install Dependencies**: Execute in the project root directory:
    ```bash
    npm install
    ```
    Or, if the project includes `package-lock.json` or `yarn.lock` and you want to exactly replicate dependencies, use `npm ci` or `yarn install --frozen-lockfile`.

3.  **Configure Server (`server/config.json`)**:
    *   If `server/config.json` doesn't exist, copy `server/config.example.json` to `server/config.json`.
    *   **Important**: Open and edit `server/config.json`:
        *   Set `server.serverIp` to your server's public IP address or the domain pointing to the server. This is necessary for clients to build download links.
        *   Modify `server.adminUsername` and `server.adminPassword` to secure administrator credentials.
        *   Configure `server.port` (API service port) and `server.adminPort` (control panel port) as needed.
        *   Define your projects in the `projects` array. Each project should have a unique `id` and strong `apiKey`.
        ```json
        // server/config.json example snippet
        {
          "projects": [
            {
              "id": "myFirstApp",
              "name": "My First Application",
              "description": "An awesome application.",
              "apiKey": "generated-secure-api-key-for-myFirstApp",
              "icon": "icons/default.png"
            }
            // You can add more projects...
          ],
          "server": {
            "serverIp": "YOUR_SERVER_IP_OR_DOMAIN", 
            "port": 3000,
            "adminPort": 8080,
            "adminUsername": "admin",
            "adminPassword": "ChangeThisStrongPassword!"
          }
        }
        ```

4.  **Directory Permissions** (if needed):
    Ensure the user running the Node.js service has write permissions to the `server/projects/` directory, so it can automatically create project subdirectories, `version.json`, and `uploads` folders.

### 7.3. Starting the Service

You need to start two Node.js processes: the API service and the control panel service.

*   **Directly Using Node (development or simple testing)**: (requires two terminals)
    ```bash
    # Terminal 1: Start API service
    node server/index.js
    ```
    ```bash
    # Terminal 2: Start control panel service
    node server/server-ui.js
    ```
*   **Using `package.json` scripts (if defined)**:
    Check the `scripts` section in `package.json`, there might be commands like `start:api` and `start:ui`.
    ```bash
    npm run start-api 
    npm run start-ui
    ```
*   **Using PM2 (recommended for production)**:
    PM2 can manage Node.js processes, providing log management, automatic restart, etc.
    1.  Install PM2 globally (if not already installed):
        ```bash
        npm install pm2 -g
        ```
    2.  Start services using PM2:
        ```bash
        pm2 start server/index.js --name update-api-server
        pm2 start server/server-ui.js --name update-control-panel
        ```
    3.  Set PM2 to start on boot (follow the prompts):
        ```bash
        pm2 startup
        ```
    4.  Save the current PM2 process list:
        ```bash
        pm2 save
        ```
    5.  View PM2 managed processes: `pm2 list`
    6.  View logs: `pm2 logs update-api-server` or `pm2 logs update-control-panel`

### 7.4. Stopping the Service

*   **Directly Using Node**: Press `Ctrl+C` in the corresponding terminal.
*   **Using PM2**:
    ```bash
    pm2 stop update-api-server
    pm2 stop update-control-panel
    # Or pm2 delete update-api-server update-control-panel to remove from PM2 list
    ```

### 7.5. Accessing the Control Panel

*   Open in a browser: `http://<YOUR_SERVER_IP_OR_DOMAIN>:<adminPort>` (e.g., `http://yourserver.com:8080`).
*   Log in using the `adminUsername` and `adminPassword` you set in `server/config.json`.

### 7.6. Nginx Reverse Proxy Configuration

For production environments, it is strongly recommended to use Nginx as a reverse proxy server to provide HTTPS support, enhanced security, and hide internal service ports.

#### 7.6.1. Installing Nginx

```bash
# For Debian/Ubuntu systems
sudo apt update
sudo apt install nginx

# For CentOS/RHEL systems
sudo yum install epel-release
sudo yum install nginx
```

#### 7.6.2. Creating Nginx Configuration

Create a configuration file at `/etc/nginx/conf.d/update-server.conf` or `/etc/nginx/sites-available/update-server.conf`:

```nginx
# Define upstream servers - Internal API Service (server/index.js)
upstream update_api {
    server 127.0.0.1:3000;
    keepalive 64;  # Keep-alive connections
}

# Define upstream servers - Internal Control Panel (server/server-ui.js)
upstream update_admin {
    server 127.0.0.1:8080;
    keepalive 64;  # Keep-alive connections
}

# Cache settings for static resources and uploaded files
proxy_cache_path /var/cache/nginx/update_server levels=1:2 keys_zone=update_cache:10m max_size=1g inactive=60m;
proxy_temp_path /var/cache/nginx/update_temp;

# Basic HTTP server config - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;  # Replace with your actual domain
    
    # Support for ACME validation (Let's Encrypt)
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
    
    # Redirect all to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# Main HTTPS server configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;  # Replace with your actual domain
    
    # SSL certificate configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;      # Replace with your certificate path
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;    # Replace with your key path
    ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;  # Replace with your chain cert path
    
    # SSL optimization settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # HSTS (optional but recommended)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Security-related headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "same-origin" always;
    
    # Root path - Control Panel
    location / {
        proxy_pass http://update_admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering on;
        
        # Client timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API paths - Version checks, updates, etc.
    location /api/ {
        proxy_pass http://update_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache settings for specific API paths
        location /api/version/ {
            proxy_cache update_cache;
            proxy_cache_valid 200 1m;  # Cache valid for 1 minute
            proxy_pass http://update_api;
        }
        
        # No caching for upload API
        location /api/upload/ {
            proxy_pass http://update_api;
            proxy_request_buffering off;  # Disable request buffering for large file uploads
            client_max_body_size 1000m;   # Maximum upload file size allowed
            proxy_connect_timeout 300s;   # Upload timeout settings
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }
    }
    
    # Download path - Static files
    location /download/ {
        proxy_pass http://update_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Download-related configuration
        proxy_cache update_cache;
        proxy_cache_valid 200 1d;  # Cache valid for 1 day
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_lock on;
        expires 30d;  # Client-side caching
        
        # Optimize large file downloads
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Download limits and timeouts
        client_max_body_size 0;    # No download size limit
        proxy_read_timeout 600s;   # Download timeout setting
    }
    
    # Static resources - Icons, etc.
    location ~* \.(ico|jpg|jpeg|png|gif|svg|js|css|html)$ {
        proxy_pass http://update_admin;
        proxy_cache update_cache;
        proxy_cache_valid 200 1d;
        expires 7d;
    }
    
    # Error pages
    error_page 404 /error.html;
    error_page 500 502 503 504 /error.html;
    location = /error.html {
        root /var/www/update-server/server/public;
        internal;
    }
    
    # Access and error logs
    access_log /var/log/nginx/update-access.log combined buffer=64k flush=5m;
    error_log /var/log/nginx/update-error.log warn;
}
```

#### 7.6.3. Deployment Steps

1. **Create the configuration file**:

```bash
# For Debian/Ubuntu
sudo nano /etc/nginx/sites-available/update-server.conf
# Paste the configuration above, replace your-domain.com with your domain

# Enable the configuration
sudo ln -s /etc/nginx/sites-available/update-server.conf /etc/nginx/sites-enabled/
```

```bash
# For CentOS/RHEL
sudo nano /etc/nginx/conf.d/update-server.conf
# Paste the configuration above, replace your-domain.com with your domain
```

2. **Create cache directories**:

```bash
sudo mkdir -p /var/cache/nginx/update_server
sudo mkdir -p /var/cache/nginx/update_temp
sudo chown -R nginx:nginx /var/cache/nginx
```

3. **Configure SSL certificates** (using Let's Encrypt):

```bash
sudo apt install certbot python3-certbot-nginx  # Debian/Ubuntu
# or
sudo yum install certbot python3-certbot-nginx  # CentOS/RHEL

# Create verification directory
sudo mkdir -p /var/www/letsencrypt
sudo chown nginx:nginx /var/www/letsencrypt

# Obtain certificate
sudo certbot certonly --webroot -w /var/www/letsencrypt -d your-domain.com
```

4. **Verify and test the configuration**:

```bash
sudo nginx -t
```

5. **Restart Nginx**:

```bash
sudo systemctl restart nginx
```

#### 7.6.4. Configuration Details

* **Hidden Internal Ports**: The Nginx proxy will hide internal service ports (3000 and 8080), allowing external users to access through standard HTTP (80) and HTTPS (443) ports only.

* **Path Distribution**:
  * `/` - All root path requests forwarded to the control panel service (8080)
  * `/api/` - API requests forwarded to the API service (3000)
  * `/download/` - Download requests forwarded to the API service (3000)

* **Security Enhancements**:
  * HTTPS encrypted communication
  * Modern TLS protocols and cipher suites
  * Security-related HTTP headers
  * Forced HTTPS redirection

* **Performance Optimizations**:
  * Appropriate caching strategies
  * Optimized large file upload and download handling
  * HTTP/2 protocol enabled

#### 7.6.5. Important Notes

* **Domain Setting**: Make sure to replace `your-domain.com` with your actual domain.
* **SSL Certificates**: Adjust certificate paths according to your environment.
* **Firewall**: Ensure your firewall allows incoming traffic on ports 80 and 443.
* **System Configuration**: Modify `client_max_body_size` as needed for your maximum upload file sizes.
* **User Permissions**: Make sure Nginx has permission to access cache directories and log directories.

## 8. Repository Management

### 8.1. Git Version Control

This project uses Git for version control. The following files and directories are configured not to be committed to the Git repository:

#### 8.1.1. Configuration and Sensitive Information
- **`server/config.json`**: Contains server configuration, API keys, and user information, which is sensitive
- **`.env` and `.env.*` files**: Environment variable configurations that may contain keys and passwords
- **Certificate files**: SSL/TLS certificate files such as `.pem`, `.key`, `.cert`, `.crt`, etc.

#### 8.1.2. Project Data
- **`server/projects/*/uploads/*`**: Application files uploaded for each project, which are typically large and should be managed dynamically by the server
- **`server/projects/*/version.json`**: Project version records that should be maintained by the running server rather than version control
- **Application files**: Such as `.exe`, `.zip`, `.dmg`, `.pkg`, `.msi`, `.deb`, `.rpm`, `.appimage`, etc.

#### 8.1.3. Dependencies and Generated Files
- **`node_modules/`**: npm dependency directory, which should be regenerated via `npm install`
- **`package-lock.json`**: npm dependency lock file that may cause conflicts due to environment differences
- **Build output**: Compilation-generated directories such as `dist/`, `build/`, `out/`, etc.

#### 8.1.4. Logs and Temporary Files
- **`logs/` and `*.log` files**: Server runtime logs, including `server.log`
- **Temporary files**: Such as `.temp/`, `.tmp/`, `*.tmp`, etc.
- **Cache files**: Cache directories such as `.cache/`, etc.

#### 8.1.5. Development Environment Files
- **IDE configurations**: Editor-specific configurations such as `.idea/`, `.vscode/`, etc.
- **System files**: Operating system-generated files such as `.DS_Store`, `Thumbs.db`, etc.

### 8.2. Directory Structure Preservation

To ensure the project structure is complete, the following empty directories are preserved in the repository through `.gitkeep` files:

- **`server/projects/*/uploads/`**: Preserved via `!server/projects/*/uploads/.gitkeep`
- **Other empty directories**: Preserved via `!.gitkeep`

### 8.3. First Deployment Notes

When deploying for the first time, the following files need to be created manually:

1. **`server/config.json`**: Copy from `server/config.example.json` and modify
2. **Project directory structure**: The server will automatically create the `server/projects/[projectId]/uploads/` directory

### 8.4. Update Deployment Process

When updating an existing deployment, please note the following:

1. **Backup configuration**: Back up `server/config.json` before updating
2. **Pull updates**: Use `git pull origin main` to get the latest code
3. **Restore configuration**: Restore the backed-up configuration if the configuration file is overwritten
4. **Update dependencies**: Run `npm install` to update dependencies
5. **Restart services**: Restart the API service and control panel service

## 9. Main API Endpoints

(Assuming the API service is running at `http://<serverIp>:<port>`)

*   `GET /api/version/:projectId`:
    *   Description: Get the latest version information for a project.
    *   Parameters: `projectId` - The unique identifier for the project.
    *   Response: JSON object with version information, including `version`, `releaseDate`, `downloadUrl`, `releaseNotes`.
    *   Example Response:
        ```json
        {
          "version": "1.2.0",
          "releaseDate": "2023-04-15T08:30:00.000Z",
          "downloadUrl": "http://yourserver.com:3000/download/myFirstApp/1.2.0",
          "releaseNotes": "Fixed critical bugs and improved performance."
        }
        ```

*   `GET /download/:projectId/latest`:
    *   Description: Download the latest version of a project.
    *   Parameters: `projectId` - The unique identifier for the project.
    *   Response: The actual file download.

*   `GET /download/:projectId/:version`:
    *   Description: Download a specific version of a project.
    *   Parameters: 
        *   `projectId` - The unique identifier for the project.
        *   `version` - The specific version to download.
    *   Response: The actual file download.

*   `POST /api/upload/:projectId`:
    *   Description: Upload a new version for a project. **Requires API key authentication**.
    *   Parameters:
        *   `projectId` - The unique identifier for the project.
        *   `version` - The version number (in request body).
        *   `releaseNotes` - Notes about this release (in request body).
        *   `file` - The file to upload (as form-data).
    *   Headers:
        *   `x-api-key`: The project's API key.
    *   Response: JSON object with upload status and version details.

*   `GET /api/projects`:
    *   Description: (For control panel use) Get a list of all configured projects (without API keys).

## 10. Detailed Documentation

For more in-depth technical details and advanced configuration, please refer to the following documents:

*   **[Deployment Instructions](./deploy-instructions.en.md)**: Comprehensive guide to deploying and maintaining the update server in production environments.
*   **[Multi-Project Design](./multi-project-design.en.md)**: In-depth explanation of how the server is architected to support and isolate management of multiple projects' data and update workflows.

## 11. Directory Structure Overview

```
Update/
├── server/                  # Main server code
│   ├── index.js             # Core API server
│   ├── server-ui.js         # Web control panel server
│   ├── config.json          # Server configuration
│   ├── public/              # Web UI static files
│   │   ├── index.html       # Control panel main page
│   │   └── ...              # Other UI assets
│   └── projects/            # Project data (auto-created)
│       ├── projectId1/      # Data for specific project
│       │   ├── version.json # Version history
│       │   └── uploads/     # Uploaded files
│       └── ...              # Other projects
├── package.json             # Node.js dependencies
├── README.md                # This documentation
└── ...                      # Other project files
```

## 12. Configuration Details

### 12.1. `server/config.json`

This is the core configuration file that controls server behavior and project definitions.

*   **Projects Section** (`projects` array): Each object represents a project with:
    *   `id` (String): Unique identifier for the project, used in API paths.
    *   `name` (String): Display name for the project.
    *   `description` (String): Optional description.
    *   `apiKey` (String): Secret key for authenticating upload requests.
    *   `icon` (String): Path to project icon (relative to `public/`).
    *   `owner` (String): Username of the project owner.

*   **Server Section** (`server` object):
    *   `serverIp` (String): Server's public IP or domain name.
    *   `port` (Number): Port for the API server.
    *   `adminPort` (Number): Port for the control panel.
    *   `adminUsername` (String): Control panel login username.
    *   `adminPassword` (String): Control panel login password. **Be sure to change to a strong password**.

### 12.2. `server/projects/[projectId]/version.json`

Independent version history file for each project, a JSON array with each object representing a version.

*   `version` (String): Version number (e.g., "1.0.0").
*   `releaseDate` (String): ISO date string of when the version was released.
*   `downloadUrl` (String): Full URL to download this version.
*   `releaseNotes` (String): Description of changes in this version.
*   `fileName` (String): Actual filename on disk, including version number.
*   `originalFileName` (String): Original base filename determined at upload, without version number and extension.

## 13. Logging and Monitoring

*   **API Service (`server/index.js`)**: Mainly outputs logs to the standard console (stdout/stderr). If using PM2, PM2 will automatically collect these logs.
*   **Control Panel Service (`server/server-ui.js`)**: Logs operations to `server.log` in the project root directory and also maintains an in-memory log buffer viewable in the control panel UI.
*   **Service Status**: The control panel displays the running status of the core API service (detected by attempting to connect to the API port).

## 14. Security Recommendations

*   **Strong Credentials**: Be sure to set a strong password for the control panel administrator (`server.adminPassword`).
*   **API Keys**: Use unique, strong API keys for each project. The system can generate these automatically.
*   **HTTPS**: For production, consider placing the service behind a reverse proxy (like Nginx) with HTTPS enabled.
*   **Firewall**: Configure your server firewall to only allow necessary ports (3000 for API, 8080 for control panel).
*   **Regular Updates**: Keep Node.js and npm packages updated to patch security vulnerabilities.
*   **Backup**: Regularly backup `server/config.json` and the entire `server/projects/` directory.

## 15. Frequently Asked Questions (FAQ)

*   **Q: Cannot access the control panel?**
    *   A: Check that the control panel service is running and listening on the correct port. Verify firewall settings allow access to the port. Ensure you're using the correct username and password.

*   **Q: API key not working for uploads?**
    *   A: Verify the API key in your request matches exactly with the one in `config.json`. Check that you're including it in the `x-api-key` header.

*   **Q: File uploads failing?**
    *   A: Check file size (limit is 100MB by default). Ensure the project ID in the URL exists in the configuration.

*   **Q: Chinese or special character filenames showing as garbled text?**
    *   A: The latest version includes optimizations for decoding Chinese filenames. If problems persist, ensure you're using the latest code and check how the client is encoding filenames during upload. Clear old garbled files and version entries and try again.

## 16. Contributing

Contributions are welcome through Pull Requests or Issues to help improve this project!

## 17. License

[MIT](LICENSE)