"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useAuth0 } from "@auth0/auth0-react"
import Peer from "simple-peer"
import { useSocket } from "@/contexts/SocketContext"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, VideoIcon, VideoOff } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { ParticipantsPanel } from "@/components/participants-panel"
import { toast } from "sonner"

interface UserJoinedData {
  userId: string
  socketId: string
  stream: MediaStream
  username: string // Added username property
}

interface SignalData {
  from: string
  signal: Peer.SignalData
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
  const [peers, setPeers] = useState<Record<string, Peer.Instance>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const peersRef = useRef<Record<string, Peer.Instance>>({})
  const userIdRef = useRef<string>("")

  const localVideoRef = useRef<HTMLVideoElement>(null)

  const createPeer = useCallback(
    (userId: string, socketId: string, stream: MediaStream) => {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream,
      })

      peer.on("signal", (data: Peer.SignalData) => {
        socket?.emit("signal", {
          to: userId,
          from: userIdRef.current,
          signal: data,
        })
      })

      peer.on("stream", (remoteStream: MediaStream) => {
        setRemoteStreams((prevStreams) => ({
          ...prevStreams,
          [userId]: remoteStream,
        }))
      })

      peer.on("error", (err: Error) => {
        console.error("Error in peer connection:", err)
      })

      peer.on("close", () => {
        setPeers((prevPeers) => {
          const newPeers = { ...prevPeers }
          delete newPeers[userId]
          return newPeers
        })
        setRemoteStreams((prevStreams) => {
          const newStreams = { ...prevStreams }
          delete newStreams[userId]
          return newStreams
        })
      })

      return peer
    },
    [socket],
  )

  useEffect(() => {
    if (!isAuthenticated && !searchParams.get("name")) {
      const name = prompt("Please enter your name to join the meeting", "Guest")
      if (name) userIdRef.current = name
    }

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        if (socket && isConnected) {
          socket.emit("join-room", {
            meetingId: id,
            userId: userIdRef.current,
            username: user?.name || userIdRef.current,
          })

          socket.on("userJoined", (data: UserJoinedData) => {
            const { userId, socketId, stream, username } = data
            if (userIdRef.current !== userId) {
              const peer = createPeer(userId, socketId, stream)
              peersRef.current = { ...peersRef.current, [userId]: peer }
              setPeers(peersRef.current)
              setParticipants((prev) => [...prev, { id: userId, name: username }])
            }
          })

          socket.on("signal", (data: SignalData) => {
            const { from, signal } = data
            const peer = peersRef.current[from]
            if (peer) {
              peer.signal(signal)
            }
          })

          socket.on("userLeft", (userId: string) => {
            setPeers((prevPeers) => {
              const newPeers = { ...prevPeers }
              delete newPeers[userId]
              return newPeers
            })
            setParticipants((prev) => prev.filter((p) => p.id !== userId))
            setRemoteStreams((prevStreams) => {
              const newStreams = { ...prevStreams }
              delete newStreams[userId]
              return newStreams
            })
          })

          socket.on("chatMessage", (message: Message) => {
            setMessages((prev) => [...prev, message])
          })
        }
      } catch (error) {
        console.error("Error initializing meeting:", error)
        toast.error("Could not access camera or microphone. Please check permissions.")
      }
    }

    init()

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy())
      if (socket) {
        socket.off("userJoined")
        socket.off("signal")
        socket.off("userLeft")
        socket.off("chatMessage")
      }
    }
  }, [id, isAuthenticated, searchParams, user, createPeer, socket, isConnected])

  const muteVideo = useCallback((userId: string) => {
    const peer = peers[userId]
    if (peer && peer.streams[0]) {
      const videoTrack = peer.streams[0].getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
      }
    }
  }, [peers])

  const muteAudio = useCallback((userId: string) => {
    const peer = peers[userId]
    if (peer && peer.streams[0]) {
      const audioTrack = peer.streams[0].getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }, [peers])

  const videoButton = useMemo(() => (
    <Button onClick={() => muteVideo(userIdRef.current)} className="rounded-full h-12 w-12">
      {localStream?.getVideoTracks()[0]?.enabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
    </Button>
  ), [localStream, muteVideo])

  const audioButton = useMemo(() => (
    <Button onClick={() => muteAudio(userIdRef.current)} className="rounded-full h-12 w-12">
      {localStream?.getAudioTracks()[0]?.enabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
    </Button>
  ), [localStream, muteAudio])

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <video ref={localVideoRef} autoPlay muted className="h-[200px] w-[200px] md:h-[300px] md:w-[300px] rounded-lg shadow-lg" />
        <div className="flex flex-row justify-between mt-4 space-x-2">
          {videoButton}
          {audioButton}
        </div>
      </div>
      <div className="flex flex-col md:flex-row h-full">
        <ParticipantsPanel participants={participants}  />
        <ChatPanel messages={messages} currentUser={userIdRef.current} meetingId={id}  />
      </div>
      <div className="flex flex-wrap justify-center p-4">
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <video
            key={userId}
            ref={(video) => {
              if (video) {
                video.srcObject = stream;
              }
            }}
            autoPlay
            className="h-[200px] w-[200px] md:h-[300px] md:w-[300px] rounded-lg shadow-lg m-2"
          />
        ))}
      </div>
    </div>
  )
}