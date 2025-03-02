"use client"

import { User } from "lucide-react"

interface Participant {
  id: string
  name: string
  isYou?: boolean
}

interface ParticipantsPanelProps {
  participants: Participant[]
}

export function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
  return (
    <div className="flex flex-col w-full md:w-1/2">
      <div className="p-3 border-b">
        <h3 className="font-medium">Participants ({participants.length})</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {participants.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">No participants yet</div>
        ) : (
          <ul className="space-y-2">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-2">
                <div className="bg-muted rounded-full p-1">
                  <User className="h-4 w-4" />
                </div>
                <span>
                  {participant.name} {participant.isYou ? "(You)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

