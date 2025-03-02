"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import Peer from "simple-peer"
import { useSocket } from "@/contexts/SocketContext"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, VideoIcon, VideoOff } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"
import { toast } from "sonner"

interface UserConnectedData {
  userId: string
  username: string
}

interface SignalData {
  callerId: string
  offer?: Peer.SignalData
  answer?: Peer.SignalData
  candidate?: RTCIceCandidate
}

interface Message {
  text: string
  sender: string
  timestamp: string
}

interface Participant {
  id: string
  name: string
  isYou?: boolean
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth0()
  const { socket, isConnected } = useSocket()
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const peersRef = useRef<Record<string, Peer.Instance>>({})
  const userIdRef = useRef<string>("")
  const localVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (isAuthenticated && user?.sub) {
      userIdRef.current = user.sub
    } else if (searchParams.get("name")) {
      userIdRef.current = searchParams.get("name") || `guest-${Math.floor(Math.random() * 1000)}`
    } else {
      const name = prompt("Please enter your name to join the meeting", "Guest")
      userIdRef.current = name || `guest-${Math.floor(Math.random() * 1000)}`
    }

    setParticipants([
      {
        id: userIdRef.current,
        name: user?.name || searchParams.get("name") || userIdRef.current,
        isYou: true,
      },
    ])

