"use client";

import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type Booking = {
  id: string;
  booking_number: string;
  user_id: string;
  workshop_id: string;
  service_name: string;
  workshop_name: string;
  booking_date: string;
  booking_time: string;
  service_mode: "drive-in" | "pickup-drop";
  booking_status: string;
  estimated_cost_text: string | null;
  estimated_duration_text: string | null;
  created_at: string;
};

type FilterKey =
  | "all"
  | "workshop_acceptance_pending"
  | "accepted"
  | "vehicle_checked_in"
  | "inspection_started"
  | "approval_required"
  | "service_in_progress"
  | "quality_check"
  | "ready_for_delivery"
  | "completed";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  workshop_acceptance_pending: "New Booking",
  accepted: "Accepted",
  rejected: "Rejected",
  pickup_scheduled: "Pickup Scheduled",
  vehicle_picked_up: "Vehicle Picked Up",
  vehicle_checked_in: "Vehicle Checked In",
  inspection_started: "Inspection",
  approval_required: "Approval Required",
  service_in_progress: "Service In Progress",
  quality_check: "Quality Check",
  ready_for_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function WorkshopBookingsDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadBookings();

    const channel = supabase
      .channel("workshop-bookings-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_bookings",
        },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadBookings() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setMessage("Please sign in.");
        return;
      }

      const { data, error } = await supabase
        .from("service_bookings")
        .select(
          "id, booking_number, user_id, workshop_id, service_name, workshop_name, booking_date, booking_time, service_mode, booking_status, estimated_cost_text, estimated_duration_text, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBookings((data || []) as Booking[]);
    } catch (error) {
      console.error("Workshop bookings load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load workshop bookings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(
    booking: Booking,
    nextStatus: string,
    note: string
  ) {
    try {
      const { error: updateError } = await supabase
        .from("service_bookings")
        .update({ booking_status: nextStatus })
        .eq("id", booking.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: booking.id,
          user_id: booking.user_id,
          status: nextStatus,
          note,
          changed_by_type: "service_advisor",
        });

      if (historyError) throw historyError;

      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? { ...item, booking_status: nextStatus }
            : item
        )
      );
    } catch (error) {
      console.error("Booking status update error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update booking status."
      );
    }
  }

  const visibleBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesFilter =
        filter === "all" || booking.booking_status === filter;

      const matchesSearch =
        !normalized ||
        booking.booking_number.toLowerCase().includes(normalized) ||
        booking.service_name.toLowerCase().includes(normalized) ||
        booking.workshop_name.toLowerCase().includes(normalized);

      return matchesFilter && matchesSearch;
    });
  }, [bookings, filter, query]);

  const counts = useMemo(() => {
    return {
      total: bookings.length,
      new: bookings.filter(
        (b) => b.booking_status === "workshop_acceptance_pending"
      ).length,
      progress: bookings.filter((b) =>
        [
          "accepted",
          "vehicle_checked_in",
          "inspection_started",
          "service_in_progress",
          "quality_check",
        ].includes(b.booking_status)
      ).length,
      approval: bookings.filter(
        (b) => b.booking_status === "approval_required"
      ).length,
      ready: bookings.filter(
        (b) => b.booking_status === "ready_for_delivery"
      ).length,
    };
  }, [bookings]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Workshop Portal
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Booking Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Review new bookings, accept or reject requests, and move every
                job through the service workflow.
              </p>
            </div>

            <button
              type="button"
              onClick={loadBookings}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]"
            >
              Refresh Bookings
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total" value={counts.total} />
          <StatCard label="New" value={counts.new} />
          <StatCard label="In Progress" value={counts.progress} />
          <StatCard label="Approval Pending" value={counts.approval} />
          <StatCard label="Ready" value={counts.ready} />
        </section>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                Workshop Operations
              </p>
              <h2 className="mt-1 text-xl font-black">
                One queue for the full service lifecycle
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Every booking is tied to the same Digital Job Card and status
                history, keeping the process traceable from booking to delivery.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search booking ID, service or workshop"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600"
              />
            </div>

            <div className="relative">
              <Filter
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as FilterKey)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm font-bold text-white outline-none"
              >
                <option value="all">All Bookings</option>
                <option value="workshop_acceptance_pending">New Bookings</option>
                <option value="accepted">Accepted</option>
                <option value="vehicle_checked_in">Checked In</option>
                <option value="inspection_started">Inspection</option>
                <option value="approval_required">Approval Required</option>
                <option value="service_in_progress">In Progress</option>
                <option value="quality_check">Quality Check</option>
                <option value="ready_for_delivery">Ready for Delivery</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
            <p className="mt-4 text-sm font-bold text-slate-400">
              Loading bookings...
            </p>
          </section>
        ) : message ? (
          <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">
            {message}
          </section>
        ) : visibleBookings.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-slate-500">
            No bookings found.
          </section>
        ) : (
          <section className="space-y-4">
            {visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onUpdateStatus={updateStatus}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function BookingCard({
  booking,
  onUpdateStatus,
}: {
  booking: Booking;
  onUpdateStatus: (
    booking: Booking,
    nextStatus: string,
    note: string
  ) => Promise<void>;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-black text-blue-200">
                {booking.booking_number}
              </span>
              <StatusBadge status={booking.booking_status} />
            </div>

            <h2 className="mt-4 text-xl font-black">
              {booking.service_name}
            </h2>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} />
                {booking.booking_date}
              </span>

              <span className="inline-flex items-center gap-2">
                <Clock3 size={16} />
                {booking.booking_time}
              </span>

              <span className="inline-flex items-center gap-2">
                <Truck size={16} />
                {booking.service_mode === "pickup-drop"
                  ? "Pickup & Drop"
                  : "Drive-in"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 lg:min-w-[250px]">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Workshop
            </p>
            <p className="mt-1 text-sm font-black">
              {booking.workshop_name}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              {booking.estimated_cost_text || "Estimate pending"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniInfo
            icon={<ShieldCheck size={16} />}
            label="Status"
            value={STATUS_LABELS[booking.booking_status] || booking.booking_status}
          />
          <MiniInfo
            icon={<Wrench size={16} />}
            label="Duration"
            value={booking.estimated_duration_text || "To be confirmed"}
          />
          <MiniInfo
            icon={<MapPin size={16} />}
            label="Service Mode"
            value={
              booking.service_mode === "pickup-drop"
                ? "Pickup & Drop"
                : "Drive-in"
            }
          />
          <MiniInfo
            icon={<UserRound size={16} />}
            label="Customer"
            value="Booked User"
          />
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-950/30 p-4">
        <BookingActions
          booking={booking}
          onUpdateStatus={onUpdateStatus}
        />
      </div>
    </article>
  );
}

function BookingActions({
  booking,
  onUpdateStatus,
}: {
  booking: Booking;
  onUpdateStatus: (
    booking: Booking,
    nextStatus: string,
    note: string
  ) => Promise<void>;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  async function openJobCardStage(route: string) {
    if (opening) return;

    setOpening(true);

    try {
      const { data: jobCard, error } = await supabase
        .from("service_job_cards")
        .select("id")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (error) throw error;

      if (!jobCard) {
        window.alert(
          "Digital Job Card has not been created for this booking yet. Create the Job Card first."
        );

        router.push(
          `/workshop/job-card?bookingId=${encodeURIComponent(booking.id)}`
        );
        return;
      }

      router.push(
        `${route}?jobCardId=${encodeURIComponent(jobCard.id)}`
      );
    } catch (error) {
      console.error("Open workshop stage error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to open the next workshop stage."
      );
    } finally {
      setOpening(false);
    }
  }

  if (booking.booking_status === "workshop_acceptance_pending") {
    return (
      <PendingBookingActions
        booking={booking}
        onUpdateStatus={onUpdateStatus}
      />
    );
  }

  if (booking.booking_status === "accepted") {
    return (
      <NextButton
        label="Vehicle Check-In"
        onClick={() =>
          onUpdateStatus(
            booking,
            "vehicle_checked_in",
            "Vehicle checked in at workshop"
          )
        }
      />
    );
  }

  if (booking.booking_status === "vehicle_checked_in") {
    return (
      <NextButton
        label="Create / Open Digital Job Card"
        onClick={() =>
          router.push(
            `/workshop/job-card?bookingId=${encodeURIComponent(booking.id)}`
          )
        }
      />
    );
  }

  if (booking.booking_status === "inspection_started") {
    return (
      <NextButton
        label={opening ? "Opening..." : "Open Inspection"}
        onClick={() => openJobCardStage("/workshop/inspection")}
        disabled={opening}
      />
    );
  }

  if (booking.booking_status === "approval_required") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <NextButton
          label={opening ? "Opening..." : "Open Customer Approval"}
          onClick={() => openJobCardStage("/workshop/approval")}
          disabled={opening}
        />

        <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs font-black text-amber-200">
          <Clock3 size={16} />
          Waiting for Customer Approval
        </span>

        <span className="text-xs font-bold text-slate-500">
          The booking updates automatically after the customer submits the
          approval decision.
        </span>
      </div>
    );
  }

  if (booking.booking_status === "service_in_progress") {
    return (
      <NextButton
        label={opening ? "Opening..." : "Open Service Work"}
        onClick={() => openJobCardStage("/workshop/repair")}
        disabled={opening}
      />
    );
  }

  if (booking.booking_status === "quality_check") {
    return (
      <NextButton
        label={opening ? "Opening..." : "Open Quality Check"}
        onClick={() => openJobCardStage("/workshop/quality-check")}
        disabled={opening}
      />
    );
  }

  if (booking.booking_status === "ready_for_delivery") {
    return (
      <NextButton
        label={opening ? "Opening..." : "Open Invoice & Payment"}
        onClick={() => openJobCardStage("/workshop/invoice")}
        disabled={opening}
      />
    );
  }

  return (
    <span className="text-xs font-bold text-slate-500">
      {STATUS_LABELS[booking.booking_status] || booking.booking_status}
    </span>
  );
}


function PendingBookingActions({
  booking,
  onUpdateStatus,
}: {
  booking: Booking;
  onUpdateStatus: (
    booking: Booking,
    nextStatus: string,
    note: string
  ) => Promise<void>;
}) {
  const [checking, setChecking] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [technicianCount, setTechnicianCount] = useState(0);
  const [capacityMessage, setCapacityMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkTechnicianCapacity() {
      setChecking(true);
      setCapacityMessage("");

      try {
        if (!booking.workshop_id) {
          throw new Error("Workshop ID is missing for this booking.");
        }

        // A booking can only be accepted when this workshop has at least
        // one technician who is actually AVAILABLE for work.
        const { count, error } = await supabase
          .from("service_technicians")
          .select("id", { count: "exact", head: true })
          .eq("workshop_id", booking.workshop_id)
          .eq("status", "available");

        if (error) throw error;
        if (cancelled) return;

        const available = count ?? 0;
        setTechnicianCount(available);

        if (available === 0) {
          setCapacityMessage(
            "No technician is currently available for this workshop. Wait for a technician to become available before accepting this booking."
          );
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Technician capacity check error:", error);
        setTechnicianCount(0);
        setCapacityMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify technician availability."
        );
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkTechnicianCapacity();

    return () => {
      cancelled = true;
    };
  }, [booking.id, booking.workshop_id]);

  async function acceptBooking() {
    if (checking || accepting) return;

    setAccepting(true);

    try {
      // Re-check immediately before acceptance so a stale UI cannot bypass
      // the technician availability rule.
      const { count, error } = await supabase
        .from("service_technicians")
        .select("id", { count: "exact", head: true })
        .eq("workshop_id", booking.workshop_id)
        .eq("status", "available");

      if (error) throw error;

      if ((count ?? 0) < 1) {
        setTechnicianCount(0);
        setCapacityMessage(
          "Booking cannot be accepted because no technician is currently available for this workshop."
        );
        window.alert(
          "No technician is available right now. Please wait until a technician becomes available."
        );
        return;
      }

      setTechnicianCount(count ?? 0);
      setCapacityMessage("");

      await onUpdateStatus(
        booking,
        "accepted",
        "Workshop accepted the service booking after confirming an available technician"
      );
    } catch (error) {
      console.error("Accept booking capacity check error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to verify technician availability."
      );
    } finally {
      setAccepting(false);
    }
  }

  const canAccept = !checking && !accepting && technicianCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canAccept}
          onClick={acceptBooking}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <CheckCircle2 size={16} />
          {checking
            ? "Checking Technicians..."
            : accepting
              ? "Accepting..."
              : "Accept Booking"}
        </button>

        <button
          type="button"
          disabled={accepting}
          onClick={() =>
            onUpdateStatus(
              booking,
              "rejected",
              "Workshop rejected the service booking"
            )
          }
          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs font-black text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle size={16} />
          Reject
        </button>
      </div>

      {!checking && technicianCount > 0 ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
          <BadgeCheck size={15} />
          {technicianCount} available technician
          {technicianCount === 1 ? "" : "s"} available
        </div>
      ) : null}

      {!checking && capacityMessage ? (
        <div className="max-w-2xl rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs font-bold leading-5 text-amber-200">
          {capacityMessage}
        </div>
      ) : null}
    </div>
  );
}

function NextButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
      <ChevronRight size={15} />
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-300">
      <BadgeCheck size={14} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}