"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
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
  isDestroyed?: boolean // Track destroyed state
  createdAt: number // Track when this peer was created
}

export function usePeerConnections({
  meetingId,
  userId,
  socket,
  isAudioOnlyMode,
  streamRef,
  audioStreamRef,
}: UsePeerConnectionsProps) {
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ])

  const [peers, setPeers] = useState<PeerConnection[]>([])
  const peersRef = useRef<PeerConnection[]>([])

  // Add a map to track peer IDs to their latest instance timestamp
  // This helps us identify outdated peer instances
  const peerTimestamps = useRef<Map<string, number>>(new Map())

  // Create a peer connection (initiator)
  const createPeer = useCallback(
    (userToSignal: string, callerId: string, stream: MediaStream) => {
      console.log(`[PeerConnections] Creating peer to connect with ${userToSignal} (initiator)`)
      console.log(`[PeerConnections] Using ${iceServers.length} ICE servers`)

      // Create timestamp for this peer instance
      const timestamp = Date.now()
      peerTimestamps.current.set(userToSignal, timestamp)

      const peer = new Peer({
        initiator: true,
        trickle: true,
        config: {
          iceServers: iceServers,
          iceCandidatePoolSize: 10,
        },
        sdpTransform: (sdp) => {
          let modifiedSdp = sdp
            .replace(/a=ice-options:trickle\s\n/g, "")
            .replace(/a=candidate.*tcp.*\r\n/g, "")
            .replace(
              /c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0/g,
              "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\nb=AS:256",
            )

          // IMPORTANT: Fix for the BUNDLE group error
          // Only modify SDP for audio-only mode if there are video tracks in the original SDP
          if (isAudioOnlyMode && sdp.includes("m=video")) {
            // Instead of removing video section entirely, disable it
            modifiedSdp = modifiedSdp.replace(
              /m=video.*\r\n/g,
              (match) => match.replace("m=video", "m=video 0"), // Set port to 0 to disable
            )
            // Keep the video section but mark it as inactive
            modifiedSdp = modifiedSdp.replace(/a=sendrecv/g, "a=inactive")
          }

          return modifiedSdp
        },
      })

      // Add stream after creation
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

      peer.on("iceStateChange", (state) => {
        console.log(`[PeerConnections] ICE state changed for ${userToSignal}:`, state)
      })

      // Add a close handler to mark this peer as destroyed
      peer.on("close", () => {
        console.log(`[PeerConnections] Peer connection with ${userToSignal} closed`)
        // Find and mark this peer as destroyed
        const peerObj = peersRef.current.find((p) => p.peerId === userToSignal && p.createdAt === timestamp)
        if (peerObj) {
          peerObj.isDestroyed = true
        }
      })

      return peer
    },
    [iceServers, isAudioOnlyMode, meetingId, socket],
  )

  // Add a peer connection (receiver)
  const addPeer = useCallback(
    (callerId: string, userId: string, incomingSignal: Peer.SignalData, stream: MediaStream) => {
      console.log(`[PeerConnections] Adding peer for ${callerId} (receiver)`)

      // Create timestamp for this peer instance
      const timestamp = Date.now()
      peerTimestamps.current.set(callerId, timestamp)

      const peer = new Peer({
        initiator: false,
        trickle: true,
        config: {
          iceServers: iceServers,
          iceCandidatePoolSize: 10,
        },
        sdpTransform: (sdp) => {
          let modifiedSdp = sdp
            .replace(/a=ice-options:trickle\s\n/g, "")
            .replace(/a=candidate.*tcp.*\r\n/g, "")
            .replace(
              /c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0/g,
              "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\nb=AS:256",
            )

          // IMPORTANT: Fix for the BUNDLE group error
          // Only modify SDP for audio-only mode if there are video tracks in the original SDP
          if (isAudioOnlyMode && sdp.includes("m=video")) {
            // Instead of removing video section entirely, disable it
            modifiedSdp = modifiedSdp.replace(
              /m=video.*\r\n/g,
              (match) => match.replace("m=video", "m=video 0"), // Set port to 0 to disable
            )
            // Keep the video section but mark it as inactive
            modifiedSdp = modifiedSdp.replace(/a=sendrecv/g, "a=inactive")
          }

          return modifiedSdp
        },
      })

      // Add stream after creation
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

      peer.on("iceStateChange", (state) => {
        console.log(`[PeerConnections] ICE state changed for ${callerId}:`, state)
      })

      // Add a close handler to mark this peer as destroyed
      peer.on("close", () => {
        console.log(`[PeerConnections] Peer connection with ${callerId} closed`)
        // Find and mark this peer as destroyed
        const peerObj = peersRef.current.find((p) => p.peerId === callerId && p.createdAt === timestamp)
        if (peerObj) {
          peerObj.isDestroyed = true
        }
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

      // Find the existing peer
      const peerToRemove = peersRef.current.find((p) => p.username === username)
      if (!peerToRemove) {
        console.error(`[PeerConnections] Cannot find peer for ${username}`)
        return
      }

      const peerId = peerToRemove.peerId

      // Mark the old peer as destroyed BEFORE destroying it
      peerToRemove.isDestroyed = true

      // Destroy the peer connection
      try {
        peerToRemove.peer.destroy()
      } catch (err) {
        console.error(`[PeerConnections] Error destroying peer for ${username}:`, err)
      }

      // Remove the old peer from our arrays
      peersRef.current = peersRef.current.filter((p) => !(p.username === username && p.peerId === peerId))
      setPeers((prev) => prev.filter((p) => !(p.username === username && p.peerId === peerId)))

      // Determine which stream to use
      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      // Only attempt reconnection if we have a stream
      if (!streamToUse) {
        console.error("[PeerConnections] Cannot reconnect: No local stream available")
        return
      }

      // Create a new peer connection
      const newPeer = createPeer(peerId, userId, streamToUse)
      const timestamp = Date.now()

      // Add the new peer to our lists
      const peerConnection = {
        peerId,
        peer: newPeer,
        username,
        createdAt: timestamp,
      }

      peersRef.current.push(peerConnection)
      setPeers((prev) => [...prev, peerConnection])

      console.log(`[PeerConnections] Reconnection attempt initiated with ${username}`)
    },
    [isAudioOnlyMode, userId, createPeer, audioStreamRef, streamRef],
  )

  // Function to safely apply a signal to a peer
  const safelySignalPeer = useCallback((peerId: string, signal: Peer.SignalData) => {
    // Get the latest timestamp for this peer ID
    const latestTimestamp = peerTimestamps.current.get(peerId)
    if (!latestTimestamp) {
      console.log(`[PeerConnections] No timestamp found for peer ${peerId}, cannot signal`)
      return false
    }

    // Find the peer with matching ID and timestamp (the latest instance)
    const peerObj = peersRef.current.find(
      (p) => p.peerId === peerId && p.createdAt === latestTimestamp && !p.isDestroyed,
    )

    if (peerObj && !peerObj.isDestroyed) {
      try {
        console.log(`[PeerConnections] Safely applying signal to peer ${peerId}`)
        peerObj.peer.signal(signal)
        return true
      } catch (err) {
        console.error(`[PeerConnections] Error applying signal to peer ${peerId}:`, err)
        // Mark as destroyed if we get an error
        peerObj.isDestroyed = true
        return false
      }
    } else {
      console.log(`[PeerConnections] Peer ${peerId} not found or is destroyed, cannot apply signal`)
      return false
    }
  }, [])

  return {
    peers,
    peersRef,
    createPeer,
    addPeer,
    handlePeerReconnect,
    safelySignalPeer, // Export the new safe signaling function
    setPeers,
    iceServers,
    setIceServers,
  }
}

