import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'https://video-chat-backend-pd1m.onrender.com';

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const socketRef = useRef<any>(null);
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);
    socketRef.current = socket;

    socket.on('offer', async ({ from, offer }) => {
      if (!peerConnections.current[from]) {
        createPeerConnection(from);
      }
      await peerConnections.current[from].setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnections.current[from].createAnswer();
      await peerConnections.current[from].setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    });

    socket.on('answer', async ({ from, answer }) => {
      if (peerConnections.current[from]) {
        await peerConnections.current[from].setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', ({ from, candidate }) => {
      if (peerConnections.current[from]) {
        peerConnections.current[from].addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
      }
    });

    socket.on('participant-disconnect', ({ id }) => {
      setRemoteStreams(prev => prev.filter(stream => stream.id !== id));
      if (peerConnections.current[id]) {
        peerConnections.current[id].close();
        delete peerConnections.current[id];
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = (id: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnections.current[id] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      setRemoteStreams(prev => {
        if (!prev.find(stream => stream.id === incomingStream.id)) {
          return [...prev, incomingStream];
        }
        return prev;
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { to: id, candidate: event.candidate });
      }
    };
  };

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      throw error;
    }
  };

  const callAll = async (participantIds: string[]) => {
    for (const id of participantIds) {
      if (!peerConnections.current[id]) {
        createPeerConnection(id);
      }
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnections.current[id].addTrack(track, localStream);
        });
      }
      const offer = await peerConnections.current[id].createOffer();
      await peerConnections.current[id].setLocalDescription(offer);
      socketRef.current.emit('offer', { to: id, offer });
    }
  };

  const sendMessage = (message: { sender: string; message: string }) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', message);
    }
  };

  return { localStream, remoteStreams, startLocalStream, callAll, sendMessage };
};
