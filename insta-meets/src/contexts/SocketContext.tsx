"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { toast } from "sonner"



interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false })

export const useSocket = () => useContext(SocketContext)

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Use the correct environment variable name
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
    console.log("Connecting to socket server at:", backendUrl)

    const newSocket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    newSocket.on("connect", () => {
      setIsConnected(true)
      console.log("Socket connected with ID:", newSocket.id)
      toast.success("Connected to server")
    })

    newSocket.on("disconnect", () => {
      setIsConnected(false)
      toast.error("Disconnected from server")
    })

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error)
      toast.error("Failed to connect to server")
    })

    setSocket(newSocket)

    // Make socket available globally for peer connections
    window.socketRef = { current: newSocket }

    return () => {
      newSocket.disconnect()
    }
  }, [])

  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
}

