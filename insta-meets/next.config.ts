import type { NextConfig } from "next"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000"
const SFU_URL = process.env.SFU_URL || "http://localhost:4000"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["sonner"],
  env: {
    BACKEND_URL: process.env.BACKEND_URL,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    METERED_API_KEY: process.env.METERED_API_KEY,
  },
  async rewrites() {
    return [
      // Proxy ASP.NET Core REST API
      {
        source: "/api/meetings/:path*",
        destination: `${BACKEND_URL}/api/meetings/:path*`,
      },
      {
        source: "/api/health",
        destination: `${BACKEND_URL}/api/health`,
      },
      {
        source: "/test-meetings",
        destination: `${BACKEND_URL}/test-meetings`,
      },
      {
        source: "/create-meeting",
        destination: `${BACKEND_URL}/create-meeting`,
      },
      // Proxy ASP.NET Core SignalR Hub
      {
        source: "/hubs/:path*",
        destination: `${BACKEND_URL}/hubs/:path*`,
      },
      // Proxy SFU Socket
      {
        source: "/sfu/:path*",
        destination: `${SFU_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
