"use client"

import { useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Mic } from "lucide-react"

interface VideoGridProps {
  localStream: MediaStream | null
  streams: { [key: string]: MediaStream }
  participantNames: { [key: string]: string }
  audioEnabled: boolean
  videoEnabled: boolean
  audioOnlyMode: boolean
  isConnecting: boolean
  currentUserId: string
}

export function VideoGrid({
  localStream,
  streams,
  participantNames,
  audioEnabled,
  videoEnabled,
  audioOnlyMode,
  isConnecting,
  currentUserId,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
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
              {currentUserId.charAt(0).toUpperCase()}
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
  )
}

