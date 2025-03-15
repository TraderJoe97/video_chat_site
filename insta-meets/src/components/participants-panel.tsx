"use client"

import { Hand } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export interface Participant {
  id: string
  name: string
  isYou?: boolean
  isSpeaking?: boolean
  hasHandRaised?: boolean
}

interface ParticipantsPanelProps {
  participants: Participant[]
}

export function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {participants.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No participants yet</div>
        ) : (
          <ul className="space-y-3">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {participant.name}
                      {participant.isYou && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    {participant.hasHandRaised && (
                      <div className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                        <Hand className="h-3 w-3" />
                        <span>Hand raised</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {participant.isSpeaking && <div className="w-2 h-2 rounded-full bg-green-500" title="Speaking"></div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}

