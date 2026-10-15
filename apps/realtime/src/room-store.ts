import { randomUUID } from "node:crypto";
import {
  type AccessMode, type ChatMessageView, type PlaybackState, type PlaylistItemView, type PollView,
  type ParticipantRole, type ParticipantView, type RoomSnapshot, ROOM_CODE_ALPHABET,
  expectedPositionMs, mediaById
} from "@afterhours/shared";
import { hashAccessKey, newAccessKey } from "./auth.js";

type RoomStatus = "ACTIVE" | "ENDED" | "EXPIRED";
interface StoredParticipant extends ParticipantView { socketIds: Set<string>; }
interface StoredPoll extends Omit<PollView, "votedOptionId"> { votesByParticipant: Map<string, string>; }
interface StoredRoom {
  id: string; code: string; title: string; accessMode: AccessMode; accessKeyHash?: string;
  maxParticipants: number; status: RoomStatus; hostId: string; createdAt: number; lastActivityAt: number;
  playback: PlaybackState; participants: Map<string, StoredParticipant>; playlist: PlaylistItemView[];
  messages: ChatMessageView[]; polls: StoredPoll[]; processedCommands: Set<string>;
}
export class DomainError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export interface CreateRoomInput { displayName: string; title: string; accessMode: AccessMode; maxParticipants: number; mediaId: string; }
export interface JoinRoomInput { displayName: string; roomId?: string | undefined; roomCode?: string | undefined; accessKey?: string | undefined; }
export interface CreatedRoom { room: RoomSnapshot; participantId: string; accessKey?: string; }

export class RoomStore {
  private rooms = new Map<string, StoredRoom>();
  private codeToRoomId = new Map<string, string>();
  private lastActions = new Map<string, number>();

  create(input: CreateRoomInput): CreatedRoom {
    if (!mediaById(input.mediaId)) throw new DomainError("MEDIA_NOT_FOUND", "That video is not available in the demo catalog.");
    const now = Date.now();
    const roomId = randomUUID();
    const participantId = randomUUID();
    const accessKey = input.accessMode === "PRIVATE" ? newAccessKey() : undefined;
    const participant: StoredParticipant = { id: participantId, displayName: input.displayName, avatarSeed: randomUUID().slice(0, 8), role: "HOST", online: false, joinedAt: now, socketIds: new Set() };
    const room: StoredRoom = {
      id: roomId, code: this.generateCode(), title: input.title, accessMode: input.accessMode,
      ...(accessKey ? { accessKeyHash: hashAccessKey(accessKey) } : {}), maxParticipants: input.maxParticipants,
      status: "ACTIVE", hostId: participantId, createdAt: now, lastActivityAt: now,
      playback: { selectedMediaId: input.mediaId, isPlaying: false, positionAtReferenceMs: 0, referenceUnixMs: now, playbackRate: 1, version: 0 },
      participants: new Map([[participantId, participant]]), playlist: [], messages: [], polls: [], processedCommands: new Set()
    };
    room.playlist.push({ id: randomUUID(), mediaId: input.mediaId, position: 0, addedById: participantId, createdAt: now });
    this.rooms.set(room.id, room); this.codeToRoomId.set(room.code, room.id);
    return { room: this.snapshot(room, participantId), participantId, ...(accessKey ? { accessKey } : {}) };
  }

  join(input: JoinRoomInput): { room: RoomSnapshot; participantId: string } {
    const room = this.findRoom(input.roomId, input.roomCode);
    this.assertActive(room);
    if (room.accessMode === "PRIVATE" && (!input.accessKey || hashAccessKey(input.accessKey) !== room.accessKeyHash)) throw new DomainError("INVITE_REQUIRED", "This is a private room. Use its complete invitation link.");
    // Sessions are room members even before their first socket connection. Counting them
    // closes the REST-then-socket race that could otherwise oversubscribe a room.
    if (room.participants.size >= room.maxParticipants) throw new DomainError("ROOM_FULL", "This room is at capacity.");
    const now = Date.now(); const participantId = randomUUID();
    room.participants.set(participantId, { id: participantId, displayName: input.displayName, avatarSeed: randomUUID().slice(0, 8), role: "PARTICIPANT", online: false, joinedAt: now, socketIds: new Set() });
    room.lastActivityAt = now;
    return { room: this.snapshot(room, participantId), participantId };
  }

