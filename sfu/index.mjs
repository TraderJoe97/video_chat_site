import http from "http"
import express from "express"
import cors from "cors"
import { Server } from "socket.io"
import * as mediasoup from "mediasoup"
import { createProxyMiddleware } from "http-proxy-middleware"
import { config } from "./config.mjs"

const app = express()
app.use(cors())

const DOTNET_URL = process.env.DOTNET_BACKEND_URL || "http://127.0.0.1:5001"

// 1. Proxy SignalR Hub to .NET backend
const signalrProxy = createProxyMiddleware({
  target: DOTNET_URL,
  changeOrigin: true,
  ws: true,
  logger: console,
})
app.use("/hubs", signalrProxy)

// 2. Proxy .NET REST APIs
const apiProxy = createProxyMiddleware({
  target: DOTNET_URL,
  changeOrigin: true,
  logger: console,
})
app.use("/api/meetings", apiProxy)

// 3. Unified Health Check Endpoint for Cloud Deployments
app.get("/api/health", async (req, res) => {
  let dotnetStatus = "initializing"
  try {
    const r = await fetch(`${DOTNET_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
    if (r.ok) dotnetStatus = "ok"
  } catch {
    dotnetStatus = "starting"
  }

  res.json({
    status: "ok",
    sfu: { status: "ok", workers: workers.length },
    dotnet: dotnetStatus,
  })
})

app.use(express.json())

const httpServer = http.createServer(app)

// Handle WebSocket upgrade for SignalR Hub
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url && req.url.startsWith("/hubs")) {
    signalrProxy.upgrade(req, socket, head)
  }
})

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
})

// Mediasoup State
let workers = []
let nextWorkerIdx = 0
// meetingId -> mediasoup.Router
const rooms = new Map()
// socketId -> { meetingId, userId, username, transports: Map, producers: Map, consumers: Map }
const peers = new Map()

// Helper: Initialize Mediasoup Workers
async function initMediasoupWorkers() {
  const { numWorkers, worker: workerSettings } = config.mediasoup
  console.log(`[SFU] Starting ${numWorkers} mediasoup worker(s)...`)

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: workerSettings.logLevel,
      logTags: workerSettings.logTags,
      rtcMinPort: Number(workerSettings.rtcMinPort),
      rtcMaxPort: Number(workerSettings.rtcMaxPort),
    })

    worker.on("died", () => {
      console.error(`[SFU] Mediasoup worker ${worker.pid} died, exiting...`)
      process.exit(1)
    })

    workers.push(worker)
  }

  console.log(`[SFU] ${workers.length} Mediasoup worker(s) successfully running.`)
}

// Helper: Get or Create Router for Meeting Room
async function getOrCreateRoomRouter(meetingId) {
  let router = rooms.get(meetingId)
  if (!router) {
    const worker = workers[nextWorkerIdx]
    nextWorkerIdx = (nextWorkerIdx + 1) % workers.length

    router = await worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
    })

    rooms.set(meetingId, router)
    console.log(`[SFU] Created new Router for meeting ${meetingId} on worker ${worker.pid}`)
  }
  return router
}

// Socket.io Connection & Signaling Handshake
io.on("connection", (socket) => {
  console.log(`[SFU] Client connected: socket ID ${socket.id}`)

  // 1. Join Room & Exchange Router RTP Capabilities
  socket.on("join-room", async ({ meetingId, userId, username }, callback) => {
    try {
      const router = await getOrCreateRoomRouter(meetingId)

      // Register peer state
      peers.set(socket.id, {
        meetingId,
        userId,
        username: username || "Guest",
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      })

      socket.join(meetingId)
      console.log(`[SFU] User ${username} (${userId}) joined meeting room ${meetingId}`)

      // Return RTP capabilities to client Device
      callback({
        rtpCapabilities: router.rtpCapabilities,
      })

      // Inform existing participants
      socket.to(meetingId).emit("peer-joined", { userId, username })
    } catch (error) {
      console.error("[SFU] Error in join-room:", error)
      callback({ error: error.message })
    }
  })

  // 2. Create WebRtcTransport (Send or Recv direction)
  socket.on("create-transport", async ({ direction }, callback) => {
    try {
      const peer = peers.get(socket.id)
      if (!peer) throw new Error("Peer not found in room")

      const router = rooms.get(peer.meetingId)
      if (!router) throw new Error("Router not found for meeting")

      const { webRtcTransport: transportOptions } = config.mediasoup

      const transport = await router.createWebRtcTransport({
        listenIps: transportOptions.listenIps,
        enableUdp: transportOptions.enableUdp,
        enableTcp: transportOptions.enableTcp,
        preferUdp: transportOptions.preferUdp,
        initialAvailableOutgoingBitrate: transportOptions.initialAvailableOutgoingBitrate,
        maxSctpMessageSize: transportOptions.maxSctpMessageSize,
      })

      peer.transports.set(transport.id, transport)

      transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") {
          transport.close()
        }
      })

      transport.on("close", () => {
        console.log(`[SFU] Transport ${transport.id} closed for peer ${peer.username}`)
      })

      console.log(`[SFU] Created ${direction} transport ${transport.id} for ${peer.username}`)

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      })
    } catch (error) {
      console.error("[SFU] Error in create-transport:", error)
      callback({ error: error.message })
    }
  })

  // 3. Connect Transport (DTLS parameters handshake)
  socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
    try {
      const peer = peers.get(socket.id)
      if (!peer) throw new Error("Peer not found")

      const transport = peer.transports.get(transportId)
      if (!transport) throw new Error(`Transport ${transportId} not found`)

      await transport.connect({ dtlsParameters })
      console.log(`[SFU] Transport ${transportId} connected for ${peer.username}`)

      callback({ connected: true })
    } catch (error) {
      console.error("[SFU] Error in connect-transport:", error)
      callback({ error: error.message })
    }
  })

  // 4. Produce Media (Publish Audio / Video track to SFU Router)
  socket.on("produce", async ({ transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const peer = peers.get(socket.id)
      if (!peer) throw new Error("Peer not found")

      const transport = peer.transports.get(transportId)
      if (!transport) throw new Error(`Transport ${transportId} not found`)

      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { ...appData, peerId: socket.id, userId: peer.userId, username: peer.username },
      })

      peer.producers.set(producer.id, producer)

      producer.on("transportclose", () => {
        producer.close()
        peer.producers.delete(producer.id)
      })

      console.log(`[SFU] Producer ${producer.id} (${kind}) published by ${peer.username}`)

      callback({ id: producer.id })

      // Notify other peers in room that a new producer is available
      socket.to(peer.meetingId).emit("new-producer", {
        producerId: producer.id,
        producerUserId: peer.userId,
        producerUsername: peer.username,
        kind: producer.kind,
      })
    } catch (error) {
      console.error("[SFU] Error in produce:", error)
      callback({ error: error.message })
    }
  })

  // 5. Consume Media (Subscribe to remote peer's audio / video stream)
  socket.on("consume", async ({ transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const peer = peers.get(socket.id)
      if (!peer) throw new Error("Peer not found")

      const router = rooms.get(peer.meetingId)
      if (!router) throw new Error("Router not found")

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error("Client cannot consume this producer")
      }

      const transport = peer.transports.get(transportId)
      if (!transport) throw new Error(`Transport ${transportId} not found`)

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start paused, resume on client ready
      })

      peer.consumers.set(consumer.id, consumer)

      consumer.on("transportclose", () => {
        consumer.close()
        peer.consumers.delete(consumer.id)
      })

      consumer.on("producerclose", () => {
        consumer.close()
        peer.consumers.delete(consumer.id)
        socket.emit("consumer-closed", { consumerId: consumer.id, producerId })
      })

      console.log(`[SFU] Consumer ${consumer.id} (${consumer.kind}) created for ${peer.username}`)

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      })
    } catch (error) {
      console.error("[SFU] Error in consume:", error)
      callback({ error: error.message })
    }
  })

  // 6. Resume Consumer
  socket.on("resume-consumer", async ({ consumerId }, callback) => {
    try {
      const peer = peers.get(socket.id)
      if (!peer) throw new Error("Peer not found")

      const consumer = peer.consumers.get(consumerId)
      if (!consumer) throw new Error(`Consumer ${consumerId} not found`)

      await consumer.resume()
      console.log(`[SFU] Consumer ${consumerId} resumed`)

      callback({ resumed: true })
    } catch (error) {
      console.error("[SFU] Error in resume-consumer:", error)
      callback({ error: error.message })
    }
  })

  // 7. Pause/Resume Producer (Mute/Unmute audio or camera)
  socket.on("pause-producer", async ({ producerId }, callback) => {
    const peer = peers.get(socket.id)
    const producer = peer?.producers.get(producerId)
    if (producer) {
      await producer.pause()
      socket.to(peer.meetingId).emit("producer-paused", { producerId })
    }
    if (callback) callback({ paused: true })
  })

  socket.on("resume-producer", async ({ producerId }, callback) => {
    const peer = peers.get(socket.id)
    const producer = peer?.producers.get(producerId)
    if (producer) {
      await producer.resume()
      socket.to(peer.meetingId).emit("producer-resumed", { producerId })
    }
    if (callback) callback({ resumed: true })
  })

  // 8. Fetch Existing Producers in the Room
  socket.on("get-producers", (callback) => {
    const peer = peers.get(socket.id)
    if (!peer) return callback([])

    const producersList = []
    for (const [otherSocketId, otherPeer] of peers.entries()) {
      if (otherSocketId === socket.id) continue
      if (otherPeer.meetingId !== peer.meetingId) continue

      for (const [prodId, producer] of otherPeer.producers.entries()) {
        producersList.push({
          producerId: prodId,
          producerUserId: otherPeer.userId,
          producerUsername: otherPeer.username,
          kind: producer.kind,
        })
      }
    }

    callback(producersList)
  })

  // 9. Disconnect & Cleanup
  socket.on("disconnect", () => {
    const peer = peers.get(socket.id)
    if (!peer) return

    console.log(`[SFU] Peer ${peer.username} (${peer.userId}) disconnected`)

    // Close all producers
    for (const producer of peer.producers.values()) {
      producer.close()
    }
    // Close all consumers
    for (const consumer of peer.consumers.values()) {
      consumer.close()
    }
    // Close all transports
    for (const transport of peer.transports.values()) {
      transport.close()
    }

    // Notify room
    socket.to(peer.meetingId).emit("peer-left", { userId: peer.userId })

    peers.delete(socket.id)

    // Check if room is empty to close router
    let remainingPeersInRoom = false
    for (const remainingPeer of peers.values()) {
      if (remainingPeer.meetingId === peer.meetingId) {
        remainingPeersInRoom = true
        break
      }
    }

    if (!remainingPeersInRoom) {
      const router = rooms.get(peer.meetingId)
      if (router) {
        router.close()
        rooms.delete(peer.meetingId)
        console.log(`[SFU] Closed empty room router for meeting ${peer.meetingId}`)
      }
    }
  })
})

// Start SFU Server
async function start() {
  await initMediasoupWorkers()
  const port = config.listenPort
  httpServer.listen(port, () => {
    console.log(`[SFU] Mediasoup SFU & Reverse Proxy listening on port ${port}`)
  })
}

start().catch((err) => {
  console.error("[SFU] Fatal startup error:", err)
  process.exit(1)
})
