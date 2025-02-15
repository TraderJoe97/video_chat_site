"use client"
import { useUser } from '@auth0/nextjs-auth0';
import { Button, Card, Avatar } from '@heroui/react';
import { Textarea } from '@heroui/react';
import Header from '@/components/Header';
import VideoChat from '@/components/VideoChat';
import { useState } from 'react';


interface User {
  name: string;
  picture: string;
}
export default function Home() {
  const { user, error, isLoading } = useUser();
  const [guestUser, setGuestUser] = useState<User | null>(null);

  const loginAsGuest = () => {
    const randomId = Math.floor(Math.random() * 10000);
    setGuestUser({
      name: `Guest ${randomId}`,
      picture: '/default-avatar.png'
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error?.message}</div>;

  const displayUser = user ?? guestUser;

  if (!displayUser) {
    return (
      <Card css={{ marginTop: '2rem' }}>
        <Header />
        <Button as="a" href="/api/auth/login">Login with Auth0</Button>
        <Button onClick={loginAsGuest} css={{ marginLeft: '1rem' }}>Continue as Guest</Button>
      </Card>
    );
  }

  return (
    <Card css={{ marginTop: '2rem' }}>
      <Header />
      <Avatar src={displayUser.picture} alt={displayUser.name} />
      <Textarea>Welcome, {displayUser.name}</Textarea>
      {user && <Button as="a" href="/api/auth/logout">Logout</Button>}
      <VideoChat />
    </Card>
  );
}

