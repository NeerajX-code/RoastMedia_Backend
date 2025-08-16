const UserProfileModel = require("../models/userProfile.model");

async function getUserProfile(req, res) {
  const user = req.user; // Assuming req.user is set by auth middleware

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

  try {
    // Find the user's profile
    let userProfile = await UserProfileModel.findOne({ userId: user._id });

    if (!userProfile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    // Get all fields from body
    const { displayName, avatarUrl, bio } = req.body;

    if (displayName !== undefined) userProfile.displayName = displayName;
    if (avatarUrl !== undefined) userProfile.avatarUrl = avatarUrl;
    if (bio !== undefined) userProfile.bio = bio;

    await userProfile.save();

    res.json({
      message: "Profile updated successfully.",
      userProfile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error.",
    });
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
          avatarUrl:1,
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
