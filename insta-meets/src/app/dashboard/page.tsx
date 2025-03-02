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
import { toast } from "sonner"

interface Meeting {
  id: string
  name: string
  date: string
  participants: number
  duration: number
}

interface BackendMeeting {
  meetingId: string
  hostId: string
  meetingName: string
  createdAt: string
}

export default function Dashboard() {
  const { isAuthenticated, isLoading, loginWithRedirect, user } = useAuth0()
  const router = useRouter()
  const [meetingId, setMeetingId] = useState("")
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect()
    }

    const loadMeetings = async () => {
      if (!isAuthenticated || !user?.sub) return

      try {
        setIsLoadingMeetings(true)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
        const response = await fetch(`${backendUrl}/test-meetings`)

        if (response.ok) {
          const data: BackendMeeting[] = await response.json()
          console.log("Loaded meetings from backend:", data)

          const backendMeetings = data
            .filter((meeting) => meeting.hostId === user.sub)
            .map(
              (meeting): Meeting => ({
                id: meeting.meetingId,
                name: meeting.meetingName || "Untitled Meeting",
                date: meeting.createdAt,
                participants: 0,
                duration: 0,
              }),
            )

          setRecentMeetings(backendMeetings)
        }
      } catch (error) {
        console.error("Error fetching meetings from backend:", error)
        toast.error("Failed to load meetings from server")
      } finally {
        setIsLoadingMeetings(false)
      }
    }

    if (!isLoading && isAuthenticated) {
      loadMeetings()
    }
  }, [isLoading, isAuthenticated, loginWithRedirect, user])

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
          {isLoadingMeetings ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : recentMeetings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {recentMeetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{meeting.name}</CardTitle>
                    <CardDescription className="text-xs">{new Date(meeting.date).toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{meeting.participants} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{meeting.duration} minutes</span>
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

