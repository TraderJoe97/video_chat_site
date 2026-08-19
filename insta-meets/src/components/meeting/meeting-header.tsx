"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, Maximize, Minimize, Video } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface MeetingHeaderProps {
  meetingId: string
  meetingName?: string
  isFullscreen: boolean
  toggleFullscreen: () => void
  isSfuConnected?: boolean
  isSignalRConnected?: boolean
}

export function MeetingHeader({
  meetingId,
  meetingName = "InstaMeets Call",
  isFullscreen,
  toggleFullscreen,
  isSfuConnected = true,
  isSignalRConnected = true,
}: MeetingHeaderProps) {
  const [copied, setCopied] = useState(false)
  const isOnline = isSfuConnected && isSignalRConnected

  const copyMeetingLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/meeting/${meetingId}`
      navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Meeting link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20">
      {/* Left: Branding & Meeting Info */}
      <div className="flex items-center gap-3 md:gap-4">
        <Link className="flex items-center gap-2 font-bold" href="/dashboard">
          <Video className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">Insta Meets</span>
        </Link>

        <div className="h-4 w-[1px] bg-border hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate max-w-[150px] md:max-w-[220px]">
            {meetingName}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-mono">
            {meetingId}
          </span>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={copyMeetingLink}
                className="h-8 px-2.5 rounded-lg text-xs gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{copied ? "Copied" : "Share"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy meeting invite link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Simple User-Friendly Connection Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"
            }`}
          />
          <span className="text-[11px] font-medium text-foreground">
            {isOnline ? "Live" : "Connecting..."}
          </span>
        </div>

        {/* Dark/Light Mode Toggle */}
        <ModeToggle />

        {/* Fullscreen Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                className="h-9 w-9 rounded-lg"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
