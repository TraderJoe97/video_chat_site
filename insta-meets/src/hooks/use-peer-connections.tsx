"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import Peer from "simple-peer"
import type { Socket } from "socket.io-client"
import { toast } from "sonner"

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
  isDestroyed?: boolean
  createdAt: number
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

  // Add a map to track peer IDs to their latest instance timestamp
  // This helps us identify outdated peer instances
  const peerTimestamps = useRef<Map<string, number>>(new Map())

  // Add a map to track connection attempts to prevent excessive reconnections
  const connectionAttempts = useRef<Map<string, number>>(new Map())
  const MAX_CONNECTION_ATTEMPTS = 3

  // Add a debounce mechanism to prevent creating multiple peers for the same user
  const peerCreationInProgress = useRef<Set<string>>(new Set())

  // Track if socket event handlers have been registered to prevent duplicate handlers
  const socketHandlersRegistered = useRef<boolean>(false)

  // Track if the component is mounted to prevent state updates after unmount
  const isMounted = useRef(true)

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Safe state setter that checks if component is still mounted
  const safeSetPeers = useCallback((updater: React.SetStateAction<PeerConnection[]>) => {
    if (isMounted.current) {
      setPeers(updater)
    }
  }, [])

  // Log when ICE servers change
  useEffect(() => {
    console.log("[PeerConnections] ICE servers updated:", iceServers)
  }, [iceServers])

  // Helper to clean up old peers for a user
  const cleanupOldPeers = useCallback(
    (peerId: string) => {
      // Find all peers for this user
      const oldPeers = peersRef.current.filter((p) => p.peerId === peerId)

      // Keep only the newest one
      if (oldPeers.length > 1) {
        console.log(`[PeerConnections] Cleaning up ${oldPeers.length - 1} old peer instances for ${peerId}`)

        // Sort by creation time (newest first)
        oldPeers.sort((a, b) => b.createdAt - a.createdAt)

        // Mark all but the newest as destroyed
        for (let i = 1; i < oldPeers.length; i++) {
          oldPeers[i].isDestroyed = true
          try {
            oldPeers[i].peer.destroy()
          } catch (err) {
            console.error(`[PeerConnections] Error destroying old peer for ${peerId}:`, err)
          }
        }

        // Update the refs and state
        peersRef.current = peersRef.current.filter((p) => p.peerId !== peerId || p.createdAt === oldPeers[0].createdAt)

        safeSetPeers((prev) => prev.filter((p) => p.peerId !== peerId || p.createdAt === oldPeers[0].createdAt))
      }
    },
    [safeSetPeers],
  )

  // Memoize the SDP transform function to prevent recreating it on each render
  const sdpTransform = useCallback((sdp: string, isAudioOnly: boolean) => {
    // Modify SDP to prioritize UDP and reduce video bitrate for more stable connections
    let modifiedSdp = sdp
      // Remove trickle option to ensure all ICE candidates are gathered before sending
      .replace(/a=ice-options:trickle\s\n/g, "")
      // Add b=AS to limit bandwidth for more stable connections
      .replace(
        /c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0/g,
        "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\nb=AS:256",
      )

    // Handle audio-only mode
    if (isAudioOnly && sdp.includes("m=video")) {
      // Instead of removing video section entirely, disable it
      modifiedSdp = modifiedSdp.replace(
        /m=video.*\r\n/g,
        (match) => match.replace("m=video", "m=video 0"), // Set port to 0 to disable
      )
      // Keep the video section but mark it as inactive
      modifiedSdp = modifiedSdp.replace(/a=sendrecv/g, "a=inactive")
    }

    return modifiedSdp
  }, [])

  // Create a peer connection (initiator) - memoized to prevent recreation on render
  const createPeer = useCallback(
    (userToSignal: string, callerId: string, stream: MediaStream) => {
      // Prevent creating multiple peers for the same user simultaneously
      if (peerCreationInProgress.current.has(userToSignal)) {
        console.log(`[PeerConnections] Peer creation already in progress for ${userToSignal}, skipping`)
        return null
      }

      // Check if we already have a non-destroyed peer for this user
      const existingPeer = peersRef.current.find((p) => p.peerId === userToSignal && !p.isDestroyed)
      if (existingPeer) {
        console.log(`[PeerConnections] Already have an active peer for ${userToSignal}, reusing`)
        return existingPeer.peer
      }

      peerCreationInProgress.current.add(userToSignal)

      console.log(`[PeerConnections] Creating peer to connect with ${userToSignal} (initiator)`)
      console.log(`[PeerConnections] Using ${iceServers.length} ICE servers`)

      // Create timestamp for this peer instance
      const timestamp = Date.now()
      peerTimestamps.current.set(userToSignal, timestamp)

      // Clean up any old peer instances for this user
      cleanupOldPeers(userToSignal)

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

        // Add stream after creation to ensure proper setup
        console.log(`[PeerConnections] Adding stream to peer for ${userToSignal}`)
        peer.addStream(stream)

        // Set a timeout to detect stalled connections
        const connectionTimeout = setTimeout(() => {
          if (peer && !peer.connected && !peer.destroyed) {
            console.log(`[PeerConnections] Connection to ${userToSignal} timed out, destroying peer`)
            peer.destroy()

            // Remove from in-progress set
            peerCreationInProgress.current.delete(userToSignal)

            // Increment connection attempts
            const attempts = (connectionAttempts.current.get(userToSignal) || 0) + 1
            connectionAttempts.current.set(userToSignal, attempts)

            if (attempts < MAX_CONNECTION_ATTEMPTS) {
              console.log(`[PeerConnections] Retrying connection to ${userToSignal} (attempt ${attempts})`)
              // Wait a bit before retrying
              setTimeout(() => {
                const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current
                if (streamToUse && isMounted.current) {
                  createPeer(userToSignal, callerId, streamToUse)
                }
              }, 2000)
            } else {
              console.log(`[PeerConnections] Max connection attempts reached for ${userToSignal}`)
              if (isMounted.current) {
                toast.error(`Could not connect to ${userToSignal} after multiple attempts`)
              }
            }
          }
        }, 15000) // 15 seconds timeout

        // Use a single signal handler to prevent multiple offers
        let hasSignaled = false
        peer.on("signal", (signal) => {
          // Only send the first offer signal to prevent duplicates
          if (signal.type === "offer" && hasSignaled) {
            console.log(`[PeerConnections] Ignoring duplicate offer signal for ${userToSignal}`)
            return
          }

          if (signal.type === "offer") {
            hasSignaled = true
          }

          console.log(`[PeerConnections] Generated ${signal.type} signal for ${userToSignal}`)
          socket?.emit("offer", {
            meetingId,
            userId: userToSignal,
            callerId,
            offer: signal,
          })
        })

        peer.on("connect", () => {
          console.log(`[PeerConnections] Peer connection established with ${userToSignal}`)
          clearTimeout(connectionTimeout)

          // Reset connection attempts on successful connection
          connectionAttempts.current.delete(userToSignal)

          // Remove from in-progress set
          peerCreationInProgress.current.delete(userToSignal)

          // Send a test data message to confirm connection
          try {
            peer.send(JSON.stringify({ type: "connection-established", from: callerId }))
          } catch (err) {
            console.error(`[PeerConnections] Error sending test data to ${userToSignal}:`, err)
          }
        })

        peer.on("error", (err) => {
          console.error(`[PeerConnections] Peer error with ${userToSignal}:`, err.message)
          clearTimeout(connectionTimeout)

          // Remove from in-progress set
          peerCreationInProgress.current.delete(userToSignal)
        })

        // Add connection state change handler
        peer.on("iceStateChange", (state) => {
          console.log(`[PeerConnections] ICE state changed for ${userToSignal}:`, state)

          // If we reach failed state, try to reconnect
          if (state === "failed") {
            console.log(`[PeerConnections] ICE connection failed for ${userToSignal}, attempting recovery`)

            // Increment connection attempts
            const attempts = (connectionAttempts.current.get(userToSignal) || 0) + 1
            connectionAttempts.current.set(userToSignal, attempts)

            if (attempts < MAX_CONNECTION_ATTEMPTS) {
              // Destroy the current peer
              peer.destroy()

              // Wait a bit before retrying
              setTimeout(() => {
                const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current
                if (streamToUse && isMounted.current) {
                  createPeer(userToSignal, callerId, streamToUse)
                }
              }, 2000)
            }
          }
        })

        // Add a close handler to mark this peer as destroyed
        peer.on("close", () => {
          console.log(`[PeerConnections] Peer connection with ${userToSignal} closed`)
          // Find and mark this peer as destroyed
          const peerObj = peersRef.current.find((p) => p.peerId === userToSignal && p.createdAt === timestamp)
          if (peerObj) {
            peerObj.isDestroyed = true
          }

          // Remove from in-progress set
          peerCreationInProgress.current.delete(userToSignal)
        })

        // Handle data channel messages
        peer.on("data", (data) => {
          try {
            const message = JSON.parse(data.toString())
            console.log(`[PeerConnections] Received data from ${userToSignal}:`, message)
          } catch (err) {
            console.error(`[PeerConnections] Error parsing data from ${userToSignal}:`, err)
          }
        })

        // Store the new peer in our refs and state
        const peerConnection = {
          peerId: userToSignal,
          peer,
          username: userToSignal, // Will be updated later when we get the actual username
          createdAt: timestamp,
        }

        peersRef.current.push(peerConnection)
        safeSetPeers((prev) => [...prev, peerConnection])

        return peer
      } catch (err) {
        console.error(`[PeerConnections] Error creating peer for ${userToSignal}:`, err)
        peerCreationInProgress.current.delete(userToSignal)
        return null
      }
    },
    [
      iceServers,
      isAudioOnlyMode,
      meetingId,
      socket,
      cleanupOldPeers,
      audioStreamRef,
      streamRef,
      sdpTransform,
      safeSetPeers,
    ],
  )

  // Add a peer connection (receiver) - memoized to prevent recreation on render
  const addPeer = useCallback(
    (callerId: string, userId: string, incomingSignal: Peer.SignalData, stream: MediaStream) => {
      // Prevent creating multiple peers for the same user simultaneously
      if (peerCreationInProgress.current.has(callerId)) {
        console.log(`[PeerConnections] Peer creation already in progress for ${callerId}, skipping`)
        return null
      }

      // Check if we already have a non-destroyed peer for this user
      const existingPeer = peersRef.current.find((p) => p.peerId === callerId && !p.isDestroyed)
      if (existingPeer) {
        console.log(`[PeerConnections] Already have an active peer for ${callerId}, applying signal`)
        try {
          existingPeer.peer.signal(incomingSignal)
          return existingPeer.peer
        } catch (err) {
          console.error(`[PeerConnections] Error applying signal to existing peer for ${callerId}:`, err)
          // Continue to create a new peer if signal application fails
        }
      }

      peerCreationInProgress.current.add(callerId)

      console.log(`[PeerConnections] Adding peer for ${callerId} (receiver)`)
      console.log(`[PeerConnections] Using ${iceServers.length} ICE servers`)

      // Create timestamp for this peer instance
      const timestamp = Date.now()
      peerTimestamps.current.set(callerId, timestamp)

      // Clean up any old peer instances for this user
      cleanupOldPeers(callerId)

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

        // Add stream after creation to ensure proper setup
        console.log(`[PeerConnections] Adding stream to peer for ${callerId}`)
        peer.addStream(stream)

        // Set a timeout to detect stalled connections
        const connectionTimeout = setTimeout(() => {
          if (peer && !peer.connected && !peer.destroyed) {
            console.log(`[PeerConnections] Connection to ${callerId} timed out, destroying peer`)
            peer.destroy()

            // Remove from in-progress set
            peerCreationInProgress.current.delete(callerId)
          }
        }, 15000) // 15 seconds timeout

        // Use a single signal handler to prevent multiple answers
        let hasSignaled = false
        peer.on("signal", (signal) => {
          // Only send the first answer signal to prevent duplicates
          if (signal.type === "answer" && hasSignaled) {
            console.log(`[PeerConnections] Ignoring duplicate answer signal for ${callerId}`)
            return
          }

          if (signal.type === "answer") {
            hasSignaled = true
          }

          console.log(`[PeerConnections] Generated ${signal.type} signal for ${callerId}`)
          socket?.emit("answer", {
            meetingId,
            callerId,
            userId,
            answer: signal,
          })
        })

        peer.on("connect", () => {
          console.log(`[PeerConnections] Peer connection established with ${callerId}`)
          clearTimeout(connectionTimeout)

          // Reset connection attempts on successful connection
          connectionAttempts.current.delete(callerId)

          // Remove from in-progress set
          peerCreationInProgress.current.delete(callerId)

          // Send a test data message to confirm connection
          try {
            peer.send(JSON.stringify({ type: "connection-established", from: userId }))
          } catch (err) {
            console.error(`[PeerConnections] Error sending test data to ${callerId}:`, err)
          }
        })

        peer.on("error", (err) => {
          console.error(`[PeerConnections] Peer error with ${callerId}:`, err.message)
          clearTimeout(connectionTimeout)

          // Remove from in-progress set
          peerCreationInProgress.current.delete(callerId)
        })

        // Add connection state change handler
        peer.on("iceStateChange", (state) => {
          console.log(`[PeerConnections] ICE state changed for ${callerId}:`, state)

          // If we reach failed state, try to reconnect
          if (state === "failed") {
            console.log(`[PeerConnections] ICE connection failed for ${callerId}`)

            // For receiver peers, we don't initiate reconnection
            // The initiator should handle that
          }
        })

        // Add a close handler to mark this peer as destroyed
        peer.on("close", () => {
          console.log(`[PeerConnections] Peer connection with ${callerId} closed`)
          // Find and mark this peer as destroyed
          const peerObj = peersRef.current.find((p) => p.peerId === callerId && p.createdAt === timestamp)
          if (peerObj) {
            peerObj.isDestroyed = true
          }

          // Remove from in-progress set
          peerCreationInProgress.current.delete(callerId)
        })

        // Handle data channel messages
        peer.on("data", (data) => {
          try {
            const message = JSON.parse(data.toString())
            console.log(`[PeerConnections] Received data from ${callerId}:`, message)
          } catch (err) {
            console.error(`[PeerConnections] Error parsing data from ${callerId}:`, err)
          }
        })

        // Store the new peer in our refs and state
        const peerConnection = {
          peerId: callerId,
          peer,
          username: callerId, // Will be updated later when we get the actual username
          createdAt: timestamp,
        }

        peersRef.current.push(peerConnection)
        safeSetPeers((prev) => [...prev, peerConnection])

        // Process the incoming signal
        console.log(`[PeerConnections] Processing incoming signal from ${callerId}`)
        peer.signal(incomingSignal)

        return peer
      } catch (err) {
        console.error(`[PeerConnections] Error creating peer for ${callerId}:`, err)
        peerCreationInProgress.current.delete(callerId)
        return null
      }
    },
    [iceServers, isAudioOnlyMode, meetingId, socket, cleanupOldPeers, sdpTransform, safeSetPeers],
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

      // Check if we've exceeded max reconnection attempts
      const attempts = (connectionAttempts.current.get(peerId) || 0) + 1
      connectionAttempts.current.set(peerId, attempts)

      if (attempts >= MAX_CONNECTION_ATTEMPTS) {
        console.log(`[PeerConnections] Max reconnection attempts (${MAX_CONNECTION_ATTEMPTS}) reached for ${username}`)
        if (isMounted.current) {
          toast.error(`Could not connect to ${username} after multiple attempts`)
        }
        return
      }

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
      safeSetPeers((prev) => prev.filter((p) => !(p.username === username && p.peerId === peerId)))

      // Determine which stream to use
      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      // Only attempt reconnection if we have a stream
      if (!streamToUse) {
        console.error("[PeerConnections] Cannot reconnect: No local stream available")
        return
      }

      // Wait a bit before creating a new peer to avoid race conditions
      setTimeout(() => {
        if (!isMounted.current) return

        // Create a new peer connection
        const newPeer = createPeer(peerId, userId, streamToUse)

        if (newPeer) {
          const timestamp = Date.now()

          // Add the new peer to our lists
          const peerConnection = {
            peerId,
            peer: newPeer,
            username,
            createdAt: timestamp,
          }

          peersRef.current.push(peerConnection)
          safeSetPeers((prev) => [...prev, peerConnection])

          console.log(`[PeerConnections] Reconnection attempt initiated with ${username}`)
        }
      }, 1000)
    },
    [isAudioOnlyMode, userId, createPeer, audioStreamRef, streamRef, safeSetPeers],
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

        // Check if this is an answer and the peer is in the right state
        if (signal.type === "answer") {
          const pc = (peerObj.peer as unknown as { _pc: RTCPeerConnection })._pc
          if (pc && pc.signalingState !== "have-local-offer") {
            console.log(`[PeerConnections] Cannot apply answer to peer ${peerId} in state ${pc.signalingState}`)
            return false
          }
        }

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

  // Set up socket event handlers once
  useEffect(() => {
    if (!socket || !userId || socketHandlersRegistered.current) return

    console.log("[PeerConnections] Setting up socket event handlers")
    socketHandlersRegistered.current = true

    // Handle WebRTC signaling - offer
    const handleOffer = (data: { callerId: string; offer: Peer.SignalData }) => {
      console.log(`[PeerConnections] Received offer from: ${data.callerId}`)

      const streamToUse = isAudioOnlyMode ? audioStreamRef.current : streamRef.current

      if (!streamToUse) {
        console.log(`[PeerConnections] No local stream available, cannot answer offer from ${data.callerId}`)
        return
      }

      console.log(`[PeerConnections] Creating answer peer for ${data.callerId}`)
      addPeer(data.callerId, userId, data.offer, streamToUse)
    }

    // Handle WebRTC signaling - answer
    const handleAnswer = (data: { callerId: string; answer: Peer.SignalData }) => {
      console.log(`[PeerConnections] Received answer from: ${data.callerId}`)

      // Use the safe signaling method
      const success = safelySignalPeer(data.callerId, data.answer)

      if (!success) {
        console.log(
          `[PeerConnections] Could not apply answer to peer ${data.callerId} - peer may be destroyed or not found`,
        )
      }
    }

    // Handle WebRTC signaling - ICE candidate
    const handleCandidate = (data: { callerId: string; candidate: RTCIceCandidate }) => {
      console.log(`[PeerConnections] Received ICE candidate from: ${data.callerId}`)

      // Use the safe signaling method
      const success = safelySignalPeer(data.callerId, {
        type: "candidate",
        candidate: data.candidate,
      })

      if (!success) {
        console.log(
          `[PeerConnections] Could not apply ICE candidate to peer ${data.callerId} - peer may be destroyed or not found`,
        )
      }
    }

    // Register event handlers
    socket.on("offer", handleOffer)
    socket.on("answer", handleAnswer)
    socket.on("candidate", handleCandidate)

    return () => {
      // Unregister event handlers
      console.log("[PeerConnections] Removing socket event handlers")
      socket.off("offer", handleOffer)
      socket.off("answer", handleAnswer)
      socket.off("candidate", handleCandidate)
      socketHandlersRegistered.current = false
    }
  }, [socket, userId, isAudioOnlyMode, audioStreamRef, streamRef, addPeer, safelySignalPeer])

  // Update username for peers when participants change
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

  // Periodically clean up destroyed peers
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (!isMounted.current) return

      const destroyedPeers = peersRef.current.filter((p) => p.isDestroyed)
      if (destroyedPeers.length > 0) {
        console.log(`[PeerConnections] Cleaning up ${destroyedPeers.length} destroyed peers`)

        peersRef.current = peersRef.current.filter((p) => !p.isDestroyed)
        safeSetPeers((prev) => prev.filter((p) => !p.isDestroyed))
      }
    }, 30000) // Every 30 seconds

    return () => clearInterval(cleanupInterval)
  }, [safeSetPeers])

  // Debug logging of current peers
  const logPeers = useCallback(() => {
    console.log(
      "[PeerConnections] Current peers:",
      peersRef.current.map((p) => ({
        peerId: p.peerId,
        username: p.username,
        isDestroyed: p.isDestroyed,
        createdAt: new Date(p.createdAt).toISOString(),
      })),
    )
  }, [])

  return {
    peers,
    peersRef,
    createPeer,
    addPeer,
    handlePeerReconnect,
    safelySignalPeer,
    setPeers: safeSetPeers,
    iceServers,
    setIceServers,
    updatePeerUsernames,
    logPeers, // Expose debug function
  }
}
