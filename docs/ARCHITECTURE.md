# Architecture notes

## Trust boundary

The browser holds only a signed, room-scoped guest token. It never provides a role; the server retrieves that role from its room state. Private invitations include a random access key that is verified before a participant session is created. Socket commands carry schemas, not authority.

## Event flow

1. `POST /api/rooms` or `/api/rooms/join` validates input and issues the guest token.
2. Socket.IO validates its handshake token and `room:join` emits the authoritative room snapshot.
3. A host submits `playback:command`; the server checks host permission, applies one ordered state mutation, increments the version, and broadcasts `room:state`.
4. Each recipient acknowledges receipt with `sync:delivery`; the server records bounded delivery duration samples.
5. A reconnecting socket repeats `room:join` and receives the latest snapshot.

## Sync behavior

`expectedPosition = positionAtReference + (serverNow - referenceUnixMs) * rate` while playing. Browser clients leave drift under 120 ms alone, use a temporary ±5% rate for 120–599 ms, and seek at 600 ms or more. This is bounded and avoids a seek loop. Browser autoplay remains a browser policy; the UI tells a viewer to interact when playback is blocked.

## Command policy

Playback, selected-media changes, playlist moderation, poll lifecycle and host transfer are host-only. Participants can chat, react, vote and add to the playlist. The last server-accepted valid control wins; duplicate command IDs return the already-applied state.

## Failure behavior

The UI shows connection state and Socket.IO uses bounded exponential reconnection. Host disconnect transfers control immediately to the earliest joined online participant; if nobody is online, the current host remains assigned and can reconnect. Chat and reactions are bounded/rate-limited, and stale playback state versions are ignored in the client.
