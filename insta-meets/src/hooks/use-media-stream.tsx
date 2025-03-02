"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"

export function useMediaStream() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioOnlyMode, setAudioOnlyMode] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good")

  const bandwidthRef = useRef<number>(1000) // Initial bandwidth estimate (kbps)

  const initializeStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      setLocalStream(stream)
      setIsConnecting(false)
    } catch (error) {
      console.error("Error initializing media:", error)
      toast.error("Could not access camera or microphone. Please check permissions.")
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    initializeStream()

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, []) // Removed unnecessary dependencies

  useEffect(() => {
    if (connectionQuality === "poor" && !audioOnlyMode) {
      setAudioOnlyMode(true)
      toast.warning("Switching to audio-only mode due to poor connection")
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = false
        })
      }
    } else if (connectionQuality !== "poor" && audioOnlyMode) {
      setAudioOnlyMode(false)
      toast.success("Video enabled: Connection quality improved")
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = true
        })
      }
    }
  }, [connectionQuality, audioOnlyMode, localStream])

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setAudioEnabled(!audioEnabled)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setVideoEnabled(!videoEnabled)
    }
  }

  const adjustVideoQuality = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        let quality: "high" | "medium" | "low"
        if (bandwidthRef.current > 1000) {
          quality = "high"
        } else if (bandwidthRef.current > 500) {
          quality = "medium"
        } else {
          quality = "low"
        }

        const constraints: MediaTrackConstraints = {
          width: quality === "high" ? 1280 : quality === "medium" ? 640 : 320,
          height: quality === "high" ? 720 : quality === "medium" ? 480 : 240,
          frameRate: quality === "high" ? 30 : quality === "medium" ? 20 : 15,
        }

        videoTrack
          .applyConstraints(constraints)
          .then(() => console.log("Video quality adjusted:", quality))
          .catch((error) => console.error("Error adjusting video quality:", error))
      }
    }
  }

  const updateConnectionQuality = (bandwidth: number) => {
    bandwidthRef.current = bandwidth
    if (bandwidth > 1000) {
      setConnectionQuality("good")
    } else if (bandwidth > 500) {
      setConnectionQuality("fair")
    } else {
      setConnectionQuality("poor")
    }
  }

  return {
    localStream,
    audioEnabled,
    videoEnabled,
    audioOnlyMode,
    isConnecting,
    connectionQuality,
    bandwidthRef,
    toggleAudio,
    toggleVideo,
    adjustVideoQuality,
    updateConnectionQuality,
  }
}

