"use client"

import type React from "react"

import { Auth0Provider, AppState } from "@auth0/auth0-react"
import { useRouter } from "next/navigation"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

const onRedirectCallback = (appState?: AppState) => {
  router.push(appState?.returnTo || "/dashboard")
}
  return (
    <Auth0Provider
      domain={process.env.AUTH0_DOMAIN || "" }
      clientId={process.env.AUTH0_CLIENT_ID || ""}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  )
}

