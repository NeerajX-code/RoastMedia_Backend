const UserModel = require("../models//user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

async function authMiddleware(req, res, next) {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findOne({ _id: decoded.id });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

async function isUserMiddleware(req, res, next) {
  const { token } = req.cookies;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findOne({ _id: decoded.id });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = { authMiddleware, isUserMiddleware };
