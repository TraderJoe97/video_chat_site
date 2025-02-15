import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "https://insta-meets.vercel.app", // Frontend URL
    methods: ["GET", "POST"],
  },
})

const rooms = new Map()

io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  socket.on("join-room", (roomId) => {
    socket.join(roomId)
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set())
    }
    rooms.get(roomId).add(socket.id)

    // Notify other users in the room about the new user
    socket.to(roomId).emit("user-connected", socket.id)

    // Send the list of existing users to the new user
    const existingUsers = Array.from(rooms.get(roomId)).filter((id) => id !== socket.id)
    socket.emit("existing-users", existingUsers)
  })

  socket.on("offer", ({ target, offer }) => {
    socket.to(target).emit("offer", { from: socket.id, offer })
  })

  socket.on("answer", ({ target, answer }) => {
    socket.to(target).emit("answer", { from: socket.id, answer })
  })

  socket.on("ice-candidate", ({ target, candidate }) => {
    socket.to(target).emit("ice-candidate", { from: socket.id, candidate })
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id)
        socket.to(roomId).emit("user-disconnected", socket.id)
        if (users.size === 0) {
          rooms.delete(roomId)
        }
      }
    })
  })
})

httpServer.listen(5000, () => {
  console.log("Signaling server running on port 5000")
})

