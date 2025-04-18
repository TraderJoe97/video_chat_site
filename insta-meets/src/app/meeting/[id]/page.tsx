"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import { useSocket } from "@/contexts/SocketContext"
import { toast } from "sonner"
import { JoinMeetingModal } from "@/components/join-meeting-modal"
import { fetchTurnServers } from "@/lib/turn-servers"
import { MeetingHeader } from "@/components/meeting/meeting-header"
import { MeetingControls } from "@/components/meeting/meeting-controls"
import { VideoGrid } from "@/components/meeting/video-grid"
import { MeetingSidebar } from "@/components/meeting/meeting-sidebar"
import { usePeerConnections } from "@/hooks/use-peer-connections"
import type Peer from "simple-peer"

export interface Message {
  senderId: string
  content: string
  timestamp: string
  isFromCurrentUser?: boolean // Added flag to identify messages from current user
}

interface Participant {
  id: string
  name: string
  isYou?: boolean
  hasHandRaised?: boolean
}

export default function MeetingPage() {
  const { id: meetingId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const guestName = searchParams.get("name")
  const router = useRouter()
  const { socket, isConnected } = useSocket()
  const { user, isAuthenticated, isLoading } = useAuth0()

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("chat")
  const [isLoadingIceServers, setIsLoadingIceServers] = useState(true)

  // User state
  const [userId, setUserId] = useState<string>("")
  const [username, setUsername] = useState<string>("")
  const [isJoined, setIsJoined] = useState(false)
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])

  // Media state
  const [isAudioOnlyMode, setIsAudioOnlyMode] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null)

  // Stream refs for consistent access
  const streamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  // Peer connections state from custom hook
  const { 
    peers, 
    peersRef, 
    createPeer, 
    addPeer, 
    handlePeerReconnect, 
    safelySignalPeer, // Added this from the updated hook
    setPeers, 
    setIceServers 
  } = usePeerConnections({
    meetingId,
    userId,
    socket,
    isAudioOnlyMode,
    streamRef,
    audioStreamRef,
  })

  // Toggle audio-only mode
  const toggleAudioOnlyMode = useCallback(() => {
    if (!streamRef.current && !audioStreamRef.current) {
      toast.error("No media streams available")
      return
    }

    const newMode = !isAudioOnlyMode
    setIsAudioOnlyMode(newMode)

    console.log(`[Meeting] ${newMode ? "Enabling" : "Disabling"} audio-only mode`)

    // Reconnect all peers with the appropriate stream
    peersRef.current.forEach(({ username }) => {
      try {
        console.log(`[Meeting] Reconnecting peer ${username} with ${newMode ? "audio-only" : "audio+video"} stream`)
        handlePeerReconnect(username)
      } catch (e) {
        console.error(`[Meeting] Error updating stream for ${username}:`, e)
      }
    })

    toast.success(`${newMode ? "Audio-only" : "Audio and video"} mode enabled`)
  }, [isAudioOnlyMode, handlePeerReconnect, peersRef])

  // Fetch TURN servers
  useEffect(() => {
    const getTurnServers = async () => {
      setIsLoadingIceServers(true)
      try {
        console.log("[Meeting] Fetching TURN servers")
        const servers = await fetchTurnServers()
        console.log("[Meeting] Successfully fetched TURN servers:", servers)
        setIceServers(servers)
      } catch (error) {
        console.error("[Meeting] Error fetching TURN servers:", error)
        toast.error("Failed to fetch TURN servers, using fallback servers")

        // Set fallback servers
        setIceServers([
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ])
      } finally {
        setIsLoadingIceServers(false)
      }
    }

    getTurnServers()
  }, [setIceServers])

  // Determine if user is guest or authenticated
  useEffect(() => {
    if (!isLoading) {
      console.log("[Meeting] Auth state:", { isAuthenticated, guestName, user })

      // If authenticated, use Auth0 user info
      if (isAuthenticated && user) {
        setUserId(user.sub || user.email || `user-${Date.now()}`)
        setUsername(user.name || user.email || "Authenticated User")
        console.log("[Meeting] Using authenticated user:", user.name)
      }
      // If not authenticated but has guest name, use that
      else if (guestName) {
        setUserId(`guest-${Date.now()}`)
        setUsername(guestName || "Guest User")
        console.log("[Meeting] Using guest name:", guestName)
      }
      // The redirect is now handled by the parent component
    }
  }, [isLoading, isAuthenticated, user, guestName])

  // Debug logging for user identification
  useEffect(() => {
    if (userId && username) {
      console.log(`[Meeting] User identified - ID: ${userId}, Name: ${username}`)
    }
  }, [userId, username])

  // Initialize media and join meeting
  useEffect(() => {
    // Only proceed if we have user info, socket connection, and ice servers
    if (!userId || !username || !socket || !isConnected || isLoadingIceServers) return

    console.log(`[Meeting] Initializing media and joining meeting ${meetingId}`)

    const initializeMediaAndJoinMeeting = async () => {
      try {
        console.log("[Meeting] Requesting media devices...")

        // Get both audio and video streams
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

        console.log(
          `[Meeting] Media access granted - Video tracks: ${stream.getVideoTracks().length}, Audio tracks: ${stream.getAudioTracks().length}`,
        )
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        // Create a separate audio-only stream
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          const audioOnlyStream = new MediaStream([audioTrack])
          setLocalAudioStream(audioOnlyStream)
          audioStreamRef.current = audioOnlyStream
        }

        // Store stream in ref for consistent access
        streamRef.current = stream

        setLocalStream(stream)
        // We'll set the srcObject in a useEffect instead

        setLocalStream(stream)
        setIsVideoEnabled(true)
        setIsAudioEnabled(true)

        // Add yourself to participants
        const currentUser = {
          id: userId,
          name: username,
          isYou: true,
        }

        setParticipants((prev) => {
          if (prev.some((p) => p.id === currentUser.id)) return prev
          return [...prev, currentUser]
        })

        // Join the meeting room
        console.log(`[Meeting] Joining room ${meetingId} as ${username} (${userId})`)
        socket.emit("join-room", {
          meetingId,
          userId,
          username,
        })

        setIsJoined(true)
        toast.success("Joined meeting successfully")
      } catch (error) {
        console.error("[Meeting] Failed to get media devices:", error)
        toast.error("Failed to access camera or microphone")

        // Try to get audio only as fallback
        try {
          console.log("[Meeting] Attempting to get audio only as fallback")
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          })

          setLocalAudioStream(audioOnlyStream)
          audioStreamRef.current = audioOnlyStream
          setIsAudioOnlyMode(true)
          setIsVideoEnabled(false)
          setIsAudioEnabled(true)

          // Add yourself to participants
          const currentUser = {
            id: userId,
            name: username,
            isYou: true,
          }

          setParticipants((prev) => {
            if (prev.some((p) => p.id === currentUser.id)) return prev
            return [...prev, currentUser]
          })

          // Join the meeting room with audio only
          console.log(`[Meeting] Joining room ${meetingId} as ${username} (${userId}) with audio only`)
          socket.emit("join-room", {
            meetingId,
            userId,
            username,
          })

          setIsJoined(true)
          toast.success("Joined meeting with audio only")
        } catch (audioError) {
          console.error("[Meeting] Failed to get audio devices:", audioError)

          // Join without media as a last resort
          console.log("[Meeting] Joining meeting without media as fallback")

          // Add yourself to participants
          const currentUser = {
            id: userId,
            name: username,
            isYou: true,
          }

          setParticipants((prev) => {
            if (prev.some((p) => p.id === currentUser.id)) return prev
            return [...prev, currentUser]
          })

          // Join the meeting room without media
          socket.emit("join-room", {
            meetingId,
            userId,
            username,
          })

          setIsJoined(true)
          toast.warning("Joined meeting without camera/microphone")
        }
      }
    }

    initializeMediaAndJoinMeeting()

    return () => {
      // Clean up
      console.log("[Meeting] Cleaning up resources")
      if (streamRef.current) {
        console.log("[Meeting] Stopping all media tracks")
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (audioStreamRef.current) {
        console.log("[Meeting] Stopping all audio tracks")
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      // Disconnect peers
      console.log(`[Meeting] Destroying ${peersRef.current.length} peer connections`)
      peersRef.current.forEach(({ peer }) => {
        peer.destroy()
      })

      // Leave the room
      if (socket && userId) {
        console.log(`[Meeting] Leaving room ${meetingId}`)
        socket.emit("leave-room", {
          meetingId,
          userId,
        })
      }
    }
  }, [isConnected, socket, userId, username, meetingId, isLoadingIceServers, peersRef, createPeer, addPeer])

  // Socket event handlers
  useEffect(() => {
    console.log("SOCKET EVENT HANDLERS USE EFFECT RERENDER");
    if (!socket || !userId || !isJoined || isLoadingIceServers) return

    console.log("[Meeting] Setting up socket event handlers")

    // Handle new user connected
    const handleUserConnected = (data: { userId: string; username: string }) => {
      console.log(`[Meeting] User connected: ${data.username} (${data.userId})`)

      // Add to participants list
      setParticipants((prev) => {
        if (prev.some((p) => p.id === data.userId)) return prev
        return [...prev, { id: data.userId, name: data.username }]
      })

      // Create a new peer connection if we have a stream
      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      if (streamToUse) {
        console.log(`[Meeting] Creating peer connection to ${data.username} (${data.userId})`)
        const peer = createPeer(data.userId, userId, streamToUse)
        const timestamp = Date.now()

        peersRef.current.push({
          peerId: data.userId,
          peer,
          username: data.username,
          createdAt: timestamp,
          isDestroyed: false
        })

        setPeers((prev) => [
          ...prev,
          {
            peerId: data.userId,
            peer,
            username: data.username,
            createdAt: timestamp,
            isDestroyed: false
          },
        ])
      } else {
        console.log(`[Meeting] No local stream available, skipping peer creation for ${data.userId}`)
      }
    }

    // Handle existing participants
    const handleExistingParticipants = (participants: { userId: string; username: string }[]) => {
      console.log(`[Meeting] Received ${participants.length} existing participants`)

      // Only proceed if we have a stream
      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      if (!streamToUse) {
        console.log("[Meeting] No local stream available, skipping peer creation for existing participants")

        // Still add participants to the list
        participants.forEach((participant) => {
          setParticipants((prev) => {
            if (prev.some((p) => p.id === participant.userId)) return prev
            return [...prev, { id: participant.userId, name: participant.username }]
          })
        })

        return
      }

      participants.forEach((participant) => {
        console.log(`[Meeting] Processing existing participant: ${participant.username} (${participant.userId})`)

        // Add to participants list
        setParticipants((prev) => {
          if (prev.some((p) => p.id === participant.userId)) return prev
          return [...prev, { id: participant.userId, name: participant.username }]
        })

        // Create a new peer connection
        console.log(`[Meeting] Creating peer connection to ${participant.username} (${participant.userId})`)
        const peer = createPeer(participant.userId, userId, streamToUse)
        const timestamp = Date.now()

        peersRef.current.push({
          peerId: participant.userId,
          peer,
          username: participant.username,
          createdAt: timestamp,
          isDestroyed: false
        })

        setPeers((prev) => [
          ...prev,
          {
            peerId: participant.userId,
            peer,
            username: participant.username,
            createdAt: timestamp,
            isDestroyed: false
          },
        ])
      })
    }

    // Handle user disconnected
    const handleUserDisconnected = (userId: string) => {
      console.log(`[Meeting] User disconnected: ${userId}`)

      // Remove from participants list
      setParticipants((prev) => prev.filter((p) => p.id !== userId))

      // Close and remove peer connection
      const peerObj = peersRef.current.find((p) => p.peerId === userId)
      if (peerObj) {
        console.log(`[Meeting] Destroying peer connection to ${userId}`)
        // Mark as destroyed before actually destroying
        peerObj.isDestroyed = true
        peerObj.peer.destroy()
      }

      peersRef.current = peersRef.current.filter((p) => p.peerId !== userId)
      setPeers((prev) => prev.filter((p) => p.peerId !== userId))
    }

    // Handle WebRTC signaling - offer
    const handleOffer = (data: { callerId: string; offer: Peer.SignalData }) => {
      console.log(`[Meeting] Received offer from: ${data.callerId}`)

      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      if (!streamToUse) {
        console.log(`[Meeting] No local stream available, cannot answer offer from ${data.callerId}`)
        return
      }

      console.log(`[Meeting] Creating answer peer for ${data.callerId}`)
      const peer = addPeer(data.callerId, userId, data.offer, streamToUse)
      const timestamp = Date.now()

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId)
      const username = peerObj?.username || data.callerId

      if (!peerObj) {
        console.log(`[Meeting] Adding new peer connection for ${data.callerId}`)
        peersRef.current.push({
          peerId: data.callerId,
          peer,
          username,
          createdAt: timestamp,
          isDestroyed: false
        })

        setPeers((prev) => [
          ...prev,
          {
            peerId: data.callerId,
            peer,
            username,
            createdAt: timestamp,
            isDestroyed: false
          },
        ])
      }
    }

    // Handle WebRTC signaling - answer
    const handleAnswer = (data: { callerId: string; answer: Peer.SignalData }) => {
      console.log(`[Meeting] Received answer from: ${data.callerId}`)
      
      // Use the new safe signaling method instead of directly accessing the peer
      const success = safelySignalPeer(data.callerId, data.answer)
      
      if (!success) {
        console.log(`[Meeting] Could not apply answer to peer ${data.callerId} - peer may be destroyed or not found`)
      }
    }

    // Handle WebRTC signaling - ICE candidate
    const handleCandidate = (data: { callerId: string; candidate: RTCIceCandidate }) => {
      console.log(`[Meeting] Received ICE candidate from: ${data.callerId}`)
      
      // Use the new safe signaling method
      const success = safelySignalPeer(data.callerId, { 
        type: "candidate", 
        candidate: data.candidate 
      })
      
      if (!success) {
        console.log(`[Meeting] Could not apply ICE candidate to peer ${data.callerId} - peer may be destroyed or not found`)
      }
    }

    // Handle chat messages
    const handleMessage = (message: Message) => {
      // Skip messages that were sent by the current user to avoid duplicates
      if (message.senderId === userId || message.isFromCurrentUser) {
        console.log(`[Meeting] Skipping own message from: ${message.senderId}`);
        return;
      }
      
      console.log(`[Meeting] Received message from ${message.senderId}: ${message.content}`)
      setMessages((prev) => [...prev, message])
    }

    // Handle hand raise
    const handleRaiseHand = (data: { userId: string; isRaised: boolean }) => {
      console.log(`[Meeting] User ${data.userId} ${data.isRaised ? "raised" : "lowered"} hand`)
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
      console.log("[Meeting] Removing socket event handlers")
      socket.off("user-connected", handleUserConnected)
      socket.off("existing-participants", handleExistingParticipants)
      socket.off("user-disconnected", handleUserDisconnected)
      socket.off("offer", handleOffer)
      socket.off("answer", handleAnswer)
      socket.off("candidate", handleCandidate)
      socket.off("createMessage", handleMessage)
      socket.off("raise-hand", handleRaiseHand)
    }
  }, [
    socket,
    userId,
    isJoined,
    meetingId,
    isLoadingIceServers,
    isAudioOnlyMode,
    createPeer,
    addPeer,
    safelySignalPeer, // Added the new function to dependencies
    peersRef,
    setPeers,
    toggleAudioOnlyMode,
    audioStreamRef,
    streamRef,
  ])

  // Configure WebRTC for low bandwidth
  const configureLowBandwidth = useCallback(() => {
    if (!streamRef.current && !audioStreamRef.current) {
      toast.error("No media stream available")
      return
    }

    // Toggle low bandwidth mode
    const newMode = !isLowBandwidthMode
    setIsLowBandwidthMode(newMode)

    if (newMode) {
      console.log("[Meeting] Enabling low bandwidth mode - reducing outgoing stream quality")

      // If we have video, reduce its quality
      if (streamRef.current && streamRef.current.getVideoTracks().length > 0) {
        streamRef.current.getVideoTracks().forEach((track) => {
          if (track.getConstraints() && track.applyConstraints) {
            // Apply very low quality constraints for outgoing video
            track
              .applyConstraints({
                width: { ideal: 160 },
                height: { ideal: 120 },
                frameRate: { max: 8 },
              })
              .then(() => {
                console.log("[Meeting] Successfully applied low bandwidth constraints")
              })
              .catch((e) => {
                console.error("[Meeting] Could not apply video constraints:", e)
                toast.error("Failed to reduce video quality")
              })
          }
        })
      }

      // Consider switching to audio-only mode for very low bandwidth
      if (!isAudioOnlyMode) {
        toast(
          <div className="flex flex-col gap-2">
            <div>Consider switching to audio-only mode for even better performance</div>
            <button onClick={toggleAudioOnlyMode} className="bg-primary text-white px-3 py-1 rounded text-sm">
              Switch to audio-only
            </button>
          </div>,
        )
      }

      // Update all peer connections with the optimized stream
      let updateSuccess = true
      peersRef.current.forEach(({ username }) => {
        try {
          console.log(`[Meeting] Updating stream for ${username} to low bandwidth`)
          // For simple-peer, we need to recreate the connection with the new stream
          // This is more reliable than removeStream/addStream
          handlePeerReconnect(username)
        } catch (e) {
          console.error(`[Meeting] Error updating stream for ${username}:`, e)
          updateSuccess = false
        }
      })

      if (updateSuccess) {
        toast.success("Low bandwidth mode enabled - video quality reduced")
      } else {
        toast.warning("Low bandwidth mode partially enabled - some connections may need to be refreshed")
      }
    } else {
      console.log("[Meeting] Disabling low bandwidth mode - restoring outgoing stream quality")

      // Restore higher quality video if we have video
      if (streamRef.current && streamRef.current.getVideoTracks().length > 0) {
        streamRef.current.getVideoTracks().forEach((track) => {
          if (track.getConstraints() && track.applyConstraints) {
            // Apply higher quality constraints
            track
              .applyConstraints({
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { max: 30 },
              })
              .then(() => {
                console.log("[Meeting] Successfully restored normal quality constraints")
              })
              .catch((e) => {
                console.error("[Meeting] Could not apply video constraints:", e)
                toast.error("Failed to restore video quality")
              })
          }
        })
      }

      // Update all peer connections with the restored stream
      let updateSuccess = true
      peersRef.current.forEach(({ username }) => {
        try {
          console.log(`[Meeting] Updating stream for ${username} to normal quality`)
          // For simple-peer, we need to recreate the connection with the new stream
          handlePeerReconnect(username)
        } catch (e) {
          console.error(`[Meeting] Error updating stream for ${username}:`, e)
          updateSuccess = false
        }
      })

      if (updateSuccess) {
        toast.success("Normal quality mode enabled")
      } else {
        toast.warning("Normal quality mode partially enabled - some connections may need to be refreshed")
      }
    }
  }, [isLowBandwidthMode, handlePeerReconnect, isAudioOnlyMode, peersRef, toggleAudioOnlyMode])

  // Monitor connection quality and suggest low bandwidth mode if needed
  useEffect(() => {
    if ((!streamRef.current && !audioStreamRef.current) || isLowBandwidthMode) return

    let connectionIssuesCount = 0
    const connectionCheckInterval = setInterval(() => {
      // Check if we have any failed peer connections
      const failedConnections = peersRef.current.filter((p) => {
        try {
          return !p.peer.connected
        } catch (e) {
          console.error("[Meeting] Error checking peer connection:", e)
          return true // Count as failed if we can't determine
        }
      })

      if (failedConnections.length > 0) {
        connectionIssuesCount++
        console.log(`[Meeting] Connection issues detected (${connectionIssuesCount})`)

        // After 2 consecutive issues, suggest low bandwidth mode
        if (connectionIssuesCount >= 2) {
          toast(
            <div className="flex flex-col gap-2">
              <div>Connection issues detected</div>
              <button
                className="bg-primary text-white px-3 py-1 rounded text-sm"
                onClick={() => {
                  configureLowBandwidth()
                  toast.dismiss()
                }}
              >
                Enable Low Bandwidth Mode
              </button>
            </div>,
            {
              duration: 10000,
            },
          )
          clearInterval(connectionCheckInterval)
        }
      } else {
        // Reset counter if connections are good
        connectionIssuesCount = 0
      }
    }, 8000) // Check every 8 seconds

    return () => clearInterval(connectionCheckInterval)
  }, [isLowBandwidthMode, configureLowBandwidth, peersRef])

  // Set local video stream when it's available
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log("[Meeting] Setting local video stream in useEffect")
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
        console.log(`[Meeting] Video ${videoTrack.enabled ? "enabled" : "disabled"}`)
      }
    }
  }, [])

  // Toggle audio
  const toggleAudio = useCallback(() => {
    // Determine which stream to use for toggling audio
    const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

    if (streamToUse) {
      const audioTrack = streamToUse.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
        console.log(`[Meeting] Audio ${audioTrack.enabled ? "enabled" : "disabled"}`)
      }
    }
  }, [isAudioOnlyMode])

  // Toggle hand raise
  const toggleHandRaise = useCallback(() => {
    if (!socket || !userId) return

    const newState = !isHandRaised
    console.log(`[Meeting] ${newState ? "Raising" : "Lowering"} hand`)

    socket.emit("raise-hand", {
      meetingId,
      userId,
      isRaised: newState,
    })

    setIsHandRaised(newState)

    // Update local participant state
    setParticipants((prev) => prev.map((p) => (p.isYou ? { ...p, hasHandRaised: newState } : p)))
  }, [isHandRaised, socket, userId, meetingId])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error("[Meeting] Error attempting to enable fullscreen:", err)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    console.log("[Meeting] Leaving meeting")
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    if (localAudioStream) {
      localAudioStream.getTracks().forEach((track) => track.stop())
    }

    // Disconnect peers
    peersRef.current.forEach(({ peer }) => {
      peer.destroy()
    })

    // Leave the room
    if (socket && userId) {
      socket.emit("leave-room", {
        meetingId,
        userId,
      })
    }

    // Navigate to dashboard for authenticated users, or join page for guests
    if (isAuthenticated) {
      router.push("/dashboard")
    } else {
      router.push("/join")
    }
  }, [localStream, localAudioStream, socket, userId, meetingId, isAuthenticated, router, peersRef])

  // Send chat message
  const sendMessage = useCallback(
    (content: string) => {
      if (!socket || !userId || !content.trim()) return

      console.log(`[Meeting] Sending message: ${content}`)
      const messageData = {
        meetingId,
        senderId: userId,
        content,
        timestamp: new Date().toISOString(),
        isFromCurrentUser: true // Mark as from current user to prevent duplicates
      }

      socket.emit("message", messageData)

      // Add to local messages with a flag to indicate it's from the current user
      // This helps with styling in the UI
      setMessages((prev) => [...prev, {
        ...messageData,
        isFromCurrentUser: true
      }])
    },
    [socket, userId, meetingId]
  )

  // if not authenticated and theres is no name in the search params return join-meeting-modal
  if (!isAuthenticated && !guestName) {
    return <JoinMeetingModal meetingId={meetingId} isOpen={true} onClose={() => {}} />
  }

  // Show loading state while fetching ICE servers
  if (isLoadingIceServers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Preparing your meeting...</h2>
          <p className="text-muted-foreground">Setting up secure connection</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-background">
      {/* Header */}
      <MeetingHeader
        meetingId={meetingId as string}
        isAudioOnlyMode={isAudioOnlyMode}
        toggleAudioOnlyMode={toggleAudioOnlyMode}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        isLowBandwidthMode={isLowBandwidthMode}
        configureLowBandwidth={configureLowBandwidth}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <VideoGrid
          isSidebarOpen={isSidebarOpen}
          username={username}
          isAudioOnlyMode={isAudioOnlyMode}
          localVideoRef={localVideoRef}
          isLowBandwidthMode={isLowBandwidthMode}
          isHandRaised={isHandRaised}
          peers={peers}
          participants={participants}
          handlePeerReconnect={handlePeerReconnect}
        />

        {/* Sidebar */}
        {isSidebarOpen && (
          <MeetingSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            participants={participants}
            messages={messages}
            onSendMessage={sendMessage}
          />
        )}
      </div>

      {/* Controls */}
      <MeetingControls
        isAudioEnabled={isAudioEnabled}
        toggleAudio={toggleAudio}
        isVideoEnabled={isVideoEnabled}
        toggleVideo={toggleVideo}
        isAudioOnlyMode={isAudioOnlyMode}
        isHandRaised={isHandRaised}
        toggleHandRaise={toggleHandRaise}
        leaveMeeting={leaveMeeting}
      />
    </div>
  )
}
