"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"

interface ChatPanelProps {
  messages: { senderId: string; content: string }[]
  participants: { id: string; name: string }[]
  onSendMessage: (message: string) => void
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, participants, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState("")
  const [lastMessage, setLastMessage] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewMessage(event.target.value)
  }

  const handleSendMessage = () => {
    if (newMessage.trim() !== "" && newMessage !== lastMessage) {
      onSendMessage(newMessage)
      setLastMessage(newMessage)
      setNewMessage("")
    }
  }

  const getParticipantName = (senderId: string) => {
    const participant = participants.find((p) => p.id === senderId)
    return participant?.name || senderId
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4">
        {messages.filter(message => message.senderId !== "currentUserId").map((message, index) => (
          <div key={index} className="mb-2">
            <span className="font-bold">{getParticipantName(message.senderId)}:</span> {message.content}
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            className="flex-grow border rounded py-2 px-3 mr-2"
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleInputChange}
          />
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            type="button"
            onClick={handleSendMessage}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
