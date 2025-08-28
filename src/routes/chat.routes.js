const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const { listConversations, getMessagesWithUser, markSeen, uploadChatMedia, deleteConversation, clearConversationMessages } = require("../controllers/chat.controllers");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// GET /api/chat/conversations - list user's conversations
router.get("/conversations", authMiddleware, listConversations);

// GET /api/chat/with/:userId - get or create 1:1 conversation and return messages
router.get("/with/:userId", authMiddleware, getMessagesWithUser);

// POST /api/chat/seen - mark messages as seen by receiver
router.post("/seen", authMiddleware, markSeen);

// POST /api/chat/upload - upload chat media (image/audio), returns {url, mime}
router.post("/upload", authMiddleware, upload.single("file"), uploadChatMedia);

// DELETE /api/chat/:conversationId - delete conversation and its messages
router.delete("/:conversationId", authMiddleware, deleteConversation);
// DELETE only messages (clear chat content but keep conversation)
router.delete("/:conversationId/messages", authMiddleware, clearConversationMessages);

module.exports = router;
