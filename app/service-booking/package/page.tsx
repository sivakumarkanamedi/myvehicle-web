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
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PackageItem = {
  id: string;
  title: string;
  description: string;
  category:
    | "regular"
    | "repair"
    | "wash"
    | "tyre-battery"
    | "emergency";
  priceType: "fixed" | "starting" | "inspection";
  priceText: string;
  duration: string;
  badge?: string;
  icon: React.ReactNode;
};

const PACKAGE_ITEMS: PackageItem[] = [
  {
    id: "basic-service",
    title: "Basic Service",
    description:
      "Routine maintenance package for regular two-wheeler upkeep.",
    category: "regular",
    priceType: "starting",
    priceText: "Starts from ₹499",
    duration: "Approx. 60–90 mins",
    badge: "Popular",
    icon: <Wrench size={22} />,
  },
  {
    id: "standard-service",
    title: "Standard Service",
    description:
      "A broader maintenance package with additional inspection and service checks.",
    category: "regular",
    priceType: "starting",
    priceText: "Starts from ₹799",
    duration: "Approx. 90–120 mins",
    badge: "Recommended",
    icon: <Sparkles size={22} />,
  },
  {
    id: "comprehensive-service",
    title: "Comprehensive Service",
    description:
      "Detailed periodic maintenance with an extended inspection scope.",
    category: "regular",
    priceType: "starting",
    priceText: "Starts from ₹1,299",
    duration: "Approx. 2–3 hrs",
    icon: <ShieldCheck size={22} />,
  },

  {
    id: "engine-repair",
    title: "Engine Repair",
    description:
      "For engine noise, performance loss, oil leakage or related concerns.",
    category: "repair",
    priceType: "inspection",
    priceText: "Inspection Required",
    duration: "Estimate after inspection",
    icon: <Bike size={22} />,
  },
  {
    id: "brake-repair",
    title: "Brake Repair",
    description:
      "For brake noise, poor braking, vibration or brake component concerns.",
    category: "repair",
    priceType: "inspection",
    priceText: "Inspection Required",
    duration: "Estimate after inspection",
    icon: <Bike size={22} />,
  },
  {
    id: "clutch-repair",
    title: "Clutch Repair",
    description:
      "For clutch slipping, hard clutch operation or pickup-related issues.",
    category: "repair",
    priceType: "inspection",
    priceText: "Inspection Required",
    duration: "Estimate after inspection",
    icon: <Bike size={22} />,
  },
  {
    id: "electrical-repair",
    title: "Electrical Repair",
    description:
      "For self-start, wiring, lighting, horn and other electrical issues.",
    category: "repair",
    priceType: "inspection",
    priceText: "Inspection Required",
    duration: "Estimate after inspection",
    icon: <BatteryCharging size={22} />,
  },

  {
    id: "water-wash",
    title: "Water Wash",
    description:
      "Quick exterior wash for routine cleaning.",
    category: "wash",
    priceType: "fixed",
    priceText: "From ₹149",
    duration: "Approx. 20–30 mins",
    icon: <Droplets size={22} />,
  },
  {
    id: "foam-wash",
    title: "Foam Wash",
    description:
      "Deep exterior foam wash for a cleaner finish.",
    category: "wash",
    priceType: "fixed",
    priceText: "From ₹249",
    duration: "Approx. 30–45 mins",
    icon: <Droplets size={22} />,
  },
  {
    id: "detailing",
    title: "Detailing",
    description:
      "Premium cleaning, polishing and finish enhancement.",
    category: "wash",
    priceType: "starting",
    priceText: "Starts from ₹799",
    duration: "Approx. 2–3 hrs",
    icon: <Sparkles size={22} />,
  },

  {
    id: "tyre-service",
    title: "Tyre Service",
    description:
      "Tyre inspection, puncture support, tube/tubeless service or replacement.",
    category: "tyre-battery",
    priceType: "inspection",
    priceText: "Price depends on service",
    duration: "Approx. 30–60 mins",
    icon: <Bike size={22} />,
  },
  {
    id: "battery-service",
    title: "Battery Service",
    description:
      "Battery health check, charging support or battery replacement.",
    category: "tyre-battery",
    priceType: "inspection",
    priceText: "Price depends on service",
    duration: "Approx. 20–45 mins",
    icon: <BatteryCharging size={22} />,
  },

  {
    id: "breakdown-assistance",
    title: "Breakdown Assistance",
    description:
      "Roadside support when the two-wheeler cannot continue the journey.",
    category: "emergency",
    priceType: "starting",
    priceText: "Starts from ₹299",
    duration: "ETA depends on location",
    icon: <ShieldCheck size={22} />,
  },
  {
    id: "towing",
    title: "Towing",
    description:
      "Transport your two-wheeler safely to a suitable workshop.",
    category: "emergency",
    priceType: "starting",
    priceText: "Starts from ₹499",
    duration: "ETA depends on location",
    icon: <ShieldCheck size={22} />,
  },
  {
    id: "flat-tyre",
    title: "Flat Tyre Assistance",
    description:
      "Roadside support for tyre puncture or flat tyre issues.",
    category: "emergency",
    priceType: "starting",
    priceText: "Starts from ₹199",
    duration: "ETA depends on location",
    icon: <Bike size={22} />,
  },
  {
    id: "jump-start",
    title: "Battery Jump Start",
    description:
      "Roadside battery jump-start support when the vehicle will not start.",
    category: "emergency",
    priceType: "starting",
    priceText: "Starts from ₹199",
    duration: "ETA depends on location",
    icon: <BatteryCharging size={22} />,
  },
];

