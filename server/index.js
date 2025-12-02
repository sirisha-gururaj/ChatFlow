const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);

const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const onlineUsers = new Set();

io.on("connection", (socket) => {
  // 1. Setup
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.userData = userData;
    onlineUsers.add(userData._id);
    io.emit("online users", Array.from(onlineUsers));
    socket.emit("connected");
  });

  // 2. Join Chat
  socket.on("join chat", (room) => {
    socket.join(room);
  });

  // 3. New Message
  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.channel;
    if (!chat._id) return;
    socket.to(chat._id).emit("message received", newMessageRecieved);
  });

  // 4. Typing
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  // --- NEW: Channel Events ---
  socket.on("delete channel", (channelId) => {
    // Broadcast to everyone so their UI updates immediately
    io.emit("channel deleted", channelId); 
  });

  // --- NEW: User Events ---
  socket.on("user updated", (updatedUser) => {
    // Broadcast new name to everyone
    io.emit("user updated", updatedUser);
  });

  // 5. Disconnect
  socket.on("disconnect", () => {
    if (socket.userData) {
      onlineUsers.delete(socket.userData._id);
      io.emit("online users", Array.from(onlineUsers));
    }
  });
});

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});