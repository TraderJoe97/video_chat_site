"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Mic, MicOff, Video, VideoOff, Wifi } from "lucide-react"

interface MediasoupVideoTileProps {
  stream?: MediaStream | null
  username: string
  isLocal?: boolean
  isAudioEnabled?: boolean
  isVideoEnabled?: boolean
  isHandRaised?: boolean
  isSpeaking?: boolean
  className?: string
  connectionQuality?: "good" | "fair" | "poor"
}

export function MediasoupVideoTile({
  stream,
  username,
  isLocal = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  isHandRaised = false,
  isSpeaking = false,
  className,
  connectionQuality = "good",
}: MediasoupVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [hasRenderableVideo, setHasRenderableVideo] = useState(false)

  // Attach media stream to video and audio elements
  useEffect(() => {
    const videoElement = videoRef.current
    const audioElement = audioRef.current

    if (!stream) {
      if (videoElement) videoElement.srcObject = null
      if (audioElement) audioElement.srcObject = null
      setHasRenderableVideo(false)
      return
    }

    const videoTracks = stream.getVideoTracks()
    const audioTracks = stream.getAudioTracks()

    if (videoElement) {
      if (videoTracks.length > 0 && isVideoEnabled) {
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream
        }
        videoElement.play().catch(() => {})
        setHasRenderableVideo(true)
      } else {
        videoElement.srcObject = null
        setHasRenderableVideo(false)
      }
    }

    // Attach audio track for remote participants
    if (!isLocal && audioElement) {
      if (audioTracks.length > 0) {
        if (audioElement.srcObject !== stream) {
          audioElement.srcObject = stream
        }
        audioElement.play().catch((err) => {
          console.warn(`[MediasoupVideoTile] Audio playback error for ${username}:`, err.message)
        })
      } else {
        audioElement.srcObject = null
      }
    }
  }, [stream, isVideoEnabled, isLocal, username])

  const initials = username
    ? username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <div
      className={cn(
        "relative group rounded-xl overflow-hidden bg-card border transition-all duration-300 shadow-sm",
        isSpeaking ? "border-primary ring-2 ring-primary/40 shadow-md" : "border-border hover:border-primary/50",
        isHandRaised ? "ring-2 ring-amber-500/80" : "",
        className,
      )}
    >
      {/* Hidden audio element for remote participants */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300 bg-muted",
          hasRenderableVideo && isVideoEnabled ? "opacity-100" : "opacity-0 absolute inset-0",
          isLocal ? "-scale-x-100" : "", // Mirror local preview
        )}
      />

      {/* Fallback avatar when video is off */}
      {(!hasRenderableVideo || !isVideoEnabled) && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/60 text-foreground">
          <div
            className={cn(
              "w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center font-bold text-2xl md:text-3xl bg-primary text-primary-foreground shadow-md transition-transform duration-300 group-hover:scale-105",
              isSpeaking ? "animate-pulse ring-4 ring-primary/40" : "",
            )}
          >
            {initials}
          </div>
          <span className="mt-3 text-sm font-medium text-foreground">{username}</span>
        </div>
      )}

      {/* Top badges: Hand raise & connection quality */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {isHandRaised ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-semibold shadow-md animate-bounce">
            <span>✋</span>
            <span>Raised Hand</span>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur border border-border text-[11px] text-muted-foreground shadow-sm">
          <Wifi
            className={cn(
              "w-3 h-3",
              connectionQuality === "good" ? "text-emerald-500" : connectionQuality === "fair" ? "text-amber-500" : "text-destructive",
            )}
          />
          <span className="capitalize">{connectionQuality}</span>
        </div>
      </div>

      {/* Bottom overlay: Name & Media indicators */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-background/85 backdrop-blur border border-border text-foreground shadow-md">
        <div className="flex items-center gap-2 truncate">
          <span className="text-xs md:text-sm font-medium truncate">{isLocal ? `${username} (You)` : username}</span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          {isAudioEnabled ? (
            <div className={cn("p-1 rounded-md", isSpeaking ? "text-emerald-500 bg-emerald-500/10" : "")}>
              <Mic className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-1 rounded-md text-destructive bg-destructive/10">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}

          {!isVideoEnabled && (
            <div className="p-1 rounded-md text-destructive bg-destructive/10">
              <VideoOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
