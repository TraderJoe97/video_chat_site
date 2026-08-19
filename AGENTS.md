<!-- bmad:context -->
<!-- Verified 2026-08-19 against f4e7739. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## video_chat_site

Full-stack real-time video conferencing platform powered by a Next.js 16 frontend (`insta-meets`), an ASP.NET Core 10 & SignalR backend (`backend`), and a Mediasoup v3 Selective Forwarding Unit (SFU) media service (`sfu`). Meeting and chat persistence is backed by Supabase PostgreSQL with in-memory fallbacks. Planning and architectural artifacts live in `_bmad-output/`.

## Policy

- Personal project: direct commits and branch pushes are allowed; PR gating is not required.
- Environment variables are only configured in deployed runtime environments; development runs on local defaults without required env files.

## Where things are

- Frontend application (Next.js 16, React 19, Tailwind v4, mediasoup-client, SignalR): `insta-meets/`
- ASP.NET Core 10 Web API & SignalR Hub: `backend/` (entry: `backend/Program.cs`)
- Mediasoup SFU Node.js service (WebRTC worker pool, transports, producers/consumers): `sfu/` (entry: `sfu/index.mjs`)
- Supabase SQL schema & migrations: `supabase/schema.sql`
- Unified production container configuration: `Dockerfile`, `docker-compose.yml`, `supervisord.conf`

## Running and verifying

- Frontend: `cd insta-meets && npm run dev` (Turbopack on port 3000 with proxy rewrites to `/api`, `/hubs`, and `/sfu`). Run `npm run build` to verify production builds.
- .NET Backend: `cd backend && dotnet run` (HTTP on port 5000).
- Mediasoup SFU: `cd sfu && node index.mjs` (Socket.io on port 4000, WebRTC UDP on ports 20000–29999).
- Unified Docker Container: `docker-compose up --build` (starts both .NET and Mediasoup in 1 container).

## Conventions that differ from defaults

- Client requests proxy through Next.js rewrites (`/api`, `/hubs`, `/sfu`) to eliminate CORS issues and hardcoded ports.
- Mediasoup SFU replaces full-mesh P2P with $O(1)$ video/audio publishing and server-side RTP distribution.
- Supabase service falls back seamlessly to thread-safe in-memory stores when `SUPABASE_URL`/`SUPABASE_KEY` are absent.

<!-- /bmad:context -->
