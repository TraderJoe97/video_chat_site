"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import VideoChat from "@/components/VideoChat"

export default function RoomPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  useEffect(() => {
    // You might want to verify if the room exists here
    // For now, we'll just assume it does
    router.push(`/?room=${params.id}`)
  }, [params.id, router])

  return <VideoChat />
}

