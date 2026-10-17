"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Copy, Film, Play, Search, Shuffle, Sparkles, Users, Zap } from "lucide-react";
import { DEMO_MEDIA, type RoomSnapshot } from "@afterhours/shared";
import { api } from "./api";
import { BrandGlyph, BrandLogo } from "./brand-logo";

interface RoomResponse { room: RoomSnapshot; token: string; inviteUrl?: string; accessKey?: string; }
const persist = (roomId: string, token: string) => sessionStorage.setItem(`afterhours:${roomId}`, token);

export function Landing() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bootLeaving, setBootLeaving] = useState(false);
  const [bootLabel, setBootLabel] = useState("ᚠᚢᚦᚨᚱ / ᚲᚷᚹᚺᚾ");
  const [name, setName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [title, setTitle] = useState("Friday night at the movies");
  const [privateRoom, setPrivateRoom] = useState(true);
  const [mediaId, setMediaId] = useState("oppenheimer-trailer");
  const [hasChosenMedia, setHasChosenMedia] = useState(false);
  const [heroMediaId, setHeroMediaId] = useState("oppenheimer-trailer");
  const [roomCode, setRoomCode] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const [shuffleRound, setShuffleRound] = useState(0);

  const rotatePicks = (): void => {
    setHeroMediaId((current) => {
      const options = DEMO_MEDIA.filter((item) => item.id !== current);
      return options[Math.floor(Math.random() * options.length)]!.id;
    });
    setShuffleRound((round) => round + 1);
  };

  useEffect(() => {
    const leave = window.setTimeout(() => setBootLeaving(true), 3_000);
    const remove = window.setTimeout(() => setLoading(false), 3_900);
    return () => { window.clearTimeout(leave); window.clearTimeout(remove); };
  }, []);

  useEffect(() => {
    const finalLabel = "AFTER / HOURS";
    const glyphs = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛜᛟ";
    let revealed = 0;
    let cycles = 0;
    const interval = window.setInterval(() => {
      cycles += 1;
      if (cycles % 3 === 0 && revealed < finalLabel.length) revealed += 1;
      setBootLabel(finalLabel.split("").map((character, index) => character === " " || index < revealed ? character : glyphs[Math.floor(Math.random() * glyphs.length)]).join(""));
      if (revealed === finalLabel.length) window.clearInterval(interval);
    }, 70);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      entry.target.classList.toggle("is-visible", entry.isIntersecting);
    }), { threshold: 0.14, rootMargin: "0px 0px -48px 0px" });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(rotatePicks, 5_000);
    return () => window.clearTimeout(timer);
  }, [shuffleRound]);

  const media = useMemo(() => DEMO_MEDIA.filter((item) => `${item.title} ${item.genres.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const featured = DEMO_MEDIA.find((item) => item.id === heroMediaId) ?? DEMO_MEDIA[0]!;
  const selectedMedia = DEMO_MEDIA.find((item) => item.id === mediaId) ?? DEMO_MEDIA[0]!;

  const create = async (): Promise<void> => {
    setError("");
    setBusy("create");
    try {
      const result = await api<RoomResponse>("/api/rooms", { method: "POST", body: JSON.stringify({ displayName: name, title, accessMode: privateRoom ? "PRIVATE" : "PUBLIC", maxParticipants: 10, mediaId }) });
      persist(result.room.id, result.token);
      router.push(`/room/${result.room.id}${result.accessKey ? `?key=${encodeURIComponent(result.accessKey)}` : ""}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the room.");
    } finally {
      setBusy(null);
    }
  };

  const join = async (): Promise<void> => {
    const code = roomCode.trim().toUpperCase();
    if (!joinName.trim()) return setError("Enter the display name you want the room to see.");
    if (!code) return setError("Enter the room code your host shared.");
    setError("");
    setBusy("join");
    try {
      const result = await api<RoomResponse>("/api/rooms/join", { method: "POST", body: JSON.stringify({ roomCode: code, displayName: joinName }) });
      persist(result.room.id, result.token);
      router.push(`/room/${result.room.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join the room.");
    } finally {
      setBusy(null);
    }
  };

  return <main className="landing-shell">
    <div className="ambient-field" aria-hidden="true"><i /><i /><i /><i /></div>
    {loading && <div className={`boot-screen ${bootLeaving ? "leaving" : ""}`} role="status" aria-label="Opening AfterHours">
      <div className="boot-title-stage" aria-hidden="true"><div className="boot-film-track">
        {[...DEMO_MEDIA, ...DEMO_MEDIA].map((item, index) => <div className="boot-film-title" data-index={index % DEMO_MEDIA.length} key={`${item.id}-${index}`}>
          <span>{String((index % DEMO_MEDIA.length) + 1).padStart(2, "0")} <i /> {item.year}</span>
          <b>{item.title.replace(" — Official Trailer", "")}</b>
          <small>{item.genres.slice(0, 2).join(" / ")}</small>
        </div>)}
      </div><div className="boot-title-floor" /></div>
      <div className="boot-centerpiece">
        <div className="boot-minimal-lockup">
          <BrandGlyph className="boot-mark" />
          <span className="boot-wordmark" aria-hidden="true">{bootLabel.split("").map((character, index) => <span className={character === " " ? "boot-letter-gap" : undefined} key={index}>{character === " " ? "\u00a0" : character}</span>)}</span><span className="sr-only">After Hours</span>
        </div>
        <div className="boot-progress" aria-hidden="true"><i /></div>
      </div>
    </div>}

    <nav className="nav shell-nav">
      <BrandLogo href="#top" />
      <div className="nav-links"><a href="#discover">Discover</a><a href="#how">The experience</a><a className="text-button" href="#start">Enter the room <ArrowRight size={15} /></a></div>
    </nav>

    <section id="top" className="stream-hero experience-hero">
      <img key={featured.id} className="hero-backdrop" src={featured.poster} alt="" />
      <div className="hero-shade" /><div className="hero-grain" />
      <div className="hero-topline"><span>NO. 01 <b>/</b> FOREVER</span></div>
      <div className="stream-copy" data-reveal>
        <p className="eyebrow"><span className="eyebrow-line" /> THE FEATURE PRESENTATION <span>· {featured.year}</span></p>
        <h1 key={`title-${featured.id}`}>{featured.title.replace(" — Official Trailer", "")}</h1>
        <p className="hero-description" key={`description-${featured.id}`}>{featured.description}</p>
        <div className="hero-actions">
          <a className="primary-button" href="#start"><Play size={16} fill="currentColor" /> Start a watch party</a>
          <button className="secondary-button more-picks-button" onClick={rotatePicks}><Shuffle size={15} /> Another feature <svg key={shuffleRound} className="shuffle-timer" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="98" height="42" rx="8" pathLength="100" /></svg></button>
        </div>
        <div className="proof"><span><Users size={15} /> Up to 10 in the room</span><span><Zap size={15} /> Synced to the frame</span></div>
      </div>
      <div className="hero-glass-note" data-reveal><span className="glass-note-icon"><Sparkles size={15} /></span><span><b>The room is yours.</b><small>One link. Everyone in sync.</small></span><span className="glass-note-status"><i /> LIVE</span></div>
    </section>

    <div className="film-ribbon" aria-label="A better kind of movie night">
      <span>YOUR PEOPLE</span><i /><span>YOUR FILM</span><i /><span>ONE SHARED MOMENT</span><i /><span>NO DISTANCE IN THE ROOM</span>
    </div>

    <section id="start" className="start-section start-experience" data-reveal>
      <div className="start-card glass-card">
        <div className="start-intro">
          <p className="eyebrow">01 <span>—</span> MAKE IT A NIGHT</p>
          <h2>Bring everyone<br /><em>to the same scene.</em></h2>
          <p>Your private theater, ready when you are. Pick the opening trailer, name your room, and send the invite.</p>
          <div className="chosen-title"><img src={selectedMedia.poster} alt="" /><span><small>OPENING FEATURE</small><b>{selectedMedia.title.replace(" — Official Trailer", "")}</b></span><span className="chosen-check">✓</span></div>
        </div>
        <div className="form-grid">
          <label>HOST DISPLAY NAME<input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="e.g. Vinay" /></label>
          <label>ROOM TITLE<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="media-select">OPENING TRAILER<select value={mediaId} onChange={(event) => { setMediaId(event.target.value); setHasChosenMedia(true); }}>{DEMO_MEDIA.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.durationLabel}</option>)}</select></label>
          <label className="toggle-row"><input type="checkbox" checked={privateRoom} onChange={(event) => setPrivateRoom(event.target.checked)} /><span><b>{privateRoom ? "Private invitation" : "Open room"}</b><small>{privateRoom ? "Only guests with your invite can enter." : "Anyone with the room code can enter."}</small></span></label>
          <button className="primary-button wide" type="button" disabled={busy !== null} onClick={create}>{busy === "create" ? "Opening the curtains…" : <><Film size={17} /> Create watch party <ArrowRight size={16} /></>}</button>
        </div>
      </div>
      <div className="join-card glass-card">
        <p className="eyebrow">02 <span>—</span> YOU HAVE AN INVITE</p>
        <h3>Walk right in.</h3>
        <p>Enter an open screening with its room code, or follow your private invitation link.</p>
        <div className="join-fields">
          <label>DISPLAY NAME<input value={joinName} maxLength={30} onChange={(event) => setJoinName(event.target.value)} placeholder="e.g. Ananya" /></label>
          <label>ROOM CODE<input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={8} placeholder="X7M4Q2K" onKeyDown={(event) => { if (event.key === "Enter") void join(); }} /></label>
          <button className="secondary-button" disabled={busy !== null} onClick={join}>{busy === "join" ? "Joining…" : <>Join the screening <ArrowRight size={15} /></>}</button>
        </div>
        <small>Private rooms require their complete invitation link.</small>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    <section id="discover" className="discover discover-experience" data-reveal>
      <div className="section-heading">
        <div><p className="eyebrow">03 <span>—</span> THE AFTERHOURS COLLECTION</p><h2>Pick your opening scene.</h2><p className="section-subtitle">A few all-time favorites, ready to bring the room together.</p></div>
        <label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a film or mood" /></label>
      </div>
      <div className="media-grid">{media.map((item) => <button className={`media-card ${hasChosenMedia && mediaId === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setMediaId(item.id); setHasChosenMedia(true); }} aria-pressed={hasChosenMedia && mediaId === item.id}>
        <img src={item.poster} alt="" /><div className="media-overlay"><span>{item.durationLabel}</span><i><Play size={16} fill="currentColor" /></i></div>
        <div className="media-info"><p>{item.genres.join(" · ")}</p><h3>{item.title.replace(" — Official Trailer", "")}</h3><small>{item.year} <span>·</span> Official trailer</small></div>
      </button>)}</div>
    </section>

    <section className="feature-strip feature-experience" data-reveal>
      <article><span className="feature-icon"><Sparkles size={18} /></span><div><b>More than pressing play</b><span>Chat, reactions, polls, and a shared queue.</span></div></article>
      <article><span className="feature-icon"><Zap size={18} /></span><div><b>Every frame together</b><span>Host playback commands ripple to everyone.</span></div></article>
      <article><span className="feature-icon"><Users size={18} /></span><div><b>Room for your whole crew</b><span>Invite up to nine friends into the moment.</span></div></article>
    </section>

    <section id="how" className="how how-experience" data-reveal>
      <div><p className="eyebrow">04 <span>—</span> MADE FOR THE MOMENT</p><h2>Distance ends<br /><em>at the opening credits.</em></h2></div>
      <div className="steps"><article><span>01</span><h3>Set the scene</h3><p>Choose a trailer and create a private watch room.</p></article><article><span>02</span><h3>Send the invite</h3><p>Friends join with a link or a room code.</p></article><article><span>03</span><h3>Lose yourselves</h3><p>Play, pause, chat, and react in one shared moment.</p></article></div>
    </section>

    <footer className="experience-footer"><BrandLogo href="#top" /><p>Stay for the feeling.</p><button className="footer-copy" onClick={() => navigator.clipboard?.writeText(location.href)}><Copy size={14} /> Share the room</button></footer>
  </main>;
}
