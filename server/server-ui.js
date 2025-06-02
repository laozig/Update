const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const open = require('open');
const multer = require('multer');
const basicAuth = require('express-basic-auth');
const net = require('net');

// 控制面板应用
const app = express();
const uiPort = 8080;
let serverProcess = null;
let serverRunning = false;
let serverLogs = [];
const MAX_LOGS = 1000; // 最大保存日志行数

// 加载系统配置
const configPath = path.join(__dirname, 'config.json');
let config = {
  projects: [],
  server: {
    port: 3000,
    adminPort: 8080,
    adminUsername: 'admin',
    adminPassword: 'admin',
    serverIp: '103.97.179.230'
  }
};

// 加载配置文件
const loadConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(data);
    } else {
      saveConfig();
    }
  } catch (err) {
    console.error('加载配置失败:', err);
    serverLogs.push(`[错误] 加载配置失败: ${err.message}`);
  }
};

// 保存配置文件
const saveConfig = () => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('保存配置失败:', err);
    serverLogs.push(`[错误] 保存配置失败: ${err.message}`);
  }
};

// 日志管理
const addLog = (message) => {
  const timestamp = new Date().toLocaleString();
  const logEntry = `[${timestamp}] ${message}`;
  serverLogs.push(logEntry);
  
  // 保持日志在最大限制内
  if (serverLogs.length > MAX_LOGS) {
    serverLogs = serverLogs.slice(-MAX_LOGS);
  }
  
  // 可选：写入日志文件
  try {
    fs.appendFileSync(path.join(__dirname, '..', 'server.log'), logEntry + '\n');
  } catch (err) {
    console.error('写入日志失败:', err);
  }
};

// 初始化加载配置
loadConfig();
addLog('控制面板服务启动');

// 基本认证配置
app.use(basicAuth({
  users: { [config.server.adminUsername]: config.server.adminPassword },
  challenge: true,
  realm: 'UpdateServerAdminPanel',
}));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId;
    const uploadsDir = path.join(__dirname, 'projects', projectId, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `app-${req.body.version}.exe`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  }
});

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 修改index.html以注入服务器IP
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error('读取index.html失败:', err);
      return res.status(500).send('服务器错误');
    }
    
    // 注入服务器IP地址
    const serverIp = config.server.serverIp || '103.97.179.230';
    const modifiedHtml = data.replace('</head>', 
      `<script>window.serverIp = "${serverIp}";</script></head>`);
    
    res.send(modifiedHtml);
  });
});

// 版本信息管理
const getVersionFilePath = (projectId) => {
  return path.join(__dirname, 'projects', projectId, 'version.json');
};

const loadVersions = (projectId) => {
  try {
    const versionFilePath = getVersionFilePath(projectId);
    if (fs.existsSync(versionFilePath)) {
      const data = fs.readFileSync(versionFilePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error(`加载项目 ${projectId} 的版本信息失败:`, err);
    return [];
  }
};

const saveVersions = (projectId, versions) => {
  try {
    const versionFilePath = getVersionFilePath(projectId);
    fs.writeFileSync(versionFilePath, JSON.stringify(versions, null, 2));
  } catch (err) {
    console.error(`保存项目 ${projectId} 的版本信息失败:`, err);
  }
};

// API路由

// 获取项目列表
app.get('/api/projects', (req, res) => {
  const safeProjects = config.projects.map(({ id, name, description, icon }) => ({
    id, name, description, icon
  }));
  res.json(safeProjects);
});

// 获取单个项目详情
app.get('/api/projects/:projectId', (req, res) => {
  const { projectId } = req.params;
  const project = config.projects.find(p => p.id === projectId);
  
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }

  res.json(project); // 返回完整的项目信息，包括 apiKey
});

// 添加新项目
app.post('/api/projects', (req, res) => {
  const { id, name, description } = req.body;
  
  if (!id || !name) {
    return res.status(400).json({ error: '项目ID和名称是必需的' });
  }

  if (config.projects.some(p => p.id === id)) {
    return res.status(400).json({ error: '项目ID已存在' });
  }

  const newProject = {
    id,
    name,
    description: description || '',
    apiKey: `api-key-${id}-${Date.now()}`,
    icon: 'icons/default.png'
  };

  config.projects.push(newProject);
  saveConfig();

  // 创建项目目录结构
  const projectDir = path.join(__dirname, 'projects', id);
  const uploadsDir = path.join(projectDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  // 初始化空的版本文件
  saveVersions(id, []);

  const safeProject = { ...newProject };
  delete safeProject.apiKey;
  res.json(safeProject);
});

// 编辑项目
app.put('/api/projects/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  const projectIndex = config.projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目不存在' });
  }

  config.projects[projectIndex] = {
    ...config.projects[projectIndex],
    name: name || config.projects[projectIndex].name,
    description: description || config.projects[projectIndex].description
  };

  saveConfig();

  const safeProject = { ...config.projects[projectIndex] };
  delete safeProject.apiKey;
  res.json(safeProject);
});

// 删除项目
app.delete('/api/projects/:projectId', (req, res) => {
  const { projectId } = req.params;

  const projectIndex = config.projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目不存在' });
  }

  // 从配置中移除项目
  config.projects.splice(projectIndex, 1);
  saveConfig();

  // 删除项目目录（可选，取决于是否要保留历史数据）
  // const projectDir = path.join(__dirname, 'projects', projectId);
  // if (fs.existsSync(projectDir)) {
  //   fs.rmdirSync(projectDir, { recursive: true });
  // }

  res.json({ message: '项目已删除' });
});

// 重置项目API密钥
app.post('/api/projects/:projectId/reset-key', (req, res) => {
  const { projectId } = req.params;

  const project = config.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }

  project.apiKey = `api-key-${projectId}-${Date.now()}`;
  saveConfig();

  res.json({ apiKey: project.apiKey });
});

