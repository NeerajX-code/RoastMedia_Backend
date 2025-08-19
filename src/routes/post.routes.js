const express = require("express");
const router = express.Router();

const AuthMiddleware = require("../middleware/auth.middleware");

const {
  createPostController,
  createCommentController,
  getCommentController,
  LikeController,
  DisLikeController,
  asyncGenerateCaption,
  asyncGetPosts,
  GetPostsByUserId
} = require("../controllers/post.controllers");

const multer = require("multer");
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

router.get("/get/random", asyncGetPosts);
router.get("/get/posts/user/:id",GetPostsByUserId);

module.exports = router;
