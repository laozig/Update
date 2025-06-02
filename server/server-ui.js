const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const open = require('open');
const multer = require('multer');

// 控制面板应用
const app = express();
const uiPort = 8080;
let serverProcess = null;
let serverRunning = false;
let serverLogs = [];

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    // 使用app-{version}.exe格式保存文件
    cb(null, `app-${req.body.version}.exe`);
  }
});
const upload = multer({ storage });

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建public目录和必要的文件
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// 创建uploads目录（如果不存在）
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// 创建控制面板HTML
const htmlContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>更新服务器控制面板</title>
  <style>
    body {
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
      margin-top: 0;
    }
    .control-panel {
      display: flex;
      margin-bottom: 20px;
      align-items: center;
    }
    .status {
      margin-left: 20px;
      padding: 5px 10px;
      border-radius: 3px;
      font-weight: bold;
    }
    .status.running {
      background-color: #d4edda;
      color: #155724;
    }
    .status.stopped {
      background-color: #f8d7da;
      color: #721c24;
    }
    button {
      background-color: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: #0069d9;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    button.stop {
      background-color: #dc3545;
    }
    button.stop:hover {
      background-color: #c82333;
    }
    .log-container {
      background-color: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      height: 300px;
      overflow-y: auto;
      font-family: Consolas, monospace;
      font-size: 13px;
    }
    .log-line {
      margin: 0;
      padding: 2px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-panel {
      margin-top: 20px;
      padding: 15px;
      background-color: #e9ecef;
      border-radius: 4px;
    }
    .info-panel h3 {
      margin-top: 0;
    }
    .info-panel p {
      margin-bottom: 5px;
    }
    .api-url {
      font-family: Consolas, monospace;
      background-color: #f8f9fa;
      padding: 2px 4px;
      border-radius: 3px;
      border: 1px solid #ddd;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid #ddd;
      margin-bottom: 15px;
    }
    .tab {
      padding: 10px 15px;
      cursor: pointer;
      border: 1px solid transparent;
      border-bottom: none;
      margin-bottom: -1px;
      background-color: transparent;
      color: #007bff;
    }
    .tab.active {
      border-color: #ddd;
      border-radius: 4px 4px 0 0;
      background-color: white;
      color: #333;
      font-weight: bold;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="text"], textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    textarea {
      height: 100px;
      resize: vertical;
    }
    .version-list {
      margin-top: 20px;
    }
    .version-item {
      padding: 10px;
      background-color: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .version-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
    }
    .version-date {
      color: #666;
      font-size: 0.9em;
    }
    .version-notes {
      margin-top: 5px;
      color: #555;
    }
    .alert {
      padding: 10px 15px;
      border-radius: 4px;
      margin-bottom: 15px;
      display: none;
    }
    .alert-success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .alert-danger {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>更新服务器控制面板</h1>
    
    <div class="tabs">
      <div class="tab active" onclick="switchTab('control')">服务器控制</div>
      <div class="tab" onclick="switchTab('upload')">上传新版本</div>
      <div class="tab" onclick="switchTab('versions')">版本管理</div>
    </div>
    
    <div id="alertSuccess" class="alert alert-success"></div>
    <div id="alertError" class="alert alert-danger"></div>
    
    <div id="controlTab" class="tab-content active">
      <div class="control-panel">
        <button id="startBtn" onclick="startServer()">启动服务器</button>
        <button id="stopBtn" class="stop" onclick="stopServer()" disabled>停止服务器</button>
        <div id="status" class="status stopped">已停止</div>
      </div>
      
      <h3>服务器日志</h3>
      <div id="logs" class="log-container"></div>
      
      <div class="info-panel">
        <h3>服务器信息</h3>
        <p>状态: <span id="serverStatus">已停止</span></p>
        <p>端口: <span id="serverPort">3000</span></p>
        <p>版本API: <span class="api-url">http://localhost:3000/api/version</span></p>
        <p>下载API: <span class="api-url">http://localhost:3000/download/latest</span></p>
      </div>
    </div>
    
    <div id="uploadTab" class="tab-content">
      <h3>上传新版本</h3>
      <form id="uploadForm" enctype="multipart/form-data">
        <div class="form-group">
          <label for="version">版本号:</label>
          <input type="text" id="version" name="version" placeholder="例如: 1.0.0" required>
        </div>
        <div class="form-group">
          <label for="releaseNotes">版本说明:</label>
          <textarea id="releaseNotes" name="releaseNotes" placeholder="描述此版本的更新内容..."></textarea>
        </div>
        <div class="form-group">
          <label for="file">应用程序文件:</label>
          <input type="file" id="file" name="file" accept=".exe" required>
        </div>
        <button type="button" onclick="uploadVersion()">上传版本</button>
      </form>
    </div>
    
    <div id="versionsTab" class="tab-content">
      <h3>已发布版本</h3>
      <div id="versionsList" class="version-list">
        <p>加载中...</p>
      </div>
    </div>
  </div>

  <script>
    let serverRunning = false;
    
    // 页面加载时检查服务器状态
    window.onload = function() {
      checkServerStatus();
      fetchLogs();
    };
    
    // 切换标签页
    function switchTab(tabId) {
      // 隐藏所有标签内容
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // 取消选中所有标签
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // 显示选中的标签内容
      document.getElementById(tabId + 'Tab').classList.add('active');
      
      // 选中当前标签
      document.querySelectorAll('.tab').forEach(tab => {
        if (tab.textContent.toLowerCase().includes(tabId)) {
          tab.classList.add('active');
        }
      });
      
      // 如果切换到版本管理标签，加载版本列表
      if (tabId === 'versions') {
        fetchVersions();
      }
    }
    
    // 检查服务器状态
    function checkServerStatus() {
      fetch('/status')
        .then(response => response.json())
        .then(data => {
          updateStatus(data.running);
        })
        .catch(err => console.error('Error checking status:', err));
    }
    
    // 获取日志
    function fetchLogs() {
      fetch('/logs')
        .then(response => response.json())
        .then(data => {
          const logsContainer = document.getElementById('logs');
          logsContainer.innerHTML = '';
          
          data.logs.forEach(log => {
            const logLine = document.createElement('p');
            logLine.className = 'log-line';
            logLine.textContent = log;
            logsContainer.appendChild(logLine);
          });
          
          // 滚动到底部
          logsContainer.scrollTop = logsContainer.scrollHeight;
        })
        .catch(err => console.error('Error fetching logs:', err));
    }
    
    // 更新状态显示
    function updateStatus(isRunning) {
      serverRunning = isRunning;
      const statusEl = document.getElementById('status');
      const serverStatusEl = document.getElementById('serverStatus');
      const startBtn = document.getElementById('startBtn');
      const stopBtn = document.getElementById('stopBtn');
      
      if (isRunning) {
        statusEl.textContent = '运行中';
        statusEl.className = 'status running';
        serverStatusEl.textContent = '运行中';
        startBtn.disabled = true;
        stopBtn.disabled = false;
      } else {
        statusEl.textContent = '已停止';
        statusEl.className = 'status stopped';
        serverStatusEl.textContent = '已停止';
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    }
    
    // 启动服务器
    function startServer() {
      fetch('/start', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          updateStatus(data.running);
          // 定期获取日志
          setTimeout(fetchLogs, 1000);
        })
        .catch(err => console.error('Error starting server:', err));
    }
    
    // 停止服务器
    function stopServer() {
      fetch('/stop', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          updateStatus(data.running);
          setTimeout(fetchLogs, 1000);
        })
        .catch(err => console.error('Error stopping server:', err));
    }
    
    // 上传新版本
    function uploadVersion() {
      const form = document.getElementById('uploadForm');
      const formData = new FormData(form);
      
      // 检查表单数据
      const version = formData.get('version');
      const file = formData.get('file');
      
      if (!version) {
        showAlert('error', '请输入版本号');
        return;
      }
      
      if (!file || file.size === 0) {
        showAlert('error', '请选择应用程序文件');
        return;
      }
      
      fetch('/upload', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          showAlert('error', data.error);
        } else {
          showAlert('success', '版本上传成功！');
          form.reset();
          // 如果在版本管理标签页，刷新版本列表
          if (document.getElementById('versionsTab').classList.contains('active')) {
            fetchVersions();
          }
        }
      })
      .catch(err => {
        console.error('Error uploading version:', err);
        showAlert('error', '上传失败，请检查服务器是否运行');
      });
    }
    
    // 获取版本列表
    function fetchVersions() {
      fetch('/versions')
        .then(response => response.json())
        .then(data => {
          const versionsContainer = document.getElementById('versionsList');
          
          if (!data.versions || data.versions.length === 0) {
            versionsContainer.innerHTML = '<p>暂无版本记录</p>';
            return;
          }
          
          versionsContainer.innerHTML = '';
          
          data.versions.forEach(version => {
            const versionItem = document.createElement('div');
            versionItem.className = 'version-item';
            
            const versionHeader = document.createElement('div');
            versionHeader.className = 'version-header';
            
            const versionTitle = document.createElement('div');
            versionTitle.textContent = '版本 ' + version.version;
            
            const versionDate = document.createElement('div');
            versionDate.className = 'version-date';
            versionDate.textContent = new Date(version.releaseDate).toLocaleString();
            
            versionHeader.appendChild(versionTitle);
            versionHeader.appendChild(versionDate);
            
            const versionNotes = document.createElement('div');
            versionNotes.className = 'version-notes';
            versionNotes.textContent = version.releaseNotes;
            
            versionItem.appendChild(versionHeader);
            versionItem.appendChild(versionNotes);
            versionsContainer.appendChild(versionItem);
          });
        })
        .catch(err => {
          console.error('Error fetching versions:', err);
          document.getElementById('versionsList').innerHTML = '<p>获取版本信息失败</p>';
        });
    }
    
    // 显示提示信息
    function showAlert(type, message) {
      const successAlert = document.getElementById('alertSuccess');
      const errorAlert = document.getElementById('alertError');
      
      if (type === 'success') {
        successAlert.textContent = message;
        successAlert.style.display = 'block';
        errorAlert.style.display = 'none';
      } else {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        successAlert.style.display = 'none';
      }
      
      // 5秒后隐藏提示
      setTimeout(() => {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
      }, 5000);
    }
    
    // 定期刷新日志和状态
    setInterval(fetchLogs, 3000);
    setInterval(checkServerStatus, 5000);
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent);

