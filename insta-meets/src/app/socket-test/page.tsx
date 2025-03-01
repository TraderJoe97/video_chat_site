"use client"

import { useState, useEffect } from "react"
import { io, type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function SocketTestPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")
  const [lastPong, setLastPong] = useState<string | null>(null)
  const [serverHealth, setServerHealth] = useState<string>("Checking...")

  const connectSocket = () => {
    const newSocket = io(process.env.BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    newSocket.on("connect", () => {
      setConnectionStatus("Connected")
      toast.success("Socket connected successfully!")
    })

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      setConnectionStatus("Error")
      toast.error("Failed to connect to the socket server. Please check your backend.")
    })

    newSocket.on("disconnect", () => {
      setConnectionStatus("Disconnected")
      toast.warning("Socket disconnected")
    })

    newSocket.on("pong", (data) => {
      setLastPong(new Date().toLocaleTimeString())
      toast.info(`Received pong: ${data}`)
    })

    setSocket(newSocket)
  }

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${process.env.BACKEND_URL}/api/health`)
      if (response.ok) {
        const data = await response.json()
        setServerHealth(data.status === "ok" ? "Server is healthy" : "Server not healthy")
      } else {
        setServerHealth("Server is down")
      }
    } catch (error) {
      console.error("Health check failed:", error)
      setServerHealth("Server is down")
    }
  }

  useEffect(() => {
    checkServerHealth()

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [socket])

  const handlePing = () => {
    if (socket) {
      socket.emit("ping", "Hello server")
      toast.info("Ping sent to server")
    } else {
      toast.error("Socket is not connected")
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Socket Connection Test</CardTitle>
          <CardDescription>Test your socket connection here</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Status:</strong> {connectionStatus}
          </div>
          {lastPong && (
            <div>
              <strong>Last Pong:</strong> {lastPong}
            </div>
          )}
          <div>
            <strong>Server Health:</strong> {serverHealth}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={connectSocket} disabled={connectionStatus === "Connected"}>
            {connectionStatus === "Connected" ? "Connected" : "Connect Socket"}
          </Button>
          <Button onClick={handlePing} disabled={connectionStatus !== "Connected"}>
            Send Ping
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
