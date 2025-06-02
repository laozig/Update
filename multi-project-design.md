# Multi-Project Support Design

This document outlines the design and key implementation details for supporting multiple projects within the Update Server.

## 1. Core Concepts

The primary goal is to allow a single instance of the update server to manage updates for several distinct software applications or projects. Each project has its own set of versions, update files, and access control.

## 2. Key Design Elements

### 2.1. Project Identification
*   **Project ID (`projectId`)**: Each project is uniquely identified by a string `projectId` (e.g., "my-app-v1", "data-processor-tool").
*   This ID is used in API endpoints and for structuring data on the server.

### 2.2. Configuration (`server/config.json`)
*   The central `server/config.json` file contains a `projects` array.
*   Each element in this array is an object representing a project, with at least the following properties:
    *   `id`: The unique `projectId`.
    *   `name`: A human-readable name for the project (e.g., "My Application Version 1").
    *   `description`: An optional description of the project.
    *   `apiKey`: A unique API key specifically for this project. This key is required for operations like uploading new versions.
    *   `icon`: Path to an icon file for the project, displayed in the control panel (e.g., `icons/default.png`).

    ```json
    // Example snippet from config.json
    {
      "projects": [
        {
          "id": "project1",
          "name": "Super Editor App",
          "description": "The best editor for all your needs.",
          "apiKey": "abc123xyz789-project1-key",
          "icon": "icons/project1.png"
        },
        {
          "id": "project2-alpha",
          "name": "Utility Tool (Alpha)",
          "description": "A utility tool currently in alpha testing.",
          "apiKey": "def456uvw012-project2-key",
          "icon": "icons/default.png"
        }
      ],
      // ... server configuration ...
    }
    ```

### 2.3. Data Isolation on Disk
*   Each project's data is stored in a dedicated subdirectory within `server/projects/`.
*   The subdirectory name is the `projectId`.
*   **Update Files**: Uploaded application files for a project are stored in `server/projects/<projectId>/uploads/`.
    *   Example: `server/projects/project1/uploads/Super_Editor_App_1.0.1.exe`
*   **Version Information**: Version history and metadata for each project are stored in a `version.json` file within its respective project directory: `server/projects/<projectId>/version.json`.
    *   Example: `server/projects/project1/version.json`
    *   This `version.json` file contains an array of version objects, each detailing version number, release date, download URL, release notes, filename, etc.

### 2.4. API Endpoints
*   Most API endpoints that deal with project-specific data are parameterized with the `projectId`.
*   **Version Check**: `GET /api/version/:projectId` - Fetches the latest version for the specified project.
*   **Upload New Version**: `POST /api/upload/:projectId` - Uploads a new version file for the specified project. Requires API key authentication.
*   **Download File**: `GET /download/:projectId/:version` and `GET /download/:projectId/latest` - Allows downloading specific or latest version files for a project.
*   The server logic uses the `projectId` from the URL to locate the correct `version.json` file and the appropriate `uploads` directory.

### 2.5. API Key Authentication
*   Operations that modify project data, primarily uploading new versions (`POST /api/upload/:projectId`), are protected by an API key.
*   The client must include the project-specific `apiKey` (defined in `config.json`) in the `x-api-key` header of the HTTP request.
*   The server validates this key against the one stored for the `projectId`.

### 2.6. Control Panel (`server/server-ui.js`)
*   The web-based control panel provides a user interface for managing multiple projects.
*   **Project Listing**: Displays all configured projects.
*   **Project Creation/Editing/Deletion**: Allows administrators to add new projects, modify existing ones (name, description), and delete projects. When a new project is created via the UI:
    *   A new entry is added to the `projects` array in `config.json`.
    *   A unique `apiKey` is automatically generated.
    *   The corresponding directory structure (`server/projects/<new_projectId>/uploads/`) is created.
    *   An empty `version.json` is initialized for the new project.
*   **API Key Management**: Allows viewing and resetting API keys for each project.
*   **Version Management**: For each selected project, the control panel lists existing versions and allows uploading new versions (which internally calls the `POST /api/upload/:projectId` endpoint of the main API server or has its own equivalent upload handler that respects project isolation).

## 3. Workflow Example: Adding and Updating a New Project

1.  **Admin Action (Control Panel)**: Admin navigates to the control panel.
2.  **Admin Action (Control Panel)**: Admin creates a new project named "MyApp" with ID "myapp-v2". The system auto-generates an API key.
    *   `server/config.json` is updated.
    *   `server/projects/myapp-v2/uploads/` is created.
    *   `server/projects/myapp-v2/version.json` is created (empty array).
3.  **Developer Action (Client-Side Upload Tool)**: Developer uses an upload script or tool.
4.  **Developer Action (Client-Side Upload Tool)**: The tool makes a `POST` request to `/api/upload/myapp-v2` with the application file (e.g., `MyApp_1.0.0.exe`), version number "1.0.0", release notes, and the `x-api-key` header containing the API key for "myapp-v2".
5.  **Server Action (`server/index.js`)**: 
    *   Authenticates the API key for `projectId` "myapp-v2".
    *   Saves the uploaded file to `server/projects/myapp-v2/uploads/MyApp_1.0.0.exe` (after filename processing).
    *   Adds a new version entry to `server/projects/myapp-v2/version.json`.
6.  **End User Action (Client Application)**: The "MyApp" client application makes a `GET` request to `/api/version/myapp-v2`.
7.  **Server Action (`server/index.js`)**: Reads `server/projects/myapp-v2/version.json`, finds the latest version, and returns its details (including the download URL for `MyApp_1.0.0.exe`).

## 4. Scalability and Considerations
*   **File Storage**: As the number of projects and versions grows, disk space for the `server/projects/` directory will increase. Ensure adequate storage.
*   **`config.json` Management**: For a very large number of projects, direct editing of `config.json` might become cumbersome. The control panel is the primary way to manage this.
*   **Backup**: Regularly back up the `server/config.json` file and the entire `server/projects/` directory (which contains all uploaded files and version histories).
*   **Performance**: For a high number of concurrent requests, especially downloads, consider load balancing and optimizing file serving (e.g., using a reverse proxy like Nginx to handle downloads directly or serve from a CDN).

This design provides a flexible and isolated way to manage updates for multiple software projects using a single server instance. 