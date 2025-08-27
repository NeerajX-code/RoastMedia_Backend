const FollowModel = require("../models/follow.model");
const UserProfileModel = require("../models/userProfile.model");
const { Types } = require("mongoose");

async function followUser(req, res) {
  try {
    const userId = req.user?._id;
    const { id: targetId } = req.params;

    if (!Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId.equals(targetId)) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const exists = await FollowModel.findOne({ followerId: userId, followingId: targetId });
    if (exists) {
      return res.status(200).json({ message: "Already following" });
    }

    await FollowModel.create({ followerId: userId, followingId: targetId });

    // increment counts
    await Promise.all([
      UserProfileModel.updateOne({ userId }, { $inc: { followingCount: 1 } }),
      UserProfileModel.updateOne({ userId: targetId }, { $inc: { followersCount: 1 } }),
    ]);

    return res.status(201).json({ message: "Followed successfully" });
  } catch (error) {
    console.error("followUser error", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function unfollowUser(req, res) {
  try {
    const userId = req.user?._id;
    const { id: targetId } = req.params;

    if (!Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId.equals(targetId)) {
      return res.status(400).json({ message: "You cannot unfollow yourself" });
    }

    const removed = await FollowModel.findOneAndDelete({ followerId: userId, followingId: targetId });
    if (!removed) {
      return res.status(200).json({ message: "Not following" });
    }

    // decrement counts safely
    await Promise.all([
      UserProfileModel.updateOne({ userId }, { $inc: { followingCount: -1 } }),
      UserProfileModel.updateOne({ userId: targetId }, { $inc: { followersCount: -1 } }),
    ]);

    return res.status(200).json({ message: "Unfollowed successfully" });
  } catch (error) {
    console.error("unfollowUser error", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getFollowers(req, res) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const followers = await FollowModel.find({ followingId: id })
      .populate({ path: "followerId", select: "username _id" })
      .lean();

    const profiles = await UserProfileModel.find({ userId: { $in: followers.map(f => f.followerId._id) } })
      .select("userId displayName avatarUrl")
      .lean();

    const profileMap = new Map(profiles.map(p => [p.userId.toString(), p]));
    const result = followers.map(f => ({
      _id: f._id,
      user: {
        _id: f.followerId._id,
        username: f.followerId.username,
        displayName: profileMap.get(f.followerId._id.toString())?.displayName || "",
        avatarUrl: profileMap.get(f.followerId._id.toString())?.avatarUrl || "",
      },
      followedAt: f.followedAt,
    }));

    return res.status(200).json({ followers: result });
  } catch (error) {
    console.error("getFollowers error", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getFollowing(req, res) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const following = await FollowModel.find({ followerId: id })
      .populate({ path: "followingId", select: "username _id" })
      .lean();

    const profiles = await UserProfileModel.find({ userId: { $in: following.map(f => f.followingId._id) } })
      .select("userId displayName avatarUrl")
      .lean();

    const profileMap = new Map(profiles.map(p => [p.userId.toString(), p]));
    const result = following.map(f => ({
      _id: f._id,
      user: {
        _id: f.followingId._id,
        username: f.followingId.username,
        displayName: profileMap.get(f.followingId._id.toString())?.displayName || "",
        avatarUrl: profileMap.get(f.followingId._id.toString())?.avatarUrl || "",
      },
      followedAt: f.followedAt,
    }));

    return res.status(200).json({ following: result });
  } catch (error) {
    console.error("getFollowing error", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function checkIsFollowing(req, res) {
  try {
    const user = req.user; // optional, may be null
    const { id } = req.params; // target profile

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!user) return res.status(200).json({ isFollowing: false });
    if (user._id.equals(id)) return res.status(200).json({ isFollowing: false });

    const exists = await FollowModel.exists({ followerId: user._id, followingId: id });
    return res.status(200).json({ isFollowing: !!exists });
  } catch (error) {
    console.error("checkIsFollowing error", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { followUser, unfollowUser, getFollowers, getFollowing, checkIsFollowing };
