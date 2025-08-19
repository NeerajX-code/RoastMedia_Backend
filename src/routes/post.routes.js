const express = require("express");
const router = express.Router();
const AuthMiddleware = require("../middleware/auth.middleware");
const multer = require("multer");
const {
  createPostController,
  createCommentController,
  getCommentController,
  LikeController,
  DisLikeController,
  asyncGenerateCaption,
} = require("../controllers/post.controllers");


const upload = multer({ storage: multer.memoryStorage() });

router.post("/", AuthMiddleware, upload.single("image"), createPostController);

router.post("/comment", AuthMiddleware, createCommentController);

router.get("/comments", getCommentController);

router.post("/like/:postId", AuthMiddleware, LikeController);

router.post("/dislike/:postId", AuthMiddleware, DisLikeController);

router.post(
  "/generateCaption",
  AuthMiddleware,
  upload.single("image"),
  asyncGenerateCaption
);
module.exports = router;
