# Performance report — fill with actual outputs

## Test conditions

- Date/time: 13 October 2026, Asia/Kolkata.
- Backend machine and operating system: local Windows development machine.
- Browser / Node version: Node v24.20.0; this harness uses Socket.IO clients rather than browser media.
- Transport: WebSocket.
- Number of simulated clients: 10 (one host plus nine participants).
- Media source and network: in-memory local server at `localhost:4001`; the media element is not exercised by this transport harness.

## Commands

```powershell
npm run test
npm run dev
npm run test:load
```

## Measured result

Unedited output from the local run:

```json
{
  "clients": 10,
  "connectionMs": 262,
  "allRecipientsReceived": 10,
  "controlFanoutWallMs": 9,
  "serverDelivery": {
    "acceptedControls": 1,
    "rejectedControls": 0,
    "pendingDeliveries": 0,
    "p50Ms": 2.58,
    "p95Ms": 3.22,
    "p99Ms": 3.22
  }
}
```

| Metric | Actual result | Target |
| --- | --- | --- |
| Connection success | 10/10 | 10/10 |
| Server delivery p50 | 2.58 ms | Informational |
| Server delivery p95 | 3.22 ms | ≤250 ms local network |
| Server delivery p99 | 3.22 ms | Informational |
| Drift after correction | Not yet measured | ≤500 ms |

## Measurement boundary

`serverDelivery` starts immediately before the server broadcasts an accepted authoritative playback state and ends when a recipient’s `sync:delivery` message reaches the server. It is server-observed round-trip delivery confirmation, not an unsynchronized client-wall-clock one-way claim. Control fan-out wall time in the harness is auxiliary only.

## Known limitations

This is a local single-machine Socket.IO transport measurement, not a browser-media measurement and not evidence of public-network performance. Browser playback drift still needs a two-browser measurement. The current runtime deliberately uses the in-memory store until the Prisma repository is enabled, so it does not persist across a server restart.
