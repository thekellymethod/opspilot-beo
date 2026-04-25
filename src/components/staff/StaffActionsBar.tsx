"use client";

import { useState } from "react";

type StaffActionsBarProps = {
  eventId: string;
  department: string;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function StaffActionsBar({
  eventId,
  department,
}: StaffActionsBarProps) {
  const [busy, setBusy] = useState<"ack" | "checkin" | "checkout" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Request failed.");
    }

    return data;
  }

  async function handleAcknowledge() {
    setBusy("ack");
    setMessage("");
    setError("");

    try {
      await postJson("/api/staff/acknowledge", {
        eventId,
        department,
      });
      setMessage("Briefing acknowledged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to acknowledge.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShift(eventType: "checkin" | "checkout") {
    setBusy(eventType);
    setMessage("");
    setError("");

    try {
      await postJson("/api/staff/shift", {
        eventType,
      });
      setMessage(eventType === "checkin" ? "Checked in." : "Checked out.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update shift state.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#0f1728]/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d2b56d]">
          Staff Actions
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
          Event Controls
        </h2>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleShift("checkin")}
          disabled={busy !== null}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm transition",
            busy !== null
              ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
              : "border-blue-500/25 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15",
          )}
        >
          {busy === "checkin" ? "Saving..." : "Check In"}
        </button>

        <button
          type="button"
          onClick={() => void handleAcknowledge()}
          disabled={busy !== null}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm transition",
            busy !== null
              ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
              : "border-[#cba754]/30 bg-[#cba754]/12 text-[#f0dfb0] hover:bg-[#cba754]/18",
          )}
        >
          {busy === "ack" ? "Saving..." : "Acknowledge Briefing"}
        </button>

        <button
          type="button"
          onClick={() => void handleShift("checkout")}
          disabled={busy !== null}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm transition",
            busy !== null
              ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
              : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]",
          )}
        >
          {busy === "checkout" ? "Saving..." : "Check Out"}
        </button>
      </div>
    </div>
  );
}
