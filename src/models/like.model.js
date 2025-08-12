const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);


const LikeModel = mongoose.model("Like",LikeSchema);

module.exports = LikeModel;