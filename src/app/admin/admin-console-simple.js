"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLink } from "@/app/brand";

async function api(url, options) {
  const response = await fetch(url, options);
  let payload = null;
  if (response.status !== 204) {
    try { payload = await response.json(); } catch { /* use the friendly fallback below */ }
  }
  if (!response.ok) throw new Error(payload?.error?.message || "The control room did not answer.");
  return payload;
}

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const payload = await api("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }); onLoggedIn(payload.admin); }
    catch (caught) { setError(caught.message); } finally { setBusy(false); }
  };
  return <main className="admin-shell admin-login"><div className="admin-login-card"><BrandLink /><p className="eyebrow-text">restricted airspace</p><h1>Control<br /><span>room.</span></h1><p className="admin-copy">The owner console for the departure board.</p><form onSubmit={submit} className="submit-form"><label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" /></label><label className="field"><span>Password</span><input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label><button className="primary-action submit-button" disabled={busy}>{busy ? "checking…" : "enter control room ↗"}</button><p className="form-status error" aria-live="polite">{error}</p></form></div></main>;
}

function Metric({ label, value, accent }) { return <div className={`admin-stat ${accent || ""}`}><b>{value ?? "—"}</b><span>{label}</span></div>; }

function SubmissionRow({ item, onAction }) {
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const act = async (action) => { setBusy(true); await onAction(item.id, action, note); setBusy(false); };
  return <article className="admin-row submission-row"><div><span className="admin-label">{item.category?.label} · {new Date(item.createdAt).toLocaleDateString()}</span><h2>{item.title}</h2><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a><p>{item.description}</p>{item.contactEmail && <small>contact: {item.contactEmail}</small>}</div><div className="admin-row-actions"><input className="input" aria-label={`Moderation note for ${item.title}`} placeholder="optional moderation note" value={note} onChange={(event) => setNote(event.target.value)} /><div><button type="button" className="admin-button approve" disabled={busy} onClick={() => act("APPROVE")}>approve</button><button type="button" className="admin-button reject" disabled={busy} onClick={() => act("REJECT")}>reject</button></div></div></article>;
}

function DestinationRow({ item, categories, onSave }) {
  const [draft, setDraft] = useState({ healthStatus: item.healthStatus, moderationStatus: item.moderationStatus, category: item.category?.slug, isNsfw: item.isNsfw });
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState("");
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const save = async () => { setBusy(true); setSaved(""); try { await onSave(item.id, draft); setSaved("saved"); } catch { setSaved("error"); } finally { setBusy(false); } };
  return <article className="admin-row destination-row"><div className="destination-info"><span className="admin-label">{item.category?.label} · {item.healthStatus.toLowerCase()}</span><h2>{item.title}</h2><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a><small>{item.clickCount} clicks · ↑ {item.upvotes} · ↓ {item.downvotes} · {item.reportCount} reports</small></div><div className="destination-controls"><label>category<select className="input compact" value={draft.category} onChange={update("category")}>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label><label>health<select className="input compact" value={draft.healthStatus} onChange={update("healthStatus")}><option>HEALTHY</option><option>SUSPECT</option><option>DEAD</option></select></label><label>moderation<select className="input compact" value={draft.moderationStatus} onChange={update("moderationStatus")}><option>APPROVED</option><option>FLAGGED</option></select></label><label className="check-row compact-check"><input type="checkbox" checked={draft.isNsfw} onChange={update("isNsfw")} /> NSFW</label><button type="button" className="admin-button approve" disabled={busy} onClick={save}>{busy ? "…" : saved || "save"}</button></div></article>;
}

const BOOST_OPTIONS = [{ value: "1", label: "Normal", help: "Pure random chance." }, { value: "1.25", label: "Gentle nudge", help: "A little more likely." }, { value: "1.5", label: "Promoted", help: "Noticeably more likely." }, { value: "2", label: "Spotlight", help: "Strong nudge, never guaranteed." }];

function nearestBoost(value) { return BOOST_OPTIONS.reduce((closest, option) => Math.abs(Number(option.value) - Number(value || 1)) < Math.abs(Number(closest.value) - Number(value || 1)) ? option : closest, BOOST_OPTIONS[0]).value; }

function BoostRow({ item, onSave }) {
  const [boost, setBoost] = useState(nearestBoost(item.rankingBoost)); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState("");
  const save = async () => { setBusy(true); setSaved(""); try { await onSave(item.id, Number(boost)); setSaved("saved"); } catch { setSaved("error"); } finally { setBusy(false); } };
  return <article className="admin-row boost-row"><div className="destination-info"><span className="admin-label">{item.category?.label}</span><h2>{item.title}</h2><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a><small>Current setting: {BOOST_OPTIONS.find((option) => option.value === boost)?.label || "Normal"}</small></div><div className="boost-controls"><label className="field"><span>Exposure</span><select className="input" value={boost} onChange={(event) => setBoost(event.target.value)}>{BOOST_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.help}</option>)}</select></label><button type="button" className="admin-button approve" disabled={busy} onClick={save}>{busy ? "…" : saved || "save"}</button></div></article>;
}

function RankingInfo({ onGoBoosts }) {
  return <div className="admin-card"><p className="admin-copy">The MVP intentionally uses a fresh random draw for every departure. There is no formula to tune and no fixed order.</p><div className="ranking-help"><p><b>Admin controls that matter now:</b> keep a destination approved and healthy to let it participate. Flag or retire it to remove it. Use the separate Boost entries tab only when one individual site deserves a light nudge.</p><p><b>Default behavior:</b> every eligible site has the same chance. Boosts are optional, never guaranteed, and do not turn the board into advertising by themselves.</p></div><button className="admin-button approve" onClick={onGoBoosts}>open boost entries →</button></div>;
}

