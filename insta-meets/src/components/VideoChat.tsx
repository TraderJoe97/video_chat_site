"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import useWebRTC from "../hooks/useWebRTC"
import { ShareIcon, PlusIcon, LoginIcon } from "@heroicons/react/outline"

const VideoChat: React.FC = () => {
  const searchParams = useSearchParams()
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [newRoomName, setNewRoomName] = useState("")
  const { localStream, remoteStreams } = useWebRTC(selectedRoom || "")

  useEffect(() => {
    const roomId = searchParams.get("room")
    if (roomId) {
      setSelectedRoom(roomId)
    }
    fetchRooms()
  }, [searchParams])

  const fetchRooms = async () => {
    const response = await fetch("/api/rooms")
    const data = await response.json()
    setRooms(data)
  }

  const createRoom = async () => {
    if (newRoomName) {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoomName, userId: "user-id" }), // Replace 'user-id' with actual user ID
      })
      const room = await response.json()
      setRooms([...rooms, room])
      setNewRoomName("")
      joinRoom(room.id)
    }
  }

  const joinRoom = (roomId: string) => {
    setSelectedRoom(roomId)
  }

  const shareRoom = () => {
    if (selectedRoom) {
      const roomUrl = `${window.location.origin}/room/${selectedRoom}`
      navigator.clipboard.writeText(roomUrl).then(
        () => {
          alert("Room link copied to clipboard!")
        },
        (err) => {
          console.error("Could not copy text: ", err)
        },
      )
    }
  }

  if (selectedRoom) {
    return (
      <div className="flex flex-col items-center space-y-4 p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
        <h2 className="text-2xl font-bold">Video Chat Room</h2>
        <button
          onClick={shareRoom}
          className="mb-4 flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          <ShareIcon className="w-5 h-5 mr-2" />
          Share Room
        </button>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {localStream && (
            <video
              autoPlay
              playsInline
              muted
              ref={(video) => {
                if (video) video.srcObject = localStream
              }}
              className="w-64 h-48 bg-black rounded-lg border-2 border-blue-500"
            />
          )}
          {Array.from(remoteStreams).map(([userId, stream]) => (
            <video
              key={userId}
              autoPlay
              playsInline
              ref={(video) => {
                if (video) video.srcObject = stream
              }}
              className="w-64 h-48 bg-black rounded-lg border-2 border-blue-500"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
      <h2 className="text-2xl font-bold">WebRTC Video Chat</h2>
      <div className="w-full max-w-md bg-white dark:bg-gray-700 shadow-md rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Create a New Room</h3>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name"
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createRoom}
            className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create
          </button>
        </div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-gray-700 shadow-md rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Available Rooms</h3>
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id} className="flex justify-between items-center">
              <span>{room.name}</span>
              <button
                onClick={() => joinRoom(room.id)}
                className="flex items-center px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <LoginIcon className="w-4 h-4 mr-2" />
                Join
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default VideoChat

