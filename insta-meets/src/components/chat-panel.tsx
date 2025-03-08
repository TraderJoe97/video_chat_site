"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"

interface ChatPanelProps {
  messages: { senderId: string; content: string; timestamp?: string }[]
  participants: { id: string; name: string }[]
  onSendMessage: (message: string) => void
  currentUserId: string // Add this prop to identify the current user
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, participants, onSendMessage, currentUserId }) => {
  const [newMessage, setNewMessage] = useState("")
  const [lastMessage, setLastMessage] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
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

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSendMessage()
    }
  }

  const getParticipantName = (senderId: string) => {
    const participant = participants.find((p) => p.id === senderId)
    return participant?.name || senderId
  }

  // Filter out messages from the current user to avoid duplication
  const filteredMessages = messages.filter(
    (message) =>
      // Only show messages from other users, not from the current user
      message.senderId !== currentUserId,
  )

  return (
    <div className="flex flex-col h-full">
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No messages yet</div>
        ) : (
          filteredMessages.map((message, index) => (
            <div key={index} className="mb-3 p-2 rounded bg-muted/30">
              <div className="font-bold">{getParticipantName(message.senderId)}</div>
              <div>{message.content}</div>
            </div>
          ))
        )}
      </div>
      <div className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            className="flex-grow border rounded py-2 px-3 mr-2"
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
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

