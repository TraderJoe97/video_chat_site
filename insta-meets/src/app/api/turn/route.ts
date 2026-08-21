import { NextResponse } from "next/server"

const PUBLIC_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:global.stun.twilio.com:3478" },
]

export const dynamic = "force-dynamic"

export async function GET() {
  const rawIdent = process.env.XIRSYS_IDENT || process.env.XIRSYS_USER || ""
  const rawSecret = process.env.XIRSYS_SECRET || process.env.XIRSYS_API_KEY || ""
  const rawChannel = process.env.XIRSYS_CHANNEL || "default"

  const xirsysIdent = rawIdent.trim()
  const xirsysSecret = rawSecret.trim()
  const xirsysChannel = rawChannel.trim()

  // 1. If Xirsys credentials exist, fetch dynamic TURN servers
  if (xirsysIdent && xirsysSecret) {
    try {
      console.log(`[TurnAPI] Requesting dynamic TURN credentials from Xirsys for channel: ${xirsysChannel}`)
      const authHeader = "Basic " + Buffer.from(`${xirsysIdent}:${xirsysSecret}`).toString("base64")
      
      const endpoint = `https://global.xirsys.net/_turn/${encodeURIComponent(xirsysChannel)}`
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ format: "urls" }),
        cache: "no-store",
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.s === "ok" && data?.v?.iceServers) {
          const rawServers = data.v.iceServers
          const iceServersArray: RTCIceServer[] = Array.isArray(rawServers) ? rawServers : [rawServers]
          console.log(`[TurnAPI] Successfully fetched dynamic Xirsys TURN servers (${iceServersArray.length} entries)`)
          return NextResponse.json({ iceServers: [...iceServersArray, ...PUBLIC_STUN_SERVERS] })
        }
      } else {
        console.warn(`[TurnAPI] Xirsys API returned status ${response.status}: ${response.statusText}`)
      }
    } catch (err: any) {
      console.error("[TurnAPI] Error requesting Xirsys dynamic TURN:", err.message)
    }
  }

  // 2. Static custom TURN credentials fallback
  const customTurnUrl = (process.env.TURN_URL || process.env.NEXT_PUBLIC_TURN_URL || "").trim()
  const customTurnUser = (process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME || "").trim()
  const customTurnCred = (process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "").trim()

  if (customTurnUrl && customTurnUser && customTurnCred) {
    return NextResponse.json({
      iceServers: [
        {
          urls: customTurnUrl,
          username: customTurnUser,
          credential: customTurnCred,
        },
        ...PUBLIC_STUN_SERVERS,
      ],
    })
  }

  // 3. High-availability public STUN default
  return NextResponse.json({ iceServers: PUBLIC_STUN_SERVERS })
}