  get(roomId: string): StoredRoom { const room = this.rooms.get(roomId); if (!room) throw new DomainError("ROOM_NOT_FOUND", "That watch party no longer exists."); return room; }
  snapshotFor(roomId: string, viewerId: string): RoomSnapshot { return this.snapshot(this.get(roomId), viewerId); }
  participant(roomId: string, participantId: string): StoredParticipant {
    const participant = this.get(roomId).participants.get(participantId);
    if (!participant) throw new DomainError("SESSION_INVALID", "Your room session is no longer valid.");
    return participant;
  }
  connect(roomId: string, participantId: string, socketId: string): void { const participant = this.participant(roomId, participantId); participant.socketIds.add(socketId); participant.online = true; this.get(roomId).lastActivityAt = Date.now(); }
  disconnect(roomId: string, participantId: string, socketId: string): { transferredTo?: string } {
    const room = this.get(roomId); const participant = this.participant(roomId, participantId); participant.socketIds.delete(socketId);
    if (participant.socketIds.size) return {};
    participant.online = false; room.lastActivityAt = Date.now();
    if (room.hostId !== participantId) return {};
    const successor = [...room.participants.values()].filter((candidate) => candidate.online).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
    if (!successor) return {};
    participant.role = "PARTICIPANT"; successor.role = "HOST"; room.hostId = successor.id;
    return { transferredTo: successor.id };
  }
  activeSocketIds(roomId: string): string[] { return [...this.get(roomId).participants.values()].flatMap((p) => [...p.socketIds]); }
  isHost(roomId: string, participantId: string): boolean { return this.get(roomId).hostId === participantId; }
  roomIdForCode(code: string): string | undefined { return this.codeToRoomId.get(code); }

  applyPlayback(roomId: string, actorId: string, command: { commandId: string; type: "PLAY" | "PAUSE" | "SEEK" | "SELECT_MEDIA"; positionMs?: number | undefined; mediaId?: string | undefined }): PlaybackState {
    const room = this.get(roomId); this.assertActive(room); this.assertHost(room, actorId);
    if (room.processedCommands.has(command.commandId)) return room.playback;
    this.rateLimit(actorId, "control", 100);
    const now = Date.now(); const position = command.positionMs ?? expectedPositionMs(room.playback, now);
    if (command.type === "SELECT_MEDIA") {
      if (!command.mediaId || !mediaById(command.mediaId)) throw new DomainError("MEDIA_NOT_FOUND", "That video is unavailable.");
      room.playback.selectedMediaId = command.mediaId; room.playback.positionAtReferenceMs = 0; room.playback.isPlaying = false;
    } else if (command.type === "PLAY") { room.playback.positionAtReferenceMs = position; room.playback.isPlaying = true; }
    else if (command.type === "PAUSE") { room.playback.positionAtReferenceMs = position; room.playback.isPlaying = false; }
    else { room.playback.positionAtReferenceMs = position; }
    room.playback.referenceUnixMs = now; room.playback.version += 1; room.playback.lastCommandId = command.commandId;
    room.processedCommands.add(command.commandId); if (room.processedCommands.size > 500) room.processedCommands.delete(room.processedCommands.values().next().value as string);
    room.lastActivityAt = now; return { ...room.playback };
  }