function AdminNav({ tab, setTab, pending }) {
  return <nav className="admin-nav" aria-label="Admin sections">{[["overview", "dashboard"], ["submissions", `submissions ${pending}`], ["destinations", "destination desk"], ["boosts", "boost entries"], ["ranking", "ranking lab"]].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}<Link href="/" className="back-home">← public lounge</Link></nav>;
}

export default function AdminConsoleSimple() {
  const [auth, setAuth] = useState("checking"); const [admin, setAdmin] = useState(null); const [data, setData] = useState(null); const [tab, setTab] = useState("overview"); const [query, setQuery] = useState(""); const [status, setStatus] = useState("");
  const load = async () => { try { const payload = await api("/api/admin/overview"); setData(payload); setAuth("authenticated"); } catch (error) { if (error.message.includes("Sign in")) setAuth("anonymous"); else { setStatus(error.message); setAuth("error"); } } };
  useEffect(() => { api("/api/admin/session").then((payload) => { if (payload.authenticated) { setAdmin(payload.admin); load(); } else setAuth("anonymous"); }).catch(() => setAuth("anonymous")); }, []);
  const filteredDestinations = useMemo(() => (data?.destinations || []).filter((item) => !query || `${item.title} ${item.url} ${item.category?.label}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  if (auth === "checking") return <main className="admin-shell"><p className="admin-loading">checking the manifest…</p></main>;
  if (auth === "error") return <main className="admin-shell admin-login"><div className="admin-login-card admin-error-card"><p className="eyebrow-text">signal interrupted</p><h1>Control room<br /><span>paused.</span></h1><p className="admin-copy">{status || "The control room did not answer."}</p><button type="button" className="primary-action" onClick={() => { setStatus(""); setAuth("checking"); load(); }}>try again →</button><Link className="text-link" href="/">return to the public lounge</Link></div></main>;
  if (auth === "anonymous") return <Login onLoggedIn={(value) => { setAdmin(value); load(); }} />;
  const review = async (id, action, moderationNote) => { try { await api(`/api/admin/submissions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, moderationNote }) }); setStatus(`Submission ${action === "APPROVE" ? "approved" : "rejected"}.`); await load(); } catch (error) { setStatus(error.message); } };
  const saveDestination = async (id, payload) => { await api(`/api/admin/destinations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); await load(); };
  const saveBoost = async (id, value) => { await saveDestination(id, { rankingBoost: value }); setStatus("Boost setting saved."); };
  const logout = async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuth("anonymous"); };
  const title = tab === "overview" ? "Dashboard." : tab === "submissions" ? "Review queue." : tab === "destinations" ? "Destination desk." : tab === "boosts" ? "Boost entries." : "Ranking lab.";
  return <main className="admin-shell"><header className="admin-header"><BrandLink /><div><span className="admin-email">{admin?.email}</span><button className="admin-button" onClick={logout}>leave</button></div></header><div className="admin-layout"><AdminNav tab={tab} setTab={setTab} pending={data.metrics.pending || 0} /><section className="admin-main"><div className="admin-title"><div><p className="eyebrow-text">owner console</p><h1>{title}</h1></div><p className="admin-status" aria-live="polite">{status}</p></div>{tab === "overview" && <><div className="metrics-grid"><Metric label="total portals" value={data.metrics.total} /><Metric label="healthy" value={data.metrics.healthy} accent="green" /><Metric label="pending review" value={data.metrics.pending} accent="coral" /><Metric label="flagged / suspect" value={data.metrics.flagged + data.metrics.suspect} accent="acid" /></div><div className="admin-card"><h2>How to use the room</h2><p>Review submissions, maintain the catalog, and keep the public draw healthy and random. Individual promotion lives in its own tab so ordinary catalog editing stays neutral.</p><div className="quick-links"><button onClick={() => setTab("submissions")}>open review queue →</button><button onClick={() => setTab("boosts")}>open boost entries →</button></div></div></>}{tab === "submissions" && <div className="admin-card">{data.submissions.length ? data.submissions.map((item) => <SubmissionRow key={item.id} item={item} onAction={review} />) : <div className="admin-empty">The queue is clear. A rare, peaceful moment.</div>}</div>}{tab === "destinations" && <div className="admin-card"><input className="input search-input" placeholder="search title, URL, category…" value={query} onChange={(event) => setQuery(event.target.value)} /><p className="admin-label">showing {filteredDestinations.length} of {data.destinations.length} destinations</p><div className="admin-list">{filteredDestinations.map((item) => <DestinationRow key={item.id} item={item} categories={data.categories} onSave={saveDestination} />)}</div></div>}{tab === "boosts" && <div className="admin-card"><p className="admin-copy">Promotion is optional. Normal keeps a site fully random; the other choices only make it somewhat more likely. Use this for a small, disclosed promotion—not guaranteed placement.</p><input className="input search-input" placeholder="search title, URL, category…" value={query} onChange={(event) => setQuery(event.target.value)} /><p className="admin-label">showing {filteredDestinations.length} of {data.destinations.length} destinations</p><div className="admin-list">{filteredDestinations.map((item) => <BoostRow key={item.id} item={item} onSave={saveBoost} />)}</div></div>}{tab === "ranking" && <RankingInfo onGoBoosts={() => setTab("boosts")} />}</section></div></main>;
}
