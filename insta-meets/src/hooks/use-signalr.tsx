"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import * as signalR from "@microsoft/signalr"

export interface SignalRParticipant {
  userId: string
  username: string
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isHandRaised: boolean
  joinedAt: string
}

export interface SignalRMessage {
  id?: string
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
  onReceiveSignal?: (senderUserId: string, signalData: any) => void
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
  onReceiveSignal,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5000" : "https://video-chat-site.onrender.com"),
}: UseSignalRProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (!meetingId || !userId) return

    const normalizedBackendUrl = backendUrl.replace(/\/$/, "")
    const hubUrl = `${normalizedBackendUrl}/hubs/meeting`
    console.log(`[SignalR] Initializing HubConnection to ${hubUrl}`)

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connectionRef.current = connection

    // Event Handlers
    const handleJoined = (data: any) => {
      console.log(`[SignalR] Successfully joined meeting ${meetingId}`)
      if (data?.participants && Array.isArray(data.participants)) {
        data.participants.forEach((p: SignalRParticipant) => {
          if (p.userId !== userId) onUserJoined?.(p)
        })
      }
    }

    connection.on("JoinedMeeting", handleJoined)
    connection.on("joinedmeeting", handleJoined)

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

    connection.on("ReceiveSignal", (senderUserId: string, signalData: any) => {
      console.log(`[SignalR] Received WebRTC signal from ${senderUserId}:`, signalData?.type || (signalData?.candidate ? "candidate" : "signal"))
      onReceiveSignal?.(senderUserId, signalData)
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
      }
    }

    startConnection()

    // Cleanup on unmount
    return () => {
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke("LeaveMeeting", meetingId, userId).catch(() => {})
        connection.stop()
      }
    }
  }, [meetingId, userId, username, backendUrl, onUserJoined, onUserLeft, onReceiveMessage, onHandRaised, onMediaStatusChanged, onReceiveSignal])

  // Public Methods
  const sendMessage = useCallback(
    async (content: string) => {
      if (!connectionRef.current || !isConnected) {
        console.warn("[SignalR] Cannot send message: Not connected")
        return
      }
      try {
        await connectionRef.current.invoke("SendMessage", meetingId, userId, username || "User", content)
      } catch (err) {
        console.error("[SignalR] Error sending message:", err)
      }
    },
    [meetingId, userId, username, isConnected],
  )

  const sendSignal = useCallback(
    async (targetUserId: string, signalData: any) => {
      if (!connectionRef.current || !isConnected) return
      try {
        await connectionRef.current.invoke("SendSignal", targetUserId, userId, signalData)
      } catch (err) {
        console.error(`[SignalR] Error sending WebRTC signal to ${targetUserId}:`, err)
      }
    },
    [userId, isConnected],
  )

  const raiseHand = useCallback(
    async (isRaised: boolean) => {
      if (!connectionRef.current || !isConnected) return
      try {
        await connectionRef.current.invoke("RaiseHand", meetingId, userId, isRaised)
      } catch (err) {
        console.error("[SignalR] Error raising hand:", err)
      }
    },
    [meetingId, userId, isConnected],
  )

  const toggleMediaStatus = useCallback(
    async (isAudioEnabled: boolean, isVideoEnabled: boolean) => {
      if (!connectionRef.current || !isConnected) return
      try {
        await connectionRef.current.invoke("ToggleMediaStatus", meetingId, userId, isAudioEnabled, isVideoEnabled)
      } catch (err) {
        console.error("[SignalR] Error toggling media status:", err)
      }
    },
    [meetingId, userId, isConnected],
  )

  return {
    isConnected,
    connectionError,
    sendMessage,
    sendSignal,
    raiseHand,
    toggleMediaStatus,
  }
}
