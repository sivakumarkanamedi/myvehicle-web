"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
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

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current?: boolean;
};

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams();

  const bookingId =
    searchParams.get("bookingId") || "MV-BOOKING";
  const bookingDbId =
    searchParams.get("bookingDbId") || "";
  const vehicleId =
    searchParams.get("vehicleId") || "";
  const selectedServiceName =
    searchParams.get("serviceName") || "Selected Service";
  const selectedWorkshopName =
    searchParams.get("workshopName") || "Selected Workshop";
  const selectedDate =
    searchParams.get("date") || "Selected Date";
  const selectedTime =
    searchParams.get("time") || "Selected Time";
  const serviceMode =
    searchParams.get("mode") === "pickup-drop"
      ? "Pickup & Drop"
      : "Drive-in";
  const estimatedCost =
    searchParams.get("estimatedCost") || "To be confirmed";
  const estimatedDuration =
    searchParams.get("estimatedDuration") ||
    "To be confirmed";

  const timeline: TimelineItem[] = [
    {
      id: "confirmed",
      title: "Booking Confirmed",
      description:
        "Your service booking has been created successfully.",
      completed: true,
    },
    {
      id: "accepted",
      title: "Workshop Acceptance",
      description:
        "The workshop will confirm the booking and prepare for your visit.",
      completed: false,
      current: true,
    },
    {
      id: "handover",
      title:
        serviceMode === "Pickup & Drop"
          ? "Pickup Scheduled"
          : "Vehicle Check-In",
      description:
        serviceMode === "Pickup & Drop"
          ? "Pickup details will appear here once assigned."
          : "Check-in details will appear when the vehicle reaches the workshop.",
      completed: false,
    },
    {
      id: "inspection",
      title: "Inspection Started",
      description:
        "The technician will inspect the vehicle and update the Digital Job Card.",
      completed: false,
    },
    {
      id: "approval",
      title: "Approval Required",
      description:
        "Any additional repair or cost will require your approval before work begins.",
      completed: false,
    },
    {
      id: "service",
      title: "Service In Progress",
      description:
        "Approved work will be carried out and progress updated here.",
      completed: false,
    },
    {
      id: "quality",
      title: "Quality Check",
      description:
        "The workshop performs final inspection before delivery.",
      completed: false,
    },
    {
      id: "delivery",
      title: "Ready for Delivery",
      description:
        "Invoice and delivery details will appear when the vehicle is ready.",
      completed: false,
    },
    {
      id: "completed",
      title: "Service Completed",
      description:
        "Job Card, invoice and service report are saved to vehicle history.",
      completed: false,
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                <CheckCircle2 size={16} />
                Step 7 of 7
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Booking Confirmed
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Your service booking has been created. Track every important
                stage from workshop acceptance through service completion.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Booking ID
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {bookingId}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2">
          <SummaryCard
            icon={<Wrench size={20} />}
            label="Service"
            value={selectedServiceName}
          />
          <SummaryCard
            icon={<MapPin size={20} />}
            label="Workshop"
            value={selectedWorkshopName}
          />
          <SummaryCard
            icon={<Clock3 size={20} />}
            label="Appointment"
            value={`${selectedDate} • ${selectedTime}`}
          />
          <SummaryCard
            icon={<Truck size={20} />}
            label="Service Mode"
            value={serviceMode}
          />

          <SummaryCard
            icon={<ShieldCheck size={20} />}
            label="Vehicle"
            value={vehicleId ? "Active vehicle linked" : "Vehicle link unavailable"}
          />
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
              Estimated Cost
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {estimatedCost}
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-100/70">
              Any additional cost requires your approval first.
            </p>
          </div>

          <div className="rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
              Estimated Duration
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {estimatedDuration}
            </p>
            <p className="mt-2 text-sm leading-6 text-violet-100/70">
              Progress will update in the live service timeline.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                MIRA Assistance
              </p>

              <h2 className="mt-1 text-xl font-black">
                MIRA stays with the booking
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                MIRA can explain service updates, approval requests and invoice
                details throughout the service journey.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Live Service Tracking
            </p>
            <h2 className="mt-1 text-2xl font-black">
              Service Timeline
            </h2>
          </div>

          <div className="mt-6 space-y-1">
            {timeline.map((item, index) => (
              <div key={item.id} className="relative flex gap-4">
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-full border ${
                      item.completed
                        ? "border-emerald-400/30 bg-emerald-500 text-white"
                        : item.current
                        ? "border-blue-400/40 bg-blue-500/20 text-blue-200"
                        : "border-white/10 bg-slate-950/60 text-slate-600"
                    }`}
                  >
                    {item.completed ? (
                      <CheckCircle2 size={17} />
                    ) : item.current ? (
                      <Clock3 size={15} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </div>

                  {index < timeline.length - 1 ? (
                    <div className="min-h-10 w-px flex-1 bg-white/10" />
                  ) : null}
                </div>

                <div className="pb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-sm font-black ${
                        item.completed
                          ? "text-emerald-200"
                          : item.current
                          ? "text-blue-200"
                          : "text-slate-400"
                      }`}
                    >
                      {item.title}
                    </h3>

                    {item.current ? (
                      <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-200">
                        Current
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 shadow-xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-300">
              <ShieldCheck size={21} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
                Approval Control
              </p>
              <h2 className="mt-1 text-lg font-black">
                No surprise work. No surprise charges.
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-100/70">
                If the workshop finds additional work, you will receive the
                finding, estimate and expected time before deciding whether to
                approve or reject it.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <ActionCard
            icon={<Phone size={20} />}
            title="Call Workshop"
            helper="Contact the workshop"
          />
          <ActionCard
            icon={<MessageCircle size={20} />}
            title="Message"
            helper="Booking communication"
          />
          <ActionCard
            icon={<Receipt size={20} />}
            title="Documents"
            helper="Job Card & invoice later"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Booking Created Successfully
              </p>
              <p className="mt-1 text-lg font-black">
                {selectedServiceName} • {selectedWorkshopName}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm font-black text-slate-200 transition hover:bg-white/[0.08]"
              >
                Back to Home
              </Link>

              <Link
                href={`/service-booking/track?bookingId=${encodeURIComponent(
                  bookingDbId || bookingId
                )}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3.5 text-sm font-black text-white transition hover:scale-[1.01]"
              >
                Track Service
                <ChevronRight size={17} />
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-xs text-slate-600">
          Internal booking record: {bookingDbId || "—"} · Active vehicle:{" "}
          {vehicleId || "—"}
        </section>
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
          <p className="mt-1 text-lg font-black text-white">
            {value}
          </p>
        </div>
      </div>
    </article>
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