const categoryLabels: Record<PackageItem["category"], string> = {
  regular: "Regular Service",
  repair: "Repairs",
  wash: "Washing & Detailing",
  "tyre-battery": "Tyres & Battery",
  emergency: "Emergency Assistance",
};

export default function ChoosePackagePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialCategory =
    (searchParams.get("category") as PackageItem["category"] | null) ??
    "regular";

  const vehicleId = searchParams.get("vehicleId") || "";
  const workshopId = searchParams.get("workshopId") || "";
  const workshopName = searchParams.get("workshopName") || "";

  const [activeCategory, setActiveCategory] =
    useState<PackageItem["category"]>(initialCategory);

  const visiblePackages = useMemo(
    () => PACKAGE_ITEMS.filter((item) => item.category === activeCategory),
    [activeCategory]
  );

  function selectPackage(item: PackageItem) {
    const params = new URLSearchParams({
      category: item.category,
      service: item.id,
      serviceName: item.title,
    });

    if (vehicleId) {
      params.set("vehicleId", vehicleId);
    }

    if (workshopId) {
      params.set("workshopId", workshopId);
    }

    if (workshopName) {
      params.set("workshopName", workshopName);
    }

    router.push(`/service-booking/workshop?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href={`/service-booking?${
              new URLSearchParams({
                ...(vehicleId ? { vehicleId } : {}),
                ...(workshopId ? { workshopId } : {}),
                ...(workshopName ? { workshopName } : {}),
              }).toString()
            }`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Service Booking
          </Link>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
              Step 2 of 7
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Choose Package / Service
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Select the service you need. Detailed package inclusions will be
              refined as the My Vehicle service catalogue evolves.
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(categoryLabels) as PackageItem["category"][]).map(
              (category) => {
                const active = activeCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                      active
                        ? "border-blue-400/30 bg-blue-500/15 text-blue-200"
                        : "border-white/10 bg-slate-950/50 text-slate-500 hover:bg-white/[0.05]"
                    }`}
                  >
                    {categoryLabels[category]}
                  </button>
                );
              }
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                Simple & Transparent
              </p>

              <h2 className="mt-1 text-xl font-black">
                Choose only what you need
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Fixed-price services show a clear price. Repair jobs that need
                diagnosis are marked as inspection required so users are never
                misled by unrealistic estimates.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiblePackages.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl"
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
                    {item.icon}
                  </div>

                  {item.badge ? (
                    <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200">
                      {item.badge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                  {categoryLabels[item.category]}
                </p>

                <h2 className="mt-2 text-xl font-black">{item.title}</h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {item.description}
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p
                    className={`text-sm font-black ${
                      item.priceType === "inspection"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {item.priceText}
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    {item.duration}
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 bg-slate-950/30 p-4">
                <button
                  type="button"
                  onClick={() => selectPackage(item)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.01]"
                >
                  Choose This Service
                  <ChevronRight size={17} />
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Version 1 note:</strong> package names and customer flow are
          locked. Detailed package inclusions and manufacturer-specific service
          operations will be refined later from verified service schedules.
        </section>
      </div>
    </main>
  );
}