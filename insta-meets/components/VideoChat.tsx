import React, { useRef, useEffect, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Button, Container, Input, Text } from '@heroui/react';

const VideoChat = () => {
  const { localStream, remoteStreams, startLocalStream, callAll, sendMessage } = useWebRTC();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleSendMessage = () => {
    if (message.trim() !== '') {
      sendMessage({ sender: 'You', message });
      setMessage('');
    }
  };

  return (
    <Container css={{ marginTop: '2rem' }}>
      <Text h3>Video Chat</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '300px', height: '200px', backgroundColor: 'black' }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem'
          }}
        >
          {remoteStreams.map((stream, idx) => (
            <video
              key={stream.id || idx}
              autoPlay
              playsInline
              style={{ width: '100%', height: 'auto', backgroundColor: 'black' }}
              ref={(video) => {
                if (video) {
                  video.srcObject = stream;
                }
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <Button onClick={async () => await startLocalStream()}>Start Video</Button>
        {/* Replace the hard-coded participant IDs with actual IDs as per your signaling logic */}
        <Button onClick={() => callAll(['participant1', 'participant2'])} css={{ marginLeft: '0.5rem' }}>
          Call Others
        </Button>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <Text h4>Chat</Text>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyPress={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
          css={{ marginTop: '1rem' }}
        />
        <Button onClick={handleSendMessage} css={{ marginTop: '0.5rem' }}>Send</Button>
      </div>
    </Container>
  );
};

export default VideoChat;
