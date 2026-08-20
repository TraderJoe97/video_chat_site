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

interface PeerState {
  pc: RTCPeerConnection
  isMakingOffer: boolean
  ignoreOffer: boolean
  isPolite: boolean
  pendingCandidates: RTCIceCandidateInit[]
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
  const peersRef = useRef<Map<string, PeerState>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const isMountedRef = useRef(true)

  localStreamRef.current = localStream

  useEffect(() => {
    isMountedRef.current = true
    fetchTurnServers().then((servers) => {
      iceServersRef.current = servers
      console.log(`[WebRTC] Loaded ${servers.length} ICE/TURN servers`)
    })

    return () => {
      isMountedRef.current = false
      peersRef.current.forEach((peer) => peer.pc.close())
      peersRef.current.clear()
    }
  }, [])

  // Create or get RTCPeerConnection with W3C Perfect Negotiation Pattern
  const getOrCreatePeer = useCallback(
    (peerUserId: string, peerUsername?: string): PeerState => {
      const existing = peersRef.current.get(peerUserId)
      if (existing && existing.pc.signalingState !== "closed") {
        return existing
      }

      // Deterministic Polite vs Impolite peer assignment
      const isPolite = userId.localeCompare(peerUserId) > 0
      console.log(`[WebRTC] Initializing PeerConnection with ${peerUsername || peerUserId} (Polite: ${isPolite})`)

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
        ],
        iceTransportPolicy: "all",
      })

      const peerState: PeerState = {
        pc,
        isMakingOffer: false,
        ignoreOffer: false,
        isPolite,
        pendingCandidates: [],
      }

      // 1. Add Local Tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!)
          console.log(`[WebRTC] Added local track (${track.kind}) to peer ${peerUserId}`)
        })
      }

      // 2. Perfect Negotiation: onnegotiationneeded
      pc.onnegotiationneeded = async () => {
        try {
          peerState.isMakingOffer = true
          await pc.setLocalDescription()
          console.log(`[WebRTC] Negotiation needed: sending offer to ${peerUserId}`)
          await sendSignal(peerUserId, {
            type: "offer",
            sdp: pc.localDescription,
            username,
          })
        } catch (err) {
          console.error(`[WebRTC] Error during negotiation with ${peerUserId}:`, err)
        } finally {
          peerState.isMakingOffer = false
        }
      }

      // 3. ICE Candidate Dispatch
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerUserId, {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          })
        }
      }

      // 4. Remote Media Track Ingestion
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track (${event.track.kind}) from ${peerUserId}`)
        const [incomingStream] = event.streams
        const track = event.track

        setRemoteStreams((prev) => {
          const next = new Map(prev)
          const existingRemote = next.get(peerUserId)

          let stream: MediaStream
          if (incomingStream) {
            stream = incomingStream
          } else if (existingRemote?.stream) {
            existingRemote.stream.addTrack(track)
            stream = new MediaStream(existingRemote.stream.getTracks())
          } else {
            stream = new MediaStream([track])
          }

          next.set(peerUserId, {
            userId: peerUserId,
            username: peerUsername || existingRemote?.username || peerUserId,
            stream,
            isAudioEnabled: stream.getAudioTracks().some((t) => t.enabled),
            isVideoEnabled: stream.getVideoTracks().some((t) => t.enabled),
          })

          console.log(`[WebRTC] Remote stream active for ${peerUserId}: ${stream.getTracks().length} track(s)`)
          return next
        })
      }

      // 5. Connection State Lifecycle
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

      peersRef.current.set(peerUserId, peerState)
      return peerState
    },
    [sendSignal, userId, username],
  )

  // Handle incoming Signal from SignalR with Glare Resolution
  const handleReceiveSignal = useCallback(
    async (senderUserId: string, signal: any) => {
      if (!signal || senderUserId === userId) return

      try {
        const peer = getOrCreatePeer(senderUserId, signal.username)
        const { pc, isPolite } = peer

        if (signal.type === "offer" && signal.sdp) {
          const offerCollision = peer.isMakingOffer || pc.signalingState !== "stable"
          peer.ignoreOffer = !isPolite && offerCollision

          if (peer.ignoreOffer) {
            console.log(`[WebRTC Glare] Impolite peer ignoring offer from ${senderUserId}`)
            return
          }

          if (offerCollision) {
            console.log(`[WebRTC Glare] Polite peer rolling back to accept offer from ${senderUserId}`)
            await pc.setLocalDescription({ type: "rollback" }).catch(() => {})
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

          // Drain any pending candidates
          for (const cand of peer.pendingCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {})
          }
          peer.pendingCandidates = []

          await pc.setLocalDescription()
          console.log(`[WebRTC] Sent answer to ${senderUserId}`)
          await sendSignal(senderUserId, {
            type: "answer",
            sdp: pc.localDescription,
            username,
          })
        } else if (signal.type === "answer" && signal.sdp) {
          console.log(`[WebRTC] Received answer from ${senderUserId}`)
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))

            // Drain any pending candidates
            for (const cand of peer.pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {})
            }
            peer.pendingCandidates = []
          }
        } else if (signal.type === "candidate" && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((err) => {
              if (!peer.ignoreOffer) {
                console.warn(`[WebRTC] Error adding ICE candidate from ${senderUserId}:`, err.message)
              }
            })
          } else {
            peer.pendingCandidates.push(signal.candidate)
          }
        }
      } catch (err) {
        console.error(`[WebRTC] Error handling signal from ${senderUserId}:`, err)
      }
    },
    [getOrCreatePeer, sendSignal, userId, username],
  )

  // Initiate call when a new peer joins
  const initiateCall = useCallback(
    (peerUserId: string, peerUsername?: string) => {
      if (peerUserId === userId) return
      getOrCreatePeer(peerUserId, peerUsername)
    },
    [getOrCreatePeer, userId],
  )

  // Peer Left Cleanup
  const handlePeerLeft = useCallback((leftUserId: string) => {
    console.log(`[WebRTC] Cleaning up peer ${leftUserId}`)
    const peer = peersRef.current.get(leftUserId)
    if (peer) {
      peer.pc.close()
      peersRef.current.delete(leftUserId)
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      next.delete(leftUserId)
      return next
    })
  }, [])

  // Sync local tracks dynamically if media stream updates
  useEffect(() => {
    if (!localStream) return

    peersRef.current.forEach((peer) => {
      const senders = peer.pc.getSenders()
      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind)
        if (sender) {
          sender.replaceTrack(track)
        } else {
          peer.pc.addTrack(track, localStream)
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
