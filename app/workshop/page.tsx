"use client";

import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

type Booking = {
  id: string;
  booking_number: string;
  workshop_id: string;
  workshop_name: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  booking_status: string;
  created_at: string;
};

type Technician = {
  id: string;
  technician_name: string;
  status: string;
  workshop_id: string;
  specialization: string | null;
};

type Membership = {
  workshop_id: string;
  role: string;
  is_active: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  workshop_acceptance_pending: "New Booking",
  accepted: "Accepted",
  vehicle_checked_in: "Vehicle Checked In",
  inspection_started: "Inspection",
  approval_required: "Approval Required",
  service_in_progress: "Service In Progress",
  quality_check: "Quality Check",
  ready_for_delivery: "Ready for Delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const ACTIVE_STATUSES = [
  "accepted",
  "vehicle_checked_in",
  "inspection_started",
  "approval_required",
  "service_in_progress",
  "quality_check",
  "ready_for_delivery",
];

export default function WorkshopDashboardPage() {
  const router = useRouter();

  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("workshop_members")
        .select("workshop_id, role, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!member) {
        setMembership(null);
        setBookings([]);
        setTechnicians([]);
        setMessage("This account is not linked to an active workshop yet.");
        return;
      }

      setMembership(member as Membership);

      const [
        { data: bookingData, error: bookingError },
        { data: techData, error: techError },
      ] = await Promise.all([
        supabase
          .from("service_bookings")
          .select(
            "id, booking_number, workshop_id, workshop_name, service_name, booking_date, booking_time, booking_status, created_at"
          )
          .eq("workshop_id", member.workshop_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("service_technicians")
          .select(
            "id, technician_name, status, workshop_id, specialization"
          )
          .eq("workshop_id", member.workshop_id)
          .order("technician_name", { ascending: true }),
      ]);

      if (bookingError) throw bookingError;
      if (techError) throw techError;

      setBookings((bookingData || []) as Booking[]);
      setTechnicians((techData || []) as Technician[]);
    } catch (error) {
      console.error("Workshop dashboard load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load workshop dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();

    const channel = supabase
      .channel("workshop-dashboard-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_bookings",
        },
        () => void loadDashboard(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_technicians",
        },
        () => void loadDashboard(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const stats = useMemo(() => {
    return {
      openBookings: bookings.filter(
        (booking) =>
          booking.booking_status === "workshop_acceptance_pending"
      ).length,
      activeJobs: bookings.filter((booking) =>
        ACTIVE_STATUSES.includes(booking.booking_status)
      ).length,
      completedJobs: bookings.filter(
        (booking) => booking.booking_status === "completed"
      ).length,
      availableTechnicians: technicians.filter(
        (technician) => technician.status === "available"
      ).length,
    };
  }, [bookings, technicians]);

  const activeJobs = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            booking.booking_status === "workshop_acceptance_pending" ||
            ACTIVE_STATUSES.includes(booking.booking_status)
        )
        .slice(0, 6),
    [bookings]
  );

  const recentCompleted = useMemo(
    () =>
      bookings
        .filter((booking) => booking.booking_status === "completed")
        .slice(0, 4),
    [bookings]
  );

  function openBooking(booking: Booking) {
    const status = booking.booking_status;

    if (status === "workshop_acceptance_pending" || status === "accepted") {
      router.push("/workshop/bookings");
      return;
    }

    if (status === "vehicle_checked_in") {
      router.push(
        `/workshop/job-card?bookingId=${encodeURIComponent(booking.id)}`
      );
      return;
    }

    void openJobCardStage(booking);
  }

  async function openJobCardStage(booking: Booking) {
    try {
      const { data: jobCard, error } = await supabase
        .from("service_job_cards")
        .select("id")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (error) throw error;

      if (!jobCard) {
        router.push(
          `/workshop/job-card?bookingId=${encodeURIComponent(booking.id)}`
        );
        return;
      }

      const route =
        booking.booking_status === "inspection_started"
          ? "/workshop/inspection"
          : booking.booking_status === "approval_required"
          ? "/workshop/approval"
          : booking.booking_status === "service_in_progress"
          ? "/workshop/repair"
          : booking.booking_status === "quality_check"
          ? "/workshop/quality-check"
          : booking.booking_status === "ready_for_delivery"
          ? "/workshop/invoice"
          : "/workshop/bookings";

      router.push(`${route}?jobCardId=${encodeURIComponent(jobCard.id)}`);
    } catch (error) {
      console.error("Open job error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to open this workshop job."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
            <p className="mt-4 text-sm font-bold text-slate-400">
              Loading workshop dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-300">
                <Sparkles size={16} />
                <p className="text-xs font-black uppercase tracking-[0.2em]">
                  Workshop Operations
                </p>
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Workshop Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                See what needs attention now and continue every job from one place.
              </p>

              {membership ? (
                <p className="mt-3 text-xs font-bold text-slate-500">
                  Workshop ID: {membership.workshop_id} · Role:{" "}
                  {membership.role.replaceAll("_", " ")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => router.push("/workshop/settings")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]"
              >
                <Settings size={17} />
                Settings
              </button>

              <button
                type="button"
                onClick={() => router.push("/workshop/bookings")}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3 text-sm font-black text-white"
              >
                Open Bookings
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
            {message}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Clock3 size={20} />}
            label="Open Bookings"
            value={stats.openBookings}
            helper="Waiting for workshop action"
          />
          <StatCard
            icon={<Activity size={20} />}
            label="Active Jobs"
            value={stats.activeJobs}
            helper="Currently in service flow"
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Completed Jobs"
            value={stats.completedJobs}
            helper="Successfully closed"
          />
          <StatCard
            icon={<Users size={20} />}
            label="Available Technicians"
            value={stats.availableTechnicians}
            helper={`${technicians.length} technician${
              technicians.length === 1 ? "" : "s"
            } registered`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
                  Active Work
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Jobs Needing Attention
                </h2>
              </div>

              <button
                type="button"
                onClick={() => router.push("/workshop/bookings")}
                className="text-sm font-black text-blue-300 hover:text-blue-200"
              >
                View all bookings
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {activeJobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-8 text-center">
                  <BadgeCheck className="mx-auto text-emerald-300" size={30} />
                  <p className="mt-3 font-black">No active jobs</p>
                  <p className="mt-1 text-sm text-slate-500">
                    New service bookings will appear here automatically.
                  </p>
                </div>
              ) : (
                activeJobs.map((booking) => (
                  <article
                    key={booking.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[11px] font-black text-blue-200">
                            {booking.booking_number}
                          </span>

                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black text-slate-300">
                            {STATUS_LABELS[booking.booking_status] ||
                              booking.booking_status}
                          </span>
                        </div>

                        <h3 className="mt-3 truncate text-base font-black">
                          {booking.service_name}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {booking.booking_date} · {booking.booking_time}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openBooking(booking)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-500"
                      >
                        Continue
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <UserRound size={21} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                    Technician Availability
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {stats.availableTechnicians} Available
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {technicians.length === 0 ? (
                  <p className="text-sm text-emerald-100/60">
                    No technicians registered yet.
                  </p>
                ) : (
                  technicians.slice(0, 5).map((technician) => (
                    <div
                      key={technician.id}
                      className="flex items-center justify-between rounded-xl border border-emerald-400/10 bg-slate-950/20 px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-black">
                          {technician.technician_name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-emerald-100/50">
                          {technician.specialization || "General Service"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                          technician.status === "available"
                            ? "bg-emerald-400/15 text-emerald-200"
                            : "bg-amber-400/15 text-amber-200"
                        }`}
                      >
                        {technician.status}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push("/workshop/team")}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/15"
              >
                View Technician Team
                <ChevronRight size={16} />
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <Wrench className="text-violet-300" size={20} />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Recently Completed
                  </p>
                  <h2 className="mt-1 text-lg font-black">
                    Closed Jobs
                  </h2>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {recentCompleted.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No completed jobs yet.
                  </p>
                ) : (
                  recentCompleted.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-white/10 bg-slate-950/30 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {booking.service_name}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {booking.booking_number}
                          </p>
                        </div>

                        <CheckCircle2
                          size={17}
                          className="shrink-0 text-emerald-300"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
          {icon}
        </div>

        <span className="text-3xl font-black">{value}</span>
      </div>

      <p className="mt-4 text-sm font-black">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}