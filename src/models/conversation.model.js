const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],

  lastMessage: {
    type: String,
    default: ''
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  }
});

conversationSchema.index({ participants: 1 });

const Conversation = mongoose.model("conversation", conversationSchema);

module.exports = Conversation;
