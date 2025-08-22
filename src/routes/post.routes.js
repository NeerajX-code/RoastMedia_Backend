const express = require("express");
const router = express.Router();
const {
  authMiddleware,
  isUserMiddleware
} = require("../middleware/auth.middleware");

const multer = require("multer");
const {
  createPostController,
  createCommentController,
  getCommentController,
  LikeController,
  DisLikeController,
  asyncGenerateCaption,
  asyncGetPosts,
  GetPostsByUserId,
} = require("../controllers/post.controllers");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/", authMiddleware, upload.single("image"), createPostController);

router.post("/comment", authMiddleware, createCommentController);

router.get("/comments", getCommentController);

router.patch("/like/:id", authMiddleware, LikeController);

router.post("/dislike/:id", authMiddleware, DisLikeController);

router.post(
  "/generateCaption",
  authMiddleware,
  upload.single("image"),
  asyncGenerateCaption
);

router.get("/get/random", isUserMiddleware, asyncGetPosts);
router.get("/get/posts/user/:id", GetPostsByUserId);

module.exports = router;
