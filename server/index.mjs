import express from "express"
import http from "http"
import mongoose from "mongoose"
import dotenv from "dotenv"
import { Server } from "socket.io"
import cors from "cors"

dotenv.config()

const PORT = process.env.PORT || 4000
const MONGO_URI = process.env.MONGO_URI
const FRONTEND_URL = process.env.FRONTEND_URL || "*"

if (!MONGO_URI) {
  console.warn("MongoDB URI is not defined! Running without database persistence.")
}

// MongoDB Connection
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err))
}

// Meeting Schema
const meetingSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, unique: true },
    hostId: { type: String, required: true },
    meetingName: { type: String, default: "Untitled Meeting" },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "meetings" }
)
const Meeting = mongoose.model("Meeting", meetingSchema)

// In-Memory Meetings Store (Fallback when MongoDB is absent)
const inMemoryMeetings = new Map()

// Express App Setup
const app = express()
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  })
)
app.use(express.json())

// API Routes
app.get("/test-meetings", async (req, res) => {
  if (!MONGO_URI) {
    return res.status(200).json(Array.from(inMemoryMeetings.values()))
  }
  
  try {
    const meetings = await Meeting.find({})
    res.json(meetings)
  } catch (error) {
    console.error("Error fetching meetings:", error)
    res.json(Array.from(inMemoryMeetings.values()))
  }
})

app.post("/create-meeting", async (req, res) => {
  const { meetingId, hostId, meetingName } = req.body
  const meetingData = {
    meetingId,
    hostId,
    meetingName: meetingName || "Untitled Meeting",
    createdAt: new Date(),
  }

  inMemoryMeetings.set(meetingId, meetingData)

  if (!MONGO_URI) {
    return res.status(201).json(meetingData)
  }
  
  try {
    const newMeeting = new Meeting(meetingData)
    await newMeeting.save()
    res.status(201).json(newMeeting)
  } catch (error) {
    console.error("Error creating meeting in DB, using in-memory:", error)
    res.status(201).json(meetingData)
  }
})

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "Server is running",
    database: MONGO_URI ? "connected" : "in-memory fallback"
  })
})

// HTTP Server and Socket.io Setup
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})

// Active Users Tracking
const activeUsers = new Map()

// Socket.io Connection Handling
io.on("connect", (socket) => {
  console.log("Socket connected:", socket.id)

  // Ping-Pong for Testing
  socket.on("ping", (data) => {
    console.log("Received ping:", data)
    socket.emit("pong", "Hello client")
  })

  // Join Room
  socket.on("join-room", async ({ meetingId, userId, username }) => {
    console.log(`Received join-room for meeting ${meetingId} from user ${username} (${userId})`)

    // Track user in the meeting
    if (!activeUsers.has(meetingId)) {
      activeUsers.set(meetingId, new Map())
    }
    const usersMap = activeUsers.get(meetingId)
    usersMap.set(userId, username || userId)
    
    // Associate socket ID with user ID for easier cleanup
    socket.userId = userId
    socket.meetingId = meetingId

    // Join both the meeting room and personal user room for direct signaling
    socket.join(meetingId)
    socket.join(userId)

    // Store meeting in database if MongoDB is configured
    if (MONGO_URI) {
      try {
        let meeting = await Meeting.findOne({ meetingId })
        if (!meeting) {
          meeting = new Meeting({
            meetingId,
            hostId: userId,
            meetingName: "Meeting " + meetingId,
          })
          console.log("Creating new meeting record:", meeting)
          await meeting.save().catch((err) => console.error("Save error:", err))
        }
      } catch (error) {
        console.error("Error in join-room meeting check:", error)
      }
    }

    // Notify other participants about the new user
    socket.to(meetingId).emit("user-connected", {
      userId,
      username: username || userId,
    })

    // Send existing participants to the new user
    const existingParticipants = Array.from(usersMap.entries())
      .filter(([id]) => id !== userId)
      .map(([id, name]) => ({ userId: id, username: name }))

    if (existingParticipants.length > 0) {
      socket.emit("existing-participants", existingParticipants)
    }
  })

  // Chat Messages
  socket.on("message", (messageData) => {
    if (!messageData || typeof messageData.meetingId !== "string" || !messageData.meetingId.trim()) {
      return
    }
    if (typeof messageData.content !== "string" || messageData.content.length > 2000) {
      return
    }
    console.log("Received valid message:", messageData)
    const { meetingId } = messageData
    io.to(meetingId).emit("createMessage", messageData)
  })

  // WebRTC Signaling - Offer (Unicast directly to intended user)
  socket.on("offer", (data) => {
    const targetUserId = data.targetUserId || data.userId
    console.log(`Offer from ${data.callerId} for ${targetUserId} in meeting ${data.meetingId}`)
    
    if (targetUserId) {
      io.to(targetUserId).emit("offer", {
        callerId: data.callerId,
        offer: data.offer,
        callerUsername: data.callerUsername,
      })
    }
  })

  // WebRTC Signaling - Answer (Unicast directly to intended user)
  socket.on("answer", (data) => {
    const targetUserId = data.targetUserId || data.callerId
    console.log(`Answer from ${data.userId || socket.userId} to ${targetUserId} in meeting ${data.meetingId}`)
    
    if (targetUserId) {
      io.to(targetUserId).emit("answer", {
        callerId: data.userId || socket.userId,
        answer: data.answer,
      })
    }
  })

  // WebRTC Signaling - ICE Candidate (Unicast directly to intended user)
  socket.on("candidate", (data) => {
    const targetUserId = data.targetUserId || data.userId || data.callerId
    console.log(`Candidate from ${data.callerId || socket.userId} to ${targetUserId} in meeting ${data.meetingId}`)
    
    if (targetUserId) {
      io.to(targetUserId).emit("candidate", {
        callerId: data.callerId || socket.userId,
        candidate: data.candidate,
      })
    }
  })

  // Stream Events
  socket.on("stream", (data) => {
    console.log(`Stream from ${data.userId} in meeting ${data.meetingId}`)
    socket.to(data.meetingId).emit("stream", {
      userId: data.userId,
      stream: data.stream,
    })
  })

  // Raise Hand
  socket.on("raise-hand", (data) => {
    console.log(`User ${data.userId} ${data.isRaised ? 'raised' : 'lowered'} hand in room ${data.meetingId}`)
    io.to(data.meetingId).emit("raise-hand", {
      userId: data.userId,
      isRaised: data.isRaised,
    })
  })

  // Leave Room
  socket.on("leave-room", (data) => {
    const { meetingId, userId } = data
    handleUserLeaving(socket, meetingId, userId)
  })

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
    
    // Clean up user from active meetings
    if (socket.meetingId && socket.userId) {
      handleUserLeaving(socket, socket.meetingId, socket.userId)
    }
  })
})

