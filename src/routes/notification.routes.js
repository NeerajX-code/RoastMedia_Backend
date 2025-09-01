const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const NotificationModel = require("../models/notification.model");

// GET my notifications
router.get("/", authMiddleware, async (req, res) => {
  try {
    const docs = await NotificationModel.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actor", "username")
      .populate("post", "image caption")
  .populate("comment", "comment")
      .lean();

    return res.status(200).json({ notifications: docs });
  } catch (e) {
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
