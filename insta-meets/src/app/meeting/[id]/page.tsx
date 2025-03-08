"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import Peer from "simple-peer"
import { useSocket } from "@/contexts/SocketContext"
import { Button } from "@/components/ui/button"
import {
  Mic,
  MicOff,
  VideoIcon,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Settings,
  Users,
  MessageSquare,
  Hand,
  FlagOffIcon as HandOff,
  MoreVertical,
  Maximize,
  Minimize,
} from "lucide-react"
import ChatPanel from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"
import { toast } from "sonner"
import { VideoComponent } from "@/components/video-component"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface UserConnectedData {
  userId: string
  username: string
}

interface SignalData {
  callerId: string
  offer?: Peer.SignalData
  answer?: Peer.SignalData
  candidate?: RTCIceCandidate
}

interface Message {
  senderId: string
  content: string
  timestamp: string
}

interface Participant {
  id: string
  name: string
  isYou?: boolean
  isSpeaking?: boolean
  hasHandRaised?: boolean
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth0()
  const { socket, isConnected } = useSocket()
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sidebarContent, setSidebarContent] = useState<"chat" | "participants">("chat")
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [meetingStartTime] = useState(new Date())
  const [elapsedTime, setElapsedTime] = useState("00:00:00")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})

  const peersRef = useRef<Record<string, Peer.Instance>>({})
  const userIdRef = useRef<string>("")
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const meetingContainerRef = useRef<HTMLDivElement>(null)

  const updateParticipants = useCallback((newParticipant: Participant) => {
    setParticipants((prev) => {
      const exists = prev.some((p) => p.id === newParticipant.id)
      if (!exists) {
        return [...prev, newParticipant]
      }
      return prev.map((p) => (p.id === newParticipant.id ? { ...p, ...newParticipant } : p))
    })
  }, [])

  // Update meeting timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = new Date()
      const diff = now.getTime() - meetingStartTime.getTime()

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      )
    }, 1000)

    return () => clearInterval(timerInterval)
  }, [meetingStartTime])

  useEffect(() => {
    if (isAuthenticated && user?.sub) {
      userIdRef.current = user.sub
    } else if (searchParams.get("name")) {
      userIdRef.current = searchParams.get("name") || `guest-${Math.floor(Math.random() * 1000)}`
    } else {
      const name = prompt("Please enter your name to join the meeting", "Guest")
      userIdRef.current = name || `guest-${Math.floor(Math.random() * 1000)}`
    }

    setParticipants([
      {
        id: userIdRef.current,
        name: user?.name || searchParams.get("name") || userIdRef.current,
        isYou: true,
      },
    ])

    console.log("Current user ID set to:", userIdRef.current)
  }, [isAuthenticated, user, searchParams])

  const createPeer = useCallback(
    (userId: string) => {
      console.log(`Creating peer for ${userId}`)

      if (!localStream) {
        console.error("Cannot create peer: local stream is null")
        return null
      }

      try {
        // Fix: Set trickle to true for better connection establishment
        const peer = new Peer({
          initiator: true,
          trickle: true,
          config: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }],
          },
        })

        peer.on("signal", (data: Peer.SignalData) => {
          console.log(`Sending offer to ${userId}`, data.type || "candidate")
          socket?.emit("offer", {
            meetingId: id,
            callerId: userIdRef.current,
            userId: userId,
            offer: data,
          })
        })

        peer.on("stream", (stream: MediaStream) => {
          console.log(`Received stream from ${userId}`)
          setRemoteStreams((prev) => ({
            ...prev,
            [userId]: stream,
          }))
        })

        peer.on("error", (err: Error) => {
          console.error("Error in peer connection:", err)
          toast.error(`Connection error with ${userId}: ${err.message}`)
        })

        peer.on("close", () => {
          console.log(`Peer connection with ${userId} closed`)
        })

        // Add tracks to the peer connection instead of the entire stream
        localStream.getTracks().forEach((track) => {
          peer.addTrack(track, localStream)
        })

        return peer
      } catch (error) {
        console.error("Error creating peer:", error)
        toast.error("Failed to create peer connection")
        return null
      }
    },
    [socket, localStream, id],
  )

  const addPeer = useCallback(
    (incomingSignal: Peer.SignalData, callerId: string) => {
      console.log(`Adding peer for ${callerId}`)

      if (!localStream) {
        console.error("Cannot add peer: local stream is null")
        return null
      }

      try {
        // Fix: Set trickle to true for better connection establishment
        const peer = new Peer({
          initiator: false,
          trickle: true,
          config: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }],
          },
        })

        peer.on("signal", (data: Peer.SignalData) => {
          console.log(`Sending answer signal to ${callerId}`)
          socket?.emit("answer", {
            meetingId: id,
            callerId: callerId,
            answer: data,
          })
        })

        peer.on("stream", (stream: MediaStream) => {
          console.log(`Received stream from ${callerId}`)
          setRemoteStreams((prev) => ({
            ...prev,
            [callerId]: stream,
          }))
        })

        peer.on("error", (err: Error) => {
          console.error("Error in peer connection:", err)
          toast.error(`Connection error: ${err.message}`)
        })

        // Add tracks to the peer connection instead of the entire stream
        localStream.getTracks().forEach((track) => {
          peer.addTrack(track, localStream)
        })

        peer.signal(incomingSignal)

        return peer
      } catch (error) {
        console.error("Error adding peer:", error)
        toast.error("Failed to add peer connection")
        return null
      }
    },
    [socket, localStream, id],
  )

  useEffect(() => {
    const initializeStream = async () => {
      try {
        console.log("Requesting user media")
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        console.log("Media stream obtained:", stream.id)
        setLocalStream(stream)

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Error accessing media devices:", error)
        toast.error("Could not access camera or microphone. Please check permissions.")
        setIsLoading(false)
      }
    }

    initializeStream()

    return () => {
      if (localStream) {
        console.log("Stopping all tracks in local stream")
        localStream.getTracks().forEach((track) => track.stop())
      }

      if (screenStream) {
        console.log("Stopping all tracks in screen stream")
        screenStream.getTracks().forEach((track) => track.stop())
      }

      Object.values(peersRef.current).forEach((peer) => {
        console.log("Destroying peer connection")
        peer.destroy()
      })
    }
  }, [])

  useEffect(() => {
    if (isConnected) {
      setIsConnecting(false)
    }
  }, [isConnected])

  useEffect(() => {
    if (!socket || !isConnected || !localStream || !userIdRef.current) {
      return
    }

    console.log("Setting up socket event listeners")

    const hostId = isAuthenticated && user?.sub ? user.sub : userIdRef.current

    const handleUserConnected = (data: UserConnectedData) => {
      console.log("User connected:", data)
      const { userId, username } = data

      if (userId !== userIdRef.current) {
        console.log(`Creating peer for user ${userId}`)
        const peer = createPeer(userId)

        if (peer) {
          peersRef.current[userId] = peer
          updateParticipants({ id: userId, name: username })
        }
      }
    }

    const handleOffer = (data: SignalData) => {
      console.log("Offer received:", data.callerId, data.offer)
      if (data.offer && data.callerId !== userIdRef.current) {
        if (!peersRef.current[data.callerId]) {
          console.log(`Creating new peer from offer for ${data.callerId}`)
          const peer = addPeer(data.offer, data.callerId)

          if (peer) {
            peersRef.current[data.callerId] = peer
          }
        } else {
          // Fix: Handle offer even if peer exists
          peersRef.current[data.callerId].signal(data.offer)
        }
      }
    }

    const handleAnswer = (data: SignalData) => {
      console.log("Answer received:", data.callerId, data.answer)
      if (data.answer && peersRef.current[data.callerId]) {
        peersRef.current[data.callerId].signal(data.answer)
      }
    }

    const handleCandidate = (data: SignalData) => {
      console.log("Candidate received:", data.callerId, data.candidate)
      if (data.candidate && peersRef.current[data.callerId]) {
        peersRef.current[data.callerId].signal({ type: "candidate", candidate: data.candidate })
      }
    }

    const handleUserDisconnected = (userId: string) => {
      console.log("User disconnected:", userId)

      if (peersRef.current[userId]) {
        peersRef.current[userId].destroy()
        delete peersRef.current[userId]
      }

      // Remove remote stream when user disconnects
      setRemoteStreams((prev) => {
        const newStreams = { ...prev }
        delete newStreams[userId]
        return newStreams
      })

      setParticipants((prev) => prev.filter((p) => p.id !== userId))
      toast.info(`${participants.find((p) => p.id === userId)?.name || "A participant"} left the meeting`)
    }

    const handleCreateMessage = (message: Message) => {
      console.log("Chat message received:", message)
      if (message.senderId !== userIdRef.current) {
        setMessages((prev) => [...prev, message])
        if (!isSidebarOpen || sidebarContent !== "chat") {
          toast.info(`New message from ${participants.find((p) => p.id === message.senderId)?.name || "Someone"}`)
        }
      }
    }

    const handleExistingParticipants = (existingParticipants: Array<{ userId: string; username: string }>) => {
      console.log("Existing participants:", existingParticipants)

      existingParticipants.forEach(({ userId, username }) => {
        if (userId !== userIdRef.current) {
          updateParticipants({ id: userId, name: username })
        }
      })
    }

    const handleRaiseHand = (data: { userId: string; isRaised: boolean }) => {
      updateParticipants({
        id: data.userId,
        hasHandRaised: data.isRaised,
        name: participants.find((p) => p.id === data.userId)?.name || data.userId,
      })

      if (data.isRaised && data.userId !== userIdRef.current) {
        toast.info(`${participants.find((p) => p.id === data.userId)?.name || "Someone"} raised their hand`)
      }
    }

    // Fix: Ensure we're sending the correct data structure
    socket.emit("join-room", {
      meetingId: id,
      userId: userIdRef.current,
      username: user?.name || searchParams.get("name") || userIdRef.current,
      hostId: hostId,
    })

    socket.on("user-connected", handleUserConnected)
    socket.on("offer", handleOffer)
    socket.on("answer", handleAnswer)
    socket.on("candidate", handleCandidate)
    socket.on("user-disconnected", handleUserDisconnected)
    socket.on("createMessage", handleCreateMessage)
    socket.on("existing-participants", handleExistingParticipants)
    socket.on("raise-hand", handleRaiseHand)

    return () => {
      socket.off("user-connected", handleUserConnected)
      socket.off("offer", handleOffer)
      socket.off("answer", handleAnswer)
      socket.off("candidate", handleCandidate)
      socket.off("user-disconnected", handleUserDisconnected)
      socket.off("createMessage", handleCreateMessage)
      socket.off("existing-participants", handleExistingParticipants)
      socket.off("raise-hand", handleRaiseHand)
    }
  }, [
    socket,
    isConnected,
    localStream,
    id,
    isAuthenticated,
    user,
    searchParams,
    createPeer,
    addPeer,
    updateParticipants,
    participants,
    isSidebarOpen,
    sidebarContent,
  ])

  useEffect(() => {
    if (localStream && participants.length > 1) {
      participants.forEach((participant) => {
        if (participant.id !== userIdRef.current && !peersRef.current[participant.id]) {
          const peer = createPeer(participant.id)
          if (peer) {
            peersRef.current[participant.id] = peer
          }
        }
      })
    }
  }, [localStream, participants, createPeer])

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setLocalStream((prevStream) => prevStream)
      }
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setLocalStream((prevStream) => prevStream)
      }
    }
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing && screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
      setScreenStream(null)
      setIsScreenSharing(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      setScreenStream(stream)
      setIsScreenSharing(true)

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream
      }

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null)
        setIsScreenSharing(false)
      }
    } catch (error) {
      console.error("Error sharing screen:", error)
      toast.error("Could not share screen. Please check permissions.")
    }
  }

  const toggleHandRaise = () => {
    setIsHandRaised(!isHandRaised)
    socket?.emit("raise-hand", {
      meetingId: id,
      userId: userIdRef.current,
      isRaised: !isHandRaised,
    })

    // Update local participant state
    setParticipants((prev) => prev.map((p) => (p.isYou ? { ...p, hasHandRaised: !isHandRaised } : p)))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && meetingContainerRef.current) {
      meetingContainerRef.current.requestFullscreen().catch((err) => {
        toast.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  const leaveMeeting = () => {
    // Clean up resources
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
    }

    Object.values(peersRef.current).forEach((peer) => {
      peer.destroy()
    })

    // Notify server
    socket?.emit("leave-room", {
      meetingId: id,
      userId: userIdRef.current,
    })

    // Redirect to home
    router.push("/")
  }

  const sendMessage = useCallback(
    (text: string) => {
      if (socket && text.trim()) {
        const messageData: Message = {
          senderId: userIdRef.current,
          content: text,
          timestamp: new Date().toISOString(),
        }

        socket.emit("message", {
          meetingId: id,
          ...messageData,
        })
        setMessages((prev) => [...prev, messageData])
      }
    },
    [socket, id],
  )

  const isVideoEnabled = localStream?.getVideoTracks()[0]?.enabled ?? true
  const isAudioEnabled = localStream?.getAudioTracks()[0]?.enabled ?? true

  const getGridClass = () => {
    const totalVideos = (isScreenSharing ? 1 : 0) + 1 + Object.keys(remoteStreams).length

    if (isScreenSharing) return "grid-cols-1"
    if (totalVideos <= 1) return "grid-cols-1"
    if (totalVideos <= 2) return "grid-cols-1 md:grid-cols-2"
    if (totalVideos <= 4) return "grid-cols-1 md:grid-cols-2"
    if (totalVideos <= 6) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    return "grid-cols-1 md:grid-cols-3 lg:grid-cols-4"
  }

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Connecting to server...</h1>
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Connection to server failed</h1>
        <p className="mb-4">Please check your internet connection and try again.</p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    )
  }

  return (
    <div ref={meetingContainerRef} className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Meeting: {id}</h1>
          <div className="text-sm text-muted-foreground">{elapsedTime}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
            {participants.length} {participants.length === 1 ? "participant" : "participants"}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className={cn("flex-1 p-4 overflow-auto", isSidebarOpen ? "md:pr-[350px]" : "")}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Skeleton className="h-[200px] w-[300px] rounded-lg mb-4" />
                <Skeleton className="h-4 w-[250px] mx-auto mb-2" />
                <Skeleton className="h-4 w-[200px] mx-auto" />
              </div>
            </div>
          ) : (
            <div id="video-grid" className={`grid ${getGridClass()} gap-4 h-full`}>
              {isScreenSharing && (
                <div className="relative col-span-full row-span-2 min-h-[300px]">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    className="w-full h-full rounded-lg shadow-lg object-contain bg-black"
                  />
                  <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded text-sm">
                    Screen Share
                  </div>
                </div>
              )}

              <div className="relative min-h-[200px]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn(
                    "h-full w-full rounded-lg shadow-lg object-cover bg-black",
                    !isVideoEnabled && "bg-gray-900",
                  )}
                />
                <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded text-sm flex items-center gap-1">
                  <span>You ({user?.name || searchParams.get("name") || userIdRef.current})</span>
                  {!isAudioEnabled && <MicOff className="h-3 w-3 text-red-500" />}
                  {participants.find((p) => p.isYou)?.hasHandRaised && <Hand className="h-3 w-3 text-yellow-500" />}
                </div>
              </div>

              {/* Render remote streams */}
              {Object.entries(remoteStreams).map(([userId, stream]) => (
                <div key={userId} className="relative min-h-[200px]">
                  <VideoComponent
                    stream={stream}
                    className="h-full w-full rounded-lg shadow-lg object-cover bg-black"
                  />
                  <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded text-sm flex items-center gap-1">
                    <span>{participants.find((p) => p.id === userId)?.name || userId}</span>
                    {participants.find((p) => p.id === userId)?.hasHandRaised && (
                      <Hand className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div
          className={cn(
            "fixed top-[57px] right-0 bottom-[72px] w-[350px] bg-card border-l transition-transform duration-300 z-10 overflow-hidden",
            isSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0 md:w-0",
          )}
        >
          <Tabs
            defaultValue="chat"
            value={sidebarContent}
            onValueChange={(v) => setSidebarContent(v as "chat" | "participants")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="chat" className="flex-1">
                Chat
              </TabsTrigger>
              <TabsTrigger value="participants" className="flex-1">
                Participants
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="h-[calc(100%-40px)]">
              <ChatPanel
                messages={messages.map(({ senderId, content }) => ({ senderId, content }))}
                onSendMessage={sendMessage}
                participants={participants}
              />
            </TabsContent>
            <TabsContent value="participants" className="h-[calc(100%-40px)]">
              <ParticipantsPanel participants={participants} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleAudio}
                  variant={isAudioEnabled ? "outline" : "destructive"}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isAudioEnabled ? "Mute microphone" : "Unmute microphone"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleVideo}
                  variant={isVideoEnabled ? "outline" : "destructive"}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isVideoEnabled ? "Turn off camera" : "Turn on camera"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleScreenShare}
                  variant={isScreenSharing ? "default" : "outline"}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
                >
                  {isScreenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isScreenSharing ? "Stop sharing screen" : "Share screen"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleHandRaise}
                  variant={isHandRaised ? "default" : "outline"}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
                >
                  {isHandRaised ? <HandOff className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isHandRaised ? "Lower hand" : "Raise hand"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full h-10 w-10" aria-label="More options">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => toast.info("Settings will be available soon")}>
                <Settings className="h-4 w-4 mr-2" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setIsSidebarOpen(!isSidebarOpen)
                    setSidebarContent("chat")
                  }}
                  variant={isSidebarOpen && sidebarContent === "chat" ? "default" : "outline"}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  aria-label="Toggle chat"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isSidebarOpen && sidebarContent === "chat" ? "Hide chat" : "Show chat"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setIsSidebarOpen(!isSidebarOpen)
                    setSidebarContent("participants")
                  }}
                  variant={isSidebarOpen && sidebarContent === "participants" ? "default" : "outline"}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  aria-label="Toggle participants"
                >
                  <Users className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isSidebarOpen && sidebarContent === "participants" ? "Hide participants" : "Show participants"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={leaveMeeting}
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  aria-label="Leave meeting"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  <span>Leave</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave meeting</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

