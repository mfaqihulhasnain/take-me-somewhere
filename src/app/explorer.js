"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORIES, MAX_HISTORY_ITEMS, MAX_RECENT_IDS } from "@/lib/constants";

const STORAGE_KEYS = { session: "tms-session-id", history: "tms-history", favorites: "tms-favorites" };

function getStored(key, fallback) {
  try { return JSON.parse(window[key === STORAGE_KEYS.session || key === STORAGE_KEYS.history ? "sessionStorage" : "localStorage"].getItem(key)) || fallback; } catch { return fallback; }
}

function categoryLabel(slug) {
  return CATEGORIES.find((category) => category.slug === slug)?.label || "Surprise me";
}

function saveHistory(item) {
  const existing = getStored(STORAGE_KEYS.history, []);
  const next = [item, ...existing.filter((entry) => entry.id !== item.id)].slice(0, MAX_HISTORY_ITEMS);
  sessionStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next));
  return next;
}

export default function Explorer() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [stage, setStage] = useState("idle");
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [panel, setPanel] = useState(null);
  const [announcement, setAnnouncement] = useState("Ready when you are.");
  const [userVote, setUserVote] = useState(null);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0 });
  const [reportSent, setReportSent] = useState(false);
  const channelRef = useRef(null);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    let id = sessionStorage.getItem(STORAGE_KEYS.session);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(STORAGE_KEYS.session, id); }
    return id;
  }, []);

  useEffect(() => {
    const hydrateStorage = window.setTimeout(() => {
      setHistory(getStored(STORAGE_KEYS.history, []));
      setFavorites(getStored(STORAGE_KEYS.favorites, []));
    }, 0);
    const acceptDestination = (destination) => {
      if (!destination?.id) return;
      setCurrent(destination);
      setHistory(saveHistory(destination));
      setVoteCounts({ upvotes: 0, downvotes: 0 });
      setUserVote(null);
      setStage("revealed");
      setAnnouncement(`Found: ${destination.title}. Opening the portal.`);
    };
    const receiveMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "destination") acceptDestination(event.data.destination);
      if (event.data?.type === "departure-error") { setStage("error"); setAnnouncement("No portal in that vibe yet. Try Surprise Me."); }
    };
    window.addEventListener("message", receiveMessage);
    if (typeof BroadcastChannel === "undefined") return () => { window.clearTimeout(hydrateStorage); window.removeEventListener("message", receiveMessage); };
    const channel = new BroadcastChannel("take-me-somewhere");
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === "destination") acceptDestination(event.data.destination);
      if (event.data?.type === "departure-error") { setStage("error"); setAnnouncement("No portal in that vibe yet. Try Surprise Me."); }
    };
    return () => { window.clearTimeout(hydrateStorage); window.removeEventListener("message", receiveMessage); channel.close(); };
  }, []);

  const recentIds = useCallback(() => getStored(STORAGE_KEYS.history, []).map((item) => item.id).slice(0, MAX_RECENT_IDS), []);

  const fetchDestination = useCallback(async () => {
    const response = await fetch("/api/destinations/random", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recentIds: recentIds(), category: selectedCategory }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.code || "DESTINATION_LOOKUP_FAILED");
    return payload.destination;
  }, [recentIds, selectedCategory]);

  const handleTakeMeSomewhere = useCallback(async () => {
    if (stage === "loading") return;
    setStage("loading");
    setReportSent(false);
    setUserVote(null);
    setAnnouncement("Checking the departure board…");
    const query = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : "";
    const popup = window.open(`/departure${query}`, "_blank");
    if (popup) {
      setAnnouncement("A portal is opening in a nearby tab.");
      return;
    }
    try {
      const destination = await fetchDestination();
      setCurrent(destination);
      setHistory(saveHistory(destination));
      setStage("revealed");
      setAnnouncement(`Found: ${destination.title}. Your browser kept the portal here.`);
      navigator.sendBeacon?.(`/api/destinations/${destination.id}/click`, new Blob([], { type: "application/json" }));
      window.setTimeout(() => window.location.assign(destination.url), 950);
    } catch (error) {
      setStage("error");
      setAnnouncement(error.message === "NO_DESTINATIONS" ? "No portals in that vibe yet. Try Surprise Me." : "The portal hiccupped. Try again in a second.");
    }
  }, [fetchDestination, selectedCategory, stage]);

  const isFavorite = current && favorites.some((item) => item.id === current.id);
  const toggleFavorite = () => {
    if (!current) return;
    const next = isFavorite ? favorites.filter((item) => item.id !== current.id) : [current, ...favorites];
    setFavorites(next);
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(next));
  };

  const sendVote = async (value) => {
    if (!current || !sessionId) return;
    const nextValue = userVote === value ? "CLEAR" : value;
    setUserVote(nextValue === "CLEAR" ? null : nextValue);
    try {
      const response = await fetch(`/api/destinations/${current.id}/vote`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, value: nextValue }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Vote failed");
      setVoteCounts({ upvotes: payload.upvotes, downvotes: payload.downvotes });
    } catch { setAnnouncement("The voting booth lost its pencil. Your vote can try again."); }
  };

  const report = async (reason) => {
    if (!current || !sessionId) return;
    try {
      const response = await fetch(`/api/destinations/${current.id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, reason }) });
      if (!response.ok) throw new Error("Report failed");
      setReportSent(true);
      setPanel(null);
      setAnnouncement("Noted. A tiny internet caretaker will investigate.");
    } catch { setAnnouncement("The report pigeon got lost. Please try again."); }
  };

  return (
    <main className="portal-shell">
      <div className="grain" aria-hidden="true" />
      <div className="orbit orbit-one" aria-hidden="true" />
      <div className="orbit orbit-two" aria-hidden="true" />
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="Take Me Somewhere home"><span className="wordmark-mark">✦</span> take me<br /><em>somewhere</em></Link>
        <div className="top-actions">
          <button className="quiet-button" onClick={() => setPanel("history")} aria-label={`Open journey history, ${history.length} discoveries`}><span>◎</span> history <b>{history.length}</b></button>
          <button className="quiet-button" onClick={() => setPanel("favorites")} aria-label={`Open saved favorites, ${favorites.length} saved`}><span>♡</span> saved <b>{favorites.length}</b></button>
          <Link className="quiet-button nav-link submit-home-link" href="/submit">submit a site ↗</Link>
          <Link className="quiet-button nav-link" href="/about">about</Link>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">No plans.<br /><span>Just somewhere.</span></h1>
        <p className="hero-copy">A button to bizarre tools, beautiful rabbit holes,<br className="desktop-only" /> and the web’s best-kept little secrets.</p>

        <div className={`portal-button-wrap ${stage === "loading" ? "is-loading" : ""}`}>
          <div className="portal-ring ring-a" aria-hidden="true" />
          <div className="portal-ring ring-b" aria-hidden="true" />
          <button className="portal-button" onClick={handleTakeMeSomewhere} disabled={stage === "loading"} aria-describedby="portal-status">
            <span className="button-star">✦</span>
            <span className="button-label">{stage === "loading" ? "finding a portal" : "take me somewhere"}</span>
            <span className="button-arrow">↗</span>
          </button>
        </div>
        <p id="portal-status" className="portal-status" aria-live="polite">{announcement}</p>

        <div className="vibe-picker" aria-label="Choose a vibe">
          <span className="picker-label">or choose a vibe</span>
          <button className={`vibe-pill ${selectedCategory === null ? "active" : ""}`} onClick={() => setSelectedCategory(null)}>surprise me</button>
          {CATEGORIES.map((category) => <button key={category.slug} className={`vibe-pill ${selectedCategory === category.slug ? "active" : ""}`} onClick={() => setSelectedCategory(category.slug)}>{category.label}</button>)}
        </div>
      </section>

      <section className={`reveal-card ${current ? "visible" : ""} ${stage === "loading" ? "scanning" : ""}`} aria-live="polite">
        {current ? <>
          <div className="reveal-topline"><span className="ticket-label">latest find / {categoryLabel(current.category)}</span><span className="weirdness">weirdness <b>{"✦".repeat(Math.max(1, Math.min(5, current.weirdness || 3)))}</b></span></div>
          <div className="reveal-content"><div><p className="reveal-kicker">you are going to…</p><h2>{current.title}</h2><p>{current.description}</p></div><div className="reveal-actions"><button onClick={toggleFavorite} className={`icon-action ${isFavorite ? "selected" : ""}`} aria-label={isFavorite ? "Remove from saved" : "Save this find"}>{isFavorite ? "♥" : "♡"}</button><button onClick={() => setPanel("report")} className="icon-action" aria-label="Report this destination">⚑</button></div></div>
          <div className="vote-row"><span>Did it spark joy?</span><button onClick={() => sendVote("UP")} className={userVote === "UP" ? "voted" : ""}>↑ yes <small>{voteCounts.upvotes}</small></button><button onClick={() => sendVote("DOWN")} className={userVote === "DOWN" ? "voted" : ""}>↓ no <small>{voteCounts.downvotes}</small></button>{reportSent && <span className="reported">thanks for the signal</span>}</div>
        </> : <div className="empty-reveal"><span className="empty-star">✦</span><span>Your next find will land here.</span></div>}
      </section>

      <footer className="footer-note"><span>curated with curiosity</span><span className="footer-dots">•••</span><span>no algorithmic itinerary</span><span className="footer-links"><Link href="/about">about</Link><Link href="/submit">submit a site</Link></span></footer>

      {panel && <div className="panel-backdrop" role="presentation" onClick={() => setPanel(null)}><section className="side-panel" role="dialog" aria-modal="true" aria-label={panel === "report" ? "Report destination" : panel === "history" ? "Journey history" : "Saved destinations"} onClick={(event) => event.stopPropagation()}>
        <button className="close-panel" onClick={() => setPanel(null)} aria-label="Close panel">×</button>
        {panel === "report" ? <><p className="panel-eyebrow">send a signal</p><h2>Something off?</h2><p className="panel-intro">Help keep the weird web wonderful. What happened?</p><button className="report-choice" onClick={() => report("DEAD")}>☄ <span><b>It’s gone</b><small>The link is dead or broken.</small></span></button><button className="report-choice" onClick={() => report("INAPPROPRIATE")}>⚠ <span><b>Not for here</b><small>It’s inappropriate or unsafe.</small></span></button></> : <><p className="panel-eyebrow">your paper trail</p><h2>{panel === "history" ? "Journey history" : "Saved for later"}</h2><p className="panel-intro">{panel === "history" ? "A little record of everywhere you’ve wandered this session." : "The ones worth coming back to."}</p><div className="panel-list">{(panel === "history" ? history : favorites).length ? (panel === "history" ? history : favorites).map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="panel-item"><span>{categoryLabel(item.category)}</span><b>{item.title}</b><small>{item.description}</small></a>) : <div className="panel-empty">Nothing here yet.<br />The next click could change that.</div>}</div></>}
      </section></div>}
    </main>
  );
}
