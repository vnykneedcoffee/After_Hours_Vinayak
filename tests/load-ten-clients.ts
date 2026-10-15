/** Run with the real-time server already listening on port 4001: npm run test:load */
import { io, type Socket } from "socket.io-client";

const baseUrl = process.env.REALTIME_URL || "http://localhost:4001";
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
async function request<T>(path: string, body: unknown): Promise<T> { const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(await response.text()); return response.json() as Promise<T>; }
interface Join { room: { id: string; code: string }; token: string; accessKey?: string; }
async function connect(token: string): Promise<Socket> { const socket = io(baseUrl, { auth: { token }, transports: ["websocket"] }); await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); }); await new Promise<void>((resolve, reject) => { socket.emit("room:join", (result: { ok: boolean; error?: { message: string } }) => { if (result.ok) resolve(); else reject(new Error(result.error?.message)); }); }); return socket; }

async function main(): Promise<void> {
  const started = performance.now(); const host = await request<Join>("/api/rooms", { displayName: "Load Host", title: "10-client measurement", accessMode: "PUBLIC", maxParticipants: 10, mediaId: "oppenheimer-trailer" });
  const hostSocket = await connect(host.token); const clients: Socket[] = [hostSocket];
  for (let index = 1; index < 10; index += 1) { const member = await request<Join>("/api/rooms/join", { roomId: host.room.id, displayName: `Client ${index}` }); clients.push(await connect(member.token)); }
  const received = new Set<string>(); const delivered = new Promise<void>((resolve) => { for (const socket of clients) socket.once("room:state", (state: { version: number }) => { received.add(socket.id ?? "unknown"); socket.emit("sync:delivery", { version: state.version }); if (received.size === clients.length) resolve(); }); });
  const commandStart = performance.now(); const control = await new Promise<{ ok: boolean; error?: { message: string } }>((resolve) => hostSocket.emit("playback:command", { commandId: crypto.randomUUID(), type: "PLAY", positionMs: 0 }, resolve));
  if (!control.ok) throw new Error(control.error?.message || "Control rejected"); await Promise.race([delivered, sleep(5_000).then(() => { throw new Error("Timed out waiting for control delivery"); })]);
  const health = await fetch(`${baseUrl}/health`).then((response) => response.json() as Promise<{ metrics: { p50Ms: number | null; p95Ms: number | null; p99Ms: number | null } }>);
  console.log(JSON.stringify({ clients: clients.length, connectionMs: Math.round(performance.now() - started), allRecipientsReceived: received.size, controlFanoutWallMs: Math.round(performance.now() - commandStart), serverDelivery: health.metrics }, null, 2));
  clients.forEach((socket) => socket.disconnect());
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
