import { redirect } from "next/navigation";
import StaffActionsBar from "@/components/staff/StaffActionsBar";
import StaffTaskPanel from "@/components/staff/StaffTaskPanel";
import { getStaffSession } from "@/lib/staff-auth/session";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StaffEventPage({ params }: PageProps) {
  const session = await getStaffSession();
  const { id } = await params;

  if (!session) {
    redirect("/staff/login");
  }

  if (session.event.id !== id) {
    redirect(`/staff/event/${session.event.id}`);
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#07111f_0%,#0b1527_50%,#0d1729_100%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-[#0f1728]/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d2b56d]">
            Staff Workspace
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {session.event.name}
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Logged in as {session.employee.name} ·{" "}
            {session.employee.department}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Event Code
              </div>
              <div className="mt-1 text-sm font-medium text-white/90">
                {session.event.code}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Event Date
              </div>
              <div className="mt-1 text-sm font-medium text-white/90">
                {session.event.date}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Department
              </div>
              <div className="mt-1 text-sm font-medium text-white/90">
                {session.employee.department}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                Status
              </div>
              <div className="mt-1 text-sm font-medium text-white/90">
                {session.event.status}
              </div>
            </div>
          </div>
        </div>

        <StaffActionsBar
          eventId={session.event.id}
          department={session.employee.department}
        />

        <StaffTaskPanel />

        <form action="/api/staff-auth/logout" method="post">
          <button
            type="submit"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
