"use client"

import type React from "react"

import { Auth0Provider } from "@auth0/auth0-react"
import { useRouter } from "next/navigation"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const onRedirectCallback = (appState: any) => {
    router.push(appState?.returnTo || "/dashboard")
  }

  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "dev-q5303arr556nbtzi.jp.auth0.com"}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "LdFta1zibLwjcB1irJlFDKkvdNUlNUYZ"}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  )
}

