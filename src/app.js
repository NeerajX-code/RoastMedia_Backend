require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRouter = require("./routes/auth.routes");
const postRouter = require("./routes/post.routes");
const userRouter = require("./routes/user.routes");
const chatRouter = require("./routes/chat.routes");

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
// Behind Render/NGINX proxy so that req.secure and cookies work correctly
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "https://roastmedia-frontend.onrender.com",
  "https://kj5qc8fs-5173.inc1.devtunnels.ms",
  "https://z45l08wm-5173.inc1.devtunnels.ms"
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Basic security and caching headers for faster perceived loads
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Cache GET responses lightly to improve speed for anonymous routes
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  }
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/post", postRouter);
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);

// Health check
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

module.exports = app;
