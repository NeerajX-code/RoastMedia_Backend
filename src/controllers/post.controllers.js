const generateCaption = require("../services/ai.service");
const postModel = require("../models/post.model");
const uploadImage = require("../services/cloud.service");
const { v4: uuidv4 } = require("uuid");

async function createPostController(req, res) {
  
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const base64ImageFile = file.buffer.toString("base64");

    // const caption = await generateCaption(base64ImageFile);
    // const url = await uploadImage(file.buffer, uuidv4());

    const [caption, url] = await Promise.all([
      generateCaption(base64ImageFile),
      uploadImage(file.buffer, uuidv4()),
    ]);

    const post = new postModel({
      image: url,
      caption: caption,
      user: req.user._id,
    });

    return res.status(200).json({
      caption,
      post: {
        postId: post._id,
        image: url,
        caption: caption,
        user: {
          userId: req.user._id,
          username: req.user.username,
        },
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating post", error: error.message });
  }
}

module.exports = {
  createPostController,
};
