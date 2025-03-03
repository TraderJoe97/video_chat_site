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

app.get("/test-meetings", async (req, res) => {
  try {
    const meetings = await Meeting.find({});
    res.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

app.post("/create-meeting", async (req, res) => {
  const { meetingId, hostId, meetingName } = req.body;
  try {
    const newMeeting = new Meeting({ meetingId, hostId, meetingName });
    await newMeeting.save();
    res.status(201).json(newMeeting);
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: "Failed to create meeting" });
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

    if (!activeUsers.has(meetingId)) {
      activeUsers.set(meetingId, new Map());
    }
    const usersMap = activeUsers.get(meetingId);
    usersMap.set(userId, username || userId);

    try {
      let meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        meeting = new Meeting({
          meetingId,
          hostId: userId,
          meetingName: "Meeting " + meetingId,
        });
        console.log("Creating new meeting record:", meeting);
        await meeting.save().catch((err) => console.error("Save error:", err));
      }
    } catch (error) {
      console.error("Error in join-room meeting check:", error);
    }

    socket.join(meetingId);

    socket.to(meetingId).emit("user-connected", {
      userId,
      username: username || userId,
    });

    const existingParticipants = Array.from(usersMap.entries())
      .filter(([id]) => id !== userId)
      .map(([id, name]) => ({ userId: id, username: name }));

    if (existingParticipants.length > 0) {
      socket.emit("existing-participants", existingParticipants);
    }
  });

  socket.on("message", (messageData) => {
    console.log("Received message:", messageData);
    const { meetingId } = messageData;
    io.to(meetingId).emit("createMessage", messageData);
  });

  socket.on("offer", (data) => {
    console.log(
      `Offer from ${data.callerId} for ${data.userId} in meeting ${data.meetingId}`
    );
    socket.to(data.userId).emit("offer", {
      callerId: data.callerId,
      userId: data.userId,
      offer: data.offer,
    });
  });

  socket.on("answer", (data) => {
    console.log(`Answer from ${data.callerId} in meeting ${data.meetingId}`);
    socket.to(data.callerId).emit("answer", {
      callerId: data.callerId,
      answer: data.answer,
    });
  });

  socket.on("candidate", (data) => {
    console.log(`Candidate from ${data.callerId} in meeting ${data.meetingId}`);
    socket.to(data.callerId).emit("candidate", {
      callerId: data.callerId,
      candidate: data.candidate,
    });
  });

  socket.on("stream", (data) => {
    console.log(`Stream from ${data.userId} in meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit("stream", {
      userId: data.userId,
      stream: data.stream,
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

  });
});

//check meetings and delete any without active users from databse

setInterval(() => {
  Meeting.find({}).then((meetings) => {
    meetings.forEach((meeting) => {
      if (!activeUsers.has(meeting.meetingId)) {
        Meeting.deleteOne({ meetingId: meeting.meetingId })
          .then(() => console.log(`Deleted meeting: ${meeting.meetingId}`))
          .catch((err) => console.error("Delete error:", err));
      }
    });
  });
}

)
//check active users map and delete any entries missing from serverfetchsockets

setInterval(() => {
  for (const [meetingId, usersMap] of activeUsers.entries()) {
    for (const [userId, username] of usersMap.entries()) {
      if (!serverFetchSockets.has(userId)) {
        usersMap.delete(userId);
        console.log(`${username} removed from meeting: ${meetingId}` )
      }
    }
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});