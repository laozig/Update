const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;
// 在反向代理（如 Nginx）后时，正确识别协议和客户端 IP
app.set('trust proxy', 1);

// 统一构造对外可访问的基地址：优先 BASE_URL，其次按请求推断
const getBaseUrl = (req) => {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
};

// JWT密钥，与控制面板使用相同的密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// 加载系统配置
const configPath = path.join(__dirname, 'config.json');
let config = {
  projects: [],
  users: [],
  server: {
    port: 3000,
    adminPort: 8080
  }
};

// 日志配置
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 日志文件最大大小（10MB）
const MAX_LOG_FILES = 5; // 最多保留的日志文件数量

// 日志文件轮转
const rotateLogFiles = (logFileName) => {
  try {
    const baseLogPath = path.join(__dirname, '..', logFileName);
    
    // 删除最老的日志文件（如果存在）
    const oldestLogPath = `${baseLogPath}.${MAX_LOG_FILES}`;
    if (fs.existsSync(oldestLogPath)) {
      fs.unlinkSync(oldestLogPath);
    }
    
    // 将现有的日志文件依次重命名
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const currentLogPath = `${baseLogPath}.${i}`;
      const newLogPath = `${baseLogPath}.${i + 1}`;
      
      if (fs.existsSync(currentLogPath)) {
        fs.renameSync(currentLogPath, newLogPath);
      }
    }
    
    // 重命名当前日志文件
    if (fs.existsSync(baseLogPath)) {
      fs.renameSync(baseLogPath, `${baseLogPath}.1`);
    }
    
    console.log(`日志文件 ${logFileName} 已轮转`);
  } catch (err) {
    console.error(`日志轮转失败 ${logFileName}:`, err);
  }
};

// 检查并轮转日志文件
const checkAndRotateLogs = () => {
  const logFiles = ['api-server.log', 'ui-server.log', 'server.log'];
  
  logFiles.forEach(logFile => {
    const logFilePath = path.join(__dirname, '..', logFile);
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size >= MAX_LOG_SIZE) {
        rotateLogFiles(logFile);
      }
    }
  });
};

// 定期检查日志大小（每小时检查一次）
setInterval(checkAndRotateLogs, 60 * 60 * 1000);

// 启动时检查一次日志大小
checkAndRotateLogs();

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

