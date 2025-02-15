import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-chat-backend-pd1m.onrender.com");

export const useWebRTC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const startStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(mediaStream);
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };
    startStream();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("offer", async (offer) => {
      if (!peerConnection.current) {
        peerConnection.current = new RTCPeerConnection();
        setupPeerConnection();
      }
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", answer);
    });

    socket.on("answer", async (answer) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("ice-candidate", (candidate) => {
      if (peerConnection.current) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, []);

  const setupPeerConnection = () => {
    if (!peerConnection.current || !stream) return;

    stream.getTracks().forEach((track) => peerConnection.current!.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };
  };

  const callUser = async () => {
    peerConnection.current = new RTCPeerConnection();
    setupPeerConnection();
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", offer);
  };

  return { stream, remoteStream, callUser };
};
