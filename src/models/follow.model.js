const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
  followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, //konsa user
  followingId: { type: mongoose.Schema.Types.ObjectId, ref: "user" }, //kisko follow kiya
  followedAt: { type: Date, default: Date.now },
});

const FollowModel = mongoose.model("Follow", followSchema);

module.exports = FollowModel;
