const express = require("express");
const router = express.Router();

const AuthMiddleware = require("../middleware/auth.middleware");
const { createPostController } = require("../controllers/post.controllers");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });


router.post(
  "/",
  AuthMiddleware,
  upload.single("image"),
  createPostController
);

module.exports = router;
