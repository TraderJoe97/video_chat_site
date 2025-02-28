"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users, Share } from "lucide-react"

interface MeetingControlsProps {
  audioEnabled: boolean
  videoEnabled: boolean
  toggleAudio: () => void
  toggleVideo: () => void
  toggleChat: () => void
  toggleParticipants: () => void
  shareScreen: () => void
  leaveMeeting: () => void
}

export function MeetingControls({
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleVideo,
  toggleChat,
  toggleParticipants,
  shareScreen,
  leaveMeeting,
}: MeetingControlsProps) {
  return (
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
        {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </Button>
      <Button variant="outline" size="icon" onClick={shareScreen} className="rounded-full h-12 w-12">
        <Share className="h-5 w-5" />
      </Button>
      <Button variant="outline" size="icon" onClick={toggleChat} className="rounded-full h-12 w-12">
        <MessageSquare className="h-5 w-5" />
      </Button>
      <Button variant="outline" size="icon" onClick={toggleParticipants} className="rounded-full h-12 w-12">
        <Users className="h-5 w-5" />
      </Button>
      <Button variant="destructive" size="icon" onClick={leaveMeeting} className="rounded-full h-12 w-12">
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  )
}

