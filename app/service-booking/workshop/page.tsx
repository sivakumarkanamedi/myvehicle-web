"use client";

import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type WorkshopType = "authorized" | "independent" | "specialist";

type Workshop = {
  id: string;
  name: string;
  type: WorkshopType;
  distanceKm: number;
  travelMinutes: number;
  rating: number;
  reviews: number;
  verified: boolean;
  pickupDrop: boolean;
  warranty: boolean;
  nextSlot: string;
  priceText: string;
  brands: string[];
  services: string[];
  miraRecommended?: boolean;
};

const WORKSHOPS: Workshop[] = [
  {
    id: "ws-001",
    name: "ABC Bike Care",
    type: "independent",
    distanceKm: 2.3,
    travelMinutes: 9,
    rating: 4.8,
    reviews: 1284,
    verified: true,
    pickupDrop: true,
    warranty: true,
    nextSlot: "Today • 3:00 PM",
    priceText: "Starts from ₹799",
    brands: ["Hero", "Honda", "TVS", "Bajaj", "Yamaha"],
    services: ["Regular Service", "Repairs", "Tyres", "Battery"],
    miraRecommended: true,
  },
  {
    id: "ws-002",
    name: "Honda Authorized Service",
    type: "authorized",
    distanceKm: 3.1,
    travelMinutes: 12,
    rating: 4.7,
    reviews: 934,
    verified: true,
    pickupDrop: true,
    warranty: true,
    nextSlot: "Today • 4:30 PM",
    priceText: "Starts from ₹899",
    brands: ["Honda"],
    services: ["Regular Service", "Repairs", "Battery"],
  },
  {
    id: "ws-003",
    name: "Speed Bike Works",
    type: "independent",
    distanceKm: 4.2,
    travelMinutes: 16,
    rating: 4.6,
    reviews: 622,
    verified: true,
    pickupDrop: false,
    warranty: false,
    nextSlot: "Tomorrow • 10:00 AM",
    priceText: "Inspection Required",
    brands: ["Hero", "TVS", "Bajaj", "Suzuki"],
    services: ["Repairs", "Electrical", "Tyres"],
  },
  {
    id: "ws-004",
    name: "MotoTech Specialist",
    type: "specialist",
    distanceKm: 5.4,
    travelMinutes: 20,
    rating: 4.9,
    reviews: 418,
    verified: true,
    pickupDrop: true,
    warranty: true,
    nextSlot: "Tomorrow • 9:30 AM",
    priceText: "Starts from ₹999",
    brands: ["Royal Enfield", "KTM", "Yamaha", "Honda"],
    services: ["Premium Service", "Engine", "Electrical", "Brakes"],
  },
];

type SortOption =
  | "recommended"
  | "nearest"
  | "rating"
  | "earliest";

function typeLabel(type: WorkshopType) {
  if (type === "authorized") return "Authorized";
  if (type === "specialist") return "Specialist";
  return "Independent";
}

