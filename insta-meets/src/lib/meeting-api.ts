// API functions for interacting with the meeting server

/**
 * Creates a new meeting on the server
 */
export async function createMeeting(hostId: string, meetingName = "Untitled Meeting") {
    const backendUrl =
      process.env.BACKEND_URL || ""
    const meetingId = generateMeetingId()
  
    try {
      const response = await fetch(`${backendUrl}/create-meeting`, {
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
      // Fall back to just returning the meeting ID if the server request fails
      return { meetingId, hostId, meetingName, createdAt: new Date().toISOString() }
    }
  }
  
  /**
   * Fetches all meetings from the server
   */
  export async function fetchMeetings() {
    const backendUrl =
      process.env.BACKEND_URL || localStorage.getItem("BACKEND_URL") 
  
    try {
      const response = await fetch(`${backendUrl}/test-meetings`)
  
      if (!response.ok) {
        throw new Error(`Failed to fetch meetings: ${response.statusText}`)
      }
  
      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error fetching meetings:", error)
      return []
    }
  }
  
  /**
   * Checks if the server is healthy
   */
  export async function checkServerHealth() {
    const backendUrl =
      process.env.BACKEND_URL || localStorage.getItem("BACKEND_URL") 
  
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
   * Generates a random meeting ID
   */
  function generateMeetingId() {
    return Math.random().toString(36).substring(2, 10)
  }
  
  