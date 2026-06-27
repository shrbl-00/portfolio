// Simple dev server — serves static files + /api/videos endpoint
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

// Map subfolder names to display category names
const FOLDER_TO_CATEGORY = {
  'shortform':     'Short Form',
  'short form':    'Short Form',
  'motion graphic':'Motion Graphics',
  'motion graphics':'Motion Graphics',
  'editing':       'Editing',
  'edits':         'Editing',
  'music videos':  'Music Videos',
  'music video':   'Music Videos',
};

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp4':  'video/mp4',
  '.mov':  'video/quicktime',
  '.webm': 'video/webm',
  '.m4v':  'video/mp4',
  '.mkv':  'video/x-matroska',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

function scanVideos() {
  const videosDir = path.join(ROOT, 'videos');
  const result = [];
  if (!fs.existsSync(videosDir)) return result;

  for (const folder of fs.readdirSync(videosDir)) {
    const folderPath = path.join(videosDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const category = FOLDER_TO_CATEGORY[folder.toLowerCase()] || folder;

    for (const file of fs.readdirSync(folderPath)) {
      const ext = path.extname(file).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;

      const title = path.basename(file, ext).trim();
      result.push({
        // URL-encode each segment individually so spaces work
        path: '/videos/' + encodeURIComponent(folder) + '/' + encodeURIComponent(file),
        title,
        category,
        folder,
      });
    }
  }

  return result;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname  = parsedUrl.pathname;

  // API — video manifest
  if (pathname === '/api/videos') {
    const videos = scanVideos();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(videos));
    return;
  }

  // Static files
  let filePath = path.join(ROOT, decodeURIComponent(pathname));

  // Default to index.html
  if (pathname === '/' || pathname === '') {
    filePath = path.join(ROOT, 'index.html');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    // Range support for video streaming
    const rangeHeader = req.headers['range'];
    if (rangeHeader && mime.startsWith('video')) {
      const total  = stat.size;
      const parts  = rangeHeader.replace(/bytes=/, '').split('-');
      const start  = parseInt(parts[0], 10);
      const end    = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${total}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type':   mime,
        'Content-Length': stat.size,
        'Accept-Ranges':  'bytes',
        'Cache-Control':  'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Portfolio server → http://localhost:${PORT}`);
});
