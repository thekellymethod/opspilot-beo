"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LoginResponse = {
  ok: boolean;
  error?: string;
  staffSession?: {
    event: {
      id: string;
    };
  };
};

export default function StaffLoginPage() {
  const router = useRouter();

  const [employeeCode, setEmployeeCode] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/staff-auth/code-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeCode,
          eventCode,
          deviceLabel: "web",
        }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok || !data.ok || !data.staffSession) {
        setError(data.error ?? "Login failed.");
        return;
      }

      router.push(`/staff/event/${data.staffSession.event.id}`);
      router.refresh();
    } catch {
      setError("Unable to log in right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#07111f_0%,#0b1527_50%,#0d1729_100%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-[28px] border border-white/10 bg-[#0f1728]/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="mb-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d2b56d]">
              Staff Event Access
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Enter Event
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Use your employee code and the current event code to access your
              shift workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="employeeCode"
                className="mb-2 block text-sm font-medium text-white/85"
              >
                Employee Code
              </label>
              <input
                id="employeeCode"
                type="text"
                autoCapitalize="characters"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#cba754]/40"
                placeholder="K4821"
                required
              />
            </div>

            <div>
              <label
                htmlFor="eventCode"
                className="mb-2 block text-sm font-medium text-white/85"
              >
                Event Code
              </label>
              <input
                id="eventCode"
                type="text"
                autoCapitalize="characters"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#cba754]/40"
                placeholder="WED512"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-[#cba754]/30 bg-[#cba754]/12 px-4 py-3 text-sm font-medium text-[#f0dfb0] transition hover:bg-[#cba754]/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Entering..." : "Enter Event"}
            </button>
          </form>

          <div className="mt-5 text-xs text-white/45">
            Need help? Ask your manager for the current event code.
          </div>
        </div>
      </div>
    </div>
  );
}