    console.log("Current user ID set to:", userIdRef.current)
  }, [isAuthenticated, user, searchParams])

  const createPeer = useCallback(
    (userId: string) => {
      console.log(`Creating peer for ${userId}`)

      if (!localStream) {
        console.error("Cannot create peer: local stream is null")
        return null
      }

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: localStream,
      })

      peer.on("signal", (data: Peer.SignalData) => {
        console.log(`Sending offer to ${userId}`, data.type || "candidate")
        socket?.emit("offer", {
          meetingId: id,
          callerId: userIdRef.current,
          userId: userId,
          offer: data,
        })
      })

      peer.on("stream", (remoteStream: MediaStream) => {
        console.log(`Received stream from ${userId}`)
        setRemoteStreams((prevStreams) => ({
          ...prevStreams,
          [userId]: remoteStream,
        }))
      })

      peer.on("error", (err: Error) => {
        console.error("Error in peer connection:", err)
        toast.error(`Connection error with ${userId}`)
      })

      peer.on("close", () => {
        console.log(`Peer connection with ${userId} closed`)
        setRemoteStreams((prevStreams) => {
          const newStreams = { ...prevStreams }
          delete newStreams[userId]
          return newStreams
        })
      })

      return peer
    },
    [socket, localStream, id],
  )

  const addPeer = useCallback(
    (incomingSignal: Peer.SignalData, callerId: string) => {
      console.log(`Adding peer for ${callerId}`)

      if (!localStream) {
        console.error("Cannot add peer: local stream is null")
        return null
      }

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: localStream,
      })

      peer.on("signal", (data: Peer.SignalData) => {
        console.log(`Sending answer signal to ${callerId}`)
        socket?.emit("answer", {
          meetingId: id,
          callerId: callerId,
          answer: data,
        })
      })

      peer.on("stream", (remoteStream: MediaStream) => {
        console.log(`Received stream from ${callerId}`)
        setRemoteStreams((prevStreams) => ({
          ...prevStreams,
          [callerId]: remoteStream,
        }))
      })

      peer.on("error", (err: Error) => {
        console.error("Error in peer connection:", err)
      })

      peer.signal(incomingSignal)

      return peer
    },
    [socket, localStream, id],
  )

  useEffect(() => {
    const initializeStream = async () => {
      try {
        console.log("Requesting user media")
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        console.log("Media stream obtained:", stream.id)
        setLocalStream(stream)

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error("Error accessing media devices:", error)
        toast.error("Could not access camera or microphone. Please check permissions.")
      }
    }

    initializeStream()

    return () => {
      if (localStream) {
        console.log("Stopping all tracks in local stream")
        localStream.getTracks().forEach((track) => track.stop())
      }

      Object.values(peersRef.current).forEach((peer) => {
        console.log("Destroying peer connection")
        peer.destroy()
      })
    }
  }, [localStream])

  useEffect(() => {
    if (!socket || !isConnected || !localStream || !userIdRef.current) {
      return
    }

    console.log("Setting up socket event listeners")

    const hostId = isAuthenticated && user?.sub ? user.sub : userIdRef.current

    const handleUserConnected = (data: UserConnectedData) => {
      console.log("User connected:", data)
      const { userId, username } = data

      if (userId !== userIdRef.current) {
        console.log(`Creating peer for user ${userId}`)
        const peer = createPeer(userId)

        if (peer) {
          peersRef.current[userId] = peer

          setParticipants((prev) => {
            if (!prev.some((p) => p.id === userId)) {
              return [...prev, { id: userId, name: username }]
            }
            return prev
          })
        }
      }
    }

    const handleOffer = (data: SignalData) => {
      console.log("Offer received:", data.callerId, data.offer)
      if (data.offer && data.callerId !== userIdRef.current) {
        if (!peersRef.current[data.callerId]) {
          console.log(`Creating new peer from offer for ${data.callerId}`)
          const peer = addPeer(data.offer, data.callerId)

          if (peer) {
            peersRef.current[data.callerId] = peer
          }
        }
      }
    }

    const handleAnswer = (data: SignalData) => {
      console.log("Answer received:", data.callerId, data.answer)
      if (data.answer && peersRef.current[data.callerId]) {
        peersRef.current[data.callerId].signal(data.answer)
      }
    }

    const handleCandidate = (data: SignalData) => {
      console.log("Candidate received:", data.callerId, data.candidate)
      if (data.candidate && peersRef.current[data.callerId]) {
        peersRef.current[data.callerId].signal({ type: "candidate", candidate: data.candidate })
      }
    }

    const handleUserDisconnected = (userId: string) => {
      console.log("User disconnected:", userId)

      if (peersRef.current[userId]) {
        peersRef.current[userId].destroy()
        delete peersRef.current[userId]
      }

      setParticipants((prev) => prev.filter((p) => p.id !== userId))

      setRemoteStreams((prevStreams) => {
        const newStreams = { ...prevStreams }
        delete newStreams[userId]
        return newStreams
      })
    }

    const handleCreateMessage = (message: Message) => {
      console.log("Chat message received:", message)
      setMessages((prev) => [...prev, message])
    }

    const handleExistingParticipants = (existingParticipants: Array<{ userId: string; username: string }>) => {
      console.log("Existing participants:", existingParticipants)

      setParticipants((prev) => {
        const currentIds = prev.map((p) => p.id)
        const newParticipants = [...prev]

        existingParticipants.forEach(({ userId, username }) => {
          if (!currentIds.includes(userId) && userId !== userIdRef.current) {
            newParticipants.push({ id: userId, name: username })
          }
        })

        return newParticipants
      })
    }

    socket.emit("join-room", {
      meetingId: id,
      userId: userIdRef.current,
      username: user?.name || searchParams.get("name") || userIdRef.current,
      hostId: hostId,
    })

    socket.on("user-connected", handleUserConnected)
    socket.on("offer", handleOffer)
    socket.on("answer", handleAnswer)
    socket.on("candidate", handleCandidate)
    socket.on("user-disconnected", handleUserDisconnected)
    socket.on("createMessage", handleCreateMessage)
    socket.on("existing-participants", handleExistingParticipants)

    return () => {
      socket.off("user-connected", handleUserConnected)
      socket.off("offer", handleOffer)
      socket.off("answer", handleAnswer)
      socket.off("candidate", handleCandidate)
      socket.off("user-disconnected", handleUserDisconnected)
      socket.off("createMessage", handleCreateMessage)
      socket.off("existing-participants", handleExistingParticipants)
    }
  }, [socket, isConnected, localStream, id, isAuthenticated, user, searchParams, createPeer, addPeer])

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setLocalStream(localStream.clone())
      }
    }
  }, [localStream])

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setLocalStream(localStream.clone())
      }
    }
  }, [localStream])

  const sendMessage = useCallback(
    (text: string) => {
      if (socket && text.trim()) {
        const messageData = {
          text,
          sender: userIdRef.current,
          timestamp: new Date().toISOString(),
          meetingId: id,
        }

        socket.emit("message", messageData)
        setMessages((prev) => [...prev, messageData])
      }
    },
    [socket, id],
  )

  const isVideoEnabled = localStream?.getVideoTracks()[0]?.enabled ?? false
  const isAudioEnabled = localStream?.getAudioTracks()[0]?.enabled ?? false

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="h-[200px] w-[300px] rounded-lg shadow-lg object-cover"
            />
            <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded text-sm">
              You ({user?.name || searchParams.get("name") || userIdRef.current})
            </div>
          </div>

          {Object.entries(remoteStreams).map(([userId, stream]) => (
            <div key={userId} className="relative">
              <video
                ref={(video) => {
                  if (video) video.srcObject = stream
                }}
                autoPlay
                className="h-[200px] w-[300px] rounded-lg shadow-lg object-cover"
              />
              <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded text-sm">
                {participants.find((p) => p.id === userId)?.name || userId}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-row justify-center mt-6 space-x-4">
          <Button
            onClick={toggleVideo}
            variant={isVideoEnabled ? "default" : "destructive"}
            className="rounded-full h-12 w-12"
          >
            {isVideoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "default" : "destructive"}
            className="rounded-full h-12 w-12"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-64 border-t">
        <ParticipantsPanel participants={participants} />
        <ChatPanel
          messages={messages}
          currentUser={userIdRef.current}
          meetingId={id as string}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  )
}

