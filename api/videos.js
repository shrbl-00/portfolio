const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER_TO_CATEGORY = {
  'motion graphic':  'Motion Graphics',
  'motion graphics': 'Motion Graphics',
  'editing':         'Editing',
  'edits':           'Editing',
  'music videos':    'Music Videos',
  'music video':     'Music Videos',
  'shortform':       'Short Form',
  'short form':      'Short Form',
};

function cleanTitle(displayName) {
  return (displayName || '')
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

module.exports = async function handler(req, res) {
  try {
    const result = await cloudinary.api.resources({
      type:          'upload',
      resource_type: 'video',
      max_results:   100,
    });

    const videos = result.resources.map(r => {
      // asset_folder holds the organised path (e.g. "Portffolio/edits")
      // take only the last segment for category lookup
      const folderPath = r.asset_folder || r.folder || '';
      const segment    = folderPath.toLowerCase().split('/').pop();
      const category   = FOLDER_TO_CATEGORY[segment] || segment;

      return {
        path:      r.secure_url,
        thumbnail: makeThumbnail(r.secure_url),
        title:     cleanTitle(r.display_name || r.public_id.split('/').pop()),
        category,
        folder:    segment,
      };
    }).filter(v => v.category);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
