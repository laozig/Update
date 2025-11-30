const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const https = require('https');

const app = express();
const port = process.env.PORT || 33001;
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

// 下载日志去重缓存（防止短时间内重复记录）
const downloadLogCache = new Map();
const DOWNLOAD_LOG_CACHE_TTL = 5000; // 5秒内的重复请求不重复记录

// IP归属地缓存
const ipLocationCache = new Map();
const IP_LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

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
  
  // 清理过期的IP归属地缓存
  const now = Date.now();
  const cutoffTime = now - IP_LOCATION_CACHE_TTL;
  for (const [ip, cached] of ipLocationCache.entries()) {
    if (cached.timestamp < cutoffTime) {
      ipLocationCache.delete(ip);
    }
  }
  
  // 如果缓存过大，清理最老的一半
  if (ipLocationCache.size > 1000) {
    const entries = Array.from(ipLocationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, Math.floor(entries.length / 2));
    toDelete.forEach(([ip]) => ipLocationCache.delete(ip));
  }
};

// 定期检查日志大小（每小时检查一次）
setInterval(checkAndRotateLogs, 60 * 60 * 1000);

// 启动时检查一次日志大小
checkAndRotateLogs();

// 验证并提取 IPv4 地址
const extractIPv4 = (ip) => {
  if (!ip) return null;
  
  // 如果是 IPv6 映射的 IPv4（格式：::ffff:xxx.xxx.xxx.xxx），提取 IPv4 部分
  if (ip.startsWith('::ffff:')) {
    const ipv4 = ip.replace(/^::ffff:/, '');
    // 验证是否是有效的 IPv4 格式
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ipv4)) {
      return ipv4;
    }
  }
  
  // 如果已经是 IPv4 格式，直接返回
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip;
  }
  
  // 如果是纯 IPv6 地址，返回 null（跳过）
  return null;
};

// 获取客户端IP地址（支持反向代理）
const getClientIp = (req) => {
  // 优先使用 Express 的 req.ip（需要 trust proxy 设置）
  if (req.ip && req.ip !== '::ffff:127.0.0.1' && req.ip !== '::1') {
    const ip = extractIPv4(req.ip);
    if (ip && ip !== '127.0.0.1') {
      return ip;
    }
  }
  
  // 尝试从 X-Forwarded-For 头获取（反向代理场景）
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For 可能包含多个 IP（第一个是客户端真实 IP）
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    for (const realIp of ips) {
      const ipv4 = extractIPv4(realIp);
      if (ipv4 && ipv4 !== '127.0.0.1') {
        return ipv4;
      }
    }
  }
  
  // 尝试从 X-Real-IP 头获取（Nginx 等代理服务器）
  const realIp = req.headers['x-real-ip'];
  if (realIp && realIp !== '::1') {
    const ipv4 = extractIPv4(realIp);
    if (ipv4 && ipv4 !== '127.0.0.1') {
      return ipv4;
    }
  }
  
  // 最后尝试从连接信息获取
  const ip = req.connection?.remoteAddress || 
             req.socket?.remoteAddress ||
             (req.connection?.socket ? req.connection.socket.remoteAddress : null);
  
  if (ip) {
    const cleanedIp = extractIPv4(ip);
    if (cleanedIp && cleanedIp !== '127.0.0.1' && cleanedIp !== '::1') {
      return cleanedIp;
    }
  }
  
  return 'unknown';
};

