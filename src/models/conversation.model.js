const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }], // always size 2 for 1:1
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

const ConversationModel = mongoose.model("Conversation", conversationSchema);
module.exports = ConversationModel;
