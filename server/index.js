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
  origin: function(origin, callback) {
    const allowedOrigins = [
      `http://${config.server.serverIp || 'update.tangyun.lat'}`,
      `https://${config.server.serverIp || 'update.tangyun.lat'}`,
      'http://localhost:8080',
      'http://localhost:3000'
    ];
    // 允许没有来源的请求（如移动应用）
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不允许的来源'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  credentials: true
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
    // 处理文件名编码
    const decodedFilename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    // 先保存为原始文件名，后面再重命名
    cb(null, decodedFilename);
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
      const versions = JSON.parse(data);
      
      // 只修复downloadUrl，不再检查fileName
      versions.forEach(version => {
        // 修复downloadUrl
        if (!version.downloadUrl.startsWith('http') || version.downloadUrl.includes('undefined')) {
          version.downloadUrl = `http://${config.server.serverIp || 'update.tangyun.lat'}:${config.server.port}/download/${projectId}/${version.version}`;
        }
        
        // 确保有originalFileName字段
        if (!version.originalFileName) {
          version.originalFileName = "update";
        }
      });
      
      return versions;
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
console.log(`服务器配置已加载，域名: ${config.server.serverIp || 'update.tangyun.lat'}`);

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
  
  // 确保返回的downloadUrl包含完整域名和正确的fileName
  const latestVersion = {...versions[0]};
  
  // 修复downloadUrl中的域名
  if (!latestVersion.downloadUrl.startsWith('http') || latestVersion.downloadUrl.includes('undefined')) {
    latestVersion.downloadUrl = `http://update.tangyun.lat:${config.server.port}/download/${projectId}/${latestVersion.version}`;
  }
  
  // 直接使用原始文件名加版本号格式
  const originalFileName = latestVersion.originalFileName || `update`;
  latestVersion.fileName = `${originalFileName}_${latestVersion.version}.exe`;
  
  res.json(latestVersion);
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

    // 获取原始文件名并添加版本号
    const originalFileName = req.file.originalname;
    // 在文件名和扩展名之间插入版本号，使用下划线连接
    const lastDotIndex = originalFileName.lastIndexOf('.');
    let newFileName;
    let originalNameWithoutExt;
    
    if (lastDotIndex !== -1) {
      // 有扩展名的情况
      originalNameWithoutExt = originalFileName.substring(0, lastDotIndex);
      const extension = originalFileName.substring(lastDotIndex);
      newFileName = `${originalNameWithoutExt}_${version}${extension}`;
    } else {
      // 没有扩展名的情况
      originalNameWithoutExt = originalFileName;
      newFileName = `${originalFileName}_${version}`;
    }
    
    // 重命名文件
    const oldPath = req.file.path;
    const newPath = path.join(path.dirname(oldPath), newFileName);
    
    fs.renameSync(oldPath, newPath);

    const newVersionInfo = {
      version,
      releaseDate: new Date().toISOString(),
      downloadUrl: `http://${config.server.serverIp || 'update.tangyun.lat'}:${config.server.port}/download/${projectId}/${version}`,
      releaseNotes: releaseNotes || `版本 ${version} 更新`,
      fileName: newFileName,
      originalFileName: originalNameWithoutExt
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
    console.log(`项目 ${projectId} 上传新版本: ${version}, 文件名: ${newFileName}`);
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
  const uploadsDir = path.join(__dirname, 'projects', projectId, 'uploads');
  
  // 先尝试使用fileName直接查找
  let filePath = path.join(uploadsDir, latestVersion.fileName);
  
  // 如果找不到文件，尝试查找匹配版本号的文件
  if (!fs.existsSync(filePath)) {
    const files = fs.readdirSync(uploadsDir);
    // 查找包含版本号的文件，支持下划线或连字符连接
    const versionFile = files.find(file => 
      file.includes(`_${latestVersion.version}.`) || 
      file.includes(`-${latestVersion.version}.`)
    );
    if (versionFile) {
      filePath = path.join(uploadsDir, versionFile);
    }
  }
  
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

  const uploadsDir = path.join(__dirname, 'projects', projectId, 'uploads');
  
  // 先尝试使用fileName直接查找
  let filePath = path.join(uploadsDir, versionInfo.fileName);
  
  // 如果找不到文件，尝试查找匹配版本号的文件
  if (!fs.existsSync(filePath)) {
    const files = fs.readdirSync(uploadsDir);
    // 查找包含版本号的文件，支持下划线或连字符连接
    const versionFile = files.find(file => 
      file.includes(`_${version}.`) || 
      file.includes(`-${version}.`)
    );
    if (versionFile) {
      filePath = path.join(uploadsDir, versionFile);
    }
  }
  
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
  console.log(`更新服务器运行在 http://${config.server.serverIp || 'update.tangyun.lat'}:${port}`);
}); 