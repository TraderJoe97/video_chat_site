"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Hand, MessageSquare, Mic, MicOff, PhoneOff, Share2, Users, Video, VideoOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface MeetingControlsProps {
  isAudioEnabled: boolean
  toggleAudio: () => void
  isVideoEnabled: boolean
  toggleVideo: () => void
  isHandRaised: boolean
  toggleHandRaise: () => void
  isScreenSharing?: boolean
  toggleScreenShare?: () => void
  isSidebarOpen?: boolean
  activeTab?: string
  toggleSidebar?: (tab: string) => void
  unreadMessageCount?: number
  participantCount?: number
  leaveMeeting: () => void
}

export function MeetingControls({
  isAudioEnabled,
  toggleAudio,
  isVideoEnabled,
  toggleVideo,
  isHandRaised,
  toggleHandRaise,
  isScreenSharing = false,
  toggleScreenShare,
  isSidebarOpen = false,
  activeTab = "chat",
  toggleSidebar,
  unreadMessageCount = 0,
  participantCount = 1,
  leaveMeeting,
}: MeetingControlsProps) {
  return (
    <footer className="relative py-3 px-4 flex items-center justify-center pointer-events-none z-30">
      <div className="flex items-center gap-2 md:gap-3 p-2 rounded-2xl bg-background/90 backdrop-blur-md border border-border shadow-xl pointer-events-auto transition-all duration-300">
        {/* Microphone Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAudioEnabled ? "outline" : "destructive"}
                size="icon"
                onClick={toggleAudio}
                className={cn(
                  "rounded-xl h-11 w-11 transition-all duration-200",
                  isAudioEnabled ? "hover:bg-muted text-foreground" : "shadow-md shadow-destructive/20",
                )}
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isAudioEnabled ? "Mute Microphone" : "Unmute Microphone"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Video Camera Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoEnabled ? "outline" : "destructive"}
                size="icon"
                onClick={toggleVideo}
                className={cn(
                  "rounded-xl h-11 w-11 transition-all duration-200",
                  isVideoEnabled ? "hover:bg-muted text-foreground" : "shadow-md shadow-destructive/20",
                )}
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Screen Share Toggle */}
        {toggleScreenShare && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "default" : "outline"}
                  size="icon"
                  onClick={toggleScreenShare}
                  className="rounded-xl h-11 w-11 transition-all duration-200"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Raise Hand Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isHandRaised ? "default" : "outline"}
                size="icon"
                onClick={toggleHandRaise}
                className={cn(
                  "rounded-xl h-11 w-11 transition-all duration-200",
                  isHandRaised ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" : "",
                )}
              >
                <Hand className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isHandRaised ? "Lower Hand" : "Raise Hand"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="w-[1px] h-6 bg-border mx-1 hidden sm:block" />

        {/* Chat Drawer Toggle */}
        {toggleSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isSidebarOpen && activeTab === "chat" ? "default" : "outline"}
                  size="icon"
                  onClick={() => toggleSidebar("chat")}
                  className="relative rounded-xl h-11 w-11 transition-all duration-200"
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadMessageCount > 0 && !isSidebarOpen && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background animate-pulse">
                      {unreadMessageCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Participants Drawer Toggle */}
        {toggleSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isSidebarOpen && activeTab === "participants" ? "default" : "outline"}
                  size="icon"
                  onClick={() => toggleSidebar("participants")}
                  className="relative rounded-xl h-11 w-11 transition-all duration-200"
                >
                  <Users className="h-5 w-5" />
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-muted text-foreground text-[9px] font-bold rounded-full border border-border">
                    {participantCount}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Participants ({participantCount})</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="w-[1px] h-6 bg-border mx-1" />

        {/* Leave Call Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={leaveMeeting}
                className="rounded-xl h-11 w-12 shadow-md shadow-destructive/20 transition-transform active:scale-95"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Leave Call</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </footer>
  )
}
