import { createServer } from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { Server, type Socket } from "socket.io";
import {
  DEMO_MEDIA, type Ack, type PlaybackState, chatSchema, createRoomSchema, failure, joinRoomSchema,
  playbackCommandSchema, playlistAddSchema, playlistRemoveSchema, playlistReorderSchema, pollCloseSchema,
  pollCreateSchema, pollVoteSchema, reactionSchema, success, transferHostSchema
} from "@afterhours/shared";
import { signSession, verifySession, type SessionPrincipal } from "./auth.js";
import { Metrics } from "./metrics.js";
import { DomainError, RoomStore } from "./room-store.js";

const port = Number(process.env.PORT || 4001);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: webOrigin, methods: ["GET", "POST"], credentials: false },
  maxHttpBufferSize: 16 * 1024,
  transports: ["websocket", "polling"]
});
const store = new RoomStore();
const metrics = new Metrics();

app.use(cors({ origin: webOrigin }));
app.use(express.json({ limit: "16kb" }));
app.get("/health", (_request, response) => response.json({ ok: true, persistence: process.env.DATABASE_URL ? "configured (migration required)" : "in-memory demo", now: Date.now(), metrics: metrics.snapshot() }));
app.get("/api/catalog", (_request, response) => response.json({ items: DEMO_MEDIA }));
app.get("/api/metrics", (_request, response) => response.json(metrics.snapshot()));

app.post("/api/rooms", (request, response, next) => {
  try {
    const parsed = createRoomSchema.parse(request.body);
    const created = store.create(parsed);
    const inviteUrl = `${webOrigin}/room/${created.room.id}${created.accessKey ? `?key=${encodeURIComponent(created.accessKey)}` : ""}`;
    response.status(201).json({ room: created.room, token: signSession({ roomId: created.room.id, participantId: created.participantId }), inviteUrl, accessKey: created.accessKey });
  } catch (error) { next(error); }
});
app.post("/api/rooms/join", (request, response, next) => {
  try {
    const parsed = joinRoomSchema.parse(request.body);
    const joined = store.join(parsed);
    response.json({ room: joined.room, token: signSession({ roomId: joined.room.id, participantId: joined.participantId }) });
  } catch (error) { next(error); }
});
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof DomainError) return response.status(error.code === "ROOM_NOT_FOUND" ? 404 : error.code === "ROOM_FULL" ? 409 : 400).json(failure(error.code, error.message));
  if (error && typeof error === "object" && "issues" in error) return response.status(400).json(failure("VALIDATION_ERROR", "Please check the fields and try again."));
  console.error("Unhandled HTTP error", error); return response.status(500).json(failure("INTERNAL_ERROR", "Something went wrong. Please try again."));
});

interface SocketData { principal?: SessionPrincipal; joined?: boolean; }
type AppSocket = Socket & { data: SocketData };

io.use((socket, next) => {
  const principal = verifySession(socket.handshake.auth?.token);
  if (!principal) return next(new Error("Unauthorized room session"));
  socket.data.principal = principal;
  next();
});

