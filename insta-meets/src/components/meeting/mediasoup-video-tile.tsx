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
    if (!stream) {
      setHasRenderableVideo(false)
      return
    }

    const videoTracks = stream.getVideoTracks()
    const audioTracks = stream.getAudioTracks()

    if (videoRef.current) {
      if (videoTracks.length > 0 && isVideoEnabled) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
        setHasRenderableVideo(true)
      } else {
        videoRef.current.srcObject = null
        setHasRenderableVideo(false)
      }
    }

    // Attach audio track for remote participants
    if (!isLocal && audioRef.current && audioTracks.length > 0) {
      audioRef.current.srcObject = stream
      audioRef.current.play().catch((err) => {
        console.warn(`[MediasoupVideoTile] Audio playback error for ${username}:`, err.message)
      })
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
        "relative group rounded-2xl overflow-hidden bg-slate-900/90 border transition-all duration-300 backdrop-blur-md shadow-lg",
        isSpeaking ? "border-emerald-500 ring-2 ring-emerald-500/50 shadow-emerald-950/40 shadow-xl" : "border-slate-800/80 hover:border-slate-700",
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
        muted={isLocal}
        playsInline
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          hasRenderableVideo && isVideoEnabled ? "opacity-100" : "opacity-0 absolute inset-0",
          isLocal ? "-scale-x-100" : "", // Mirror local camera preview
        )}
      />

      {/* Fallback avatar when video is off */}
      {(!hasRenderableVideo || !isVideoEnabled) && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
          <div
            className={cn(
              "w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center font-bold text-2xl md:text-3xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl border-2 border-indigo-400/30 transition-transform duration-300 group-hover:scale-105",
              isSpeaking ? "animate-pulse ring-4 ring-emerald-400/40" : "",
            )}
          >
            {initials}
          </div>
          <span className="mt-3 text-sm font-medium text-slate-300/90">{username}</span>
        </div>
      )}

      {/* Top badges: Hand raise & connection quality */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {isHandRaised ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 text-xs font-semibold backdrop-blur-md shadow-md animate-bounce">
            <span>✋</span>
            <span>Raised Hand</span>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/60 backdrop-blur-md border border-slate-800/80 text-[11px] text-slate-300">
          <Wifi
            className={cn(
              "w-3 h-3",
              connectionQuality === "good" ? "text-emerald-400" : connectionQuality === "fair" ? "text-amber-400" : "text-rose-400",
            )}
          />
          <span className="capitalize">{connectionQuality}</span>
        </div>
      </div>

      {/* Bottom overlay: Name & Media indicators */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950/70 backdrop-blur-md border border-slate-800/80 text-white shadow-md">
        <div className="flex items-center gap-2 truncate">
          <span className="text-xs md:text-sm font-medium truncate">{isLocal ? `${username} (You)` : username}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          {isAudioEnabled ? (
            <div className={cn("p-1 rounded-md", isSpeaking ? "text-emerald-400 bg-emerald-950/50" : "")}>
              <Mic className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-1 rounded-md text-rose-400 bg-rose-950/50">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}

          {!isVideoEnabled && (
            <div className="p-1 rounded-md text-rose-400 bg-rose-950/50">
              <VideoOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
