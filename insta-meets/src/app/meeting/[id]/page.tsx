"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import { toast } from "sonner"
import { JoinMeetingModal } from "@/components/join-meeting-modal"
import { MeetingHeader } from "@/components/meeting/meeting-header"
import { MeetingControls } from "@/components/meeting/meeting-controls"
import { VideoGrid } from "@/components/meeting/video-grid"
import { MeetingSidebar } from "@/components/meeting/meeting-sidebar"
import { useMediasoup } from "@/hooks/use-mediasoup"
import { useSignalR, type SignalRParticipant, type SignalRMessage } from "@/hooks/use-signalr"
import { fetchChatHistory } from "@/lib/meeting-api"

export default function MeetingPage() {
  const { id: meetingId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const guestName = searchParams.get("name")
  const router = useRouter()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth0()

  // Container Ref for Fullscreen
  const containerRef = useRef<HTMLDivElement>(null)

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("chat")
  const [unreadMessages, setUnreadMessages] = useState(0)

  // Identity state
  const [userId, setUserId] = useState<string>("")
  const [username, setUsername] = useState<string>("")
  const [isHandRaised, setIsHandRaised] = useState(false)

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isInitializingMedia, setIsInitializingMedia] = useState(true)

  // Chat and Participants state
  const [messages, setMessages] = useState<SignalRMessage[]>([])
  const [participants, setParticipants] = useState<SignalRParticipant[]>([])

  // 1. Resolve User Identity
  useEffect(() => {
    if (guestName) {
      const storedGuestId = sessionStorage.getItem(`guest_id_${meetingId}`)
      const assignedId = storedGuestId || `guest_${Math.random().toString(36).substring(2, 9)}`
      if (!storedGuestId) sessionStorage.setItem(`guest_id_${meetingId}`, assignedId)
      setUserId(assignedId)
      setUsername(guestName)
    } else if (isAuthenticated && user) {
      setUserId(user.sub || `auth0_${Math.random().toString(36).substring(2, 9)}`)
      setUsername(user.name || user.nickname || "Registered User")
    }
  }, [guestName, isAuthenticated, user, meetingId])

  // 2. Initialize Local Camera & Microphone Media Stream
  useEffect(() => {
    let activeStream: MediaStream | null = null

    const initMedia = async () => {
      try {
        console.log("[MeetingPage] Requesting camera and microphone access...")
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        })

        activeStream = stream
        setLocalStream(stream)
        setIsInitializingMedia(false)
        console.log("[MeetingPage] Local media stream successfully initialized")
      } catch (err: any) {
        console.error("[MeetingPage] Media access error:", err)
        toast.error("Could not access camera or microphone. Please check browser permissions.")
        setIsInitializingMedia(false)
      }
    }

    if (userId && !localStream) {
      initMedia()
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [userId])

  // 3. Mediasoup SFU Client Hook
  const { isSfuConnected, remoteStreams, setAudioMuted, setVideoMuted } = useMediasoup({
    meetingId,
    userId,
    username,
    localStream,
  })

  // 4. SignalR Real-Time Presence & Chat Hook (.NET Backend)
  const handleUserJoined = useCallback((participant: SignalRParticipant) => {
    setParticipants((prev) => {
      if (prev.some((p) => p.userId === participant.userId)) return prev
      return [...prev, participant]
    })
    toast.info(`${participant.username} joined the meeting`)
  }, [])

  const handleUserLeft = useCallback((leftUserId: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== leftUserId))
  }, [])

  const handleReceiveMessage = useCallback((message: SignalRMessage) => {
    setMessages((prev) => [...prev, message])
    if (!isSidebarOpen) {
      setUnreadMessages((count) => count + 1)
    }
  }, [isSidebarOpen])

  const handleHandRaised = useCallback((raisedUserId: string, raised: boolean) => {
    setParticipants((prev) =>
      prev.map((p) => (p.userId === raisedUserId ? { ...p, isHandRaised: raised } : p)),
    )
  }, [])

  const handleMediaStatusChanged = useCallback(
    (changedUserId: string, audioEnabled: boolean, videoEnabled: boolean) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === changedUserId
            ? { ...p, isAudioEnabled: audioEnabled, isVideoEnabled: videoEnabled }
            : p,
        ),
      )
    },
    [],
  )

  const { isConnected: isSignalRConnected, sendMessage, raiseHand, toggleMediaStatus } = useSignalR({
    meetingId,
    userId,
    username,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onReceiveMessage: handleReceiveMessage,
    onHandRaised: handleHandRaised,
    onMediaStatusChanged: handleMediaStatusChanged,
  })

  // Load chat history from Supabase / .NET API on initial join
  useEffect(() => {
    if (meetingId) {
      fetchChatHistory(meetingId).then((history) => {
        if (history && history.length > 0) {
          setMessages(
            history.map((m) => ({
              id: m.id,
              senderId: m.senderId,
              senderName: m.senderName,
              content: m.content,
              timestamp: m.timestamp,
              isFromCurrentUser: m.senderId === userId,
            })),
          )
        }
      })
    }
  }, [meetingId, userId])

  // 5. Media Control Handlers
  const toggleAudio = () => {
    if (!localStream) return
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      const nextState = !audioTrack.enabled
      audioTrack.enabled = nextState
      setIsAudioEnabled(nextState)
      setAudioMuted(!nextState)
      toggleMediaStatus(nextState, isVideoEnabled)
      toast.info(nextState ? "Microphone unmuted" : "Microphone muted")
    }
  }

  const toggleVideo = () => {
    if (!localStream) return
    const videoTrack = localStream.getVideoTracks()[0]
    if (videoTrack) {
      const nextState = !videoTrack.enabled
      videoTrack.enabled = nextState
      setIsVideoEnabled(nextState)
      setVideoMuted(!nextState)
      toggleMediaStatus(isAudioEnabled, nextState)
      toast.info(nextState ? "Camera enabled" : "Camera disabled")
    }
  }

  const toggleHandRaise = () => {
    const nextState = !isHandRaised
    setIsHandRaised(nextState)
    raiseHand(nextState)
    toast.info(nextState ? "Hand raised ✋" : "Hand lowered")
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera stream
      setIsScreenSharing(false)
      toast.info("Screen sharing ended")
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        setIsScreenSharing(true)
        toast.success("Screen sharing started")

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false)
        }
      } catch {
        // User cancelled picker
      }
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const toggleSidebar = (tab: string) => {
    if (isSidebarOpen && activeTab === tab) {
      setIsSidebarOpen(false)
    } else {
      setIsSidebarOpen(true)
      setActiveTab(tab)
      if (tab === "chat") {
        setUnreadMessages(0)
      }
    }
  }

  const handleSendMessage = (content: string) => {
    sendMessage(content)
  }

  const leaveMeeting = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    router.push("/dashboard")
  }

  // 6. Loading and Authentication Guards
  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Connecting to InstaMeets...</h2>
        <p className="text-sm text-slate-400 mt-1">Authenticating session</p>
      </div>
    )
  }

  if (!isAuthenticated && !guestName) {
    return <JoinMeetingModal meetingId={meetingId} isOpen={true} onClose={() => {}} />
  }

  if (isInitializingMedia) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Preparing your camera & mic...</h2>
        <p className="text-sm text-slate-400 mt-1">Connecting to Mediasoup SFU</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden select-none">
      {/* 1. Header */}
      <MeetingHeader
        meetingId={meetingId}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isSfuConnected={isSfuConnected}
        isSignalRConnected={isSignalRConnected}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Video Grid */}
        <VideoGrid
          isSidebarOpen={isSidebarOpen}
          username={username}
          localStream={localStream}
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isHandRaised={isHandRaised}
          remoteStreams={remoteStreams}
          participants={participants}
        />

        {/* Slide-out Sidebar */}
        {isSidebarOpen && (
          <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl z-30 flex flex-col transition-all duration-300">
            <MeetingSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              participants={participants.map((p) => ({ id: p.userId, name: p.username, hasHandRaised: p.isHandRaised }))}
              messages={messages.map((m) => ({ senderId: m.senderId, content: m.content, timestamp: m.timestamp }))}
              onSendMessage={handleSendMessage}
            />
          </aside>
        )}
      </div>

      {/* 3. Floating Bottom Controls */}
      <MeetingControls
        isAudioEnabled={isAudioEnabled}
        toggleAudio={toggleAudio}
        isVideoEnabled={isVideoEnabled}
        toggleVideo={toggleVideo}
        isHandRaised={isHandRaised}
        toggleHandRaise={toggleHandRaise}
        isScreenSharing={isScreenSharing}
        toggleScreenShare={toggleScreenShare}
        isSidebarOpen={isSidebarOpen}
        activeTab={activeTab}
        toggleSidebar={toggleSidebar}
        unreadMessageCount={unreadMessages}
        participantCount={participants.length + 1}
        leaveMeeting={leaveMeeting}
      />
    </div>
  )
}
