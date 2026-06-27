const fs   = require('fs');
const path = require('path');

const FOLDER_TO_CATEGORY = {
  'shortform':      'Short Form',
  'short form':     'Short Form',
  'motion graphic': 'Motion Graphics',
  'motion graphics':'Motion Graphics',
  'editing':        'Editing',
  'edits':          'Editing',
  'music videos':   'Music Videos',
  'music video':    'Music Videos',
};

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);

module.exports = (req, res) => {
  // Try both casings — macOS is case-insensitive, Linux (Vercel) is not
  const videosDir = fs.existsSync(path.join(process.cwd(), 'Videos'))
    ? path.join(process.cwd(), 'Videos')
    : path.join(process.cwd(), 'videos');

  const result = [];

  if (!fs.existsSync(videosDir)) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
    return;
  }

  for (const folder of fs.readdirSync(videosDir)) {
    const folderPath = path.join(videosDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const category = FOLDER_TO_CATEGORY[folder.toLowerCase()] || folder;

    for (const file of fs.readdirSync(folderPath)) {
      const ext = path.extname(file).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;

      result.push({
        path: '/videos/' + encodeURIComponent(folder) + '/' + encodeURIComponent(file),
        title: path.basename(file, ext).trim(),
        category,
        folder,
      });
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(JSON.stringify(result));
};
