const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const open = require('open');
const multer = require('multer');
const net = require('net');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// 控制面板应用
const app = express();
const uiPort = 8080;
let serverProcess = null;
let serverRunning = false;
let serverLogs = [];
const MAX_LOGS = 1000; // 最大保存日志行数

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const TOKEN_EXPIRY = '24h';

// 加载系统配置
const configPath = path.join(__dirname, 'config.json');
let config = {
  projects: [],
  users: [
    {
      username: 'admin',
      password: 'admin',
      role: 'admin',
      email: 'admin@example.com',
      createdAt: new Date().toISOString()
    }
  ],
  server: {
    port: 3000,
    adminPort: 8080,
    serverIp: '103.97.179.230'
  }
};

// 加载配置文件
const loadConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(data);
      
      // 确保users数组存在
      if (!config.users) {
        config.users = [
          {
            username: 'admin',
            password: 'admin',
            role: 'admin',
            email: 'admin@example.com',
            createdAt: new Date().toISOString()
          }
        ];
        saveConfig();
      }
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

// 中间件
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 认证中间件
const authenticateJWT = (req, res, next) => {
  // 登录和注册页面不需要认证
  if (req.path === '/api/login' || req.path === '/api/register' || 
      req.path === '/login.html' || req.path === '/register.html') {
    return next();
  }
  
  // 静态资源不需要认证
  if (req.path.match(/\.(css|js|ico|png|jpg|jpeg|gif|svg)$/)) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
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
    // 如果没有认证头，重定向到登录页面
    if (req.path === '/' || req.path === '/index.html') {
      return res.redirect('/login.html');
    }
    
    // API请求返回401
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: '需要认证' });
    }
    
    next();
  }
};

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
    // console.log(`Multer Filename (server-ui.js) - Received originalname: "${originalNameFromRequest}"`);

    let nameAfterUriDecode = originalNameFromRequest;
    try {
      nameAfterUriDecode = decodeURIComponent(originalNameFromRequest);
      // console.log(`Multer Filename (server-ui.js) - Stage 1 (decodeURIComponent) result: "${nameAfterUriDecode}"`);
    } catch (e) {
      // console.warn(`Multer Filename (server-ui.js) - Stage 1 (decodeURIComponent) FAILED for "${originalNameFromRequest}", Error: ${e.message}. Proceeding with original value for Stage 2.`);
    }

    let nameAfterMojibakeFix = Buffer.from(nameAfterUriDecode, 'latin1').toString('utf8');
    // console.log(`Multer Filename (server-ui.js) - Stage 2 (Buffer.from(latin1).toString(utf8)) on "${nameAfterUriDecode}" result: "${nameAfterMojibakeFix}"`);

    if (nameAfterMojibakeFix.includes('') && !nameAfterUriDecode.includes('')) {
      // console.warn(`Multer Filename (server-ui.js) - Stage 2 conversion of "${nameAfterUriDecode}" to "${nameAfterMojibakeFix}" resulted in replacement characters (''). Reverting to Stage 1 result: "${nameAfterUriDecode}"`);
      nameAfterMojibakeFix = nameAfterUriDecode; 
    }
    
    // console.log(`Multer Filename (server-ui.js) - Final filename for multer: "${nameAfterMojibakeFix}"`);
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
        if (!version.originalFileName && version.fileName) {
            const versionSuffix = `_${version.version}`;
            const indexOfVersionSuffix = version.fileName.lastIndexOf(versionSuffix);
            
            if (indexOfVersionSuffix !== -1) {
                version.originalFileName = version.fileName.substring(0, indexOfVersionSuffix);
            } else {
                 console.warn(`LoadVersions (server-ui.js) - Could not infer originalFileName for ${projectId} version ${version.version} from fileName ${version.fileName}. Using default.`);
                 version.originalFileName = "update"; 
            }
        } else if (!version.originalFileName) {
            console.warn(`LoadVersions (server-ui.js) - originalFileName missing for ${projectId} version ${version.version}. Using default.`);
            version.originalFileName = "update"; 
        }
      });
            
      return versions;
    }
    return [];
  } catch (err) {
    console.error(`LoadVersions (server-ui.js) - Error loading versions for project ${projectId}:`, err);
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

// 用户认证路由

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  const user = config.users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // 生成JWT令牌
    const token = jwt.sign(
      { 
        username: user.username, 
        role: user.role,
        email: user.email
      }, 
      JWT_SECRET, 
      { expiresIn: TOKEN_EXPIRY }
    );
    
    addLog(`用户 ${username} 登录成功`);
    res.json({ token });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 注册
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  
  // 验证输入
  if (!username || !email || !password) {
    return res.status(400).json({ error: '所有字段都是必需的' });
  }
  
  // 验证用户名格式
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: '用户名长度为3-20个字符，只能包含字母、数字和下划线' });
  }
  
  // 验证密码长度
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少为6个字符' });
  }
  
  // 检查用户名是否已存在
  if (config.users.some(u => u.username === username)) {
    return res.status(400).json({ error: '用户名已被使用' });
  }
  
  // 检查邮箱是否已存在
  if (config.users.some(u => u.email === email)) {
    return res.status(400).json({ error: '邮箱已被使用' });
  }
  
  // 创建新用户
  const newUser = {
    username,
    email,
    password, // 注意：实际应用中应该哈希密码
    role: 'user', // 默认角色为普通用户
    createdAt: new Date().toISOString()
  };
  
  config.users.push(newUser);
  saveConfig();
  
  addLog(`新用户注册: ${username} (${email})`);
  res.status(201).json({ message: '注册成功' });
});

