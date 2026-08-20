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
  onScreenShareChanged?: (userId: string | null, isSharing: boolean) => void
  onReceiveSignal?: (senderUserId: string, signalData: any) => void
  onReceiveWhiteboardStroke?: (strokeData: any) => void
  onWhiteboardCleared?: () => void
  onWhiteboardToggled?: (isOpen: boolean) => void
  onReceiveWhiteboardHistory?: (strokes: any[]) => void
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
  onScreenShareChanged,
  onReceiveSignal,
  onReceiveWhiteboardStroke,
  onWhiteboardCleared,
  onWhiteboardToggled,
  onReceiveWhiteboardHistory,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5000" : "https://video-chat-site.onrender.com"),
}: UseSignalRProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [activeScreenSharerId, setActiveScreenSharerId] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  // Store callbacks in stable refs to avoid reconnecting on re-renders
  const callbacksRef = useRef({
    onUserJoined,
    onUserLeft,
    onReceiveMessage,
    onHandRaised,
    onMediaStatusChanged,
    onScreenShareChanged,
    onReceiveSignal,
    onReceiveWhiteboardStroke,
    onWhiteboardCleared,
    onWhiteboardToggled,
    onReceiveWhiteboardHistory,
  })

  useEffect(() => {
    callbacksRef.current = {
      onUserJoined,
      onUserLeft,
      onReceiveMessage,
      onHandRaised,
      onMediaStatusChanged,
      onScreenShareChanged,
      onReceiveSignal,
      onReceiveWhiteboardStroke,
      onWhiteboardCleared,
      onWhiteboardToggled,
      onReceiveWhiteboardHistory,
    }
  })

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
          if (p.userId !== userId) callbacksRef.current.onUserJoined?.(p)
        })
      }
      if (data?.activeScreenSharerId) {
        setActiveScreenSharerId(data.activeScreenSharerId)
        callbacksRef.current.onScreenShareChanged?.(data.activeScreenSharerId, true)
      }
    }

    connection.on("JoinedMeeting", handleJoined)
    connection.on("joinedmeeting", handleJoined)

    connection.on("UserJoined", (participant: SignalRParticipant) => {
      console.log(`[SignalR] User joined: ${participant.username} (${participant.userId})`)
      callbacksRef.current.onUserJoined?.(participant)
    })

    connection.on("UserLeft", (leftUserId: string) => {
      console.log(`[SignalR] User left: ${leftUserId}`)
      callbacksRef.current.onUserLeft?.(leftUserId)
    })

    connection.on("ReceiveMessage", (message: SignalRMessage) => {
      console.log(`[SignalR] Received message from ${message.senderName}:`, message.content)
      callbacksRef.current.onReceiveMessage?.({
        ...message,
        isFromCurrentUser: message.senderId === userId,
      })
    })

    connection.on("UserRaisedHand", (data: { userId: string; isRaised: boolean }) => {
      console.log(`[SignalR] Hand raised status changed for ${data.userId}:`, data.isRaised)
      callbacksRef.current.onHandRaised?.(data.userId, data.isRaised)
    })

    connection.on("UserMediaStatusChanged", (data: { userId: string; isAudioEnabled: boolean; isVideoEnabled: boolean }) => {
      console.log(`[SignalR] Media status changed for ${data.userId}`)
      callbacksRef.current.onMediaStatusChanged?.(data.userId, data.isAudioEnabled, data.isVideoEnabled)
    })

    connection.on("ScreenShareChanged", (sharerUserId: string | null, isSharing: boolean) => {
      console.log(`[SignalR] Screen share changed: sharer=${sharerUserId}, isSharing=${isSharing}`)
      setActiveScreenSharerId(isSharing ? sharerUserId : null)
      callbacksRef.current.onScreenShareChanged?.(sharerUserId, isSharing)
    })

    connection.on("ReceiveSignal", (senderUserId: string, signalData: any) => {
      console.log(`[SignalR] Received WebRTC signal from ${senderUserId}:`, signalData?.type || (signalData?.candidate ? "candidate" : "signal"))
      callbacksRef.current.onReceiveSignal?.(senderUserId, signalData)
    })

    // Whiteboard Real-Time Events
    connection.on("ReceiveWhiteboardStroke", (strokeData: any) => {
      callbacksRef.current.onReceiveWhiteboardStroke?.(strokeData)
    })

    connection.on("WhiteboardCleared", () => {
      callbacksRef.current.onWhiteboardCleared?.()
    })

    connection.on("WhiteboardToggled", (isOpen: boolean) => {
      callbacksRef.current.onWhiteboardToggled?.(isOpen)
    })

    connection.on("ReceiveWhiteboardHistory", (history: any[]) => {
      callbacksRef.current.onReceiveWhiteboardHistory?.(history || [])
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
  }, [meetingId, userId, backendUrl])

  // Public Methods
  const startScreenShare = useCallback(async (): Promise<{ success: boolean; currentSharerName?: string }> => {
    if (!connectionRef.current || !isConnected) {
      return { success: false }
    }
    try {
      const res: any = await connectionRef.current.invoke("StartScreenShare", meetingId, userId)
      return {
        success: !!res?.success,
        currentSharerName: res?.currentSharerName,
      }
    } catch (err) {
      console.error("[SignalR] Error starting screen share:", err)
      return { success: false }
    }
  }, [meetingId, userId, isConnected])

  const stopScreenShare = useCallback(async () => {
    if (!connectionRef.current || !isConnected) return
    try {
      await connectionRef.current.invoke("StopScreenShare", meetingId, userId)
    } catch (err) {
      console.error("[SignalR] Error stopping screen share:", err)
    }
  }, [meetingId, userId, isConnected])

  const sendWhiteboardStroke = useCallback(
    async (strokeData: any) => {
      if (!connectionRef.current || !isConnected) return
      try {
        await connectionRef.current.invoke("SendWhiteboardStroke", meetingId, strokeData)
      } catch (err) {
        console.error("[SignalR] Error sending whiteboard stroke:", err)
      }
    },
    [meetingId, isConnected],
  )

  const clearWhiteboard = useCallback(async () => {
    if (!connectionRef.current || !isConnected) return
    try {
      await connectionRef.current.invoke("ClearWhiteboard", meetingId)
    } catch (err) {
      console.error("[SignalR] Error clearing whiteboard:", err)
    }
  }, [meetingId, isConnected])

  const toggleWhiteboardMode = useCallback(
    async (isOpen: boolean) => {
      if (!connectionRef.current || !isConnected) return
      try {
        await connectionRef.current.invoke("ToggleWhiteboardMode", meetingId, isOpen)
      } catch (err) {
        console.error("[SignalR] Error toggling whiteboard mode:", err)
      }
    },
    [meetingId, isConnected],
  )

  const requestWhiteboardHistory = useCallback(async () => {
    if (!connectionRef.current || !isConnected) return
    try {
      await connectionRef.current.invoke("RequestWhiteboardHistory", meetingId)
    } catch (err) {
      console.error("[SignalR] Error requesting whiteboard history:", err)
    }
  }, [meetingId, isConnected])

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
      if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) {
        console.warn(`[SignalR] Cannot send signal to ${targetUserId}: Connection state is ${connectionRef.current?.state}`)
        return
      }
      try {
        await connectionRef.current.invoke("SendSignal", targetUserId, userId, signalData)
      } catch (err) {
        console.error(`[SignalR] Error sending WebRTC signal to ${targetUserId}:`, err)
      }
    },
    [userId],
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
    activeScreenSharerId,
    startScreenShare,
    stopScreenShare,
    sendWhiteboardStroke,
    clearWhiteboard,
    toggleWhiteboardMode,
    requestWhiteboardHistory,
    sendMessage,
    sendSignal,
    raiseHand,
    toggleMediaStatus,
  }
}
