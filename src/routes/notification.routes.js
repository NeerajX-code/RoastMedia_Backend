const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const NotificationModel = require("../models/notification.model");

// GET my notifications
router.get("/", authMiddleware, async (req, res) => {
  try {
    const recipientId = req.user._id;
    const docs = await NotificationModel.aggregate([
      { $match: { recipient: recipientId } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      // Join actor (user)
      {
        $lookup: {
          from: "users",
          localField: "actor",
          foreignField: "_id",
          as: "actor",
        },
      },
      { $unwind: "$actor" },
      // Join actor profile to get avatarUrl
      {
        $lookup: {
          from: "userprofiles",
          localField: "actor._id",
          foreignField: "userId",
          as: "actorProfile",
        },
      },
      { $unwind: { path: "$actorProfile", preserveNullAndEmptyArrays: true } },
      // Join post
      {
        $lookup: {
          from: "posts",
          localField: "post",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: "$post" },
      // Join comment (optional)
      {
        $lookup: {
          from: "comments",
          localField: "comment",
          foreignField: "_id",
          as: "comment",
        },
      },
      { $unwind: { path: "$comment", preserveNullAndEmptyArrays: true } },
      // Keep only what we need
      {
        $project: {
          _id: 1,
          type: 1,
          read: 1,
          createdAt: 1,
          actor: { _id: "$actor._id", username: "$actor.username" },
          actorProfile: { avatarUrl: "$actorProfile.avatarUrl" },
          post: { _id: "$post._id", image: "$post.image", caption: "$post.caption" },
          comment: { _id: "$comment._id", comment: "$comment.comment" },
        },
      },
    ]);

    return res.status(200).json({ notifications: docs });
  } catch (e) {
    console.error("notifications.list", e);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// PATCH mark all as read
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await NotificationModel.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Failed to mark read" });
  }
});

// GET unread count
router.get("/unread-count", authMiddleware, async (req, res) => {
  try {
    const count = await NotificationModel.countDocuments({ recipient: req.user._id, read: false });
    return res.status(200).json({ count });
  } catch (e) {
    return res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

module.exports = router;
