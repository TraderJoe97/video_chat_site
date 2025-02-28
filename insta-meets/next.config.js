const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["sonner"],
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
    NEXT_PUBLIC_AUTH0_DOMAIN: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "dev-q5303arr556nbtzi.jp.auth0.com",
    NEXT_PUBLIC_AUTH0_CLIENT_ID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "LdFta1zibLwjcB1irJlFDKkvdNUlNUYZ",
  },
}

module.exports = nextConfig

