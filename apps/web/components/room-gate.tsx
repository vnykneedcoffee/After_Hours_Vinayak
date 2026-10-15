"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Clapperboard, LockKeyhole } from "lucide-react";
import type { RoomSnapshot } from "@afterhours/shared";
import { api } from "./api";
import { WatchRoom } from "./watch-room";

interface JoinResponse { room: RoomSnapshot; token: string; }

export function RoomGate({ roomId }: { roomId: string }) {
  const search = useSearchParams(); const accessKey = search.get("key") ?? undefined;
  const [token, setToken] = useState<string | null>(null); const [name, setName] = useState(""); const [error, setError] = useState(""); const [joining, setJoining] = useState(false);
  useEffect(() => { setToken(sessionStorage.getItem(`afterhours:${roomId}`)); }, [roomId]);
  const join = async (): Promise<void> => {
    setJoining(true); setError("");
    try { const result = await api<JoinResponse>("/api/rooms/join", { method: "POST", body: JSON.stringify({ roomId, accessKey, displayName: name }) }); sessionStorage.setItem(`afterhours:${roomId}`, result.token); setToken(result.token); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not enter this room."); } finally { setJoining(false); }
  };
  if (token) return <WatchRoom roomId={roomId} token={token} />;
  return <main className="gate"><a className="brand" href="/"><span className="brand-mark"><Clapperboard size={18} /></span>AfterHours</a><section className="gate-card"><span className="gate-icon"><LockKeyhole size={22} /></span><p className="eyebrow">YOUR TICKET IS READY</p><h1>Welcome to the watch party.</h1><p>Enter the name you want your friends to see. You can use the same secure invite whenever you reconnect.</p><label>Display name<input autoFocus value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="e.g. Nikhil" onKeyDown={(event) => { if (event.key === "Enter") void join(); }} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button wide" onClick={() => void join()} disabled={joining}>{joining ? "Finding your seat…" : <>Enter the room <ArrowRight size={17} /></>}</button><small>Your name is room-only—no account required.</small></section></main>;
}