// JWT认证中间件
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // 公共与免认证路径
  if (
    req.path.startsWith('/api/version/') ||
    req.path.startsWith('/download/') ||
    req.path === '/api/login' ||
    req.path === '/api/register' ||
    req.path === '/api/health'
  ) {
    return next();
  }

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: '无效或过期的令牌' });
      }
      
      req.user = user;
      next();
    });
  } else {
    return res.status(401).json({ error: '需要认证' });
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

// 项目所有权检查中间件
const checkProjectOwnership = (req, res, next) => {
  const projectId = req.params.projectId;
  const project = config.projects.find(p => p.id === projectId);
  
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  // 确保项目有owner字段
  if (!project.owner) {
    project.owner = 'admin'; // 默认所有者为admin
    saveConfig();
  }
  
  // 检查权限：只有管理员或项目所有者可以访问
  if (req.user && (req.user.role === 'admin' || project.owner === req.user.username)) {
    req.project = project; // 将项目信息附加到请求对象
    next();
  } else {
    res.status(403).json({ error: '没有权限访问此项目' });
  }
};

// CORS 配置（开发环境放开，生产按配置限制）
app.use(cors({
  origin: function(origin, callback) {
    // 开发环境：放开所有来源，便于本地调试
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    const allowedOrigins = [
      `http://${config.server.serverIp || 'localhost'}`,
      `https://${config.server.serverIp || 'localhost'}`,
      'http://localhost',
      'https://localhost',
      'http://127.0.0.1',
      'https://127.0.0.1'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS拒绝来源: ${origin}`);
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
app.use(authenticateJWT);

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

const parseMaxUpload = () => {
  const val = process.env.MAX_UPLOAD_SIZE || '';
  if (!val) return 100 * 1024 * 1024; // 默认100MB
  const lower = String(val).toLowerCase().trim();
  const num = parseFloat(lower);
  if (isNaN(num)) return 100 * 1024 * 1024;
  if (lower.endsWith('gb') || lower.endsWith('g')) return Math.floor(num * 1024 * 1024 * 1024);
  if (lower.endsWith('mb') || lower.endsWith('m')) return Math.floor(num * 1024 * 1024);
  if (lower.endsWith('kb') || lower.endsWith('k')) return Math.floor(num * 1024);
  return Math.floor(num); // 认为是字节数
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseMaxUpload(),
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
        if (!version.downloadUrl || version.downloadUrl.includes('undefined')) {
          // 使用相对路径，避免依赖 serverIp
          version.downloadUrl = `/download/${projectId}/${version.version}`;
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
  console.log(`服务器配置已加载，域名: ${config.server.serverIp || 'localhost'}`);

// 首次启动安全初始化：若无用户且设置了 ADMIN_PASSWORD，则创建管理员（密码哈希）
try {
  const hasAnyUser = Array.isArray(config.users) && config.users.length > 0;
  if (!hasAnyUser) {
    const nowIso = new Date().toISOString();
    if (ADMIN_PASSWORD) {
      const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      config.users = [
        { username: ADMIN_USERNAME, password: passwordHash, role: 'admin', email: `${ADMIN_USERNAME}@example.com`, createdAt: nowIso }
      ];
      saveConfig();
      console.log(`[安全] 已根据环境变量创建管理员用户: ${ADMIN_USERNAME}`);
    } else {
      // 无预设口令 -> 生成随机账号密码（仅首次启动）
      const randomString = (len) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let out = '';
        for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
      };
      const generatedUsername = `admin-${randomString(6)}`;
      const generatedPassword = randomString(16);
      const passwordHash = bcrypt.hashSync(generatedPassword, 10);
      config.users = [
        { username: generatedUsername, password: passwordHash, role: 'admin', email: `${generatedUsername}@example.com`, createdAt: nowIso }
      ];
      saveConfig();
      // 将明文首次登录凭据写入文件并打印（仅一次）
      try {
        const firstRunFile = path.join(__dirname, 'first-run-admin.txt');
        const content = `首次部署已生成管理员账号，请尽快登录并修改密码\n用户名: ${generatedUsername}\n密码: ${generatedPassword}\n时间: ${nowIso}\n`;
        fs.writeFileSync(firstRunFile, content, { flag: 'w' });
        console.warn('[安全] 首次部署：已生成随机管理员账号，凭据已写入 server/first-run-admin.txt');
        console.warn(`[安全] 一次性提示 - 用户名: ${generatedUsername} 密码: ${generatedPassword}`);
      } catch (werr) {
        console.error('写入首次登录凭据文件失败:', werr);
      }
    }
  }
} catch (e) {
  console.error('初始化管理员用户失败:', e);
}

// 路由
// 登录（公开）
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '缺少用户名或密码' });
  }
  const user = config.users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const stored = user.password || '';
  let ok = false;
  try {
    if (stored.startsWith('$2')) {
      ok = bcrypt.compareSync(password, stored);
    } else {
      ok = password === stored;
    }
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ username: user.username, role: user.role || 'user' }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '24h' });
  const safeUser = { username: user.username, role: user.role || 'user', email: user.email };
  res.json({ token, user: safeUser });
});

// 获取项目列表
app.get('/api/projects', (req, res) => {
  // 根据用户角色过滤项目
  let filteredProjects;
  
  if (req.user && req.user.role === 'admin') {
    // 管理员可以看到所有项目
    filteredProjects = config.projects;
  } else if (req.user) {
    // 普通用户只能看到自己的项目
    filteredProjects = config.projects.filter(p => p.owner === req.user.username);
  } else {
    // 未认证用户不能看到任何项目
    return res.status(401).json({ error: '未认证' });
  }
  
  // 返回项目列表，但不包含敏感信息如apiKey
  const safeProjects = filteredProjects.map(({ id, name, description, icon, owner }) => ({
    id, name, description, icon, owner
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
  // 使用 BASE_URL 或请求推断出的协议与主机名
  latestVersion.downloadUrl = `${getBaseUrl(req)}/download/${projectId}/${latestVersion.version}`;
  
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
      downloadUrl: `${getBaseUrl(req)}/download/${projectId}/${version}`,
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

// 下载最新版本
app.get('/download/:projectId/latest', (req, res) => {
  const { projectId } = req.params;
  
  // 检查项目目录是否存在
  const projectDir = path.join(__dirname, 'projects', projectId);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
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

// 下载指定版本
app.get('/download/:projectId/:version', (req, res) => {
  const { projectId, version } = req.params;
  
  // 检查项目目录是否存在
  const projectDir = path.join(__dirname, 'projects', projectId);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
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
    console.log(`文件 ${filePath} 不存在，尝试查找包含版本号 ${version} 的文件`);
    const files = fs.readdirSync(uploadsDir);
    
    // 查找包含版本号的文件，支持下划线或连字符连接
    const versionFile = files.find(file => 
      file.includes(`_${version}.`) || 
      file.includes(`-${version}.`) ||
      file.includes(`_${version}`) || 
      file.includes(`-${version}`)
    );
    
    if (versionFile) {
      filePath = path.join(uploadsDir, versionFile);
      console.log(`找到匹配的文件: ${versionFile}`);
    } else {
      console.log(`在 ${uploadsDir} 目录中没有找到包含版本号 ${version} 的文件`);
      console.log(`目录中的文件: ${files.join(', ')}`);
    }
  }
  
  if (fs.existsSync(filePath)) {
    console.log(`下载文件: ${filePath}`);
    res.download(filePath);
  } else {
    res.status(404).json({ error: `文件 ${versionInfo.fileName} 不存在` });
  }
});

// 用户API路由
app.get('/api/users', authenticateJWT, (req, res) => {
  // 只有管理员可以查看用户列表
  if (req.user && req.user.role === 'admin') {
    // 返回用户列表，但不包含密码
    const safeUsers = config.users.map(({ username, email, role, createdAt }) => ({
      username, email, role, createdAt
    }));
    res.json(safeUsers);
  } else {
    res.status(403).json({ error: '没有权限访问用户列表' });
  }
});

// 获取当前用户信息
app.get('/api/user/current', authenticateJWT, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }
  
  const user = config.users.find(u => u.username === req.user.username);
  
  if (user) {
    const safeUser = { ...user };
    delete safeUser.password; // 不返回密码
    res.json(safeUser);
  } else {
    res.status(404).json({ error: '用户不存在' });
  }
});

// 管理员更改用户角色
app.put('/api/users/:username/role', authenticateJWT, (req, res) => {
  // 只有管理员可以更改用户角色
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '没有权限更改用户角色' });
  }
  
  const { username } = req.params;
  const { role } = req.body;
  
  // 验证角色
  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }
  
  const userIndex = config.users.findIndex(u => u.username === username);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 不允许更改最后一个管理员的角色
  if (username === req.user.username && role !== 'admin') {
    const adminCount = config.users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: '不能更改最后一个管理员的角色' });
    }
  }
  
  config.users[userIndex].role = role;
  saveConfig();
  
  res.json({ message: `用户 ${username} 的角色已更改为 ${role}` });
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