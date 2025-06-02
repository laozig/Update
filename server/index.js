const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 加载系统配置
const configPath = path.join(__dirname, 'config.json');
let config = {
  projects: [],
  server: {
    port: 3000,
    adminPort: 8080,
    adminUsername: 'admin',
    adminPassword: 'admin'
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
  }
};

// 保存配置文件
const saveConfig = () => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('保存配置失败:', err);
  }
};

// API密钥认证
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const projectId = req.params.projectId;
  
  const project = config.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }

  if (project.apiKey && apiKey === project.apiKey) {
    req.project = project; // 将项目信息附加到请求对象
    next();
  } else {
    res.status(401).json({ error: '未授权访问，请提供有效的API密钥' });
  }
};

// CORS 配置
app.use(cors({
  origin: ['http://103.97.179.230', 'http://localhost:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    const version = req.body.version || 'unknown';
    cb(null, `app-${version}.exe`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  }
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

// 初始化加载配置
loadConfig();

// 路由

// 获取项目列表
app.get('/api/projects', (req, res) => {
  // 返回项目列表，但不包含敏感信息如apiKey
  const safeProjects = config.projects.map(({ id, name, description, icon }) => ({
    id, name, description, icon
  }));
  res.json(safeProjects);
});

// 获取最新版本信息 (公开)
app.get('/api/version/:projectId', (req, res) => {
  const { projectId } = req.params;
  const versions = loadVersions(projectId);
  
  if (versions.length === 0) {
    return res.status(404).json({ error: '暂无版本信息' });
  }
  res.json(versions[0]);
});

// 上传新版本 (受API密钥保护)
app.post('/api/upload/:projectId', apiKeyAuth, upload.single('file'), (req, res) => {
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
    
    // 检查版本是否已存在
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
    // 按版本号降序排序
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
    res.json({ message: '版本更新成功', version: newVersionInfo });

  } catch (err) {
    console.error('上传失败:', err);
    res.status(500).json({ error: '上传失败，服务器内部错误' });
  }
});

// 下载最新版本 (公开)
app.get('/download/:projectId/latest', (req, res) => {
  const { projectId } = req.params;
  const versions = loadVersions(projectId);
  
  if (versions.length === 0) {
    return res.status(404).json({ error: '暂无版本可供下载' });
  }
  
  const latestVersion = versions[0];
  const filePath = path.join(__dirname, 'projects', projectId, 'uploads', latestVersion.fileName);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: `文件 ${latestVersion.fileName} 不存在` });
  }
});

// 下载指定版本 (公开)
app.get('/download/:projectId/:version', (req, res) => {
  const { projectId, version } = req.params;
  const versions = loadVersions(projectId);
  const versionInfo = versions.find(v => v.version === version);

  if (!versionInfo) {
    return res.status(404).json({ error: `版本 ${version} 不存在` });
  }

  const filePath = path.join(__dirname, 'projects', projectId, 'uploads', versionInfo.fileName);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: `文件 ${versionInfo.fileName} 不存在` });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('服务器发生错误!');
});

// 启动服务器
app.listen(port, () => {
  console.log(`更新服务器运行在 http://localhost:${port}`);
}); 