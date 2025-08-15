const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    displayName: { type: String, default: "New User" },
    bio: { type: String, default: "No bio yet." },
    avatarUrl: {
      type: String,
      default:
        "https://ik.imagekit.io/nkde9n0dc/AiCaption/4140061.png?updatedAt=1755237167132",
    },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const UserProfileModel = mongoose.model("UserProfile", userProfileSchema);

module.exports = UserProfileModel;
