"use client"

import { Button } from "@/components/ui/button"
import { Copy, MessageSquare, Users, Wifi, WifiOff } from "lucide-react"
import { toast } from "sonner"

interface MeetingHeaderProps {
  meetingId: string
  participantCount: number
  connectionQuality: "good" | "fair" | "poor"
  setShowChat: (show: boolean) => void
  showChat: boolean
  setShowParticipants: (show: boolean) => void
  showParticipants: boolean
}

export function MeetingHeader({
  meetingId,
  participantCount,
  connectionQuality,
  setShowChat,
  showChat,
  setShowParticipants,
  showParticipants,
}: MeetingHeaderProps) {
  const shareMeeting = () => {
    const meetingLink = `${window.location.origin}/meeting/${meetingId}`
    navigator.clipboard.writeText(meetingLink)
    toast.success("Meeting link copied to clipboard")
  }

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <h1 className="text-xl font-bold">Meeting: {meetingId}</h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={shareMeeting}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowParticipants(!showParticipants)}>
          <Users className="h-4 w-4 mr-2" />
          Participants ({participantCount})
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat
        </Button>
        <div className="flex items-center gap-1">
          {connectionQuality === "good" && <Wifi className="h-5 w-5 text-green-500" />}
          {connectionQuality === "fair" && <Wifi className="h-5 w-5 text-yellow-500" />}
          {connectionQuality === "poor" && <WifiOff className="h-5 w-5 text-red-500" />}
          <span className="text-sm">{connectionQuality}</span>
        </div>
      </div>
    </header>
  )
}

