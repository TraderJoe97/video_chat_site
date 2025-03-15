"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ChatPanel from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"

interface MeetingSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  participants: any[]
  messages: any[]
  onSendMessage: (content: string) => void
}

export function MeetingSidebar({
  activeTab,
  setActiveTab,
  participants,
  messages,
  onSendMessage,
}: MeetingSidebarProps) {
  return (
    <div className="w-full md:w-1/3 border-l h-full flex flex-col">
      <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 mx-4 my-2">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col">
          <ChatPanel messages={messages} participants={participants} onSendMessage={onSendMessage} />
        </TabsContent>

        <TabsContent value="participants" className="flex-1">
          <ParticipantsPanel participants={participants} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

