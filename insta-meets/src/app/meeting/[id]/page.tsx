"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
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
  MessageSquare,
  Users,
  Hand,
  FlagOffIcon as HandOff,
  Maximize,
  Minimize,
} from "lucide-react"
import ChatPanel from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { PeerVideo } from "@/components/peer-video"

interface PeerConnection {
  peerId: string
  peer: Peer.Instance
  stream?: MediaStream
  username: string
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
  const { id: meetingId } = useParams<{ id: string }>()
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const { user, isAuthenticated, loginWithRedirect } = useAuth0()

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // UI state
  const [activeTab, setActiveTab] = useState<string>("chat")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Meeting state
  const [peers, setPeers] = useState<PeerConnection[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])

  // Refs
  const peersRef = useRef<PeerConnection[]>([])
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Initialize media and join meeting
  useEffect(() => {
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: `/meeting/${meetingId}` } })
      return
    }

    if (!socket || !isConnected || !user) return

    const initializeMediaAndJoinMeeting = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })

        // Store stream in ref for consistent access
        streamRef.current = stream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        setLocalStream(stream)
        setIsVideoEnabled(true)
        setIsAudioEnabled(true)

        // Add yourself to participants
        const currentUser: Participant = {
          id: user.sub || user.email || "user-" + Date.now(),
          name: user.name || user.email || "You",
          isYou: true,
        }

        setParticipants((prev) => {
          if (prev.some((p) => p.id === currentUser.id)) return prev
          return [...prev, currentUser]
        })

        // Join the meeting room
        socket.emit("join-room", {
          meetingId,
          userId: currentUser.id,
          username: currentUser.name,
        })

        toast.success("Joined meeting successfully")
      } catch (error) {
        console.error("Failed to get media devices:", error)
        toast.error("Failed to access camera or microphone")
      }
    }

    initializeMediaAndJoinMeeting()

    return () => {
      // Clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      // Disconnect peers
      peersRef.current.forEach(({ peer }) => {
        peer.destroy()
      })

      // Leave the room
      if (socket && user) {
        socket.emit("leave-room", {
          meetingId,
          userId: user.sub || user.email || "user-" + Date.now(),
        })
      }
    }
  }, [isConnected, socket, user, isAuthenticated, loginWithRedirect, meetingId])

  // Socket event handlers
  useEffect(() => {
    if (!socket || !user) return

    const userId = user.sub || user.email || "user-" + Date.now()

    // Handle new user connected
    const handleUserConnected = (data: { userId: string; username: string }) => {
      console.log("User connected:", data)

      // Add to participants list
      setParticipants((prev) => {
        if (prev.some((p) => p.id === data.userId)) return prev
        return [...prev, { id: data.userId, name: data.username }]
      })

      // Create a new peer connection if we have a stream
      if (streamRef.current) {
        const peer = createPeer(data.userId, userId, streamRef.current)

        peersRef.current.push({
          peerId: data.userId,
          peer,
          username: data.username,
        })

        setPeers((prev) => [
          ...prev,
          {
            peerId: data.userId,
            peer,
            username: data.username,
          },
        ])
      }
    }

    // Handle existing participants
    const handleExistingParticipants = (participants: { userId: string; username: string }[]) => {
      console.log("Existing participants:", participants)

      // Only proceed if we have a stream
      if (!streamRef.current) return

      participants.forEach((participant) => {
        // Add to participants list
        setParticipants((prev) => {
          if (prev.some((p) => p.id === participant.userId)) return prev
          return [...prev, { id: participant.userId, name: participant.username }]
        })

        // Create a new peer connection
        const peer = createPeer(participant.userId, userId, streamRef.current!)

        peersRef.current.push({
          peerId: participant.userId,
          peer,
          username: participant.username,
        })

        setPeers((prev) => [
          ...prev,
          {
            peerId: participant.userId,
            peer,
            username: participant.username,
          },
        ])
      })
    }

    // Handle user disconnected
    const handleUserDisconnected = (userId: string) => {
      console.log("User disconnected:", userId)

      // Remove from participants list
      setParticipants((prev) => prev.filter((p) => p.id !== userId))

      // Close and remove peer connection
      const peerObj = peersRef.current.find((p) => p.peerId === userId)
      if (peerObj) {
        peerObj.peer.destroy()
      }

      peersRef.current = peersRef.current.filter((p) => p.peerId !== userId)
      setPeers((prev) => prev.filter((p) => p.peerId !== userId))
    }

    // Handle WebRTC signaling - offer
    const handleOffer = (data: { callerId: string; offer: Peer.SignalData }) => {
      console.log("Received offer from:", data.callerId)

      if (!localStream) return

      const peer = addPeer(data.callerId, userId, data.offer, localStream)

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId)
      const username = peerObj?.username || data.callerId

      if (!peerObj) {
        peersRef.current.push({
          peerId: data.callerId,
          peer,
          username,
        })

        setPeers((prev) => [
          ...prev,
          {
            peerId: data.callerId,
            peer,
            username,
          },
        ])
      }
    }

    // Handle WebRTC signaling - answer
    const handleAnswer = (data: { callerId: string; answer: Peer.SignalData }) => {
      console.log("Received answer from:", data.callerId)

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId)
      if (peerObj) {
        peerObj.peer.signal(data.answer)
      }
    }

    // Handle WebRTC signaling - ICE candidate
    const handleCandidate = (data: { callerId: string; candidate: RTCIceCandidate }) => {
      console.log("Received ICE candidate from:", data.callerId)

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId)
      if (peerObj) {
        peerObj.peer.signal({ type: "candidate", candidate: data.candidate })
      }
    }

    // Handle chat messages
    const handleMessage = (message: Message) => {
      setMessages((prev) => [...prev, message])
    }

    // Handle hand raise
    const handleRaiseHand = (data: { userId: string; isRaised: boolean }) => {
      setParticipants((prev) => prev.map((p) => (p.id === data.userId ? { ...p, hasHandRaised: data.isRaised } : p)))
    }

    // Register event handlers
    socket.on("user-connected", handleUserConnected)
    socket.on("existing-participants", handleExistingParticipants)
    socket.on("user-disconnected", handleUserDisconnected)
    socket.on("offer", handleOffer)
    socket.on("answer", handleAnswer)
    socket.on("candidate", handleCandidate)
    socket.on("createMessage", handleMessage)
    socket.on("raise-hand", handleRaiseHand)

    return () => {
      // Unregister event handlers
      socket.off("user-connected", handleUserConnected)
      socket.off("existing-participants", handleExistingParticipants)
      socket.off("user-disconnected", handleUserDisconnected)
      socket.off("offer", handleOffer)
      socket.off("answer", handleAnswer)
      socket.off("candidate", handleCandidate)
      socket.off("createMessage", handleMessage)
      socket.off("raise-hand", handleRaiseHand)
    }
  }, [socket, localStream, user, meetingId])

  // Create a peer connection (initiator)
  const createPeer = (userToSignal: string, callerId: string, stream: MediaStream) => {
    console.log(`Creating peer to connect with ${userToSignal}`)

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream, // Explicitly pass the stream
    })

    peer.on("signal", (signal) => {
      console.log(`Sending offer signal to ${userToSignal}`)
      socket?.emit("offer", {
        meetingId,
        userId: userToSignal,
        callerId,
        offer: signal,
      })
    })

    return peer
  }

  // Add a peer connection (receiver)
  const addPeer = (callerId: string, userId: string, incomingSignal: Peer.SignalData, stream: MediaStream) => {
    console.log(`Adding peer for ${callerId}`)

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream, // Explicitly pass the stream
    })

    peer.on("signal", (signal) => {
      console.log(`Sending answer signal to ${callerId}`)
      socket?.emit("answer", {
        meetingId,
        callerId,
        userId,
        answer: signal,
      })
    })

    // Process the incoming signal
    peer.signal(incomingSignal)

    return peer
  }

  // Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }

  // Toggle audio
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  // Toggle screen sharing
  const toggleScreenSharing = async () => {
    if (isScreenSharing) {
      // Stop screen sharing and revert to camera
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.stop()
        }
      }

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

        streamRef.current = newStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream
        }

        setLocalStream(newStream)
        setIsScreenSharing(false)

        // Update all peer connections with the new stream
        peersRef.current.forEach(({ peer }) => {
          peer.removeStream(streamRef.current!)
          peer.addStream(newStream)
        })
      } catch (error) {
        console.error("Error reverting to camera:", error)
        toast.error("Failed to revert to camera")
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })

        // Keep audio from the original stream
        if (streamRef.current) {
          const audioTrack = streamRef.current.getAudioTracks()[0]
          if (audioTrack) {
            screenStream.addTrack(audioTrack)
          }
        }

        streamRef.current = screenStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }

        setLocalStream(screenStream)
        setIsScreenSharing(true)

        // Update all peer connections with the new stream
        peersRef.current.forEach(({ peer }) => {
          peer.removeStream(streamRef.current!)
          peer.addStream(screenStream)
        })

        // Handle the case when user stops sharing via the browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenSharing()
        }
      } catch (error) {
        console.error("Error sharing screen:", error)
        toast.error("Failed to share screen")
      }
    }
  }

  // Toggle hand raise
  const toggleHandRaise = () => {
    if (!socket || !user) return

    const userId = user.sub || user.email || "user-" + Date.now()
    const newState = !isHandRaised

    socket.emit("raise-hand", {
      meetingId,
      userId,
      isRaised: newState,
    })

    setIsHandRaised(newState)

    // Update local participant state
    setParticipants((prev) => prev.map((p) => (p.isYou ? { ...p, hasHandRaised: newState } : p)))
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Leave meeting
  const leaveMeeting = () => {
    // Stop all tracks
    localStream?.getTracks().forEach((track) => track.stop())

    // Disconnect peers
    peersRef.current.forEach(({ peer }) => {
      peer.destroy()
    })

    // Leave the room
    if (socket && user) {
      socket.emit("leave-room", {
        meetingId,
        userId: user.sub || user.email || "user-" + Date.now(),
      })
    }

    // Navigate to dashboard
    router.push("/dashboard")
  }

  // Send chat message
  const sendMessage = (content: string) => {
    if (!socket || !user) return

    const userId = user.sub || user.email || "user-" + Date.now()
    const messageData = {
      meetingId,
      senderId: userId,
      content,
      timestamp: new Date().toISOString(),
    }

    socket.emit("message", messageData)
    setMessages((prev) => [...prev, messageData])
  }

  // Calculate grid layout based on number of participants
  const getGridLayout = () => {
    const totalParticipants = peers.length + 1 // +1 for local user

    if (totalParticipants === 1) {
      return "grid-cols-1"
    } else if (totalParticipants === 2) {
      return "grid-cols-1 md:grid-cols-2"
    } else if (totalParticipants <= 4) {
      return "grid-cols-1 md:grid-cols-2"
    } else if (totalParticipants <= 9) {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
    } else {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    }
  }

  // Calculate video height based on number of participants
  const getVideoHeight = () => {
    const totalParticipants = peers.length + 1 // +1 for local user

    if (totalParticipants === 1) {
      return "h-full"
    } else if (totalParticipants === 2) {
      return "h-full md:h-[calc(100vh-12rem)]"
    } else if (totalParticipants <= 4) {
      return "h-64 md:h-[calc(50vh-6rem)]"
    } else if (totalParticipants <= 9) {
      return "h-48 md:h-[calc(33vh-4rem)]"
    } else {
      return "h-40 md:h-[calc(25vh-3rem)]"
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="mb-4">Please log in to join the meeting</p>
          <Button onClick={() => loginWithRedirect({ appState: { returnTo: `/meeting/${meetingId}` } })}>Log In</Button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">Meeting: {meetingId}</h1>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                  {activeTab === "chat" ? <MessageSquare className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isSidebarOpen ? "Close sidebar" : "Open sidebar"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
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
        <div className={cn("flex-1 p-4 overflow-y-auto", isSidebarOpen ? "md:w-2/3" : "w-full")}>
          <div className={cn("grid gap-4", getGridLayout())}>
            {/* Local video */}
            <div className="relative group">
              <div className={cn("bg-muted rounded-lg overflow-hidden", getVideoHeight())}>
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                You {isHandRaised && "✋"}
              </div>
            </div>

            {/* Remote videos */}
            {peers.map((peer) => (
              <PeerVideo
                key={peer.peerId}
                peer={peer.peer}
                username={peer.username}
                hasHandRaised={participants.find((p) => p.id === peer.peerId)?.hasHandRaised}
                className={getVideoHeight()}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-full md:w-1/3 border-l h-full flex flex-col">
            <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-2 mx-4 my-2">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col">
                <ChatPanel messages={messages} participants={participants} onSendMessage={sendMessage} />
              </TabsContent>

              <TabsContent value="participants" className="flex-1">
                <ParticipantsPanel participants={participants} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="p-4 border-t bg-background">
        <div className="flex items-center justify-center space-x-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAudioEnabled ? "outline" : "destructive"}
                  size="icon"
                  onClick={toggleAudio}
                  className="rounded-full h-12 w-12"
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
                  variant={isVideoEnabled ? "outline" : "destructive"}
                  size="icon"
                  onClick={toggleVideo}
                  className="rounded-full h-12 w-12"
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
                  variant={isScreenSharing ? "default" : "outline"}
                  size="icon"
                  onClick={toggleScreenSharing}
                  className="rounded-full h-12 w-12"
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
                  variant={isHandRaised ? "default" : "outline"}
                  size="icon"
                  onClick={toggleHandRaise}
                  className="rounded-full h-12 w-12"
                >
                  {isHandRaised ? <HandOff className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isHandRaised ? "Lower hand" : "Raise hand"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="icon" onClick={leaveMeeting} className="rounded-full h-12 w-12">
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave meeting</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </footer>
    </div>
  )
}

