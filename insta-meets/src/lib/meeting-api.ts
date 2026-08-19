// API functions for interacting with the .NET meeting server and Supabase backend

function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")
  }
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL.replace(/\/$/, "")
  }
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:5000"
  }
  return "https://video-chat-site.onrender.com"
}

export interface MeetingDto {
  meetingId: string
  hostId: string
  meetingName: string
  createdAt: string
}

export interface ChatMessageDto {
  id: string
  meetingId: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
}

/**
 * Creates a new meeting on the server
 */
export async function createMeeting(hostId: string, meetingName = "Untitled Meeting"): Promise<MeetingDto> {
  const backendUrl = getBackendUrl()
  const meetingId = generateMeetingId()

  try {
    const response = await fetch(`${backendUrl}/api/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meetingId,
        hostId,
        meetingName,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create meeting: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error creating meeting:", error)
    // Fall back to returning local meeting ID
    return { meetingId, hostId, meetingName, createdAt: new Date().toISOString() }
  }
}

/**
 * Fetches all meetings from the server
 */
export async function fetchMeetings(): Promise<MeetingDto[]> {
  const backendUrl = getBackendUrl()

  try {
    const response = await fetch(`${backendUrl}/api/meetings`)

    if (!response.ok) {
      throw new Error(`Failed to fetch meetings: ${response.statusText}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error("Error fetching meetings:", error)
    return []
  }
}

/**
 * Fetches chat history for a meeting
 */
export async function fetchChatHistory(meetingId: string): Promise<ChatMessageDto[]> {
  const backendUrl = getBackendUrl()

  try {
    const response = await fetch(`${backendUrl}/api/meetings/${meetingId}/messages`)

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error("Error fetching chat history:", error)
    return []
  }
}

/**
 * Checks if the server is healthy
 */
export async function checkServerHealth() {
  const backendUrl = getBackendUrl()

  try {
    const response = await fetch(`${backendUrl}/api/health`)

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error checking server health:", error)
    return { status: "error", message: (error as Error).message }
  }
}

/**
 * Checks if a meeting exists
 */
export async function checkMeetingExists(meetingId: string) {
  const backendUrl = getBackendUrl()

  try {
    const response = await fetch(`${backendUrl}/api/meetings/${meetingId}`)
    return response.ok
  } catch (error) {
    console.error("Error checking if meeting exists:", error)
    return true // Assume exists on error
  }
}

/**
 * Generates a random meeting ID
 */
function generateMeetingId() {
  return Math.random().toString(36).substring(2, 10)
}
