const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function uploadImage(file, folder = 'issues') {
  if (!file || !file.buffer) {
    return Promise.reject(new Error('No file buffer provided to uploadImage'));
  }

  // Fallback to local storage if Cloudinary credentials are not configured
  if (!hasCloudinary) {
    try {
      const uploadDir = path.join(__dirname, '..', 'uploads', folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const origName = file.originalname || 'upload.jpg';
      const ext = path.extname(origName) || '.jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
      const filePath = path.join(uploadDir, filename);

      fs.writeFileSync(filePath, file.buffer);

      const port = process.env.PORT || 5000;
      const fileUrl = `http://localhost:${port}/uploads/${folder}/${filename}`;
      return Promise.resolve(fileUrl);
    } catch (fsErr) {
      console.error('Local file write error:', fsErr);
      return Promise.reject(fsErr);
    }
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `urban-eye/${folder}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(file.buffer);
  });
}

module.exports = { uploadImage };
