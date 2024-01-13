require("dotenv").config();

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.MY_CLOUDINARY_NAME,
  api_key: process.env.MY_CLOUDINARY_API_KEY,
  api_secret: process.env.MY_CLOUDINARY_API_SECRET,
});

const options = {
  overwrite: true,
  invalidate: true,
  resource_type: "auto",
};

module.exports = (image) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(image, options, (err, result) => {
      if (result && result.secure_url) {
        return resolve(result.secure_url);
      }
      return reject({ error: err.message });
    });
  });
};
