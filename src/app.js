const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRouter = require("./routes/auth.routes");
const postRouter = require("./routes/post.routes");
const userRouter = require("./routes/user.routes");
const notificationRouter = require("./routes/notification.routes");
const path = require("path");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));

const allowedOrigins = [
  "http://localhost:5173",
  "https://roastmedia-frontend.onrender.com",
  "https://kj5qc8fs-5173.inc1.devtunnels.ms",
  "https://z45l08wm-5173.inc1.devtunnels.ms",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use("/api/auth", authRouter);
app.use("/api/post", postRouter);
app.use("/api/user", userRouter);
app.use("/api/notifications", notificationRouter);

app.get("*name", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

module.exports = app;
