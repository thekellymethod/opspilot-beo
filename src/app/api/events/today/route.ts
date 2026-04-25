import { NextResponse } from "next/server";
import { getLatestVersion, listAlerts, listEventsForDate, listEventTasks } from "@/lib/store";

export async function GET(request: Request) {
  const dateParam = new URL(request.url).searchParams.get("date");
  const date = dateParam ?? new Date().toISOString().slice(0, 10);
  const events = await listEventsForDate(date);
  const withSummary = await Promise.all(
    events.map(async (event) => {
      const [latest, alerts, tasks] = await Promise.all([
        getLatestVersion(event.id),
        listAlerts(event.id),
        listEventTasks(event.id),
      ]);
      return {
        ...event,
        parsed: latest?.parsed_json ?? null,
        alertCount: alerts.filter((item) => !item.resolved).length,
        readiness: {
          staffing: latest?.parsed_json.staffing.servers_required
            ? "ready"
            : "check",
          kitchen: tasks.some((task) => task.department === "kitchen") ? "ready" : "check",
          setup: tasks.some((task) => task.department === "banquets") ? "ready" : "check",
        },
      };
    }),
  );
  return NextResponse.json({ events: withSummary, date });
}
