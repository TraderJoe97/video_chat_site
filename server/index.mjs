import express from "express"
import http from "http"
import { Server } from "socket.io"
import { v4 as uuidv4 } from "uuid"
import cors from "cors"

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.BACKEND_URL,
    methods: ["GET", "POST"],
  },
})

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Add a Meeting test endpoint to get all meetings from databasse
app.get('/test-meetings', (req, res) => {
  res.status(200).json({ status: 'ok', meetings: [] })
})

// Store active rooms
const rooms = new Map()

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Ping-pong for testing
  socket.on("ping", (data) => {
    console.log(`Received ping from ${socket.id}: ${data}`)
    socket.emit("pong", "Server pong response")
  })

  // Create a new room
  socket.on("create-room", () => {
    const roomId = uuidv4().substring(0, 8)

    // Join the room
    socket.join(roomId)

    // Store room info
    rooms.set(roomId, {
      creator: socket.id,
      participants: [{ id: socket.id, username: "Host" }],
    })

    // Notify client
    socket.emit("room-created", roomId)
    console.log(`Room created: ${roomId} by ${socket.id}`)
  })

  // Join an existing room
  socket.on("join-room", (data) => {
    const { meetingId, userId, username, hostId } = data
    console.log(`User ${userId} (${username}) attempting to join room: ${meetingId}`)

    let room = rooms.get(meetingId)

    // Create room if it doesn't exist (for direct join links)
    if (!room) {
      room = {
        creator: hostId || userId,
        participants: [],
      }
      rooms.set(meetingId, room)
      console.log(`Room ${meetingId} created for direct join`)
    }

    // Join the socket.io room
    socket.join(meetingId)

    // Add to participants if not already there
    if (!room.participants.some(p => p.id === userId)) {
      room.participants.push({ id: userId, username })
    }

    // Notify existing participants about the new user
    socket.to(meetingId).emit("user-connected", { userId, username })

    // Send existing participants to the new user
    socket.emit("existing-participants", room.participants.filter(p => p.id !== userId))

    // Notify client
    socket.emit("room-joined", meetingId)
    console.log(`User ${userId} (${username}) joined room: ${meetingId}`)
  })

  // Handle WebRTC signaling
  socket.on("offer", (data) => {
    const { meetingId, callerId, userId, offer } = data
    console.log(`Offer from ${callerId} to ${userId} in room ${meetingId}`)

    // Forward the offer to the specific user
    socket.to(meetingId).emit("offer", {
      callerId,
      offer,
    })
  })

  socket.on("answer", (data) => {
    const { meetingId, callerId, answer } = data
    console.log(`Answer from ${socket.id} to ${callerId} in room ${meetingId}`)

    // Forward the answer to the specific user
    socket.to(meetingId).emit("answer", {
      callerId: socket.id,
      answer,
    })
  })

  socket.on("candidate", (data) => {
    const { meetingId, callerId, candidate } = data
    console.log(`ICE candidate from ${socket.id} to ${callerId} in room ${meetingId}`)

    // Forward the ICE candidate to the specific user
    socket.to(meetingId).emit("candidate", {
      callerId: socket.id,
      candidate,
    })
  })

  // Handle chat messages
  socket.on("message", (data) => {
    const { meetingId, senderId, content, timestamp } = data
    console.log(`Message in room ${meetingId} from ${senderId}: ${content}`)

    // Broadcast the message to all users in the room
    io.to(meetingId).emit("createMessage", {
      senderId,
      content,
      timestamp,
    })
  })

  // Handle raise hand
  socket.on("raise-hand", (data) => {
    const { meetingId, userId, isRaised } = data
    console.log(`User ${userId} ${isRaised ? 'raised' : 'lowered'} hand in room ${meetingId}`)

    // Broadcast to all users in the room
    io.to(meetingId).emit("raise-hand", {
      userId,
      isRaised,
    })
  })

  // Leave a room
  socket.on("leave-room", (data) => {
    const { meetingId, userId } = data
    leaveRoom(socket, meetingId, userId)
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Find and leave all rooms the user was in
    for (const [roomId, room] of rooms.entries()) {
      const participant = room.participants.find(p => p.id === socket.id || p.socketId === socket.id)
      if (participant) {
        leaveRoom(socket, roomId, participant.id)
      }
    }
  })
})

// Helper function to handle leaving a room
function leaveRoom(socket, roomId, userId) {
  const room = rooms.get(roomId)

  if (room) {
    console.log(`User ${userId} leaving room: ${roomId}`)
    
    // Remove user from participants
    room.participants = room.participants.filter(p => p.id !== userId && p.socketId !== socket.id)

    // Notify other participants
    socket.to(roomId).emit("user-disconnected", userId)

    // Leave the socket.io room
    socket.leave(roomId)

    // If room is empty, delete it
    if (room.participants.length === 0) {
      rooms.delete(roomId)
      console.log(`Room deleted: ${roomId}`)
    }
  }
}

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

