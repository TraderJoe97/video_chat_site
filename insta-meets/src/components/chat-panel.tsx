"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"

interface Message {
  text: string
  sender: string
  timestamp: string
}

interface ChatPanelProps {
  messages: Message[]
  currentUser: string
  meetingId: string
  onSendMessage: (text: string, meetingId: string) => void
}

export function ChatPanel({ messages, currentUser, meetingId, onSendMessage }: ChatPanelProps) {
  const [messageText, setMessageText] = useState("")

  const handleSendMessage = () => {
    if (messageText.trim()) {
      onSendMessage(messageText,meetingId)
      setMessageText("")
    }
  }

  return (
    <div className="flex flex-col w-full md:w-1/2 border-t md:border-t-0 md:border-l">
      <div className="p-3 border-b">
        <h3 className="font-medium">Chat</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex flex-col ${message.sender === currentUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`px-3 py-2 rounded-lg max-w-[80%] ${
                  message.sender === currentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {message.text}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />
        <Button size="icon" onClick={handleSendMessage}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

