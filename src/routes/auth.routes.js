const express = require("express");
const {
  registerController,
  loginController,
  logoutController,
} = require("../controllers/auth.controllers");

const router = express.Router();

router.post("/register", registerController);

router.post("/login", loginController);

router.post("/logout", logoutController);

module.exports = router;
