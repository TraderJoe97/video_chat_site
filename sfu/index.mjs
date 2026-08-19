import http from "http"
import express from "express"
import cors from "cors"
import { Server } from "socket.io"
import * as mediasoup from "mediasoup"
import { config } from "./config.mjs"

const app = express()
app.use(cors())
app.use(express.json())

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "mediasoup-sfu", workers: workers.length })
})

const httpServer = http.createServer(app)
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

// Helper: Get round-robin worker
function getWorker() {
  const worker = workers[nextWorkerIdx]
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length
  return worker
}

// Helper: Get or Create Router for a Meeting Room
async function getOrCreateRoomRouter(meetingId) {
  let router = rooms.get(meetingId)
  if (!router) {
    const worker = getWorker()
    router = await worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
    })
    rooms.set(meetingId, router)
    console.log(`[SFU] Created media router for meeting ${meetingId}`)
  }
  return router
}

// Helper: Create WebRtcTransport
async function createWebRtcTransport(router) {
  const { webRtcTransport: transportSettings } = config.mediasoup
  const transport = await router.createWebRtcTransport({
    listenIps: transportSettings.listenIps,
    enableUdp: transportSettings.enableUdp,
    enableTcp: transportSettings.enableTcp,
    preferUdp: transportSettings.preferUdp,
    initialAvailableOutgoingBitrate: transportSettings.initialAvailableOutgoingBitrate,
  })

  // Max bitrate limits
  await transport.setMaxIncomingBitrate(1500000)

  return transport
}

