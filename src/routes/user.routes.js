const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const multer = require("multer");
const {
  getUserProfile,
  SearchUsers,
  UpdateUserProfile,
} = require("../controllers/user.controllers");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.get("/profile", authMiddleware, getUserProfile);

router.get("/find", SearchUsers);

router.patch(
  "/update-profile",
  authMiddleware,
  upload.single("profilePic"),
  UpdateUserProfile
);

module.exports = router;
