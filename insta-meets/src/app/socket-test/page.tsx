"use client"

import { useState, useEffect } from "react"
import { useSocket } from "@/contexts/SocketContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function SocketTestPage() {
  const { socket, isConnected } = useSocket()
  const [lastPong, setLastPong] = useState<string | null>(null)

  useEffect(() => {
    if (socket) {
      socket.on("pong", (data) => {
        setLastPong(new Date().toLocaleTimeString())
        toast.info(`Received pong: ${data}`)
      })
    }

    return () => {
      if (socket) {
        socket.off("pong")
      }
    }
  }, [socket])

  const handlePing = () => {
    if (socket && isConnected) {
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
            <strong>Status:</strong> {isConnected ? "Connected" : "Disconnected"}
          </div>
          {lastPong && (
            <div>
              <strong>Last Pong:</strong> {lastPong}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={handlePing} disabled={!isConnected}>
            Send Ping
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

