"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Peer, { type SignalData } from "simple-peer"

interface Peers {
  [key: string]: Peer.Instance
}

interface Streams {
  [key: string]: MediaStream
}

export function usePeerConnections(meetingId: string, bandwidthRef: React.MutableRefObject<number>) {
  const [peers, setPeers] = useState<Peers>({})
  const [streams, setStreams] = useState<Streams>({})

  const peersRef = useRef<Peers>({})

  // Function to create a new peer (initiator)
  const createPeer = (userId: string, socketId: string, stream: MediaStream) => {
    console.log(`Creating peer for ${userId} with my socket ID ${socketId}`)
    const peer = new Peer({
      initiator: true,
      trickle: true, // Change to true to use ICE trickle for faster connections
      stream,
    })

    peer.on("signal", (data) => {
      console.log(`Sending signal to ${userId}, type:`, data.type || "candidate")
      // This will be handled by the socket connection hook
      if (window.socketEmit) {
        window.socketEmit("offer", {
          meetingId,
          callerId: socketId,
          userId,
          offer: data,
        })
      }
    })

    peer.on("connect", () => {
      console.log(`Connected to peer ${userId}`)
    })

    peer.on("error", (err) => {
      console.error(`Peer error with ${userId}:`, err)
    })

    peer.on("stream", (remoteStream) => {
      console.log(
        `Received stream from ${userId}:`,
        remoteStream.id,
        remoteStream.getTracks().map((t) => `${t.kind}:${t.enabled}`),
      )

      // Ensure we're updating state with the new stream
      setStreams((prev) => {
        // Only update if the stream isn't already in state or has changed
        if (!prev[userId] || prev[userId].id !== remoteStream.id) {
          console.log(`Adding stream from ${userId} to state`)
          return { ...prev, [userId]: remoteStream }
        }
        return prev
      })
    })

    // Add bandwidth estimation
    peer.on("data", (data) => {
      try {
        const message = JSON.parse(data.toString())
        if (message.type === "bandwidth") {
          bandwidthRef.current = message.value
        }
      } catch (err) {
        console.error("Error parsing peer data:", err)
      }
    })

    return peer
  }

  // Function to add a peer when receiving an offer
  const addPeer = (incomingSignal: SignalData, callerId: string, stream: MediaStream) => {
    console.log(`Adding peer for ${callerId}, signal type:`, incomingSignal.type || "candidate")
    const peer = new Peer({
      initiator: false,
      trickle: true, // Change to true to use ICE trickle for faster connections
      stream,
    })

    peer.on("signal", (data) => {
      console.log(`Sending answer to ${callerId}, type:`, data.type || "candidate")
      // This will be handled by the socket connection hook
      if (window.socketEmit) {
        window.socketEmit("answer", {
          meetingId,
          callerId,
          answer: data,
        })
      }
    })

    peer.on("connect", () => {
      console.log(`Connected to peer ${callerId}`)
    })

    peer.on("error", (err) => {
      console.error(`Peer error with ${callerId}:`, err)
    })

    peer.on("stream", (remoteStream) => {
      console.log(
        `Received stream from ${callerId}:`,
        remoteStream.id,
        remoteStream.getTracks().map((t) => `${t.kind}:${t.enabled}`),
      )

      // Ensure we're updating state with the new stream
      setStreams((prev) => {
        // Only update if the stream isn't already in state or has changed
        if (!prev[callerId] || prev[callerId].id !== remoteStream.id) {
          console.log(`Adding stream from ${callerId} to state`)
          return { ...prev, [callerId]: remoteStream }
        }
        return prev
      })
    })

    // Add bandwidth estimation
    peer.on("data", (data) => {
      try {
        const message = JSON.parse(data.toString())
        if (message.type === "bandwidth") {
          bandwidthRef.current = message.value
        }
      } catch (err) {
        console.error("Error parsing peer data:", err)
      }
    })

    // Signal the incoming offer to establish the connection
    peer.signal(incomingSignal)
    return peer
  }

  const monitorPeerConnection = (peer: Peer.Instance, userId: string) => {
    const pc = (peer as any)._pc
    if (pc) {
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${userId}:`, pc.iceConnectionState)
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          console.warn(`ICE connection failed with ${userId}, attempting restart`)
          pc.restartIce()
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${userId}:`, pc.connectionState)
      }
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      Object.values(peersRef.current).forEach((peer) => {
        try {
          peer.send(JSON.stringify({ type: "bandwidth", value: bandwidthRef.current }))
        } catch (err) {
          // Ignore errors when peer is not connected
        }
      })
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [bandwidthRef])

  useEffect(() => {
    // Add a global function to emit socket events from peer connections
    window.socketEmit = (event: string, data: any) => {
      // This will be set by the socket connection hook
      if (window.socketRef?.current) {
        window.socketRef.current.emit(event, data)
      }
    }

    // For TypeScript
    declare global {
      interface Window {
        socketEmit?: (event: string, data: any) => void
        socketRef?: { current: any }
      }
    }

    return () => {
      Object.values(peersRef.current).forEach((peer) => peer.destroy())
    }
  }, [])

  return {
    peers,
    streams,
    peersRef,
    createPeer,
    addPeer,
    monitorPeerConnection,
  }
}

