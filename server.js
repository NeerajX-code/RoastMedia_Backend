const app = require("./src/app");
const connectDB = require("./src/db/db");
const http = require("http");
const { Server } = require("socket.io");
const { setupSocket } = require("./src/socket/socket");

connectDB();

const server = http.createServer(app);

// create socket.io server with same CORS policy as app
const allowedOrigins = [
  "http://localhost:5173",
  "https://roastmedia-frontend.onrender.com",
  "https://kj5qc8fs-5173.inc1.devtunnels.ms",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  path: "/socket.io",
  allowEIO3: false,
  pingTimeout: 25000,
  pingInterval: 20000,
});

setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = { io };