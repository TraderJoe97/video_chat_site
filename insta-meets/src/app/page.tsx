import { Button } from "@/components/ui/button"
import { MoveRight, Video } from "lucide-react"
import Link from "next/link"
import { LandingNavbar } from "@/components/landing-navbar"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <LandingNavbar />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Connect Instantly with Insta Meets
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    High-quality video meetings for teams and individuals. Secure, reliable, and easy to use.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/dashboard">
                    <Button size="lg" className="gap-1.5">
                      Start a meeting <MoveRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/join">
                    <Button size="lg" variant="outline" className="gap-1.5">
                      Join a meeting <Video className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="mx-auto lg:ml-auto flex justify-center">
                <div className="relative h-[350px] w-[350px] sm:h-[400px] sm:w-[400px] lg:h-[500px] lg:w-[500px]">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 blur-3xl opacity-20" />
                  <div className="relative h-full w-full rounded-xl border border-border bg-background p-4 shadow-xl">
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-muted p-4">
                      <Video className="h-24 w-24 text-primary" />
                      <h3 className="mt-4 text-xl font-bold">Instant Meetings</h3>
                      <p className="mt-2 text-center text-sm text-muted-foreground">
                        Connect with anyone, anywhere with just a click
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Features that make meetings better
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Everything you need for seamless collaboration
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 rounded-lg p-4">
                <div className="rounded-full bg-primary p-2 text-primary-foreground">
                  <Video className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">HD Video</h3>
                <p className="text-center text-muted-foreground">Crystal clear video for all your meetings</p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg p-4">
                <div className="rounded-full bg-primary p-2 text-primary-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="M22 2H2v20" />
                    <path d="M21 7v13H7" />
                    <path d="M16 2v5h5" />
                    <path d="M12 18a6 6 0 0 0 0-12c-3.3 0-6 2.7-6 6v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Screen Sharing</h3>
                <p className="text-center text-muted-foreground">Share your screen with participants</p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg p-4">
                <div className="rounded-full bg-primary p-2 text-primary-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">In-Meeting Chat</h3>
                <p className="text-center text-muted-foreground">Send messages during your meetings</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full border-t items-center px-4 md:px-6">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Insta Meets. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  )
}

