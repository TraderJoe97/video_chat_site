"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { io, Socket } from "socket.io-client";
import Peer, { SignalData } from "simple-peer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, VideoIcon, VideoOff, PhoneOff, MessageSquare, Users, Share, Copy } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { ParticipantsPanel } from "@/components/participants-panel";
import { toast } from "sonner";

interface Message {
  text: string;
  sender: string;
  timestamp: string;
}

interface Participant {
  id: string;
  name: string;
  isYou?: boolean;
}

interface Peers {
  [key: string]: Peer.Instance;
}

interface Streams {
  [key: string]: MediaStream;
}

export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth0();

  // State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peers, setPeers] = useState<Peers>({});
  const [streams, setStreams] = useState<Streams>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Peers>({});
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string>(isAuthenticated ? user?.sub || "Guest" : searchParams.get("name") || "Guest");

  // Initialize meeting
  useEffect(() => {
    // If not authenticated and no name provided, ask for name
    if (!isAuthenticated && !searchParams.get("name")) {
      const userName = prompt("Please enter your name to join the meeting", "Guest");
      if (userName) {
        userIdRef.current = userName;
      }
    }

    // Initialize media and socket
    const init = async () => {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Connect to socket server
        const socketConnection = io(process.env.BACKEND_URL || "http://localhost:4000");
        socketRef.current = socketConnection;
        setSocket(socketConnection);

        // Socket events
        socketConnection.on("connect", () => {
          console.log("Connected to socket server");
          socketConnection.emit("join-room", {
            meetingId: id,
            userId: userIdRef.current,
          });
        });

        socketConnection.on("user-connected", (userId: string) => {
          console.log("User connected:", userId);
          setParticipants((prev) => [...prev, { id: userId, name: userId }]);

          const peer = createPeer(userId, socketConnection.id, stream);
          peersRef.current[userId] = peer;

          setPeers((prevPeers) => ({
            ...prevPeers,
            [userId]: peer,
          }));
        });

        socketConnection.on("user-disconnected", (userId: string) => {
          console.log("User disconnected:", userId);
          setParticipants((prev) => prev.filter((p) => p.id !== userId));

          if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];

            setPeers((prevPeers) => {
              const newPeers = { ...prevPeers };
              delete newPeers[userId];
              return newPeers;
            });

            setStreams((prevStreams) => {
              const newStreams = { ...prevStreams };
              delete newStreams[userId];
              return newStreams;
            });
          }
        });

        socketConnection.on("createMessage", (message: Message) => {
          setMessages((prev) => [...prev, message]);
        });

        // WebRTC signaling
        socketConnection.on("offer", (data: { offer: SignalData; callerId: string }) => {
          const peer = addPeer(data.offer, data.callerId, localStream);
          peersRef.current[data.callerId] = peer;

          setPeers((prevPeers) => ({
            ...prevPeers,
            [data.callerId]: peer,
          }));
        });

        socketConnection.on("answer", (data: { answer: SignalData; callerId: string }) => {
          if (peersRef.current[data.callerId]) {
            peersRef.current[data.callerId].signal(data.answer);
          }
        });

        socketConnection.on("candidate", (data: { candidate: SignalData; callerId: string }) => {
          if (peersRef.current[data.callerId]) {
            peersRef.current[data.callerId].signal(data.candidate);
          }
        });

        setIsConnecting(false);
      } catch (error) {
        console.error("Error initializing meeting:", error);
        toast.error("Could not access camera or microphone. Please check permissions.");
        setIsConnecting(false);
      }
    };

    init();

    // Cleanup
    return () => {
      // Stop local stream tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      // Close all peer connections
      Object.values(peersRef.current).forEach((peer) => {
        if (peer) {
          peer.destroy();
        }
      });

      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [id, isAuthenticated, searchParams]);

  // Create a peer (initiator)
  const createPeer = (userId: string, socketId: string, stream: MediaStream) => {
    console.log(`Creating peer for ${userId}`);
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Added STUN server
    });

    peer.on("signal", (data) => {
      console.log(`Sending offer to ${userId}`);
      socketRef.current?.emit("offer", { meetingId: id, callerId: socketId, userId, offer: data });
    });

    peer.on("stream", (remoteStream) => {
      console.log(`Received stream from ${userId}`);
      setStreams((prevStreams) => ({ ...prevStreams, [userId]: remoteStream }));
    });

    return peer;
  };

  // Add a peer (receiver)
  const addPeer = (incomingSignal: SignalData, callerId: string, stream: MediaStream) => {
    console.log(`Adding peer for ${callerId}`);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Added STUN server
    });

    peer.on("signal", (data) => {
      console.log(`Sending answer to ${callerId}`);
      socketRef.current?.emit("answer", { meetingId: id, callerId, answer: data });
    });

    peer.on("stream", (remoteStream) => {
      console.log(`Received stream from ${callerId}`);
      setStreams((prevStreams) => ({ ...prevStreams, [callerId]: remoteStream }));
    });

    peer.signal(incomingSignal);
    return peer;
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  // Send message
  const sendMessage = (text: string) => {
    if (socket && text.trim()) {
      const messageData = {
        text,
        sender: userIdRef.current,
        timestamp: new Date().toISOString(),
        meetingId: id,
      };
      socket.emit("message", messageData);
      setMessages((prev) => [...prev, messageData]);
    }
  };

  // Share meeting link
  const shareMeeting = () => {
    const meetingLink = `${window.location.origin}/meeting/${id}`;
    navigator.clipboard.writeText(meetingLink);
    toast.success("Meeting link copied to clipboard");
  };

  // Leave meeting
  const leaveMeeting = () => {
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Meeting header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">Meeting: {id}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={shareMeeting}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowParticipants(!showParticipants)}>
            <Users className="h-4 w-4 mr-2" />
            Participants ({Object.keys(peers).length + 1})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 overflow-auto">
          {isConnecting ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr h-full">
              {/* Local video */}
              <Card className="relative overflow-hidden">
                <video
                  ref={localVideoRef}
                  muted
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${!videoEnabled ? "hidden" : ""}`}
                />
                {!videoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-2xl text-primary-foreground font-bold">
                      {userIdRef.current.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-sm">
                  You {!audioEnabled && `(muted)`}
                </div>
              </Card>

              {/* Remote videos */}
              {Object.entries(streams).map(([userId, stream]) => (
                <Card key={userId} className="relative overflow-hidden">
                  <video
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(el) => {
                      if (el) el.srcObject = stream;
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-sm">{userId}</div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Side panels */}
        {showChat && (
          <div className="w-80 border-l bg-background flex flex-col h-full">
            <ChatPanel messages={messages} sendMessage={sendMessage} currentUser={userIdRef.current} />
          </div>
        )}

        {showParticipants && (
          <div className="w-80 border-l bg-background flex flex-col h-full">
            <ParticipantsPanel
              participants={[...participants, { id: userIdRef.current, name: userIdRef.current, isYou: true }]}
            />
          </div>
        )}
      </div>

      {/* Meeting controls */}
      <footer className="p-4 border-t bg-background">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={audioEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={toggleAudio}
            className="rounded-full h-12 w-12"
          >
            {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button
            variant={videoEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full h-12 w-12"
          >
            {videoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={() => {
              navigator.mediaDevices
                .getDisplayMedia({ video: true })
                .then((stream) => {
                  const videoTrack = stream.getVideoTracks()[0];

                  Object.values(peersRef.current).forEach((peer) => {
                    const sender = peer.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) {
                      sender.replaceTrack(videoTrack);
                    }
                  });

                  videoTrack.onended = () => {
                    if (localStream) {
                      const originalVideoTrack = localStream.getVideoTracks()[0];
                      Object.values(peersRef.current).forEach((peer) => {
                        const sender = peer.getSenders().find((s) => s.track?.kind === "video");
                        if (sender) {
                          sender.replaceTrack(originalVideoTrack);
                        }
                      });
                    }
                  };
                })
                .catch((err) => {
                  console.error("Error sharing screen:", err);
                  toast.error("Could not share screen. Please check permissions.");
                });
            }}
          >
            <Share className="h-5 w-5" />
          </Button>
          <Button variant="destructive" size="icon" onClick={leaveMeeting} className="rounded-full h-12 w-12">
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
} 

