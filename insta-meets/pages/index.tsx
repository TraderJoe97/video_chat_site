import { useUser } from '@auth0/nextjs-auth0';
import { Button, Container, Text, Avatar } from '@heroui/react';
import Header from '../components/Header';
import VideoChat from '../components/VideoChat';
import { useState } from 'react';

export default function Home() {
  const { user, error, isLoading } = useUser();
  const [guestUser, setGuestUser] = useState(null);

  const loginAsGuest = () => {
    const randomId = Math.floor(Math.random() * 10000);
    setGuestUser({
      name: `Guest ${randomId}`,
      picture: '/default-avatar.png'
    });
  };

  const displayUser = user || guestUser;

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <Container css={{ marginTop: '2rem' }}>
      <Header />
      {!displayUser ? (
        <>
          <Button as="a" href="/api/auth/login">Login with Auth0</Button>
          <Button onClick={loginAsGuest} css={{ marginLeft: '1rem' }}>Continue as Guest</Button>
        </>
      ) : (
        <>
          <Avatar src={displayUser.picture} text={displayUser.name} />
          <Text>Welcome, {displayUser.name}</Text>
          {user && <Button as="a" href="/api/auth/logout">Logout</Button>}
          <VideoChat />
        </>
      )}
    </Container>
  );
}
