const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  getUserProfile,
  UpdateUserProfile,
  SearchUsers,
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

module.exports = router;
