"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import Peer from "simple-peer";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  VideoIcon,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  MessageSquare,
  Users,
  Hand,
  FlagOffIcon as HandOff,
  Maximize,
  Minimize,
  WifiOff,
} from "lucide-react";
import ChatPanel from "@/components/chat-panel";
import { ParticipantsPanel } from "@/components/participants-panel";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PeerVideo } from "@/components/peer-video";
import { JoinMeetingModal } from "@/components/join-meeting-modal";

interface PeerConnection {
  peerId: string;
  peer: Peer.Instance;
  stream?: MediaStream;
  username: string;
}

interface Message {
  senderId: string;
  content: string;
  timestamp: string;
}

interface Participant {
  id: string;
  name: string;
  isYou?: boolean;
  isSpeaking?: boolean;
  hasHandRaised?: boolean;
}

export default function MeetingPage() {
  const { id: meetingId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const guestName = searchParams.get("name");
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { user, isAuthenticated,  isLoading } = useAuth0();

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<string>("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Meeting state
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isJoined, setIsJoined] = useState(false);

  // Refs
  const peersRef = useRef<PeerConnection[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Determine if user is guest or authenticated
  useEffect(() => {
    if (!isLoading) {
      // If authenticated, use Auth0 user info
      if (isAuthenticated && user) {
        setUserId(user.sub || user.email || `user-${Date.now()}`);
        setUsername(user.name || user.email || "Authenticated User");
      }
      // If not authenticated but has guest name, use that
      else if (guestName == 'guest'.toLowerCase().trim()) {
        setUserId(`guest-${Date.now()}`);
        setUsername(guestName);
      } else {
        JoinMeetingModal({meetingId: meetingId,isOpen: true, onClose: MeetingPage})
      }
     
    }
  }, [isLoading, isAuthenticated, user, guestName]);

  // Debug logging for user identification
  useEffect(() => {
    if (userId && username) {
      console.log(
        `[Meeting] User identified - ID: ${userId}, Name: ${username}`
      );
    }
  }, [userId, username]);

  // Initialize media and join meeting
  useEffect(() => {
    // Only proceed if we have user info and socket connection
    if (!userId || !username || !socket || !isConnected) return;

    console.log(
      `[Meeting] Initializing media and joining meeting ${meetingId}`
    );

    const initializeMediaAndJoinMeeting = async () => {
      try {
        console.log("[Meeting] Requesting media devices...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        console.log(
          `[Meeting] Media access granted - Video tracks: ${
            stream.getVideoTracks().length
          }, Audio tracks: ${stream.getAudioTracks().length}`
        );

        // Store stream in ref for consistent access
        streamRef.current = stream;

        if (localVideoRef.current) {
          console.log("[Meeting] Setting local video stream");
          localVideoRef.current.srcObject = stream;
        } else {
          console.error("[Meeting] Local video ref is null");
        }

        setLocalStream(stream);
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);

        // Add yourself to participants
        const currentUser: Participant = {
          id: userId,
          name: username,
          isYou: true,
        };

        setParticipants((prev) => {
          if (prev.some((p) => p.id === currentUser.id)) return prev;
          return [...prev, currentUser];
        });

        // Join the meeting room
        console.log(
          `[Meeting] Joining room ${meetingId} as ${username} (${userId})`
        );
        socket.emit("join-room", {
          meetingId,
          userId,
          username,
        });

        setIsJoined(true);
        toast.success("Joined meeting successfully");
      } catch (error) {
        console.error("[Meeting] Failed to get media devices:", error);
        toast.error("Failed to access camera or microphone");

        // Join without media as a fallback
        console.log("[Meeting] Joining meeting without media as fallback");

        // Add yourself to participants
        const currentUser: Participant = {
          id: userId,
          name: username,
          isYou: true,
        };

        setParticipants((prev) => {
          if (prev.some((p) => p.id === currentUser.id)) return prev;
          return [...prev, currentUser];
        });

        // Join the meeting room without media
        socket.emit("join-room", {
          meetingId,
          userId,
          username,
        });

        setIsJoined(true);
        toast.warning("Joined meeting without camera/microphone");
      }
    };

    initializeMediaAndJoinMeeting();

    return () => {
      // Clean up
      console.log("[Meeting] Cleaning up resources");
      if (streamRef.current) {
        console.log("[Meeting] Stopping all media tracks");
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Disconnect peers
      console.log(
        `[Meeting] Destroying ${peersRef.current.length} peer connections`
      );
      peersRef.current.forEach(({ peer }) => {
        peer.destroy();
      });

      // Leave the room
      if (socket && userId) {
        console.log(`[Meeting] Leaving room ${meetingId}`);
        socket.emit("leave-room", {
          meetingId,
          userId,
        });
      }
    };
  }, [isConnected, socket, userId, username, meetingId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !userId || !isJoined) return;

    console.log("[Meeting] Setting up socket event handlers");

    // Handle new user connected
    const handleUserConnected = (data: {
      userId: string;
      username: string;
    }) => {
      console.log(
        `[Meeting] User connected: ${data.username} (${data.userId})`
      );

      // Add to participants list
      setParticipants((prev) => {
        if (prev.some((p) => p.id === data.userId)) return prev;
        return [...prev, { id: data.userId, name: data.username }];
      });

      // Create a new peer connection if we have a stream
      if (streamRef.current) {
        console.log(
          `[Meeting] Creating peer connection to ${data.username} (${data.userId})`
        );
        const peer = createPeer(data.userId, userId, streamRef.current);

        peersRef.current.push({
          peerId: data.userId,
          peer,
          username: data.username,
        });

        setPeers((prev) => [
          ...prev,
          {
            peerId: data.userId,
            peer,
            username: data.username,
          },
        ]);
      } else {
        console.log(
          `[Meeting] No local stream available, skipping peer creation for ${data.userId}`
        );
      }
    };

    // Handle existing participants
    const handleExistingParticipants = (
      participants: { userId: string; username: string }[]
    ) => {
      console.log(
        `[Meeting] Received ${participants.length} existing participants`
      );

      // Only proceed if we have a stream
      if (!streamRef.current) {
        console.log(
          "[Meeting] No local stream available, skipping peer creation for existing participants"
        );

        // Still add participants to the list
        participants.forEach((participant) => {
          setParticipants((prev) => {
            if (prev.some((p) => p.id === participant.userId)) return prev;
            return [
              ...prev,
              { id: participant.userId, name: participant.username },
            ];
          });
        });

        return;
      }

      participants.forEach((participant) => {
        console.log(
          `[Meeting] Processing existing participant: ${participant.username} (${participant.userId})`
        );

        // Add to participants list
        setParticipants((prev) => {
          if (prev.some((p) => p.id === participant.userId)) return prev;
          return [
            ...prev,
            { id: participant.userId, name: participant.username },
          ];
        });

        // Create a new peer connection
        console.log(
          `[Meeting] Creating peer connection to ${participant.username} (${participant.userId})`
        );
        const peer = createPeer(participant.userId, userId, streamRef.current!);

        peersRef.current.push({
          peerId: participant.userId,
          peer,
          username: participant.username,
        });

        setPeers((prev) => [
          ...prev,
          {
            peerId: participant.userId,
            peer,
            username: participant.username,
          },
        ]);
      });
    };

    // Handle user disconnected
    const handleUserDisconnected = (userId: string) => {
      console.log(`[Meeting] User disconnected: ${userId}`);

      // Remove from participants list
      setParticipants((prev) => prev.filter((p) => p.id !== userId));

      // Close and remove peer connection
      const peerObj = peersRef.current.find((p) => p.peerId === userId);
      if (peerObj) {
        console.log(`[Meeting] Destroying peer connection to ${userId}`);
        peerObj.peer.destroy();
      }

      peersRef.current = peersRef.current.filter((p) => p.peerId !== userId);
      setPeers((prev) => prev.filter((p) => p.peerId !== userId));
    };

    // Handle WebRTC signaling - offer
    const handleOffer = (data: {
      callerId: string;
      offer: Peer.SignalData;
    }) => {
      console.log(`[Meeting] Received offer from: ${data.callerId}`);

      if (!streamRef.current) {
        console.log(
          `[Meeting] No local stream available, cannot answer offer from ${data.callerId}`
        );
        return;
      }

      console.log(`[Meeting] Creating answer peer for ${data.callerId}`);
      const peer = addPeer(
        data.callerId,
        userId,
        data.offer,
        streamRef.current
      );

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId);
      const username = peerObj?.username || data.callerId;

      if (!peerObj) {
        console.log(
          `[Meeting] Adding new peer connection for ${data.callerId}`
        );
        peersRef.current.push({
          peerId: data.callerId,
          peer,
          username,
        });

        setPeers((prev) => [
          ...prev,
          {
            peerId: data.callerId,
            peer,
            username,
          },
        ]);
      }
    };

    // Handle WebRTC signaling - answer
    const handleAnswer = (data: {
      callerId: string;
      answer: Peer.SignalData;
    }) => {
      console.log(`[Meeting] Received answer from: ${data.callerId}`);

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId);
      if (peerObj) {
        console.log(`[Meeting] Applying answer signal from ${data.callerId}`);
        peerObj.peer.signal(data.answer);
      } else {
        console.log(
          `[Meeting] No peer found for ${data.callerId}, cannot apply answer`
        );
      }
    };

    // Handle WebRTC signaling - ICE candidate
    const handleCandidate = (data: {
      callerId: string;
      candidate: RTCIceCandidate;
    }) => {
      console.log(`[Meeting] Received ICE candidate from: ${data.callerId}`);

      const peerObj = peersRef.current.find((p) => p.peerId === data.callerId);
      if (peerObj) {
        console.log(`[Meeting] Applying ICE candidate from ${data.callerId}`);
        peerObj.peer.signal({ type: "candidate", candidate: data.candidate });
      } else {
        console.log(
          `[Meeting] No peer found for ${data.callerId}, cannot apply ICE candidate`
        );
      }
    };

    // Handle chat messages
    const handleMessage = (message: Message) => {
      console.log(
        `[Meeting] Received message from ${message.senderId}: ${message.content}`
      );
      setMessages((prev) => [...prev, message]);
    };

    // Handle hand raise
    const handleRaiseHand = (data: { userId: string; isRaised: boolean }) => {
      console.log(
        `[Meeting] User ${data.userId} ${
          data.isRaised ? "raised" : "lowered"
        } hand`
      );
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === data.userId ? { ...p, hasHandRaised: data.isRaised } : p
        )
      );
    };

    // Register event handlers
    socket.on("user-connected", handleUserConnected);
    socket.on("existing-participants", handleExistingParticipants);
    socket.on("user-disconnected", handleUserDisconnected);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("candidate", handleCandidate);
    socket.on("createMessage", handleMessage);
    socket.on("raise-hand", handleRaiseHand);

    return () => {
      // Unregister event handlers
      console.log("[Meeting] Removing socket event handlers");
      socket.off("user-connected", handleUserConnected);
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("user-disconnected", handleUserDisconnected);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
      socket.off("createMessage", handleMessage);
      socket.off("raise-hand", handleRaiseHand);
    };
  }, [socket, userId, isJoined, meetingId]);

  // Configure WebRTC for low bandwidth
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(false);

  const configureLowBandwidth = useCallback(() => {
    if (!streamRef.current) {
      toast.error("No media stream available");
      return;
    }

    // Toggle low bandwidth mode
    const newMode = !isLowBandwidthMode;
    setIsLowBandwidthMode(newMode);

    if (newMode) {
      console.log(
        "[Meeting] Enabling low bandwidth mode - reducing outgoing stream quality"
      );

      // Reduce video resolution and bitrate for outgoing stream
      streamRef.current.getVideoTracks().forEach((track) => {
        if (track.getConstraints() && track.applyConstraints) {
          // Apply very low quality constraints for outgoing video
          track
            .applyConstraints({
              width: { ideal: 320 },
              height: { ideal: 180 },
              frameRate: { max: 10 },
            })
            .then(() => {
              console.log(
                "[Meeting] Successfully applied low bandwidth constraints"
              );
            })
            .catch((e) => {
              console.error("[Meeting] Could not apply video constraints:", e);
              toast.error("Failed to reduce video quality");
            });
        }
      });

      // Update all peer connections with the optimized stream
      let updateSuccess = true;
      peersRef.current.forEach(({ peer, username }) => {
        try {
          console.log(
            `[Meeting] Updating stream for ${username} to low bandwidth`
          );
          peer.removeStream(streamRef.current!);
          peer.addStream(streamRef.current!);
        } catch (e) {
          console.error(`[Meeting] Error updating stream for ${username}:`, e);
          updateSuccess = false;
        }
      });

      if (updateSuccess) {
        toast.success("Low bandwidth mode enabled - video quality reduced");
      } else {
        toast.warning(
          "Low bandwidth mode partially enabled - some connections may need to be refreshed"
        );
      }
    } else {
      console.log(
        "[Meeting] Disabling low bandwidth mode - restoring outgoing stream quality"
      );

      // Restore higher quality video
      streamRef.current.getVideoTracks().forEach((track) => {
        if (track.getConstraints() && track.applyConstraints) {
          // Apply higher quality constraints
          track
            .applyConstraints({
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { max: 30 },
            })
            .then(() => {
              console.log(
                "[Meeting] Successfully restored normal quality constraints"
              );
            })
            .catch((e) => {
              console.error("[Meeting] Could not apply video constraints:", e);
              toast.error("Failed to restore video quality");
            });
        }
      });

      // Update all peer connections with the restored stream
      let updateSuccess = true;
      peersRef.current.forEach(({ peer, username }) => {
        try {
          console.log(
            `[Meeting] Updating stream for ${username} to normal quality`
          );
          peer.removeStream(streamRef.current!);
          peer.addStream(streamRef.current!);
        } catch (e) {
          console.error(`[Meeting] Error updating stream for ${username}:`, e);
          updateSuccess = false;
        }
      });

      if (updateSuccess) {
        toast.success("Normal quality mode enabled");
      } else {
        toast.warning(
          "Normal quality mode partially enabled - some connections may need to be refreshed"
        );
      }
    }
  }, [isLowBandwidthMode]);

  // Monitor connection quality and suggest low bandwidth mode if needed
  useEffect(() => {
    if (!streamRef.current || isLowBandwidthMode) return;

    let connectionIssuesCount = 0;
    const connectionCheckInterval = setInterval(() => {
      // Check if we have any failed peer connections
      const failedConnections = peersRef.current.filter((p) => {
        try {
          return !p.peer.connected;
        } catch (e) {
          console.error("[Meeting] Error checking peer connection:", e);
          return true; // Count as failed if we can't determine
        }
      });

      if (failedConnections.length > 0) {
        connectionIssuesCount++;
        console.log(
          `[Meeting] Connection issues detected (${connectionIssuesCount})`
        );

        // After 2 consecutive issues, suggest low bandwidth mode
        if (connectionIssuesCount >= 2) {
          toast(
            () => (
              <div className="flex flex-col gap-2">
                <div>Connection issues detected</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    configureLowBandwidth();
                    toast.dismiss();
                  }}
                >
                  <WifiOff className="h-4 w-4 mr-2" />
                  Enable Low Bandwidth Mode
                </Button>
              </div>
            ),
            {
              duration: 10000,
            }
          );
          clearInterval(connectionCheckInterval);
        }
      } else {
        // Reset counter if connections are good
        connectionIssuesCount = 0;
      }
    }, 8000); // Check every 8 seconds

    return () => clearInterval(connectionCheckInterval);
  }, [streamRef.current, isLowBandwidthMode, configureLowBandwidth]);

  // Create a peer connection (initiator)
  const createPeer = (
    userToSignal: string,
    callerId: string,
    stream: MediaStream
  ) => {
    console.log(
      `[Meeting] Creating peer to connect with ${userToSignal} (initiator)`
    );

    const peer = new Peer({
      initiator: true,
      trickle: false,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
        iceCandidatePoolSize: 10,
      },
      sdpTransform: (sdp) => {
        // Modify SDP to prioritize connection establishment
        return sdp
          .replace(/a=ice-options:trickle\s\n/g, "")
          .replace(/a=candidate.*tcp.*\r\n/g, "");
      },
    });

    // Add stream after creation to ensure proper setup
    console.log(`[Meeting] Adding stream to peer for ${userToSignal}`);
    peer.addStream(stream);

    peer.on("signal", (signal) => {
      console.log(`[Meeting] Generated offer signal for ${userToSignal}`);
      socket?.emit("offer", {
        meetingId,
        userId: userToSignal,
        callerId,
        offer: signal,
      });
    });

    peer.on("connect", () => {
      console.log(`[Meeting] Peer connection established with ${userToSignal}`);
    });

    peer.on("error", (err) => {
      console.error(`[Meeting] Peer error with ${userToSignal}:`, err.message);
    });

    // Add connection state change handler
    peer.on("iceStateChange", (state) => {
      console.log(`[Meeting] ICE state changed for ${userToSignal}:`, state);
    });

    return peer;
  };

  // Add a peer connection (receiver)
  const addPeer = (
    callerId: string,
    userId: string,
    incomingSignal: Peer.SignalData,
    stream: MediaStream
  ) => {
    console.log(`[Meeting] Adding peer for ${callerId} (receiver)`);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
        iceCandidatePoolSize: 10,
      },
      sdpTransform: (sdp) => {
        // Modify SDP to prioritize connection establishment
        return sdp
          .replace(/a=ice-options:trickle\s\n/g, "")
          .replace(/a=candidate.*tcp.*\r\n/g, "");
      },
    });

    // Add stream after creation to ensure proper setup
    console.log(`[Meeting] Adding stream to peer for ${callerId}`);
    peer.addStream(stream);

    peer.on("signal", (signal) => {
      console.log(`[Meeting] Generated answer signal for ${callerId}`);
      socket?.emit("answer", {
        meetingId,
        callerId,
        userId,
        answer: signal,
      });
    });

    peer.on("connect", () => {
      console.log(`[Meeting] Peer connection established with ${callerId}`);
    });

    peer.on("error", (err) => {
      console.error(`[Meeting] Peer error with ${callerId}:`, err.message);
    });

    // Add connection state change handler
    peer.on("iceStateChange", (state) => {
      console.log(`[Meeting] ICE state changed for ${callerId}:`, state);
    });

    // Process the incoming signal
    console.log(`[Meeting] Processing incoming signal from ${callerId}`);
    peer.signal(incomingSignal);

    return peer;
  };

  // Toggle video
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log(
          `[Meeting] Video ${videoTrack.enabled ? "enabled" : "disabled"}`
        );
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log(
          `[Meeting] Audio ${audioTrack.enabled ? "enabled" : "disabled"}`
        );
      }
    }
  };

  // Toggle screen sharing
  const toggleScreenSharing = async () => {
    if (isScreenSharing) {
      console.log("[Meeting] Stopping screen sharing");
      // Stop screen sharing and revert to camera
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
        }
      }

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("[Meeting] Reverting to camera");

        streamRef.current = newStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }

        setLocalStream(newStream);
        setIsScreenSharing(false);

        // Update all peer connections with the new stream
        peersRef.current.forEach(({ peer }) => {
          try {
            peer.removeStream(streamRef.current!);
            peer.addStream(newStream);
            console.log("[Meeting] Updated peer with camera stream");
          } catch (error) {
            console.error(
              "[Meeting] Error updating peer after screen share:",
              error
            );
          }
        });
      } catch (error) {
        console.error("[Meeting] Error reverting to camera:", error);
        toast.error("Failed to revert to camera");
      }
    } else {
      // Start screen sharing
      try {
        console.log("[Meeting] Starting screen sharing");
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        // Keep audio from the original stream
        if (streamRef.current) {
          const audioTrack = streamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            screenStream.addTrack(audioTrack);
          }
        }

        streamRef.current = screenStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setLocalStream(screenStream);
        setIsScreenSharing(true);

        // Update all peer connections with the new stream
        peersRef.current.forEach(({ peer }) => {
          try {
            peer.removeStream(streamRef.current!);
            peer.addStream(screenStream);
            console.log("[Meeting] Updated peer with screen sharing stream");
          } catch (error) {
            console.error(
              "[Meeting] Error updating peer with screen share:",
              error
            );
          }
        });

        // Handle the case when user stops sharing via the browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          console.log("[Meeting] Screen sharing stopped via browser UI");
          toggleScreenSharing();
        };
      } catch (error) {
        console.error("[Meeting] Error sharing screen:", error);
        toast.error("Failed to share screen");
      }
    }
  };

  // Toggle hand raise
  const toggleHandRaise = () => {
    if (!socket || !userId) return;

    const newState = !isHandRaised;
    console.log(`[Meeting] ${newState ? "Raising" : "Lowering"} hand`);

    socket.emit("raise-hand", {
      meetingId,
      userId,
      isRaised: newState,
    });

    setIsHandRaised(newState);

    // Update local participant state
    setParticipants((prev) =>
      prev.map((p) => (p.isYou ? { ...p, hasHandRaised: newState } : p))
    );
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error("[Meeting] Error attempting to enable fullscreen:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Leave meeting
  const leaveMeeting = () => {
    console.log("[Meeting] Leaving meeting");
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Disconnect peers
    peersRef.current.forEach(({ peer }) => {
      peer.destroy();
    });

    // Leave the room
    if (socket && userId) {
      socket.emit("leave-room", {
        meetingId,
        userId,
      });
    }

    // Navigate to dashboard for authenticated users, or join page for guests
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/join");
    }
  };

  // Send chat message
  const sendMessage = (content: string) => {
    if (!socket || !userId) return;

    console.log(`[Meeting] Sending message: ${content}`);
    const messageData = {
      meetingId,
      senderId: userId,
      content,
      timestamp: new Date().toISOString(),
    };

    socket.emit("message", messageData);

    // Add to local messages
    setMessages((prev) => [...prev, messageData]);
  };

  // Calculate grid layout based on number of participants
  const getGridLayout = () => {
    const totalParticipants = peers.length + 1; // +1 for local user

    if (totalParticipants === 1) {
      return "grid-cols-1";
    } else if (totalParticipants === 2) {
      return "grid-cols-1 md:grid-cols-2";
    } else if (totalParticipants <= 4) {
      return "grid-cols-1 md:grid-cols-2";
    } else if (totalParticipants <= 9) {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
    } else {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    }
  };

  // Calculate video height based on number of participants
  const getVideoHeight = () => {
    const totalParticipants = peers.length + 1; // +1 for local user

    if (totalParticipants === 1) {
      return "h-full";
    } else if (totalParticipants === 2) {
      return "h-full md:h-[calc(100vh-12rem)]";
    } else if (totalParticipants <= 4) {
      return "h-64 md:h-[calc(50vh-6rem)]";
    } else if (totalParticipants <= 9) {
      return "h-48 md:h-[calc(33vh-4rem)]";
    } else {
      return "h-40 md:h-[calc(25vh-3rem)]";
    }
  };

  // Function to handle peer reconnection
  const handlePeerReconnect = (peerId: string) => {
    console.log(`[Meeting] Attempting to reconnect with peer: ${peerId}`);

    // Find and remove the existing peer
    const peerToRemove = peersRef.current.find((p) => p.peerId === peerId);
    if (peerToRemove) {
      peerToRemove.peer.destroy();
    }

    peersRef.current = peersRef.current.filter((p) => p.peerId !== peerId);
    setPeers((prev) => prev.filter((p) => p.peerId !== peerId));

    // Only attempt reconnection if we have a stream
    if (!streamRef.current) {
      console.error("[Meeting] Cannot reconnect: No local stream available");
      return;
    }

    // Get username from participants list
    const participant = participants.find((p) => p.id === peerId);
    const username = participant?.name || peerId;

    // Create a new peer connection
    const newPeer = createPeer(peerId, userId, streamRef.current);

    // Add the new peer to our lists
    const peerConnection = {
      peerId,
      peer: newPeer,
      username,
    };

    peersRef.current.push(peerConnection);
    setPeers((prev) => [...prev, peerConnection]);

    console.log(`[Meeting] Reconnection attempt initiated with ${peerId}`);
  };

  // Loading state while determining user status
  if (isLoading || (!userId && !username)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p>Preparing your meeting experience</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">Meeting: {meetingId}</h1>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  {activeTab === "chat" ? (
                    <MessageSquare className="h-5 w-5" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isLowBandwidthMode ? "default" : "outline"}
                  size="icon"
                  onClick={configureLowBandwidth}
                  className={
                    isLowBandwidthMode ? "bg-amber-500 hover:bg-amber-600" : ""
                  }
                >
                  <WifiOff className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isLowBandwidthMode
                  ? "Currently in low bandwidth mode - click to restore quality"
                  : "Optimize for slow connection (reduces video quality)"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div
          className={cn(
            "flex-1 p-4 overflow-y-auto",
            isSidebarOpen ? "md:w-2/3" : "w-full"
          )}
        >
          <div className={cn("grid gap-4", getGridLayout())}>
            {/* Local video */}
            <div className="relative group">
              <div
                className={cn(
                  "bg-muted rounded-lg overflow-hidden",
                  getVideoHeight()
                )}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {isLowBandwidthMode && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded text-xs">
                    Low Quality
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                You {isHandRaised && "✋"} {isLowBandwidthMode && "📶"}
              </div>
            </div>

            {/* Remote videos */}
            {peers.map((peer) => (
              <PeerVideo
                key={peer.peerId}
                peer={peer.peer}
                username={peer.username}
                hasHandRaised={
                  participants.find((p) => p.id === peer.peerId)?.hasHandRaised
                }
                className={getVideoHeight()}
                onReconnect={() => handlePeerReconnect(peer.peerId)}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-full md:w-1/3 border-l h-full flex flex-col">
            <Tabs
              defaultValue="chat"
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col"
            >
              <TabsList className="grid grid-cols-2 mx-4 my-2">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="participants">
                  Participants ({participants.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col">
                <ChatPanel
                  messages={messages}
                  participants={participants}
                  onSendMessage={sendMessage}
                />
              </TabsContent>

              <TabsContent value="participants" className="flex-1">
                <ParticipantsPanel participants={participants} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="p-4 border-t bg-background">
        <div className="flex items-center justify-center space-x-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAudioEnabled ? "outline" : "destructive"}
                  size="icon"
                  onClick={toggleAudio}
                  className="rounded-full h-12 w-12"
                >
                  {isAudioEnabled ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isVideoEnabled ? "outline" : "destructive"}
                  size="icon"
                  onClick={toggleVideo}
                  className="rounded-full h-12 w-12"
                >
                  {isVideoEnabled ? (
                    <VideoIcon className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isVideoEnabled ? "Turn off camera" : "Turn on camera"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "default" : "outline"}
                  size="icon"
                  onClick={toggleScreenSharing}
                  className="rounded-full h-12 w-12"
                >
                  {isScreenSharing ? (
                    <ScreenShareOff className="h-5 w-5" />
                  ) : (
                    <ScreenShare className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isScreenSharing ? "Stop sharing screen" : "Share screen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isHandRaised ? "default" : "outline"}
                  size="icon"
                  onClick={toggleHandRaise}
                  className="rounded-full h-12 w-12"
                >
                  {isHandRaised ? (
                    <HandOff className="h-5 w-5" />
                  ) : (
                    <Hand className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isHandRaised ? "Lower hand" : "Raise hand"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={leaveMeeting}
                  className="rounded-full h-12 w-12"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave meeting</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </footer>
    </div>
  );
}
