const jwt = require("jsonwebtoken");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");

// in-memory userId -> socketId map
const onlineUsers = new Map();
// Calls removed: no active call tracking

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

    // On connect: mark any messages to me as delivered and notify senders for double ticks
    (async () => {
      try {
        const undelivered = await Message.find({ receiver: userId, deliveredAt: null })
          .select("_id sender conversation")
          .lean();
        if (!undelivered.length) return;
        const deliveredAt = new Date();
        await Message.updateMany({ _id: { $in: undelivered.map((m) => m._id) } }, { $set: { deliveredAt } });
        // group by sender+conversation so sender clients can update per-thread
        const groups = new Map();
        for (const m of undelivered) {
          const key = `${String(m.sender)}:${String(m.conversation)}`;
          if (!groups.has(key)) groups.set(key, { sender: String(m.sender), conversationId: String(m.conversation), ids: [] });
          groups.get(key).ids.push(String(m._id));
        }
        for (const { sender, conversationId, ids } of groups.values()) {
          io.to(sender).emit("chat:delivered", { conversationId, messageIds: ids, deliveredAt });
        }
      } catch (e) {
        console.warn("[socket] deliver-on-connect failed", e);
      }
    })();

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

    // When a user opens a conversation, mark any pending messages as delivered and notify the other side
    socket.on("chat:open", async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        const convo = await Conversation.findById(conversationId).lean();
        if (!convo) return;
        const isParticipant = convo.participants.some((p) => String(p) === String(userId));
        if (!isParticipant) return;
        const deliveredAt = new Date();
        const pending = await Message.find({ conversation: conversationId, receiver: userId, deliveredAt: null })
          .select("_id")
          .lean();
        if (!pending.length) return;
        await Message.updateMany({ _id: { $in: pending.map((m) => m._id) } }, { $set: { deliveredAt } });
        const other = String(convo.participants.find((p) => String(p) !== String(userId)) || "");
        if (other) io.to(other).emit("chat:delivered", { conversationId: String(conversationId), messageIds: pending.map((m) => String(m._id)), deliveredAt });
      } catch (e) {
        console.warn("[socket] chat:open failed", e);
      }
    });

  // Chat-only: no jitsi:* or sp:* signaling

    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected", { userId: String(userId), reason });
      onlineUsers.delete(userId);
  // Chat-only: no pending invites to clean
    });
  });
}

module.exports = { setupSocket };
