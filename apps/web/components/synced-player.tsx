"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { type Media, type PlaybackState, calculateDriftMs, expectedPositionMs } from "@afterhours/shared";

const formatTime = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export function SyncedPlayer({ media, playback, isHost, onControl, onNotice }: { media: Media; playback: PlaybackState; isHost: boolean; onControl(type: "PLAY" | "PAUSE" | "SEEK", positionMs?: number): void; onNotice(message: string): void }) {
  const videoRef = useRef<HTMLVideoElement>(null); const wrapperRef = useRef<HTMLDivElement>(null); const applyingRef = useRef(false); const [ready, setReady] = useState(false); const [current, setCurrent] = useState(0); const [duration, setDuration] = useState(0); const [volume, setVolume] = useState(0.8); const [muted, setMuted] = useState(false); const [preview, setPreview] = useState<number | null>(null); const [buffering, setBuffering] = useState(true); const [failed, setFailed] = useState(false);
  useEffect(() => { setReady(false); setFailed(false); setBuffering(true); setCurrent(0); }, [media.id]);
  useEffect(() => {
    const video = videoRef.current; if (!video || !ready) return;
    const target = expectedPositionMs(playback) / 1000; const drift = calculateDriftMs(video.currentTime, playback, Date.now());
    applyingRef.current = true;
    if (Math.abs(drift) >= 600) video.currentTime = target;
    else if (Math.abs(drift) >= 120 && playback.isPlaying) { video.playbackRate = drift > 0 ? 1.05 : 0.95; window.setTimeout(() => { if (video) video.playbackRate = 1; }, 1_500); }
    if (playback.isPlaying && video.paused) video.play().catch(() => onNotice("Tap play once to allow your browser to begin the film."));
    if (!playback.isPlaying && !video.paused) video.pause();
    window.setTimeout(() => { applyingRef.current = false; }, 350);
  }, [onNotice, playback, ready]);
  // The native media callbacks are deliberately not commands: applying an authoritative
  // state can itself produce play/pause/seek events. The custom host controls below are
  // the only path that creates a server mutation, preventing sync feedback loops.
  const toggle = (): void => { const video = videoRef.current; if (!video || !isHost) return; const positionMs = video.currentTime * 1_000; if (video.paused) { void video.play().catch(() => onNotice("Your browser needs a tap before it can start the film.")); onControl("PLAY", positionMs); } else { video.pause(); onControl("PAUSE", positionMs); } };
  const commitSeek = (): void => { const value = preview; if (value === null) return; const video = videoRef.current; if (video) video.currentTime = value; if (isHost) onControl("SEEK", value * 1_000); setPreview(null); };
  const enterFullscreen = (): void => { void wrapperRef.current?.requestFullscreen?.(); };
  return <div className="synced-player" ref={wrapperRef}>
    <video ref={videoRef} src={media.src} preload="metadata" playsInline onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); setReady(true); setBuffering(false); }} onCanPlay={() => setBuffering(false)} onWaiting={() => setBuffering(true)} onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)} onError={() => { setFailed(true); setBuffering(false); }} />
    <div className="player-shade" />
    {buffering && !failed && <div className="player-status"><span className="loader" /> Buffering</div>}
    {failed && <div className="player-status player-error">This demo source could not be played. Try another open-film title.</div>}
    {!isHost && <span className="viewer-lock">Host is controlling playback</span>}
    <div className="player-controls"><div className="progress-row"><span>{formatTime(preview ?? current)}</span><input aria-label="Playback position" disabled={!isHost || !duration} type="range" min="0" max={duration || 1} step="0.1" value={preview ?? current} onChange={(event) => setPreview(Number(event.target.value))} onPointerUp={commitSeek} onKeyUp={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") commitSeek(); }} /><span>{formatTime(duration)}</span></div><div className="control-row"><button className="control-play" disabled={!isHost} aria-label={playback.isPlaying ? "Pause" : "Play"} onClick={toggle}>{playback.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button><span className="control-title">{playback.isPlaying ? "Playing in sync" : "Waiting for the host"}</span><div className="volume"><button aria-label="Mute" onClick={() => { const video = videoRef.current; if (video) { video.muted = !muted; setMuted(!muted); } }}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const value = Number(event.target.value); const video = videoRef.current; if (video) { video.volume = value; video.muted = false; } setMuted(false); setVolume(value); }} /></div><button aria-label="Fullscreen" onClick={enterFullscreen}><Expand size={18} /></button></div></div>
  </div>;
}
