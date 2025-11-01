const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const open = require('open');
const multer = require('multer');
const net = require('net');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const http = require('http');

// 设置未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 记录错误但不退出进程
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  // 记录错误但不退出进程
});

// 控制面板应用
const app = express();
const uiPort = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 33081;
// 在反向代理（如 Nginx）后时，正确识别协议和客户端 IP
// trust proxy 设置为 true 表示信任所有代理（适用于多层代理场景）
app.set('trust proxy', true);

// 统一构造对外可访问的基地址：优先 BASE_URL，其次按请求推断
const getBaseUrl = (req) => {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
};
let serverProcess = null;
let serverRunning = false;
let serverLogs = [];
const MAX_LOGS = 1000; // 最大保存日志行数
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 日志文件最大大小（10MB）
const MAX_LOG_FILES = 5; // 最多保留的日志文件数量

// 创建HTTP服务器
const server = http.createServer(app);

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
    port: 33001,
    adminPort: 33081,
    serverIp: null
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
      
      // 确保roles数组存在
      if (!config.roles) {
        config.roles = [
          {
            id: 'admin',
            name: '管理员',
            description: '系统管理员，拥有所有权限',
            permissions: ['all'],
            isSystem: true
          },
          {
            id: 'user',
            name: '普通用户',
            description: '普通用户，只能管理自己的项目',
            permissions: ['manage_own_projects'],
            isSystem: true
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
  
  // 写入日志文件（带轮转功能）
  try {
    const logFilePath = path.join(__dirname, '..', 'server.log');
    
    // 检查日志文件大小
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      
      // 如果日志文件超过最大大小，进行轮转
      if (stats.size >= MAX_LOG_SIZE) {
        rotateLogFiles();
      }
    }
    
    // 追加日志
    fs.appendFileSync(logFilePath, logEntry + '\n');
  } catch (err) {
    console.error('写入日志失败:', err);
  }
};

// 日志文件轮转
const rotateLogFiles = () => {
  try {
    const baseLogPath = path.join(__dirname, '..', 'server.log');
    
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
    
    console.log('日志文件已轮转');
  } catch (err) {
    console.error('日志轮转失败:', err);
  }
};

// 初始化加载配置
loadConfig();
addLog('控制面板服务启动');

// 检查API服务器是否已经在运行
const checkApiServerStatus = () => {
  const client = new net.Socket();
  client.setTimeout(500);
  
  client.connect(config.server.port, '127.0.0.1', () => {
    client.destroy();
    serverRunning = true;
    console.log('API服务器已在运行');
    addLog('检测到API服务器已在运行');
  });
  
  client.on('error', () => {
    serverRunning = false;
    console.log('API服务器未运行');
  });
  
  client.on('timeout', () => {
    serverRunning = false;
    console.log('API服务器连接超时');
    client.destroy();
  });
};

// 启动时检查API服务器状态
checkApiServerStatus();

// 中间件
app.use(express.static(path.join(__dirname, 'public')));
// 显式映射登录/注册页，防止某些中间件顺序导致静态文件未命中
app.get(['/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get(['/register', '/register.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
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
    // 如果没有认证头，对于页面请求，允许通过（让前端处理认证）
    // 对于 / 和 /index.html，直接返回页面，让前端 JavaScript 检查 token
    if (req.path === '/' || req.path === '/index.html') {
      return next(); // 允许访问，由前端检查认证
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
        if (!version.downloadUrl || version.downloadUrl.includes('undefined')) {
          // 使用相对路径，避免依赖 serverIp
          version.downloadUrl = `/download/${projectId}/${version.version}`;
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
  
  const user = config.users.find(u => u.username === username);
  
  if (user) {
    // 使用明文密码比较
    if (user.password === password) {
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
      console.log(`用户 ${username} 登录成功，角色: ${user.role}`);
      res.json({ token });
    } else {
      console.log(`用户 ${username} 登录失败: 密码错误`);
      res.status(401).json({ error: '用户名或密码错误' });
    }
  } else {
    console.log(`用户 ${username} 登录失败: 用户不存在`);
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
  
  // 创建新用户，使用明文密码
  const newUser = {
    username,
    email,
    password, // 存储明文密码
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

// 获取服务器配置信息
app.get('/api/server-config', authenticateJWT, (req, res) => {
  try {
    // 返回安全的服务器配置（不包含敏感信息）
    const serverConfig = {
      serverIp: req.hostname,
      port: config.server.port || 3000,
      adminPort: config.server.adminPort || 8080
    };
    
    res.json(serverConfig);
  } catch (error) {
    console.error('获取服务器配置错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

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
    console.log(`获取项目详情请求: ${id}, 用户: ${req.user.username}`);
    
    const project = config.projects.find(p => p.id === id);
  
  if (!project) {
      console.log(`项目不存在: ${id}`);
    return res.status(404).json({ error: '项目不存在' });
  }

    // 确保项目有owner字段
    if (!project.owner) {
      project.owner = 'admin'; // 默认所有者为admin
      saveConfig();
    }
    
    // 检查权限：只有管理员或项目所有者可以访问
    if (req.user.role !== 'admin' && project.owner !== req.user.username) {
      console.log(`权限拒绝: 用户 ${req.user.username} 尝试访问项目 ${id}`);
      return res.status(403).json({ error: '没有权限访问此项目' });
    }
    
    // 确保项目有apiKey字段
    if (!project.apiKey) {
      console.log(`项目 ${id} 没有API密钥，正在生成...`);
      project.apiKey = `api-key-${id}-${Date.now()}`;
      saveConfig();
    }
    
    // 调试日志
    console.log('项目详情API返回数据:', JSON.stringify(project));
    console.log('API密钥:', project.apiKey);
    
    // 返回项目数据，包括API密钥
    res.json(project);
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
    
    const { id: customId, name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }
    
    // 使用前端提供的ID或根据名称生成ID
    const id = customId || name.replace(/\s+/g, '-').toLowerCase();
    const timestamp = Date.now();
    const apiKey = `api-key-${id}-${timestamp}`;
    
    // 检查项目ID是否已存在
  if (config.projects.some(p => p.id === id)) {
      return res.status(400).json({ error: '项目ID已存在，请使用不同的项目ID或名称' });
  }

  const newProject = {
    id,
    name,
    description: description || '',
      apiKey,
      icon: 'favicon.ico',
      owner: req.user.username // 自动设置项目所有者为当前用户
  };
    
    // 调试日志
    console.log('创建新项目:', newProject);

  config.projects.push(newProject);
  saveConfig();

  // 创建项目目录结构
  const projectDir = path.join(__dirname, 'projects', id);
  const uploadsDir = path.join(projectDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  // 初始化空的版本文件
  saveVersions(id, []);

    // 发送WebSocket通知
    sendNotification(
      '项目已创建', 
      `项目 "${name}" 已成功创建`, 
      'success', 
      null, 
      req.user.username
    );
    
    broadcastToAll({
      type: 'project_update',
      action: 'created',
      projectId: id
    });
    
    // 返回完整项目数据，包括API密钥
    res.status(201).json(newProject);
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
    
    // 发送WebSocket通知
    sendNotification(
      '项目已删除', 
      `项目 "${project.name}" 已被删除`, 
      'warning', 
      null, 
      req.user.username
    );
    
    broadcastToAll({
      type: 'project_update',
      action: 'deleted',
      projectId: id
    });
    
    res.json({ message: '项目已成功删除' });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 重置项目API密钥
app.post('/api/projects/:projectId/reset-key', (req, res) => {
  try {
  const { projectId } = req.params;
    console.log(`重置API密钥请求: ${projectId}, 用户: ${req.user ? req.user.username : '未认证'}`);

  const project = config.projects.find(p => p.id === projectId);
  if (!project) {
      console.log(`项目不存在: ${projectId}`);
    return res.status(404).json({ error: '项目不存在' });
  }

    // 检查权限：只有项目所有者或管理员可以重置API密钥
    if (req.user && (req.user.role === 'admin' || project.owner === req.user.username)) {
      const newApiKey = `api-key-${projectId}-${Date.now()}`;
      console.log(`为项目 ${projectId} 生成新的API密钥: ${newApiKey}`);
      
      project.apiKey = newApiKey;
  saveConfig();

  res.json({ apiKey: project.apiKey });
    } else {
      console.log(`权限拒绝: 用户尝试重置项目 ${projectId} 的API密钥`);
      res.status(403).json({ error: '没有权限重置此项目的API密钥' });
    }
  } catch (error) {
    console.error('重置API密钥错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/status', authenticateJWT, (req, res) => {
  const client = new net.Socket();
  let responded = false;
  client.setTimeout(500);
  
  // 尝试连接API服务器端口
  client.connect(config.server.port, '127.0.0.1', () => {
    responded = true;
    client.destroy();
    res.json({ running: true });
    console.log('API服务器状态检查: 运行中');
  });
  
  client.on('error', (err) => {
    if (!responded) {
      responded = true;
      res.json({ running: false });
      console.log('API服务器状态检查: 已停止 (连接错误)');
    }
  });
  
  client.on('timeout', () => {
    if (!responded) {
      responded = true;
      res.json({ running: false });
      console.log('API服务器状态检查: 已停止 (连接超时)');
    }
    client.destroy();
  });
});

app.get('/logs', authenticateJWT, (req, res) => {
  // 只允许管理员查看日志
  if (req.user && req.user.role === 'admin') {
    res.json({ logs: serverLogs });
  } else {
    res.status(403).json({ error: '没有权限查看服务器日志，需要管理员权限' });
  }
});

// 清理日志文件
app.post('/api/logs/clean', authenticateJWT, (req, res) => {
  try {
    // 验证权限
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以清理日志' });
    }
    
    // 清理内存中的日志
    serverLogs = [];
    
    // 轮转所有日志文件
    const logFiles = ['api-server.log', 'ui-server.log', 'server.log'];
    logFiles.forEach(logFile => {
      try {
        const logFilePath = path.join(__dirname, '..', logFile);
        if (fs.existsSync(logFilePath)) {
          // 备份当前日志文件
          const backupPath = `${logFilePath}.bak.${Date.now()}`;
          fs.renameSync(logFilePath, backupPath);
          
          // 创建新的空日志文件
          fs.writeFileSync(logFilePath, '');
          
          console.log(`日志文件 ${logFile} 已清理并备份为 ${path.basename(backupPath)}`);
        }
      } catch (err) {
        console.error(`清理日志文件 ${logFile} 失败:`, err);
      }
    });
    
    addLog(`管理员 ${req.user.username} 清理了系统日志`);
    res.json({ message: '日志已清理' });
  } catch (error) {
    console.error('清理日志错误:', error);
    res.status(500).json({ error: '清理日志失败', details: error.message });
  }
});

// 启动API服务器
app.post('/start', authenticateJWT, (req, res) => {
  try {
    // 验证权限
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以启动服务器' });
    }
    
    // 如果服务器已经在运行，则返回
    if (serverRunning) {
      return res.json({ running: true, message: '服务器已经在运行中' });
    }
    
    // 启动API服务器
    const serverPath = path.join(__dirname, 'index.js');
    serverProcess = spawn('node', [serverPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // 处理服务器输出
    serverProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      addLog(`[API] ${message}`);
    });
    
    // 处理服务器错误
    serverProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      addLog(`[API错误] ${message}`);
    });
    
    // 处理服务器退出
    serverProcess.on('close', (code) => {
      addLog(`API服务器已停止，退出代码: ${code}`);
      serverRunning = false;
    });
    
    serverRunning = true;
    addLog(`管理员 ${req.user.username} 启动了API服务器`);
    
    res.json({ running: true, message: '服务器已启动' });
  } catch (error) {
    console.error('启动服务器错误:', error);
    res.status(500).json({ error: '启动服务器失败', details: error.message });
  }
});

// 停止API服务器
app.post('/stop', authenticateJWT, (req, res) => {
  try {
    // 验证权限
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以停止服务器' });
    }
    
    // 如果服务器没有运行，则返回
    if (!serverRunning || !serverProcess) {
      return res.json({ running: false, message: '服务器已经停止' });
    }
    
    // 在Windows上使用taskkill，在其他系统上使用kill
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
      process.kill(-serverProcess.pid, 'SIGINT');
    }
    
    serverProcess = null;
    serverRunning = false;
    addLog(`管理员 ${req.user.username} 停止了API服务器`);
    
    res.json({ running: false, message: '服务器已停止' });
  } catch (error) {
    console.error('停止服务器错误:', error);
    res.status(500).json({ error: '停止服务器失败', details: error.message });
  }
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
    
    // 验证版本号格式（例如：1.0.0, 2.3.1 等）
    const versionRegex = /^\d+(\.\d+)*$/;
    if (!versionRegex.test(version)) {
      return res.status(400).json({ error: '无效的版本号格式，请使用数字和点号（例如：1.0.0）' });
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
    const successMsg = `项目 ${projectId} 的新版本 ${version} 已上传: ${newFileName}`;
    console.log(successMsg); // 简化的成功日志
    addLog(successMsg); // 控制面板日志也使用简化信息
    
    // 发送WebSocket通知
    sendNotification(
      '新版本已上传', 
      `项目 "${project.name}" 的版本 ${version} 已成功上传`, 
      'success', 
      null, 
      req.user.username
    );
    
    broadcastToAll({
      type: 'version_update',
      action: 'created',
      projectId,
      version
    });
    
    res.json({ message: '版本上传成功', version: newVersionInfo });

  } catch (err) {
    console.error(`Upload Route (server-ui.js) - Error for project ${req.params ? req.params.projectId : 'unknown'}:`, err);
    addLog(`上传失败: ${err.message}`);
    res.status(500).json({ error: '上传失败，服务器内部错误' });
  }
});

// 处理根路径和 index.html，总是返回主页面（让前端检查认证）
app.get(['/', '/index.html'], (req, res) => {
  // 直接返回 index.html，由前端 JavaScript 检查 token 并决定是否重定向
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取用户列表
app.get('/api/users', (req, res) => {
  try {
    console.log('请求用户列表 - 用户:', req.user ? req.user.username : '未认证', '角色:', req.user ? req.user.role : '无');
    
    // 只有管理员可以查看用户列表
    if (!req.user) {
      console.log('获取用户列表失败: 未认证');
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      console.log(`获取用户列表失败: 用户 ${req.user.username} 不是管理员`);
      return res.status(403).json({ error: '没有权限访问用户列表' });
    }
    
    // 返回用户列表，但不包含密码
    const safeUsers = config.users.map(({ username, email, role, createdAt }) => ({
      username, email, role, createdAt
    }));
    
    console.log(`成功获取用户列表: ${safeUsers.length} 个用户`);
    res.json(safeUsers);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员创建用户
app.post('/api/users', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以创建用户' });
    }
    
    const { username, email, password, role } = req.body;
    
    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码都是必需的' });
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
    
    const validRole = ['user', 'admin'].includes(role) ? role : 'user';
    
    // 创建新用户，使用明文密码
    const newUser = {
      username,
      email,
      password, // 存储明文密码
      role: validRole,
      createdAt: new Date().toISOString()
    };
    
    config.users.push(newUser);
    saveConfig();
    
    addLog(`管理员 ${req.user.username} 创建了新用户: ${username} (${email}), 角色: ${validRole}`);
    
    // 发送WebSocket通知
    sendNotification(
      '新用户已创建', 
      `用户 "${username}" 已创建，角色: ${validRole === 'admin' ? '管理员' : '普通用户'}`, 
      'info', 
      'admin'
    );
    
    broadcastToAll({
      type: 'user_update',
      action: 'created',
      username
    });
    
    // 返回创建的用户信息，但不包含密码
    const safeUser = { ...newUser };
    delete safeUser.password;
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员删除用户
app.delete('/api/users/:username', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以删除用户' });
    }
    
    const { username } = req.params;
    
    // 不能删除自己
    if (username === req.user.username) {
      return res.status(400).json({ error: '不能删除当前登录的管理员账户' });
    }
    
    // 查找用户
    const userIndex = config.users.findIndex(u => u.username === username);
    if (userIndex === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 不能删除最后一个管理员
    const isAdmin = config.users[userIndex].role === 'admin';
    if (isAdmin) {
      const adminCount = config.users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: '不能删除最后一个管理员账户' });
      }
    }
    
    // 删除用户
    const deletedUser = config.users.splice(userIndex, 1)[0];
    saveConfig();
    
    addLog(`管理员 ${req.user.username} 删除了用户: ${username}`);
    
    // 发送WebSocket通知
    sendNotification(
      '用户已删除', 
      `用户 "${username}" 已被删除`, 
      'warning', 
      'admin'
    );
    
    broadcastToAll({
      type: 'user_update',
      action: 'deleted',
      username
    });
    
    // 返回成功消息
    res.json({ message: `用户 ${username} 已成功删除` });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员更改用户角色
app.put('/api/users/:username/role', (req, res) => {
  try {
    // 只有管理员可以更改用户角色
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '没有权限更改用户角色' });
    }
    
    const { username } = req.params;
    const { role } = req.body;
    
    console.log(`尝试更改用户 ${username} 的角色为 ${role}`);
    
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
    
    // 更新用户角色
    config.users[userIndex].role = role;
    saveConfig();
    
    addLog(`管理员 ${req.user.username} 将用户 ${username} 的角色更改为 ${role}`);
    
    // 发送WebSocket通知
    sendNotification(
      '用户角色已更改', 
      `用户 "${username}" 的角色已更改为 ${role === 'admin' ? '管理员' : '普通用户'}`, 
      'info', 
      'admin'
    );
    
    broadcastToAll({
      type: 'user_update',
      action: 'role_updated',
      username,
      role
    });
    
    res.json({ message: `用户 ${username} 的角色已更改为 ${role}` });
  } catch (error) {
    console.error('更改用户角色错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员编辑用户信息
app.put('/api/users/:username', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    const { username } = req.params;
    const { email, password } = req.body;
    
    // 只有管理员或用户本人可以编辑用户信息
    if (req.user.role !== 'admin' && req.user.username !== username) {
      return res.status(403).json({ error: '没有权限编辑此用户信息' });
    }
    
    // 查找用户
    const userIndex = config.users.findIndex(u => u.username === username);
    if (userIndex === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = config.users[userIndex];
    
    // 更新邮箱（如果提供）
    if (email) {
      // 检查邮箱是否已被其他用户使用
      const emailExists = config.users.some((u, i) => u.email === email && i !== userIndex);
      if (emailExists) {
        return res.status(400).json({ error: '邮箱已被其他用户使用' });
      }
      user.email = email;
    }
    
    // 更新密码（如果提供）
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少为6个字符' });
      }
      user.password = password; // 使用明文密码
    }
    
    // 保存更改
    saveConfig();
    
    addLog(`用户 ${username} 的信息已更新`);
    
    // 发送WebSocket通知
    sendNotification(
      '用户信息已更新', 
      `用户 "${username}" 的信息已更新`, 
      'info', 
      'admin'
    );
    
    broadcastToAll({
      type: 'user_update',
      action: 'updated',
      username
    });
    
    // 返回更新后的用户信息（不含密码）
    const safeUser = { ...user };
    delete safeUser.password;
    res.json(safeUser);
  } catch (error) {
    console.error('编辑用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个用户信息
app.get('/api/users/:username', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    const { username } = req.params;
    
    // 只有管理员或用户本人可以查看用户信息
    if (req.user.role !== 'admin' && req.user.username !== username) {
      return res.status(403).json({ error: '没有权限查看此用户信息' });
    }
    
    const user = config.users.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 返回用户信息，但不包含密码
    const safeUser = { ...user };
    delete safeUser.password;
    res.json(safeUser);
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取角色列表
app.get('/api/roles', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以查看角色列表' });
    }
    
    // 确保roles数组存在
    if (!config.roles) {
      config.roles = [
        {
          id: 'admin',
          name: '管理员',
          description: '系统管理员，拥有所有权限',
          permissions: ['all'],
          isSystem: true
        },
        {
          id: 'user',
          name: '普通用户',
          description: '普通用户，只能管理自己的项目',
          permissions: ['manage_own_projects'],
          isSystem: true
        }
      ];
      saveConfig();
    }
    
    res.json(config.roles);
  } catch (error) {
    console.error('获取角色列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个角色信息
app.get('/api/roles/:roleId', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以查看角色信息' });
    }
    
    const { roleId } = req.params;
    
    // 确保roles数组存在
    if (!config.roles) {
      return res.status(404).json({ error: '角色系统未初始化' });
    }
    
    // 查找角色
    const role = config.roles.find(r => r.id === roleId);
    if (!role) {
      return res.status(404).json({ error: '角色不存在' });
    }
    
    res.json(role);
  } catch (error) {
    console.error('获取角色信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建新角色
app.post('/api/roles', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以创建角色' });
    }
    
    const { id, name, description, permissions } = req.body;
    
    // 验证输入
    if (!id || !name) {
      return res.status(400).json({ error: '角色ID和名称是必需的' });
    }
    
    // 验证角色ID格式
    const idRegex = /^[a-zA-Z0-9_]{2,20}$/;
    if (!idRegex.test(id)) {
      return res.status(400).json({ error: '角色ID长度为2-20个字符，只能包含字母、数字和下划线' });
    }
    
    // 确保roles数组存在
    if (!config.roles) {
      config.roles = [
        {
          id: 'admin',
          name: '管理员',
          description: '系统管理员，拥有所有权限',
          permissions: ['all'],
          isSystem: true
        },
        {
          id: 'user',
          name: '普通用户',
          description: '普通用户，只能管理自己的项目',
          permissions: ['manage_own_projects'],
          isSystem: true
        }
      ];
    }
    
    // 检查角色ID是否已存在
    if (config.roles.some(r => r.id === id)) {
      return res.status(400).json({ error: '角色ID已存在' });
    }
    
    // 创建新角色
    const newRole = {
      id,
      name,
      description: description || '',
      permissions: permissions || [],
      isSystem: false
    };
    
    config.roles.push(newRole);
    saveConfig();
    
    addLog(`管理员 ${req.user.username} 创建了新角色: ${name} (${id})`);
    res.status(201).json(newRole);
  } catch (error) {
    console.error('创建角色错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新角色
app.put('/api/roles/:roleId', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以更新角色' });
    }
    
    const { roleId } = req.params;
    const { name, description, permissions } = req.body;
    
    // 确保roles数组存在
    if (!config.roles) {
      return res.status(404).json({ error: '角色系统未初始化' });
    }
    
    // 查找角色
    const roleIndex = config.roles.findIndex(r => r.id === roleId);
    if (roleIndex === -1) {
      return res.status(404).json({ error: '角色不存在' });
    }
    
    const role = config.roles[roleIndex];
    
    // 不能修改系统角色
    if (role.isSystem) {
      return res.status(403).json({ error: '不能修改系统角色' });
    }
    
    // 更新角色信息
    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    
    saveConfig();
    
    addLog(`管理员 ${req.user.username} 更新了角色: ${role.name} (${roleId})`);
    res.json(role);
  } catch (error) {
    console.error('更新角色错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除角色
app.delete('/api/roles/:roleId', (req, res) => {
  try {
    // 验证权限
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以删除角色' });
    }
    
    const { roleId } = req.params;
    
    // 确保roles数组存在
    if (!config.roles) {
      return res.status(404).json({ error: '角色系统未初始化' });
    }
    
    // 查找角色
    const roleIndex = config.roles.findIndex(r => r.id === roleId);
    if (roleIndex === -1) {
      return res.status(404).json({ error: '角色不存在' });
    }
    
    const role = config.roles[roleIndex];
    
    // 不能删除系统角色
    if (role.isSystem) {
      return res.status(403).json({ error: '不能删除系统角色' });
    }
    
    // 检查是否有用户正在使用该角色
    const usersWithRole = config.users.filter(u => u.role === roleId);
    if (usersWithRole.length > 0) {
      return res.status(400).json({ 
        error: `无法删除角色，有 ${usersWithRole.length} 个用户正在使用该角色`,
        users: usersWithRole.map(u => u.username)
      });
    }
    
    // 删除角色
    config.roles.splice(roleIndex, 1);
    saveConfig();
    
    addLog(`管理员 ${req.user.username} 删除了角色: ${role.name} (${roleId})`);
    res.json({ message: `角色 ${role.name} 已成功删除` });
  } catch (error) {
    console.error('删除角色错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 替换WebSocket广播函数
function broadcastToAll(message) {
  // WebSocket广播已移除
  console.log('通知消息:', message);
}

function broadcastToRole(message, role) {
  // WebSocket广播已移除
  console.log(`发送给角色 ${role} 的通知:`, message);
}

function broadcastToUser(message, username) {
  // WebSocket广播已移除
  console.log(`发送给用户 ${username} 的通知:`, message);
}

// 发送通知
function sendNotification(title, message, level = 'info', role = null, username = null) {
  const notification = {
    type: 'notification',
    title,
    message,
    level,
    timestamp: new Date().toISOString()
  };
  
  if (username) {
    broadcastToUser(notification, username);
  } else if (role) {
    broadcastToRole(notification, role);
  } else {
    broadcastToAll(notification);
  }
}

// 启动服务器
server.listen(process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : (config.server.adminPort || uiPort), () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let lanIp = null;
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp) break;
  }
  const listenPort = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : (config.server.adminPort || uiPort);
  console.log(`控制面板运行在 http://localhost:${listenPort}`);
  if (lanIp) {
    console.log(`局域网访问地址: http://${lanIp}:${listenPort}`);
  }
  serverLogs.push(`控制面板已启动，端口: ${listenPort}`);
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  addLog(`[错误] ${err.message}`);
  res.status(500).json({ error: '服务器内部错误' });
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