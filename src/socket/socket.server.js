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
      origin: [
        "http://localhost:5173",
        "https://roastmedia-frontend.onrender.com",
        "https://kj5qc8fs-5173.inc1.devtunnels.ms/",
      ],
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

    // ================== JOIN CONVERSATION ==================
    socket.on("joinConversation", async ({ otherId }) => {
      if (!otherId || otherId === userId) return;

      console.log(`🔑 ${userId} joining conversation with ${otherId}`);

      try {
        const participants = [userId, otherId].sort();
        let conversation = await conversationModel.findOne({ participants });
        if (!conversation) {
          conversation = await conversationModel.create({ participants });
        }

        socket.join(conversation._id.toString());

        // Send online status of other participant
        socket.emit("isOtherOnline", {
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
      } catch (err) {
        console.error("Error in joinConversation:", err);
      }
    });

    // ================== SEND MESSAGE (global listener) ==================
    socket.on(
      "sendMessage",
      async ({ conversationId, otherId, text, media }) => {
        if (!conversationId || (!text && !media)) return;

        try {
          console.log(
            `✉️ Message from ${userId} to ${otherId}: ${text || "[media]"}`
          );

          let mediaUrl;
          if (media) {
            mediaUrl = await uploadImage(media, `message_${Date.now()}`);
          }

          const isUserOnline = onlineUsers.has(otherId);

          const newMessage = await messageModel.create({
            type: media ? "image" : "text",
            sender: userId,
            receiver: otherId,
            conversationId,
            ...(text && { content: text }),
            ...(media && { mediaUrl: mediaUrl.url, fileId: mediaUrl.fileId }),
            status: isUserOnline ? "delivered" : "sent",
          });

          // Update conversation lastMessage + unreadCounts
          const conversation = await conversationModel.findById(conversationId);
          conversation.lastMessage = text || (media ? "📎 Media" : "");
          if (!isUserOnline) {
            conversation.unreadCounts.set(
              otherId,
              (conversation.unreadCounts.get(otherId) || 0) + 1
            );
          }
          await conversation.save();

          // Emit to room
          const msgPayload = {
            _id: newMessage._id,
            conversationId: newMessage.conversationId,
            sender: newMessage.sender,
            receiver: newMessage.receiver,
            type: newMessage.type,
            content: newMessage.content || null,
            mediaUrl: newMessage.mediaUrl || null,
            status: newMessage.status,
            createdAt: newMessage.createdAt,
            updatedAt: newMessage.updatedAt,
          };
          io.to(conversationId.toString()).emit("newMessage", msgPayload);
        } catch (err) {
          console.error("Error in sendMessage:", err);
        }
      }
    );

    socket.on("deliveredMessages", async () => {
      // Step 1: Saare pending "sent" messages jo is user ke liye aaye hai, unko delivered mark karo
      await messageModel.updateMany(
        {
          receiver: userId,
          status: "sent",
        },
        { $set: { status: "delivered" } }
      );

      // Step 2: Saare conversations fetch karo jisme yeh user hai
      const conversations = await conversationModel
        .find({ participants: userId })
        .select("participants");

      // Step 3: Har conversation ke dusre participant (sender) ko notify karo agar online hai
      conversations.forEach((c) => {
        const senderId = c.participants.find(
          (pId) => pId.toString() !== userId.toString()
        );

        if (senderId && onlineUsers.has(senderId.toString())) {
          const senderSockets = [...onlineUsers.get(senderId.toString())];
          io.to(senderSockets).emit("messagesDelivered", {
            userId, // jis user ke paas deliver hua
            conversationId: c._id, // kis conversation ka update hai
          });
        }
      });
    });

    // ================== SEEN MESSAGES ==================
    socket.on("seenMessages", async (conversationId) => {
      await messageModel.updateMany(
        {
          conversationId,
          receiver: userId,
          status: { $in: ["sent", "delivered"] },
        },
        { $set: { status: "seen" } }
      );

      const conv = await conversationModel.findById(conversationId);

      conv.unreadCounts.set(userId, 0);
      await conv.save();

      // 👇 sender ko identify karo
      const senderId = conv.participants.find(
        (pId) => pId.toString() !== userId.toString()
      );

      // 👇 agar sender online hai toh usko event bhejo
      if (onlineUsers.has(senderId.toString())) {
        const senderSockets = [...onlineUsers.get(senderId.toString())];
        io.to(senderSockets).emit("messagesSeen", {
          userId, // jisne dekha
          conversationId,
        });
      }
    });

    // ================== DISCONNECT ==================
    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${userId} (${socket.id})`);

      console.log(onlineUsers);

      const sockets = onlineUsers.get(userId);
      if (!sockets) return;

      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineUsers.delete(userId);

        console.log(onlineUsers);

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
