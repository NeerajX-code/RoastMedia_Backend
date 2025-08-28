const { Types } = require("mongoose");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const { uploadImage } = require("../services/cloud.service");
const { v4: uuidv4 } = require("uuid");

async function listConversations(req, res) {
  try {
    const userId = req.user._id;
    const convos = await Conversation.aggregate([
      { $match: { participants: { $in: [new Types.ObjectId(userId)] } } },
      { $sort: { lastMessageAt: -1 } },
      {
        $addFields: {
          otherUserId: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$participants",
                  as: "p",
                  cond: { $ne: ["$$p", new Types.ObjectId(userId)] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "otherUserId",
          foreignField: "_id",
          as: "otherUser",
        },
      },
  { $unwind: "$otherUser" },
      {
        $lookup: {
          from: "userprofiles",
          localField: "otherUserId",
          foreignField: "userId",
          as: "otherProfile",
        },
      },
  { $unwind: { path: "$otherProfile", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "messages",
          let: { convoId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ["$conversation", "$$convoId"] }, { $eq: ["$receiver", new Types.ObjectId(userId)] }, { $eq: ["$seenAt", null] } ] } } },
            { $count: "unread" },
          ],
          as: "unreadMeta",
        },
      },
      {
        $addFields: {
          unreadCount: { $ifNull: [ { $arrayElemAt: ["$unreadMeta.unread", 0] }, 0 ] },
        },
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          lastMessageAt: 1,
          unreadCount: 1,
          otherUser: { _id: 1, username: 1 },
          otherProfile: { $ifNull: ["$otherProfile", {}] },
        },
      },
    ]);
    return res.status(200).json({ conversations: convos });
  } catch (e) {
    console.error("listConversations", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getMessagesWithUser(req, res) {
  try {
    const userId = req.user._id;
    const { userId: otherId } = req.params;
    if (!Types.ObjectId.isValid(otherId)) return res.status(400).json({ message: "Invalid user id" });
    const otherObjId = new Types.ObjectId(otherId);

    // find or create conversation for 1:1
    let convo = await Conversation.findOne({ participants: { $all: [userId, otherObjId] } });
    if (!convo) {
      convo = await Conversation.create({ participants: [userId, otherObjId] });
    }

    // mark delivered for messages to me BEFORE fetching history
    await Message.updateMany(
      { conversation: convo._id, receiver: userId, deliveredAt: null },
      { $set: { deliveredAt: new Date() } }
    );

    const messages = await Message.find({ conversation: convo._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ conversationId: convo._id, messages });
  } catch (e) {
    console.error("getMessagesWithUser", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function markSeen(req, res) {
  try {
    const { conversationId, messageIds } = req.body;
    if (!conversationId || !Array.isArray(messageIds)) return res.status(400).json({ message: "Invalid payload" });
    await Message.updateMany(
      { _id: { $in: messageIds }, conversation: conversationId, receiver: req.user._id },
      { $set: { seenAt: new Date() } }
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("markSeen", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function uploadChatMedia(req, res) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    // Use ImageKit for images; audio also supported as binary
    const { url } = await uploadImage(file.buffer, `${uuidv4()}`);
    return res.status(200).json({ url, mime: file.mimetype });
  } catch (e) {
    console.error("uploadChatMedia", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deleteConversation(req, res) {
  try {
    const { conversationId } = req.params;
    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }
    const convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });
    const me = String(req.user._id);
    const isParticipant = convo.participants.some((p) => String(p) === me);
    if (!isParticipant) return res.status(403).json({ message: "Forbidden" });
    await Message.deleteMany({ conversation: convo._id });
    await Conversation.deleteOne({ _id: convo._id });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("deleteConversation", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function clearConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }
    const convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });
    const me = String(req.user._id);
    const isParticipant = convo.participants.some((p) => String(p) === me);
    if (!isParticipant) return res.status(403).json({ message: "Forbidden" });
    await Message.deleteMany({ conversation: convo._id });
    // Keep conversation so UI remains in place; clear last message
    convo.lastMessage = "";
    await convo.save();
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("clearConversationMessages", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { listConversations, getMessagesWithUser, markSeen, uploadChatMedia, deleteConversation, clearConversationMessages };
