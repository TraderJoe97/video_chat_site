"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LandingNavbar } from "@/components/landing-navbar"

export default function JoinPage() {
  const [meetingId, setMeetingId] = useState("")
  const [name, setName] = useState("")
  const router = useRouter()

  const handleJoin = () => {
    if (meetingId.trim()) {
      router.push(`/meeting/${meetingId}?name=${encodeURIComponent(name)}`)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <LandingNavbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join a Meeting</CardTitle>
            <CardDescription>Enter the meeting ID to join an existing meeting</CardDescription>
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
            <div className="space-y-2">
              <Label htmlFor="name">Your Name (optional)</Label>
              <Input id="name" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleJoin} className="w-full">
              Join Meeting
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}

