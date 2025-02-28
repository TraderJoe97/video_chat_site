"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, MicOff } from "lucide-react"

interface Participant {
  id: string
  name: string
  isYou?: boolean
  isMuted?: boolean
}

interface ParticipantsPanelProps {
  participants: Participant[]
}

export function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Participants ({participants.length})</h2>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-bold">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <span>
                  {participant.name} {participant.isYou && "(You)"}
                </span>
              </div>
              {participant.isMuted ? (
                <MicOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Mic className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

