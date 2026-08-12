"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type VehicleType = "Car" | "Bike" | "EV" | "Commercial";

type WorkshopService =
  | "General Service"
  | "Oil Change"
  | "Brake Service"
  | "Tyres"
  | "AC Service"
  | "Electrical"
  | "Denting & Painting"
  | "EV Service";

type Workshop = {
  id: number;
  name: string;
  verified: boolean;
  address: string;
  area: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  myVehicleScore: number;
  openNow: boolean;
  closingTime: string;
  imageUrl: string;
  vehicleTypes: VehicleType[];
  services: WorkshopService[];
  brands: string[];
  pickupAvailable: boolean;
  doorstepAvailable: boolean;
  emergencyAvailable: boolean;
  liveQueueMinutes: number | null;
  estimatedPrice: number;
  discountPercent: number | null;
  phone: string;
  latitude: number;
  longitude: number;
  highlights: string[];
};

type SortOption =
  | "Recommended"
  | "Nearest"
  | "Highest Rated"
  | "Lowest Price"
  | "My Vehicle Score";

type Notice = {
  type: "success" | "warning" | "error";
  message: string;
};

const workshops: Workshop[] = [
  {
    id: 1,
    name: "Bosch Car Service – AutoCare",
    verified: true,
    address: "Outer Ring Road, Marathahalli",
    area: "Marathahalli",
    distanceKm: 2.1,
    rating: 4.8,
    reviewCount: 1284,
    myVehicleScore: 94,
    openNow: true,
    closingTime: "8:00 PM",
    imageUrl:
      "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1200&q=80",
    vehicleTypes: ["Car", "EV"],
    services: [
      "General Service",
      "Oil Change",
      "Brake Service",
      "Tyres",
      "AC Service",
      "Electrical",
      "EV Service",
    ],
    brands: ["Hyundai", "Honda", "Toyota", "Tata", "Mahindra", "Kia"],
    pickupAvailable: true,
    doorstepAvailable: true,
    emergencyAvailable: true,
    liveQueueMinutes: 25,
    estimatedPrice: 2499,
    discountPercent: 15,
    phone: "+919876543210",
    latitude: 12.9592,
    longitude: 77.6974,
    highlights: [
      "Certified technicians",
      "Digital inspection",
      "Service warranty",
      "Genuine parts",
    ],
  },
  {
    id: 2,
    name: "GoMechanic Premium Garage",
    verified: true,
    address: "HAL Old Airport Road",
    area: "Indiranagar",
    distanceKm: 4.4,
    rating: 4.6,
    reviewCount: 932,
    myVehicleScore: 90,
    openNow: true,
    closingTime: "9:00 PM",
    imageUrl:
      "https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&w=1200&q=80",
    vehicleTypes: ["Car", "EV"],
    services: [
      "General Service",
      "Oil Change",
      "Brake Service",
      "Tyres",
      "AC Service",
      "Electrical",
      "Denting & Painting",
    ],
    brands: ["Maruti Suzuki", "Hyundai", "Honda", "Kia", "Renault"],
    pickupAvailable: true,
    doorstepAvailable: false,
    emergencyAvailable: true,
    liveQueueMinutes: 40,
    estimatedPrice: 2199,
    discountPercent: 20,
    phone: "+919845678901",
    latitude: 12.9609,
    longitude: 77.6488,
    highlights: [
      "Free pickup and drop",
      "Transparent estimates",
      "Repair evidence",
      "Service packages",
    ],
  },
  {
    id: 3,
    name: "RideFix Two Wheeler Care",
    verified: true,
    address: "Near Yeshwanthpur Metro Station",
    area: "Yeshwanthpur",
    distanceKm: 5.7,
    rating: 4.7,
    reviewCount: 618,
    myVehicleScore: 92,
    openNow: true,
    closingTime: "8:30 PM",
    imageUrl:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80",
    vehicleTypes: ["Bike", "EV"],
    services: [
      "General Service",
      "Oil Change",
      "Brake Service",
      "Tyres",
      "Electrical",
      "EV Service",
    ],
    brands: ["Honda", "TVS", "Bajaj", "Hero", "Royal Enfield", "Ather"],
    pickupAvailable: true,
    doorstepAvailable: true,
    emergencyAvailable: true,
    liveQueueMinutes: 15,
    estimatedPrice: 799,
    discountPercent: 10,
    phone: "+919900112233",
    latitude: 13.0285,
    longitude: 77.5407,
    highlights: [
      "Bike specialists",
      "Same-day service",
      "Doorstep repair",
      "EV diagnostics",
    ],
  },
  {
    id: 4,
    name: "Tata Motors Authorized Service",
    verified: true,
    address: "Whitefield Main Road",
    area: "Whitefield",
    distanceKm: 8.6,
    rating: 4.5,
    reviewCount: 1508,
    myVehicleScore: 96,
    openNow: false,
    closingTime: "6:30 PM",
    imageUrl:
      "https://images.unsplash.com/photo-1632823471565-1ecdf5c6d7a8?auto=format&fit=crop&w=1200&q=80",
    vehicleTypes: ["Car", "EV", "Commercial"],
    services: [
      "General Service",
      "Oil Change",
      "Brake Service",
      "Tyres",
      "AC Service",
      "Electrical",
      "Denting & Painting",
      "EV Service",
    ],
    brands: ["Tata"],
    pickupAvailable: true,
    doorstepAvailable: false,
    emergencyAvailable: true,
    liveQueueMinutes: null,
    estimatedPrice: 3499,
    discountPercent: null,
    phone: "+918041234567",
    latitude: 12.9698,
    longitude: 77.75,
    highlights: [
      "Authorized workshop",
      "Manufacturer warranty",
      "Certified parts",
    ],
  },
  {
    id: 5,
    name: "Garage 99 Multi-Brand Service",
    verified: false,
    address: "Koramangala 5th Block",
    area: "Koramangala",
    distanceKm: 6.2,
    rating: 4.3,
    reviewCount: 404,
    myVehicleScore: 82,
    openNow: true,
    closingTime: "10:00 PM",
    imageUrl:
      "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=1200&q=80",
    vehicleTypes: ["Car", "Bike"],
    services: [
      "General Service",
      "Oil Change",
      "Brake Service",
      "Tyres",
      "AC Service",
      "Electrical",
      "Denting & Painting",
    ],
    brands: ["Maruti Suzuki", "Hyundai", "Honda", "Toyota", "Mahindra"],
    pickupAvailable: false,
    doorstepAvailable: true,
    emergencyAvailable: false,
    liveQueueMinutes: 35,
    estimatedPrice: 1899,
    discountPercent: 12,
    phone: "+919811223344",
    latitude: 12.9352,
    longitude: 77.6245,
    highlights: [
      "Competitive pricing",
      "Late-night service",
      "Doorstep inspection",
      "Multi-brand support",
    ],
  },
  {
    id: 6,
    name: "VoltCare EV Service Hub",
    verified: true,
    address: "HSR Layout Sector 2",
    area: "HSR Layout",
    distanceKm: 7.3,
    rating: 4.9,
    reviewCount: 327,
    myVehicleScore: 95,
    openNow: true,
    closingTime: "7:30 PM",
    imageUrl:
      "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1200&q=80",
    vehicleTypes: ["EV", "Car", "Bike"],
    services: ["Tyres", "Brake Service", "Electrical", "EV Service"],
    brands: ["Tata", "Ather", "Ola", "MG", "Mahindra", "TVS"],
    pickupAvailable: true,
    doorstepAvailable: true,
    emergencyAvailable: true,
    liveQueueMinutes: 20,
    estimatedPrice: 1499,
    discountPercent: 8,
    phone: "+919744556677",
    latitude: 12.9116,
    longitude: 77.6389,
    highlights: [
      "EV-certified technicians",
      "Mobile charging support",
    ],
  },
];

