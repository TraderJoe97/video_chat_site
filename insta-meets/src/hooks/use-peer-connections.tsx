"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import Peer from "simple-peer"
import type { Socket } from "socket.io-client"

interface UsePeerConnectionsProps {
  meetingId: string
  userId: string
  username?: string
  socket: Socket | null
  isAudioOnlyMode: boolean
  streamRef: React.RefObject<MediaStream | null>
  audioStreamRef: React.RefObject<MediaStream | null>
}

export interface PeerConnection {
  peerId: string
  peer: Peer.Instance
  username: string
  isDestroyed?: boolean
  createdAt: number
}

export function usePeerConnections({
  meetingId,
  userId,
  username,
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
  const peerTimestamps = useRef<Map<string, number>>(new Map())
  const pendingCandidates = useRef<Map<string, Peer.SignalData[]>>(new Map())
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const safeSetPeers = useCallback((updater: React.SetStateAction<PeerConnection[]>) => {
    if (isMounted.current) {
      setPeers(updater)
    }
  }, [])

  // Helper to safely clean up all peer instances for a user
  const cleanupPeers = useCallback(
    (peerId: string) => {
      const peersToClean = peersRef.current.filter((p) => p.peerId === peerId)

      if (peersToClean.length > 0) {
        console.log(`[PeerConnections] Cleaning up ${peersToClean.length} peer instances for ${peerId}`)

        for (const peerToClean of peersToClean) {
          try {
            if (!peerToClean.isDestroyed) {
              peerToClean.isDestroyed = true
              peerToClean.peer.destroy()
            }
          } catch (err) {
            console.error(`[PeerConnections] Error destroying peer for ${peerId}:`, err)
          }
        }

        peersRef.current = peersRef.current.filter((p) => p.peerId !== peerId)
        safeSetPeers((prev) => prev.filter((p) => p.peerId !== peerId))
        peerTimestamps.current.delete(peerId)
        pendingCandidates.current.delete(peerId)
      }
    },
    [safeSetPeers],
  )

  // Memoize the SDP transform function
  const sdpTransform = useCallback((sdp: string, isAudioOnly: boolean) => {
    let modifiedSdp = sdp
      .replace(/a=ice-options:trickle\s\n/g, "")
      .replace(
        /c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0/g,
        "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\nb=AS:256",
      )

    if (isAudioOnly && sdp.includes("m=video")) {
      modifiedSdp = modifiedSdp.replace(
        /m=video.*\r\n/g,
        (match) => match.replace("m=video", "m=video 0"),
      )
      modifiedSdp = modifiedSdp.replace(/a=sendrecv/g, "a=inactive")
    }

    return modifiedSdp
  }, [])

  // Flush any buffered ICE candidates for a peer
  const flushPendingCandidates = useCallback((peerId: string, peer: Peer.Instance) => {
    const queue = pendingCandidates.current.get(peerId)
    if (queue && queue.length > 0) {
      console.log(`[PeerConnections] Flushing ${queue.length} buffered ICE candidates for ${peerId}`)
      queue.forEach((candidate) => {
        try {
          peer.signal(candidate)
        } catch (err) {
          console.warn(`[PeerConnections] Error applying buffered candidate to ${peerId}:`, err)
        }
      })
      pendingCandidates.current.delete(peerId)
    }
  }, [])

  // Create a peer connection (initiator)
  const createPeer = useCallback(
    (userToSignal: string, callerId: string, stream: MediaStream, peerUsername?: string) => {
      // Clean up existing peer for this user to avoid stale connections
      const existing = peersRef.current.find((p) => p.peerId === userToSignal && !p.isDestroyed)
      if (existing) {
        console.log(`[PeerConnections] Existing peer found for ${userToSignal}, cleaning up before re-creating`)
        cleanupPeers(userToSignal)
      }

      const timestamp = Date.now()
      peerTimestamps.current.set(userToSignal, timestamp)
      console.log(`[PeerConnections] Creating new peer for ${userToSignal} (initiator)`)

      try {
        const peer = new Peer({
          initiator: true,
          trickle: true,
          config: {
            iceServers: iceServers,
            iceCandidatePoolSize: 10,
          },
          sdpTransform: (sdp) => sdpTransform(sdp, isAudioOnlyMode),
        })

        // Add local media stream
        peer.addStream(stream)

        // Handle signals (SDP offer & ICE candidates)
        peer.on("signal", (signal) => {
          if (signal.type === "offer") {
            console.log(`[PeerConnections] Sending offer to ${userToSignal}`)
            socket?.emit("offer", {
              meetingId,
              targetUserId: userToSignal,
              userId: userToSignal,
              callerId,
              callerUsername: username || callerId,
              offer: signal,
            })
          } else if ("candidate" in signal && signal.candidate) {
            socket?.emit("candidate", {
              meetingId,
              targetUserId: userToSignal,
              userId: userToSignal,
              callerId,
              candidate: signal.candidate,
            })
          }
        })

        peer.on("connect", () => {
          console.log(`[PeerConnections] WebRTC connected with ${userToSignal}`)
          try {
            peer.send(JSON.stringify({ type: "connection-established", from: callerId }))
          } catch (err) {
            console.error(`[PeerConnections] Error sending test data to ${userToSignal}:`, err)
          }
        })

        peer.on("error", (err) => {
          console.error(`[PeerConnections] Peer error with ${userToSignal}:`, err.message)
        })

        peer.on("close", () => {
          console.log(`[PeerConnections] Peer connection with ${userToSignal} closed`)
          cleanupPeers(userToSignal)
        })

        const peerConnection: PeerConnection = {
          peerId: userToSignal,
          peer,
          username: peerUsername || userToSignal,
          createdAt: timestamp,
          isDestroyed: false,
        }

        peersRef.current = [...peersRef.current.filter((p) => p.peerId !== userToSignal), peerConnection]
        safeSetPeers([...peersRef.current])

        return peer
      } catch (err) {
        console.error(`[PeerConnections] Error creating peer for ${userToSignal}:`, err)
        return null
      }
    },
    [iceServers, isAudioOnlyMode, meetingId, socket, username, sdpTransform, safeSetPeers, cleanupPeers],
  )

  // Add a peer connection (receiver / answering)
  const addPeer = useCallback(
    (callerId: string, currentUserId: string, incomingSignal: Peer.SignalData, stream: MediaStream, callerUsername?: string) => {
      // Clean up existing peer for caller if any
      const existing = peersRef.current.find((p) => p.peerId === callerId && !p.isDestroyed)
      if (existing) {
        console.log(`[PeerConnections] Existing peer found for ${callerId}, cleaning up before answering`)
        cleanupPeers(callerId)
      }

      const timestamp = Date.now()
      peerTimestamps.current.set(callerId, timestamp)
      console.log(`[PeerConnections] Adding answering peer for ${callerId} (receiver)`)

      try {
        const peer = new Peer({
          initiator: false,
          trickle: true,
          config: {
            iceServers: iceServers,
            iceCandidatePoolSize: 10,
          },
          sdpTransform: (sdp) => sdpTransform(sdp, isAudioOnlyMode),
        })

        peer.addStream(stream)

        peer.on("signal", (signal) => {
          if (signal.type === "answer") {
            console.log(`[PeerConnections] Sending answer to ${callerId}`)
            socket?.emit("answer", {
              meetingId,
              targetUserId: callerId,
              callerId: currentUserId,
              userId: currentUserId,
              answer: signal,
            })
          } else if ("candidate" in signal && signal.candidate) {
            socket?.emit("candidate", {
              meetingId,
              targetUserId: callerId,
              callerId: currentUserId,
              userId: currentUserId,
              candidate: signal.candidate,
            })
          }
        })

        peer.on("connect", () => {
          console.log(`[PeerConnections] WebRTC connected with ${callerId}`)
          try {
            peer.send(JSON.stringify({ type: "connection-established", from: currentUserId }))
          } catch (err) {
            console.error(`[PeerConnections] Error sending test data to ${callerId}:`, err)
          }
        })

        peer.on("error", (err) => {
          console.error(`[PeerConnections] Receiver peer error with ${callerId}:`, err.message)
        })

        peer.on("close", () => {
          console.log(`[PeerConnections] Receiver peer closed for ${callerId}`)
          cleanupPeers(callerId)
        })

        const peerConnection: PeerConnection = {
          peerId: callerId,
          peer,
          username: callerUsername || callerId,
          createdAt: timestamp,
          isDestroyed: false,
        }

        peersRef.current = [...peersRef.current.filter((p) => p.peerId !== callerId), peerConnection]
        safeSetPeers([...peersRef.current])

        // Process the incoming offer
        peer.signal(incomingSignal)

        // Flush any pending candidates received before peer creation
        flushPendingCandidates(callerId, peer)

        return peer
      } catch (err) {
        console.error(`[PeerConnections] Error adding peer for ${callerId}:`, err)
        return null
      }
    },
    [iceServers, isAudioOnlyMode, meetingId, socket, sdpTransform, safeSetPeers, cleanupPeers, flushPendingCandidates],
  )

  // Safely apply incoming signal (answer or candidate) to an existing peer
  const safelySignalPeer = useCallback((peerId: string, signal: Peer.SignalData) => {
    if (!isMounted.current) return false

    const peerObj = peersRef.current.find((p) => p.peerId === peerId && !p.isDestroyed)

    if (peerObj && peerObj.peer) {
      try {
        peerObj.peer.signal(signal)
        return true
      } catch (err) {
        console.error(`[PeerConnections] Error signaling peer ${peerId}:`, err)
        return false
      }
    } else {
      // If peer is not yet created and signal is a candidate, buffer it
      if ("candidate" in signal && signal.candidate) {
        console.log(`[PeerConnections] Buffering ICE candidate for peer ${peerId} (not created yet)`)
        const existingQueue = pendingCandidates.current.get(peerId) || []
        existingQueue.push(signal)
        pendingCandidates.current.set(peerId, existingQueue)
      } else {
        console.log(`[PeerConnections] Peer ${peerId} not found or destroyed; ignoring signal`)
      }
      return false
    }
  }, [])

  // Handle peer reconnection
  const handlePeerReconnect = useCallback(
    (usernameToReconnect: string) => {
      console.log(`[PeerConnections] Reconnecting peer: ${usernameToReconnect}`)

      const peerToRemove = peersRef.current.find((p) => p.username === usernameToReconnect)
      if (!peerToRemove) return

      const peerId = peerToRemove.peerId
      cleanupPeers(peerId)

      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current
      if (!streamToUse) {
        console.error("[PeerConnections] Cannot reconnect: No local stream available")
        return
      }

      setTimeout(() => {
        if (!isMounted.current) return
        createPeer(peerId, userId, streamToUse, usernameToReconnect)
      }, 500)
    },
    [isAudioOnlyMode, userId, audioStreamRef, streamRef, cleanupPeers, createPeer],
  )

  // Centralized Socket signaling listeners
  useEffect(() => {
    if (!socket || !userId) return

    console.log("[PeerConnections] Subscribing to WebRTC signaling socket events")

    const handleOffer = (data: { callerId: string; offer: Peer.SignalData; callerUsername?: string }) => {
      console.log(`[PeerConnections] Received offer from ${data.callerId} (${data.callerUsername || "unknown"})`)
      
      // Defensively check if this is actually a candidate or answer signal mislabeled as offer
      if (data.offer && (data.offer.type === "answer" || ("candidate" in data.offer && data.offer.candidate))) {
        console.log(`[PeerConnections] Misrouted signal in offer event, redirecting to safelySignalPeer`)
        safelySignalPeer(data.callerId, data.offer)
        return
      }

      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current
      if (!streamToUse) {
        console.warn(`[PeerConnections] No stream available to answer offer from ${data.callerId}`)
        return
      }
      addPeer(data.callerId, userId, data.offer, streamToUse, data.callerUsername)
    }

    const handleAnswer = (data: { callerId: string; answer: Peer.SignalData }) => {
      console.log(`[PeerConnections] Received answer from ${data.callerId}`)
      safelySignalPeer(data.callerId, data.answer)
    }

    const handleCandidate = (data: { callerId: string; candidate: any }) => {
      if (!data || !data.candidate) return

      let candidateObj = data.candidate

      // If nested inside an extra candidate wrapper { candidate: { candidate: "...", sdpMid: ... } }
      if (
        typeof candidateObj === "object" &&
        candidateObj !== null &&
        typeof candidateObj.candidate === "object" &&
        candidateObj.candidate !== null
      ) {
        candidateObj = candidateObj.candidate
      }

      // If it's a raw string (e.g. "candidate:..."), construct a valid RTCIceCandidateInit object
      if (typeof candidateObj === "string") {
        candidateObj = {
          candidate: candidateObj,
          sdpMid: "0",
          sdpMLineIndex: 0,
        }
      }

      const signalPayload: Peer.SignalData = {
        type: "candidate",
        candidate: candidateObj,
      }
      safelySignalPeer(data.callerId, signalPayload)
    }

    socket.on("offer", handleOffer)
    socket.on("answer", handleAnswer)
    socket.on("candidate", handleCandidate)

    return () => {
      console.log("[PeerConnections] Unsubscribing from WebRTC signaling socket events")
      socket.off("offer", handleOffer)
      socket.off("answer", handleAnswer)
      socket.off("candidate", handleCandidate)
    }
  }, [socket, userId, isAudioOnlyMode, audioStreamRef, streamRef, addPeer, safelySignalPeer])

  // Update peer usernames when participant list updates
  const updatePeerUsernames = useCallback(
    (participants: Array<{ id: string; name: string }>) => {
      let updated = false
      participants.forEach((participant) => {
        const peerObj = peersRef.current.find((p) => p.peerId === participant.id)
        if (peerObj && peerObj.username !== participant.name) {
          peerObj.username = participant.name
          updated = true
        }
      })
      if (updated) {
        safeSetPeers([...peersRef.current])
      }
    },
    [safeSetPeers],
  )

  return {
    peers,
    peersRef,
    createPeer,
    addPeer,
    cleanupPeers,
    handlePeerReconnect,
    safelySignalPeer,
    setPeers: safeSetPeers,
    iceServers,
    setIceServers,
    updatePeerUsernames,
  }
}
