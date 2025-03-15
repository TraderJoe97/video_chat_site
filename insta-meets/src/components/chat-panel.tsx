"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
interface ChatPanelProps {
  messages: {
    senderId: string
    content: string
    timestamp: string
  }[]
  participants: {
    id: string
    name: string
  }[]
  onSendMessage: (content: string) => void
}

export default function ChatPanel({ messages, participants, onSendMessage }: ChatPanelProps) {
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

  // Get participant name by ID
  const getParticipantName = (id: string) => {
    const participant = participants.find((p) => p.id === id)
    return participant ? participant.name : "Unknown"
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">No messages yet</div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{getParticipantName(msg.senderId)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

