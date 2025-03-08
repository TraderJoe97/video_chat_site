"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface VideoComponentProps {
  stream: MediaStream | null
  className?: string
  muted?: boolean
}

export const VideoComponent: React.FC<VideoComponentProps> = ({ stream, className, muted = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (videoRef.current && stream) {
      try {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.error("Error playing video:", err)
            // Try again with muted which browsers allow without interaction
            if (!muted) {
              videoRef.current!.muted = true
              videoRef.current?.play().catch((e) => console.error("Failed to play even when muted:", e))
            }
          })
        }
      } catch (err) {
        console.error("Error setting video source:", err)
        setHasError(true)
      }
    }
  }, [stream, muted])

  if (hasError) {
    return <div className={cn("bg-muted flex items-center justify-center", className)}>Video Error</div>
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={cn("rounded-lg shadow-lg object-cover", className)}
    />
  )
}

