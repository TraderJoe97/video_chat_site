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
 * Returns ICE servers for WebRTC peer connections.
 * Defaults to reliable public STUN servers without usage limits.
 * If custom TURN environment variables are provided, they will be included.
 */
export async function fetchTurnServers(): Promise<RTCIceServer[]> {
  // Check if custom TURN credentials are provided via environment variables
  const customTurnUrl = process.env.NEXT_PUBLIC_TURN_URL || process.env.TURN_URL
  const customTurnUser = process.env.NEXT_PUBLIC_TURN_USERNAME || process.env.TURN_USERNAME
  const customTurnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || process.env.TURN_CREDENTIAL

  if (customTurnUrl && customTurnUser && customTurnCred) {
    console.log("[TurnServers] Using custom configured TURN server alongside public STUN")
    return [
      {
        urls: customTurnUrl,
        username: customTurnUser,
        credential: customTurnCred,
      },
      ...PUBLIC_STUN_SERVERS,
    ]
  }

  console.log("[TurnServers] Using high-availability public STUN servers")
  return PUBLIC_STUN_SERVERS
}

/**
 * Returns fallback ICE servers
 */
export function getFallbackServers(): RTCIceServer[] {
  return PUBLIC_STUN_SERVERS
}

