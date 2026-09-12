"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Departure() {
  const [destination, setDestination] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category") || null;
    let recentIds = [];
    try { recentIds = JSON.parse(sessionStorage.getItem("tms-history") || "[]").map((item) => item.id).slice(0, 50); } catch { recentIds = []; }
    let cancelled = false;
    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), 10000);

    fetch("/api/destinations/random", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recentIds, category }), signal: controller.signal })
      .then(async (response) => { window.clearTimeout(requestTimeout); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.code); return payload.destination; })
      .then((result) => {
        if (cancelled) return;
        setDestination(result);
        try { sessionStorage.setItem("tms-history", JSON.stringify([{ ...result }, ...JSON.parse(sessionStorage.getItem("tms-history") || "[]").filter((item) => item.id !== result.id)].slice(0, 100))); } catch { /* best effort */ }
        const message = { type: "destination", destination: result };
        if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("take-me-somewhere"); channel.postMessage(message); channel.close(); }
        if (window.opener) { try { window.opener.postMessage(message, window.location.origin); } catch { /* best effort */ } }
        navigator.sendBeacon?.(`/api/destinations/${result.id}/click`, new Blob([], { type: "application/json" }));
        window.setTimeout(() => { try { window.opener = null; } catch { /* browser controlled */ } window.location.replace(result.url); }, 2400);
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(requestTimeout);
        setError(true);
        const message = { type: "departure-error" };
        if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("take-me-somewhere"); channel.postMessage(message); channel.close(); }
        if (window.opener) { try { window.opener.postMessage(message, window.location.origin); } catch { /* best effort */ } }
      });
    return () => { cancelled = true; window.clearTimeout(requestTimeout); controller.abort(); };
  }, []);

  return <main id="main-content" className={`departure-shell ${destination ? "revealed" : ""}`}><div className="departure-stars" aria-hidden="true">✦　·　✧　　·　✦　·　　✧</div><section className="departure-content" role="status" aria-live="polite">{error ? <><p className="departure-kicker">signal lost</p><h1>That portal slipped away.</h1><p>No worries—the web is a big place. Try another departure.</p><Link className="primary-action departure-return" href="/">return to the lounge →</Link></> : destination ? <><p className="departure-kicker">your next destination</p><div className="departure-stamp" aria-hidden="true">✦</div><h1>{destination.title}</h1><p>{destination.description}</p><span className="departure-category">{destination.category.replaceAll("-", " ")}</span><div className="departure-line" aria-hidden="true"><span /> opening portal <span /></div></> : <><p className="departure-kicker">please remain curious</p><div className="departure-loader" aria-hidden="true"><span /><span /><span /></div><h1>Finding somewhere…</h1><p>Checking the coordinates of a very odd little place.</p></>}</section></main>;
}
