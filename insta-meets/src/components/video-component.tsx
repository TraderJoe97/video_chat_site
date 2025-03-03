"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface VideoComponentProps {
  stream: MediaStream
  className?: string
}

export const VideoComponent: React.FC<VideoComponentProps> = ({ stream, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return <video ref={videoRef} autoPlay playsInline className={cn("rounded-lg shadow-lg object-cover", className)} />
}