  addChat(roomId: string, participantId: string, content: string): ChatMessageView {
    this.rateLimit(participantId, "chat", 700); const room = this.get(roomId); const participant = this.participant(roomId, participantId);
    const message = { id: randomUUID(), participantId, displayName: participant.displayName, content, createdAt: Date.now() };
    room.messages.push(message); if (room.messages.length > 100) room.messages.splice(0, room.messages.length - 100); room.lastActivityAt = Date.now(); return message;
  }
  acceptReaction(roomId: string, participantId: string): void { this.participant(roomId, participantId); this.rateLimit(participantId, "reaction", 400); }
  addPlaylist(roomId: string, participantId: string, mediaId: string): PlaylistItemView[] {
    if (!mediaById(mediaId)) throw new DomainError("MEDIA_NOT_FOUND", "That video is unavailable."); const room = this.get(roomId); this.participant(roomId, participantId);
    room.playlist.push({ id: randomUUID(), mediaId, position: room.playlist.length, addedById: participantId, createdAt: Date.now() }); return [...room.playlist];
  }
  removePlaylist(roomId: string, actorId: string, itemId: string): PlaylistItemView[] {
    const room = this.get(roomId); this.assertHost(room, actorId); const index = room.playlist.findIndex((item) => item.id === itemId); if (index < 0) throw new DomainError("PLAYLIST_NOT_FOUND", "That playlist item was already removed.");
    room.playlist.splice(index, 1); this.normalizePlaylist(room); return [...room.playlist];
  }
  reorderPlaylist(roomId: string, actorId: string, itemIds: string[]): PlaylistItemView[] {
    const room = this.get(roomId); this.assertHost(room, actorId); if (itemIds.length !== room.playlist.length || new Set(itemIds).size !== itemIds.length || !itemIds.every((id) => room.playlist.some((item) => item.id === id))) throw new DomainError("INVALID_ORDER", "The playlist changed; refresh and try again.");
    room.playlist = itemIds.map((id) => room.playlist.find((item) => item.id === id)!); this.normalizePlaylist(room); return [...room.playlist];
  }
  createPoll(roomId: string, actorId: string, question: string, options: string[]): PollView {
    const room = this.get(roomId); this.assertHost(room, actorId); const now = Date.now(); const poll: StoredPoll = { id: randomUUID(), question, options: options.map((label) => ({ id: randomUUID(), label, votes: 0 })), status: "OPEN", createdById: actorId, createdAt: now, votesByParticipant: new Map() }; room.polls.push(poll); return this.pollView(poll, actorId);
  }
  votePoll(roomId: string, participantId: string, pollId: string, optionId: string): PollView {
    this.rateLimit(participantId, "vote", 250); const room = this.get(roomId); const poll = room.polls.find((item) => item.id === pollId); if (!poll) throw new DomainError("POLL_NOT_FOUND", "That poll no longer exists."); if (poll.status !== "OPEN") throw new DomainError("POLL_CLOSED", "Voting has closed."); if (poll.votesByParticipant.has(participantId)) throw new DomainError("ALREADY_VOTED", "You have already voted."); const option = poll.options.find((item) => item.id === optionId); if (!option) throw new DomainError("OPTION_NOT_FOUND", "That option is not available."); option.votes += 1; poll.votesByParticipant.set(participantId, optionId); return this.pollView(poll, participantId);
  }
  closePoll(roomId: string, actorId: string, pollId: string): PollView { const room = this.get(roomId); this.assertHost(room, actorId); const poll = room.polls.find((item) => item.id === pollId); if (!poll) throw new DomainError("POLL_NOT_FOUND", "That poll no longer exists."); poll.status = "CLOSED"; return this.pollView(poll, actorId); }
  transferHost(roomId: string, actorId: string, recipientId: string): void { const room = this.get(roomId); this.assertHost(room, actorId); const recipient = this.participant(roomId, recipientId); const actor = this.participant(roomId, actorId); if (!recipient.online) throw new DomainError("PARTICIPANT_OFFLINE", "Choose someone currently in the room."); actor.role = "PARTICIPANT"; recipient.role = "HOST"; room.hostId = recipientId; room.lastActivityAt = Date.now(); }

  private findRoom(roomId?: string, code?: string): StoredRoom { if (roomId) return this.get(roomId); const resolved = code ? this.codeToRoomId.get(code) : undefined; if (!resolved) throw new DomainError("ROOM_NOT_FOUND", "We couldn't find a room with that code."); return this.get(resolved); }
  private snapshot(room: StoredRoom, viewerId: string): RoomSnapshot { return { id: room.id, code: room.code, title: room.title, accessMode: room.accessMode, maxParticipants: room.maxParticipants, status: room.status, hostId: room.hostId, playback: { ...room.playback }, participants: [...room.participants.values()].map(({ socketIds: _socketIds, ...participant }) => ({ ...participant })), playlist: [...room.playlist], messages: [...room.messages], polls: room.polls.map((poll) => this.pollView(poll, viewerId)), serverNow: Date.now() }; }
  private pollView(poll: StoredPoll, viewerId: string): PollView { const vote = poll.votesByParticipant.get(viewerId); return { id: poll.id, question: poll.question, options: poll.options.map((option) => ({ ...option })), status: poll.status, createdById: poll.createdById, createdAt: poll.createdAt, ...(vote ? { votedOptionId: vote } : {}) }; }
  private normalizePlaylist(room: StoredRoom): void { room.playlist.forEach((item, index) => { item.position = index; }); }
  private assertActive(room: StoredRoom): void { if (room.status !== "ACTIVE") throw new DomainError("ROOM_INACTIVE", "This room is no longer active."); }
  private assertHost(room: StoredRoom, participantId: string): void { if (room.hostId !== participantId) throw new DomainError("HOST_ONLY", "Only the host can control the theater."); }
  private rateLimit(participantId: string, action: string, minGapMs: number): void { const key = `${participantId}:${action}`; const now = Date.now(); const previous = this.lastActions.get(key) ?? 0; if (now - previous < minGapMs) throw new DomainError("RATE_LIMITED", "You're doing that a little too quickly."); this.lastActions.set(key, now); }
  private generateCode(): string { let code = ""; do { code = Array.from({ length: 7 }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join(""); } while (this.codeToRoomId.has(code)); return code; }
}
