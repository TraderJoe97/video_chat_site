"use client"
import type React from "react"
import { useRef, useEffect } from "react"
import useWebRTC from "../hooks/useWebRTC"

const VideoChat: React.FC = () => {
  const roomId = "default-room"
  const { localStream, remoteStreams } = useWebRTC(roomId)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-gray-900 text-white">
      <h2 className="text-2xl font-bold">WebRTC Video Chat</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-64 h-48 bg-black rounded-lg border-2 border-white"
        />
        {Array.from(remoteStreams).map(([userId, stream]) => (
          <RemoteVideo key={userId} stream={stream} />
        ))}
      </div>
    </div>
  )
}

const RemoteVideo: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return <video ref={videoRef} autoPlay playsInline className="w-64 h-48 bg-black rounded-lg border-2 border-white" />
}

export default VideoChat