app.get('/status', (req, res) => {
  const client = new net.Socket();
  let responded = false;
  client.setTimeout(500);
  client.connect(config.server.port, '127.0.0.1', () => {
    responded = true;
    client.destroy();
    res.json({ running: true });
  });
  client.on('error', () => {
    if (!responded) {
      responded = true;
      res.json({ running: false });
    }
  });
  client.on('timeout', () => {
    if (!responded) {
      responded = true;
      res.json({ running: false });
    }
    client.destroy();
  });
});

app.get('/logs', (req, res) => {
  res.json({ logs: serverLogs });
});

// 获取项目版本列表
app.get('/api/versions/:projectId', (req, res) => {
  const { projectId } = req.params;
  const versions = loadVersions(projectId);
  res.json({ versions });
});

// 上传新版本
app.post('/api/upload/:projectId', upload.single('file'), (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    const { version, releaseNotes } = req.body;
    if (!version) {
      return res.status(400).json({ error: '缺少版本号' });
    }

    const versions = loadVersions(projectId);
    
    if (versions.some(v => v.version === version)) {
      return res.status(400).json({ error: `版本 ${version} 已存在` });
    }

    const newVersionInfo = {
      version,
      releaseDate: new Date().toISOString(),
      downloadUrl: `/download/${projectId}/${version}`,
      releaseNotes: releaseNotes || `版本 ${version} 更新`,
      fileName: `app-${version}.exe`
    };
    
    versions.push(newVersionInfo);
    versions.sort((a, b) => {
      const verA = a.version.split('.').map(Number);
      const verB = b.version.split('.').map(Number);
      for (let i = 0; i < Math.max(verA.length, verB.length); i++) {
        const numA = verA[i] || 0;
        const numB = verB[i] || 0;
        if (numA !== numB) {
          return numB - numA;
        }
      }
      return 0;
    });
    
    saveVersions(projectId, versions);
    serverLogs.push(`项目 ${projectId} 的新版本 ${version} 已上传: ${newVersionInfo.fileName}`);
    res.json({ message: '版本上传成功', version: newVersionInfo });

  } catch (err) {
    console.error('上传失败:', err);
    serverLogs.push(`上传失败: ${err.message}`);
    res.status(500).json({ error: '上传失败，服务器内部错误' });
  }
});

app.post('/start', (req, res) => {
  if (serverRunning) {
    return res.json({ running: true, message: '服务器已经在运行' });
  }
  try {
    const mainServerScriptPath = path.join(__dirname, 'index.js');
    addLog(`尝试启动更新服务: node ${mainServerScriptPath}`);
    serverProcess = spawn('node', [mainServerScriptPath], { detached: true, stdio: 'pipe' });
    
    serverProcess.stdout.on('data', (data) => {
      const logLine = data.toString().trim();
      if (logLine) {
        addLog(`[更新服务] ${logLine}`);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      const logLine = data.toString().trim();
      if (logLine) {
        addLog(`[错误] ${logLine}`);
      }
    });
    
    serverProcess.on('close', (code) => {
      addLog(`更新服务已停止，退出代码: ${code}`);
      serverRunning = false;
    });

    serverProcess.on('error', (err) => {
      addLog(`更新服务进程错误: ${err.message}`);
      serverRunning = false;
    });
    
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed && serverProcess.exitCode === null) {
        serverRunning = true;
        addLog('✅ 更新服务已成功启动');
        res.json({ running: true });
      } else {
        const failMessage = '❌ 更新服务未能成功启动或立即退出';
        addLog(failMessage);
        serverRunning = false;
        res.status(500).json({ error: failMessage });
      }
    }, 1000);

  } catch (error) {
    const catchMessage = `启动更新服务时发生异常: ${error.message}`;
    addLog(catchMessage);
    res.status(500).json({ error: catchMessage });
  }
});

app.post('/stop', (req, res) => {
  if (!serverRunning || !serverProcess) {
    return res.json({ running: false, message: '更新服务未在运行' });
  }

  try {
    // 尝试优雅地终止进程
    addLog('正在停止更新服务...');
    
    if (process.platform === 'win32') {
      // Windows需要特殊处理
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
      // Linux/Mac
      process.kill(-serverProcess.pid, 'SIGTERM');
    }
    
    // 设置超时，如果进程没有在一定时间内终止，则强制终止
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        try {
          if (process.platform !== 'win32') {
            process.kill(-serverProcess.pid, 'SIGKILL');
          }
        } catch (e) {
          // 忽略错误，可能进程已经终止
        }
      }
    }, 3000);
    
    serverProcess = null;
    serverRunning = false;
    addLog('✅ 更新服务已停止');
    res.json({ running: false });
  } catch (error) {
    const errorMessage = `停止更新服务时发生错误: ${error.message}`;
    addLog(errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// 启动控制面板服务器
app.listen(config.server.adminPort, () => {
  console.log(`控制面板运行在 http://localhost:${config.server.adminPort}`);
  serverLogs.push(`控制面板已启动，端口: ${config.server.adminPort}`);
}); 

function showAlert(type, message) {
  const successAlert = document.getElementById('alertSuccess');
  const errorAlert = document.getElementById('alertError');
  if (type === 'success') {
    successAlert.innerHTML = message.replace(/\n/g, '<br>');
    successAlert.style.display = 'block';
    errorAlert.style.display = 'none';
  } else {
    errorAlert.innerHTML = message.replace(/\n/g, '<br>');
    errorAlert.style.display = 'block';
    successAlert.style.display = 'none';
  }
  setTimeout(() => {
    successAlert.style.display = 'none';
    errorAlert.style.display = 'none';
  }, 5000);
} 