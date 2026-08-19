import os from "os"

let resolvedAnnouncedIp = process.env.MEDIASOUP_ANNOUNCED_IP || null

export async function resolveAnnouncedIp() {
  if (resolvedAnnouncedIp && resolvedAnnouncedIp !== "127.0.0.1") {
    return resolvedAnnouncedIp
  }

  // Auto-detect public IP on cloud deployments (Render, AWS, etc.)
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    if (data?.ip) {
      resolvedAnnouncedIp = data.ip
      console.log(`[SFU] Auto-detected public WebRTC IP: ${resolvedAnnouncedIp}`)
      return resolvedAnnouncedIp
    }
  } catch (err) {
    console.warn(`[SFU] Could not auto-detect public IP, defaulting to 127.0.0.1: ${err.message}`)
  }

  resolvedAnnouncedIp = "127.0.0.1"
  return resolvedAnnouncedIp
}

export async function getWebRtcListenIps() {
  const announcedIp = await resolveAnnouncedIp()
  return [
    {
      ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
      announcedIp: announcedIp,
    },
  ]
}

export const config = {
  // HTTP / WebSocket port
  listenPort: process.env.PORT || 5000,

  // Mediasoup Worker settings
  mediasoup: {
    numWorkers: Math.max(1, Object.keys(os.cpus()).length),
    worker: {
      logLevel: "warn",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
      rtcMinPort: 20000,
      rtcMaxPort: 29999,
    },
    // Router media codecs
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "video",
          mimeType: "video/VP9",
          clockRate: 90000,
          parameters: {
            "profile-id": 2,
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "video",
          mimeType: "video/h264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "4d0032",
            "level-asymmetry-allowed": 1,
            "x-google-start-bitrate": 1000,
          },
        },
      ],
    },
    // WebRtcTransport settings
    webRtcTransport: {
      initialAvailableOutgoingBitrate: 1000000,
      maxSctpMessageSize: 262144,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    },
  },
}
