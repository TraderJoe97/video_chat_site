"use client"

import { useRef, useEffect, useState } from "react"
import type Peer from "simple-peer"
import { cn } from "@/lib/utils"
import { AlertCircle, RefreshCw, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PeerVideoProps {
  peer: Peer.Instance
  username: string
  hasHandRaised?: boolean
  className?: string
  onReconnect?: () => void
  audioOnly?: boolean
}

export const PeerVideo = ({
  peer,
  username,
  hasHandRaised,
  className,
  onReconnect,
  audioOnly = false,
}: PeerVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [connectionState, setConnectionState] = useState<string>("new")
  const [hasStream, setHasStream] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  // We use this state in the UI to show audio status
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const maxReconnectAttempts = 3

  // Debug logging
  useEffect(() => {
    console.log(`[PeerVideo] Initializing for peer: ${username}`)
    console.log(`[PeerVideo] Initial connection state: ${peer.connected ? "connected" : "disconnected"}`)
    console.log(`[PeerVideo] Audio only mode: ${audioOnly}`)

    return () => {
      console.log(`[PeerVideo] Cleaning up for peer: ${username}`)
    }
  }, [username, peer, audioOnly])

  // Handle stream from peer
  useEffect(() => {
    console.log(`[PeerVideo] Setting up event listeners for peer: ${username}`)

    const handleStream = (stream: MediaStream) => {
      console.log(`[PeerVideo] Received stream from peer: ${username}`)
      console.log(
        `[PeerVideo] Stream has ${stream.getVideoTracks().length} video tracks and ${stream.getAudioTracks().length} audio tracks`,
      )

      // Split the stream into audio and video if needed
      if (audioOnly) {
        // Audio only mode - extract audio track and create a new stream
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length > 0 && audioRef.current) {
          const audioStream = new MediaStream([audioTracks[0]])
          audioRef.current.srcObject = audioStream
          audioRef.current.play().catch((err) => {
            console.error(`[PeerVideo] Error playing audio: ${err.message}`)
          })
          setHasStream(true)
          setAudioEnabled(audioTracks[0].enabled)
        }
      } else {
        // Normal mode - use the full stream for video element
        if (videoRef.current) {
          console.log(`[PeerVideo] Setting stream to video element for: ${username}`)
          videoRef.current.srcObject = stream

          // Configure video buffering
          videoRef.current.playsInline = true
          videoRef.current.autoplay = true

          // Add buffer by increasing latency
          // A higher value (e.g., 1-2 seconds) provides more stability but increases delay
          videoRef.current.oncanplay = () => {
            if (videoRef.current) {
              try {
                // Delay playback slightly to build buffer
                setTimeout(() => {
                  videoRef.current?.play().catch((err) => {
                    console.error(`[PeerVideo] Error playing video: ${err.message}`)
                  })
                }, 500)
              } catch (err) {
                console.error(`[PeerVideo] Error in buffered playback: ${err}`)
              }
            }
          }

          setHasStream(true)

          // Check if video tracks are enabled
          const videoTracks = stream.getVideoTracks()
          setVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled)
          console.log(`[PeerVideo] Video enabled: ${videoTracks.length > 0 && videoTracks[0].enabled}`)

          // Check if audio tracks are enabled
          const audioTracks = stream.getAudioTracks()
          setAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled)
        } else {
          console.error(`[PeerVideo] Video ref is null for: ${username}`)
        }
      }

      setConnectionState("connected")
      setConnectionAttempts(0) // Reset connection attempts on successful connection
    }

    // Handle peer errors
    const handleError = (err: Error) => {
      console.error(`[PeerVideo] Peer connection error with ${username}:`, err.message)
      setConnectionState("failed")

      if (connectionAttempts < maxReconnectAttempts && onReconnect) {
        console.log(
          `[PeerVideo] Attempting to reconnect with: ${username} (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`,
        )
        setIsReconnecting(true)
        setConnectionAttempts((prev) => prev + 1)

        // Add a delay before reconnecting to avoid rapid reconnection attempts
        setTimeout(() => {
          onReconnect()
        }, 2000)
      } else if (connectionAttempts >= maxReconnectAttempts) {
        console.log(`[PeerVideo] Max reconnection attempts reached for: ${username}`)
      }
    }

    // Handle peer close
    const handleClose = () => {
      console.log(`[PeerVideo] Peer connection with ${username} closed`)
      setConnectionState("closed")
    }

    // Handle connection state changes
    const handleConnect = () => {
      console.log(`[PeerVideo] Peer connection established with ${username}`)
      setConnectionState("connected")
      setIsReconnecting(false)
    }

    // Set up event listeners
    peer.on("stream", handleStream)
    peer.on("error", handleError)
    peer.on("close", handleClose)
    peer.on("connect", handleConnect)

    // Set initial connection state
    setConnectionState(peer.connected ? "connected" : "connecting")

    // Clean up
    return () => {
      console.log(`[PeerVideo] Removing event listeners for peer: ${username}`)
      peer.off("stream", handleStream)
      peer.off("error", handleError)
      peer.off("close", handleClose)
      peer.off("connect", handleConnect)
    }
  }, [peer, username, onReconnect, connectionAttempts, maxReconnectAttempts, audioOnly])

  // Handle manual reconnection
  const handleReconnect = () => {
    console.log(`[PeerVideo] Manual reconnection requested for: ${username}`)
    if (onReconnect) {
      setIsReconnecting(true)
      setConnectionAttempts((prev) => prev + 1)
      onReconnect()
    }
  }

  // Toggle audio mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
    } else if (videoRef.current) {
      videoRef.current.muted = !isMuted
    }
  }

  // Determine what to display based on connection state
  const renderConnectionState = () => {
    if (isReconnecting) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
          <RefreshCw className="h-8 w-8 animate-spin mb-2" />
          <span>
            Reconnecting... ({connectionAttempts}/{maxReconnectAttempts})
          </span>
        </div>
      )
    }

    if (connectionState === "failed") {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
          <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
          <span className="mb-2">Connection failed</span>
          {connectionAttempts < maxReconnectAttempts && (
            <Button variant="outline" size="sm" onClick={handleReconnect} className="bg-white/20 hover:bg-white/30">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconnect
            </Button>
          )}
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

    if (audioOnly) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
          <div className="flex flex-col items-center">
            <div className="text-4xl font-bold mb-2">{username.charAt(0).toUpperCase()}</div>
            <div className="text-sm">Audio Only</div>
          </div>
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
        {audioOnly ? (
          <audio ref={audioRef} autoPlay playsInline className="hidden" />
        ) : (
          <video ref={videoRef} muted={!audioEnabled} playsInline className="w-full h-full object-cover" />
        )}
        {renderConnectionState()}
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {username} {hasHandRaised && "✋"}
      </div>
      <div className="absolute bottom-2 right-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="bg-black/50 text-white hover:bg-black/70 h-8 w-8 rounded-full"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
