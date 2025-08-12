const UserModel = require("../models/user.Model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

async function registerController(req, res) {
  const { username, password } = req.body;

  const existingUser = await UserModel.findOne({ username });

  if (existingUser) {
    return res.status(409).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await UserModel.create({
    username,
    password: hashedPassword,
  }).then((user) => {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.cookie("token", token);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
      },
    });

  })
  .catch((err) => {
    console.error("Error registering user:", err);
    return res.status(500).json({ message: "Internal server error" });
  });

}

async function loginController(req, res) {
    const {username, password} = req.body;

    const user = await UserModel.findOne({ username });

    if (!user) {
        return res.status(401).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password , user.password);

    if(!isPasswordValid) {
        return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.cookie("token", token);

    return res.status(200).json({
        message: "User logged in successfully",
    });
    
}

module.exports = {
  registerController,
  loginController
};
