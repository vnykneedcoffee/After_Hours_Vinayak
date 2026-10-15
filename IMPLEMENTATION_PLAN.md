# AfterHours implementation plan

## Architecture

`apps/web` is a Next.js App Router client. `apps/realtime` is an Express + Socket.IO process and owns all room mutations. `packages/shared` contains the catalog, runtime Zod contracts and shared view models. Socket commands are validated and authorized on the server; clients only render authoritative snapshots and request actions.

## Core synchronization policy

Playback is host-controlled. Each accepted command updates `positionAtReferenceMs`, `referenceUnixMs`, and a monotonic `version`; the last server-accepted valid command wins. A client estimates the authoritative position from the server reference timestamp. It ignores drift under 120 ms, temporarily changes rate for medium drift, and performs a seek for drift of 600 ms or more. Every delivered state is acknowledged back to the server for server-side propagation measurements.

## Persistence and demo mode


The included Prisma schema models rooms, sessions, playback, playlists, messages, polls, votes and bounded diagnostics. The running server starts in in-memory demo mode until `DATABASE_URL` is configured. This is intentional to make local demonstration possible without silently pretending state survives a restart; production setup must use PostgreSQL and apply the schema.

## Security

Guests receive a signed room-scoped session token. Private rooms require the high-entropy invitation key; host claims are never accepted from the client. HTTP and socket payloads use Zod validation, commands are rate-limited, messages are bounded, and CORS is restricted to `WEB_ORIGIN`.

## Verification sequence

1. `npm install`
2. `npm run test`
3. `npm run dev`, open two browser windows, create then join a room.
4. `npm run test:load` while the real-time server is running to collect 10-client propagation data.
5. Add `DATABASE_URL`, run `npm run db:generate` and `npm run db:migrate` before deployment.

## Deployment

Deploy `apps/web` to Vercel and `apps/realtime` to a persistent Node/WebSocket host such as Railway or Render. Configure `NEXT_PUBLIC_REALTIME_URL` at build time, then restrict `WEB_ORIGIN` to the deployed web URL. Use managed PostgreSQL, a non-default `SESSION_SECRET`, HTTPS, and a verified browser-to-browser smoke test before claiming deployment success.
