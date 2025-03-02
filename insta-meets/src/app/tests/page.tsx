"use client"

import { useState, useEffect, useRef } from "react"
import { useSocket } from "@/contexts/SocketContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useAuth0 } from "@auth0/auth0-react"
import { Mic, MicOff, VideoIcon, VideoOff } from "lucide-react"

export default function TestPage() {
  const { socket, isConnected } = useSocket()
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0()
  const [lastPong, setLastPong] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [messages, setMessages] = useState<Array<{ text: string; sender: string; timestamp: string }>>([])
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([])
  const localVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (socket) {
      socket.on("pong", (data) => {
        setLastPong(new Date().toLocaleTimeString())
        toast.info(`Received pong: ${data}`)
      })

      socket.on("createMessage", (message) => {
        setMessages((prev) => [...prev, message])
      })

      socket.on("user-connected", (data) => {
        setParticipants((prev) => [...prev, { id: data.userId, name: data.username }])
      })

      socket.on("user-disconnected", (userId) => {
        setParticipants((prev) => prev.filter((p) => p.id !== userId))
      })
    }

    return () => {
      if (socket) {
        socket.off("pong")
        socket.off("createMessage")
        socket.off("user-connected")
        socket.off("user-disconnected")
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

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setIsVideoEnabled(true)
      setIsAudioEnabled(true)
      toast.success("Media devices initialized")
    } catch (error) {
      console.error("Error accessing media devices:", error)
      toast.error("Failed to access media devices")
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  const sendTestMessage = () => {
    if (socket && isConnected) {
      const messageData = {
        text: "Test message",
        sender: user?.name || "Test User",
        timestamp: new Date().toISOString(),
      }
      socket.emit("message", messageData)
      setMessages((prev) => [...prev, messageData])
    } else {
      toast.error("Socket is not connected")
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold text-center mb-8">Application Test Page</h1>

      <Card>
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
        <CardFooter>
          <Button onClick={handlePing} disabled={!isConnected}>
            Send Ping
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
          <CardDescription>Test Auth0 authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
          </div>
          {isAuthenticated && user && (
            <div>
              <strong>User:</strong> {user.name} ({user.email})
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!isAuthenticated ? (
            <Button onClick={() => loginWithRedirect()}>Log In</Button>
          ) : (
            <Button onClick={() => logout()}>Log Out</Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WebRTC Test</CardTitle>
          <CardDescription>Test WebRTC functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          </div>
          <div className="flex justify-center space-x-4">
            <Button
              onClick={toggleVideo}
              variant={isVideoEnabled ? "default" : "destructive"}
              className="w-12 h-12 rounded-full p-0"
            >
              {isVideoEnabled ? <VideoIcon className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
            <Button
              onClick={toggleAudio}
              variant={isAudioEnabled ? "default" : "destructive"}
              className="w-12 h-12 rounded-full p-0"
            >
              {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={initializeMedia} disabled={!!localStream}>
            Initialize Media
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat and Participants Test</CardTitle>
          <CardDescription>Test chat functionality and participants list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 h-64 overflow-y-auto">
              <h3 className="font-semibold mb-2">Chat Messages</h3>
              {messages.map((msg, index) => (
                <div key={index} className="mb-2">
                  <span className="font-medium">{msg.sender}:</span> {msg.text}
                </div>
              ))}
            </div>
            <div className="border rounded-lg p-4 h-64 overflow-y-auto">
              <h3 className="font-semibold mb-2">Participants</h3>
              {participants.map((participant) => (
                <div key={participant.id} className="mb-2">
                  {participant.name}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={sendTestMessage} disabled={!isConnected}>
            Send Test Message
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UI Components Test</CardTitle>
          <CardDescription>Test various UI components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-input">Test Input</Label>
            <Input id="test-input" placeholder="Type something..." />
          </div>
          <Separator />
          <div className="flex space-x-2">
            <Button variant="default">Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables Test</CardTitle>
          <CardDescription>Test access to environment variables</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <strong>BACKEND_URL:</strong> {process.env.NEXT_PUBLIC_BACKEND_URL || "Not set"}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

