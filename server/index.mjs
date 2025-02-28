import express from "express";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

if (!MONGO_URI) {
  throw new Error("MongoDB URI is not defined!");
}

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
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
      if (!hostId || typeof hostId !== "string") {
        socket.emit("error", "Invalid hostId");
        return;
      }
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
      if (!meetingId || !userId || typeof meetingId !== "string" || typeof userId !== "string") {
        socket.emit("error", "Invalid meetingId or userId");
        return;
      }
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
        if (!meetingId || !callerId || !userId || !offer) return;
        socket.to(meetingId).emit("offer", { callerId, userId, offer });
      });

      socket.on("answer", ({ meetingId, callerId, answer }) => {
        if (!meetingId || !callerId || !answer) return;
        socket.to(meetingId).emit("answer", { callerId, answer });
      });

      socket.on("candidate", ({ meetingId, callerId, candidate }) => {
        if (!meetingId || !callerId || !candidate) return;
        socket.to(meetingId).emit("candidate", { callerId, candidate });
      });

      socket.on("message", ({ meetingId, sender, text }) => {
        if (!meetingId || !sender || !text) return;
        io.to(meetingId).emit("createMessage", { sender, text, timestamp: new Date() });
      });

      socket.on("disconnect", async () => {
        socket.to(meetingId).emit("user-disconnected", userId);
        activeUsers.get(meetingId)?.delete(userId);
        if (activeUsers.get(meetingId)?.size === 0) {
          activeUsers.delete(meetingId);
          try {
            await Meeting.deleteOne({ meetingId: meetingId });
            console.log(`Meeting ${meetingId} has been deleted`);
          } catch (error) {
            console.error(`Error deleting meeting ${meetingId}:`, error);
          }
        }
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