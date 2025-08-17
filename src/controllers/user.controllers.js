const UserProfileModel = require("../models/userProfile.model");
const { uploadImage, deleteImage } = require("../services/cloud.service");
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

  try {
    // Get fields from body
    const { displayName, bio } = req.body;

    // If nothing to update, return early
    if (!file && displayName === undefined && bio === undefined) {
      return res.status(400).json({ message: "No fields provided to update." });
    }

    // Find existing profile first
    const userProfile = await UserProfileModel.findOne({ userId: user._id });
    if (!userProfile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    // Update fields if provided
    if (displayName !== undefined) {
      if (displayName.trim() === "") {
        return res
          .status(400)
          .json({ message: "Display name cannot be empty." });
      }
      userProfile.displayName = displayName;
    }

    if (bio !== undefined) {
      userProfile.bio = bio;
    }

    if (file) {
      // Delete old avatar if exists
      if (userProfile.avatarFieldId) {
        try {
          await deleteImage(userProfile.avatarFieldId);
        } catch (err) {
          console.error("Error deleting old avatar:", err);
        }
      }

      // Upload new avatar
      const { fileId, url } = await uploadImage(file.buffer, uuidv4());
      userProfile.avatarFieldId = fileId;
      userProfile.avatarUrl = url;
    }

    // Save updated profile
    await userProfile.save();

    return res.status(200).json({
      message: "Profile updated successfully.",
      userProfile,
    });
  } catch (error) {
    console.error("UpdateUserProfile Error:", error);
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
      return res.status(200).json({
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

module.exports = {
  getUserProfile,
  UpdateUserProfile,
  SearchUsers,
};
