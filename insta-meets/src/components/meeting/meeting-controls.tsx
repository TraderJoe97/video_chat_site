"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FlagOffIcon as HandOff, Hand, Mic, MicOff, PhoneOff, VideoIcon, VideoOff } from "lucide-react"

interface MeetingControlsProps {
  isAudioEnabled: boolean
  toggleAudio: () => void
  isVideoEnabled: boolean
  toggleVideo: () => void
  isAudioOnlyMode: boolean
  isHandRaised: boolean
  toggleHandRaise: () => void
  leaveMeeting: () => void
}

export function MeetingControls({
  isAudioEnabled,
  toggleAudio,
  isVideoEnabled,
  toggleVideo,
  isAudioOnlyMode,
  isHandRaised,
  toggleHandRaise,
  leaveMeeting,
}: MeetingControlsProps) {
  return (
    <footer className="p-4 border-t bg-background">
      <div className="flex items-center justify-center space-x-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAudioEnabled ? "outline" : "destructive"}
                size="icon"
                onClick={toggleAudio}
                className="rounded-full h-12 w-12"
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isAudioEnabled ? "Mute microphone" : "Unmute microphone"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!isAudioOnlyMode && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isVideoEnabled ? "outline" : "destructive"}
                  size="icon"
                  onClick={toggleVideo}
                  className="rounded-full h-12 w-12"
                >
                  {isVideoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isVideoEnabled ? "Turn off camera" : "Turn on camera"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isHandRaised ? "default" : "outline"}
                size="icon"
                onClick={toggleHandRaise}
                className="rounded-full h-12 w-12"
              >
                {isHandRaised ? <HandOff className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isHandRaised ? "Lower hand" : "Raise hand"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" size="icon" onClick={leaveMeeting} className="rounded-full h-12 w-12">
                <PhoneOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leave meeting</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </footer>
  )
}

