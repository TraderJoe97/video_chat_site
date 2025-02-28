import express from "express";
import http from "http";
//import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

const app = express();
//app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "";

if (!MONGO_URI) {
  throw new Error("MongoDB URI is not defined!");
}

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, methods: ["GET", "POST"] },
});

// Meeting schema
const meetingSchema = new mongoose.Schema({
  meetingId: { type: String, required: true },
  hostId: { type: String, required: true },
  meetingName: { type: String, default: "Untitled Meeting" },
  createdAt: { type: Date, default: Date.now },
});

const Meeting = mongoose.model("Meeting", meetingSchema);
const activeUsers = new Map();

// Generate Meeting ID
const generateMeetingId = () => Math.random().toString(36).substring(2, 15);

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("start-meeting", async ({ hostId, meetingName }) => {
    try {
      const meetingId = generateMeetingId();
      const newMeeting = new Meeting({ meetingId, hostId, meetingName });
      await newMeeting.save();

      socket.emit("meeting-created", newMeeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      socket.emit("error", "Unable to create meeting");
    }
  });

  socket.on("join-room", async ({ meetingId, userId }) => {
    try {
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        socket.emit("error", "Meeting not found");
        return;
      }

      socket.join(meetingId);
      if (!activeUsers.has(meetingId)) {
        activeUsers.set(meetingId, new Set());
      }
      activeUsers.get(meetingId).add(userId);

      socket.to(meetingId).emit("user-connected", userId);

      socket.on("offer", ({ meetingId, callerId, userId, offer }) => {
        socket.to(meetingId).emit("offer", { callerId, userId, offer });
      });

      socket.on("answer", ({ meetingId, callerId, answer }) => {
        socket.to(meetingId).emit("answer", { callerId, answer });
      });

      socket.on("candidate", ({ meetingId, callerId, candidate }) => {
        socket.to(meetingId).emit("candidate", { callerId, candidate });
      });

      socket.on("disconnect", () => {
        socket.to(meetingId).emit("user-disconnected", userId);
        activeUsers.get(meetingId)?.delete(userId);
      });
    } catch (error) {
      console.error("Error joining meeting:", error);
      socket.emit("error", "Unable to join the room");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
