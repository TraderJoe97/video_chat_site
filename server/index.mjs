import express from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Ensure MongoDB URI is provided
if (!MONGO_URI) {
  throw new Error("MongoDB URI is not defined!");
}

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Meeting schema (enforcing unique meetingId and a fixed collection name)
const meetingSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, unique: true },
    hostId: { type: String, required: true },
    meetingName: { type: String, default: "Untitled Meeting" },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "meetings" }
);
const Meeting = mongoose.model("Meeting", meetingSchema);

// Create Express app and middleware
const app = express();
app.use(express.json());

// Test route to verify meetings are saved in the DB
app.get("/test-meetings", async (req, res) => {
  try {
    const meetings = await Meeting.find({});
    res.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings for your frontend
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});

// An in-memory mapping to track active users per meeting (for debugging)
const activeUsers = new Map();

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // When a client joins a meeting room
  socket.on("join-room", async ({ meetingId, userId }) => {
    console.log(`User ${userId} attempting to join meeting ${meetingId}`);

    // Check if a meeting record already exists; if not, create it.
    try {
      let meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        meeting = new Meeting({
          meetingId,
          hostId: userId, // First user to join becomes host
          meetingName: "Meeting " + meetingId,
        });
        console.log("Creating new meeting record:", meeting);
        await meeting.save().catch((err) => {
          console.error("MongoDB Save Error:", err);
        });
      }
    } catch (error) {
      console.error("Error checking/creating meeting:", error);
    }

    // Add this socket to the specified meeting room
    socket.join(meetingId);
    // Update the activeUsers map
    if (!activeUsers.has(meetingId)) {
      activeUsers.set(meetingId, new Set());
    }
    activeUsers.get(meetingId)?.add(userId);
    console.log(`Active users in ${meetingId}:`, Array.from(activeUsers.get(meetingId)));

    // Notify other clients in the meeting room (excluding the joining user)
    socket.to(meetingId).emit("user-connected", userId);
  });

  // Relay chat messages: when a client sends a message, broadcast it to the meeting room
  socket.on("message", (messageData) => {
    console.log("Received message:", messageData);
    const { meetingId } = messageData;
    io.to(meetingId).emit("createMessage", messageData);
  });

  // WebRTC signaling: offer, answer, and candidate events
  socket.on("offer", (data) => {
    console.log(`Offer from ${data.callerId} for user ${data.userId} in meeting ${data.meetingId}`);
    const { meetingId, callerId, userId, offer } = data;
    socket.to(meetingId).emit("offer", { callerId, userId, offer });
  });

  socket.on("answer", (data) => {
    console.log(`Answer from ${data.callerId} in meeting ${data.meetingId}`);
    const { meetingId, callerId, answer } = data;
    socket.to(meetingId).emit("answer", { callerId, answer });
  });

  socket.on("candidate", (data) => {
    console.log(`Candidate from ${data.callerId} in meeting ${data.meetingId}`);
    const { meetingId, callerId, candidate } = data;
    socket.to(meetingId).emit("candidate", { callerId, candidate });
  });

  // Handle disconnect (cleanup and notify others)
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    // For simplicity, if you have stored meeting/user info on socket, you can remove it.
    // In production, store a mapping (e.g., socket.id -> { meetingId, userId }) to handle cleanup.
    // Here, we simply log the disconnect.
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
