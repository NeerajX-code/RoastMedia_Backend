const express = require("express");
const router = express.Router();
const {
  authMiddleware,
  isUserMiddleware,
} = require("../middleware/auth.middleware");

const multer = require("multer");
const {
  createPostController,
  createCommentController,
  getCommentController,
  ToggleLikeController,
  asyncGenerateCaption,
  asyncGetPosts,
  GetPostsByUserId,
  getPostDetailsById,
} = require("../controllers/post.controllers");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/", authMiddleware, upload.single("image"), createPostController);

router.post("/comment", authMiddleware, createCommentController);

router.get("/comments", getCommentController);

router.patch("/like/:postId", authMiddleware, ToggleLikeController);

router.post(
  "/generateCaption",
  authMiddleware,
  upload.single("image"),
  asyncGenerateCaption
);

router.get("/get/random", isUserMiddleware, asyncGetPosts);
router.get("/get/posts/user/:id", GetPostsByUserId);
router.get("/get/single-post/:id", getPostDetailsById);

module.exports = router;
