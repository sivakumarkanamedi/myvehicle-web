"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type TimeSlot = {
  id: string;
  label: string;
  period: "Morning" | "Afternoon" | "Evening";
  available: boolean;
  completionText: string;
};

const TIME_SLOTS: TimeSlot[] = [
  {
    id: "09:00",
    label: "09:00 AM",
    period: "Morning",
    available: true,
    completionText: "Estimated completion: 12:00 PM",
  },
  {
    id: "10:00",
    label: "10:00 AM",
    period: "Morning",
    available: true,
    completionText: "Estimated completion: 01:00 PM",
  },
  {
    id: "11:00",
    label: "11:00 AM",
    period: "Morning",
    available: false,
    completionText: "Unavailable",
  },
  {
    id: "12:30",
    label: "12:30 PM",
    period: "Afternoon",
    available: true,
    completionText: "Estimated completion: 03:30 PM",
  },
  {
    id: "14:00",
    label: "02:00 PM",
    period: "Afternoon",
    available: true,
    completionText: "Estimated completion: 05:00 PM",
  },
  {
    id: "15:30",
    label: "03:30 PM",
    period: "Afternoon",
    available: true,
    completionText: "Estimated completion: 06:30 PM",
  },
  {
    id: "17:00",
    label: "05:00 PM",
    period: "Evening",
    available: true,
    completionText: "Estimated completion: Same day",
  },
  {
    id: "18:00",
    label: "06:00 PM",
    period: "Evening",
    available: false,
    completionText: "Unavailable",
  },
];

const DATE_OPTIONS = [
  { id: "today", label: "Today", sub: "08 Aug" },
  { id: "tomorrow", label: "Tomorrow", sub: "09 Aug" },
  { id: "day-3", label: "Sunday", sub: "10 Aug" },
  { id: "day-4", label: "Monday", sub: "11 Aug" },
  { id: "day-5", label: "Tuesday", sub: "12 Aug" },
];

export default function ServiceBookingSchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("category") || "regular";
  const selectedService = searchParams.get("service") || "";
  const selectedServiceName =
    searchParams.get("serviceName") || "Selected Service";
  const selectedWorkshop = searchParams.get("workshop") || "";
  const selectedWorkshopName =
    searchParams.get("workshopName") || "Selected Workshop";
  const vehicleId = searchParams.get("vehicleId") || "";

  const [selectedDate, setSelectedDate] = useState("today");
  const [selectedTime, setSelectedTime] = useState("");

  const selectedSlot = useMemo(
    () => TIME_SLOTS.find((slot) => slot.id === selectedTime) || null,
    [selectedTime]
  );

  const groupedSlots = useMemo(
    () => ({
      Morning: TIME_SLOTS.filter((slot) => slot.period === "Morning"),
      Afternoon: TIME_SLOTS.filter((slot) => slot.period === "Afternoon"),
      Evening: TIME_SLOTS.filter((slot) => slot.period === "Evening"),
    }),
    []
  );

  function continueToPickup() {
    if (!selectedTime) {
      window.alert("Please select an available time slot.");
      return;
    }

    const params = new URLSearchParams({
      category: selectedCategory,
      service: selectedService,
      serviceName: selectedServiceName,
      workshop: selectedWorkshop,
      workshopName: selectedWorkshopName,
      date: selectedDate,
      time: selectedTime,
    });

    if (vehicleId) {
      params.set("vehicleId", vehicleId);
    }

    router.push(`/service-booking/pickup?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href={`/service-booking/workshop?category=${encodeURIComponent(
              selectedCategory
            )}&service=${encodeURIComponent(
              selectedService
            )}&serviceName=${encodeURIComponent(selectedServiceName)}${
              vehicleId
                ? `&vehicleId=${encodeURIComponent(vehicleId)}`
                : ""
            }`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Workshops
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Step 4 of 7
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Choose Date & Time
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Select a convenient appointment slot. Only available slots are
                shown as selectable.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
              <SummaryBox label="Service" value={selectedServiceName} />
              <SummaryBox label="Workshop" value={selectedWorkshopName} />
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                Simple Scheduling
              </p>

              <h2 className="mt-1 text-xl font-black">
                Pick the date first, then the available slot
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                The workshop controls its capacity, so unavailable slots cannot
                be selected.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
              <CalendarDays size={21} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Choose Date
              </p>
              <h2 className="mt-1 text-xl font-black">Available Dates</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {DATE_OPTIONS.map((date) => {
              const active = selectedDate === date.id;

              return (
                <button
                  key={date.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date.id);
                    setSelectedTime("");
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-blue-400/40 bg-blue-500/15 text-blue-100"
                      : "border-white/10 bg-slate-950/40 text-slate-400 hover:bg-white/[0.05]"
                  }`}
                >
                  <p className="text-sm font-black">{date.label}</p>
                  <p className="mt-1 text-xs opacity-70">{date.sub}</p>

                  {active ? (
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-200">
                      <Check size={14} />
                      Selected
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <Clock3 size={21} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Choose Time
              </p>
              <h2 className="mt-1 text-xl font-black">Available Slots</h2>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {(["Morning", "Afternoon", "Evening"] as const).map((period) => (
              <div key={period}>
                <p className="text-sm font-black text-slate-300">{period}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {groupedSlots[period].map((slot) => {
                    const active = selectedTime === slot.id;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          !slot.available
                            ? "cursor-not-allowed border-white/5 bg-slate-950/25 text-slate-700 opacity-60"
                            : active
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                            : "border-white/10 bg-slate-950/40 text-slate-300 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black">{slot.label}</p>

                          {active ? (
                            <Check size={16} className="text-emerald-300" />
                          ) : null}
                        </div>

                        <p className="mt-2 text-xs leading-5 opacity-70">
                          {slot.completionText}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
            Selected Appointment
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-lg font-black text-white">
                {selectedTime
                  ? `${DATE_OPTIONS.find((d) => d.id === selectedDate)?.label} • ${
                      selectedSlot?.label
                    }`
                  : "Choose a time slot to continue"}
              </p>

              {selectedSlot ? (
                <p className="mt-1 text-sm text-blue-100/70">
                  {selectedSlot.completionText}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={continueToPickup}
              disabled={!selectedTime}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black transition ${
                selectedTime
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:scale-[1.01]"
                  : "cursor-not-allowed bg-white/10 text-slate-600"
              }`}
            >
              Continue
              <ChevronRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}