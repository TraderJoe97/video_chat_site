"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardHeader } from "@/components/dashboard-header"
import { Video, Users, Clock, Plus } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

export default function Dashboard() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const router = useRouter()
  const [meetingId, setMeetingId] = useState("")

interface Meeting {
  id: string;
  name: string;
  date: string;
  participants: number;
  duration: number;
}

const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect()
    }

    // Load recent meetings from local storage
    const storedMeetings = localStorage.getItem("recentMeetings")
    if (storedMeetings) {
      setRecentMeetings(JSON.parse(storedMeetings))
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  const createNewMeeting = () => {
    const newMeetingId = uuidv4()
    router.push(`/meeting/${newMeetingId}`)
  }

  const joinMeeting = () => {
    if (meetingId.trim()) {
      router.push(`/meeting/${meetingId}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader />
      <main className="flex-1 container py-6 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Start a Meeting</CardTitle>
              <CardDescription>Create a new meeting and invite others</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
              <Button onClick={createNewMeeting} size="lg" className="gap-2">
                <Video className="h-5 w-5" />
                New Meeting
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Join a Meeting</CardTitle>
              <CardDescription>Enter a meeting code to join</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meeting-id">Meeting ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="meeting-id"
                    placeholder="Enter meeting ID"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
                  />
                  <Button onClick={joinMeeting}>Join</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Recent Meetings</h2>
          {recentMeetings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {recentMeetings.map((meeting, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{meeting.name || "Unnamed Meeting"}</CardTitle>
                    <CardDescription className="text-xs">{new Date(meeting.date).toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{meeting.participants || 0} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{meeting.duration || "0"} minutes</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/meeting/${meeting.id}`)}
                    >
                      Rejoin
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No recent meetings</h3>
                <p className="text-sm text-muted-foreground mb-4">Your recent meetings will appear here</p>
                <Button onClick={createNewMeeting}>Start a new meeting</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

