"use client"

import { cn } from "@/lib/utils"
import { MediasoupVideoTile } from "./mediasoup-video-tile"
import { Share2 } from "lucide-react"
import type { RemoteParticipantStream } from "@/hooks/use-webrtc-stream"
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
  activeScreenStream?: MediaStream | null
  activeScreenSharerId?: string | null
  activeScreenSharerName?: string
  currentUserId?: string
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
  activeScreenStream,
  activeScreenSharerId,
  activeScreenSharerName,
  currentUserId,
}: VideoGridProps) {
  const remoteList = Array.from(remoteStreams.values())
  const totalCount = remoteList.length + 1 // +1 for local

  // If Screen Sharing is active, show the Spotlight Presentation layout!
  if (activeScreenStream) {
    return (
      <div
        className={cn(
          "flex-1 p-3 md:p-4 overflow-hidden transition-all duration-300 flex flex-col lg:flex-row gap-3 md:gap-4",
          isSidebarOpen ? "lg:mr-96" : "",
        )}
      >
        {/* 1. Large Spotlight Presentation Stage */}
        <div className="flex-1 min-w-0 h-full relative rounded-2xl overflow-hidden bg-slate-950 border border-border shadow-2xl flex flex-col">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/80 backdrop-blur-md border border-border text-xs font-semibold text-foreground shadow-md">
            <Share2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{activeScreenSharerName || "Screen Share"}</span>
          </div>

          <div className="w-full h-full flex items-center justify-center p-2 bg-black/90">
            <MediasoupVideoTile
              stream={activeScreenStream}
              username={activeScreenSharerName || "Screen Share"}
              isLocal={activeScreenSharerId === currentUserId}
              isAudioEnabled={true}
              isVideoEnabled={true}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
        </div>

        {/* 2. Right-side Participant Camera Strip */}
        <div className="w-full lg:w-72 xl:w-80 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-48 lg:max-h-full flex-shrink-0">
          {/* Local User Camera Tile */}
          <div className="w-48 lg:w-full h-36 sm:h-44 flex-shrink-0">
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

          {/* Remote Participants Camera Tiles (Including Sharer's Camera Face!) */}
          {remoteList.map((remote) => {
            const participantInfo = participants.find((p) => p.userId === remote.userId)
            return (
              <div key={remote.userId} className="w-48 lg:w-full h-36 sm:h-44 flex-shrink-0">
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
    )
  }

  // Default Grid layout based on participant count
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
