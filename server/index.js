const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// 版本信息存储
let versionInfo = {
  version: '1.0.0',
  releaseDate: new Date().toISOString(),
  downloadUrl: '/download/latest',
  releaseNotes: '初始版本'
};

// 保存版本信息到文件
const saveVersionInfo = () => {
  fs.writeFileSync(
    path.join(__dirname, 'version.json'),
    JSON.stringify(versionInfo, null, 2)
  );
};

// 从文件加载版本信息
const loadVersionInfo = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');
    versionInfo = JSON.parse(data);
  } catch (err) {
    console.log('没有找到版本文件，使用默认版本');
    saveVersionInfo();
  }
};

// 初始化加载版本信息
loadVersionInfo();

// 路由

// 获取最新版本信息
app.get('/api/version', (req, res) => {
  res.json(versionInfo);
});

// 上传新版本
app.post('/api/upload', upload.single('file'), (req, res) => {
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
  
  res.json({ 
    message: '版本更新成功',
    version: versionInfo
  });
});

// 下载最新版本
app.get('/download/latest', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', `app-${versionInfo.version}.exe`);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// 下载指定版本
app.get('/download/:version', (req, res) => {
  const { version } = req.params;
  const filePath = path.join(__dirname, 'uploads', `app-${version}.exe`);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`更新服务器运行在 http://localhost:${port}`);
}); 