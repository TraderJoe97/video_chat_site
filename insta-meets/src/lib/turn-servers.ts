/**
 * Fetches TURN server credentials from Metered.ca
 * @returns Promise<RTCIceServer[]> Array of ICE servers
 */
export async function fetchTurnServers(): Promise<RTCIceServer[]> {
  console.log("[TurnServers] Attempting to fetch TURN servers from Metered")

  if (!process.env.METERED_API_KEY) {
    console.warn("[TurnServers] No Metered API key found, using fallback servers")
    return getFallbackServers()
  }

  try {
    const response = await fetch(
      `https://insta-meets.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch TURN servers: ${response.status} ${response.statusText}`)
    }

    const turnServers = await response.json()
    console.log(`[TurnServers] Successfully fetched ${turnServers.length} TURN servers from Metered`)

    // Add Google STUN servers as fallback
    const servers = [
      ...turnServers,
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ]

    return servers
  } catch (error) {
    console.error("[TurnServers] Error fetching TURN servers:", error)
    return getFallbackServers()
  }
}

/**
 * Returns fallback ICE servers when Metered servers can't be fetched
 */
function getFallbackServers(): RTCIceServer[] {
  console.log("[TurnServers] Using fallback ICE servers")
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ]
}