// Helper function to handle user leaving
function handleUserLeaving(socket, meetingId, userId) {
  if (!meetingId || !userId) return
  
  socket.leave(meetingId)

  // Check if this user still has another active socket in the meeting room
  let hasOtherActiveSocket = false
  for (const [sId, s] of io.sockets.sockets.entries()) {
    if (s.id !== socket.id && s.userId === userId && s.meetingId === meetingId) {
      hasOtherActiveSocket = true
      break
    }
  }

  if (hasOtherActiveSocket) {
    console.log(`User ${userId} still has active socket in meeting ${meetingId}, keeping user registered`)
    return
  }

  console.log(`User ${userId} fully leaving meeting ${meetingId}`)
  
  // Remove user from active users map
  if (activeUsers.has(meetingId)) {
    const usersMap = activeUsers.get(meetingId)
    const username = usersMap.get(userId)
    usersMap.delete(userId)
    
    // Notify other participants
    socket.to(meetingId).emit("user-disconnected", userId)
    
    console.log(`${username || userId} removed from meeting: ${meetingId}`)
    
    // If no users left, clean up the meeting
    if (usersMap.size === 0) {
      activeUsers.delete(meetingId)
      console.log(`No users left in meeting ${meetingId}, removing from active meetings`)
    }
  }
}

// Cleanup Intervals

// Check meetings and delete any without active users from database
if (MONGO_URI) {
  setInterval(() => {
    Meeting.find({}).then((meetings) => {
      meetings.forEach((meeting) => {
        if (!activeUsers.has(meeting.meetingId)) {
          Meeting.deleteOne({ meetingId: meeting.meetingId })
            .then(() => console.log(`Deleted meeting: ${meeting.meetingId}`))
            .catch((err) => console.error("Delete error:", err))
        }
      })
    })
  }, 60* 60 * 1000) // Hourly
}

// Check active users map and clean up disconnected users
setInterval(() => {
  for (const [meetingId, usersMap] of activeUsers.entries()) {
    for (const [userId, username] of usersMap.entries()) {
      // Check if the user's socket is still connected
      let userConnected = false
      
      // Look through all sockets to find if user is still connected
      for (const [socketId, socket] of io.sockets.sockets.entries()) {
        if (socket.userId === userId) {
          userConnected = true
          break
        }
      }
      
      if (!userConnected) {
        usersMap.delete(userId)
        io.to(meetingId).emit("user-disconnected", userId)
        console.log(`${username} removed from meeting: ${meetingId} (socket disconnected)`)
      }
    }
    
    // If no users left in the meeting, remove the meeting
    if (usersMap.size === 0) {
      activeUsers.delete(meetingId)
      console.log(`Meeting ${meetingId} removed from active meetings (no users left)`)
    }
  }
}, 60 * 60 * 1000) // Every hour

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

