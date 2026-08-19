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
  sfuUrl = process.env.NEXT_PUBLIC_SFU_URL || "http://localhost:4000",
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
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 1. Initialize SFU Connection & Device
  useEffect(() => {
    if (!meetingId || !userId) return

    console.log(`[Mediasoup] Connecting to SFU at ${sfuUrl}`)
    const socket = io(sfuUrl, {
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
        "join-sfu-room",
        { meetingId, userId, username: username || userId },
        async (data: { rtpCapabilities?: RtpCapabilities; error?: string }) => {
          if (data.error || !data.rtpCapabilities) {
            console.error("[Mediasoup] Failed to join SFU room:", data.error)
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
          } catch (err: any) {
            console.error("[Mediasoup] Error initializing device or transports:", err)
          }
        },
      )
    })

    socket.on("disconnect", () => {
      console.warn("[Mediasoup] Disconnected from SFU")
      setIsSfuConnected(false)
    })

    // Listen for new remote producers
    socket.on("new-producer", async (producerData: { producerId: string; producerUserId: string; producerUsername: string; kind: string; appData: any }) => {
      console.log(`[Mediasoup] New remote producer: ${producerData.producerId} (${producerData.kind}) from ${producerData.producerUsername}`)
      await consumeProducer(socket, producerData)
    })

    // Listen for existing producers when joining
    socket.on("existing-producers", async (producers: Array<{ producerId: string; producerUserId: string; producerUsername: string; kind: string; appData: any }>) => {
      console.log(`[Mediasoup] Consuming ${producers.length} existing producers in meeting`)
      for (const prod of producers) {
        await consumeProducer(socket, prod)
      }
    })

    // Remote producer closed
    socket.on("producer-closed", ({ producerId, userId: remoteUserId }: { producerId: string; userId: string }) => {
      console.log(`[Mediasoup] Remote producer closed: ${producerId} for user ${remoteUserId}`)
      handleConsumerClose(producerId, remoteUserId)
    })

    socket.on("consumer-closed", ({ consumerId, producerId }: { consumerId: string; producerId: string }) => {
      const consumer = consumersRef.current.get(consumerId)
      if (consumer) {
        consumer.close()
        consumersRef.current.delete(consumerId)
      }
    })

    return () => {
      console.log("[Mediasoup] Cleaning up SFU resources")
      if (audioProducerRef.current) audioProducerRef.current.close()
      if (videoProducerRef.current) videoProducerRef.current.close()
      if (sendTransportRef.current) sendTransportRef.current.close()
      if (recvTransportRef.current) recvTransportRef.current.close()

      consumersRef.current.forEach((c) => c.close())
      consumersRef.current.clear()

      socket.disconnect()
      socketRef.current = null
      deviceRef.current = null
    }
  }, [meetingId, userId, username, sfuUrl])

  // Helper: Create Send WebRtcTransport
  const initSendTransport = async (socket: Socket, device: Device) => {
    return new Promise<void>((resolve, reject) => {
      socket.emit("create-transport", { direction: "send" }, async (params: any) => {
        if (params.error) {
          return reject(params.error)
        }

        try {
          const transport = device.createSendTransport(params)
          sendTransportRef.current = transport

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket.emit("connect-transport", { transportId: transport.id, dtlsParameters }, (res: any) => {
              if (res.error) errback(new Error(res.error))
              else callback()
            })
          })

          transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit("produce", { transportId: transport.id, kind, rtpParameters, appData }, (res: any) => {
              if (res.error) errback(new Error(res.error))
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
        if (params.error) {
          return reject(params.error)
        }

        try {
          const transport = device.createRecvTransport(params)
          recvTransportRef.current = transport

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket.emit("connect-transport", { transportId: transport.id, dtlsParameters }, (res: any) => {
              if (res.error) errback(new Error(res.error))
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
    producerData: { producerId: string; producerUserId: string; producerUsername: string; kind: string; appData: any },
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
        if (params.error) {
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
          const remoteUsername = producerData.producerUsername || remoteUserId

          setRemoteStreams((prev) => {
            const next = new Map(prev)
            let participant = next.get(remoteUserId)

            if (!participant) {
              const newStream = new MediaStream()
              newStream.addTrack(consumer.track)
              participant = {
                userId: remoteUserId,
                username: remoteUsername,
                stream: newStream,
                audioConsumer: consumer.kind === "audio" ? consumer : undefined,
                videoConsumer: consumer.kind === "video" ? consumer : undefined,
                isAudioEnabled: consumer.kind === "audio" ? true : false,
                isVideoEnabled: consumer.kind === "video" ? true : false,
              }
            } else {
              participant.stream.addTrack(consumer.track)
              if (consumer.kind === "audio") {
                participant.audioConsumer = consumer
                participant.isAudioEnabled = true
              }
              if (consumer.kind === "video") {
                participant.videoConsumer = consumer
                participant.isVideoEnabled = true
              }
            }

            next.set(remoteUserId, { ...participant })
            return next
          })
        } catch (err: any) {
          console.error("[Mediasoup] Exception creating client consumer:", err)
        }
      },
    )
  }

  // Helper: Handle remote consumer cleanup
  const handleConsumerClose = (producerId: string, remoteUserId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      const participant = next.get(remoteUserId)
      if (participant) {
        if (participant.videoConsumer?.producerId === producerId) {
          participant.stream.getVideoTracks().forEach((t) => participant.stream.removeTrack(t))
          participant.videoConsumer = undefined
          participant.isVideoEnabled = false
        }
        if (participant.audioConsumer?.producerId === producerId) {
          participant.stream.getAudioTracks().forEach((t) => participant.stream.removeTrack(t))
          participant.audioConsumer = undefined
          participant.isAudioEnabled = false
        }

        if (!participant.videoConsumer && !participant.audioConsumer) {
          next.delete(remoteUserId)
        } else {
          next.set(remoteUserId, { ...participant })
        }
      }
      return next
    })
  }

  // 2. Publish Local Media Streams ($O(1)$ to SFU)
  const publishLocalMedia = useCallback(
    async (stream: MediaStream) => {
      const sendTransport = sendTransportRef.current
      if (!sendTransport || sendTransport.closed) {
        console.warn("[Mediasoup] Send transport not ready to publish media")
        return
      }

      // Publish Audio Track
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack && (!audioProducerRef.current || audioProducerRef.current.closed)) {
        try {
          console.log("[Mediasoup] Publishing local audio track...")
          const audioProducer = await sendTransport.produce({
            track: audioTrack,
            codecOptions: {
              opusStereo: true,
              opusDtx: true,
            },
          })
          audioProducerRef.current = audioProducer
        } catch (err: any) {
          console.error("[Mediasoup] Error producing audio:", err)
        }
      }

      // Publish Video Track
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack && (!videoProducerRef.current || videoProducerRef.current.closed)) {
        try {
          console.log("[Mediasoup] Publishing local video track...")
          const videoProducer = await sendTransport.produce({
            track: videoTrack,
            encodings: [
              { maxBitrate: 100000, scaleResolutionDownBy: 4 },
              { maxBitrate: 300000, scaleResolutionDownBy: 2 },
              { maxBitrate: 900000, scaleResolutionDownBy: 1 },
            ],
            codecOptions: {
              videoGoogleStartBitrate: 1000,
            },
          })
          videoProducerRef.current = videoProducer
        } catch (err: any) {
          console.error("[Mediasoup] Error producing video:", err)
        }
      }
    },
    [],
  )

  // Toggle Audio Mute
  const setAudioMuted = useCallback((muted: boolean) => {
    if (audioProducerRef.current) {
      if (muted) audioProducerRef.current.pause()
      else audioProducerRef.current.resume()
    }
  }, [])

  // Toggle Video Mute
  const setVideoMuted = useCallback((muted: boolean) => {
    if (videoProducerRef.current) {
      if (muted) videoProducerRef.current.pause()
      else videoProducerRef.current.resume()
    }
  }, [])

  // Automatically publish when localStream or sendTransport becomes available
  useEffect(() => {
    if (localStream && isSfuConnected && sendTransportRef.current) {
      publishLocalMedia(localStream)
    }
  }, [localStream, isSfuConnected, publishLocalMedia])

  return {
    isSfuConnected,
    remoteStreams,
    publishLocalMedia,
    setAudioMuted,
    setVideoMuted,
  }
}
