var ImageKit = require("imagekit");

var imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function uploadImage(file, filename) {
  const response = await imagekit
    .upload({
      file: file,
      fileName: filename,
    })
    .catch((error) => {
      console.log(error);
    });

  return {
    fileId: response.fileId,
    url: response.url,
  };
}

async function deleteImage(fileId) {
  return new Promise((resolve, reject) => {
    imagekit.deleteFile(fileId, function (error, result) {
      if (error) {
        console.error("Image delete error:", error);
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = { uploadImage, deleteImage };
