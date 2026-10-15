# Live demonstration runbook

1. Start the web and real-time services with `npm run dev`.
2. Open the landing page and create a private room with Big Buck Bunny.
3. Copy the link and open it in an incognito browser; join as a second guest.
4. Start playback as host, pause, then seek. Point out the versioned playback state and health status.
5. Send chat, reactions, queue a second title, and create a poll.
6. Transfer host in the room menu. Verify the original host’s play button is disabled.
7. Refresh the guest browser and show it rehydrates the current room state.
8. Run the ten-client harness and show its actual percentile output.

Do not claim restart persistence until the Prisma-backed adapter is enabled with PostgreSQL.
