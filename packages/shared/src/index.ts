import { z } from "zod";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_ROOM_CAPACITY = 25;
export const DEMO_MEDIA = [
  {
    id: "big-buck-bunny",
    title: "The Flower Reel",
    description: "A bright, browser-friendly open video — perfect for a reproducible synchronized demo.",
    genres: ["Nature", "Short"],
    year: 2024,
    durationLabel: "1 min",
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80",
    provider: "html5" as const,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    playable: true
  },
  {
    id: "elephants-dream",
    title: "Elephants Dream",
    description: "A surreal open-film experience made for a late-night room.",
    genres: ["Animation", "Sci-Fi"],
    year: 2006,
    durationLabel: "11 min",
    poster: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=800&q=80",
    provider: "html5" as const,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    playable: true
  },
  {
    id: "sintel",
    title: "Sintel",
    description: "A sweeping open-film fantasy with an emotional core.",
    genres: ["Animation", "Fantasy"],
    year: 2010,
    durationLabel: "15 min",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=800&q=80",
    provider: "html5" as const,
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    playable: true
  }
] as const;

export type Media = (typeof DEMO_MEDIA)[number];
export type AccessMode = "PUBLIC" | "PRIVATE";
export type ParticipantRole = "HOST" | "PARTICIPANT";

export interface ParticipantView {
  id: string;
  displayName: string;
  avatarSeed: string;
  role: ParticipantRole;
  online: boolean;
  joinedAt: number;
}

export interface PlaybackState {
  selectedMediaId: string;
  isPlaying: boolean;
  positionAtReferenceMs: number;
  referenceUnixMs: number;
  playbackRate: number;
  version: number;
  lastCommandId?: string;
}

export interface PlaylistItemView {
  id: string;
  mediaId: string;
  position: number;
  addedById: string;
  createdAt: number;
}

export interface ChatMessageView {
  id: string;
  participantId: string;
  displayName: string;
  content: string;
  createdAt: number;
}

export interface PollOptionView { id: string; label: string; votes: number; }
export interface PollView {
  id: string;
  question: string;
  options: PollOptionView[];
  status: "OPEN" | "CLOSED";
  createdById: string;
  createdAt: number;
  votedOptionId?: string;
}

export interface RoomSnapshot {
  id: string;
  code: string;
  title: string;
  accessMode: AccessMode;
  maxParticipants: number;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  hostId: string;
  playback: PlaybackState;
  participants: ParticipantView[];
  playlist: PlaylistItemView[];
  messages: ChatMessageView[];
  polls: PollView[];
  serverNow: number;
}

export const displayNameSchema = z.string().trim().min(2, "Use at least 2 characters").max(30, "Use 30 characters or fewer");
export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6,8}$/, "Enter a valid room code");
export const mediaIdSchema = z.enum(DEMO_MEDIA.map((media) => media.id) as [string, ...string[]]);
export const createRoomSchema = z.object({
  displayName: displayNameSchema,
  title: z.string().trim().min(2).max(80).default("Untitled AfterHours"),
  accessMode: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  maxParticipants: z.number().int().min(2).max(MAX_ROOM_CAPACITY).default(10),
  mediaId: mediaIdSchema.default("big-buck-bunny")
});
export const joinRoomSchema = z.object({
  roomId: z.string().min(1).optional(),
  roomCode: roomCodeSchema.optional(),
  accessKey: z.string().min(16).max(128).optional(),
  displayName: displayNameSchema
}).refine((value) => value.roomId || value.roomCode, { message: "Provide a room link or code" });

export const playbackCommandSchema = z.object({
  commandId: z.string().uuid(),
  type: z.enum(["PLAY", "PAUSE", "SEEK", "SELECT_MEDIA"]),
  positionMs: z.number().int().min(0).max(86_400_000).optional(),
  mediaId: mediaIdSchema.optional(),
  clientSequence: z.number().int().nonnegative().optional()
}).superRefine((value, ctx) => {
  if (value.type === "SEEK" && value.positionMs === undefined) ctx.addIssue({ code: "custom", path: ["positionMs"], message: "Seek needs a position" });
  if (value.type === "SELECT_MEDIA" && !value.mediaId) ctx.addIssue({ code: "custom", path: ["mediaId"], message: "Media selection needs mediaId" });
});
export const chatSchema = z.object({ clientMessageId: z.string().uuid(), content: z.string().trim().min(1).max(500) });
export const reactionSchema = z.object({ emoji: z.enum(["❤️", "😂", "😮", "👏", "🔥", "🎬"]) });
export const playlistAddSchema = z.object({ mediaId: mediaIdSchema });
export const playlistRemoveSchema = z.object({ itemId: z.string().min(1) });
export const playlistReorderSchema = z.object({ itemIds: z.array(z.string().min(1)).min(1).max(100) });
export const pollCreateSchema = z.object({ question: z.string().trim().min(3).max(240), options: z.array(z.string().trim().min(1).max(80)).min(2).max(6) });
export const pollVoteSchema = z.object({ pollId: z.string().min(1), optionId: z.string().min(1) });
export const pollCloseSchema = z.object({ pollId: z.string().min(1) });
export const transferHostSchema = z.object({ participantId: z.string().min(1) });

export interface Ack<T = undefined> { ok: boolean; data?: T; error?: { code: string; message: string }; }
export const success = <T>(data?: T): Ack<T> => data === undefined ? { ok: true } : { ok: true, data };
export const failure = (code: string, message: string): Ack => ({ ok: false, error: { code, message } });

export function mediaById(mediaId: string): Media | undefined {
  return DEMO_MEDIA.find((media) => media.id === mediaId);
}

export function expectedPositionMs(state: PlaybackState, serverNow = Date.now()): number {
  if (!state.isPlaying) return state.positionAtReferenceMs;
  return Math.max(0, Math.round(state.positionAtReferenceMs + (serverNow - state.referenceUnixMs) * state.playbackRate));
}

export function calculateDriftMs(localPositionSeconds: number, state: PlaybackState, estimatedServerNow: number): number {
  return expectedPositionMs(state, estimatedServerNow) - Math.round(localPositionSeconds * 1000);
}
