"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Maximize, MessageSquare, Minimize, Share2, Users, WifiOff } from "lucide-react"

interface MeetingHeaderProps {
  meetingId: string
  isAudioOnlyMode: boolean
  toggleAudioOnlyMode: () => void
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  activeTab: string
  isLowBandwidthMode: boolean
  configureLowBandwidth: () => void
  isFullscreen: boolean
  toggleFullscreen: () => void
}

export function MeetingHeader({
  meetingId,
  isAudioOnlyMode,
  toggleAudioOnlyMode,
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  isLowBandwidthMode,
  configureLowBandwidth,
  isFullscreen,
  toggleFullscreen,
}: MeetingHeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center">
        <h1 className="text-xl font-bold mr-4">Meeting: {meetingId}</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share meeting link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center mr-4">
          <Switch id="audio-only" checked={isAudioOnlyMode} onCheckedChange={toggleAudioOnlyMode} className="mr-2" />
          <Label htmlFor="audio-only" className="text-sm cursor-pointer">
            Audio Only
          </Label>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {activeTab === "chat" ? <MessageSquare className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSidebarOpen ? "Close sidebar" : "Open sidebar"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isLowBandwidthMode ? "default" : "outline"}
                size="icon"
                onClick={configureLowBandwidth}
                className={isLowBandwidthMode ? "bg-amber-500 hover:bg-amber-600" : ""}
              >
                <WifiOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isLowBandwidthMode
                ? "Currently in low bandwidth mode - click to restore quality"
                : "Optimize for slow connection (reduces video quality)"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}

