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
import { Whiteboard, type WhiteboardElement } from "@/components/meeting/whiteboard"
import { MediasoupVideoTile } from "@/components/meeting/mediasoup-video-tile"
import { useWebRTCStream } from "@/hooks/use-webrtc-stream"
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
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false)

  // Whiteboard Real-Time State
  const [incomingStroke, setIncomingStroke] = useState<WhiteboardElement | null>(null)
  const [incomingWhiteboardHistory, setIncomingWhiteboardHistory] = useState<WhiteboardElement[] | null>(null)
  const [isBoardCleared, setIsBoardCleared] = useState(false)

  // Identity state
  const [userId, setUserId] = useState<string>("")
  const [username, setUsername] = useState<string>("")
  const [isHandRaised, setIsHandRaised] = useState(false)

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isInitializingMedia, setIsInitializingMedia] = useState(false)

  // Media stream references
  const screenStreamRef = useRef<MediaStream | null>(null)

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
      setIsInitializingMedia(true)
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
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [userId])

  // 3. WebRTC Stream Engine Hook (Concurrent Camera + Dedicated Screen Share)
  const {
    remoteStreams,
    remoteScreenStreams,
    initiateCall,
    handleReceiveSignal,
    handlePeerLeft,
    addScreenTrack,
    removeScreenTrack,
  } = useWebRTCStream({
    meetingId,
    userId,
    username,
    localStream,
    isConnected: true,
    sendSignal: async (targetUserId, signalData) => {
      await sendSignal(targetUserId, signalData)
    },
  })

  // 4. SignalR Real-Time Presence & Chat Hook (.NET Backend)
  const handleUserJoined = useCallback(
    (participant: SignalRParticipant) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === participant.userId)) return prev
        return [...prev, participant]
      })
      toast.info(`${participant.username} joined the meeting`)
      initiateCall(participant.userId, participant.username)
    },
    [initiateCall],
  )

  const handleUserLeft = useCallback(
    (leftUserId: string) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== leftUserId))
      handlePeerLeft(leftUserId)
    },
    [handlePeerLeft],
  )

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

  const handleScreenShareChanged = useCallback(
    (sharerUserId: string | null, isSharing: boolean) => {
      if (isSharing && sharerUserId && sharerUserId !== userId) {
        const sharer = participants.find((p) => p.userId === sharerUserId)
        toast.info(`${sharer?.username || "A participant"} started sharing their screen`)
      } else if (!isSharing && !isScreenSharing) {
        toast.info("Screen sharing ended")
      }
    },
    [participants, userId, isScreenSharing],
  )

  // Whiteboard SignalR Handlers
  const handleReceiveWhiteboardStroke = useCallback((strokeData: any) => {
    setIncomingStroke(strokeData)
  }, [])

  const handleWhiteboardCleared = useCallback(() => {
    setIsBoardCleared(true)
    setTimeout(() => setIsBoardCleared(false), 200)
    toast.info("Whiteboard was cleared by a participant")
  }, [])

  const handleWhiteboardToggled = useCallback((isOpen: boolean) => {
    setIsWhiteboardOpen(isOpen)
    toast.info(isOpen ? "Whiteboard mode opened" : "Whiteboard mode closed")
  }, [])

  const handleReceiveWhiteboardHistory = useCallback((history: any[]) => {
    setIncomingWhiteboardHistory(history)
  }, [])

  const {
    isConnected: isSignalRConnected,
    activeScreenSharerId,
    startScreenShare,
    stopScreenShare,
    sendWhiteboardStroke,
    clearWhiteboard,
    toggleWhiteboardMode: signalRToggleWhiteboard,
    requestWhiteboardHistory,
    sendMessage,
    sendSignal,
    raiseHand,
    toggleMediaStatus,
  } = useSignalR({
    meetingId,
    userId,
    username,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onReceiveMessage: handleReceiveMessage,
    onHandRaised: handleHandRaised,
    onMediaStatusChanged: handleMediaStatusChanged,
    onScreenShareChanged: handleScreenShareChanged,
    onReceiveSignal: handleReceiveSignal,
    onReceiveWhiteboardStroke: handleReceiveWhiteboardStroke,
    onWhiteboardCleared: handleWhiteboardCleared,
    onWhiteboardToggled: handleWhiteboardToggled,
    onReceiveWhiteboardHistory: handleReceiveWhiteboardHistory,
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

  const stopLocalScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
    }

    await removeScreenTrack()
    setIsScreenSharing(false)
    await stopScreenShare()
    toast.info("Screen sharing ended")
  }, [removeScreenTrack, stopScreenShare])

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopLocalScreenShare()
    } else {
      if (activeScreenSharerId && activeScreenSharerId !== userId) {
        toast.error("Another participant is already sharing their screen. Only one person may share at a time.")
        return
      }

      const res = await startScreenShare()
      if (!res.success) {
        toast.error(res.currentSharerName ? `${res.currentSharerName} is already sharing their screen.` : "Screen sharing is currently unavailable.")
        return
      }

      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: false,
        })

        screenStreamRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]

        screenTrack.onended = () => {
          stopLocalScreenShare()
        }

        await addScreenTrack(screenTrack, screenStream)
        setIsScreenSharing(true)
        toast.success("Screen sharing started")
      } catch (err: any) {
        await stopScreenShare()
        if (err.name !== "NotAllowedError") {
          console.error("Screen share error:", err)
        }
      }
    }
  }

  const toggleWhiteboard = () => {
    const nextState = !isWhiteboardOpen
    setIsWhiteboardOpen(nextState)
    signalRToggleWhiteboard(nextState)
    if (nextState) {
      requestWhiteboardHistory()
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
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    router.push("/dashboard")
  }

  // 6. Loading and Authentication Guards
  if (isAuthLoading && !guestName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4" />
        <h2 className="text-xl font-semibold">Connecting to InstaMeets...</h2>
      </div>
    )
  }

  if (!isAuthenticated && !guestName) {
    return <JoinMeetingModal meetingId={meetingId} isOpen={true} onClose={() => {}} />
  }

  if (isInitializingMedia && !localStream) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4" />
        <h2 className="text-xl font-semibold">Preparing your camera & mic...</h2>
        <p className="text-sm text-muted-foreground mt-1">Almost ready</p>
      </div>
    )
  }

  const isOtherSharing = !!activeScreenSharerId && activeScreenSharerId !== userId
  const otherSharerName = participants.find((p) => p.userId === activeScreenSharerId)?.username
  const remoteList = Array.from(remoteStreams.values())

  // Compute active screen share stream (Spotlight Mode)
  let activeScreenStream: MediaStream | null = null
  let activeScreenSharerName: string | undefined = undefined

  if (isScreenSharing && screenStreamRef.current) {
    activeScreenStream = screenStreamRef.current
    activeScreenSharerName = `${username} (You)`
  } else if (activeScreenSharerId && activeScreenSharerId !== userId) {
    const remoteScreen = remoteScreenStreams.get(activeScreenSharerId)
    const remoteCam = remoteStreams.get(activeScreenSharerId)
    activeScreenStream = remoteScreen || (remoteCam?.stream || null)
    activeScreenSharerName = otherSharerName || "Participant"
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-background text-foreground overflow-hidden select-none">
      {/* 1. Header */}
      <MeetingHeader
        meetingId={meetingId}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isSfuConnected={isSignalRConnected}
        isSignalRConnected={isSignalRConnected}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden bg-muted/20">
        {/* Main Stage: Whiteboard OR Video Grid (with Spotlight Presentation) */}
        {isWhiteboardOpen ? (
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <div className="flex-1 relative">
              <Whiteboard
                currentUserId={userId}
                currentUsername={username}
                onSendStroke={(stroke) => sendWhiteboardStroke(stroke)}
                onClearBoard={() => clearWhiteboard()}
                onClose={() => toggleWhiteboard()}
                incomingStroke={incomingStroke}
                incomingHistory={incomingWhiteboardHistory}
                isBoardCleared={isBoardCleared}
              />
            </div>

            {/* Bottom Floating Video Filmstrip */}
            <div className="h-28 sm:h-32 bg-background/80 backdrop-blur-md border-t border-border flex items-center gap-3 px-4 overflow-x-auto z-10 flex-shrink-0">
              <div className="w-40 sm:w-44 h-full py-2 flex-shrink-0">
                <MediasoupVideoTile
                  stream={localStream}
                  username={username}
                  isLocal={true}
                  isAudioEnabled={isAudioEnabled}
                  isVideoEnabled={isVideoEnabled}
                  isHandRaised={isHandRaised}
                  className="h-full w-full rounded-xl"
                />
              </div>

              {remoteList.map((remote) => {
                const participantInfo = participants.find((p) => p.userId === remote.userId)
                return (
                  <div key={remote.userId} className="w-40 sm:w-44 h-full py-2 flex-shrink-0">
                    <MediasoupVideoTile
                      stream={remote.stream}
                      username={remote.username || participantInfo?.username || remote.userId}
                      isLocal={false}
                      isAudioEnabled={remote.isAudioEnabled}
                      isVideoEnabled={remote.isVideoEnabled}
                      isHandRaised={participantInfo?.isHandRaised}
                      className="h-full w-full rounded-xl"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <VideoGrid
            isSidebarOpen={isSidebarOpen}
            username={username}
            localStream={localStream}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            isHandRaised={isHandRaised}
            remoteStreams={remoteStreams}
            participants={participants}
            activeScreenStream={activeScreenStream}
            activeScreenSharerId={activeScreenSharerId}
            activeScreenSharerName={activeScreenSharerName}
            currentUserId={userId}
          />
        )}

        {/* Slide-out Sidebar */}
        {isSidebarOpen && (
          <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-96 z-30 flex flex-col transition-all duration-300">
            <MeetingSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              participants={participants.map((p) => ({ id: p.userId, name: p.username, hasHandRaised: p.isHandRaised }))}
              messages={messages.map((m) => ({
                senderId: m.senderId,
                senderName: m.senderName,
                content: m.content,
                timestamp: m.timestamp,
                isFromCurrentUser: m.senderId === userId || m.isFromCurrentUser,
              }))}
              currentUserId={userId}
              currentUsername={username}
              onSendMessage={handleSendMessage}
            />
          </aside>
        )}
      </div>

      {/* 3. Floating Controls */}
      <MeetingControls
        isAudioEnabled={isAudioEnabled}
        toggleAudio={toggleAudio}
        isVideoEnabled={isVideoEnabled}
        toggleVideo={toggleVideo}
        isHandRaised={isHandRaised}
        toggleHandRaise={toggleHandRaise}
        isScreenSharing={isScreenSharing}
        toggleScreenShare={toggleScreenShare}
        isScreenShareDisabled={isOtherSharing}
        screenShareDisabledReason={isOtherSharing ? `${otherSharerName || "Another participant"} is currently sharing their screen` : undefined}
        isWhiteboardOpen={isWhiteboardOpen}
        toggleWhiteboard={toggleWhiteboard}
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
