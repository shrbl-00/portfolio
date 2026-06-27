try { require('./env-load'); } catch (_) {}

const https = require('https');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

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

function cleanTitle(displayName) {
  return displayName
    .replace(/_[a-z0-9]{6}$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function makeThumbnail(secureUrl) {
  return secureUrl
    .replace('/video/upload/', '/video/upload/f_jpg,so_20p/')
    .replace(/\/v\d+\//, '/')
    .replace(/\.[^/.]+$/, '.jpg');
}

async function cloudinaryFetchAll() {
  const auth    = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const results = [];
  let cursor    = null;

  do {
    const qs   = `max_results=100&type=upload${cursor ? '&next_cursor=' + cursor : ''}`;
    const url  = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video?${qs}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { Authorization: `Basic ${auth}` } }, (r) => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
      }).on('error', reject);
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

  return results;
}

let cache     = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

module.exports = async (req, res) => {
  try {
    if (cache && Date.now() - cacheTime < CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(cache));
    }
    cache     = await cloudinaryFetchAll();
    cacheTime = Date.now();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(cache));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
