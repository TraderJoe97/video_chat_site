"use client"

import { useRef, useEffect, useState } from "react"
import type Peer from "simple-peer"
import { cn } from "@/lib/utils"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PeerVideoProps {
  peer: Peer.Instance
  username: string
  hasHandRaised?: boolean
  className?: string
  onReconnect?: () => void
}

export const PeerVideo = ({ peer, username, hasHandRaised, className, onReconnect }: PeerVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [connectionState, setConnectionState] = useState<string>("new")
  const [hasStream, setHasStream] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)

  // Debug logging
  useEffect(() => {
    console.log(`[PeerVideo] Initializing for peer: ${username}`)
    console.log(`[PeerVideo] Initial connection state: ${peer.connected ? "connected" : "disconnected"}`)

    return () => {
      console.log(`[PeerVideo] Cleaning up for peer: ${username}`)
    }
  }, [username, peer])

  // Handle stream from peer
  useEffect(() => {
    console.log(`[PeerVideo] Setting up event listeners for peer: ${username}`)

    const handleStream = (stream: MediaStream) => {
      console.log(`[PeerVideo] Received stream from peer: ${username}`)
      console.log(
        `[PeerVideo] Stream has ${stream.getVideoTracks().length} video tracks and ${stream.getAudioTracks().length} audio tracks`,
      )

      if (videoRef.current) {
        console.log(`[PeerVideo] Setting stream to video element for: ${username}`)
        videoRef.current.srcObject = stream
        setHasStream(true)

        // Check if video tracks are enabled
        const videoTracks = stream.getVideoTracks()
        setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled)
        console.log(`[PeerVideo] Video enabled: ${videoTracks.length > 0 && videoTracks[0].enabled}`)
      } else {
        console.error(`[PeerVideo] Video ref is null for: ${username}`)
      }

      setConnectionState("connected")
    }

    // Handle peer errors
    const handleError = (err: Error) => {
      console.error(`[PeerVideo] Peer connection error with ${username}:`, err.message)
      setConnectionState("failed")

      if (onReconnect) {
        console.log(`[PeerVideo] Attempting to reconnect with: ${username}`)
        setIsReconnecting(true)
        onReconnect()
      }
    }

    // Handle peer close
    const handleClose = () => {
      console.log(`[PeerVideo] Peer connection with ${username} closed`)
      setConnectionState("closed")
    }

    // Set up event listeners
    peer.on("stream", handleStream)
    peer.on("error", handleError)
    peer.on("close", handleClose)

    // Set initial connection state
    setConnectionState(peer.connected ? "connected" : "connecting")

    // Clean up
    return () => {
      console.log(`[PeerVideo] Removing event listeners for peer: ${username}`)
      peer.off("stream", handleStream)
      peer.off("error", handleError)
      peer.off("close", handleClose)
    }
  }, [peer, username, onReconnect])

  // Handle manual reconnection
  const handleReconnect = () => {
    console.log(`[PeerVideo] Manual reconnection requested for: ${username}`)
    if (onReconnect) {
      setIsReconnecting(true)
      onReconnect()
    }
  }

  // Determine what to display based on connection state
  const renderConnectionState = () => {
    if (isReconnecting) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
          <RefreshCw className="h-8 w-8 animate-spin mb-2" />
          <span>Reconnecting...</span>
        </div>
      )
    }

    if (connectionState === "failed") {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
          <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
          <span className="mb-2">Connection failed</span>
          <Button variant="outline" size="sm" onClick={handleReconnect} className="bg-white/20 hover:bg-white/30">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconnect
          </Button>
        </div>
      )
    }

    if (!hasStream) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground">Connecting...</span>
        </div>
      )
    }

    if (!videoEnabled) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
          <span>Video paused</span>
        </div>
      )
    }

    return null
  }

  return (
    <div className="relative group">
      <div className={cn("bg-muted rounded-lg overflow-hidden", className)}>
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {renderConnectionState()}
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {username} {hasHandRaised && "✋"}
      </div>
    </div>
  )
}

