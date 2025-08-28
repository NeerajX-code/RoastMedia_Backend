const jwt = require("jsonwebtoken");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");

// in-memory userId -> socketId map
const onlineUsers = new Map();

function authSocket(handshake) {
  try {
    // Prefer token from handshake auth if provided
    let token = handshake.auth?.token;
    if (!token) {
      // Fallback to cookie named 'token'
      const cookieHeader = handshake.headers?.cookie || "";
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const idx = c.indexOf("=");
          if (idx === -1) return [c.trim(), ""];
          const key = c.slice(0, idx).trim();
          const val = c.slice(idx + 1).trim();
          return [key, decodeURIComponent(val)];
        })
      );
      token = cookies.token;
    }
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (e) {
    return null;
  }
}

async function getOrCreateConversation(a, b) {
  const participants = [a, b].sort();
  let convo = await Conversation.findOne({ participants: { $all: participants } });
  if (!convo) {
    convo = await Conversation.create({ participants });
  }
  return convo;
}

function setupSocket(io) {
  io.on("connection", (socket) => {
    const userId = authSocket(socket.handshake);
    if (!userId) {
      console.warn("[socket] auth failed: missing/invalid token; headers:", {
        origin: socket.handshake.headers?.origin,
        referer: socket.handshake.headers?.referer,
      });
      socket.disconnect(true);
      return;
    }

    console.log("[socket] connected", { userId: String(userId), transport: socket.conn.transport.name });
    onlineUsers.set(userId, socket.id);
    socket.join(userId); // room per user id

    socket.on("chat:send", async ({ to, text, mediaUrl, mediaType }) => {
      if (!to || (!text && !mediaUrl)) return;
      const convo = await getOrCreateConversation(userId, to);
      const msg = await Message.create({
        conversation: convo._id,
        sender: userId,
        receiver: to,
        text: text || "",
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        deliveredAt: null,
      });
      convo.lastMessage = text || (mediaType?.startsWith("image/") ? "📷 Photo" : mediaType?.startsWith("audio/") ? "🎤 Audio" : "Attachment");
      convo.lastMessageAt = new Date();
      await convo.save();

      // echo to sender immediately with sent state (no deliveredAt)
      socket.emit("chat:message", {
        _id: msg._id,
        conversation: convo._id,
        sender: userId,
        receiver: to,
  text: msg.text,
  mediaUrl: msg.mediaUrl,
  mediaType: msg.mediaType,
        createdAt: msg.createdAt,
        deliveredAt: null,
        seenAt: msg.seenAt,
      });

      // deliver to receiver if online: set deliveredAt and notify both sides
      const receiverSocketId = onlineUsers.get(String(to));
      if (receiverSocketId) {
        const deliveredAt = new Date();
        await Message.updateOne({ _id: msg._id }, { $set: { deliveredAt } });
        const deliveredMsg = {
          _id: msg._id,
          conversation: convo._id,
          sender: userId,
          receiver: to,
          text: msg.text,
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType,
          createdAt: msg.createdAt,
          deliveredAt,
          seenAt: msg.seenAt,
        };
        io.to(to).emit("chat:message", deliveredMsg);
        socket.emit("chat:delivered", { conversationId: convo._id, messageIds: [msg._id], deliveredAt });
      }
    });

    socket.on("chat:seen", async ({ conversationId, messageIds }) => {
      if (!conversationId || !messageIds?.length) return;
  await Message.updateMany(
        { _id: { $in: messageIds }, receiver: userId, conversation: conversationId },
        { $set: { seenAt: new Date() } }
      );
      io.to(userId).emit("chat:seen:ack", { conversationId, messageIds });
      try {
        const convo = await Conversation.findById(conversationId).lean();
        if (convo) {
          const other = String(convo.participants.find((p) => String(p) !== String(userId)) || "");
          if (other) io.to(other).emit("chat:seen", { conversationId, messageIds });
        }
      } catch {}
    });

    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected", { userId: String(userId), reason });
      onlineUsers.delete(userId);
    });
  });
}

module.exports = { setupSocket };
