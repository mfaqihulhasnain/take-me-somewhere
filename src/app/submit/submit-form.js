"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLink } from "@/app/brand";
import { CATEGORIES } from "@/lib/constants";

const initial = { url: "", title: "", description: "", category: "", tags: "", contactEmail: "", isNsfw: false, attestation: false, website: "" };

export default function SubmitForm() {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const update = (key) => (event) => {
    const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
    setForm((current) => ({ ...current, [key]: value }));
    if (state !== "idle") { setState("idle"); setMessage(""); }
  };
  const submit = async (event) => {
    event.preventDefault(); setState("sending"); setMessage("");
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "The envelope got lost.");
      setState("success"); setMessage("Ticket received. We’ll review it before it joins the board."); setForm(initial);
    } catch (error) { setState("error"); setMessage(error.message); }
  };
  return (
    <main id="main-content" tabIndex="-1" className="info-shell">
      <nav className="info-nav" aria-label="Submission page navigation">
        <BrandLink />
        <Link className="quiet-button nav-link" href="/about">about</Link>
      </nav>
      <section className="content-card submit-card" aria-labelledby="submit-title">
        <p className="eyebrow-text">put a pin on the map</p>
        <h1 id="submit-title">List a <span>portal.</span></h1>
        <p className="lead" id="submit-intro">Know a small, delightful, or gloriously odd website? Send it our way. Submissions are free and every approval is human.</p>
        <form onSubmit={submit} className="submit-form" aria-describedby="submit-intro" aria-busy={state === "sending"}>
          <label className="field"><span>Website URL <small>required · HTTPS only</small></span><input className="input" name="url" type="url" inputMode="url" autoComplete="url" spellCheck="false" placeholder="https://example.com" value={form.url} onInput={update("url")} required /></label>
          <div className="form-grid">
            <label className="field"><span>Site title <small>required</small></span><input className="input" name="title" maxLength="120" value={form.title} onInput={update("title")} required /></label>
            <label className="field"><span>Category <small>required</small></span><select className="input" name="category" value={form.category} onChange={update("category")} required><option value="">Choose a vibe…</option>{CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
          </div>
          <label className="field"><span>Why should someone visit? <small>{form.description.length}/600</small></span><textarea className="input textarea" name="description" maxLength="600" rows="4" value={form.description} onInput={update("description")} placeholder="The one-sentence reason this place is worth a detour…" required /></label>
          <label className="field"><span>Tags <small>optional, comma separated</small></span><input className="input" name="tags" maxLength="300" value={form.tags} onInput={update("tags")} placeholder="odd, calming, interactive" /></label>
          <label className="field"><span>Contact email <small>optional, for review questions</small></span><input className="input" name="contactEmail" type="email" inputMode="email" autoComplete="email" value={form.contactEmail} onInput={update("contactEmail")} /></label>
          <label className="check-row"><input type="checkbox" checked={form.isNsfw} onChange={update("isNsfw")} /> <span>This site contains mature or sensitive material.</span></label>
          <label className="check-row"><input type="checkbox" checked={form.attestation} onChange={update("attestation")} required /> <span>I own or represent this site, or have permission to recommend it.</span></label>
          <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" value={form.website} onInput={update("website")} aria-hidden="true" />
          <button type="submit" className="primary-action submit-button" disabled={state === "sending"}>{state === "sending" ? "sending ticket…" : "send for review ↗"}</button>
          <div className={`form-status ${state}`} role={state === "error" ? "alert" : "status"} aria-live="polite">{message}{state === "success" && <Link href="/">Take a random trip while you wait →</Link>}</div>
        </form>
      </section>
      <footer className="info-footer"><Link href="/">← back to the lounge</Link><span>every submission is reviewed</span></footer>
    </main>
  );
}
