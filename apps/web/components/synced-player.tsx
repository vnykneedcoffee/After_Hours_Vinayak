"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Pause, Play, Shuffle, Volume2, VolumeX } from "lucide-react";
import { type Media, type PlaybackState, calculateDriftMs, expectedPositionMs } from "@afterhours/shared";

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, number>; events: { onReady: () => void; onStateChange: (event: { data: number }) => void; onError: () => void } }) => YouTubePlayer;
      PlayerState: { PLAYING: number; PAUSED: number; BUFFERING: number };
      ready: (callback: () => void) => void;
    };
  }
}

interface YouTubePlayer {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number; setVolume(volume: number): void; mute(): void; unMute(): void;
}

const formatTime = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-afterhours-youtube]");
    const finish = (): void => window.YT?.ready(() => resolve());
    if (existing) { existing.addEventListener("load", finish, { once: true }); existing.addEventListener("error", () => reject(new Error("YouTube could not be loaded.")), { once: true }); return; }
    const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; script.dataset.afterhoursYoutube = "true";
    script.onload = finish; script.onerror = () => reject(new Error("YouTube could not be loaded.")); document.head.appendChild(script);
  });
}

export function SyncedPlayer({ media, playback, isHost, onControl, onNotice }: { media: Media; playback: PlaybackState; isHost: boolean; onControl(type: "PLAY" | "PAUSE" | "SEEK", positionMs?: number): void; onNotice(message: string): void }) {
  const mountRef = useRef<HTMLDivElement>(null); const wrapperRef = useRef<HTMLDivElement>(null); const playerRef = useRef<YouTubePlayer | null>(null); const readyRef = useRef(false);
  const playbackRef = useRef(playback); const onControlRef = useRef(onControl); const hostRef = useRef(isHost); const localIntentRef = useRef<{ isPlaying: boolean; until: number } | null>(null);
  playbackRef.current = playback; onControlRef.current = onControl; hostRef.current = isHost;
  const [ready, setReady] = useState(false); const [current, setCurrent] = useState(0); const [duration, setDuration] = useState(0); const [volume, setVolume] = useState(80); const [muted, setMuted] = useState(false); const [preview, setPreview] = useState<number | null>(null); const [buffering, setBuffering] = useState(true); const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false; setReady(false); setFailed(false); setBuffering(true); readyRef.current = false;
    void loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(mountRef.current, { videoId: media.src, playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0 }, events: {
        onReady: () => { if (cancelled) return; readyRef.current = true; setReady(true); setBuffering(false); setDuration(playerRef.current?.getDuration() ?? 0); },
        onStateChange: (event) => {
          if (!window.YT) return;
          setBuffering(event.data === window.YT.PlayerState.BUFFERING);
          const isPlayingNow = event.data === window.YT.PlayerState.PLAYING;
          if (event.data !== window.YT.PlayerState.PLAYING && event.data !== window.YT.PlayerState.PAUSED) return;
          const intent = localIntentRef.current;
          if (intent && intent.until > Date.now() && intent.isPlaying === isPlayingNow) { localIntentRef.current = null; return; }
          if (intent && intent.until <= Date.now()) localIntentRef.current = null;
          // The large center play/pause target is inside YouTube's iframe. Treat host
          // interaction there exactly like the custom controls and publish it to the room.
          if (hostRef.current && isPlayingNow !== playbackRef.current.isPlaying) {
            localIntentRef.current = { isPlaying: isPlayingNow, until: Date.now() + 1_500 };
            onControlRef.current(isPlayingNow ? "PLAY" : "PAUSE", Math.round((playerRef.current?.getCurrentTime() ?? 0) * 1_000));
          }
        },
        onError: () => { setFailed(true); setBuffering(false); }
      } });
    }).catch(() => { if (!cancelled) { setFailed(true); setBuffering(false); } });
    return () => { cancelled = true; playerRef.current = null; };
  }, [media.src]);

  useEffect(() => { const timer = window.setInterval(() => { const player = playerRef.current; if (!player || !readyRef.current) return; setCurrent(player.getCurrentTime()); setDuration(player.getDuration()); }, 350); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const synchronize = (): void => {
      const player = playerRef.current; if (!player || !ready) return;
      const target = expectedPositionMs(playback) / 1000; const drift = calculateDriftMs(player.getCurrentTime(), playback, Date.now());
      if (!playback.isPlaying) { player.pauseVideo(); if (Math.abs(drift) >= 150) player.seekTo(target, true); return; }
      if (Math.abs(drift) >= 450) player.seekTo(target, true);
      if (player.getPlayerState() !== window.YT?.PlayerState.PLAYING) player.playVideo();
    };
    synchronize(); const reconciliation = window.setInterval(synchronize, 2_000);
    return () => window.clearInterval(reconciliation);
  }, [playback, ready]);

  const toggle = (): void => { const player = playerRef.current; if (!player || !isHost) return; const positionMs = player.getCurrentTime() * 1_000; const nextPlaying = !playback.isPlaying; localIntentRef.current = { isPlaying: nextPlaying, until: Date.now() + 1_500 }; if (nextPlaying) { player.playVideo(); onControl("PLAY", positionMs); } else { player.pauseVideo(); onControl("PAUSE", positionMs); } };
  const commitSeek = (): void => { const value = preview; if (value === null) return; playerRef.current?.seekTo(value, true); if (isHost) onControl("SEEK", value * 1_000); setPreview(null); };
  const enterFullscreen = (): void => { void wrapperRef.current?.requestFullscreen?.(); };
  const toggleMute = (): void => { const player = playerRef.current; if (!player) return; if (muted) player.unMute(); else player.mute(); setMuted(!muted); };
  return <div className={`synced-player ${isHost ? "host-player" : "viewer-player"}`} ref={wrapperRef}>
    <div className="youtube-mount" ref={mountRef} />
    <div className="player-shade" />
    {buffering && !failed && <div className="player-status"><span className="loader" /> Loading trailer</div>}
    {failed && <div className="player-status player-error">This YouTube trailer could not be played. Try another pick from the shuffle list.</div>}
    {!isHost && <span className="viewer-lock">Host is controlling playback</span>}
    {isHost && <div className="player-controls"><div className="progress-row"><span>{formatTime(preview ?? current)}</span><input aria-label="Trailer position" type="range" min="0" max={duration || 1} step="0.1" value={preview ?? current} onChange={(event) => setPreview(Number(event.target.value))} onPointerUp={commitSeek} onKeyUp={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") commitSeek(); }} /><span>{formatTime(duration)}</span></div><div className="control-row"><button className="control-play" aria-label={playback.isPlaying ? "Pause" : "Play"} onClick={toggle}>{playback.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button><span className="control-title">{playback.isPlaying ? "Playing trailer in sync" : "Ready when the host is"}</span><div className="volume"><button aria-label="Mute" onClick={toggleMute}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input aria-label="Volume" type="range" min="0" max="100" step="5" value={volume} onChange={(event) => { const value = Number(event.target.value); playerRef.current?.setVolume(value); setMuted(false); setVolume(value); }} /></div><button aria-label="Fullscreen" onClick={enterFullscreen}><Expand size={18} /></button></div></div>}
    <span className="youtube-badge"><Shuffle size={12} /> Trailer night</span>
  </div>;
}
