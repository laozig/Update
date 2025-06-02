# Node.js Multi-Project Auto Update Server

[![node-lts](https://img.shields.io/node/v-lts/express.svg?style=flat-square)](https://nodejs.org/en/about/releases/)
[![GitHub last commit](https://img.shields.io/github/last-commit/laozig/Update.svg?style=flat-square)](https://github.com/laozig/Update/commits/main)

**English | [中文](README.md)**

A simple, universal, multi-project application auto-update server based on Node.js and Express.js, equipped with a graphical web control panel for managing projects, versions, uploading update files, and monitoring services.

## 1. Repository and Code Management

*   **Repository Address**: `https://github.com/laozig/Update.git`
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

*   **Multi-Project Support**: Manage updates for multiple different applications করোনাously through project IDs and API keys.
*   **Version Control**: Easily upload and manage different versions of applications, with support for release notes.
*   **Web Control Panel**: Graphical interface for:
    *   Starting/Stopping the core API update service.
    *   Real-time viewing of service status and logs.
    *   Managing projects (CRUD operations).
    *   Uploading new version files for specified projects.
    *   Viewing and resetting project API keys.
*   **API Driven**: Clear API endpoints for client applications to check for updates, download files; and for (protected) admin tools to upload new versions.
*   **Easy to Deploy**: Can run as a standalone Node.js application. PM2 is recommended for production environment management for process daemonization and log management.
*   **Custom Configuration**: Flexibly configure server ports, IP/domain, admin credentials, and specific settings for each project via `server/config.json`.
*   **Filename Encoding Handling**: Optimized filename handling logic to correctly support non-ASCII character filenames, including Chinese.
*   **Log Management**: The control panel service records operation logs to `server.log` and provides log viewing functionality. The main API service outputs logs to the console.

## 3. System Architecture and Components

*   **Core API Service (`server/index.js`)**: Handles client requests for version checks (`/api/version/:projectId`), file downloads (`/download/...`), and (authenticated) version uploads (`/api/upload/:projectId`). Listens on port `3000` by default.
*   **Web Control Panel Service (`server/server-ui.js`)**: Provides a web-based management interface. Responsible for project management, version uploads (by calling the core API or internal logic), API service start/stop control, log viewing, etc. Listens on port `8080` by default.
*   **Configuration File (`server/config.json`)**: Stores system-level configurations (like service ports, admin account) and detailed information for all projects (ID, name, API key, icon, etc.).
*   **Project Data Storage (`server/projects/`)**: Each project has a subdirectory named after its `projectId` under this directory, containing:
    *   `version.json`: Version history and metadata for the project.
    *   `uploads/`: Actual update files uploaded for the project.

## 4. Deployment Guide

### 4.1. Server Environment Preparation
*   **Operating System**: Linux is recommended (e.g., Ubuntu, CentOS, Debian).
*   **Node.js**: Version 14.x or higher.
    ```bash
    # Check Node.js version
    node -v
    npm -v
    ```
    If not installed, it can be installed via `nvm` (Node Version Manager) or the system package manager.
*   **Git**: For cloning the code.

### 4.2. Deployment Steps

1.  **Clone or Update Code**:
    ```bash
    # If deploying for the first time
    git clone https://github.com/laozig/Update.git
    cd Update
    # If updating an existing deployment
    # cd /path/to/your/Update_directory
    # git pull origin main
    ```

2.  **Install Dependencies**: Execute in the project root directory:
    ```bash
    npm install
    ```
    Alternatively, if the project includes `package-lock.json` or `yarn.lock` and you want to accurately reproduce dependencies, use `npm ci` or `yarn install --frozen-lockfile`.

3.  **Configure Server (`server/config.json`)**:
    *   If `server/config.json` does not exist, copy `server/config.example.json` to `server/config.json`.
    *   **Important**: Open and edit `server/config.json`:
        *   Set `server.serverIp` to your server's public IP address or a domain name pointing to the server. This is necessary for clients to construct download links.
        *   Change `server.adminUsername` and `server.adminPassword` to secure admin credentials.
        *   Configure `server.port` (API service port) and `server.adminPort` (control panel port) as needed.
        *   Define your projects in the `projects` array. Each project should have a unique `id` and a strong `apiKey`.
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
            // More projects can be added...
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
    Ensure the user running the Node.js service has write permissions for the `server/projects/` directory to automatically create project subdirectories, `version.json`, and `uploads` folders.

### 4.3. Starting the Services

You need to start two Node.js processes: the API service and the control panel service.

*   **Directly using Node (for development or simple testing)**: (Requires opening two terminals)
    ```bash
    # Terminal 1: Start API service
    node server/index.js
    ```
    ```bash
    # Terminal 2: Start Control Panel service
    node server/server-ui.js
    ```
*   **Using `package.json` scripts (if defined)**:
    Check the `scripts` section in `package.json` for commands like `start:api` and `start:ui`.
    ```bash
    npm run start-api
    npm run start-ui
    ```
*   **Using PM2 (Recommended for Production)**:
    PM2 can manage Node.js processes, providing log management, auto-restart, etc.
    1.  Install PM2 globally (if not already installed):
        ```bash
        npm install pm2 -g
        ```
    2.  Start services with PM2:
        ```bash
        pm2 start server/index.js --name update-api-server
        pm2 start server/server-ui.js --name update-control-panel
        ```
    3.  Set PM2 to start on boot (follow prompts):
        ```bash
        pm2 startup
        ```
    4.  Save the current PM2 process list:
        ```bash
        pm2 save
        ```
    5.  View PM2 managed processes: `pm2 list`
    6.  View logs: `pm2 logs update-api-server` or `pm2 logs update-control-panel`

### 4.4. Stopping the Services

*   **Directly using Node**: Press `Ctrl+C` in the corresponding terminal.
*   **Using PM2**:
    ```bash
    pm2 stop update-api-server
    pm2 stop update-control-panel
    # Or pm2 delete update-api-server update-control-panel to remove from PM2 list
    ```

### 4.5. Accessing the Control Panel

*   Open in browser: `http://<YOUR_SERVER_IP_OR_DOMAIN>:<adminPort>` (e.g., `http://yourserver.com:8080`).
*   Log in using the `adminUsername` and `adminPassword` set in `server/config.json`.

## 5. Main API Endpoints

(Assuming API service runs at `http://<serverIp>:<port>`)

*   `GET /api/version/:projectId`:
    *   Description: Get the latest version information for the specified project.
    *   Example: `http://yourserver.com:3000/api/version/myFirstApp`
*   `GET /download/:projectId/latest`:
    *   Description: Download the latest version file for the specified project.
*   `GET /download/:projectId/:version`:
    *   Description: Download a specific version file for the specified project.
*   `POST /api/upload/:projectId`:
    *   Description: Upload a new version file. **Requires `x-api-key` request header** containing the API key for the respective project.
    *   Request body: `multipart/form-data`, including `file` (the file itself), `version` (version string), `releaseNotes` (optional release notes).
*   `GET /api/projects`:
    *   Description: (Used by control panel) Get a list of all configured projects (without API keys).

## 6. Detailed Documentation

For more in-depth technical details and advanced configurations, please refer to the following documents:

*   **[Deployment Instructions](./deploy-instructions.en.md)**: Detailed server deployment steps, firewall configuration, best practices for using PM2, and reverse proxy (e.g., Nginx) configuration suggestions.
*   **[Multi-Project Design](./multi-project-design.en.md)**: In-depth explanation of how the server is architected to support and isolate data and update processes for multiple projects.

## 7. Directory Structure Overview

```
Update/
├── server/
│   ├── index.js                # Main API update server logic
│   ├── server-ui.js            # Web control panel server logic
│   ├── config.json             # System configuration file (Important!)
│   ├── config.example.json     # Example template for config.json
│   ├── projects/               # Root directory for multi-project data storage
│   │   ├── [projectId]/        # Directory for a single project (e.g., myFirstApp/)
│   │   │   ├── version.json    # Version information file for this project
│   │   │   └── uploads/        # Storage for uploaded update files for this project
│   │   │       └── .gitkeep    # Ensures the empty directory is tracked by git
│   │   └── .gitkeep
│   ├── public/                 # Frontend static files for the control panel (HTML, CSS, JS, icons)
│   └── ...                     # Other server-side auxiliary files
├── .gitignore                  # Git ignore file configuration
├── package.json
├── package-lock.json           # Or yarn.lock
├── README.md                   # This document (Chinese version)
├── README.en.md                # English version of README
├── deploy-instructions.md      # Deployment guide (Chinese)
├── deploy-instructions.en.md   # Deployment guide (English)
├── multi-project-design.md     # Multi-project architecture design (Chinese)
└── multi-project-design.en.md  # Multi-project architecture design (English)
```

## 8. Configuration Details

### 8.1. `server/config.json`

This is the core configuration file that controls server behavior and project definitions.

*   `projects` (Array): List of projects.
    *   `id` (String): Unique identifier for the project. Used in API calls and directory names.
    *   `name` (String): Readable name for the project, displayed in the control panel.
    *   `description` (String, Optional): Project description.
    *   `apiKey` (String): Authentication key for this project's upload API. **Must be kept secret**.
    *   `icon` (String, Optional): Path to the project icon under `server/public/icons/`.
*   `server` (Object): Global server configurations.
    *   `serverIp` (String): Public IP or domain name of the server. **Crucial for generating download links**.
    *   `port` (Number): Port the API service listens on.
    *   `adminPort` (Number): Port the control panel service listens on.
    *   `adminUsername` (String): Control panel login username.
    *   `adminPassword` (String): Control panel login password. **Please change to a strong password**.

### 8.2. `server/projects/[projectId]/version.json`

Version history file for each individual project, a JSON array where each object represents a version.

```json
// Example: server/projects/myFirstApp/version.json
[
  {
    "version": "1.0.1",
    "releaseDate": "2024-07-01T10:00:00.000Z", // ISO 8601 date format
    "downloadUrl": "http://yourserver.com:3000/download/myFirstApp/1.0.1",
    "releaseNotes": "Fixed bug A, optimized performance B.",
    "fileName": "MyApplication_1.0.1.exe",
    "originalFileName": "MyApplication" // Original base name without version and extension
  },
  {
    "version": "1.0.0",
    // ... other fields ...
  }
]
```
*   `version` (String): Version number (e.g., "1.0.0", "2.3.4-beta").
*   `releaseDate` (String): Release date of the version (ISO 8601 format).
*   `downloadUrl` (String): Full URL to download this version file.
*   `releaseNotes` (String, Optional): Release notes for the version.
*   `fileName` (String): Full filename of this version as stored on the server (includes version number and extension).
*   `originalFileName` (String): Original base filename determined at upload, without version number and extension.

## 9. Logging and Monitoring

*   **API Service (`server/index.js`)**: Primarily outputs logs to the standard console (stdout/stderr). If managed by PM2, PM2 will automatically collect these logs.
*   **Control Panel Service (`server/server-ui.js`)**: 
    *   Outputs logs to the console.
    *   Important operational logs (like project creation, version upload, service start/stop) are recorded to `server.log` in the project root directory.
    *   The control panel interface provides a log viewing feature, displaying the content of `server.log`.
*   **Service Status**: The control panel displays the running status of the core API service (detected by attempting to connect to the API port).

## 10. Security Recommendations

*   **Strong Credentials**: Always set a strong password for the control panel admin (`server.adminPassword`).
*   **API Keys**: Generate and use unique, hard-to-guess API keys for each project. Keep them confidential; do not hardcode them into publicly distributed client versions.
*   **HTTPS**: In a production environment, using HTTPS is highly recommended. SSL/TLS termination can be implemented via a reverse proxy like Nginx.
*   **Firewall**: Only open necessary ports (e.g., API service port, control panel port, SSH port).
*   **Regular Updates**: Keep Node.js, npm/yarn, and operating system dependencies updated.
*   **Input Validation**: Server-side code includes some basic validation for input parameters.
*   **Backups**: Regularly back up the `server/config.json` file and the entire `server/projects/` directory.

## 11. Frequently Asked Questions (FAQ)

*   **Q: Cannot access the control panel?**
    *   A: Check if `server/server-ui.js` has started. Verify the `adminPort` in `server/config.json` is correct. Check if the server firewall allows inbound connections on this port. Look for errors in the `server-ui.js` console output or PM2 logs.
*   **Q: File upload fails?**
    *   A: Confirm that the `x-api-key` in the request header correctly provides the API key for the respective project. Check if the uploaded file size exceeds `multer`'s limit (default 100MB, adjustable in code). Check server disk space. Refer to the API service (`server/index.js`) logs for detailed errors.
*   **Q: Download link received by client is invalid?**
    *   A: Ensure `server.serverIp` (and `server.port` if the port is included in the download link) in `server/config.json` is correctly configured, and that the client can access this IP/domain and port from the public internet.
*   **Q: Chinese filenames appear garbled?**
    *   A: The latest version includes decoding optimizations for Chinese filenames. If issues persist, ensure you are using the latest code and check how the client application encodes filenames during upload. Try again after clearing old garbled files and version entries.

## 12. Contributions

Contributions via Pull Requests or Issues to help improve this project are welcome!

## 13. License

[MIT](LICENSE) 