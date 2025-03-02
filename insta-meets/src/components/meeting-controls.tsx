"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Share } from "lucide-react"
import { toast } from "sonner"

interface MeetingControlsProps {
  audioEnabled: boolean
  videoEnabled: boolean
  toggleAudio: () => void
  toggleVideo: () => void
  leaveMeeting: () => void
  localStream: MediaStream | null
  peersRef: React.MutableRefObject<{ [key: string]: any }>
}

export function MeetingControls({
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleVideo,
  leaveMeeting,
  localStream,
  peersRef,
}: MeetingControlsProps) {
  const handleScreenShare = () => {
    navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then((stream) => {
        const videoTrack = stream.getVideoTracks()[0]

        Object.values(peersRef.current).forEach((peer) => {
          // Cast peer to the correct type
          const peerConnection = (peer as any)._pc
          if (peerConnection) {
            const sender = peerConnection.getSenders().find((s: any) => s.track?.kind === "video")
            if (sender) {
              sender.replaceTrack(videoTrack)
            }
          }
        })

        videoTrack.onended = () => {
          if (localStream) {
            const originalVideoTrack = localStream.getVideoTracks()[0]
            Object.values(peersRef.current).forEach((peer) => {
              // Cast peer to the correct type
              const peerConnection = (peer as any)._pc
              if (peerConnection) {
                const sender = peerConnection.getSenders().find((s: any) => s.track?.kind === "video")
                if (sender) {
                  sender.replaceTrack(originalVideoTrack)
                }
              }
            })
          }
        }
      })
      .catch((err) => {
        console.error("Error sharing screen:", err)
        toast.error("Could not share screen. Please check permissions.")
      })
  }

  return (
    <footer className="p-4 border-t bg-background">
      <div className="flex items-center justify-center gap-4">
        <Button
          variant={audioEnabled ? "outline" : "destructive"}
          size="icon"
          onClick={toggleAudio}
          className="rounded-full h-12 w-12"
        >
          {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={videoEnabled ? "outline" : "destructive"}
          size="icon"
          onClick={toggleVideo}
          className="rounded-full h-12 w-12"
        >
          {videoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button variant="outline" size="icon" className="rounded-full h-12 w-12" onClick={handleScreenShare}>
          <Share className="h-5 w-5" />
        </Button>
        <Button variant="destructive" size="icon" onClick={leaveMeeting} className="rounded-full h-12 w-12">
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </footer>
  )
}

