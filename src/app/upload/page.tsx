"use client";

import Link from "next/link";
import { useState } from "react";

type UploadResponse = {
  sourceId?: string;
  status?: "approved" | "review_required" | "failed";
  /** Pipeline or PDF error when status is failed, or route-level failure. */
  error?: string;
  event?: { id: string; event_name?: string };
  version?: { id: string; version_number?: number };
  validation?: unknown;
  normalized?: unknown;
  details?: string;
};

export default function UploadPage() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "promoting">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const canSubmit = Boolean(file || text.trim()) && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !text.trim()) {
      setFormError("Upload a PDF or paste BEO text before running the pipeline.");
      return;
    }

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (text.trim()) formData.append("text", text.trim());

    setLoading(true);
    setPhase("uploading");
    setFormError(null);
    setResult(null);

    try {
      const response = await fetch("/api/beo/upload", { method: "POST", body: formData });
      setPhase("processing");

      const json = (await response.json().catch(() => ({}))) as UploadResponse;
      if (!response.ok) {
        setFormError(json.error ?? `Upload failed (${response.status}).`);
        setResult({ ...json, status: "failed" });
        return;
      }

      setResult(json);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Network error while uploading.");
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  }

  async function promoteHumanApproved() {
    if (!result?.sourceId) return;
    setLoading(true);
    setPhase("promoting");
    setFormError(null);

    try {
      const response = await fetch(`/api/beo/sources/${result.sourceId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApproved: true }),
      });
      const json = (await response.json().catch(() => ({}))) as UploadResponse;

      if (!response.ok) {
        const friendly =
          json.error === "BEO source not found."
            ? "This intake session expired after a reload/restart. Please upload the file again."
            : (json.error ?? `Promote failed (${response.status}).`);
        setFormError(friendly);
        setResult((prev) => ({ ...prev, ...json, status: "failed", sourceId: prev?.sourceId }));
        return;
      }

      setResult((prev) => ({ ...prev, ...json, sourceId: prev?.sourceId }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Network error while promoting.");
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-brand-gold">Pipeline</p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-brand-champagne">BEO intake</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
          Live events update on auto-approve or promotion after review.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-brand-border/90 bg-brand-surface/50 p-6 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8"
      >
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-brand-gold-dim">BEO PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-xl border border-white/12 bg-brand-night/60 px-4 py-3 text-sm text-brand-champagne file:mr-4 file:rounded-lg file:border-0 file:bg-brand-gold/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-gold-bright"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-brand-gold-dim">
            Or paste email / BEO text
          </label>
          <textarea
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-xl border border-white/12 bg-brand-night/50 p-4 text-sm text-brand-champagne placeholder:text-brand-muted/60 focus:border-brand-gold/40 focus:outline-none focus:ring-1 focus:ring-brand-gold/30"
            placeholder="Paste BEO text here…"
          />
        </div>
        {file && text.trim() ? (
          <p className="text-xs text-brand-muted">
            PDF and pasted text are both attached to this submission.
          </p>
        ) : null}
        <button
          disabled={!canSubmit}
          type="submit"
          title={!file && !text.trim() ? "Upload a PDF or paste BEO text first." : undefined}
          className="rounded-xl border border-brand-gold/45 bg-brand-gold/20 px-6 py-2.5 text-sm font-semibold text-brand-champagne shadow-[0_0_28px_-8px_rgba(201,168,76,0.35)] transition hover:bg-brand-gold/30 disabled:opacity-50"
        >
          {loading ? (phase === "uploading" ? "Uploading…" : phase === "promoting" ? "Promoting…" : "Processing…") : "Run pipeline"}
        </button>
        <p aria-live="polite" className="text-xs text-brand-muted">
          {formError
            ? formError
            : loading
              ? phase === "uploading"
                ? "Uploading source…"
                : phase === "promoting"
                  ? "Promoting reviewed source…"
                  : "Running extraction, normalization, and validation…"
              : "Upload a PDF or paste text to run the intake pipeline."}
        </p>
      </form>

      {result && (
        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/55 p-6 sm:p-8">
          {result.error && result.status !== "failed" ? (
            <p className="text-red-300">
              {result.error} {result.details ? `— ${result.details}` : ""}
            </p>
          ) : result.status === "failed" ? (
            <div className="space-y-2">
              <p className="font-medium text-red-300">Pipeline failed</p>
              {result.error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-100/95">{result.error}</p>
              ) : null}
              <p className="text-xs text-brand-muted">Source id: {result.sourceId}</p>
            </div>
          ) : result.status === "review_required" ? (
            <>
              <p className="font-display text-lg font-semibold text-brand-gold-bright">Human review required</p>
              <p className="mt-1 text-xs text-brand-muted">Source id: {result.sourceId}</p>
              {result.event?.id ? (
                <p className="mt-1 text-xs text-emerald-300/90">
                  Saved as draft reference on event <span className="text-brand-champagne">{result.event.id}</span>
                  {result.version?.version_number ? ` (v${result.version.version_number})` : ""}.
                </p>
              ) : null}
              <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-white/10 bg-brand-night/70 p-4 text-xs text-brand-champagne/90">
                {JSON.stringify({ validation: result.validation, normalized: result.normalized }, null, 2)}
              </pre>
              <p className="mt-3 text-xs text-brand-muted">
                This version is saved for reference. If approval is still needed, use the action below.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={promoteHumanApproved}
                className="mt-4 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-2 text-sm font-medium text-brand-gold-bright transition hover:bg-brand-gold/20 disabled:opacity-50"
              >
                Approve and promote
              </button>
              <div className="mt-4 flex flex-wrap gap-3">
                {result.event?.id ? (
                  <Link
                    href={`/events/${result.event.id}`}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-brand-champagne transition hover:border-brand-border hover:bg-white/5"
                  >
                    Open saved draft event
                  </Link>
                ) : null}
                <Link
                  href="/dashboard/events"
                  className="rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-gold-bright transition hover:bg-white/5"
                >
                  Go to Events overview
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-emerald-300/95">Auto-approved — promoted to live event.</p>
              <p className="mt-1 text-xs text-brand-muted">Source id: {result.sourceId}</p>
              <pre className="mt-4 max-h-48 overflow-auto rounded-xl border border-white/10 bg-brand-night/70 p-4 text-xs text-brand-champagne/90">
                {JSON.stringify({ event: result.event, version: result.version }, null, 2)}
              </pre>
              {result.event?.id && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/events/${result.event.id}`}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-brand-champagne transition hover:border-brand-border hover:bg-white/5"
                  >
                    Open event
                  </Link>
                  <Link
                    href={`/events/${result.event.id}/briefing`}
                    className="rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-4 py-2 text-sm font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25"
                  >
                    View briefing
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
