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

  // Make socket available globally for peer connections
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

