import { HeroUIProvider } from '@heroui/react';
import type { AppProps } from 'next/app';
import '@heroui/react/style.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <HeroUIProvider>
      <Component {...pageProps} />
    </HeroUIProvider>
  );
}

export default MyApp;
