"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type Booking = {
  id: string;
  booking_number: string;
  service_name: string;
  workshop_name: string;
  booking_date: string;
  booking_time: string;
  service_mode: "drive-in" | "pickup-drop";
  estimated_cost_text: string | null;
  estimated_duration_text: string | null;
  booking_status: string;
  created_at: string;
};

type StatusHistory = {
  id: string;
  status: string;
  note: string | null;
  changed_by_type: string;
  created_at: string;
};

const STATUS_ORDER = [
  "workshop_acceptance_pending",
  "accepted",
  "pickup_scheduled",
  "vehicle_picked_up",
  "vehicle_checked_in",
  "inspection_started",
  "approval_required",
  "service_in_progress",
  "quality_check",
  "ready_for_delivery",
  "out_for_delivery",
  "completed",
];

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Booking Confirmed",
  workshop_acceptance_pending: "Workshop Acceptance Pending",
  accepted: "Workshop Accepted",
  rejected: "Workshop Rejected",
  pickup_scheduled: "Pickup Scheduled",
  vehicle_picked_up: "Vehicle Picked Up",
  vehicle_checked_in: "Vehicle Checked In",
  inspection_started: "Inspection Started",
  approval_required: "Approval Required",
  service_in_progress: "Service In Progress",
  quality_check: "Quality Check",
  ready_for_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  completed: "Service Completed",
  cancelled: "Booking Cancelled",
};

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TrackServicePage() {
  const searchParams = useSearchParams();
  const bookingRef = searchParams.get("bookingId") || "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadBooking = useCallback(async () => {
    if (!bookingRef) {
      setMessage("Booking ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setMessage("Please sign in to track this service booking.");
        return;
      }

      const isDatabaseId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          bookingRef
        );

      let bookingQuery = supabase
        .from("service_bookings")
        .select(
          "id, booking_number, service_name, workshop_name, booking_date, booking_time, service_mode, estimated_cost_text, estimated_duration_text, booking_status, created_at"
        )
        .eq("user_id", user.id);

      bookingQuery = isDatabaseId
        ? bookingQuery.eq("id", bookingRef)
        : bookingQuery.eq("booking_number", bookingRef);

      const { data: bookingData, error: bookingError } =
        await bookingQuery.single();

      if (bookingError) throw bookingError;

      setBooking(bookingData as Booking);

      const { data: historyData, error: historyError } = await supabase
        .from("service_booking_status_history")
        .select("id, status, note, changed_by_type, created_at")
        .eq("booking_id", bookingData.id)
        .order("created_at", { ascending: true });

      if (historyError) throw historyError;

      setHistory((historyData || []) as StatusHistory[]);
    } catch (error) {
      console.error("Track booking error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the service booking."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingRef]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  useEffect(() => {
    if (!booking?.id) return;

    const channel = supabase
      .channel(`service-booking-live-${booking.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "service_bookings",
          filter: `id=eq.${booking.id}`,
        },
        () => {
          void loadBooking();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "service_booking_status_history",
          filter: `booking_id=eq.${booking.id}`,
        },
        () => {
          void loadBooking();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [booking?.id, loadBooking]);

  const currentIndex = useMemo(() => {
    if (!booking) return -1;

    return STATUS_ORDER.indexOf(booking.booking_status);
  }, [booking]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Service Tracking
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Live Service Status
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Follow the complete service journey from workshop acceptance to
                final delivery.
              </p>
            </div>

            {booking ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Booking ID
                </p>
                <p className="mt-1 text-lg font-black">{booking.booking_number}</p>
              </div>
            ) : null}
          </div>
        </header>

        {loading ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
            <p className="mt-4 text-sm font-bold text-slate-400">
              Loading service status...
            </p>
          </section>
        ) : message ? (
          <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6 text-amber-100 shadow-xl">
            <p className="font-black">Unable to load booking</p>
            <p className="mt-2 text-sm">{message}</p>
          </section>
        ) : booking ? (
          <>
            <section className="grid gap-5 lg:grid-cols-2">
              <SummaryCard
                icon={<Wrench size={20} />}
                label="Service"
                value={booking.service_name}
              />

              <SummaryCard
                icon={<MapPin size={20} />}
                label="Workshop"
                value={booking.workshop_name}
              />

              <SummaryCard
                icon={<Clock3 size={20} />}
                label="Appointment"
                value={`${formatDate(booking.booking_date)} • ${
                  booking.booking_time
                }`}
              />

              <SummaryCard
                icon={<Truck size={20} />}
                label="Service Mode"
                value={
                  booking.service_mode === "pickup-drop"
                    ? "Pickup & Drop"
                    : "Drive-in"
                }
              />
            </section>

            <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <Sparkles size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                    Current Status
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    {STATUS_LABELS[booking.booking_status] ||
                      booking.booking_status}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Updates here come from the Service Booking status history in
                    Supabase.
                  </p>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Live updates connected
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Live Timeline
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Service Progress
              </h2>

              <div className="mt-6 space-y-1">
                {STATUS_ORDER.map((status, index) => {
                  const isCompleted =
                    currentIndex >= 0 && index < currentIndex;
                  const isCurrent =
                    booking.booking_status === status;

                  const historyEntry = history.find(
                    (item) => item.status === status
                  );

                  return (
                    <div key={status} className="relative flex gap-4">
                      <div className="flex w-8 shrink-0 flex-col items-center">
                        <div
                          className={`grid h-8 w-8 place-items-center rounded-full border ${
                            isCompleted
                              ? "border-emerald-400/30 bg-emerald-500 text-white"
                              : isCurrent
                              ? "border-blue-400/40 bg-blue-500/20 text-blue-200"
                              : "border-white/10 bg-slate-950/60 text-slate-600"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={17} />
                          ) : isCurrent ? (
                            <Clock3 size={15} />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-current" />
                          )}
                        </div>

                        {index < STATUS_ORDER.length - 1 ? (
                          <div className="min-h-12 w-px flex-1 bg-white/10" />
                        ) : null}
                      </div>

                      <div className="pb-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm font-black ${
                              isCompleted
                                ? "text-emerald-200"
                                : isCurrent
                                ? "text-blue-200"
                                : "text-slate-500"
                            }`}
                          >
                            {STATUS_LABELS[status] || status}
                          </h3>

                          {isCurrent ? (
                            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-200">
                              Current
                            </span>
                          ) : null}
                        </div>

                        {historyEntry ? (
                          <>
                            <p className="mt-1 text-sm leading-6 text-slate-400">
                              {historyEntry.note || "Status updated"}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {formatDateTime(historyEntry.created_at)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-sm text-slate-600">
                            Waiting for update
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <InfoPanel
                title="Estimated Cost"
                value={booking.estimated_cost_text || "To be confirmed"}
              />

              <InfoPanel
                title="Estimated Duration"
                value={booking.estimated_duration_text || "To be confirmed"}
              />
            </section>

            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-300">
                  <ShieldCheck size={21} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
                    Approval Control
                  </p>
                  <h2 className="mt-1 text-lg font-black">
                    No additional work without your approval
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-amber-100/70">
                    When an approval is required, the workshop must share the
                    additional work and estimate before proceeding.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <ActionCard
                icon={<Phone size={20} />}
                title="Call Workshop"
                helper="Workshop contact"
              />

              <ActionCard
                icon={<MessageCircle size={20} />}
                title="Message"
                helper="Booking communication"
              />

              <ActionCard
                icon={<Receipt size={20} />}
                title="Documents"
                helper="Job Card & invoice"
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Latest Database Update
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {STATUS_LABELS[booking.booking_status] ||
                      booking.booking_status}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadBooking()}
                  className="rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3.5 text-sm font-black text-white"
                >
                  Refresh Status
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
          {icon}
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-lg font-black text-white">{value}</p>
        </div>
      </div>
    </article>
  );
}

function InfoPanel({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  helper,
}: {
  icon: React.ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <button
      type="button"
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-xl transition hover:bg-white/[0.06]"
    >
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
        {icon}
      </div>

      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </button>
  );
}