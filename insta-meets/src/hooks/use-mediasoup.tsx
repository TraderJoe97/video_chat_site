"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Device, type types } from "mediasoup-client"
import { io, Socket } from "socket.io-client"

type Transport = types.Transport
type Producer = types.Producer
type Consumer = types.Consumer
type RtpCapabilities = types.RtpCapabilities

export interface RemoteParticipantStream {
  userId: string
  username: string
  stream: MediaStream
  audioConsumer?: Consumer
  videoConsumer?: Consumer
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  hasHandRaised?: boolean
}

interface UseMediasoupProps {
  meetingId: string
  userId: string
  username: string
  localStream: MediaStream | null
  sfuUrl?: string
}

export function useMediasoup({
  meetingId,
  userId,
  username,
  localStream,
  sfuUrl = process.env.NEXT_PUBLIC_SFU_URL || process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5000" : "https://video-chat-site.onrender.com"),
}: UseMediasoupProps) {
  const [isSfuConnected, setIsSfuConnected] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteParticipantStream>>(new Map())

  const socketRef = useRef<Socket | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const sendTransportRef = useRef<Transport | null>(null)
  const recvTransportRef = useRef<Transport | null>(null)

  const audioProducerRef = useRef<Producer | null>(null)
  const videoProducerRef = useRef<Producer | null>(null)
  const consumersRef = useRef<Map<string, Consumer>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const usernameRef = useRef<string>(username)
  const isMountedRef = useRef(true)

  localStreamRef.current = localStream
  usernameRef.current = username || userId

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 1. Initialize SFU Connection & Device (Stable lifecycle tied strictly to meetingId and userId)
  useEffect(() => {
    if (!meetingId || !userId) return

    const normalizedSfuUrl = sfuUrl.replace(/\/$/, "")
    console.log(`[Mediasoup] Connecting to SFU at ${normalizedSfuUrl}`)

    const socket = io(normalizedSfuUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on("connect", async () => {
      console.log("[Mediasoup] Connected to SFU socket")
      setIsSfuConnected(true)

      // Join SFU room & get router RTP capabilities
      socket.emit(
        "join-room",
        { meetingId, userId, username: usernameRef.current || userId },
        async (data: { rtpCapabilities?: RtpCapabilities; error?: string }) => {
          if (data?.error || !data?.rtpCapabilities) {
            console.error("[Mediasoup] Failed to join SFU room:", data?.error)
            return
          }

          try {
            // Initialize mediasoup client Device
            const device = new Device()
            await device.load({ routerRtpCapabilities: data.rtpCapabilities })
            deviceRef.current = device
            console.log("[Mediasoup] Device loaded successfully with handler:", device.handlerName)

            // Create WebRTC Transports
            await initSendTransport(socket, device)
            await initRecvTransport(socket, device)

            // Publish local tracks if stream is already available
            if (localStreamRef.current) {
              await publishTracks(localStreamRef.current)
            }

            // Fetch any existing producers in the room
            socket.emit("get-producers", async (producers: Array<{ producerId: string; producerUserId: string; producerUsername: string; kind: string; appData: any }>) => {
              if (Array.isArray(producers)) {
                for (const prod of producers) {
                  if (prod.producerUserId !== userId) {
                    await consumeProducer(socket, prod)
                  }
                }
              }
            })
          } catch (err: any) {
            console.error("[Mediasoup] Error initializing device or transports:", err)
          }
        },
      )
    })

    socket.on("connect_error", (err) => {
      console.error("[Mediasoup] Connection error:", err.message)
    })

    socket.on("disconnect", (reason) => {
      console.warn("[Mediasoup] Disconnected from SFU:", reason)
      setIsSfuConnected(false)
    })

    // Listen for new remote producers
    socket.on("new-producer", async (producerData: { producerId: string; producerUserId: string; producerUsername: string; kind: string; appData: any }) => {
      console.log(`[Mediasoup] New remote producer: ${producerData.producerId} (${producerData.kind}) from ${producerData.producerUsername}`)
      await consumeProducer(socket, producerData)
    })

    // Remote peer left
    socket.on("peer-left", ({ userId: leftUserId }: { userId: string }) => {
      console.log(`[Mediasoup] Peer left: ${leftUserId}`)
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        next.delete(leftUserId)
        return next
      })
    })

    // Producer closed
    socket.on("consumer-closed", ({ consumerId }: { consumerId: string }) => {
      const consumer = consumersRef.current.get(consumerId)
      if (consumer) {
        consumer.close()
        consumersRef.current.delete(consumerId)
      }
    })

    // Producer paused/resumed
    socket.on("producer-paused", ({ producerId }: { producerId: string }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        for (const [rUserId, rStream] of next.entries()) {
          if (rStream.audioConsumer?.producerId === producerId) {
            next.set(rUserId, { ...rStream, isAudioEnabled: false })
          } else if (rStream.videoConsumer?.producerId === producerId) {
            next.set(rUserId, { ...rStream, isVideoEnabled: false })
          }
        }
        return next
      })
    })

    socket.on("producer-resumed", ({ producerId }: { producerId: string }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        for (const [rUserId, rStream] of next.entries()) {
          if (rStream.audioConsumer?.producerId === producerId) {
            next.set(rUserId, { ...rStream, isAudioEnabled: true })
          } else if (rStream.videoConsumer?.producerId === producerId) {
            next.set(rUserId, { ...rStream, isVideoEnabled: true })
          }
        }
        return next
      })
    })

    // Cleanup on unmount
    return () => {
      if (audioProducerRef.current) audioProducerRef.current.close()
      if (videoProducerRef.current) videoProducerRef.current.close()
      if (sendTransportRef.current) sendTransportRef.current.close()
      if (recvTransportRef.current) recvTransportRef.current.close()
      socket.disconnect()
    }
  }, [meetingId, userId, sfuUrl])

  // Helper: Create Send WebRtcTransport
  const initSendTransport = async (socket: Socket, device: Device) => {
    return new Promise<void>((resolve, reject) => {
      socket.emit("create-transport", { direction: "send" }, async (params: any) => {
        if (params?.error) {
          return reject(params.error)
        }

        try {
          const transport = device.createSendTransport(params)
          sendTransportRef.current = transport

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket.emit("connect-transport", { transportId: transport.id, dtlsParameters }, (res: any) => {
              if (res?.error) errback(new Error(res.error))
              else callback()
            })
          })

          transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit("produce", { transportId: transport.id, kind, rtpParameters, appData }, (res: any) => {
              if (res?.error) errback(new Error(res.error))
              else callback({ id: res.id })
            })
          })

          console.log("[Mediasoup] Send transport created successfully")
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  // Helper: Create Recv WebRtcTransport
  const initRecvTransport = async (socket: Socket, device: Device) => {
    return new Promise<void>((resolve, reject) => {
      socket.emit("create-transport", { direction: "recv" }, async (params: any) => {
        if (params?.error) {
          return reject(params.error)
        }

        try {
          const transport = device.createRecvTransport(params)
          recvTransportRef.current = transport

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket.emit("connect-transport", { transportId: transport.id, dtlsParameters }, (res: any) => {
              if (res?.error) errback(new Error(res.error))
              else callback()
            })
          })

          console.log("[Mediasoup] Recv transport created successfully")
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  // Helper: Consume a remote producer
  const consumeProducer = async (
    socket: Socket,
    producerData: { producerId: string; producerUserId: string; producerUsername: string; kind: string; appData?: any },
  ) => {
    const device = deviceRef.current
    const recvTransport = recvTransportRef.current
    if (!device || !recvTransport) {
      console.warn("[Mediasoup] Cannot consume producer: Device or RecvTransport not ready")
      return
    }

    if (producerData.producerUserId === userId) {
      return // Do not consume own stream
    }

    socket.emit(
      "consume",
      {
        transportId: recvTransport.id,
        producerId: producerData.producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      async (params: any) => {
        if (params?.error) {
          console.error("[Mediasoup] Error consuming remote producer:", params.error)
          return
        }

        try {
          const consumer = await recvTransport.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
            appData: params.appData,
          })

          consumersRef.current.set(consumer.id, consumer)

          // Resume consumer on server
          socket.emit("resume-consumer", { consumerId: consumer.id }, () => {
            console.log(`[Mediasoup] Consumer ${consumer.id} resumed (${consumer.kind})`)
          })

          // Add track to participant's MediaStream
          const remoteUserId = producerData.producerUserId
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            const existing = next.get(remoteUserId)

            let audioConsumer = existing?.audioConsumer
            let videoConsumer = existing?.videoConsumer

            if (consumer.kind === "video") {
              videoConsumer = consumer
            } else if (consumer.kind === "audio") {
              audioConsumer = consumer
            }

            const tracks: MediaStreamTrack[] = []
            if (audioConsumer?.track) tracks.push(audioConsumer.track)
            if (videoConsumer?.track) tracks.push(videoConsumer.track)

            const stream = new MediaStream(tracks)

            next.set(remoteUserId, {
              userId: remoteUserId,
              username: producerData.producerUsername || existing?.username || remoteUserId,
              stream,
              audioConsumer,
              videoConsumer,
              isAudioEnabled: audioConsumer ? !audioConsumer.paused : true,
              isVideoEnabled: videoConsumer ? !videoConsumer.paused : true,
            })

            console.log(`[Mediasoup] Remote stream active for ${remoteUserId} (${tracks.length} tracks: ${tracks.map((t) => t.kind).join(", ")})`)
            return next
          })
        } catch (err: any) {
          console.error("[Mediasoup] Failed to consume track on transport:", err)
        }
      },
    )
  }

  // 2. Publish Tracks when localStream or sendTransport becomes available
  const publishTracks = async (stream: MediaStream) => {
    const transport = sendTransportRef.current
    if (!transport) return

    try {
      const audioTrack = stream.getAudioTracks()[0]
      const videoTrack = stream.getVideoTracks()[0]

      if (audioTrack && !audioProducerRef.current) {
        const audioProducer = await transport.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
          },
          appData: { mediaType: "audio" },
        })
        audioProducerRef.current = audioProducer
        console.log("[Mediasoup] Audio producer created successfully:", audioProducer.id)
      }

      if (videoTrack && !videoProducerRef.current) {
        const videoProducer = await transport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000, scaleResolutionDownBy: 4 },
            { maxBitrate: 300000, scaleResolutionDownBy: 2 },
            { maxBitrate: 900000 },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: { mediaType: "video" },
        })
        videoProducerRef.current = videoProducer
        console.log("[Mediasoup] Video producer created successfully:", videoProducer.id)
      }
    } catch (err) {
      console.error("[Mediasoup] Error publishing local tracks:", err)
    }
  }

  useEffect(() => {
    if (localStream && sendTransportRef.current) {
      publishTracks(localStream)
    }
  }, [localStream])

  // Public Methods for Media Controls
  const setAudioMuted = useCallback((muted: boolean) => {
    if (audioProducerRef.current && socketRef.current) {
      if (muted) {
        audioProducerRef.current.pause()
        socketRef.current.emit("pause-producer", { producerId: audioProducerRef.current.id })
      } else {
        audioProducerRef.current.resume()
        socketRef.current.emit("resume-producer", { producerId: audioProducerRef.current.id })
      }
    }
  }, [])

  const setVideoMuted = useCallback((muted: boolean) => {
    if (videoProducerRef.current && socketRef.current) {
      if (muted) {
        videoProducerRef.current.pause()
        socketRef.current.emit("pause-producer", { producerId: videoProducerRef.current.id })
      } else {
        videoProducerRef.current.resume()
        socketRef.current.emit("resume-producer", { producerId: videoProducerRef.current.id })
      }
    }
  }, [])

  return {
    isSfuConnected,
    remoteStreams,
    setAudioMuted,
    setVideoMuted,
  }
}
