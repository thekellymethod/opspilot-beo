"use client";

import { promoteEventVersionAction } from "@/app/actions/promoteEventVersion";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ApprovePromoteButtonProps = {
  eventId: string;
  versionId: string;
  disabled?: boolean;
};

export default function ApprovePromoteButton({
  eventId,
  versionId,
  disabled,
}: ApprovePromoteButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run() {
    setError("");
    startTransition(() => {
      void (async () => {
        const res = await promoteEventVersionAction(eventId, versionId);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/dashboard/events/${eventId}/command`);
        router.refresh();
      })();
    });
  }

  return (
    <div className="w-full max-w-2xl space-y-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={run}
        className="w-full rounded-2xl border border-emerald-400/50 bg-emerald-500/20 px-6 py-4 text-center text-base font-semibold tracking-wide text-emerald-50 shadow-[0_0_32px_-8px_rgba(16,185,129,0.45)] transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {pending ? "Promoting…" : "Approve and Promote"}
      </button>
      {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
