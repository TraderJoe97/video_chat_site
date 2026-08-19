"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ChatPanel from "@/components/chat-panel"
import { ParticipantsPanel, type Participant } from "@/components/participants-panel"
import { MessageSquare, Users } from "lucide-react"

export interface SidebarMessage {
  senderId: string
  content: string
  timestamp: string
}

interface MeetingSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  participants: Participant[]
  messages: SidebarMessage[]
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
    <div className="w-full h-full flex flex-col bg-slate-900/95 text-white">
      <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <TabsList className="grid grid-cols-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <TabsTrigger
              value="chat"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger
              value="participants"
              className="rounded-lg text-xs font-medium data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>People ({participants.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden">
          <ChatPanel messages={messages} participants={participants} onSendMessage={onSendMessage} />
        </TabsContent>

        <TabsContent value="participants" className="flex-1 m-0 overflow-hidden">
          <ParticipantsPanel participants={participants} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
