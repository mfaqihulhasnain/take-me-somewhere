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
  const [voteBusy, setVoteBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const channelRef = useRef(null);
  const departureTimeoutRef = useRef(null);
  const panelRef = useRef(null);
  const revealRef = useRef(null);
  const previousFocusRef = useRef(null);

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
      window.clearTimeout(departureTimeoutRef.current);
      setCurrent(destination);
      setHistory(saveHistory(destination));
      setVoteCounts({ upvotes: Number(destination.upvotes || 0), downvotes: Number(destination.downvotes || 0) });
      setUserVote(null);
      setStage("revealed");
      setAnnouncement(`Found: ${destination.title}. Ready for another trip when you are.`);
      window.setTimeout(() => revealRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }), 150);
    };
    const receiveMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "destination") acceptDestination(event.data.destination);
      if (event.data?.type === "departure-error") { window.clearTimeout(departureTimeoutRef.current); setStage("error"); setAnnouncement("No portal in that vibe yet. Try Surprise Me."); }
    };
    window.addEventListener("message", receiveMessage);
    if (typeof BroadcastChannel === "undefined") return () => { window.clearTimeout(hydrateStorage); window.clearTimeout(departureTimeoutRef.current); window.removeEventListener("message", receiveMessage); };
    const channel = new BroadcastChannel("take-me-somewhere");
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === "destination") acceptDestination(event.data.destination);
      if (event.data?.type === "departure-error") { window.clearTimeout(departureTimeoutRef.current); setStage("error"); setAnnouncement("No portal in that vibe yet. Try Surprise Me."); }
    };
    return () => { window.clearTimeout(hydrateStorage); window.clearTimeout(departureTimeoutRef.current); window.removeEventListener("message", receiveMessage); channel.close(); };
  }, []);

  useEffect(() => {
    if (!panel) return undefined;
    if (!previousFocusRef.current || !document.contains(previousFocusRef.current)) previousFocusRef.current = document.activeElement;
    const dialog = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusables = () => [...(dialog?.querySelectorAll(focusableSelector) || [])];
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPanel(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => focusables()[0]?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [panel]);

  const openPanel = (event) => {
    previousFocusRef.current = event.currentTarget;
    setPanel(event.currentTarget.dataset.panel);
  };

  const recentIds = useCallback(() => getStored(STORAGE_KEYS.history, []).map((item) => item.id).slice(0, MAX_RECENT_IDS), []);

  const fetchDestination = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/destinations/random", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recentIds: recentIds(), category: selectedCategory }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.code || "DESTINATION_LOOKUP_FAILED");
      return payload.destination;
    } finally { window.clearTimeout(timeout); }
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
      window.clearTimeout(departureTimeoutRef.current);
      departureTimeoutRef.current = window.setTimeout(() => {
        setStage("error");
        setAnnouncement("That portal is taking too long. You can safely try another.");
      }, 12000);
      return;
    }
    try {
      const destination = await fetchDestination();
      setCurrent(destination);
      setHistory(saveHistory(destination));
      setVoteCounts({ upvotes: Number(destination.upvotes || 0), downvotes: Number(destination.downvotes || 0) });
      setStage("revealed");
      setAnnouncement(`Found: ${destination.title}. Your browser kept the portal here.`);
      navigator.sendBeacon?.(`/api/destinations/${destination.id}/click`, new Blob([], { type: "application/json" }));
      window.setTimeout(() => window.location.assign(destination.url), 1400);
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
    setAnnouncement(isFavorite ? `${current.title} removed from saved.` : `${current.title} saved for later.`);
  };

  const sendVote = async (value) => {
    if (!current || !sessionId || voteBusy) return;
    const nextValue = userVote === value ? "CLEAR" : value;
    const previousVote = userVote;
    setUserVote(nextValue === "CLEAR" ? null : nextValue);
    setVoteBusy(true);
    try {
      const response = await fetch(`/api/destinations/${current.id}/vote`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, value: nextValue }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Vote failed");
      setVoteCounts({ upvotes: payload.upvotes, downvotes: payload.downvotes });
      setAnnouncement(nextValue === "CLEAR" ? "Vote cleared." : "Vote saved. Thanks for helping the board.");
    } catch {
      setUserVote(previousVote);
      setAnnouncement("The voting booth lost its pencil. Your vote can try again.");
    } finally { setVoteBusy(false); }
  };

  const report = async (reason) => {
    if (!current || !sessionId || reportBusy) return;
    setReportBusy(true);
    try {
      const response = await fetch(`/api/destinations/${current.id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, reason }) });
      if (!response.ok) throw new Error("Report failed");
      setReportSent(true);
      setPanel(null);
      setAnnouncement("Noted. A tiny internet caretaker will investigate.");
    } catch { setAnnouncement("The report pigeon got lost. Please try again."); }
    finally { setReportBusy(false); }
  };

  return (
    <main id="main-content" tabIndex="-1" className="portal-shell">
      <div className="grain" aria-hidden="true" />
      <div className="orbit orbit-one" aria-hidden="true" />
      <div className="orbit orbit-two" aria-hidden="true" />
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="Take Me Somewhere home"><span className="wordmark-mark">✦</span> take me<br /><em>somewhere</em></Link>
        <div className="top-actions">
          <button type="button" className="quiet-button header-history" data-panel="history" onClick={openPanel} aria-haspopup="dialog" aria-label={`Open journey history, ${history.length} discoveries`}><span aria-hidden="true">◎</span> history <b>{history.length}</b></button>
          <button type="button" className="quiet-button header-saved" data-panel="favorites" onClick={openPanel} aria-haspopup="dialog" aria-label={`Open saved favorites, ${favorites.length} saved`}><span aria-hidden="true">♡</span> saved <b>{favorites.length}</b></button>
          <Link className="quiet-button nav-link submit-home-link header-submit" href="/submit">submit a site ↗</Link>
          <Link className="quiet-button nav-link header-about" href="/about">about</Link>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">No plans.<br /><span>Just somewhere.</span></h1>
        <p className="hero-copy">A button to bizarre tools, beautiful rabbit holes,<br className="desktop-only" /> and the web’s best-kept little secrets.</p>

        <div className={`portal-button-wrap ${stage === "loading" ? "is-loading" : ""}`}>
          <div className="portal-ring ring-a" aria-hidden="true" />
          <div className="portal-ring ring-b" aria-hidden="true" />
          <button type="button" className="portal-button" onClick={handleTakeMeSomewhere} disabled={stage === "loading"} aria-describedby="portal-status">
            <span className="button-star">✦</span>
            <span className="button-label">{stage === "loading" ? "finding a portal" : current ? "go somewhere else" : "take me somewhere"}</span>
            <span className="button-arrow">↗</span>
          </button>
        </div>
        <p id="portal-status" className="portal-status" aria-live="polite">{announcement}</p>

        <div className="vibe-selector">
          <span className="picker-label" id="vibe-label">choose a vibe <small>optional</small></span>
          <div className="vibe-picker" role="group" aria-labelledby="vibe-label">
            <button type="button" aria-pressed={selectedCategory === null} className={`vibe-pill ${selectedCategory === null ? "active" : ""}`} onClick={() => setSelectedCategory(null)}>surprise me</button>
            {CATEGORIES.map((category) => <button type="button" aria-pressed={selectedCategory === category.slug} key={category.slug} className={`vibe-pill ${selectedCategory === category.slug ? "active" : ""}`} onClick={() => setSelectedCategory(category.slug)}>{category.label}</button>)}
          </div>
        </div>
      </section>

      <section ref={revealRef} className={`reveal-card ${current ? "visible" : ""} ${stage === "loading" ? "scanning" : ""}`} aria-busy={stage === "loading"} aria-label="Latest discovery">
        {current ? <>
          <div className="reveal-topline"><span className="ticket-label">latest find / {categoryLabel(current.category)}</span><span className="weirdness">weirdness <b>{"✦".repeat(Math.max(1, Math.min(5, current.weirdness || 3)))}</b></span></div>
          <div className="reveal-content"><div><p className="reveal-kicker">you are going to…</p><h2>{current.title}</h2><p>{current.description}</p></div><div className="reveal-actions"><button type="button" onClick={toggleFavorite} className={`icon-action ${isFavorite ? "selected" : ""}`} aria-pressed={Boolean(isFavorite)} aria-label={isFavorite ? "Remove from saved" : "Save this find"}>{isFavorite ? "♥" : "♡"}</button><button type="button" data-panel="report" onClick={openPanel} className="icon-action" aria-haspopup="dialog" aria-label="Report this destination">⚑</button></div></div>
          <div className="vote-row"><span>Did it spark joy?</span><button type="button" disabled={voteBusy} aria-pressed={userVote === "UP"} onClick={() => sendVote("UP")} className={userVote === "UP" ? "voted" : ""}>↑ yes <small>{voteCounts.upvotes}</small></button><button type="button" disabled={voteBusy} aria-pressed={userVote === "DOWN"} onClick={() => sendVote("DOWN")} className={userVote === "DOWN" ? "voted" : ""}>↓ no <small>{voteCounts.downvotes}</small></button>{reportSent && <span className="reported">thanks for the signal</span>}</div>
        </> : <div className="empty-reveal"><span className="empty-star">✦</span><span>Your next find will land here.</span></div>}
      </section>

      <footer className="footer-note"><span>curated with curiosity</span><span className="footer-dots">•••</span><span>no algorithmic itinerary</span><span className="footer-links"><Link href="/about">about</Link><Link href="/submit">submit a site</Link></span></footer>

      {panel && <div className="panel-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}><section ref={panelRef} className="side-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <button type="button" className="close-panel" onClick={() => setPanel(null)} aria-label="Close panel">×</button>
        {panel === "report" ? <><p className="panel-eyebrow">send a signal</p><h2 id="panel-title">Something off?</h2><p className="panel-intro">Help keep the weird web wonderful. What happened?</p><button type="button" disabled={reportBusy} className="report-choice" onClick={() => report("DEAD")}>☄ <span><b>It’s gone</b><small>The link is dead or broken.</small></span></button><button type="button" disabled={reportBusy} className="report-choice" onClick={() => report("INAPPROPRIATE")}>⚠ <span><b>Not for here</b><small>It’s inappropriate or unsafe.</small></span></button></> : <><p className="panel-eyebrow">your paper trail</p><h2 id="panel-title">{panel === "history" ? "Journey history" : "Saved for later"}</h2><p className="panel-intro">{panel === "history" ? "Your last 100 stops in this tab session. Closing the session clears them." : "Saved on this device until you remove your browser data."}</p><div className="panel-list">{(panel === "history" ? history : favorites).length ? (panel === "history" ? history : favorites).map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="panel-item"><span>{categoryLabel(item.category)}</span><b>{item.title}</b><small>{item.description}</small></a>) : <div className="panel-empty">Nothing here yet.<br />The next click could change that.</div>}</div></>}
      </section></div>}
    </main>
  );
}
