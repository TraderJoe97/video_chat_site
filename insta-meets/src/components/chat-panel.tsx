"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns/formatDistanceToNow"

interface ChatPanelProps {
  messages: {
    senderId: string
    senderName?: string
    content: string
    timestamp: string
    isFromCurrentUser?: boolean
  }[]
  participants: {
    id: string
    name: string
  }[]
  currentUserId?: string
  currentUsername?: string
  onSendMessage: (content: string) => void
}

export default function ChatPanel({
  messages,
  participants,
  currentUserId,
  currentUsername,
  onSendMessage,
}: ChatPanelProps) {
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage("")
    }
  }

  // Get participant name by ID or message senderName
  const getParticipantName = (msg: { senderId: string; senderName?: string; isFromCurrentUser?: boolean }) => {
    if (msg.isFromCurrentUser || (currentUserId && msg.senderId === currentUserId)) {
      return currentUsername ? `${currentUsername} (You)` : "You"
    }
    if (msg.senderName && msg.senderName !== "Unknown") {
      return msg.senderName
    }
    const participant = participants.find((p) => p.id === msg.senderId)
    return participant?.name || msg.senderName || "Participant"
  }

  // Safe relative time formatting helper
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return "just now"
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return "just now"
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-background text-foreground overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.isFromCurrentUser || (currentUserId && msg.senderId === currentUserId)
            return (
              <div key={index} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${isMe ? "text-primary" : "text-foreground"}`}>
                    {getParticipantName(msg)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`mt-1 text-sm rounded-xl px-3 py-2 max-w-[85%] break-words ${
                    isMe
                      ? "bg-primary text-primary-foreground self-start rounded-tl-none"
                      : "bg-muted text-foreground self-start rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-border bg-background flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 text-sm bg-muted/50 rounded-xl"
          />
          <Button type="submit" size="icon" disabled={!message.trim()} className="h-9 w-9 rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
