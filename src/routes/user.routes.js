const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { getUserProfile } = require("../controllers/user.controllers");

const router = express.Router();

router.get("/profile",authMiddleware,getUserProfile);

module.exports = router;
