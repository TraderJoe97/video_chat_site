"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ChatPanel from "@/components/chat-panel"
import { ParticipantsPanel, type Participant } from "@/components/participants-panel"
import { MessageSquare, Users } from "lucide-react"

export interface SidebarMessage {
  senderId: string
  senderName?: string
  content: string
  timestamp: string
  isFromCurrentUser?: boolean
}

interface MeetingSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  participants: Participant[]
  messages: SidebarMessage[]
  currentUserId?: string
  currentUsername?: string
  onSendMessage: (content: string) => void
}

export function MeetingSidebar({
  activeTab,
  setActiveTab,
  participants,
  messages,
  currentUserId,
  currentUsername,
  onSendMessage,
}: MeetingSidebarProps) {
  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-background text-foreground border-l border-border shadow-2xl overflow-hidden">
      <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
        <div className="p-3 border-b border-border flex-shrink-0">
          <TabsList className="grid grid-cols-2 bg-muted p-1 rounded-lg">
            <TabsTrigger
              value="chat"
              className="rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground transition-all gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger
              value="participants"
              className="rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground transition-all gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>People ({participants.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-0 overflow-hidden">
          <ChatPanel
            messages={messages}
            participants={participants}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onSendMessage={onSendMessage}
          />
        </TabsContent>

        <TabsContent value="participants" className="flex-1 m-0 min-h-0 overflow-hidden">
          <ParticipantsPanel participants={participants} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
