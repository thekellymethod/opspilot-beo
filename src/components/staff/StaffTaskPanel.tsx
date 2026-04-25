"use client";

import { useEffect, useState } from "react";

type StaffTask = {
  id: string;
  eventId: string;
  department: string;
  title: string;
  description: string;
  status: "pending" | "acknowledged" | "completed" | "failed";
  assignedToEmployeeId: string | null;
  completedAt: string | null;
  completedByEmployeeId: string | null;
};

type TasksResponse = {
  ok: boolean;
  tasks?: StaffTask[];
  error?: string;
};

type CompleteTaskResponse = {
  ok: boolean;
  error?: string;
  task?: StaffTask;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function StaffTaskPanel() {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/staff/tasks", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json()) as TasksResponse;

      if (!res.ok || !data.ok || !data.tasks) {
        setError(data.error ?? "Unable to load tasks.");
        return;
      }

      setTasks(data.tasks);
    } catch {
      setError("Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  async function completeTask(taskId: string) {
    setBusyTaskId(taskId);
    setError("");

    try {
      const res = await fetch(`/api/staff/tasks/${taskId}/complete`, {
        method: "POST",
      });

      const data = (await res.json()) as CompleteTaskResponse;

      const updatedTask = data.task;
      if (!res.ok || !data.ok || !updatedTask) {
        setError(data.error ?? "Unable to complete task.");
        return;
      }

      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? updatedTask : task)),
      );
    } catch {
      setError("Unable to complete task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#0f1728]/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d2b56d]">
            Department Tasks
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Shift Task List
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void loadTasks()}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/50">
          No active tasks for this department.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const completed = task.status === "completed";

            return (
              <div
                key={task.id}
                className={cn(
                  "rounded-2xl border px-4 py-4",
                  completed
                    ? "border-emerald-500/25 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white">
                      {task.title}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/65">
                      {task.description}
                    </p>

                    <div className="mt-3 text-xs text-white/45">
                      Status: {task.status}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={completed || busyTaskId === task.id}
                    onClick={() => void completeTask(task.id)}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-2 text-sm transition",
                      completed || busyTaskId === task.id
                        ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                        : "border-[#cba754]/30 bg-[#cba754]/12 text-[#f0dfb0] hover:bg-[#cba754]/18",
                    )}
                  >
                    {completed
                      ? "Completed"
                      : busyTaskId === task.id
                        ? "Saving..."
                        : "Mark Complete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
