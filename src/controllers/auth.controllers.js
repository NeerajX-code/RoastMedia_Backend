const UserModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const UserProfileModel = require("../models/userProfile.model");

async function registerController(req, res) {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await UserModel.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await UserModel.create({
      username,
      password: hashedPassword,
      email,
    });

    // Create JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    // Create user profile with defaults
    await UserProfileModel.create({
      userId: user._id,
    });

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true, // JS se access na ho
      secure: isProduction, // sirf production me https par
      sameSite: isProduction ? "none" : "lax", // dev me lax, prod me none
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        username: user.username,
      },
      token,
    });
  } catch (err) {
    console.error("Error registering user:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function loginController(req, res) {
  const { identifier, password } = req.body;

  const user = await UserModel.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  });

  console.log(user);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true, // JS se access na ho
    secure: isProduction, // sirf production me https par
    sameSite: isProduction ? "none" : "lax", // dev me lax, prod me none
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din
  });

  return res.status(200).json({
    message: "User logged in successfully",
    token,
  });
}

async function logoutController(req, res) {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Server error during logout" });
  }
}

module.exports = {
  registerController,
  loginController,
  logoutController,
};
