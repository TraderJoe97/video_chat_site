import type React from "react"
import { cn } from "@/lib/utils"
import { PeerVideo } from "@/components/peer-video"
import type Peer from "simple-peer"
import { Participant } from "@/components/participants-panel"

interface VideoGridProps {
  isSidebarOpen: boolean
  username: string
  isAudioOnlyMode: boolean
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  isLowBandwidthMode: boolean
  isHandRaised: boolean
  peers: { peerId: string; peer: Peer.Instance; username: string }[]
  participants: Participant[]
  handlePeerReconnect: (username: string) => void
}

export function VideoGrid({
  isSidebarOpen,
  username,
  isAudioOnlyMode,
  localVideoRef,
  isLowBandwidthMode,
  isHandRaised,
  peers,
  participants,
  handlePeerReconnect,
}: VideoGridProps) {
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

  return (
    <div className={cn("flex-1 p-4 overflow-y-auto", isSidebarOpen ? "md:w-2/3" : "w-full")}>
      <div className={cn("grid gap-4", getGridLayout())}>
        {/* Local video */}
        <div className="relative group">
          <div className={cn("bg-muted rounded-lg overflow-hidden", getVideoHeight())}>
            {isAudioOnlyMode ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold mb-2">{username.charAt(0).toUpperCase()}</div>
                  <div className="text-sm">You (Audio Only)</div>
                </div>
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            )}
            {isLowBandwidthMode && (
              <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded text-xs">
                Low Quality
              </div>
            )}
          </div>
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            You {isHandRaised && "✋"} {isLowBandwidthMode && "📶"}
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
            onReconnect={() => handlePeerReconnect(peer.username)}
            audioOnly={isAudioOnlyMode}
          />
        ))}
      </div>
    </div>
  )
}

