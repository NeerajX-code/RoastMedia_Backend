const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { getUserProfile ,SearchUsers } = require("../controllers/user.controllers");

const router = express.Router();

router.get("/profile",authMiddleware,getUserProfile);
router.get("/find",SearchUsers);

module.exports = router;
