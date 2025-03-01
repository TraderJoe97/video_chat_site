import express from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

if (!MONGO_URI) {
  throw new Error("MongoDB URI is not defined!");
}

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Meeting schema with unique meetingId and enforce collection name "meetings"
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

const app = express();
app.use(express.json());

// Test route to see saved meetings
app.get("/test-meetings", async (req, res) => {
  try {
    const meetings = await Meeting.find({});
    res.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});

// Use an in-memory map to track active users per meeting
const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", async ({ meetingId, userId }) => {
    console.log(`Received join-room for meeting ${meetingId} from user ${userId}`);

    // Create or update the activeUsers set for this meeting
    if (!activeUsers.has(meetingId)) {
      activeUsers.set(meetingId, new Set());
    }
    const usersSet = activeUsers.get(meetingId);
    if (usersSet.has(userId)) {
      console.warn(`User ${userId} is already registered for meeting ${meetingId}`);
    } else {
      usersSet.add(userId);
      // Optionally create the meeting record if not exists
      try {
        let meeting = await Meeting.findOne({ meetingId });
        if (!meeting) {
          meeting = new Meeting({
            meetingId,
            hostId: userId, // first to join becomes host
            meetingName: "Meeting " + meetingId,
          });
          console.log("Creating new meeting record:", meeting);
          await meeting.save().catch((err) => console.error("Save error:", err));
        }
      } catch (error) {
        console.error("Error in join-room meeting check:", error);
      }
      socket.join(meetingId);
      socket.to(meetingId).emit("user-connected", userId);
    }
  });

  // Relay chat messages
  socket.on("message", (messageData) => {
    console.log("Received message:", messageData);
    const { meetingId } = messageData;
    io.to(meetingId).emit("createMessage", messageData);
  });

  // WebRTC signaling: offer, answer, candidate events
  socket.on("offer", (data) => {
    console.log(`Offer from ${data.callerId} for ${data.userId} in meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit("offer", { callerId: data.callerId, userId: data.userId, offer: data.offer });
  });
  socket.on("answer", (data) => {
    console.log(`Answer from ${data.callerId} in meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit("answer", { callerId: data.callerId, answer: data.answer });
  });
  socket.on("candidate", (data) => {
    console.log(`Candidate from ${data.callerId} in meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit("candidate", { callerId: data.callerId, candidate: data.candidate });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    // Cleanup: Remove user from activeUsers if you maintain a mapping for disconnect.
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
