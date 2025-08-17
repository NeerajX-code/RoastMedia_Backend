const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  image: { type: String, required: true },
  caption: { type: String, required: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  likesCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
});

const PostModel = mongoose.model("Post", postSchema);

module.exports = PostModel;