// 使用ip.sb API查询IP归属地（更准确，特别是对中国IP）
const queryIpLocationFromIpSb = (ip) => {
  return new Promise((resolve) => {
    const url = `https://api.ip.sb/geoip/${ip}`;
    const timeout = setTimeout(() => {
      resolve(null);
    }, 2000);

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, (res) => {
      // 检查状态码
      if (res.statusCode !== 200) {
        clearTimeout(timeout);
        resolve(null);
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(data);
          // ip.sb API返回格式：{country, region, city, isp, organization, ...}
          if (result.country || result.region || result.city) {
            const locationParts = [];
            if (result.country) locationParts.push(result.country);
            if (result.region) locationParts.push(result.region);
            if (result.city) locationParts.push(result.city);
            if (result.isp) locationParts.push(result.isp);
            
            const location = locationParts.length > 0 ? locationParts.join(' ') : null;
            resolve(location);
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      });
    }).on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
};

// 使用ip-api.com API查询IP归属地（备选方案）
const queryIpLocationFromIpApi = (ip) => {
  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,country,regionName,city,isp`;
    const timeout = setTimeout(() => {
      resolve(null);
    }, 2000);

    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(data);
          if (result.status === 'success') {
            const locationParts = [];
            if (result.country) locationParts.push(result.country);
            if (result.regionName) locationParts.push(result.regionName);
            if (result.city) locationParts.push(result.city);
            if (result.isp) locationParts.push(result.isp);
            
            const location = locationParts.length > 0 ? locationParts.join(' ') : null;
            resolve(location);
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      });
    }).on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
};

// 获取IP归属地信息
const getIpLocation = async (ip) => {
  // 跳过本地IP和unknown
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return null;
  }

  // 检查缓存
  if (ipLocationCache.has(ip)) {
    const cached = ipLocationCache.get(ip);
    if (Date.now() - cached.timestamp < IP_LOCATION_CACHE_TTL) {
      return cached.location;
    }
    ipLocationCache.delete(ip);
  }

  try {
    // 优先使用ip.sb API（更准确，特别是对中国IP），如果失败则使用ip-api.com作为备选
    let location = await queryIpLocationFromIpSb(ip);
    
    // 如果ip.sb查询失败，尝试使用ip-api.com
    if (!location) {
      location = await queryIpLocationFromIpApi(ip);
    }
    
    // 缓存结果
    if (location) {
      ipLocationCache.set(ip, {
        location: location,
        timestamp: Date.now()
      });
    }
    
    return location;
  } catch (err) {
    return null;
  }
};

// 清除指定IP的归属地缓存（用于重新查询）
const clearIpLocationCache = (ip) => {
  if (ip) {
    ipLocationCache.delete(ip);
  } else {
    // 如果不指定IP，清除所有缓存
    ipLocationCache.clear();
  }
};

// 记录下载日志
const logDownload = async (projectId, version, fileName, clientIp, userAgent, status = '成功') => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    
    // 生成去重键：项目ID + 版本 + IP + 文件名 + 状态（同一秒内的相同下载只记录一次）
    const cacheKey = `${projectId}|${version}|${clientIp}|${fileName}|${status}`;
    const nowTime = now.getTime();
    
    // 检查是否在短时间内已经记录过相同的下载
    if (downloadLogCache.has(cacheKey)) {
      const lastLogTime = downloadLogCache.get(cacheKey);
      if (nowTime - lastLogTime < DOWNLOAD_LOG_CACHE_TTL) {
        // 在缓存有效期内，跳过重复记录
        return;
      }
    }
    
    // 更新缓存
    downloadLogCache.set(cacheKey, nowTime);
    
    // 清理过期的缓存项（防止内存泄漏）
    if (downloadLogCache.size > 1000) {
      const cutoffTime = nowTime - DOWNLOAD_LOG_CACHE_TTL;
      for (const [key, time] of downloadLogCache.entries()) {
        if (time < cutoffTime) {
          downloadLogCache.delete(key);
        }
      }
    }
    
    // 获取IP归属地（等待查询完成，但设置超时保护）
    let ipLocation = null;
    let locationText = '';
    
    // 先检查缓存，如果有缓存则立即使用
    if (ipLocationCache.has(clientIp)) {
      const cached = ipLocationCache.get(clientIp);
      if (Date.now() - cached.timestamp < IP_LOCATION_CACHE_TTL) {
        ipLocation = cached.location;
        locationText = ipLocation ? `, 归属地: ${ipLocation}` : '';
      }
    }
    
    // 如果没有缓存，等待查询完成（设置超时保护，最多等待2.5秒）
    if (!ipLocation) {
      try {
        ipLocation = await Promise.race([
          getIpLocation(clientIp),
          new Promise((resolve) => setTimeout(() => resolve(null), 2500)) // 2.5秒超时保护
        ]);
        locationText = ipLocation ? `, 归属地: ${ipLocation}` : '';
      } catch (err) {
        // IP归属地查询失败不影响日志记录
        ipLocation = null;
        locationText = '';
      }
    }
    
    const statusText = status === '成功' ? '' : `, 状态: ${status}`;
    const logEntry = `[${timestamp}] [下载] 项目: ${projectId}, 版本: ${version}, 文件: ${fileName}, IP: ${clientIp}${locationText}, User-Agent: ${userAgent || 'unknown'}${statusText}\n`;
    
    const logFilePath = path.join(__dirname, '..', 'api-server.log');
    
    // 检查日志文件大小，必要时轮转
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size >= MAX_LOG_SIZE) {
        rotateLogFiles('api-server.log');
      }
    }
    
    // 追加日志
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
    
    // 同时输出到控制台
    const consoleLocationText = ipLocation ? ` (${ipLocation})` : '';
    console.log(`[下载记录] ${projectId} v${version} - IP: ${clientIp}${consoleLocationText}`);
  } catch (err) {
    // 即使出错也要尝试记录基本日志
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const logEntry = `[${timestamp}] [下载] 项目: ${projectId}, 版本: ${version}, 文件: ${fileName}, IP: ${clientIp}, 错误: ${err.message}\n`;
      const logFilePath = path.join(__dirname, '..', 'api-server.log');
      fs.appendFileSync(logFilePath, logEntry, 'utf8');
      console.log(`[下载记录-错误] ${projectId} v${version} - IP: ${clientIp} - 错误: ${err.message}`);
    } catch (fallbackErr) {
      console.error('记录下载日志失败（包括回退方案）:', fallbackErr);
    }
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
    // 获取客户端信息
    const clientIp = getClientIp(req);
    const userAgent = req.get('user-agent');
    
    // 记录下载日志（在下载开始前记录）
    logDownload(projectId, latestVersion.version, latestVersion.fileName, clientIp, userAgent).catch(err => {
      console.error('记录下载日志失败:', err);
    });
    
    // 使用回调处理下载完成/错误
    res.download(filePath, (err) => {
      if (err) {
        // 下载出错时也记录错误日志
        console.error(`下载失败: ${projectId} v${latestVersion.version} - ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: '文件下载失败' });
        }
      }
    });
  } else {
    // 文件不存在时也记录日志
    const clientIp = getClientIp(req);
    logDownload(projectId, latestVersion.version || 'unknown', latestVersion.fileName || 'unknown', clientIp, req.get('user-agent'), '文件不存在').catch(err => {
      console.error('记录下载日志失败:', err);
    });
    res.status(404).json({ error: `文件 ${latestVersion.fileName} 不存在` });
  }
});

