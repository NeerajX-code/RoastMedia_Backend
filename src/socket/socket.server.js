const { Server } = require("socket.io");
const messageModel = require("../models/messages.model");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const conversationModel = require("../models/conversation.model");
const userModel = require("../models/user.model");
const { uploadImage } = require("../services/cloud.service");

const onlineUsers = new Map(); // userId -> Set of socketIds

async function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  // 🔑 Middleware: JWT auth
  io.use(async (socket, next) => {
    try {
      const { token } = cookie.parse(socket.handshake.headers.cookie || "");
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userModel.findById(decoded.id);
      if (!user) return next(new Error("Unauthorized"));

      socket.user = user;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`✅ User connected: ${userId} (${socket.id})`);

    // 🟢 Track multiple sockets per user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // 🔔 Notify participants that this user is online
    const conversations = await conversationModel
      .find({ participants: userId })
      .select("participants");

    conversations.forEach((c) => {
      c.participants.forEach((pId) => {
        if (pId.toString() !== userId && onlineUsers.has(pId.toString())) {
          io.to([...onlineUsers.get(pId.toString())]).emit("userOnline", {
            userId,
          });
        }
      });
    });

    // 📩 Update "sent" → "delivered" for all pending messages
    await messageModel.updateMany(
      { receiverId: userId, status: "sent" },
      { $set: { status: "delivered" } }
    );

    // ================== CONVERSATION JOIN ==================
    socket.on("joinConversation", async ({ otherId }) => {
      if (!otherId || otherId === userId) return;

      try {
        const participants = [userId, otherId].sort();

        let conversation = await conversationModel.findOne({ participants });
        if (!conversation) {
          conversation = await conversationModel.create({ participants });
        }

        socket.join(conversation._id.toString());

        // Send online status of other participant
        io.to(socket.id).emit("isOtherOnline", {
          conversationId: conversation._id,
          otherId,
          isOnline: onlineUsers.has(otherId),
        });

        // Send old messages
        const messages = await messageModel
          .find({ conversationId: conversation._id })
          .sort({ createdAt: 1 });

        socket.emit("conversationMessages", {
          conversationId: conversation._id,
          messages,
        });

        console.log(`📂 ${userId} joined conversation ${conversation._id}`);

        // ================== SEND MESSAGE ==================
        socket.on("sendMessage", async ({ text, media }) => {
          if (!text && !media) return;

          let mediaUrl;
          if (media) {
            mediaUrl = await uploadImage(media, `message_${Date.now()}`);
          }

          const isUserOnline = onlineUsers.has(otherId);

          const newMessage = await messageModel.create({
            conversationId: conversation._id,
            senderId: userId,
            receiverId: otherId,
            ...(text && { content: text }),
            ...(media && { mediaUrl: mediaUrl.url, fileId: mediaUrl.fileId }),
            status: isUserOnline ? "delivered" : "sent",
          });

          conversation.lastMessage =
            text || (media ? "📎 Media" : ""); // lastMessage update
          if (!isUserOnline) {
            conversation.unreadCounts.set(
              otherId,
              (conversation.unreadCounts.get(otherId) || 0) + 1
            );
          }
          await conversation.save();

          // Emit to room
          io.to(conversation._id.toString()).emit("newMessage", newMessage);
        });

        // ================== SEEN MESSAGES ==================
        socket.on("seenMessages", async (conversationId) => {
          await messageModel.updateMany(
            {
              conversationId,
              receiverId: userId,
              status: { $in: ["sent", "delivered"] },
            },
            { $set: { status: "seen" } }
          );

          const conv = await conversationModel.findById(conversationId);
          conv.unreadCounts.set(userId, 0);
          await conv.save();

          io.to(conversationId).emit("messagesSeen", {
            userId,
            conversationId,
          });
        });
      } catch (err) {
        console.error("Error in joinConversation:", err);
      }
    });

    // ================== DISCONNECT ==================
    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${userId} (${socket.id})`);

      const sockets = onlineUsers.get(userId);
      if (!sockets) return;

      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineUsers.delete(userId);

        // Notify all participants this user went offline
        const conversations = await conversationModel
          .find({ participants: userId })
          .select("participants");

        conversations.forEach((c) => {
          c.participants.forEach((pId) => {
            if (onlineUsers.has(pId.toString())) {
              io.to([...onlineUsers.get(pId.toString())]).emit("userOffline", {
                userId,
              });
            }
          });
        });
      }
    });
  });
  
}

module.exports = initSocketServer;
