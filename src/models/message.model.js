const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
  mediaUrl: { type: String, default: null },
  mediaType: { type: String, default: null }, // e.g., image/jpeg, audio/webm
    deliveredAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MessageModel = mongoose.model("Message", messageSchema);
module.exports = MessageModel;
