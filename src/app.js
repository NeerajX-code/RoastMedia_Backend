require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRouter = require("./routes/auth.routes");
const postRouter = require("./routes/post.routes");
const userRouter = require("./routes/user.routes");
const chatRouter = require("./routes/chat.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());
// Behind Render/NGINX proxy so that req.secure and cookies work correctly
app.set("trust proxy", 1);

const allowedOrigins = (
  process.env.FRONTEND_ORIGINS
    ? process.env.FRONTEND_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        "http://localhost:5173",
        "https://roastmedia-frontend.onrender.com",
        "https://kj5qc8fs-5173.inc1.devtunnels.ms",
      ]
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use("/api/auth", authRouter);
app.use("/api/post", postRouter);
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);

module.exports = app;