// 下载指定版本（使用正则表达式匹配包含多个点的版本号，如 1.0.0.2）
// 注意：Express 路由参数默认不匹配点号，需要使用正则表达式
app.get('/download/:projectId/:version([^/]+)', (req, res) => {
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
    // 获取客户端信息
    const clientIp = getClientIp(req);
    const userAgent = req.get('user-agent');
    
    // 记录下载日志（在下载开始前记录）
    logDownload(projectId, version, versionInfo.fileName, clientIp, userAgent).catch(err => {
      console.error('记录下载日志失败:', err);
    });
    
    console.log(`下载文件: ${filePath}`);
    // 使用回调处理下载完成/错误
    res.download(filePath, (err) => {
      if (err) {
        // 下载出错时也记录错误日志
        console.error(`下载失败: ${projectId} v${version} - ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: '文件下载失败' });
        }
      }
    });
  } else {
    // 文件不存在时也记录日志
    const clientIp = getClientIp(req);
    logDownload(projectId, version, versionInfo.fileName || 'unknown', clientIp, req.get('user-agent'), '文件不存在').catch(err => {
      console.error('记录下载日志失败:', err);
    });
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
const server = app.listen(port, () => {
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
  console.log(`更新服务器运行在 http://localhost:${port}`);
  if (lanIp) {
    console.log(`局域网访问地址: http://${lanIp}:${port}`);
  }
});

// 处理端口占用错误
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[错误] 端口 ${port} 已被占用，请先停止占用该端口的进程`);
    console.error(`[提示] Windows下可使用以下命令查找并停止进程:`);
    console.error(`       netstat -ano | findstr :${port}`);
    console.error(`       taskkill /F /PID <进程ID>`);
    process.exit(1);
  } else {
    console.error(`[错误] 服务器启动失败:`, err.message);
    process.exit(1);
  }
}); 