const vehicleTypes: Array<"All" | VehicleType> = [
  "All",
  "Car",
  "Bike",
  "EV",
  "Commercial",
];

const serviceTypes: Array<"All" | WorkshopService> = [
  "All",
  "General Service",
  "Oil Change",
  "Brake Service",
  "Tyres",
  "AC Service",
  "Electrical",
  "Denting & Painting",
  "EV Service",
];

const sortOptions: SortOption[] = [
  "Recommended",
  "Nearest",
  "Highest Rated",
  "Lowest Price",
  "My Vehicle Score",
];

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function createStars(rating: number) {
  const fullStars = Math.round(rating);

  return Array.from({ length: 5 }, (_, index) =>
    index < fullStars ? "★" : "☆"
  ).join("");
}

export default function WorkshopsPage() {
  const router = useRouter();

  const [searchText, setSearchText] = useState("");
  const [selectedVehicleType, setSelectedVehicleType] = useState<
    "All" | VehicleType
  >("All");
  const [selectedService, setSelectedService] = useState<
    "All" | WorkshopService
  >("All");
  const [sortOption, setSortOption] = useState<SortOption>("Recommended");

  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [pickupOnly, setPickupOnly] = useState(false);
  const [doorstepOnly, setDoorstepOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const [selectedWorkshop, setSelectedWorkshop] =
    useState<Workshop | null>(null);

  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const [notice, setNotice] = useState<Notice | null>(null);

  const filteredWorkshops = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    const result = workshops.filter((workshop) => {
      const searchableText = [
        workshop.name,
        workshop.address,
        workshop.area,
        ...workshop.brands,
        ...workshop.services,
        ...workshop.highlights,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch);

      const matchesVehicle =
        selectedVehicleType === "All" ||
        workshop.vehicleTypes.includes(selectedVehicleType);

      const matchesService =
        selectedService === "All" ||
        workshop.services.includes(selectedService);

      const matchesOpen = !openNowOnly || workshop.openNow;
      const matchesPickup = !pickupOnly || workshop.pickupAvailable;
      const matchesDoorstep = !doorstepOnly || workshop.doorstepAvailable;
      const matchesVerified = !verifiedOnly || workshop.verified;

      return (
        matchesSearch &&
        matchesVehicle &&
        matchesService &&
        matchesOpen &&
        matchesPickup &&
        matchesDoorstep &&
        matchesVerified
      );
    });

    return [...result].sort((a, b) => {
      switch (sortOption) {
        case "Nearest":
          return a.distanceKm - b.distanceKm;

        case "Highest Rated":
          return b.rating - a.rating;

        case "Lowest Price":
          return a.estimatedPrice - b.estimatedPrice;

        case "My Vehicle Score":
          return b.myVehicleScore - a.myVehicleScore;

        case "Recommended":
        default:
          return (
            b.myVehicleScore * 0.45 +
            b.rating * 10 -
            b.distanceKm * 0.8 -
            (a.myVehicleScore * 0.45 +
              a.rating * 10 -
              a.distanceKm * 0.8)
          );
      }
    });
  }, [
    doorstepOnly,
    openNowOnly,
    pickupOnly,
    searchText,
    selectedService,
    selectedVehicleType,
    sortOption,
    verifiedOnly,
  ]);

  const comparedWorkshops = useMemo(
    () => workshops.filter((workshop) => compareIds.includes(workshop.id)),
    [compareIds]
  );

  function showNotice(type: Notice["type"], message: string) {
    setNotice({ type, message });

    window.setTimeout(() => {
      setNotice(null);
    }, 4000);
  }

  function toggleCompare(workshopId: number) {
    setCompareIds((current) => {
      if (current.includes(workshopId)) {
        return current.filter((id) => id !== workshopId);
      }

      if (current.length >= 3) {
        showNotice(
          "warning",
          "You can compare a maximum of three workshops."
        );

        return current;
      }

      return [...current, workshopId];
    });
  }

  function resetFilters() {
    setSearchText("");
    setSelectedVehicleType("All");
    setSelectedService("All");
    setSortOption("Recommended");
    setOpenNowOnly(false);
    setPickupOnly(false);
    setDoorstepOnly(false);
    setVerifiedOnly(false);
  }

  function openMaps(workshop: Workshop) {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${workshop.latitude},${workshop.longitude}`;

    window.open(mapUrl, "_blank", "noopener,noreferrer");
  }

  function callWorkshop(workshop: Workshop) {
    window.location.href = `tel:${workshop.phone}`;
  }

  function beginBooking(workshop: Workshop) {
    const params = new URLSearchParams({
      workshopId: String(workshop.id),
      workshopName: workshop.name,
    });

    const activeVehicleId = window.localStorage.getItem(
      "myvehicle.activeVehicleId"
    );

    if (activeVehicleId) {
      params.set("vehicleId", activeVehicleId);
    }

    setSelectedWorkshop(null);

    router.push(`/service-booking?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {notice && (
        <div className="fixed left-1/2 top-5 z-[100] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div
            className={`rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur ${
              notice.type === "success"
                ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100"
                : notice.type === "warning"
                ? "border-amber-500/30 bg-amber-950/95 text-amber-100"
                : "border-red-500/30 bg-red-950/95 text-red-100"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium">{notice.message}</p>

              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-xl leading-none opacity-70 hover:opacity-100"
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="border-b border-white/10 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-blue-300 transition hover:text-white"
          >
            ← Back
          </button>

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-3xl">
                  🛠️
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">
                    My Vehicle Service Network
                  </p>

                  <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
                    Find Trusted Workshops
                  </h1>
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Search, compare and book verified workshops with transparent
                pricing, customer ratings, pickup options and My Vehicle Trust
                Scores.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat value="250+" label="Workshops" />
              <Stat value="4.7" label="Avg. Rating" />
              <Stat value="24/7" label="Assistance" />
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-4 shadow-2xl backdrop-blur">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.7fr_0.8fr_auto]">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                  🔍
                </span>

                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search workshop, area, service or vehicle brand"
                  className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <select
                value={selectedVehicleType}
                onChange={(event) =>
                  setSelectedVehicleType(
                    event.target.value as "All" | VehicleType
                  )
                }
                className="h-12 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none focus:border-blue-500"
              >
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "All" ? "All vehicles" : type}
                  </option>
                ))}
              </select>

              <select
                value={selectedService}
                onChange={(event) =>
                  setSelectedService(
                    event.target.value as "All" | WorkshopService
                  )
                }
                className="h-12 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none focus:border-blue-500"
              >
                {serviceTypes.map((service) => (
                  <option key={service} value={service}>
                    {service === "All" ? "All services" : service}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "success",
                    `${filteredWorkshops.length} workshop${
                      filteredWorkshops.length === 1 ? "" : "s"
                    } found.`
                  )
                }
                className="h-12 rounded-xl bg-blue-600 px-7 text-sm font-bold transition hover:bg-blue-500"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-[270px_1fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-slate-900/70 p-5 lg:sticky lg:top-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>

              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-blue-300 hover:text-blue-200"
              >
                Reset all
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <FilterSection title="Availability">
                <CheckFilter
                  label="Open now"
                  checked={openNowOnly}
                  onChange={setOpenNowOnly}
                />

                <CheckFilter
                  label="Verified workshops"
                  checked={verifiedOnly}
                  onChange={setVerifiedOnly}
                />

                <CheckFilter
                  label="Pickup and drop"
                  checked={pickupOnly}
                  onChange={setPickupOnly}
                />

                <CheckFilter
                  label="Doorstep service"
                  checked={doorstepOnly}
                  onChange={setDoorstepOnly}
                />
              </FilterSection>

              <FilterSection title="Vehicle type">
                <div className="flex flex-wrap gap-2">
                  {vehicleTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedVehicleType(type)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        selectedVehicleType === type
                          ? "border-blue-500 bg-blue-500/20 text-blue-200"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Service required">
                <select
                  value={selectedService}
                  onChange={(event) =>
                    setSelectedService(
                      event.target.value as "All" | WorkshopService
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  {serviceTypes.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </FilterSection>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex gap-3">
                  <span className="text-xl">🛡️</span>

                  <div>
                    <p className="text-sm font-semibold text-emerald-100">
                      Trust Protection
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/65">
                      My Vehicle Scores consider workshop verification, customer ratings, response time, booking completion, digital invoices and service quality.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-white">
                    {filteredWorkshops.length}
                  </span>{" "}
                  workshops
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  Recommended near you
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400">Sort:</label>

                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(event.target.value as SortOption)
                  }
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  {sortOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredWorkshops.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-900/50 px-6 py-16 text-center">
                <div className="text-5xl">🔎</div>

                <h3 className="mt-5 text-xl font-bold">
                  No workshops found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Try changing the service, vehicle type or availability
                  filters.
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {filteredWorkshops.map((workshop) => (
                  <WorkshopCard
                    key={workshop.id}
                    workshop={workshop}
                    compareSelected={compareIds.includes(workshop.id)}
                    onToggleCompare={() => toggleCompare(workshop.id)}
                    onView={() => setSelectedWorkshop(workshop)}
                    onBook={() => beginBooking(workshop)}
                    onCall={() => callWorkshop(workshop)}
                    onNavigate={() => openMaps(workshop)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {compareIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2">
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-blue-500/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur sm:flex-row">
            <div>
              <p className="font-semibold">
                {compareIds.length} workshop
                {compareIds.length === 1 ? "" : "s"} selected
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Select up to three workshops for comparison.
              </p>
            </div>

            <div className="flex w-full gap-3 sm:w-auto">
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/5 sm:flex-none"
              >
                Clear
              </button>

              <button
                type="button"
                disabled={compareIds.length < 2}
                onClick={() => setShowCompare(true)}
                className="flex-1 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                Compare Workshops
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWorkshop && (
        <WorkshopDetailsModal
          workshop={selectedWorkshop}
          onClose={() => setSelectedWorkshop(null)}
          onBook={() => beginBooking(selectedWorkshop)}
          onCall={() => callWorkshop(selectedWorkshop)}
          onNavigate={() => openMaps(selectedWorkshop)}
        />
      )}

      {showCompare && (
        <CompareModal
          workshops={comparedWorkshops}
          onClose={() => setShowCompare(false)}
          onSelect={(workshop) => {
            setShowCompare(false);
            setSelectedWorkshop(workshop);
          }}
        />
      )}
    </main>
  );
}

function WorkshopCard({
  workshop,
  compareSelected,
  onToggleCompare,
  onView,
  onBook,
  onCall,
  onNavigate,
}: {
  workshop: Workshop;
  compareSelected: boolean;
  onToggleCompare: () => void;
  onView: () => void;
  onBook: () => void;
  onCall: () => void;
  onNavigate: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-xl transition hover:border-blue-500/30">
      <div className="grid md:grid-cols-[240px_1fr]">
        <div className="relative min-h-52 overflow-hidden bg-slate-800">
          <img
            src={workshop.imageUrl}
            alt={workshop.name}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {workshop.verified && (
              <span className="rounded-full border border-blue-300/30 bg-blue-600/90 px-3 py-1.5 text-xs font-bold text-white">
                ✓ Verified
              </span>
            )}

            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                workshop.openNow
                  ? "border-emerald-300/30 bg-emerald-600/90 text-white"
                  : "border-red-300/30 bg-red-600/90 text-white"
              }`}
            >
              {workshop.openNow ? "Open Now" : "Closed"}
            </span>
          </div>

          <div className="absolute bottom-4 left-4">
            <p className="text-xs text-white/70">Starting from</p>
            <p className="mt-1 text-xl font-bold text-white">
              {formatPrice(workshop.estimatedPrice)}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold">{workshop.name}</h3>

                {workshop.discountPercent && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                    {workshop.discountPercent}% OFF
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-slate-400">
                📍 {workshop.address} • {workshop.distanceKm} km
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div>
                  <span className="text-sm text-amber-400">
                    {createStars(workshop.rating)}
                  </span>

                  <span className="ml-2 text-sm font-bold">
                    {workshop.rating}
                  </span>

                  <span className="ml-1 text-xs text-slate-500">
                    ({workshop.reviewCount.toLocaleString("en-IN")} reviews)
                  </span>
                </div>

                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  My Vehicle Score {workshop.myVehicleScore}
                </span>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={compareSelected}
                onChange={onToggleCompare}
                className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-blue-600"
              />
              Compare
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {workshop.services.slice(0, 5).map((service) => (
              <span
                key={service}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
              >
                {service}
              </span>
            ))}

            {workshop.services.length > 5 && (
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-blue-300">
                +{workshop.services.length - 5} more
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FeatureChip
              icon="🚗"
              label={
                workshop.pickupAvailable
                  ? "Pickup available"
                  : "No pickup"
              }
              enabled={workshop.pickupAvailable}
            />

            <FeatureChip
              icon="🏠"
              label={
                workshop.doorstepAvailable
                  ? "Doorstep service"
                  : "Workshop only"
              }
              enabled={workshop.doorstepAvailable}
            />

            <FeatureChip
              icon="🚨"
              label={
                workshop.emergencyAvailable
                  ? "Emergency support"
                  : "No emergency"
              }
              enabled={workshop.emergencyAvailable}
            />

            <FeatureChip
              icon="⏱️"
              label={
                workshop.liveQueueMinutes !== null
                  ? `${workshop.liveQueueMinutes} min queue`
                  : "Queue unavailable"
              }
              enabled={workshop.liveQueueMinutes !== null}
            />
          </div>

          <div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 xl:flex-row xl:items-center">
            <p className="text-xs text-slate-500">
              {workshop.openNow
                ? `Open until ${workshop.closingTime}`
                : `Opens next working day`}
            </p>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={onCall}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              >
                📞 Call
              </button>

              <button
                type="button"
                onClick={onNavigate}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5"
              >
                🧭 Navigate
              </button>

              <button
                type="button"
                onClick={onView}
                className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
              >
                View Details
              </button>

              <button
                type="button"
                onClick={onBook}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold transition hover:bg-blue-500"
              >
                Book Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function WorkshopDetailsModal({
  workshop,
  onClose,
  onBook,
  onCall,
  onNavigate,
}: {
  workshop: Workshop;
  onClose: () => void;
  onBook: () => void;
  onCall: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="relative h-64 overflow-hidden">
          <img
            src={workshop.imageUrl}
            alt={workshop.name}
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-black/20" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-2xl backdrop-blur transition hover:bg-black/80"
            aria-label="Close details"
          >
            ×
          </button>

          <div className="absolute bottom-5 left-5 right-5">
            <div className="flex flex-wrap gap-2">
              {workshop.verified && (
                <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold">
                  ✓ My Vehicle Verified
                </span>
              )}

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  workshop.openNow ? "bg-emerald-600" : "bg-red-600"
                }`}
              >
                {workshop.openNow ? "Open Now" : "Closed"}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              {workshop.name}
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              {workshop.address} • {workshop.distanceKm} km away
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <ModalStat
              label="Customer Rating"
              value={`${workshop.rating}/5`}
              helper={`${workshop.reviewCount.toLocaleString(
                "en-IN"
              )} reviews`}
            />

            <ModalStat
              label="My Vehicle Score"
              value={`${workshop.myVehicleScore}/100`}
              helper="Ratings, verification and service quality"
            />

            <ModalStat
              label="Starting Price"
              value={formatPrice(workshop.estimatedPrice)}
              helper="Final estimate after inspection"
            />

            <ModalStat
              label="Live Queue"
              value={
                workshop.liveQueueMinutes !== null
                  ? `${workshop.liveQueueMinutes} min`
                  : "Unavailable"
              }
              helper={`Closes at ${workshop.closingTime}`}
            />
          </div>

          <div className="mt-7 grid gap-7 lg:grid-cols-2">
            <section>
              <h3 className="text-lg font-bold">Services available</h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {workshop.services.map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-200"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold">Brands supported</h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {workshop.brands.map((brand) => (
                  <span
                    key={brand}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold">Workshop highlights</h3>

              <div className="mt-4 space-y-3">
                {workshop.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3"
                  >
                    <span className="text-emerald-400">✓</span>
                    <span className="text-sm text-slate-300">
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold">Convenience options</h3>

              <div className="mt-4 space-y-3">
                <ConvenienceRow
                  icon="🚗"
                  title="Pickup and drop"
                  available={workshop.pickupAvailable}
                />

                <ConvenienceRow
                  icon="🏠"
                  title="Doorstep service"
                  available={workshop.doorstepAvailable}
                />

                <ConvenienceRow
                  icon="🚨"
                  title="Emergency assistance"
                  available={workshop.emergencyAvailable}
                />

                <ConvenienceRow
                  icon="🧾"
                  title="Digital estimate and invoice"
                  available
                />
              </div>
            </section>
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <div className="flex gap-3">
              <span className="text-2xl">🛡️</span>

              <div>
                <p className="font-semibold text-emerald-100">
                  My Vehicle Service Protection
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                  Service bookings will include transparent estimates,
                  customer approval, digital invoices, repair evidence and
                  workshop accountability.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={onCall}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/5"
            >
              📞 Call
            </button>

            <button
              type="button"
              onClick={onNavigate}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/5"
            >
              🧭 Navigate
            </button>

            <button
              type="button"
              onClick={onBook}
              className="col-span-2 rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold transition hover:bg-blue-500 sm:col-span-1"
            >
              Book Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareModal({
  workshops,
  onClose,
  onSelect,
}: {
  workshops: Workshop[];
  onClose: () => void;
  onSelect: (workshop: Workshop) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-300">
              Workshop Comparison
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              Compare selected workshops
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-2xl transition hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workshops.map((workshop) => (
            <div
              key={workshop.id}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
            >
              <div className="h-36 overflow-hidden rounded-xl">
                <img
                  src={workshop.imageUrl}
                  alt={workshop.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <h3 className="mt-4 text-lg font-bold">{workshop.name}</h3>

              <p className="mt-1 text-xs text-slate-400">
                {workshop.distanceKm} km • {workshop.area}
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <ComparisonRow
                  label="Rating"
                  value={`${workshop.rating}/5`}
                />

                <ComparisonRow
                  label="My Vehicle Score"
                  value={`${workshop.myVehicleScore}/100`}
                />

                <ComparisonRow
                  label="Starting Price"
                  value={formatPrice(workshop.estimatedPrice)}
                />

                <ComparisonRow
                  label="Pickup"
                  value={workshop.pickupAvailable ? "Available" : "No"}
                />

                <ComparisonRow
                  label="Doorstep"
                  value={workshop.doorstepAvailable ? "Available" : "No"}
                />

                <ComparisonRow
                  label="Emergency"
                  value={workshop.emergencyAvailable ? "Available" : "No"}
                />
              </div>

              <button
                type="button"
                onClick={() => onSelect(workshop)}
                className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500"
              >
                Select Workshop
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">
        {title}
      </h3>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CheckFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-slate-400">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
    </label>
  );
}

function FeatureChip({
  icon,
  label,
  enabled,
}: {
  icon: string;
  label: string;
  enabled: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-xs ${
        enabled
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/[0.03] text-slate-500"
      }`}
    >
      <span className="mr-1.5">{icon}</span>
      {label}
    </div>
  );
}

function ModalStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function ConvenienceRow({
  icon,
  title,
  available,
}: {
  icon: string;
  title: string;
  available: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <div className="flex items-center gap-3">
        <span>{icon}</span>
        <span className="text-sm text-slate-300">{title}</span>
      </div>

      <span
        className={`text-xs font-semibold ${
          available ? "text-emerald-400" : "text-slate-500"
        }`}
      >
        {available ? "Available" : "Unavailable"}
      </span>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-200">
        {value}
      </span>
    </div>
  );
}