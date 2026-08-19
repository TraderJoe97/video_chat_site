"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import * as signalR from "@microsoft/signalr"

export interface SignalRParticipant {
  userId: string
  username: string
  isAudioEnabled?: boolean
  isVideoEnabled?: boolean
  isHandRaised?: boolean
  joinedAt?: string
}

export interface SignalRMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
  isFromCurrentUser?: boolean
}

interface UseSignalRProps {
  meetingId: string
  userId: string
  username: string
  onUserJoined?: (participant: SignalRParticipant) => void
  onUserLeft?: (userId: string) => void
  onReceiveMessage?: (message: SignalRMessage) => void
  onHandRaised?: (userId: string, isRaised: boolean) => void
  onMediaStatusChanged?: (userId: string, isAudioEnabled: boolean, isVideoEnabled: boolean) => void
  backendUrl?: string
}

export function useSignalR({
  meetingId,
  userId,
  username,
  onUserJoined,
  onUserLeft,
  onReceiveMessage,
  onHandRaised,
  onMediaStatusChanged,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? "" : "http://localhost:5000"),
}: UseSignalRProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (!meetingId || !userId) return

    console.log(`[SignalR] Initializing HubConnection to ${backendUrl}/hubs/meeting`)

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${backendUrl}/hubs/meeting`, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connectionRef.current = connection

    // Event Handlers
    connection.on("UserJoined", (participant: SignalRParticipant) => {
      console.log(`[SignalR] User joined: ${participant.username} (${participant.userId})`)
      onUserJoined?.(participant)
    })

    connection.on("UserLeft", (leftUserId: string) => {
      console.log(`[SignalR] User left: ${leftUserId}`)
      onUserLeft?.(leftUserId)
    })

    connection.on("ReceiveMessage", (message: SignalRMessage) => {
      console.log(`[SignalR] Received message from ${message.senderName}:`, message.content)
      onReceiveMessage?.({
        ...message,
        isFromCurrentUser: message.senderId === userId,
      })
    })

    connection.on("UserRaisedHand", (data: { userId: string; isRaised: boolean }) => {
      console.log(`[SignalR] Hand raised status changed for ${data.userId}:`, data.isRaised)
      onHandRaised?.(data.userId, data.isRaised)
    })

    connection.on("UserMediaStatusChanged", (data: { userId: string; isAudioEnabled: boolean; isVideoEnabled: boolean }) => {
      console.log(`[SignalR] Media status changed for ${data.userId}`)
      onMediaStatusChanged?.(data.userId, data.isAudioEnabled, data.isVideoEnabled)
    })

    // Start connection
    const startConnection = async () => {
      try {
        await connection.start()
        console.log("[SignalR] Connected to MeetingHub")
        setIsConnected(true)
        setConnectionError(null)

        // Join the meeting group
        await connection.invoke("JoinMeeting", meetingId, userId, username || userId)
      } catch (err: any) {
        console.warn("[SignalR] Connection error (will retry):", err.message)
        setConnectionError(err.message)
        setIsConnected(false)
      }
    }

    startConnection()

    return () => {
      console.log("[SignalR] Cleaning up connection")
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke("LeaveMeeting", meetingId, userId).catch(() => {})
      }
      connection.stop().catch(() => {})
      connectionRef.current = null
      setIsConnected(false)
    }
  }, [meetingId, userId, username, backendUrl])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) {
        console.warn("[SignalR] Cannot send message: Not connected")
        return false
      }

      try {
        await connectionRef.current.invoke("SendMessage", meetingId, userId, username || userId, content)
        return true
      } catch (err: any) {
        console.error("[SignalR] Error sending message:", err)
        return false
      }
    },
    [meetingId, userId, username],
  )

  const raiseHand = useCallback(
    async (isRaised: boolean) => {
      if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return

      try {
        await connectionRef.current.invoke("RaiseHand", meetingId, userId, isRaised)
      } catch (err: any) {
        console.error("[SignalR] Error raising hand:", err)
      }
    },
    [meetingId, userId],
  )

  const toggleMediaStatus = useCallback(
    async (isAudioEnabled: boolean, isVideoEnabled: boolean) => {
      if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return

      try {
        await connectionRef.current.invoke("ToggleMediaStatus", meetingId, userId, isAudioEnabled, isVideoEnabled)
      } catch (err: any) {
        console.error("[SignalR] Error toggling media status:", err)
      }
    },
    [meetingId, userId],
  )

  return {
    isConnected,
    connectionError,
    sendMessage,
    raiseHand,
    toggleMediaStatus,
  }
}
