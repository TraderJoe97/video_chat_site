"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LandingNavbar } from "@/components/landing-navbar"
import { useAuth0 } from "@auth0/auth0-react"

export default function JoinPage() {
  const [meetingId, setMeetingId] = useState("")
  const [name, setName] = useState("")
  const router = useRouter()
  const { isAuthenticated, user, loginWithRedirect } = useAuth0()

  const handleJoin = () => {
    if (meetingId.trim()) {
      // If user is authenticated, use their name from Auth0
      const displayName = isAuthenticated && user?.name ? user.name : name
      router.push(`/meeting/${meetingId}?name=${encodeURIComponent(displayName)}`)
    }
  }

  const handleCreateMeeting = () => {
    if (isAuthenticated) {
      // Generate a random meeting ID
      const randomId = Math.random().toString(36).substring(2, 10)
      router.push(`/meeting/${randomId}`)
    } else {
      // Redirect to login if not authenticated
      loginWithRedirect({ appState: { returnTo: "/dashboard" } })
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <LandingNavbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Join a Meeting</CardTitle>
              <CardDescription>
                Enter the meeting ID to join an existing meeting as a guest or logged-in user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meeting-id">Meeting ID</Label>
                <Input
                  id="meeting-id"
                  placeholder="Enter meeting ID"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                />
              </div>
              {!isAuthenticated && (
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name (required for guests)</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleJoin} className="w-full" disabled={!meetingId || (!isAuthenticated && !name)}>
                Join Meeting
              </Button>
            </CardFooter>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle>Create a Meeting</CardTitle>
              <CardDescription>Start a new meeting as a host (requires login)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {isAuthenticated
                  ? "Click the button below to create a new meeting. You'll be the host with full control."
                  : "You need to log in to create a meeting. Guests can only join existing meetings."}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCreateMeeting}
                className="w-full"
                variant={isAuthenticated ? "default" : "outline"}
              >
                {isAuthenticated ? "Create New Meeting" : "Log In to Create"}
              </Button>
            </CardFooter>
          </Card>
        </div>
        {isAuthenticated && (
          <div className="text-center mt-4">
            <Button variant="link" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