// 加载版本信息
let versionInfo = {
  version: '1.0.0',
  releaseDate: new Date().toISOString(),
  downloadUrl: '/download/latest',
  releaseNotes: '初始版本'
};

// 从文件加载版本信息
const loadVersionInfo = () => {
  try {
    const versionPath = path.join(__dirname, 'version.json');
    if (fs.existsSync(versionPath)) {
      const data = fs.readFileSync(versionPath, 'utf8');
      versionInfo = JSON.parse(data);
    } else {
      // 保存默认版本信息
      saveVersionInfo();
    }
  } catch (err) {
    console.log('加载版本信息失败:', err);
  }
};

// 保存版本信息到文件
const saveVersionInfo = () => {
  try {
    fs.writeFileSync(
      path.join(__dirname, 'version.json'),
      JSON.stringify(versionInfo, null, 2)
    );
  } catch (err) {
    console.log('保存版本信息失败:', err);
  }
};

// 初始化加载版本信息
loadVersionInfo();

// API路由
app.get('/status', (req, res) => {
  res.json({ running: serverRunning });
});

app.get('/logs', (req, res) => {
  res.json({ logs: serverLogs });
});

// 获取版本列表
app.get('/versions', (req, res) => {
  try {
    // 如果有多个版本，这里应该从数据库或文件系统读取
    // 目前只返回当前版本
    res.json({ versions: [versionInfo] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 上传新版本
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    const { version, releaseNotes } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: '缺少版本号' });
    }
    
    // 更新版本信息
    versionInfo = {
      version,
      releaseDate: new Date().toISOString(),
      downloadUrl: `/download/${version}`,
      releaseNotes: releaseNotes || `版本 ${version} 更新`
    };
    
    // 保存版本信息
    saveVersionInfo();
    
    // 添加日志
    serverLogs.push(`新版本 ${version} 已上传`);
    
    res.json({ 
      message: '版本更新成功',
      version: versionInfo
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/start', (req, res) => {
  if (!serverRunning) {
    try {
      serverProcess = spawn('node', [path.join(__dirname, 'index.js')]);
      
      serverProcess.stdout.on('data', (data) => {
        const logLine = data.toString().trim();
        serverLogs.push(logLine);
        if (serverLogs.length > 100) serverLogs.shift();
      });
      
      serverProcess.stderr.on('data', (data) => {
        const logLine = `错误: ${data.toString().trim()}`;
        serverLogs.push(logLine);
        if (serverLogs.length > 100) serverLogs.shift();
      });
      
      serverProcess.on('close', (code) => {
        serverLogs.push(`服务器已停止，退出代码: ${code}`);
        serverRunning = false;
      });
      
      serverRunning = true;
      serverLogs.push('服务器已启动');
      res.json({ running: true });
    } catch (error) {
      serverLogs.push(`启动失败: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.json({ running: true, message: '服务器已经在运行' });
  }
});

app.post('/stop', (req, res) => {
  if (serverRunning && serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverRunning = false;
    serverLogs.push('服务器已停止');
    res.json({ running: false });
  } else {
    res.json({ running: false, message: '服务器已经停止' });
  }
});

// 启动控制面板
app.listen(uiPort, () => {
  console.log(`控制面板运行在 http://localhost:${uiPort}`);
  // 自动打开浏览器
  open(`http://localhost:${uiPort}`);
}); 