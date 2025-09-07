const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document"],
      required: true,
    },

    content: { type: String }, // text message
    mediaUrl: { type: String }, // imagekit url
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "message" },
    fileId: { type: String, default: null }, // imagekit fileId for deletion
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
  },
  { timestamps: true }
);

const messageModel = mongoose.model("message", messageSchema);

module.exports = messageModel;
