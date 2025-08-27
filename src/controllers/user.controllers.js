const UserModel = require("../models/user.model");
const UserProfileModel = require("../models/userProfile.model");
const { uploadImage, deleteImage } = require("../services/cloud.service");
const { Types } = require("mongoose");
const { v4: uuidv4 } = require("uuid");

async function getUserProfile(req, res) {
  const user = req.user;
  try {
    const userProfile = await UserProfileModel.findOne({
      userId: user._id,
    }).populate("userId", "username");

    if (!userProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.status(200).json({
      message: "Profile fetched successfully.",
      userProfile,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({
      message: "Error in fetching profile.",
    });
  }
}

async function UpdateUserProfile(req, res) {
  const user = req.user;
  const file = req.file;
  const { displayName, bio, username } = req.body;

  try {
    if (username && username !== user.username) {
      const exists = await UserModel.findOne({
        username,
        _id: { $ne: user._id },
      });

      if (exists) {
        return res.status(400).json({ message: "Username already taken." });
      }

      user.username = username;
      await user.save();
    }

    const userProfile = await UserProfileModel.findOne({
      userId: user._id,
    }).populate("userId", "username");

    if (!userProfile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    if (displayName !== undefined) userProfile.displayName = displayName;
    if (bio !== undefined) userProfile.bio = bio;

    if (file) {
      const { url, fileId } = await uploadImage(file.buffer, uuidv4());

      userProfile.avatarFieldId &&
        (await deleteImage(userProfile.avatarFieldId));

      userProfile.avatarUrl = url;
      userProfile.avatarFieldId = fileId;
    }

    await userProfile.save();

    return res.status(200).json({
      message: "Profile updated successfully.",
      profile: userProfile.toObject(),
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
}

async function SearchUsers(req, res) {
  const { query } = req.query;

  if (!query) return res.status(200).json([]);

  try {
  const users = await UserProfileModel.aggregate([
      {
        $lookup: {
          from: "users", // join with User collection
          localField: "userId", // field in UserProfile
          foreignField: "_id", // field in User
          as: "userData", // alias
        },
      },
      { $unwind: "$userData" },
      {
        $match: {
          $or: [
            { displayName: { $regex: query, $options: "i" } },
            { "userData.username": { $regex: query, $options: "i" } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          displayName: 1,
          "userData.username": 1,
          "userData._id": 1,
          avatarUrl: 1,
        },
      },
      { $limit: 10 },
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        message: "No User Found.",
        users: [],
      });
    }

    return res.status(200).json({
      users,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server error.",
    });
  }
}

async function getUserProfilebyId(req, res) {
  const { id } = req.params;
  
  try {
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const userProfile = await UserProfileModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "users", // jis collection se join karna hai
          localField: "userId", // current collection ka field
          foreignField: "_id", // us collection ka field
          as: "userData",
        },
      },
      { $unwind: "$userData" },
      {
        $project: {
          displayName: 1,
          avatarUrl: 1,
          bio: 1,
          followersCount: 1,
          followingCount: 1,
          userId: 1,
          "userData.username": 1,
        },
      },
    ]);
    if (!userProfile.length) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.status(200).json({
      message: "user profile get successfully.",
      profile: userProfile[0],
    });
  } catch (error) {
    // Handle any errors that occur during the aggregation
    console.error(error);
    // Send an appropriate error response to the client
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  getUserProfile,
  UpdateUserProfile,
  SearchUsers,
  getUserProfilebyId,
};
