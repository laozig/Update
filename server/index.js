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
    const originalNameFromRequest = file.originalname;
    // console.log(`Multer Filename - Received originalname: "${originalNameFromRequest}"`);

    let nameAfterUriDecode = originalNameFromRequest;
    try {
      nameAfterUriDecode = decodeURIComponent(originalNameFromRequest);
      // console.log(`Multer Filename - Stage 1 (decodeURIComponent) result: "${nameAfterUriDecode}"`);
    } catch (e) {
      // console.warn(`Multer Filename - Stage 1 (decodeURIComponent) FAILED for "${originalNameFromRequest}", Error: ${e.message}. Proceeding with original value for Stage 2.`);
    }

    let nameAfterMojibakeFix = Buffer.from(nameAfterUriDecode, 'latin1').toString('utf8');
    // console.log(`Multer Filename - Stage 2 (Buffer.from(latin1).toString(utf8)) on "${nameAfterUriDecode}" result: "${nameAfterMojibakeFix}"`);

    if (nameAfterMojibakeFix.includes('') && !nameAfterUriDecode.includes('')) {
      // console.warn(`Multer Filename - Stage 2 conversion of "${nameAfterUriDecode}" to "${nameAfterMojibakeFix}" resulted in replacement characters (''). Reverting to Stage 1 result: "${nameAfterUriDecode}"`);
      nameAfterMojibakeFix = nameAfterUriDecode; 
    }
    
    // console.log(`Multer Filename - Final filename for multer: "${nameAfterMojibakeFix}"`);
    cb(null, nameAfterMojibakeFix); 
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
      
      versions.forEach(version => {
        // 修复旧数据中可能不完整的downloadUrl
        if (!version.downloadUrl.startsWith('http') || version.downloadUrl.includes('undefined')) {
          version.downloadUrl = `http://${config.server.serverIp || 'update.tangyun.lat'}:${config.server.port}/download/${projectId}/${version.version}`;
        }
        
        // 向后兼容：如果旧数据没有 originalFileName，尝试从当前 fileName 推断
        // (假设fileName格式为 originalName_version.ext)
        if (!version.originalFileName && version.fileName) {
            const versionSuffix = `_${version.version}`;
            const indexOfVersionSuffix = version.fileName.lastIndexOf(versionSuffix);
            
            if (indexOfVersionSuffix !== -1) {
                // 提取版本号之前的部分作为 originalFileName
                version.originalFileName = version.fileName.substring(0, indexOfVersionSuffix);
            } else {
                 // 如果无法从fileName中按预期格式推断，则使用一个默认值或记录警告
                 console.warn(`LoadVersions - Could not infer originalFileName for ${projectId} version ${version.version} from fileName ${version.fileName}. Using default.`);
                 version.originalFileName = "update"; 
            }
        } else if (!version.originalFileName) {
            // 如果字段完全不存在，也使用默认值
            console.warn(`LoadVersions - originalFileName missing for ${projectId} version ${version.version}. Using default.`);
            version.originalFileName = "update"; 
        }
      });
            
      return versions;
    }
    return [];
  } catch (err) {
    console.error(`LoadVersions - Error loading versions for project ${projectId}:`, err);
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
  const versions = loadVersions(projectId); // loadVersions 现在处理了 originalFileName 的兼容性和 downloadUrl
  
  if (versions.length === 0) {
    return res.status(404).json({ error: '暂无版本信息' });
  }
  
  const latestVersion = {...versions[0]};
  // downloadUrl 和 fileName 都应该从 loadVersions 中正确获取，依赖于上传时保存的正确数据
  
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
    
    if (versions.some(v => v.version === version)) {
      return res.status(400).json({ error: `版本 ${version} 已存在` });
    }

    const baseFileNameForVersioning = req.file.filename; 
    // console.log(`Upload Route - Base Filename from req.file.filename (used for versioning): "${baseFileNameForVersioning}"`);

    const lastDotIndex = baseFileNameForVersioning.lastIndexOf('.');
    let newFileName;
    let originalNameWithoutExt;
    
    if (lastDotIndex !== -1) {
      originalNameWithoutExt = baseFileNameForVersioning.substring(0, lastDotIndex);
      const extension = baseFileNameForVersioning.substring(lastDotIndex);
      newFileName = `${originalNameWithoutExt}_${version}${extension}`;
    } else {
      originalNameWithoutExt = baseFileNameForVersioning;
      newFileName = `${baseFileNameForVersioning}_${version}`;
    }
    
    // console.log(`Upload Route - Constructed Original Name Without Ext: "${originalNameWithoutExt}"`);
    // console.log(`Upload Route - Constructed New Filename with Version: "${newFileName}"`);

    const oldPath = req.file.path; 
    const newPath = path.join(path.dirname(oldPath), newFileName);
    
    // console.log(`Upload Route - Renaming from temp path: "${oldPath}" to final versioned path: "${newPath}"`);
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
    console.log(`项目 ${projectId} 上传新版本成功: ${version}, 文件名: ${newFileName}`);
    res.json({ message: '版本更新成功', version: newVersionInfo });

  } catch (err) {
    console.error(`Upload Route - Error for project ${projectId}:`, err);
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