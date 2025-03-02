"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import { VideoGrid } from "@/components/video-grid"
import { MeetingControls } from "@/components/meeting-controls"
import { MeetingHeader } from "@/components/meeting-header"
import { NameDialog } from "@/components/name-dialog"
import { ChatPanel } from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"
import { useMediaStream } from "@/hooks/use-media-stream"
import { usePeerConnections } from "@/hooks/use-peer-connections"
import { useSocketConnection } from "@/hooks/use-socket-connection"
import { Socket } from "socket.io-client";

interface SocketRef {
  current: Socket;
}

declare global {
  interface Window {
    socketRef?: SocketRef;
  }
}


export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth0()

  // State
  const [showChat, setShowChat] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [guestName, setGuestName] = useState("")

  const userIdRef = useRef<string>("")
  const socketInitializedRef = useRef<boolean>(false)

  // Custom hooks
  const {
    localStream,
    audioEnabled,
    videoEnabled,
    audioOnlyMode,
    isConnecting,
    connectionQuality,
    bandwidthRef,
    toggleAudio,
    toggleVideo,
    adjustVideoQuality,
  } = useMediaStream()

  const { peers, streams, peersRef, createPeer, addPeer, monitorPeerConnection } = usePeerConnections(
    id as string,
    bandwidthRef,
  )

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

  const handleNameSubmit = () => {
    if (guestName.trim()) {
      userIdRef.current = guestName
      setShowNameDialog(false)
      // Update URL with name parameter
      const params = new URLSearchParams(window.location.search)
      params.set("name", guestName)
      router.push(`/meeting/${id}?${params.toString()}`)
    }
  }

  // Socket connection (only after user ID is set)
  const { socket, participants, participantNames, messages, sendMessage } = useSocketConnection({
    meetingId: id as string,
    userId: userIdRef.current,
    username: isAuthenticated ? user?.name || userIdRef.current : userIdRef.current,
    localStream,
    createPeer,
    addPeer,
    peersRef,
    monitorPeerConnection,
  })

<<<<<<< HEAD
  // Make socket available globally for peer connections
=======
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const socketConnection = io(process.env.NEXT_PUBLIC_BACKEND_URL || "", {
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
>>>>>>> parent of 8eb4594 (install dialog component)
  useEffect(() => {
    if (socket) {
      window.socketRef = { current: socket }
    }
  }, [socket])

  // Adjust video quality based on connection
  useEffect(() => {
    const interval = setInterval(() => {
      if (socketInitializedRef.current && localStream) {
        adjustVideoQuality()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [adjustVideoQuality, localStream])

  // Leave meeting
  const leaveMeeting = () => {
    window.location.href = "/dashboard"
  }

  // update connection quality


  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Name Dialog */}
      <NameDialog
        open={showNameDialog}
        onOpenChange={setShowNameDialog}
        guestName={guestName}
        setGuestName={setGuestName}
        handleNameSubmit={handleNameSubmit}
      />

      {/* Meeting header */}
      <MeetingHeader
        meetingId={id as string}
        participantCount={Object.keys(peers).length + 1}
        connectionQuality={connectionQuality}
        setShowChat={setShowChat}
        showChat={showChat}
        setShowParticipants={setShowParticipants}
        showParticipants={showParticipants}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 overflow-auto">
          <VideoGrid
            localStream={localStream}
            streams={streams}
            participantNames={participantNames}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            audioOnlyMode={audioOnlyMode}
            isConnecting={isConnecting}
            currentUserId={userIdRef.current}
          />
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
      <MeetingControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        leaveMeeting={leaveMeeting}
        localStream={localStream}
        peersRef={peersRef}
      />
    </div>
  )
}