// 获取当前用户信息
app.get('/api/user', (req, res) => {
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

// API路由

// 获取项目列表
app.get('/api/projects', (req, res) => {
  try {
    // 强制根据用户角色过滤项目
    let filteredProjects = [];
    
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role === 'admin') {
      // 管理员可以看到所有项目
      filteredProjects = [...config.projects];
    } else {
      // 普通用户只能看到自己的项目
      // 首先确保每个项目都有owner字段
      config.projects.forEach(project => {
        if (!project.owner) {
          project.owner = 'admin'; // 默认所有者为admin
        }
      });
      
      // 然后过滤出当前用户的项目
      filteredProjects = config.projects.filter(p => p.owner === req.user.username);
    }
    
    // 保存可能的更改
    saveConfig();
    
    // 返回安全的项目列表（不包含敏感信息）
    const safeProjects = filteredProjects.map(({ id, name, description, icon }) => ({
      id, name, description, icon
    }));
    
    res.json(safeProjects);
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取项目详情
app.get('/api/projects/:id', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    const { id } = req.params;
    const project = config.projects.find(p => p.id === id);
    
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    // 确保项目有owner字段
    if (!project.owner) {
      project.owner = 'admin'; // 默认所有者为admin
      saveConfig();
    }
    
    // 检查权限：只有管理员或项目所有者可以访问
    if (req.user.role !== 'admin' && project.owner !== req.user.username) {
      return res.status(403).json({ error: '没有权限访问此项目' });
    }
    
    // 返回不含敏感信息的项目数据
    const { apiKey, ...safeProject } = project;
    res.json(safeProject);
  } catch (error) {
    console.error('获取项目详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建新项目
app.post('/api/projects', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }
    
    const id = name.replace(/\s+/g, '-').toLowerCase();
    const timestamp = Date.now();
    const apiKey = `api-key-${id}-${timestamp}`;
    
    // 检查项目ID是否已存在
    if (config.projects.some(p => p.id === id)) {
      return res.status(400).json({ error: '项目ID已存在，请使用不同的项目名称' });
    }
    
    const newProject = {
      id,
      name,
      description: description || '',
      apiKey,
      icon: 'favicon.ico',
      owner: req.user.username // 自动设置项目所有者为当前用户
    };
    
    config.projects.push(newProject);
    saveConfig();
    
    // 创建项目目录结构
    const projectDir = path.join(__dirname, 'projects', id);
    const uploadsDir = path.join(projectDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // 初始化空的版本文件
    saveVersions(id, []);
    
    // 返回不含敏感信息的项目数据
    const { apiKey: _, ...safeProject } = newProject;
    res.status(201).json(safeProject);
  } catch (error) {
    console.error('创建项目错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 编辑项目
app.put('/api/projects/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  const projectIndex = config.projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  // 检查权限：只有项目所有者或管理员可以编辑项目
  const project = config.projects[projectIndex];
  if (req.user && (req.user.role === 'admin' || project.owner === req.user.username)) {
    config.projects[projectIndex] = {
      ...config.projects[projectIndex],
      name: name || config.projects[projectIndex].name,
      description: description || config.projects[projectIndex].description
    };

    saveConfig();

    const safeProject = { ...config.projects[projectIndex] };
    delete safeProject.apiKey;
    res.json(safeProject);
  } else {
    res.status(403).json({ error: '没有权限编辑此项目' });
  }
});

// 删除项目
app.delete('/api/projects/:id', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    const { id } = req.params;
    const projectIndex = config.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    const project = config.projects[projectIndex];
    
    // 确保项目有owner字段
    if (!project.owner) {
      project.owner = 'admin'; // 默认所有者为admin
      saveConfig();
    }
    
    // 检查权限：只有管理员或项目所有者可以删除
    if (req.user.role !== 'admin' && project.owner !== req.user.username) {
      return res.status(403).json({ error: '没有权限删除此项目' });
    }
    
    // 删除项目
    config.projects.splice(projectIndex, 1);
    saveConfig();
    
    // 删除项目目录和文件
    const projectDir = path.join(__dirname, 'projects', id);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    
    res.json({ message: '项目已成功删除' });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 重置项目API密钥
app.post('/api/projects/:projectId/reset-key', (req, res) => {
  const { projectId } = req.params;

  const project = config.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  // 检查权限：只有项目所有者或管理员可以重置API密钥
  if (req.user && (req.user.role === 'admin' || project.owner === req.user.username)) {
    project.apiKey = `api-key-${projectId}-${Date.now()}`;
    saveConfig();

    res.json({ apiKey: project.apiKey });
  } else {
    res.status(403).json({ error: '没有权限重置此项目的API密钥' });
  }
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
  
  // 检查项目是否存在
  const project = config.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  // 检查权限：只有项目所有者或管理员可以查看项目版本
  if (req.user && (req.user.role === 'admin' || project.owner === req.user.username)) {
    const versions = loadVersions(projectId);
    res.json({ versions });
  } else {
    res.status(403).json({ error: '没有权限访问此项目的版本' });
  }
});

// 上传新版本
app.post('/api/upload/:projectId', upload.single('file'), (req, res) => {
  try {
    const { projectId } = req.params;
    
    // 检查项目是否存在
    const project = config.projects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    // 检查权限：只有项目所有者或管理员可以上传版本
    if (!(req.user && (req.user.role === 'admin' || project.owner === req.user.username))) {
      return res.status(403).json({ error: '没有权限为此项目上传版本' });
    }
    
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
    // console.log(`Upload Route (server-ui.js) - Base Filename from req.file.filename (used for versioning): "${baseFileNameForVersioning}"`);

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
    
    // console.log(`Upload Route (server-ui.js) - Constructed Original Name Without Ext: "${originalNameWithoutExt}"`);
    // console.log(`Upload Route (server-ui.js) - Constructed New Filename with Version: "${newFileName}"`);

    const oldPath = req.file.path; 
    const newPath = path.join(path.dirname(oldPath), newFileName);
    
    // console.log(`Upload Route (server-ui.js) - Renaming from temp path: "${oldPath}" to final versioned path: "${newPath}"`);
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
    const successMsg = `项目 ${projectId} 的新版本 ${version} 已上传: ${newFileName}`;
    console.log(successMsg); // 简化的成功日志
    serverLogs.push(successMsg); // 控制面板日志也使用简化信息
    res.json({ message: '版本上传成功', version: newVersionInfo });

  } catch (err) {
    console.error(`Upload Route (server-ui.js) - Error for project ${projectId}:`, err);
    serverLogs.push(`上传失败: ${err.message}`);
    res.status(500).json({ error: '上传失败，服务器内部错误' });
  }
});

// 处理根路径，确保重定向到登录页面
app.get('/', (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.redirect('/login.html');
  }
});

// 启动服务器
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