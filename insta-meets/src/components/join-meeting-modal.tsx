"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JoinMeetingModalProps {
  meetingId: string
  isOpen: boolean
  onClose: () => void
}

export function JoinMeetingModal({ meetingId, isOpen, onClose }: JoinMeetingModalProps) {
  const [guestName, setGuestName] = useState("")
  const [activeTab, setActiveTab] = useState<string>("guest")
  const router = useRouter()
  const { loginWithRedirect, isAuthenticated, isLoading, user } = useAuth0()

  // If user becomes authenticated while modal is open, redirect to meeting
  useEffect(() => {
    if (isOpen && !isLoading && isAuthenticated && user) {
      router.push(`/meeting/${meetingId}?name=${encodeURIComponent(user.name || "")}`)
    }
  }, [isOpen, isLoading, isAuthenticated, user, meetingId, router])

  const handleGuestJoin = () => {
    if (guestName.trim()) {
      router.push(`/meeting/${meetingId}?name=${encodeURIComponent(guestName)}`)
    }
  }

  const handleSignIn = () => {
    loginWithRedirect({
      appState: { returnTo: `/meeting/${meetingId}` },
    })
  }

  // Prevent closing the modal by clicking outside or pressing escape
  // This ensures users must either sign in or join as guest
  const handleOpenChange = (open: boolean) => {
    if (open === false) {
      // Only allow closing if we're redirecting
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Join Meeting</DialogTitle>
          <DialogDescription>Join meeting {meetingId} as a guest or sign in to your account.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="guest" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="guest">Join as Guest</TabsTrigger>
            <TabsTrigger value="signin">Sign In</TabsTrigger>
          </TabsList>

          <TabsContent value="guest" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guestName.trim() && handleGuestJoin()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button onClick={handleGuestJoin} disabled={!guestName.trim()}>
                Join Meeting
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="signin" className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Sign in to your account to join the meeting. You&apos;ll be able to access all features.
            </p>
            <DialogFooter>
              <Button onClick={handleSignIn}>Sign In</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

