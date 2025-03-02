"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import { io, type Socket } from "socket.io-client"
import Peer, { type SignalData } from "simple-peer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Mic,
  MicOff,
  VideoIcon,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Users,
  Share,
  Copy,
  Wifi,
  WifiOff,
} from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface Message {
  text: string
  sender: string
  timestamp: string
  meetingId?: string
  isFromMe?: boolean
}

interface Participant {
  id: string
  name: string
  isYou?: boolean
}

interface Peers {
  [key: string]: Peer.Instance
}

interface Streams {
  [key: string]: MediaStream
}

interface Peer {
  _pc: RTCPeerConnection
  signal: (signalData: SignalData) => void
}
interface ParticipantMap {
  [key: string]: string
}

export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth0()

  // State
  const [socket, setSocket] = useState<Socket | null>(null)
  const [peers, setPeers] = useState<Peers>({})
  const [streams, setStreams] = useState<Streams>({})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [showChat, setShowChat] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantNames, setParticipantNames] = useState<ParticipantMap>({})
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good")
  const [audioOnlyMode, setAudioOnlyMode] = useState(false)
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [guestName, setGuestName] = useState("")

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const peersRef = useRef<Peers>({})
  const socketRef = useRef<Socket | null>(null)
  const userIdRef = useRef<string>("")
  const bandwidthRef = useRef<number>(1000) // Initial bandwidth estimate (kbps)
  const socketInitializedRef = useRef<boolean>(false)

  // Handle guest name input
  useEffect(() => {
    if (!isAuthenticated && !searchParams.get("name") && !socketInitializedRef.current) {
      setShowNameDialog(true)
    } else if (isAuthenticated) {
      userIdRef.current = user?.sub || "AuthenticatedUser"
    } else if (searchParams.get("name")) {
      userIdRef.current = searchParams.get("name") || "Guest"
    }
  }, [isAuthenticated, searchParams, user])

  const handleNameSubmit = useCallback(() => {
    if (guestName.trim()) {
      userIdRef.current = guestName
      setShowNameDialog(false)
      // Update URL with name parameter
      const params = new URLSearchParams(window.location.search)
      params.set("name", guestName)
      router.push(`/meeting/${id}?${params.toString()}`)
      initializeConnection()
    }
  }, [guestName, id, router])

  const initializeConnection = useCallback(async () => {
    if (socketInitializedRef.current || !userIdRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const socketConnection = io(process.env.BACKEND_URL , {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ["websocket", "polling"],
        reconnection: true,
      })

      socketRef.current = socketConnection
      setSocket(socketConnection)
      socketInitializedRef.current = true

      // Register socket events once:
      socketConnection.on("connect", () => {
        console.log("Connected to socket server with ID:", socketConnection.id)
        socketConnection.emit("join-room", {
          meetingId: id,
          userId: userIdRef.current,
          username: isAuthenticated ? user?.name : userIdRef.current,
        })
      })

      socketConnection.on("connect_error", (error) => {
        console.error("Socket connection error:", error)
        toast.error("Failed to connect to the meeting server")
      })

      // Prevent duplicate participants by checking if the user is already in the list
      socketConnection.on("user-connected", ({ userId, username }) => {
        console.log("User connected:", userId, username)
        setParticipants((prev) => {
          if (prev.some((p) => p.id === userId)) return prev
          return [...prev, { id: userId, name: username || userId }]
        })

        // Update participant names mapping
        setParticipantNames((prev) => ({
          ...prev,
          [userId]: username || userId,
        }))

        // Create a new peer connection only if one does not exist.
        if (!peersRef.current[userId]) {
          const peer = createPeer(userId, socketConnection.id ?? "", stream)
          peersRef.current[userId] = peer
          setPeers((prev) => ({ ...prev, [userId]: peer }))
          monitorPeerConnection(peer, userId)
        }
      })

      socketConnection.on("user-disconnected", (userId) => {
        console.log("User disconnected:", userId)
        setParticipants((prev) => prev.filter((p) => p.id !== userId))
        if (peersRef.current[userId]) {
          peersRef.current[userId].destroy()
          delete peersRef.current[userId]
          setPeers((prev) => {
            const updated = { ...prev }
            delete updated[userId]
            return updated
          })
          setStreams((prev) => {
            const updated = { ...prev }
            delete updated[userId]
            return updated
          })
        }
      })

      socketConnection.on("createMessage", (message: Message) => {
        // Only add the message if it's not from the current user or doesn't have the isFromMe flag
        if (message.sender !== userIdRef.current || !message.isFromMe) {
          setMessages((prev) => [...prev, message])
        }
      })

      // Handle offer event: when another user initiates a call.
      socketConnection.on("offer", (data: { offer: SignalData; callerId: string; userId: string }) => {
        console.log(`Received offer from ${data.callerId}`)
        // Only process if the offer is for this user
        if (data.userId === userIdRef.current) {
          const peer = addPeer(data.offer, data.callerId, stream)
          peersRef.current[data.callerId] = peer
          setPeers((prev) => ({ ...prev, [data.callerId]: peer }))
          monitorPeerConnection(peer, data.callerId)
        }
      })

      // Handle answer with stable state checking
      socketConnection.on("answer", (data: { answer: SignalData; callerId: string }) => {
        const peer = peersRef.current[data.callerId] as unknown as Peer
        if (peer) {
          const pc = peer._pc
          // Only signal the answer if the underlying RTCPeerConnection is in "have-local-offer" state.
          if (pc && pc.signalingState === "have-local-offer") {
            console.log(`Setting remote answer for ${data.callerId}`)
            peer.signal(data.answer)
          } else {
            console.warn(`Answer from ${data.callerId} ignored (signalingState: ${pc ? pc.signalingState : "unknown"})`)
          }
        }
      })

      // Handle ICE candidates
      socketConnection.on("candidate", (data: { candidate: SignalData; callerId: string }) => {
        if (peersRef.current[data.callerId]) {
          peersRef.current[data.callerId].signal(data.candidate)
        }
      })

      socketConnection.on("existing-participants", (participants: Array<{ userId: string; username: string }>) => {
        console.log("Existing participants:", participants)

        // Update participants state
        setParticipants((prev) => {
          const newParticipants = [...prev]

          participants.forEach(({ userId, username }) => {
            if (!newParticipants.some((p) => p.id === userId)) {
              newParticipants.push({
                id: userId,
                name: username || userId,
              })
            }
          })

          return newParticipants
        })

        // Update participant names mapping
        const namesMap: ParticipantMap = {}
        participants.forEach(({ userId, username }) => {
          namesMap[userId] = username || userId
        })

        setParticipantNames((prev) => ({
          ...prev,
          ...namesMap,
        }))
      })

      setIsConnecting(false)
    } catch (error) {
      console.error("Error initializing meeting:", error)
      toast.error("Could not access camera or microphone. Please check permissions.")
      setIsConnecting(false)
    }
  }, [id, user, isAuthenticated])

  // Initialize connection after name is set
  useEffect(() => {
    if (userIdRef.current && !socketInitializedRef.current) {
      initializeConnection()
    }
  }, [userIdRef.current, initializeConnection]) // Removed isAuthenticated from dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy())
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketInitializedRef.current = false
      }
    }
  }, [localStream])

  useEffect(() => {
    if (connectionQuality === "poor" && !audioOnlyMode) {
      setAudioOnlyMode(true)
      toast.warning("Switching to audio-only mode due to poor connection")
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = false
        })
      }
    } else if (connectionQuality !== "poor" && audioOnlyMode) {
      setAudioOnlyMode(false)
      toast.success("Video enabled: Connection quality improved")
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = true
        })
      }
    }
  }, [connectionQuality, audioOnlyMode, localStream])

  // Function to create a new peer (initiator)
  const createPeer = useCallback(
    (userId: string, socketId: string, stream: MediaStream) => {
      console.log(`Creating peer for ${userId} with my socket ID ${socketId}`)
      const peer = new Peer({
        initiator: true,
        trickle: true, // Change to true to use ICE trickle for faster connections
        stream,
      })

      peer.on("signal", (data) => {
        console.log(`Sending signal to ${userId}, type:`, data.type || "candidate")
        socketRef.current?.emit("offer", {
          meetingId: id,
          callerId: socketId,
          userId,
          offer: data,
        })
      })

      peer.on("connect", () => {
        console.log(`Connected to peer ${userId}`)
      })

      peer.on("error", (err) => {
        console.error(`Peer error with ${userId}:`, err)
      })

      peer.on("stream", (remoteStream) => {
        console.log(
          `Received stream from ${userId}:`,
          remoteStream.id,
          remoteStream.getTracks().map((t) => `${t.kind}:${t.enabled}`),
        )

        // Ensure we're updating state with the new stream
        setStreams((prev) => {
          // Only update if the stream isn't already in state or has changed
          if (!prev[userId] || prev[userId].id !== remoteStream.id) {
            console.log(`Adding stream from ${userId} to state`)
            return { ...prev, [userId]: remoteStream }
          }
          return prev
        })
      })

      // Add bandwidth estimation
      peer.on("data", (data) => {
        try {
          const message = JSON.parse(data.toString())
          if (message.type === "bandwidth") {
            bandwidthRef.current = message.value
            updateConnectionQuality(message.value)
          }
        } catch (err) {
          console.error("Error parsing peer data:", err)
        }
      })

      return peer
    },
    [id],
  )

  // Function to add a peer when receiving an offer
  const addPeer = useCallback(
    (incomingSignal: SignalData, callerId: string, stream: MediaStream) => {
      console.log(`Adding peer for ${callerId}, signal type:`, incomingSignal.type || "candidate")
      const peer = new Peer({
        initiator: false,
        trickle: true, // Change to true to use ICE trickle for faster connections
        stream,
      })

      peer.on("signal", (data) => {
        console.log(`Sending answer to ${callerId}, type:`, data.type || "candidate")
        socketRef.current?.emit("answer", {
          meetingId: id,
          callerId,
          answer: data,
        })
      })

      peer.on("connect", () => {
        console.log(`Connected to peer ${callerId}`)
      })

      peer.on("error", (err) => {
        console.error(`Peer error with ${callerId}:`, err)
      })

      peer.on("stream", (remoteStream) => {
        console.log(
          `Received stream from ${callerId}:`,
          remoteStream.id,
          remoteStream.getTracks().map((t) => `${t.kind}:${t.enabled}`),
        )

        // Ensure we're updating state with the new stream
        setStreams((prev) => {
          // Only update if the stream isn't already in state or has changed
          if (!prev[callerId] || prev[callerId].id !== remoteStream.id) {
            console.log(`Adding stream from ${callerId} to state`)
            return { ...prev, [callerId]: remoteStream }
          }
          return prev
        })
      })

      // Add bandwidth estimation
      peer.on("data", (data) => {
        try {
          const message = JSON.parse(data.toString())
          if (message.type === "bandwidth") {
            bandwidthRef.current = message.value
            updateConnectionQuality(message.value)
          }
        } catch (err) {
          console.error("Error parsing peer data:", err)
        }
      })

      // Signal the incoming offer to establish the connection
      peer.signal(incomingSignal)
      return peer
    },
    [id],
  )

  const updateConnectionQuality = (bandwidth: number) => {
    if (bandwidth > 1000) {
      setConnectionQuality("good")
    } else if (bandwidth > 500) {
      setConnectionQuality("fair")
    } else {
      setConnectionQuality("poor")
    }
  }

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setAudioEnabled(!audioEnabled)
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setVideoEnabled(!videoEnabled)
    }
  }

  // Send message
  const sendMessage = (text: string) => {
    if (socket && text.trim()) {
      const messageData = {
        text,
        sender: userIdRef.current,
        timestamp: new Date().toISOString(),
        meetingId: id,
        isFromMe: true, // Add this flag to identify locally sent messages
      }
      socket.emit("message", messageData)
      setMessages((prev) => [...prev, messageData])
    }
  }

  // Share meeting link
  const shareMeeting = () => {
    const meetingLink = `${window.location.origin}/meeting/${id}`
    navigator.clipboard.writeText(meetingLink)
    toast.success("Meeting link copied to clipboard")
  }

  // Leave meeting
  const leaveMeeting = () => {
    window.location.href = "/dashboard"
  }

  const adjustVideoQuality = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        let quality: "high" | "medium" | "low"
        if (bandwidthRef.current > 1000) {
          quality = "high"
        } else if (bandwidthRef.current > 500) {
          quality = "medium"
        } else {
          quality = "low"
        }

        const constraints: MediaTrackConstraints = {
          width: quality === "high" ? 1280 : quality === "medium" ? 640 : 320,
          height: quality === "high" ? 720 : quality === "medium" ? 480 : 240,
          frameRate: quality === "high" ? 30 : quality === "medium" ? 20 : 15,
        }

        videoTrack
          .applyConstraints(constraints)
          .then(() => console.log("Video quality adjusted:", quality))
          .catch((error) => console.error("Error adjusting video quality:", error))
      }
    }
  }, [localStream])

  useEffect(() => {
    const interval = setInterval(() => {
      if (socketInitializedRef.current) {
        adjustVideoQuality()
        Object.values(peersRef.current).forEach((peer) => {
          peer.send(JSON.stringify({ type: "bandwidth", value: bandwidthRef.current }))
        })
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [adjustVideoQuality])

  const monitorPeerConnection = (peer: Peer.Instance, userId: string) => {
    const pc = (peer as unknown as Peer)._pc
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${userId}:`, pc.iceConnectionState)
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          console.warn(`ICE connection failed with ${userId}, attempting restart`)
          pc.restartIce()
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${userId}:`, pc.connectionState)
      }
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter your name to join the meeting</DialogTitle>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleNameSubmit()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="default" onClick={handleNameSubmit}>
              Join Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">Meeting: {id}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={shareMeeting}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowParticipants(!showParticipants)}>
            <Users className="h-4 w-4 mr-2" />
            Participants ({Object.keys(peers).length + 1})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
          <div className="flex items-center gap-1">
            {connectionQuality === "good" && <Wifi className="h-5 w-5 text-green-500" />}
            {connectionQuality === "fair" && <Wifi className="h-5 w-5 text-yellow-500" />}
            {connectionQuality === "poor" && <WifiOff className="h-5 w-5 text-red-500" />}
            <span className="text-sm">{connectionQuality}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 overflow-auto">
          {isConnecting ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr h-full">
              {/* Local video */}
              <Card className="relative overflow-hidden">
                {audioOnlyMode ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Mic className="h-12 w-12 mx-auto mb-2" />
                      <p>Audio Only Mode</p>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    muted
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${!videoEnabled ? "hidden" : ""}`}
                  />
                )}
                {!videoEnabled && !audioOnlyMode && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-2xl text-primary-foreground font-bold">
                      {userIdRef.current.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-sm">
                  You {!audioEnabled && `(muted)`}
                </div>
              </Card>

              {/* Remote videos */}
              {Object.entries(streams).map(([userId, stream]) => (
                <Card key={userId} className="relative overflow-hidden">
                  {audioOnlyMode ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center">
                        <Mic className="h-12 w-12 mx-auto mb-2" />
                        <p>Audio Only Mode</p>
                      </div>
                    </div>
                  ) : (
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el) {
                          el.srcObject = stream
                          // Ensure video plays
                          el.play().catch((err) => {
                            console.error(`Error playing video for ${userId}:`, err)
                            // Try again with muted attribute which browsers allow without user interaction
                            el.muted = true
                            el.play().catch((err2) => console.error(`Error playing muted video for ${userId}:`, err2))
                          })
                        }
                      }}
                    />
                  )}
                  <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-sm">
                    {participantNames[userId] || userId}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Side panels */}
        {showChat && (
          <div className="w-80 border-l bg-background flex flex-col h-full">
            <ChatPanel messages={messages} sendMessage={sendMessage} currentUser={userIdRef.current} />
          </div>
        )}

        {showParticipants && (
          <div className="w-80 border-l bg-background flex flex-col h-full">
            <ParticipantsPanel
              participants={[
                { id: userIdRef.current, name: userIdRef.current, isYou: true },
                ...participants.map((p) => ({
                  id: p.id,
                  name: participantNames[p.id] || p.id,
                  isYou: false,
                })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Meeting controls */}
      <footer className="p-4 border-t bg-background">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={audioEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={toggleAudio}
            className="rounded-full h-12 w-12"
          >
            {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button
            variant={videoEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full h-12 w-12"
          >
            {videoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={() => {
              navigator.mediaDevices
                .getDisplayMedia({ video: true })
                .then((stream) => {
                  const videoTrack = stream.getVideoTracks()[0]

                  Object.values(peersRef.current).forEach((peer) => {
                    // Cast peer to the correct type
                    const peerConnection = (peer as unknown as Peer)._pc
                    if (peerConnection) {
                      const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video")
                      if (sender) {
                        sender.replaceTrack(videoTrack)
                      }
                    }
                  })

                  videoTrack.onended = () => {
                    if (localStream) {
                      const originalVideoTrack = localStream.getVideoTracks()[0]
                      Object.values(peersRef.current).forEach((peer) => {
                        // Cast peer to the correct type
                        const peerConnection = (peer as unknown as Peer)._pc
                        if (peerConnection) {
                          const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video")
                          if (sender) {
                            sender.replaceTrack(originalVideoTrack)
                          }
                        }
                      })
                    }
                  }
                })
                .catch((err) => {
                  console.error("Error sharing screen:", err)
                  toast.error("Could not share screen. Please check permissions.")
                })
            }}
          >
            <Share className="h-5 w-5" />
          </Button>
          <Button variant="destructive" size="icon" onClick={leaveMeeting} className="rounded-full h-12 w-12">
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  )
}

