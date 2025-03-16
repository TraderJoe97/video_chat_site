const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["sonner"],
  env: {
    BACKEND_URL: process.env.BACKEND_URL ,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ,
    METERED_API_KEY: process.env.METERED_API_KEY,
  },
}

module.exports = nextConfig

