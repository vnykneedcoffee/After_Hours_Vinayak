import { describe, expect, it } from "vitest";
import { calculateDriftMs, expectedPositionMs } from "@afterhours/shared";
import { DomainError, RoomStore } from "../apps/realtime/src/room-store.js";

describe("authoritative playback calculations", () => {
  it("advances only while playing", () => {
    const state = { selectedMediaId: "big-buck-bunny", isPlaying: true, positionAtReferenceMs: 4_000, referenceUnixMs: 10_000, playbackRate: 1, version: 1 };
    expect(expectedPositionMs(state, 12_250)).toBe(6_250);
    expect(calculateDriftMs(5.4, state, 12_250)).toBe(850);
    expect(expectedPositionMs({ ...state, isPlaying: false }, 99_000)).toBe(4_000);
  });
});

describe("room authority", () => {
  it("generates a shareable code and rejects non-host controls", () => {
    const store = new RoomStore(); const created = store.create({ displayName: "Host", title: "Test room", accessMode: "PRIVATE", maxParticipants: 3, mediaId: "big-buck-bunny" });
    expect(created.room.code).toMatch(/^[A-Z2-9]{7}$/); expect(created.accessKey).toBeTruthy();
    const joined = store.join({ roomId: created.room.id, accessKey: created.accessKey, displayName: "Guest" });
    expect(() => store.applyPlayback(created.room.id, joined.participantId, { commandId: crypto.randomUUID(), type: "PLAY" })).toThrow(DomainError);
    const state = store.applyPlayback(created.room.id, created.participantId, { commandId: crypto.randomUUID(), type: "SEEK", positionMs: 15_000 });
    expect(state.version).toBe(1); expect(state.positionAtReferenceMs).toBe(15_000);
  });

  it("makes command IDs idempotent and transfers the remote atomically", () => {
    const store = new RoomStore(); const created = store.create({ displayName: "Host", title: "Test", accessMode: "PUBLIC", maxParticipants: 3, mediaId: "big-buck-bunny" }); const guest = store.join({ roomId: created.room.id, displayName: "Guest" });
    store.connect(created.room.id, guest.participantId, "guest-socket");
    const commandId = crypto.randomUUID(); const first = store.applyPlayback(created.room.id, created.participantId, { commandId, type: "PLAY", positionMs: 100 }); const duplicate = store.applyPlayback(created.room.id, created.participantId, { commandId, type: "PLAY", positionMs: 900 });
    expect(duplicate.version).toBe(first.version); expect(duplicate.positionAtReferenceMs).toBe(100);
    store.transferHost(created.room.id, created.participantId, guest.participantId);
    expect(store.isHost(created.room.id, guest.participantId)).toBe(true);
    expect(() => store.applyPlayback(created.room.id, created.participantId, { commandId: crypto.randomUUID(), type: "PAUSE" })).toThrow("Only the host");
  });
});
