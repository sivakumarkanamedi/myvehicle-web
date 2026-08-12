"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ParkingType =
  | "street"
  | "mall"
  | "basement"
  | "airport"
  | "valet"
  | "ev";

type ParkingSpot = {
  id: number;
  name: string;
  parkingType: ParkingType;
  distanceKm: number;
  availableSpots: number;
  totalSpots: number;
  hourlyRate: number;
  openNow: boolean;
  evCharging: boolean;
  covered: boolean;
  rating: number;
  address: string;
  walkingMinutes: number;
  detourMinutes: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
};

const parkingSpots: ParkingSpot[] = [
  {
    id: 1,
    name: "Orion Mall Parking",
    parkingType: "mall",
    distanceKm: 1.2,
    availableSpots: 84,
    totalSpots: 420,
    hourlyRate: 40,
    openNow: true,
    evCharging: true,
    covered: true,
    rating: 4.5,
    address: "Dr Rajkumar Road, Bengaluru",
    walkingMinutes: 4,
    detourMinutes: 3,
    coordinates: {
      latitude: 13.0116,
      longitude: 77.5553,
    },
  },
  {
    id: 2,
    name: "Metro Station Parking",
    parkingType: "street",
    distanceKm: 2.1,
    availableSpots: 18,
    totalSpots: 90,
    hourlyRate: 20,
    openNow: true,
    evCharging: false,
    covered: false,
    rating: 4.1,
    address: "Yeshwanthpur Metro, Bengaluru",
    walkingMinutes: 7,
    detourMinutes: 5,
    coordinates: {
      latitude: 13.0237,
      longitude: 77.5501,
    },
  },
  {
    id: 3,
    name: "World Trade Center Basement",
    parkingType: "basement",
    distanceKm: 2.8,
    availableSpots: 32,
    totalSpots: 180,
    hourlyRate: 60,
    openNow: true,
    evCharging: true,
    covered: true,
    rating: 4.7,
    address: "Brigade Gateway, Bengaluru",
    walkingMinutes: 3,
    detourMinutes: 6,
    coordinates: {
      latitude: 13.0122,
      longitude: 77.5557,
    },
  },
  {
    id: 4,
    name: "Premium Valet Parking",
    parkingType: "valet",
    distanceKm: 3.4,
    availableSpots: 11,
    totalSpots: 40,
    hourlyRate: 120,
    openNow: false,
    evCharging: false,
    covered: true,
    rating: 4.3,
    address: "Sankey Road, Bengaluru",
    walkingMinutes: 2,
    detourMinutes: 9,
    coordinates: {
      latitude: 13.0067,
      longitude: 77.5762,
    },
  },
];

