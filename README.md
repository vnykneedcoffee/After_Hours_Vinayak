# AfterHours

AfterHours is a real-time watch-party platform featuring synchronized video playback, live chat, reactions, polls, and shared playlists for a seamless group movie-watching experience.

# Website Link

afterhours-watchparty.vercel.app

## What works locally

- Create public or secure private rooms and join by room code or invitation link.
- A signed guest session survives Socket.IO reconnects during the browser session.
- The server owns play, pause, seek, media selection, state versions, idempotent command IDs, and host-only authorization.
- HTML5 playback uses verified open-film sources. Late joiners receive the current playback reference state; clients correct meaningful drift without repeatedly hard-seeking.
- Live chat, emoji reactions, presence, a shared playlist, polls, explicit host transfer, and automatic deterministic host handoff are wired over Socket.IO.
- The server exposes `/health`, tracks bounded delivery samples, and includes a 10-client local test harness.

## Run it

```powershell
Copy-Item .env.example .env
npm install
npm run test
npm run dev
```

Open `http://localhost:3000`, create a party, then open its invitation in an incognito window to test a second participant. The real-time service is `http://localhost:4001` by default.

## Test a room with ten simulated clients

With the real-time server running:

```powershell
npm run test:load
```

It creates a public room, connects ten actual Socket.IO clients, sends one host playback command, waits for each recipient, and reads the server’s delivery percentile measurements from `/health`. Record the actual JSON output in `docs/PERFORMANCE_REPORT.md`; do not substitute illustrative values.

## PostgreSQL for deployment

The supplied `prisma/schema.prisma` is the durable production data model. In this first runnable slice the active store is explicitly in-memory so no one accidentally believes it survives restarts without configuring a database. Before a public deployment:

1. Create PostgreSQL (Neon/Supabase/Railway all work) and place the connection string in `DATABASE_URL`.
2. Run `npm run db:generate` and `npm run db:migrate -- --name initial`.
3. Configure a long random `SESSION_SECRET`, `WEB_ORIGIN`, `PORT`, and `NEXT_PUBLIC_REALTIME_URL` on the appropriate hosts.
4. Deploy `apps/web` to Vercel and `apps/realtime` to a persistent WebSocket-capable service—not a serverless function.
5. Open the deployed room in two separate browser sessions and run the ten-client harness against the deployed backend before calling it verified.

## Important current limitation

`DATABASE_URL` is modeled and documented but the store has not yet been switched from its no-dependency demo adapter to the Prisma repository. As a result, current local rooms are intentionally lost when the real-time process restarts. Do not represent persistence, public deployment, or the 250 ms p95 target as verified until the database adapter and measurements are completed.

## Documentation

- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Performance report template](docs/PERFORMANCE_REPORT.md)
- [Demonstration runbook](docs/DEMO_RUNBOOK.md)
