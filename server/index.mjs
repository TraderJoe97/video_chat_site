import express from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;

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
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  })
);

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

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});
// Use an in-memory map to track active users per meeting
const activeUsers = new Map();

io.on("connect", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("ping", (data) => {
    console.log("Received ping:", data);
    socket.emit("pong", "Hello client");
  });

  socket.on("join-room", async ({ meetingId, userId, username }) => {
    console.log(
      `Received join-room for meeting ${meetingId} from user ${username} (${userId})`
    );

    // Create or update the activeUsers set for this meeting
    if (!activeUsers.has(meetingId)) {
      activeUsers.set(meetingId, new Map());
    }
    const usersMap = activeUsers.get(meetingId);

    // Store both userId and username
    usersMap.set(userId, username || userId);

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

    // Send the username along with the userId
    socket.to(meetingId).emit("user-connected", {
      userId,
      username: username || userId,
    });

    // Send existing participants to the new user
    const existingParticipants = Array.from(usersMap.entries())
      .filter(([id]) => id !== userId)
      .map(([id, name]) => ({ userId: id, username: name }));

    if (existingParticipants.length > 0) {
      socket.emit("existing-participants", existingParticipants);
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
    console.log(
      `Offer from ${data.callerId} for ${data.userId} in meeting ${data.meetingId}`
    );
    socket.to(data.meetingId).emit("offer", {
      callerId: data.callerId,
      userId: data.userId,
      offer: data.offer,
    });
  });
  socket.on("answer", (data) => {
    console.log(`Answer from ${data.callerId} in meeting ${data.meetingId}`);
    socket
      .to(data.meetingId)
      .emit("answer", { callerId: data.callerId, answer: data.answer });
  });
  socket.on("candidate", (data) => {
    console.log(`Candidate from ${data.callerId} in meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit("candidate", {
      callerId: data.callerId,
      candidate: data.candidate,
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    // Find which meeting this socket was in
    for (const [meetingId, usersMap] of activeUsers.entries()) {
      if (usersMap.has(socket.id)) {
        // Remove the user from the meeting
        usersMap.delete(socket.id);

        // Notify other participants
        socket.to(meetingId).emit("user-disconnected", socket.id);

        // If the meeting is empty wait 30 min then remove it
        if (usersMap.size === 0) {
          setTimeout(() => {
            activeUsers.delete(meetingId);
          }, 30 * 60 * 1000);
        }

        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});