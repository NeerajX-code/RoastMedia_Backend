const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
  followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // which user follows
  followingId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // whom they follow
  followedAt: { type: Date, default: Date.now },
});

const FollowModel = mongoose.model("Follow", followSchema);

module.exports = FollowModel;
