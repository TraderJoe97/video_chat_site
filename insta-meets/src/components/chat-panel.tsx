"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"

interface Message {
  text: string
  sender: string
  timestamp: string
}

interface ChatPanelProps {
  messages: Message[]
  sendMessage: (text: string) => void
  currentUser: string
}

export function ChatPanel({ messages, sendMessage, currentUser }: ChatPanelProps) {
  const [text, setText] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages]) // Only depend on messages

  const handleSend = () => {
    if (text.trim()) {
      sendMessage(text)
      setText("")
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Chat</h2>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col ${message.sender === currentUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.sender === currentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {message.text}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <span>{message.sender === currentUser ? "You" : message.sender}</span>
                  <span>•</span>
                  <span>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <Input placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="icon" disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

