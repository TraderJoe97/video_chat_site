import React, { useRef, useEffect, useState } from "react";
import { Button as HerouiButton } from "@heroui/button";
import {Card as HerouiCard} from "@heroui/card";
import { Input, Textarea as Text } from "@heroui/input";

import { useWebRTC } from "../hooks/useWebRTC";

const VideoChat = () => {
  const { localStream, remoteStreams, startLocalStream, callAll, sendMessage } =
    useWebRTC();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleSendMessage = () => {
    if (message.trim() !== "") {
      sendMessage({ sender: "You", message });
      setMessage("");
    }
  };

  return (
    <HerouiCard>
      <Text>Video Chat</Text>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "300px", height: "200px", backgroundColor: "black" }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1rem",
          }}
        >
          {remoteStreams.map((stream, idx) => (
            <video
              key={stream.id || idx}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "auto",
                backgroundColor: "black",
              }}
              ref={(video) => {
                if (video && stream) {
                  video.srcObject = stream;
                }
              }}
            >
              <track kind="captions" srcLang="en" src="" label="English Captions" />
            </video>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <HerouiButton onPress={async () => await startLocalStream()}>
          Start Video
        </HerouiButton>
        {participantIds.map((id) => (
          <HerouiButton
            key={id}
            onPress={() => callAll([id])}
            css={{ marginLeft: "0.5rem" }}
          >
            Call {id}
          </HerouiButton>
        ))}
        <HerouiButton
          onPress={() => callAll(["participant1", "participant2"])}
          css={{ marginLeft: "0.5rem" }}
        >
          Call Others
        </HerouiButton>
      </div>
      <div style={{ marginTop: "2rem" }}>
        <Text h4>Chat</Text>
        <Input
          value={message}
          placeholder="Type a message..."
          onChange={(e) => setMessage(e.target.value)}
          onPress={(e) => {
            if (e.key === "Enter") handleSendMessage();
          }}
        />
        <HerouiButton onPress={handleSendMessage} >
          Send
        </HerouiButton>
      </div>
    </HerouiCard>
  );
};

export default VideoChat;

