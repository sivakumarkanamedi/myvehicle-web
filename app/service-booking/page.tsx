"use client";

import {
  ArrowLeft,
  BatteryCharging,
  Bike,
  ChevronRight,
  Droplets,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const serviceCategories = [
  {
    id: "regular",
    title: "Regular Service",
    description:
      "Basic, Standard and Comprehensive routine service packages.",
    icon: Wrench,
    badge: "Popular",
  },
  {
    id: "repair",
    title: "Repairs",
    description:
      "Engine, brakes, clutch, suspension, electrical and issue-specific repairs.",
    icon: Bike,
  },
  {
    id: "wash",
    title: "Washing & Detailing",
    description:
      "Water wash, foam wash, polishing and detailing.",
    icon: Droplets,
  },
  {
    id: "tyre-battery",
    title: "Tyres & Battery",
    description:
      "Tyre service, puncture support, battery check and replacement.",
    icon: BatteryCharging,
  },
  {
    id: "emergency",
    title: "Emergency Assistance",
    description:
      "Breakdown, towing, flat tyre and battery jump-start assistance.",
    icon: ShieldCheck,
  },
];

export default function ServiceBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedWorkshopId = searchParams.get("workshopId") || "";
  const selectedWorkshopName = searchParams.get("workshopName") || "";
  const vehicleIdFromUrl = searchParams.get("vehicleId") || "";

  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);

  useEffect(() => {
    const urlVehicleId = Number(vehicleIdFromUrl);

    if (Number.isFinite(urlVehicleId) && urlVehicleId > 0) {
      setActiveVehicleId(urlVehicleId);
      window.localStorage.setItem(
        "myvehicle.activeVehicleId",
        String(urlVehicleId)
      );
      return;
    }

    const savedVehicleId = Number(
      window.localStorage.getItem("myvehicle.activeVehicleId")
    );

    if (Number.isFinite(savedVehicleId) && savedVehicleId > 0) {
      setActiveVehicleId(savedVehicleId);
    }
  }, [vehicleIdFromUrl]);

  function openCategory(category: string) {
    const params = new URLSearchParams({
      category,
    });

    if (activeVehicleId) {
      params.set("vehicleId", String(activeVehicleId));
    }

    if (selectedWorkshopId) {
      params.set("workshopId", selectedWorkshopId);
    }

    if (selectedWorkshopName) {
      params.set("workshopName", selectedWorkshopName);
    }

    router.push(`/service-booking/package?${params.toString()}`);
  }

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
                Step 1 of 7
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Service Booking
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Choose the service you need and continue through a simple,
                transparent booking flow.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm font-bold text-violet-200">
              <Sparkles size={18} />
              Powered by MIRA
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Booking Flow
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
            {[
              "Service Booking",
              "Choose Package",
              "Choose Workshop",
              "Date & Time",
              "Drive-in / Pickup",
              "Review",
              "Confirm",
            ].map((step, index, all) => (
              <div key={step} className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-2 ${
                    index === 0
                      ? "border-blue-400/30 bg-blue-500/15 text-blue-200"
                      : "border-white/10 bg-slate-950/50 text-slate-500"
                  }`}
                >
                  {step}
                </span>

                {index < all.length - 1 ? (
                  <ChevronRight size={14} className="text-slate-700" />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-950/80 via-slate-900 to-violet-950/70 p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
            Two-Wheeler Service
          </p>

          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            What service do you need today?
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            The currently active vehicle is used automatically. You do not need
            to select the vehicle again inside Service Booking.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {activeVehicleId ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
                <ShieldCheck size={15} />
                Active vehicle connected
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">
                <ShieldCheck size={15} />
                Active vehicle will be resolved automatically at confirmation
              </div>
            )}

            {selectedWorkshopName ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs font-bold text-blue-200">
                <Wrench size={15} />
                Workshop preselected: {selectedWorkshopName}
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Choose Service
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Service Categories
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {serviceCategories.map((category) => {
              const Icon = category.icon;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => openCategory(category.id)}
                  className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-xl transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
                      <Icon size={24} />
                    </div>

                    {category.badge ? (
                      <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200">
                        {category.badge}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-5 text-xl font-black">
                    {category.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {category.description}
                  </p>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-300">
                    Choose Service
                    <ChevronRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <TrustCard
            title="Verified Workshops"
            description="Choose trusted workshops that meet My Vehicle verification standards."
          />

          <TrustCard
            title="Transparent Booking"
            description="See service, workshop, time slot and estimated pricing before confirmation."
          />

          <TrustCard
            title="Live Service Updates"
            description="Track the booking from workshop acceptance through completion."
          />
        </section>
      </div>
    </main>
  );
}

function TrustCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
        <ShieldCheck size={20} />
      </div>

      <h3 className="mt-4 text-lg font-black">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </article>
  );
}