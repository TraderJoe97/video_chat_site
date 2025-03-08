const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const { v4: uuidv4 } = require("uuid")
const cors = require("cors")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Store active rooms
const rooms = new Map()

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Create a new room
  socket.on("create-room", () => {
    const roomId = uuidv4().substring(0, 8)

    // Join the room
    socket.join(roomId)

    // Store room info
    rooms.set(roomId, {
      creator: socket.id,
      participants: [socket.id],
    })

    // Notify client
    socket.emit("room-created", roomId)
    console.log(`Room created: ${roomId} by ${socket.id}`)
  })

  // Join an existing room
  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId)

    if (!room) {
      socket.emit("room-not-found")
      return
    }

    // Check if room is full (limit to 2 participants for simplicity)
    if (room.participants.length >= 2) {
      socket.emit("room-full")
      return
    }

    // Join the room
    socket.join(roomId)
    room.participants.push(socket.id)

    // Notify client
    socket.emit("room-joined", roomId)
    console.log(`User ${socket.id} joined room: ${roomId}`)
  })

  // Leave a room
  socket.on("leave-room", (roomId) => {
    leaveRoom(socket, roomId)
  })

  // Handle WebRTC signaling
  socket.on("offer", ({ offer, roomId }) => {
    const room = rooms.get(roomId)

    if (room) {
      // Send offer to other participants in the room
      socket.to(roomId).emit("offer", {
        from: socket.id,
        offer,
      })
    }
  })

  socket.on("answer", ({ to, answer }) => {
    // Send answer to specific user
    io.to(to).emit("answer", {
      from: socket.id,
      answer,
    })
  })

  socket.on("ice-candidate", ({ to, candidate }) => {
    // Send ICE candidate to specific user
    io.to(to).emit("ice-candidate", {
      from: socket.id,
      candidate,
    })
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Find and leave all rooms the user was in
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.includes(socket.id)) {
        leaveRoom(socket, roomId)
      }
    }
  })
})

// Helper function to handle leaving a room
function leaveRoom(socket, roomId) {
  const room = rooms.get(roomId)

  if (room) {
    // Remove user from participants
    room.participants = room.participants.filter((id) => id !== socket.id)

    // Notify other participants
    socket.to(roomId).emit("user-disconnected", socket.id)

    // Leave the socket.io room
    socket.leave(roomId)

    // If room is empty, delete it
    if (room.participants.length === 0) {
      rooms.delete(roomId)
      console.log(`Room deleted: ${roomId}`)
    }

    console.log(`User ${socket.id} left room: ${roomId}`)
  }
}

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

