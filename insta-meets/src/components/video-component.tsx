"use client"

import type React from "react"
import { useRef, useEffect } from "react"

interface VideoComponentProps {
  stream: MediaStream
}

export const VideoComponent: React.FC<VideoComponentProps> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      const tracks = stream.getTracks()
      tracks.forEach((track) => {
        videoRef.current!.srcObject = new MediaStream([track])
      })
    }
  }, [stream])

  return <video ref={videoRef} autoPlay playsInline className="rounded-lg shadow-lg object-cover" />
}

