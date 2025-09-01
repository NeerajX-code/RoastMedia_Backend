require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");

connectDB();

// create socket.io server with same CORS policy as app
const allowedOrigins = [
  "http://localhost:5173",
  "https://roastmedia-frontend.onrender.com",
  "https://kj5qc8fs-5173.inc1.devtunnels.ms",
  "https://z45l08wm-5173.inc1.devtunnels.ms",
];

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

