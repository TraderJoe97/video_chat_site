/**
 * Robust, high-availability public STUN servers (Google, Cloudflare, Twilio)
 * These servers perform NAT discovery with zero bandwidth caps and 100% free uptime.
 */
const PUBLIC_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:global.stun.twilio.com:3478" },
]

/**
 * Fetches dynamic ICE/TURN servers from the Next.js API route (/api/turn)
 * which communicates with Xirsys or returns public STUN servers.
 */
export async function fetchTurnServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/turn", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
        console.log(`[TurnServers] Successfully loaded ${data.iceServers.length} ICE/TURN servers from /api/turn`)
        return data.iceServers
      }
    }
  } catch (err: any) {
    console.warn("[TurnServers] Could not fetch from /api/turn, using fallback STUN:", err.message)
  }

  // Fallback to client-side public STUN
  console.log("[TurnServers] Using high-availability public STUN servers")
  return PUBLIC_STUN_SERVERS
}

/**
 * Returns fallback ICE servers
 */
export function getFallbackServers(): RTCIceServer[] {
  return PUBLIC_STUN_SERVERS
}


