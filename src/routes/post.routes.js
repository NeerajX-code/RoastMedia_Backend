const express = require("express");
const router = express.Router();

const AuthMiddleware = require("../middleware/auth.middleware");

const {
  createPostController,
  createCommentController,
  getCommentController,
  CreateLikeController,
} = require("../controllers/post.controllers");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", AuthMiddleware, upload.single("image"), createPostController);

router.post("/comment", AuthMiddleware, createCommentController);
router.get("/comments", getCommentController);

router.post("/like/:postId", AuthMiddleware, CreateLikeController);

module.exports = router;
