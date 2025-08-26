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
  editCommentController,
  deleteCommentController,
  updateShareCountController,
  toggleSavePost,
  getSaves,
} = require("../controllers/post.controllers");

const upload = multer({ storage: multer.memoryStorage() });
console.log(upload);

router.post("/", authMiddleware, upload.single("image"), createPostController);

router.post("/comment/:postId", authMiddleware, createCommentController);
router.get("/comments/:postId", getCommentController);

router.put(
  "/comment/:postId/:commentId",
  authMiddleware,
  editCommentController
);

// Delete comment
router.delete(
  "/comment/:postId/:commentId",
  authMiddleware,
  deleteCommentController
);

router.patch("/like/:postId", authMiddleware, ToggleLikeController);

router.post(
  "/generateCaption",
  authMiddleware,
  upload.single("image"),
  asyncGenerateCaption
);

router.get("/get/random", isUserMiddleware, asyncGetPosts);
router.get("/get/posts/user/:id", GetPostsByUserId);

router.patch("/:postId/share", authMiddleware, updateShareCountController);
//router
router.get("/my-saves/", authMiddleware, getSaves);
router.post("/save/:postId", authMiddleware, toggleSavePost);

module.exports = router;