io.on("connection", (rawSocket) => {
  const socket = rawSocket as AppSocket;
  const principal = socket.data.principal!;
  const reply = (ack: unknown, result: Ack<unknown>): void => { if (typeof ack === "function") (ack as (value: Ack<unknown>) => void)(result); };
  const guarded = (_ack: unknown, fn: () => Ack<unknown>, requiresJoin = true): Ack<unknown> => {
    try {
      if (requiresJoin && !socket.data.joined) return failure("ROOM_JOIN_REQUIRED", "Join the room before sending actions.");
      return fn();
    } catch (error) {
      if (error instanceof DomainError) return failure(error.code, error.message);
      if (error && typeof error === "object" && "issues" in error) return failure("VALIDATION_ERROR", "Please check the fields and try again.");
      console.error("Unhandled socket error", error); return failure("INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
  const broadcastPresence = (): void => { io.to(principal.roomId).emit("room:participants", store.snapshotFor(principal.roomId, principal.participantId).participants); };
  const emitPolls = (): void => { for (const socketId of store.activeSocketIds(principal.roomId)) { const peer = io.sockets.sockets.get(socketId) as AppSocket | undefined; const viewer = peer?.data.principal?.participantId; if (peer && viewer) peer.emit("polls:updated", store.snapshotFor(principal.roomId, viewer).polls); } };

  socket.on("room:join", (ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => {
      if (socket.data.joined) {
        socket.emit("room:hydrate", store.snapshotFor(principal.roomId, principal.participantId));
        return success();
      }
      store.connect(principal.roomId, principal.participantId, socket.id); socket.join(principal.roomId); socket.data.joined = true;
      socket.emit("room:hydrate", store.snapshotFor(principal.roomId, principal.participantId));
      socket.to(principal.roomId).emit("system:message", { id: crypto.randomUUID(), content: `${store.participant(principal.roomId, principal.participantId).displayName} joined the room.`, createdAt: Date.now() });
      broadcastPresence(); return success();
    }, false);
    reply(ack, result);
  });

  socket.on("sync:ping", (clientSentAt: unknown, ack?: (value: { clientSentAt: number; serverNow: number }) => void) => { if (typeof clientSentAt === "number" && ack) ack({ clientSentAt, serverNow: Date.now() }); });
  socket.on("sync:delivery", (payload: unknown) => { if (payload && typeof payload === "object" && "version" in payload && typeof (payload as { version: unknown }).version === "number") metrics.delivered(socket.id, (payload as { version: number }).version); });

  socket.on("playback:command", (payload: unknown, ack?: (result: Ack<{ state: PlaybackState }>) => void) => {
    const result = guarded(ack, () => {
      const command = playbackCommandSchema.parse(payload); const state = store.applyPlayback(principal.roomId, principal.participantId, command); metrics.controlAccepted();
      for (const socketId of store.activeSocketIds(principal.roomId)) metrics.startDelivery(socketId, state.version);
      io.to(principal.roomId).emit("room:state", state); return success({ state });
    });
    reply(ack, result);
  });
  socket.on("chat:send", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = chatSchema.parse(payload); const message = store.addChat(principal.roomId, principal.participantId, value.content); io.to(principal.roomId).emit("chat:new", message); return success(); }); reply(ack, result);
  });
  socket.on("reaction:send", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = reactionSchema.parse(payload); store.acceptReaction(principal.roomId, principal.participantId); io.to(principal.roomId).emit("reaction:new", { id: crypto.randomUUID(), emoji: value.emoji, participantId: principal.participantId, createdAt: Date.now() }); return success(); }); reply(ack, result);
  });
  socket.on("playlist:add", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = playlistAddSchema.parse(payload); const playlist = store.addPlaylist(principal.roomId, principal.participantId, value.mediaId); io.to(principal.roomId).emit("playlist:updated", playlist); return success(); }); reply(ack, result);
  });
  socket.on("playlist:remove", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = playlistRemoveSchema.parse(payload); const playlist = store.removePlaylist(principal.roomId, principal.participantId, value.itemId); io.to(principal.roomId).emit("playlist:updated", playlist); return success(); }); reply(ack, result);
  });
  socket.on("playlist:reorder", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = playlistReorderSchema.parse(payload); const playlist = store.reorderPlaylist(principal.roomId, principal.participantId, value.itemIds); io.to(principal.roomId).emit("playlist:updated", playlist); return success(); }); reply(ack, result);
  });
  socket.on("poll:create", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = pollCreateSchema.parse(payload); store.createPoll(principal.roomId, principal.participantId, value.question, value.options); emitPolls(); return success(); }); reply(ack, result);
  });
  socket.on("poll:vote", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = pollVoteSchema.parse(payload); store.votePoll(principal.roomId, principal.participantId, value.pollId, value.optionId); emitPolls(); return success(); }); reply(ack, result);
  });
  socket.on("poll:close", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = pollCloseSchema.parse(payload); store.closePoll(principal.roomId, principal.participantId, value.pollId); emitPolls(); return success(); }); reply(ack, result);
  });
  socket.on("host:transfer", (payload: unknown, ack?: (result: Ack) => void) => {
    const result = guarded(ack, () => { const value = transferHostSchema.parse(payload); store.transferHost(principal.roomId, principal.participantId, value.participantId); broadcastPresence(); emitPolls(); return success(); }); reply(ack, result);
  });
  socket.on("disconnect", () => {
    if (!socket.data.joined) return;
    try {
      const outcome = store.disconnect(principal.roomId, principal.participantId, socket.id); broadcastPresence();
      if (outcome.transferredTo) io.to(principal.roomId).emit("system:message", { id: crypto.randomUUID(), content: "The host disconnected; control moved to the next available viewer.", createdAt: Date.now() });
    } catch (error) { console.warn("Disconnect cleanup failed", error); }
  });
});

httpServer.listen(port, () => console.log(`AfterHours realtime server listening on :${port} (${process.env.DATABASE_URL ? "PostgreSQL configuration present" : "in-memory demo mode"})`));

export { store };
