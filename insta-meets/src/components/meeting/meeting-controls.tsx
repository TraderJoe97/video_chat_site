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
      <div className="flex items-center gap-2 md:gap-3 p-2 rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 shadow-2xl pointer-events-auto transition-all duration-300">
        {/* Microphone Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAudioEnabled ? "ghost" : "destructive"}
                size="icon"
                onClick={toggleAudio}
                className={cn(
                  "rounded-xl h-11 w-11 transition-all duration-200",
                  isAudioEnabled
                    ? "bg-slate-800/80 hover:bg-slate-700/80 text-white hover:text-emerald-400"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50",
                )}
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
              {isAudioEnabled ? "Mute Microphone (Ctrl+D)" : "Unmute Microphone (Ctrl+D)"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Video Camera Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoEnabled ? "ghost" : "destructive"}
                size="icon"
                onClick={toggleVideo}
                className={cn(
                  "rounded-xl h-11 w-11 transition-all duration-200",
                  isVideoEnabled
                    ? "bg-slate-800/80 hover:bg-slate-700/80 text-white hover:text-indigo-400"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50",
                )}
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
              {isVideoEnabled ? "Turn Off Camera (Ctrl+E)" : "Turn On Camera (Ctrl+E)"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Screen Share Toggle */}
        {toggleScreenShare && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleScreenShare}
                  className={cn(
                    "rounded-xl h-11 w-11 transition-all duration-200",
                    isScreenSharing
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-white hover:text-indigo-400",
                  )}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
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
                variant="ghost"
                size="icon"
                onClick={toggleHandRaise}
                className={cn(
                  "rounded-xl h-11 w-11 transition-all duration-200",
                  isHandRaised
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/50 font-bold"
                    : "bg-slate-800/80 hover:bg-slate-700/80 text-white hover:text-amber-400",
                )}
              >
                <Hand className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
              {isHandRaised ? "Lower Hand" : "Raise Hand"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="w-[1px] h-6 bg-slate-800 mx-1 hidden sm:block" />

        {/* Chat Drawer Toggle */}
        {toggleSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleSidebar("chat")}
                  className={cn(
                    "relative rounded-xl h-11 w-11 transition-all duration-200",
                    isSidebarOpen && activeTab === "chat"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-white hover:text-indigo-400",
                  )}
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadMessageCount > 0 && !isSidebarOpen && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950 animate-pulse">
                      {unreadMessageCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
                Chat
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Participants Drawer Toggle */}
        {toggleSidebar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleSidebar("participants")}
                  className={cn(
                    "relative rounded-xl h-11 w-11 transition-all duration-200",
                    isSidebarOpen && activeTab === "participants"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-white hover:text-indigo-400",
                  )}
                >
                  <Users className="h-5 w-5" />
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-slate-900 text-slate-300 text-[9px] font-bold rounded-full border border-slate-700">
                    {participantCount}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
                Participants ({participantCount})
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Leave Call Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={leaveMeeting}
                className="rounded-xl h-11 w-12 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50 transition-transform active:scale-95"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-900 text-white border-slate-800">
              Leave Call
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </footer>
  )
}
