"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardHeader } from "@/components/dashboard-header"
import { Video, Users, Clock, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { createMeeting, fetchMeetings, checkServerHealth } from "@/lib/meeting-api"

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
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking")

  // Check server health on component mount
  useEffect(() => {
    const checkServer = async () => {
      try {
        const health = await checkServerHealth()
        setServerStatus(health.status === "ok" ? "online" : "offline")

        if (health.status !== "ok") {
          toast.error("Server is offline. Some features may not work.")
        }
      } catch {
        setServerStatus("offline")
        toast.error("Could not connect to server")
      }
    }

    checkServer()
  }, [])

  // Load meetings when authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect()
    }

    const loadMeetings = async () => {
      if (!isAuthenticated || !user?.sub) return

      try {
        setIsLoadingMeetings(true)

        // Use the fetchMeetings function from meeting-api
        const data = await fetchMeetings()
        console.log("Loaded meetings from backend:", data)

        const backendMeetings = data
          .filter((meeting: BackendMeeting) => meeting.hostId === user.sub)
          .map(
            (meeting: BackendMeeting): Meeting => ({
              id: meeting.meetingId,
              name: meeting.meetingName || "Untitled Meeting",
              date: meeting.createdAt,
              participants: 0,
              duration: 0,
            }),
          )

        setRecentMeetings(backendMeetings)
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

  const handleCreateNewMeeting = async () => {
    if (!user?.sub) {
      toast.error("You must be logged in to create a meeting")
      return
    }

    try {
      // Use the createMeeting function from meeting-api
      const meeting = await createMeeting(user.sub, `Meeting ${new Date().toLocaleDateString()}`)

      toast.success("Meeting created successfully")
      router.push(`/meeting/${meeting.meetingId}`)
    } catch (error) {
      console.error("Error creating meeting:", error)
      toast.error("Failed to create meeting")
    }
  }

  const joinMeeting = () => {
    if (meetingId.trim()) {
      router.push(`/meeting/${meetingId}`)
    } else {
      toast.error("Please enter a meeting ID")
    }
  }

  const refreshMeetings = async () => {
    if (!user?.sub) return

    setIsLoadingMeetings(true)
    try {
      const data = await fetchMeetings()

      const backendMeetings = data
        .filter((meeting: BackendMeeting) => meeting.hostId === user.sub)
        .map(
          (meeting: BackendMeeting): Meeting => ({
            id: meeting.meetingId,
            name: meeting.meetingName || "Untitled Meeting",
            date: meeting.createdAt,
            participants: 0,
            duration: 0,
          }),
        )

      setRecentMeetings(backendMeetings)
      toast.success("Meetings refreshed")
    } catch (error) {
      console.error("Error refreshing meetings:", error)
      toast.error("Failed to refresh meetings")
    } finally {
      setIsLoadingMeetings(false)
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
        {serverStatus === "offline" && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded">
            <div className="flex items-center">
              <div className="py-1">
                <svg
                  className="h-6 w-6 text-yellow-500 mr-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-bold">Server Offline</p>
                <p className="text-sm">
                  The server is currently offline. Meeting history and persistence may not work.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Start a Meeting</CardTitle>
              <CardDescription>Create a new meeting and invite others</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
              <Button onClick={handleCreateNewMeeting} size="lg" className="gap-2">
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
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight">Recent Meetings</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshMeetings}
              disabled={isLoadingMeetings}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingMeetings ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {isLoadingMeetings ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : recentMeetings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {recentMeetings.map((meeting) => (
                <Card key={meeting.id} className="hover:shadow-md transition-shadow">
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
                  <CardFooter className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/meeting/${meeting.id}`)}
                    >
                      Rejoin
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(meeting.id)
                        toast.success("Meeting ID copied to clipboard")
                      }}
                    >
                      Copy ID
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
                <Button onClick={handleCreateNewMeeting}>Start a new meeting</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

