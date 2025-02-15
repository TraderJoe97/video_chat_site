import React, { useRef, useEffect } from "react";
import { useWebRTC } from "../hooks/useWebRTC";

const VideoChat: React.FC = () => {
  const { stream, remoteStream, callUser } = useWebRTC();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-gray-900 text-white">
      <h2 className="text-2xl font-bold">WebRTC Video Chat</h2>

      <div className="flex space-x-4">
        <video ref={localVideoRef} autoPlay playsInline className="w-64 h-48 bg-black rounded-lg border-2 border-white" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-64 h-48 bg-black rounded-lg border-2 border-white" />
      </div>

      <button
        onClick={callUser}
        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-800 rounded-lg text-white font-semibold"
      >
        Start Call
      </button>
    </div>
  );
};

export default VideoChat;
