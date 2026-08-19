"use client"

import { cn } from "@/lib/utils"
import { MediasoupVideoTile } from "./mediasoup-video-tile"
import type { RemoteParticipantStream } from "@/hooks/use-mediasoup"
import type { SignalRParticipant } from "@/hooks/use-signalr"

interface VideoGridProps {
  isSidebarOpen: boolean
  username: string
  localStream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isHandRaised: boolean
  remoteStreams: Map<string, RemoteParticipantStream>
  participants: SignalRParticipant[]
}

export function VideoGrid({
  isSidebarOpen,
  username,
  localStream,
  isAudioEnabled,
  isVideoEnabled,
  isHandRaised,
  remoteStreams,
  participants,
}: VideoGridProps) {
  const remoteList = Array.from(remoteStreams.values())
  const totalCount = remoteList.length + 1 // +1 for local

  // Grid layout class based on participant count
  const getGridClasses = () => {
    if (totalCount === 1) return "grid-cols-1 max-w-4xl mx-auto h-full"
    if (totalCount === 2) return "grid-cols-1 md:grid-cols-2 h-full max-h-[calc(100vh-9rem)]"
    if (totalCount <= 4) return "grid-cols-1 sm:grid-cols-2 h-full max-h-[calc(100vh-9rem)]"
    if (totalCount <= 6) return "grid-cols-2 sm:grid-cols-3"
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
  }

  const getTileHeight = () => {
    if (totalCount === 1) return "h-[calc(100vh-10rem)] max-h-[720px]"
    if (totalCount === 2) return "h-[calc(50vh-5rem)] md:h-[calc(100vh-10rem)] max-h-[640px]"
    if (totalCount <= 4) return "h-[calc(50vh-5.5rem)] max-h-[380px]"
    return "h-48 sm:h-56 md:h-64"
  }

  return (
    <div
      className={cn(
        "flex-1 p-3 md:p-6 overflow-y-auto transition-all duration-300 flex flex-col justify-center",
        isSidebarOpen ? "lg:mr-96" : "",
      )}
    >
      <div className={cn("grid gap-3 md:gap-4 w-full place-items-stretch", getGridClasses())}>
        {/* Local Participant Tile */}
        <MediasoupVideoTile
          stream={localStream}
          username={username}
          isLocal={true}
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isHandRaised={isHandRaised}
          className={getTileHeight()}
        />

        {/* Remote Participant Tiles */}
        {remoteList.map((remote) => {
          const participantInfo = participants.find((p) => p.userId === remote.userId)
          return (
            <MediasoupVideoTile
              key={remote.userId}
              stream={remote.stream}
              username={remote.username || participantInfo?.username || remote.userId}
              isLocal={false}
              isAudioEnabled={remote.isAudioEnabled}
              isVideoEnabled={remote.isVideoEnabled}
              isHandRaised={participantInfo?.isHandRaised}
              className={getTileHeight()}
            />
          )
        })}
      </div>
    </div>
  )
}
