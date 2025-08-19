const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  getUserProfile,
  UpdateUserProfile,
  SearchUsers,
  getUserProfilebyId,
} = require("../controllers/user.controllers");
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
