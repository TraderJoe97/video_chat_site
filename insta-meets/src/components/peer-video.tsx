"use client"

import { useRef, useEffect, useState } from "react"
import type Peer from "simple-peer"
import { cn } from "@/lib/utils"

interface PeerVideoProps {
  peer: Peer.Instance
  username: string
  hasHandRaised?: boolean
  className?: string
}

export const PeerVideo = ({ peer, username, hasHandRaised, className }: PeerVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasStream, setHasStream] = useState(false)
  const remoteStreamsRef = useRef<MediaStream[]>([])

  useEffect(() => {
    // Set up stream listener directly on the peer
    const handleStream = (stream: MediaStream) => {
      console.log(`Received stream from peer: ${username}`)
      remoteStreamsRef.current.push(stream)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasStream(true)
      }
    }

    peer.on("stream", handleStream)

    // Check if we already have streams stored for this peer
    if (remoteStreamsRef.current.length > 0) {
      const stream = remoteStreamsRef.current[0]
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasStream(true)
      }
    }

    // Clean up
    return () => {
      peer.off("stream", handleStream)
    }
  }, [peer, username])

  return (
    <div className="relative group">
      <div className={cn("bg-muted rounded-lg overflow-hidden", className)}>
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {!hasStream && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground">Connecting...</span>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {username} {hasHandRaised && "✋"}
      </div>
    </div>
  )
}

