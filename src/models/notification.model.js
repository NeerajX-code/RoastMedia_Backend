const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    type: { type: String, enum: ["like", "comment"], required: true },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const NotificationModel = mongoose.model("Notification", notificationSchema);
module.exports = NotificationModel;
