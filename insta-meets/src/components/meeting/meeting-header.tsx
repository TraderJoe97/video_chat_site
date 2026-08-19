"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, Maximize, Minimize, Video, ShieldCheck } from "lucide-react"
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
    <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl z-20">
      {/* Left: Branding & Meeting ID */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-950/50">
            <Video className="w-5 h-5" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">InstaMeets</span>
            <span className="text-sm font-semibold text-white truncate max-w-[200px]">{meetingName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
          <span className="font-mono text-indigo-400 font-medium">{meetingId}</span>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyMeetingLink}
                className="h-8 px-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white text-xs gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{copied ? "Copied" : "Copy Link"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-800">
              Copy meeting invite link
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* SFU & SignalR Status Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isSfuConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
            />
            <span className="text-[11px] font-medium text-slate-300">SFU Router</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-medium text-slate-300">.NET SignalR</span>
          </div>
        </div>

        {/* Fullscreen Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-9 w-9 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-800">
              {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