// Socket Signaling Handling
io.on("connection", (socket) => {
  console.log(`[SFU] Client connected: ${socket.id}`)

  // 1. Join SFU Room & Get Router RTP Capabilities
  socket.on("join-sfu-room", async ({ meetingId, userId, username }, callback) => {
    try {
      console.log(`[SFU] Peer ${username} (${userId}) joining meeting ${meetingId}`)
      socket.join(meetingId)

      const router = await getOrCreateRoomRouter(meetingId)

      // Initialize peer state
      peers.set(socket.id, {
        meetingId,
        userId,
        username,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      })

      // Send router RTP capabilities back so client mediasoup Device can load
      callback({
        rtpCapabilities: router.rtpCapabilities,
      })

      // Inform client about existing producers in the room
      const existingProducers = []
      for (const [otherSocketId, otherPeer] of peers.entries()) {
        if (otherSocketId !== socket.id && otherPeer.meetingId === meetingId) {
          for (const [prodId, prod] of otherPeer.producers.entries()) {
            existingProducers.push({
              producerId: prodId,
              producerUserId: otherPeer.userId,
              producerUsername: otherPeer.username,
              kind: prod.kind,
              appData: prod.appData,
            })
          }
        }
      }

      if (existingProducers.length > 0) {
        socket.emit("existing-producers", existingProducers)
      }
    } catch (error) {
      console.error("[SFU] Error in join-sfu-room:", error)
      callback({ error: error.message })
    }
  })

  // 2. Create WebRTC Transport (direction: 'send' | 'recv')
  socket.on("create-transport", async ({ direction }, callback) => {
    const peer = peers.get(socket.id)
    if (!peer) return callback({ error: "Peer not found" })

    try {
      const router = rooms.get(peer.meetingId)
      if (!router) return callback({ error: "Router not found" })

      const transport = await createWebRtcTransport(router)
      peer.transports.set(transport.id, transport)

      transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") {
          transport.close()
        }
      })

      transport.on("close", () => {
        console.log(`[SFU] Transport ${transport.id} closed for peer ${peer.userId}`)
      })

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      })
    } catch (error) {
      console.error("[SFU] Error creating transport:", error)
      callback({ error: error.message })
    }
  })

  // 3. Connect Transport (DTLS parameters handshake)
  socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
    const peer = peers.get(socket.id)
    if (!peer) return callback({ error: "Peer not found" })

    try {
      const transport = peer.transports.get(transportId)
      if (!transport) return callback({ error: "Transport not found" })

      await transport.connect({ dtlsParameters })
      callback({ connected: true })
    } catch (error) {
      console.error("[SFU] Error connecting transport:", error)
      callback({ error: error.message })
    }
  })

  // 4. Produce Media (Publish Audio / Video track)
  socket.on("produce", async ({ transportId, kind, rtpParameters, appData }, callback) => {
    const peer = peers.get(socket.id)
    if (!peer) return callback({ error: "Peer not found" })

    try {
      const transport = peer.transports.get(transportId)
      if (!transport) return callback({ error: "Transport not found" })

      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { ...appData, userId: peer.userId, username: peer.username },
      })

      peer.producers.set(producer.id, producer)

      producer.on("transportclose", () => {
        console.log(`[SFU] Producer ${producer.id} transport closed`)
        producer.close()
      })

      // Notify all other clients in the room about the new producer
      socket.to(peer.meetingId).emit("new-producer", {
        producerId: producer.id,
        producerUserId: peer.userId,
        producerUsername: peer.username,
        kind: producer.kind,
        appData: producer.appData,
      })

      callback({ id: producer.id })
    } catch (error) {
      console.error("[SFU] Error producing media:", error)
      callback({ error: error.message })
    }
  })

  // 5. Consume Media (Subscribe to remote peer's track)
  socket.on("consume", async ({ transportId, producerId, rtpCapabilities }, callback) => {
    const peer = peers.get(socket.id)
    if (!peer) return callback({ error: "Peer not found" })

    try {
      const router = rooms.get(peer.meetingId)
      if (!router) return callback({ error: "Router not found" })

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: "Cannot consume producer with provided capabilities" })
      }

      const transport = peer.transports.get(transportId)
      if (!transport) return callback({ error: "Transport not found" })

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start paused, resume after client setup
      })

      peer.consumers.set(consumer.id, consumer)

      consumer.on("transportclose", () => {
        consumer.close()
        peer.consumers.delete(consumer.id)
      })

      consumer.on("producerclose", () => {
        socket.emit("consumer-closed", { consumerId: consumer.id, producerId })
        consumer.close()
        peer.consumers.delete(consumer.id)
      })

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        appData: consumer.appData,
      })
    } catch (error) {
      console.error("[SFU] Error consuming media:", error)
      callback({ error: error.message })
    }
  })

  // 6. Resume Consumer
  socket.on("resume-consumer", async ({ consumerId }, callback) => {
    const peer = peers.get(socket.id)
    if (!peer) return callback({ error: "Peer not found" })

    const consumer = peer.consumers.get(consumerId)
    if (!consumer) return callback({ error: "Consumer not found" })

    try {
      await consumer.resume()
      callback({ resumed: true })
    } catch (error) {
      console.error("[SFU] Error resuming consumer:", error)
      callback({ error: error.message })
    }
  })

  // 7. Close Producer (e.g. video muted or screen share stopped)
  socket.on("close-producer", ({ producerId }) => {
    const peer = peers.get(socket.id)
    if (!peer) return

    const producer = peer.producers.get(producerId)
    if (producer) {
      producer.close()
      peer.producers.delete(producerId)
      socket.to(peer.meetingId).emit("producer-closed", { producerId, userId: peer.userId })
    }
  })

  // 8. Disconnect Cleanup
  socket.on("disconnect", () => {
    const peer = peers.get(socket.id)
    if (!peer) return

    console.log(`[SFU] Peer ${peer.username} (${peer.userId}) disconnected`)

    // Close all producers and notify room
    for (const [producerId, producer] of peer.producers.entries()) {
      producer.close()
      socket.to(peer.meetingId).emit("producer-closed", { producerId, userId: peer.userId })
    }

    // Close all consumers
    for (const consumer of peer.consumers.values()) {
      consumer.close()
    }

    // Close all transports
    for (const transport of peer.transports.values()) {
      transport.close()
    }

    peers.delete(socket.id)

    // Check if room has remaining peers; if empty, close router
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
    console.log(`[SFU] Mediasoup SFU listening on port ${port}`)
  })
}

start().catch((err) => {
  console.error("[SFU] Fatal startup error:", err)
  process.exit(1)
})
