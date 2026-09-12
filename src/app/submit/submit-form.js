"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";

const initial = { url: "", title: "", description: "", category: "", tags: "", contactEmail: "", isNsfw: false, attestation: false, website: "" };

export default function SubmitForm() {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setState("sending"); setMessage("");
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "The envelope got lost.");
      setState("success"); setMessage("Ticket received. We’ll review it before it joins the board."); setForm(initial);
    } catch (error) { setState("error"); setMessage(error.message); }
  };
  return <main className="info-shell"><nav className="info-nav"><Link className="wordmark" href="/"><span className="wordmark-mark">✦</span> take me<br /><em>somewhere</em></Link><Link className="quiet-button" href="/about">about</Link></nav><section className="content-card submit-card"><p className="eyebrow-text">put a pin on the map</p><h1>List a <span>portal.</span></h1><p className="lead">Know a small, delightful, or gloriously odd website? Send it our way. Listings are free; approval is human.</p><form onSubmit={submit} className="submit-form"><label className="field"><span>Website URL</span><input className="input" name="url" type="url" placeholder="https://..." value={form.url} onChange={update("url")} required /></label><div className="form-grid"><label className="field"><span>Site title</span><input className="input" name="title" maxLength="120" value={form.title} onChange={update("title")} required /></label><label className="field"><span>Category</span><select className="input" name="category" value={form.category} onChange={update("category")} required><option value="">Choose a vibe…</option>{CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label></div><label className="field"><span>Why should someone visit?</span><textarea className="input textarea" name="description" maxLength="600" rows="4" value={form.description} onChange={update("description")} placeholder="The one-sentence reason this place is worth a detour…" required /></label><label className="field"><span>Tags <small>(comma separated)</small></span><input className="input" name="tags" value={form.tags} onChange={update("tags")} placeholder="odd, calming, interactive" /></label><label className="field"><span>Contact email <small>(optional, for review questions)</small></span><input className="input" name="contactEmail" type="email" value={form.contactEmail} onChange={update("contactEmail")} /></label><label className="check-row"><input type="checkbox" checked={form.isNsfw} onChange={update("isNsfw")} /> <span>This site contains mature or sensitive material.</span></label><label className="check-row"><input type="checkbox" checked={form.attestation} onChange={update("attestation")} required /> <span>I own or represent this site, or have permission to recommend it.</span></label><input className="honeypot" tabIndex="-1" autoComplete="off" value={form.website} onChange={update("website")} aria-hidden="true" /><button className="primary-action submit-button" disabled={state === "sending"}>{state === "sending" ? "sending ticket…" : "send for review ↗"}</button><p className={`form-status ${state}`} aria-live="polite">{message}</p></form></section><footer className="info-footer"><Link href="/">← back to the lounge</Link><span>no pay-to-play without a label</span></footer></main>;
}
