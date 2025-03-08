"use client"

import { useRef, useEffect } from "react"
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

  useEffect(() => {
    // Set up stream listener directly on the peer
    peer.on("stream", (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    })

    // Clean up
    return () => {
      peer.off("stream", (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
    }
  }, [peer])

  return (
    <div className="relative group">
      <div className={cn("bg-muted rounded-lg overflow-hidden", className)}>
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {username} {hasHandRaised && "✋"}
      </div>
    </div>
  )
}

