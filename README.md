# Node.js 多项目自动更新服务器

基于 Node.js + Express 的多项目更新分发服务，内置图形化控制面板；支持多用户与项目隔离、API 上传/下载、Nginx 反代、Let's Encrypt 一键证书与自动续签。

仓库：`https://github.com/laozig/Update.git`

## 功能特性

- **多项目隔离**：通过 `projectId` 和 `x-api-key` 实现项目隔离
- **多用户/权限**：支持管理员与普通用户，项目所有权校验
- **版本管理**：上传包自动重命名附加版本号，生成下载链接
- **图形化控制面板**：浏览器管理项目、版本、用户、日志
- **Nginx 一键反代**：交互式生成/启用站点，自动申请 HTTPS 证书
- **Let's Encrypt**：一键申请证书并自动配置续签
- **大文件支持**：可配置上传上限（支持 `1g`/`500m` 等）

## 快速开始

### 一键安装（Linux/macOS/WSL）

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/laozig/Update/main/scripts/bootstrap.sh)
```

说明：默认只下载与准备，不自动启动。首启请手动进入目录并执行：

```bash
cd <INSTALL_DIR>   # 默认 $HOME/Update
./manage.sh install   # 或 ./manage.sh 显示菜单后选择"安装部署"
```

可选环境变量：`INSTALL_DIR` `SERVER_NAME` `MAX_UPLOAD_SIZE`（若要自动启动可设 `AUTO_DEPLOY=yes`）

### Windows

```bat
git clone https://github.com/laozig/Update.git
cd Update
manage.bat          :: 显示交互式菜单
manage.bat install  :: 安装依赖并启动
```

常用命令：`manage.bat start|pause|restart|status|update|nginx`

若提示未找到 Bash/WSL，请安装 Git Bash 或启用 WSL

### Linux/macOS

```bash
git clone https://github.com/laozig/Update.git
cd Update
./manage.sh          # 无参数：显示交互式菜单
```

常用命令：`./manage.sh start|pause|restart|status|update|nginx`

## 环境变量（推荐）

- `BASE_URL`：对外地址（如 `https://updates.example.com`）；未设时按请求自动推断
- `JWT_SECRET`：JWT 密钥（强随机值）
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`：首启创建固定管理员（未提供则自动生成随机管理员并写入 `server/first-run-admin.txt`）
- `MAX_UPLOAD_SIZE`：上传大小上限（如 `1gb`、`500mb`，默认 100MB）

## 一键脚本命令

- **服务管理**：`install`（安装部署） `start`（启动服务） `pause`（暂停服务） `restart`（重启服务） `status`（服务状态） `update`（检查更新）
- **Nginx**：`nginx`（交互式向导，自动申请证书）
- **帮助**：`help` 查看详细命令说明

## Nginx 与证书（一键）

```bash
sudo ./manage.sh nginx
# 交互式向导：输入域名、最大上传大小，自动申请 Let's Encrypt 证书并配置续签
# 自动写入 Nginx 配置并开启 HTTPS (443)
# 自动写入 cron：每天 3:00 续签并重载 Nginx
```

## 首次启动与安全

- **首次无用户**：自动生成 `admin-xxxxxx` 与 16 位强密码，写入 `server/first-run-admin.txt`（仅一次性提示），`config.json` 中存储 bcrypt 哈希
- **环境变量预置**：通过环境变量预置管理员：`ADMIN_USERNAME` + `ADMIN_PASSWORD`
- **生产环境**：设置强随机 `JWT_SECRET`，务必启用 HTTPS

## 核心 API

- `GET /api/version/:projectId` - 获取最新版本（公开）
- `GET /download/:projectId/latest` - 下载最新版本
- `GET /download/:projectId/:version` - 下载指定版本
- `POST /api/upload/:projectId` - 上传版本（需 `x-api-key`）；表单字段：`file`、`version`、`releaseNotes?`

## 客户端集成示例

### C# 客户端

```csharp
using System;
using System.Net.Http;
using System.Text.Json;

// 检查更新
public async Task<VersionInfo> CheckUpdateAsync(string baseUrl, string projectId)
{
    var client = new HttpClient();
    var response = await client.GetAsync($"{baseUrl}/api/version/{projectId}");
    var json = await response.Content.ReadAsStringAsync();
    return JsonSerializer.Deserialize<VersionInfo>(json);
}

