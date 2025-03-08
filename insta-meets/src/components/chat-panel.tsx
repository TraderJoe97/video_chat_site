"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  text: string
  sender: string
  timestamp: string
}

interface Participant {
  id: string
  name: string
  isYou?: boolean
}

interface ChatPanelProps {
  messages: Message[]
  currentUser: string
  onSendMessage: (text: string) => void
  participants: Participant[]
}

export function ChatPanel({ messages, currentUser, onSendMessage, participants }: ChatPanelProps) {
  const [messageText, setMessageText] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    if (messageText.trim()) {
      onSendMessage(messageText)
      setMessageText("")
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  const getParticipantName = (senderId: string) => {
    const participant = participants.find((p) => p.id === senderId)
    return participant?.name || senderId
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((message, index) => {
              const isCurrentUser = message.sender === currentUser
              const participantName = getParticipantName(message.sender)

              return (
                <div key={index} className={cn("flex gap-3", isCurrentUser ? "flex-row-reverse" : "flex-row")}>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(participantName)}</AvatarFallback>
                  </Avatar>

                  <div className={cn("flex flex-col max-w-[75%]", isCurrentUser ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "px-3 py-2 rounded-lg",
                        isCurrentUser
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted rounded-tl-none",
                      )}
                    >
                      {!isCurrentUser && <div className="text-xs font-medium mb-1">{participantName}</div>}
                      <div className="break-words">{message.text}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          className="rounded-full"
        />
        <Button size="icon" onClick={handleSendMessage} disabled={!messageText.trim()} className="rounded-full">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

