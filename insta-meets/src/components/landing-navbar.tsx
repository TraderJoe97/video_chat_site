"use client"

import Link from "next/link"
import { useAuth0 } from "@auth0/auth0-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Video } from "lucide-react"

export function LandingNavbar() {
  const { loginWithRedirect, isAuthenticated } = useAuth0()

  return (
    <header className="px-4 lg:px-6 h-16 flex items-center border-b">
      <Link className="flex items-center gap-2 font-bold" href="/">
        <Video className="h-6 w-6" />
        <span>Insta Meets</span>
      </Link>
      <nav className="ml-auto flex items-center gap-4">
        <ModeToggle />
        {isAuthenticated ? (
          <Button asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        ) : (
          <Button onClick={() => loginWithRedirect()}>Sign In</Button>
        )}
      </nav>
    </header>
  )
}