// 下载最新版本
public async Task DownloadLatestAsync(string baseUrl, string projectId, string savePath)
{
    var client = new HttpClient();
    var stream = await client.GetStreamAsync($"{baseUrl}/download/{projectId}/latest");
    using (var fileStream = File.Create(savePath))
    {
        await stream.CopyToAsync(fileStream);
    }
}

// 版本信息类
public class VersionInfo
{
    public string version { get; set; }
    public string downloadUrl { get; set; }
    public string releaseNotes { get; set; }
    public string releaseDate { get; set; }
}
```

### Python 客户端

```python
import requests
from typing import Optional, Dict

def check_update(base_url: str, project_id: str) -> Optional[Dict]:
    """检查是否有新版本"""
    response = requests.get(f"{base_url}/api/version/{project_id}")
    if response.status_code == 200:
        return response.json()
    return None

def download_latest(base_url: str, project_id: str, save_path: str):
    """下载最新版本"""
    url = f"{base_url}/download/{project_id}/latest"
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    with open(save_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

# 使用示例
if __name__ == "__main__":
    base_url = "https://updates.example.com"
    project_id = "myApp"
    
    # 检查更新
    latest = check_update(base_url, project_id)
    current_version = "1.0.0"
    
    if latest and latest['version'] != current_version:
        print(f"发现新版本: {latest['version']}")
        print(f"更新说明: {latest.get('releaseNotes', '无')}")
        download_latest(base_url, project_id, "update.zip")
```

### Node.js 客户端

```javascript
const https = require('https');
const fs = require('fs');

// 检查更新
async function checkUpdate(baseUrl, projectId) {
  return new Promise((resolve, reject) => {
    https.get(`${baseUrl}/api/version/${projectId}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 下载文件
function downloadFile(url, savePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(savePath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(savePath, () => {});
      reject(err);
    });
  });
}

// 使用示例
(async () => {
  const baseUrl = 'https://updates.example.com';
  const projectId = 'myApp';
  
  const latest = await checkUpdate(baseUrl, projectId);
  console.log('最新版本:', latest.version);
  
  await downloadFile(
    `${baseUrl}/download/${projectId}/latest`,
    'update.zip'
  );
  console.log('下载完成');
})();
```

### CI/CD 集成（GitHub Actions）

```yaml
name: Auto Update

on:
  release:
    types: [published]

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: 构建应用
        run: |
          # 你的构建命令
          npm run build
          zip -r app.zip dist/
      
      - name: 上传到更新服务器
        run: |
          VERSION=$(git describe --tags)
          curl -X POST \
            -H "x-api-key: ${{ secrets.UPDATE_API_KEY }}" \
            -F "file=@app.zip" \
            -F "version=$VERSION" \
            -F "releaseNotes=$(cat CHANGELOG.md)" \
            https://updates.example.com/api/upload/myProject
```

### PowerShell 客户端

```powershell
# 检查更新
function Check-Update {
    param(
        [string]$BaseUrl,
        [string]$ProjectId
    )
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/version/$ProjectId"
    return $response
}

# 下载最新版本
function Download-Latest {
    param(
        [string]$BaseUrl,
        [string]$ProjectId,
        [string]$SavePath
    )
    
    $url = "$BaseUrl/download/$ProjectId/latest"
    Invoke-WebRequest -Uri $url -OutFile $SavePath
}

# 使用示例
$baseUrl = "https://updates.example.com"
$projectId = "myApp"

$latest = Check-Update -BaseUrl $baseUrl -ProjectId $projectId
Write-Host "最新版本: $($latest.version)"

Download-Latest -BaseUrl $baseUrl -ProjectId $projectId -SavePath "update.zip"
```

## 生产环境最佳实践

### 安全配置

```bash
# 1. 设置强随机 JWT_SECRET
export JWT_SECRET=$(openssl rand -base64 32)

# 2. 预置管理员账号（避免首次启动生成随机密码）
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=$(openssl rand -base64 16)

# 3. 设置固定的对外地址
export BASE_URL=https://updates.example.com

# 4. 限制上传大小（根据需要调整）
export MAX_UPLOAD_SIZE=1gb
```

### 使用 PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务（自动保存进程列表）
pm2 start server/index.js --name update-api-server
pm2 start server/server-ui.js --name update-control-panel

# 设置开机自启
pm2 startup
pm2 save

# 监控日志
pm2 logs

# 查看状态
pm2 status
```

### Nginx 配置要点

- **HTTPS 强制**：所有 HTTP 请求重定向到 HTTPS
- **客户端真实 IP**：正确传递 `X-Forwarded-For` 和 `X-Real-IP` 头
- **大文件上传**：设置 `client_max_body_size` 匹配 `MAX_UPLOAD_SIZE`
- **超时配置**：根据文件大小调整 `proxy_read_timeout` 和 `proxy_send_timeout`
- **缓存策略**：对 `/download/` 路径启用缓存，减少服务器负载

### 监控与日志

- **日志轮转**：自动轮转 `api-server.log` 和 `ui-server.log`（10MB/文件，保留5个）
- **下载记录**：所有下载操作记录到日志，包含 IP、User-Agent 等信息
- **实时监控**：控制面板提供实时日志查看功能
- **进程监控**：使用 PM2 或 systemd 监控服务状态，自动重启

## 常见使用场景

### 场景 1：Windows 桌面应用更新

```csharp
// 检查更新并提示用户
var latest = await CheckUpdateAsync("https://updates.example.com", "myApp");
if (latest.version != CurrentVersion)
{
    var result = MessageBox.Show(
        $"发现新版本 {latest.version}\n\n{latest.releaseNotes}\n\n是否立即更新？",
        "更新提示",
        MessageBoxButtons.YesNo
    );
    if (result == DialogResult.Yes)
    {
        await DownloadLatestAsync("https://updates.example.com", "myApp", "update.exe");
        Process.Start("update.exe");
        Application.Exit();
    }
}
```

### 场景 2：命令行工具自动更新

```bash
#!/bin/bash
BASE_URL="https://updates.example.com"
PROJECT_ID="myCLITool"
CURRENT_VERSION="1.0.0"

# 检查更新
LATEST=$(curl -s "${BASE_URL}/api/version/${PROJECT_ID}")
NEW_VERSION=$(echo $LATEST | jq -r '.version')

if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
    echo "发现新版本: $NEW_VERSION"
    curl -o update.tar.gz "${BASE_URL}/download/${PROJECT_ID}/latest"
    tar -xzf update.tar.gz
    echo "更新完成，请重启工具"
fi
```

### 场景 3：多平台应用分发

为同一个应用的不同平台创建多个项目：

```
- myApp-windows (Windows 安装包)
- myApp-macos (macOS DMG)
- myApp-linux (Linux AppImage)
```

客户端根据平台请求对应项目的版本信息。

## 性能优化建议

1. **CDN 集成**：将 `/download/` 路径配置 CDN，加速文件分发
2. **Nginx 缓存**：对下载路径启用缓存，减少 API 服务器负载
3. **并发限制**：使用 Nginx 的 `limit_conn` 限制单 IP 并发连接数
4. **压缩传输**：Nginx 启用 `gzip` 压缩（对 JSON API 响应）
5. **负载均衡**：多台服务器时，使用 Nginx upstream 做负载均衡

## 目录结构

```
Update/
├── server/ 
│   ├── index.js          # API 服务器
│   ├── server-ui.js      # 控制面板服务器
│   ├── config.json       # 运行期生成/维护
│   └── projects/         # 每项目的 version.json 与 uploads/
├── manage.sh             # 核心一键脚本（Linux/macOS/WSL）
├── manage.bat            # Windows 入口（调用 manage.sh）
├── package.json
└── README.md
```

## 常见问题（FAQ）

- **上传超过限制？** 设置 `MAX_UPLOAD_SIZE=1gb`，并在 Nginx 中匹配 `client_max_body_size`
- **首次登录账号？** 未配置 `ADMIN_PASSWORD` 时，查看 `server/first-run-admin.txt`
- **下载链接不正确？** 设置 `BASE_URL=https://你的域名`，并确保反向代理传递 `X-Forwarded-*` 头
- **Windows 脚本？** 用 `manage.bat <命令>`，需要 Git Bash 或 WSL

## 详细文档

有关更深入的技术细节和高级配置，请参阅：

- **[部署说明](./deploy-instructions.md)**：详细的服务器部署步骤、防火墙配置、使用 PM2 的最佳实践以及反向代理配置建议
- **[多项目设计](./multi-project-design.md)**：深入解释服务器如何架构以支持和隔离管理多个项目的数据和更新流程

## 许可证

MIT
