   const { v2: cloudinary } = require('cloudinary');

   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET,
   });

   function uploadImage(file, folder = 'issues') {
     return new Promise((resolve, reject) => {
       const stream = cloudinary.uploader.upload_stream(
         { folder: `urban-eye/${folder}`, resource_type: 'image' },
         (err, result) => (err ? reject(err) : resolve(result.secure_url))
       );
       stream.end(file.buffer);
     });
   }

   module.exports = { uploadImage };
   