<!-- bmad:context -->
<!-- Verified 2026-08-18 against 4f823579522c03f100d2b00e5dee94d4b0f24219. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## video_chat_site

Full-stack real-time video conferencing application consisting of a Next.js frontend (`insta-meets`) and a Node.js/Express/Socket.io signaling backend (`server`). Video and audio mesh streaming is handled via WebRTC and SimplePeer. Planning artifacts live in `_bmad-output/`.

## Policy

- Personal project: direct commits and branch pushes are allowed; PR gating is not required.
- Environment variables are only configured in deployed runtime environments; development runs on local defaults without required env files.

## Where things are

- Frontend application (Next.js 15, React 19, Tailwind v4): `insta-meets/`
- WebRTC peer connection & media stream orchestration: `insta-meets/src/hooks/use-peer-connections.tsx`
- Socket connection context: `insta-meets/src/contexts/SocketContext.tsx`
- Signaling backend (Express, Socket.io, Mongoose): `server/` (entry: `server/index.mjs`)

## Running and verifying

- Frontend: `cd insta-meets && npm run dev` (Turbopack on port 3000). Run `npm run lint` to verify frontend changes.
- Backend: `cd server && node index.mjs` (Socket.io & HTTP on port 4000).
- Run both frontend and backend concurrently during local development.

## Conventions that differ from defaults

- Backend runs directly with ES Modules via `node index.mjs` rather than building from TypeScript.
- Socket and WebRTC connections fallback to local host endpoints when environment variables are absent.

## Known pitfalls

- Signaling race conditions: peer connections in `insta-meets/src/hooks/use-peer-connections.tsx` must handle asynchronous stream arrival and renegotiation gracefully without duplicate peer instantiation or dropped signals.

<!-- /bmad:context -->
