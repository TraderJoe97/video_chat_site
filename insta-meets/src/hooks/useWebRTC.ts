"use client"

import { useEffect, useState, useRef } from "react"
import { io, type Socket } from "socket.io-client"

const useWebRTC = (roomId: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const socketRef = useRef<Socket | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  useEffect(() => {
    socketRef.current = io("https://video-chat-backend-pd1m.onrender.com")
    const socket = socketRef.current

    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setLocalStream(stream)
        socket.emit("join-room", roomId)
      } catch (error) {
        console.error("Error accessing media devices:", error)
      }
    }
    startStream()

    socket.on("user-connected", (userId: string) => {
      createPeerConnection(userId)
    })

    socket.on("existing-users", (users: string[]) => {
      users.forEach(createPeerConnection)
    })

    socket.on("offer", async ({ from, offer }) => {
      const pc = getPeerConnection(from)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit("answer", { target: from, answer })
    })

    socket.on("answer", async ({ from, answer }) => {
      const pc = getPeerConnection(from)
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    })

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = getPeerConnection(from)
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    })

    socket.on("user-disconnected", (userId: string) => {
      if (peerConnectionsRef.current.has(userId)) {
        peerConnectionsRef.current.get(userId)?.close()
        peerConnectionsRef.current.delete(userId)
      }
      setRemoteStreams((prev) => {
        const newStreams = new Map(prev)
        newStreams.delete(userId)
        return newStreams
      })
    })

    return () => {
      socket.disconnect()
      peerConnectionsRef.current.forEach((pc) => pc.close())
    }
  }, [roomId])

  const createPeerConnection = (userId: string) => {
    const pc = new RTCPeerConnection()
    peerConnectionsRef.current.set(userId, pc)

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const newStreams = new Map(prev)
        newStreams.set(userId, event.streams[0])
        return newStreams
      })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", { target: userId, candidate: event.candidate })
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current?.emit("offer", { target: userId, offer })
      } catch (error) {
        console.error("Error creating offer:", error)
      }
    }

    return pc
  }

  const getPeerConnection = (userId: string) => {
    if (!peerConnectionsRef.current.has(userId)) {
      createPeerConnection(userId)
    }
    return peerConnectionsRef.current.get(userId)!
  }

  return { localStream, remoteStreams }
}

export default useWebRTC