export default function SmartParkingPage() {
  const router = useRouter();

  const [selectedParkingId, setSelectedParkingId] =
    useState(1);

  const [onlyAvailable, setOnlyAvailable] =
    useState(true);

  const [evRequired, setEvRequired] =
    useState(false);

  const [coveredOnly, setCoveredOnly] =
    useState(false);

  const [maxHourlyRate, setMaxHourlyRate] =
    useState(150);

  const [liveProviderConnected] =
    useState(false);

  const [savedParking, setSavedParking] =
    useState<{
      name: string;
      address: string;
      savedAt: string;
      floor: string;
      zone: string;
      pillar: string;
      slot: string;
    } | null>(null);

  const [floor, setFloor] = useState("B2");
  const [zone, setZone] = useState("C");
  const [pillar, setPillar] = useState("C-18");
  const [slot, setSlot] = useState("C-184");

  const [statusMessage, setStatusMessage] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can compare parking distance, price, walking time, availability and EV charging. Live availability requires a parking-provider integration."
    );

  const selectedParking = useMemo(
    () =>
      parkingSpots.find(
        (spot) => spot.id === selectedParkingId
      ) ?? parkingSpots[0],
    [selectedParkingId]
  );

  const filteredParking = useMemo(
    () =>
      parkingSpots.filter((spot) => {
        if (onlyAvailable && spot.availableSpots <= 0) {
          return false;
        }

        if (evRequired && !spot.evCharging) {
          return false;
        }

        if (coveredOnly && !spot.covered) {
          return false;
        }

        if (spot.hourlyRate > maxHourlyRate) {
          return false;
        }

        return true;
      }),
    [
      onlyAvailable,
      evRequired,
      coveredOnly,
      maxHourlyRate,
    ]
  );

  const bestParking = useMemo(
    () =>
      [...filteredParking].sort(
        (first, second) => {
          const firstScore =
            first.distanceKm * 10 +
            first.detourMinutes * 3 +
            first.walkingMinutes * 2 +
            first.hourlyRate -
            first.availableSpots * 0.2 -
            first.rating * 5;

          const secondScore =
            second.distanceKm * 10 +
            second.detourMinutes * 3 +
            second.walkingMinutes * 2 +
            second.hourlyRate -
            second.availableSpots * 0.2 -
            second.rating * 5;

          return firstScore - secondScore;
        }
      )[0] ?? null,
    [filteredParking]
  );

  const occupancyPercent =
    ((selectedParking.totalSpots -
      selectedParking.availableSpots) /
      selectedParking.totalSpots) *
    100;

  function navigateToParking() {
    const url = new URL(
      "https://www.google.com/maps/dir/"
    );

    url.searchParams.set("api", "1");
    url.searchParams.set(
      "destination",
      `${selectedParking.coordinates.latitude},${selectedParking.coordinates.longitude}`
    );
    url.searchParams.set(
      "travelmode",
      "driving"
    );

    window.open(
      url.toString(),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function reserveSpot() {
    setStatusMessage(
      "Reservation request prepared. A confirmed booking requires parking-operator integration."
    );
  }

  function saveParkingLocation() {
    setSavedParking({
      name: selectedParking.name,
      address: selectedParking.address,
      savedAt: new Date().toISOString(),
      floor: floor.trim() || "Not entered",
      zone: zone.trim() || "Not entered",
      pillar: pillar.trim() || "Not entered",
      slot: slot.trim() || "Not entered",
    });

    setStatusMessage(
      "Parking location saved in this session."
    );
  }

  function navigateBackToVehicle() {
    if (!savedParking) {
      setStatusMessage(
        "Save a parking location first."
      );
      return;
    }

    const url =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(
        `${savedParking.name}, ${savedParking.address}`
      );

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion.trim().toLowerCase();

    if (!question) return;

    if (
      question.includes("best") ||
      question.includes("recommend")
    ) {
      setMiraReply(
        bestParking
          ? `${bestParking.name} is currently the best preview option based on distance, price, walking time, detour, rating and availability.`
          : "No parking option matches the current filters."
      );
    } else if (
      question.includes("ev") ||
      question.includes("charging")
    ) {
      const evOptions =
        filteredParking.filter(
          (spot) => spot.evCharging
        );

      setMiraReply(
        evOptions.length > 0
          ? `${evOptions.length} matching parking option${
              evOptions.length === 1 ? "" : "s"
            } include EV charging.`
          : "No matching parking option currently includes EV charging."
      );
    } else if (
      question.includes("cheap") ||
      question.includes("price")
    ) {
      const cheapest =
        [...filteredParking].sort(
          (first, second) =>
            first.hourlyRate -
            second.hourlyRate
        )[0];

      setMiraReply(
        cheapest
          ? `${cheapest.name} is the lowest-priced matching option at ₹${cheapest.hourlyRate} per hour in demo data.`
          : "No matching parking option is available."
      );
    } else if (
      question.includes("walk")
    ) {
      setMiraReply(
        `${selectedParking.name} is estimated to be about ${selectedParking.walkingMinutes} minutes on foot from the destination.`
      );
    } else if (
      question.includes("remember") ||
      question.includes("where parked")
    ) {
      setMiraReply(
        savedParking
          ? `You saved ${savedParking.name}, floor ${savedParking.floor}, zone ${savedParking.zone}, pillar ${savedParking.pillar}, slot ${savedParking.slot}.`
          : "No parking location has been saved in this session."
      );
    } else {
      setMiraReply(
        `${selectedParking.name} is ${selectedParking.distanceKm.toFixed(
          1
        )} km away, costs ₹${selectedParking.hourlyRate} per hour and shows ${selectedParking.availableSpots} available spaces in demo data.`
      );
    }

    setMiraQuestion("");
  }

  function openCoDriver() {
    router.push(
      "/navigation/codriver"
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Smart Parking AI
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Find nearby parking, compare availability and price, and let Mira
            recommend the best option near your destination.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Parking Comparison"
            description="Compares distance, walking time, price, availability and route detour."
          />

          <FeatureCard
            title="Parking Memory"
            description="Stores floor, zone, pillar and slot details so Mira can guide you back."
          />

          <FeatureCard
            title="EV & Covered Filters"
            description="Finds parking that matches charging and weather-protection needs."
          />
        </section>

        <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            Ask Mira
          </p>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
            {miraReply}
          </p>

          <form
            onSubmit={askMira}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={miraQuestion}
              onChange={(event) =>
                setMiraQuestion(
                  event.target.value
                )
              }
              placeholder="Ask about price, walking time, EV charging or where you parked..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
            />

            <button
              type="submit"
              disabled={!miraQuestion.trim()}
              className="rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              Ask Mira
            </button>
          </form>

          <button
            type="button"
            onClick={openCoDriver}
            className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-fuchsia-100"
          >
            Open Mira Co-Driver
          </button>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          {liveProviderConnected
            ? "Live parking availability is connected."
            : "This page currently uses demo availability and pricing. Real-time spaces and reservations require parking-operator, municipality or property-partner integrations."}
        </section>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Matching Parking"
            value={String(filteredParking.length)}
          />
          <Metric
            label="Best Distance"
            value={
              bestParking
                ? `${bestParking.distanceKm.toFixed(1)} km`
                : "Unavailable"
            }
          />
          <Metric
            label="Best Walking Time"
            value={
              bestParking
                ? `${bestParking.walkingMinutes} min`
                : "Unavailable"
            }
          />
          <Metric
            label="Lowest Rate"
            value={
              filteredParking.length
                ? `₹${Math.min(
                    ...filteredParking.map(
                      (spot) => spot.hourlyRate
                    )
                  )}/hr`
                : "Unavailable"
            }
          />
          <Metric
            label="EV Options"
            value={String(
              filteredParking.filter(
                (spot) => spot.evCharging
              ).length
            )}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Parking preferences
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Filter parking options based on your needs.
              </p>
            </div>

            <ToggleField
              label="Show available parking only"
              checked={onlyAvailable}
              onChange={setOnlyAvailable}
            />

            <ToggleField
              label="EV charging required"
              checked={evRequired}
              onChange={setEvRequired}
            />

            <ToggleField
              label="Covered parking only"
              checked={coveredOnly}
              onChange={setCoveredOnly}
            />

            <label className="block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Maximum hourly rate
                </span>

                <span className="text-sm font-semibold text-slate-300">
                  ₹{maxHourlyRate}
                </span>
              </div>

              <input
                type="range"
                min={20}
                max={200}
                step={10}
                value={maxHourlyRate}
                onChange={(event) =>
                  setMaxHourlyRate(
                    Number(event.target.value)
                  )
                }
                className="w-full"
              />
            </label>

            {bestParking ? (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Mira recommendation
                </p>

                <h3 className="mt-2 text-lg font-bold">
                  {bestParking.name}
                </h3>

                <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                  Best balance of distance, availability, rating and price.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
                No parking matches the selected filters.
              </div>
            )}
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Nearby parking
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select a parking location to view details.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {filteredParking.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() =>
                    setSelectedParkingId(spot.id)
                  }
                  className={
                    selectedParkingId === spot.id
                      ? "rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-5 text-left"
                      : "rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-emerald-400/30"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">
                        {spot.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {spot.distanceKm.toFixed(1)} km away
                      </p>
                    </div>

                    <AvailabilityBadge
                      available={spot.availableSpots}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SmallDetail
                      label="Rate"
                      value={`₹${spot.hourlyRate}/hr`}
                    />

                    <SmallDetail
                      label="Rating"
                      value={`★ ${spot.rating.toFixed(1)}`}
                    />

                    <SmallDetail
                      label="Walking"
                      value={`${spot.walkingMinutes} min`}
                    />

                    <SmallDetail
                      label="Detour"
                      value={`${spot.detourMinutes} min`}
                    />

                    <SmallDetail
                      label="Covered"
                      value={spot.covered ? "Yes" : "No"}
                    />

                    <SmallDetail
                      label="EV charging"
                      value={spot.evCharging ? "Available" : "No"}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Selected parking
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {selectedParking.name}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {selectedParking.address}
                </p>
              </div>

              <AvailabilityBadge
                available={selectedParking.availableSpots}
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="Available"
                value={`${selectedParking.availableSpots} spots`}
              />

              <Metric
                label="Occupancy"
                value={`${occupancyPercent.toFixed(0)}%`}
              />

              <Metric
                label="Hourly rate"
                value={`₹${selectedParking.hourlyRate}`}
              />

              <Metric
                label="Distance"
                value={`${selectedParking.distanceKm.toFixed(1)} km`}
              />

              <Metric
                label="Walking"
                value={`${selectedParking.walkingMinutes} min`}
              />

              <Metric
                label="Detour"
                value={`${selectedParking.detourMinutes} min`}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={navigateToParking}
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950"
              >
                Navigate
              </button>

              <button
                type="button"
                onClick={reserveSpot}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
              >
                Reserve Spot
              </button>

              <button
                type="button"
                onClick={saveParkingLocation}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
              >
                Save Parking
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Parking memory
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Mira can remember where you parked and guide you back later.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MemoryField
                label="Floor"
                value={floor}
                onChange={setFloor}
              />

              <MemoryField
                label="Zone"
                value={zone}
                onChange={setZone}
              />

              <MemoryField
                label="Pillar"
                value={pillar}
                onChange={setPillar}
              />

              <MemoryField
                label="Slot"
                value={slot}
                onChange={setSlot}
              />
            </div>

            {savedParking ? (
              <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                Saved: {savedParking.name}, floor {savedParking.floor},
                zone {savedParking.zone}, pillar {savedParking.pillar},
                slot {savedParking.slot}.
              </div>
            ) : null}

            <button
              type="button"
              onClick={navigateBackToVehicle}
              disabled={!savedParking}
              className="mt-5 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-40"
            >
              Navigate Back to Vehicle
            </button>
          </article>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this screen currently uses demo
          availability and pricing data. Real-time parking requires integrations
          with parking operators, municipalities or property partners.
        </section>

        <Link
          href="/navigation"
          className="inline-block pb-4 text-sm font-semibold text-cyan-300 hover:underline"
        >
          ← Back to Navigation
        </Link>
      </div>
    </main>
  );
}

function MemoryField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <input
        value={props.value}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}

function FeatureCard(props: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
      <h3 className="text-xl font-bold">
        {props.title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {props.description}
      </p>
    </article>
  );
}

function AvailabilityBadge(props: {
  available: number;
}) {
  const classes =
    props.available > 30
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.available > 10
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-rose-400/30 bg-rose-400/10 text-rose-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {props.available} available
    </span>
  );
}

function Metric(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </div>
  );
}

function SmallDetail(props: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-300">
        {props.value}
      </p>
    </div>
  );
}

function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">
        {props.label}
      </span>

      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) =>
          props.onChange(event.target.checked)
        }
        className="h-5 w-5"
      />
    </label>
  );
}