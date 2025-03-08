

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
  const remoteStreamsRef = useRef<MediaStream[]>([])
  const [connectionState, setConnectionState] = useState<string>("new")
  const [hasStream, setHasStream] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle stream from peer
  useEffect(() => {
    const handleStream = (stream: MediaStream) => {
      console.log(`Received stream from peer: ${username}`)
      remoteStreamsRef.current.push(stream)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasStream(true)

        // Check if video tracks are enabled
        const videoTracks = stream.getVideoTracks()
        setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled)

        // Listen for track mute/unmute events
        videoTracks.forEach((track) => {
          track.onmute = () => setVideoEnabled(false)
          track.onunmute = () => setVideoEnabled(true)
        })
      }

      // Connection succeeded if we got a stream
      setConnectionState("connected")
    }

    // Handle peer errors
    const handleError = (err: Error) => {
      console.error(`Peer connection error with ${username}:`, err.message)
      setConnectionState("failed")

      // Auto-reconnect attempt after error
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (onReconnect) {
            setIsReconnecting(true)
            onReconnect()
          }
          reconnectTimeoutRef.current = null
        }, 5000) // Wait 5 seconds before reconnecting
      }
    }

    // Handle peer close
    const handleClose = () => {
      console.log(`Peer connection with ${username} closed`)
      setConnectionState("closed")
    }

    // Set up event listeners
    peer.on("stream", handleStream)
    peer.on("error", handleError)
    peer.on("close", handleClose)

    // Check if we already have streams stored for this peer
    if (remoteStreamsRef.current.length > 0) {
      const stream = remoteStreamsRef.current[0]
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasStream(true)
      }
    }

    // Set initial connection state
    setConnectionState(peer.connected ? "connected" : "connecting")

    // Clean up
    return () => {
      peer.off("stream", handleStream)
      peer.off("error", handleError)
      peer.off("close", handleClose)

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [peer, username, onReconnect])

  // Handle manual reconnection
  const handleReconnect = () => {
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          // Lower quality for slow connections
          {...(connectionState === "slow" && {
            style: { filter: "blur(2px)" },
          })}
        />
        {renderConnectionState()}
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {username} {hasHandRaised && "✋"}
        {connectionState === "slow" && " (Slow connection)"}
      </div>
    </div>
  )
}

