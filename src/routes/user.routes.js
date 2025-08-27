const express = require("express");
const { authMiddleware, isUserMiddleware } = require("../middleware/auth.middleware");
const {
  getUserProfile,
  UpdateUserProfile,
  SearchUsers,
  getUserProfilebyId,
} = require("../controllers/user.controllers");
const { followUser, unfollowUser, getFollowers, getFollowing, checkIsFollowing } = require("../controllers/follow.controllers");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.get("/profile", authMiddleware, getUserProfile);
router.patch(
  "/profile",
  authMiddleware,
  upload.single("avatar"),
  UpdateUserProfile
);
router.get("/find", SearchUsers);
router.get("/get/userProfile/:id", getUserProfilebyId);
// follow routes
router.post("/:id/follow", authMiddleware, followUser);
router.post("/:id/unfollow", authMiddleware, unfollowUser);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id/is-following", isUserMiddleware, checkIsFollowing);
router.get("/profile", authMiddleware, getUserProfile);

router.get("/find", SearchUsers);

router.get("/get/userProfile/:id", getUserProfilebyId);

router.patch(
  "/update-profile",
  authMiddleware,
  upload.single("profilePic"),
  UpdateUserProfile
);

module.exports = router;
