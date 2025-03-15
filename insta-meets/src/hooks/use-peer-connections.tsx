"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import Peer from "simple-peer"
import type { Socket } from "socket.io-client"

interface UsePeerConnectionsProps {
  meetingId: string
  userId: string
  socket: Socket | null
  isAudioOnlyMode: boolean
  streamRef: React.RefObject<MediaStream | null>
  audioStreamRef: React.RefObject<MediaStream | null>
}

interface PeerConnection {
  peerId: string
  peer: Peer.Instance
  username: string
}

export function usePeerConnections({
  meetingId,
  userId,
  socket,
  isAudioOnlyMode,
  streamRef,
  audioStreamRef,
}: UsePeerConnectionsProps) {
  // Initialize with default STUN servers to ensure we have something before the fetch completes
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ])

  const [peers, setPeers] = useState<PeerConnection[]>([])
  const peersRef = useRef<PeerConnection[]>([])

  // Log when ICE servers change
  useEffect(() => {
    console.log("[PeerConnections] ICE servers updated:", iceServers)
  }, [iceServers])

  // Create a peer connection (initiator)
  const createPeer = useCallback(
    (userToSignal: string, callerId: string, stream: MediaStream) => {
      console.log(`[PeerConnections] Creating peer to connect with ${userToSignal} (initiator)`)
      console.log(`[PeerConnections] Using ${iceServers.length} ICE servers`)

      const peer = new Peer({
        initiator: true,
        trickle: true, // Enable trickle ICE for better connectivity
        config: {
          iceServers: iceServers,
          iceCandidatePoolSize: 10,
        },
        // Increase connection timeout
        sdpTransform: (sdp) => {
          // Modify SDP to prioritize UDP and reduce video bitrate for more stable connections
          let modifiedSdp = sdp
            .replace(/a=ice-options:trickle\s\n/g, "")
            // Prioritize UDP candidates
            .replace(/a=candidate.*tcp.*\r\n/g, "")
            // Add b=AS to limit bandwidth for more stable connections
            .replace(
              /c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0/g,
              "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\nb=AS:256",
            )

          // If audio only mode, remove video codecs
          if (isAudioOnlyMode) {
            modifiedSdp = modifiedSdp
              .replace(/m=video.*\r\n/g, "")
              .replace(/a=rtpmap:.*VP8.*\r\n/g, "")
              .replace(/a=rtpmap:.*VP9.*\r\n/g, "")
              .replace(/a=rtpmap:.*H264.*\r\n/g, "")
          }

          return modifiedSdp
        },
      })

      // Add stream after creation to ensure proper setup
      console.log(`[PeerConnections] Adding stream to peer for ${userToSignal}`)
      peer.addStream(stream)

      peer.on("signal", (signal) => {
        console.log(`[PeerConnections] Generated offer signal for ${userToSignal}`)
        socket?.emit("offer", {
          meetingId,
          userId: userToSignal,
          callerId,
          offer: signal,
        })
      })

      peer.on("connect", () => {
        console.log(`[PeerConnections] Peer connection established with ${userToSignal}`)
      })

      peer.on("error", (err) => {
        console.error(`[PeerConnections] Peer error with ${userToSignal}:`, err.message)
      })

      // Add connection state change handler
      peer.on("iceStateChange", (state) => {
        console.log(`[PeerConnections] ICE state changed for ${userToSignal}:`, state)
      })

      return peer
    },
    [iceServers, isAudioOnlyMode, meetingId, socket],
  )

  // Add a peer connection (receiver)
  const addPeer = useCallback(
    (callerId: string, userId: string, incomingSignal: Peer.SignalData, stream: MediaStream) => {
      console.log(`[PeerConnections] Adding peer for ${callerId} (receiver)`)
      console.log(`[PeerConnections] Using ${iceServers.length} ICE servers`)

      const peer = new Peer({
        initiator: false,
        trickle: true, // Enable trickle ICE for better connectivity
        config: {
          iceServers: iceServers,
          iceCandidatePoolSize: 10,
        },
        // Increase connection timeout
        sdpTransform: (sdp) => {
          // Modify SDP to prioritize UDP and reduce video bitrate for more stable connections
          let modifiedSdp = sdp
            .replace(/a=ice-options:trickle\s\n/g, "")
            // Prioritize UDP candidates
            .replace(/a=candidate.*tcp.*\r\n/g, "")
            // Add b=AS to limit bandwidth for more stable connections
            .replace(
              /c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0/g,
              "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\nb=AS:256",
            )

          // If audio only mode, remove video codecs
          if (isAudioOnlyMode) {
            modifiedSdp = modifiedSdp
              .replace(/m=video.*\r\n/g, "")
              .replace(/a=rtpmap:.*VP8.*\r\n/g, "")
              .replace(/a=rtpmap:.*VP9.*\r\n/g, "")
              .replace(/a=rtpmap:.*H264.*\r\n/g, "")
          }

          return modifiedSdp
        },
      })

      // Add stream after creation to ensure proper setup
      console.log(`[PeerConnections] Adding stream to peer for ${callerId}`)
      peer.addStream(stream)

      peer.on("signal", (signal) => {
        console.log(`[PeerConnections] Generated answer signal for ${callerId}`)
        socket?.emit("answer", {
          meetingId,
          callerId,
          userId,
          answer: signal,
        })
      })

      peer.on("connect", () => {
        console.log(`[PeerConnections] Peer connection established with ${callerId}`)
      })

      peer.on("error", (err) => {
        console.error(`[PeerConnections] Peer error with ${callerId}:`, err.message)
      })

      // Add connection state change handler
      peer.on("iceStateChange", (state) => {
        console.log(`[PeerConnections] ICE state changed for ${callerId}:`, state)
      })

      // Process the incoming signal
      console.log(`[PeerConnections] Processing incoming signal from ${callerId}`)
      peer.signal(incomingSignal)

      return peer
    },
    [iceServers, isAudioOnlyMode, meetingId, socket],
  )

  // Function to handle peer reconnection
  const handlePeerReconnect = useCallback(
    (username: string) => {
      console.log(`[PeerConnections] Attempting to reconnect with peer: ${username}`)

      // Find and remove the existing peer
      const peerToRemove = peersRef.current.find((p) => p.username === username)
      if (peerToRemove) {
        peerToRemove.peer.destroy()
      }

      const peerId = peerToRemove?.peerId
      if (!peerId) {
        console.error(`[PeerConnections] Cannot find peer ID for ${username}`)
        return
      }

      peersRef.current = peersRef.current.filter((p) => p.username !== username)
      setPeers((prev) => prev.filter((p) => p.username !== username))

      // Determine which stream to use
      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      // Only attempt reconnection if we have a stream
      if (!streamToUse) {
        console.error("[PeerConnections] Cannot reconnect: No local stream available")
        return
      }

      // Create a new peer connection
      const newPeer = createPeer(peerId, userId, streamToUse)

      // Add the new peer to our lists
      const peerConnection = {
        peerId,
        peer: newPeer,
        username,
      }

      peersRef.current.push(peerConnection)
      setPeers((prev) => [...prev, peerConnection])

      console.log(`[PeerConnections] Reconnection attempt initiated with ${username}`)
    },
    [isAudioOnlyMode, userId, createPeer, audioStreamRef, streamRef],
  )

  return {
    peers,
    peersRef,
    createPeer,
    addPeer,
    handlePeerReconnect,
    setPeers,
    iceServers,
    setIceServers,
  }
}

