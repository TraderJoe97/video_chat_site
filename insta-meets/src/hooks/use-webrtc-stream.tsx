"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { fetchTurnServers } from "@/lib/turn-servers"

export interface RemoteParticipantStream {
  userId: string
  username: string
  stream: MediaStream
  isAudioEnabled: boolean
  isVideoEnabled: boolean
}

interface UseWebRTCStreamProps {
  meetingId: string
  userId: string
  username: string
  localStream: MediaStream | null
  isConnected: boolean
  sendSignal: (targetUserId: string, signalData: any) => Promise<void>
}

export function useWebRTCStream({
  meetingId,
  userId,
  username,
  localStream,
  isConnected,
  sendSignal,
}: UseWebRTCStreamProps) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteParticipantStream>>(new Map())
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const isMountedRef = useRef(true)

  localStreamRef.current = localStream

  useEffect(() => {
    isMountedRef.current = true
    // Fetch Metered TURN & Google STUN servers on mount
    fetchTurnServers().then((servers) => {
      iceServersRef.current = servers
      console.log(`[WebRTC] Loaded ${servers.length} ICE/TURN servers`)
    })

    return () => {
      isMountedRef.current = false
      peerConnections.current.forEach((pc) => pc.close())
      peerConnections.current.clear()
    }
  }, [])

  // Create or get RTCPeerConnection for a peer
  const getOrCreatePeerConnection = useCallback(
    (peerUserId: string, peerUsername?: string): RTCPeerConnection => {
      const existingPc = peerConnections.current.get(peerUserId)
      if (existingPc && existingPc.signalingState !== "closed") {
        return existingPc
      }

      console.log(`[WebRTC] Creating new RTCPeerConnection for ${peerUsername || peerUserId}`)

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
        ],
        iceTransportPolicy: "all",
      })

      // Add local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!)
          console.log(`[WebRTC] Added local track ${track.kind} to peer ${peerUserId}`)
        })
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerUserId, {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          })
        }
      }

      // Handle Remote Media Tracks
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track ${event.track.kind} from ${peerUserId}`)
        const [incomingStream] = event.streams
        const track = event.track

        setRemoteStreams((prev) => {
          const next = new Map(prev)
          const existing = next.get(peerUserId)

          let stream: MediaStream
          if (incomingStream) {
            stream = incomingStream
          } else if (existing?.stream) {
            existing.stream.addTrack(track)
            stream = new MediaStream(existing.stream.getTracks())
          } else {
            stream = new MediaStream([track])
          }

          next.set(peerUserId, {
            userId: peerUserId,
            username: peerUsername || existing?.username || peerUserId,
            stream,
            isAudioEnabled: stream.getAudioTracks().some((t) => t.enabled),
            isVideoEnabled: stream.getVideoTracks().some((t) => t.enabled),
          })

          console.log(`[WebRTC] Updated remote stream for ${peerUserId}: ${stream.getTracks().length} track(s)`)
          return next
        })
      }

      // Connection State Monitoring
      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state with ${peerUserId} -> ${pc.connectionState}`)
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            next.delete(peerUserId)
            return next
          })
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE state with ${peerUserId} -> ${pc.iceConnectionState}`)
      }

      peerConnections.current.set(peerUserId, pc)
      return pc
    },
    [sendSignal],
  )

  // Initiate Call (Offer) to a newly joined participant
  const initiateCall = useCallback(
    async (peerUserId: string, peerUsername?: string) => {
      try {
        const pc = getOrCreatePeerConnection(peerUserId, peerUsername)
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
        await pc.setLocalDescription(offer)
        console.log(`[WebRTC] Sent SDP offer to ${peerUserId}`)

        await sendSignal(peerUserId, {
          type: "offer",
          sdp: offer,
          username,
        })
      } catch (err) {
        console.error(`[WebRTC] Error initiating call to ${peerUserId}:`, err)
      }
    },
    [getOrCreatePeerConnection, sendSignal, username],
  )

  // Handle Incoming Signal from SignalR
  const handleReceiveSignal = useCallback(
    async (senderUserId: string, signal: any) => {
      if (!signal || senderUserId === userId) return

      try {
        const pc = getOrCreatePeerConnection(senderUserId, signal.username)

        if (signal.type === "offer" && signal.sdp) {
          console.log(`[WebRTC] Handling SDP offer from ${senderUserId}`)
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Process any queued candidates
          const queued = pendingCandidates.current.get(senderUserId) || []
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand))
          }
          pendingCandidates.current.delete(senderUserId)

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          console.log(`[WebRTC] Sent SDP answer to ${senderUserId}`)

          await sendSignal(senderUserId, {
            type: "answer",
            sdp: answer,
            username,
          })
        } else if (signal.type === "answer" && signal.sdp) {
          console.log(`[WebRTC] Handling SDP answer from ${senderUserId}`)
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Process any queued candidates
          const queued = pendingCandidates.current.get(senderUserId) || []
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand))
          }
          pendingCandidates.current.delete(senderUserId)
        } else if (signal.type === "candidate" && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
          } else {
            const queued = pendingCandidates.current.get(senderUserId) || []
            queued.push(signal.candidate)
            pendingCandidates.current.set(senderUserId, queued)
          }
        }
      } catch (err) {
        console.error(`[WebRTC] Error handling signal from ${senderUserId}:`, err)
      }
    },
    [getOrCreatePeerConnection, sendSignal, userId, username],
  )

  // Peer Left Cleanup
  const handlePeerLeft = useCallback((leftUserId: string) => {
    console.log(`[WebRTC] Cleaning up peer ${leftUserId}`)
    const pc = peerConnections.current.get(leftUserId)
    if (pc) {
      pc.close()
      peerConnections.current.delete(leftUserId)
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      next.delete(leftUserId)
      return next
    })
  }, [])

  // Sync local tracks if localStream updates dynamically
  useEffect(() => {
    if (!localStream) return

    peerConnections.current.forEach((pc, peerUserId) => {
      const senders = pc.getSenders()
      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind)
        if (sender) {
          sender.replaceTrack(track)
        } else {
          pc.addTrack(track, localStream)
        }
      })
    })
  }, [localStream])

  return {
    remoteStreams,
    initiateCall,
    handleReceiveSignal,
    handlePeerLeft,
  }
}
