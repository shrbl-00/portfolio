try { require('./env-load'); } catch (_) {}

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const PORT = 3000;
const ROOT = __dirname;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Match the last segment of asset_folder to a display category
const SEGMENT_TO_CATEGORY = {
  'edits':          'Editing',
  'editing':        'Editing',
  'motion graphic': 'Motion Graphics',
  'motion graphics':'Motion Graphics',
  'music videos':   'Music Videos',
  'music video':    'Music Videos',
  'shortform':      'Short Form',
  'short form':     'Short Form',
};

function categoryFromAssetFolder(assetFolder) {
  if (!assetFolder) return null;
  const segment = assetFolder.toLowerCase().split('/').pop();
  return SEGMENT_TO_CATEGORY[segment] || null;
}

// Cloudinary appends _xxxxxx (6 random alphanumeric chars) to public_ids
function cleanTitle(displayName) {
  return displayName
    .replace(/_[a-z0-9]{6}$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

// Build a Cloudinary thumbnail URL — f_jpg converts to JPEG, so_20p seeks to 20%
function makeThumbnail(secureUrl) {
  return secureUrl
    .replace('/video/upload/', '/video/upload/f_jpg,so_20p/')
    .replace(/\/v\d+\//, '/')
    .replace(/\.[^/.]+$/, '.jpg');
}

// Fetch all video resources from Cloudinary, following pagination cursors
function cloudinaryFetchAll() {
  return new Promise(async (resolve, reject) => {
    const auth    = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
    const results = [];
    let cursor    = null;

    try {
      do {
        const qs  = `max_results=100&type=upload${cursor ? '&next_cursor=' + cursor : ''}`;
        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video?${qs}`;

        const data = await new Promise((res, rej) => {
          https.get(url, { headers: { Authorization: `Basic ${auth}` } }, (r) => {
            let body = '';
            r.on('data', c => body += c);
            r.on('end', () => { try { res(JSON.parse(body)); } catch (e) { rej(e); } });
          }).on('error', rej);
        });

        for (const r of (data.resources || [])) {
          const category = categoryFromAssetFolder(r.asset_folder);
          if (!category) continue;

          results.push({
            path:      r.secure_url,
            thumbnail: makeThumbnail(r.secure_url),
            title:     cleanTitle(r.display_name || r.public_id.split('/').pop()),
            category,
            folder:    (r.asset_folder || '').split('/').pop(),
          });
        }

        cursor = data.next_cursor || null;
      } while (cursor);

      resolve(results);
    } catch (e) { reject(e); }
  });
}

// 5-minute in-memory cache — avoids hitting Cloudinary on every page load
let cache     = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getVideos() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  cache     = await cloudinaryFetchAll();
  cacheTime = Date.now();
  return cache;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;

  if (pathname === '/api/videos') {
    try {
      const videos = await getVideos();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(videos));
    } catch (err) {
      console.error('[API] /api/videos error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  let filePath = path.join(ROOT, decodeURIComponent(pathname));
  if (pathname === '/' || pathname === '') filePath = path.join(ROOT, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => console.log(`Portfolio server → http://localhost:${PORT}`));
