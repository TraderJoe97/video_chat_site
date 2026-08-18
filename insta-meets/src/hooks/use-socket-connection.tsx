"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { io, type Socket } from "socket.io-client"
import { toast } from "sonner"
import type { SignalData } from "simple-peer"
import Peer from "simple-peer"

interface Message {
  text: string
  sender: string
  timestamp: string
  meetingId?: string
  isFromMe?: boolean
}

interface Participant {
  id: string
  name: string
  isYou?: boolean
}

interface ParticipantMap {
  [key: string]: string
}

interface UseSocketConnectionProps {
  meetingId: string
  userId: string
  username: string
  localStream: MediaStream | null
  createPeer: (userId: string, socketId: string, stream: MediaStream) => Peer.Instance
  addPeer: (incomingSignal: SignalData, callerId: string, stream: MediaStream) => Peer.Instance
  peersRef: React.MutableRefObject<{ [key: string]: Peer.Instance }>
  monitorPeerConnection: (peer: Peer.Instance, userId: string) => void
}

export function useSocketConnection({
  meetingId,
  userId,
  username,
  localStream,
  createPeer,
  addPeer,
  peersRef,
  monitorPeerConnection,
}: UseSocketConnectionProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantNames, setParticipantNames] = useState<ParticipantMap>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [peers, setPeers] = useState<{ [key: string]: Peer.Instance }>({})

  const socketRef = useRef<Socket | null>(null)
  const socketInitializedRef = useRef<boolean>(false)

  console.log("useSocketConnection - Rendering component", { userId, meetingId, username })
  useEffect(() => {
    const setupSocket = () => {
      if (socketInitializedRef.current || !userId) return

      const socketConnection = io(process.env.BACKEND_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ["websocket", "polling"],
        reconnection: true,
      })

      socketRef.current = socketConnection
      console.log("useSocketConnection - Socket created", socketConnection.id)
      setSocket(socketConnection)
      socketInitializedRef.current = true

      // Register socket events once:
      socketConnection.on("connect", () => {
        console.log("useSocketConnection - Connected to socket server with ID:", socketConnection.id)
        socketConnection.emit("join-room", {
          meetingId,
          userId,
          username,
        })
      })

      socketConnection.on("connect_error", (error) => {
        console.error("useSocketConnection - Socket connection error:", error)
        toast.error("Failed to connect to the meeting server")
      })

      // Prevent duplicate participants by checking if the user is already in the list
      socketConnection.on("user-connected", ({ userId, username }) => {
        console.log("useSocketConnection - User connected:", userId, username)
        setParticipants((prev) => {
          if (prev.some((p) => p.id === userId)) return prev
          return [...prev, { id: userId, name: username || userId }]
        })

        // Update participant names mapping
        setParticipantNames((prev) => ({
          ...prev,
          [userId]: username || userId,
        }))

        // Create a new peer connection only if one does not exist.
        console.log(`useSocketConnection - Creating peer connection with ${userId}`)
        if (!peersRef.current[userId] && localStream) {
          const peer = createPeer(userId, socketConnection.id ?? "", localStream)
          peersRef.current[userId] = peer
          setPeers((prev) => ({ ...prev, [userId]: peer }))
          monitorPeerConnection(peer, userId)
        }
      })

      socketConnection.on("user-disconnected", (userId) => {
        console.log("useSocketConnection - User disconnected:", userId)
        setParticipants((prev) => prev.filter((p) => p.id !== userId))
        if (peersRef.current[userId]) {
          peersRef.current[userId].destroy()
          delete peersRef.current[userId]
          setPeers((prev) => {
            const updated = { ...prev }
            delete updated[userId]
            return updated
          })
        }
      })

      socketConnection.on("createMessage", (message: Message) => {
        console.log(`useSocketConnection - Message received: ${message.text} from ${message.sender}`)
        // Only add the message if it's not from the current user or doesn't have the isFromMe flag
        if (message.sender !== userId || !message.isFromMe) {
          setMessages((prev) => [...prev, message])
        }
      })
      console.log(`useSocketConnection - Setting socket events`)

      // Handle offer event: when another user initiates a call.
      socketConnection.on("offer", (data: { offer: SignalData; callerId: string; userId: string}) => {
        console.log(`useSocketConnection - Received offer from ${data.callerId}`)
        // Only process if the offer is for this user
        if (data.userId === userId && localStream) {
          const peer = addPeer(data.offer, data.callerId, localStream) 
          peersRef.current[data.callerId] = peer
          setPeers((prev) => ({ ...prev, [data.callerId]: peer }))
          monitorPeerConnection(peer, data.callerId)
        }
      })
      console.log("useSocketConnection - Socket events set successfully")

      // Handle answer with stable state checking
      socketConnection.on("answer", (data: { answer: SignalData; callerId: string }) => {
        console.log(`useSocketConnection - Received answer from ${data.callerId}`);
        const peer = peersRef.current[data.callerId] as Peer.Instance
        if (peer) {
          const pc = peer as unknown as { _pc: RTCPeerConnection }
          // Only signal the answer if the underlying RTCPeerConnection is in "have-local-offer" state.
          if (pc._pc && pc._pc.signalingState === "have-local-offer") {
            console.log(`useSocketConnection - Setting remote answer for ${data.callerId}`)
            peer.signal(data.answer)
          } else {
            console.warn(
              `useSocketConnection - Answer from ${data.callerId} ignored (signalingState: ${
                pc && pc._pc ? pc._pc.signalingState : "unknown"
              })`,
            )
          }
        } else {
          console.warn(`useSocketConnection - Received answer for unknown peer ${data.callerId}`);
        }
      })

      // Handle ICE candidates
      socketConnection.on("candidate", (data: { candidate: RTCIceCandidate; callerId: string }) => {
        console.log(`useSocketConnection - Received ICE candidate from: ${data.callerId}`);
        if (peersRef.current[data.callerId]) {
          peersRef.current[data.callerId].signal({ type: "candidate", candidate: data.candidate })
        } else {
          console.warn(`useSocketConnection - Received candidate for unknown peer ${data.callerId}`);
        }
      })

      socketConnection.on("existing-participants", (participants: Array<{ userId: string; username: string }>) => {
        console.log("useSocketConnection - Existing participants:", participants)

        // Update participants state
        setParticipants((prev) => {
          const newParticipants = [...prev]

          participants.forEach(({ userId, username }) => {
            if (!newParticipants.some((p) => p.id === userId)) {
              newParticipants.push({
                id: userId,
                name: username || userId,
              })
            }
          })

          return newParticipants
        })

        // Update participant names mapping
        const namesMap: ParticipantMap = {}
        participants.forEach(({ userId, username }) => {
          namesMap[userId] = username || userId
        })

        setParticipantNames((prev) => ({
          ...prev,
          ...namesMap,
        }))
      })
    }
    console.log("useSocketConnection - Calling setupSocket")

    // Only run once
    setupSocket()

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log("useSocketConnection - Disconnecting socket")
        socketRef.current.disconnect()
        socketInitializedRef.current = false
      }
    }
  }, [meetingId, userId, username, localStream, createPeer, addPeer, monitorPeerConnection, peersRef])

  const sendMessage = (text: string) => {
    if (socket && text.trim()) {
      console.log(`useSocketConnection - Sending message: ${text}`)
      const messageData = {
        text,
        sender: userId,
        timestamp: new Date().toISOString(),
        meetingId,
        isFromMe: true, // Add this flag to identify locally sent messages
      }
      console.log(`useSocketConnection - Emitting message event`)
      socket.emit("message", messageData)
      console.log(`useSocketConnection - Message emitted: ${text}`)
      setMessages((prev) => [...prev, messageData])
    }
  }

  return {
    socket,
    participants,
    participantNames,
    messages,
    peers,
    sendMessage,
  }
}