export default function ChooseWorkshopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("category") || "regular";
  const selectedService = searchParams.get("service") || "";
  const selectedServiceName =
    searchParams.get("serviceName") || "Selected Service";

  const vehicleId = searchParams.get("vehicleId") || "";
  const preselectedWorkshopId = searchParams.get("workshopId") || "";
  const preselectedWorkshopName = searchParams.get("workshopName") || "";

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [pickupOnly, setPickupOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const visibleWorkshops = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    let items = WORKSHOPS.filter((workshop) => {
      const matchesSearch =
        !normalized ||
        workshop.name.toLowerCase().includes(normalized) ||
        workshop.brands.join(" ").toLowerCase().includes(normalized) ||
        workshop.services.join(" ").toLowerCase().includes(normalized);

      const matchesPickup = !pickupOnly || workshop.pickupDrop;
      const matchesVerified = !verifiedOnly || workshop.verified;

      return matchesSearch && matchesPickup && matchesVerified;
    });

    items = [...items].sort((a, b) => {
      if (sortBy === "nearest") return a.distanceKm - b.distanceKm;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "earliest") return a.travelMinutes - b.travelMinutes;

      if (a.miraRecommended !== b.miraRecommended) {
        return Number(b.miraRecommended) - Number(a.miraRecommended);
      }

      return b.rating - a.rating;
    });

    return items;
  }, [query, sortBy, pickupOnly, verifiedOnly]);

  function continueWithPreselectedWorkshop() {
    if (!preselectedWorkshopName) return;

    const params = new URLSearchParams({
      category: selectedCategory,
      service: selectedService,
      serviceName: selectedServiceName,
      workshop: preselectedWorkshopId || "preselected-workshop",
      workshopName: preselectedWorkshopName,
    });

    if (vehicleId) {
      params.set("vehicleId", vehicleId);
    }

    router.push(`/service-booking/schedule?${params.toString()}`);
  }

  function selectWorkshop(workshop: Workshop) {
    const params = new URLSearchParams({
      category: selectedCategory,
      service: selectedService,
      serviceName: selectedServiceName,
      workshop: workshop.id,
      workshopName: workshop.name,
    });


    if (vehicleId) {
      params.set("vehicleId", vehicleId);
    }

    router.push(`/service-booking/schedule?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href={`/service-booking/package?${new URLSearchParams({
              category: selectedCategory,
              service: selectedService,
              serviceName: selectedServiceName,
              ...(vehicleId ? { vehicleId } : {}),
              ...(preselectedWorkshopId
                ? { workshopId: preselectedWorkshopId }
                : {}),
              ...(preselectedWorkshopName
                ? { workshopName: preselectedWorkshopName }
                : {}),
            }).toString()}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Packages
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Step 3 of 7
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Choose Workshop
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Compare verified workshops by rating, distance, availability,
                pickup & drop and estimated pricing.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-blue-300">
                Selected Service
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {selectedServiceName}
              </p>
            </div>
          </div>
        </header>

        {preselectedWorkshopName ? (
          <section className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/55 via-slate-900 to-blue-950/45 p-5 shadow-2xl sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <BadgeCheck size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    Preselected Workshop
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    {preselectedWorkshopName}
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    You selected this workshop before starting Service Booking.
                    Continue with it, or choose another workshop below.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={continueWithPreselectedWorkshop}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-5 py-3.5 text-sm font-black text-white"
              >
                Continue with this Workshop
                <ChevronRight size={17} />
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                MIRA Recommendation
              </p>

              <h2 className="mt-1 text-xl font-black">
                Best-fit workshops first
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Workshops are ranked using service fit, trust, availability,
                distance, rating and price transparency.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search workshop, brand or service"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40"
              />
            </div>

            <div className="relative">
              <Filter
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
                className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-10 text-sm font-bold text-white outline-none"
              >
                <option value="recommended">Recommended by MIRA</option>
                <option value="nearest">Nearest</option>
                <option value="rating">Highest Rated</option>
                <option value="earliest">Earliest Available</option>
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVerifiedOnly((value) => !value)}
              className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                verifiedOnly
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-slate-950/50 text-slate-500"
              }`}
            >
              Verified Only
            </button>

            <button
              type="button"
              onClick={() => setPickupOnly((value) => !value)}
              className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                pickupOnly
                  ? "border-blue-400/30 bg-blue-500/15 text-blue-200"
                  : "border-white/10 bg-slate-950/50 text-slate-500"
              }`}
            >
              Pickup & Drop
            </button>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {visibleWorkshops.map((workshop) => (
            <article
              key={workshop.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl"
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
                    <Wrench size={24} />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {workshop.miraRecommended ? (
                      <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200">
                        MIRA Pick
                      </span>
                    ) : null}

                    {workshop.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                        <BadgeCheck size={13} />
                        Verified
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                  {typeLabel(workshop.type)}
                </p>

                <h2 className="mt-2 text-xl font-black">{workshop.name}</h2>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Star
                      size={16}
                      className="fill-amber-300 text-amber-300"
                    />
                    <strong className="text-white">{workshop.rating}</strong>
                    <span className="text-slate-600">
                      ({workshop.reviews.toLocaleString("en-IN")})
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} />
                    {workshop.distanceKm} km • {workshop.travelMinutes} min
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoBox
                    icon={<Clock3 size={16} />}
                    label="Next Available"
                    value={workshop.nextSlot}
                  />

                  <InfoBox
                    icon={<ShieldCheck size={16} />}
                    label="Pricing"
                    value={workshop.priceText}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {workshop.pickupDrop ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/15 bg-blue-400/[0.07] px-3 py-1.5 text-xs font-bold text-blue-200">
                      <Truck size={14} />
                      Pickup & Drop
                    </span>
                  ) : null}

                  {workshop.warranty ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-bold text-emerald-200">
                      <ShieldCheck size={14} />
                      Warranty Available
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Brands Supported
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {workshop.brands.join(" • ")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-slate-950/30 p-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"
                >
                  View Details
                </button>

                <button
                  type="button"
                  onClick={() => selectWorkshop(workshop)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 text-xs font-black text-white"
                >
                  Select Workshop
                  <ChevronRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-100">
          <strong>Trust first:</strong> users should choose workshops using
          verified status, service fit, availability, rating, distance and
          transparent pricing — not distance alone.
        </section>
      </div>
    </main>
  );
}

function InfoBox({
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
        <span className="text-[11px] font-black uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>

      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}