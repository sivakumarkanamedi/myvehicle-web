"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FuelType = "petrol" | "diesel" | "cng" | "ev";

type FuelStop = {
  id: number;
  name: string;
  fuelType: FuelType;
  distanceKm: number;
  pricePerUnit: number;
  unitLabel: string;
  queueMinutes: number;
  openNow: boolean;
  rating: number;
  onRoute: boolean;
  detourMinutes: number;
  phone?: string;
  fastCharging?: boolean;
  availableConnectors?: number;
};

const fuelStops: FuelStop[] = [
  {
    id: 1,
    name: "IndianOil Highway Station",
    fuelType: "petrol",
    distanceKm: 2.4,
    pricePerUnit: 102.8,
    unitLabel: "L",
    queueMinutes: 5,
    openNow: true,
    rating: 4.5,
    onRoute: true,
    detourMinutes: 4,
    phone: "+91 80 4000 1001",
  },
  {
    id: 2,
    name: "BPCL Smart Fuel",
    fuelType: "diesel",
    distanceKm: 3.1,
    pricePerUnit: 88.9,
    unitLabel: "L",
    queueMinutes: 8,
    openNow: true,
    rating: 4.3,
    onRoute: true,
    detourMinutes: 6,
    phone: "+91 80 4000 1002",
  },
  {
    id: 3,
    name: "City CNG Hub",
    fuelType: "cng",
    distanceKm: 4.6,
    pricePerUnit: 84.5,
    unitLabel: "kg",
    queueMinutes: 14,
    openNow: true,
    rating: 4.1,
    onRoute: false,
    detourMinutes: 12,
    phone: "+91 80 4000 1003",
  },
  {
    id: 4,
    name: "ChargeGrid Fast EV",
    fuelType: "ev",
    distanceKm: 5.2,
    pricePerUnit: 18,
    unitLabel: "kWh",
    queueMinutes: 6,
    openNow: true,
    rating: 4.7,
    onRoute: true,
    fastCharging: true,
    availableConnectors: 5,
    detourMinutes: 8,
    phone: "+91 80 4000 1004",
  },
];

export default function FuelAssistantPage() {
  const router = useRouter();

  const [fuelType, setFuelType] = useState<FuelType>("petrol");
  const [fuelLevelPercent, setFuelLevelPercent] = useState(28);
  const [vehicleRangeKm, setVehicleRangeKm] = useState(92);
  const [onlyOnRoute, setOnlyOnRoute] = useState(true);
  const [openNowOnly, setOpenNowOnly] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState(1);
  const [liveProviderConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [miraQuestion, setMiraQuestion] = useState("");
  const [miraReply, setMiraReply] = useState(
    "I can compare distance, price, queue time and route detour. Live prices and charger availability require provider integrations."
  );

  const filteredStops = useMemo(
    () =>
      fuelStops.filter((stop) => {
        if (stop.fuelType !== fuelType) return false;
        if (onlyOnRoute && !stop.onRoute) return false;
        if (openNowOnly && !stop.openNow) return false;
        return true;
      }),
    [fuelType, onlyOnRoute, openNowOnly]
  );

  const selectedStop = useMemo(
    () =>
      filteredStops.find((stop) => stop.id === selectedStopId) ??
      filteredStops[0] ??
      null,
    [filteredStops, selectedStopId]
  );

  const bestStop = useMemo(
    () =>
      [...filteredStops].sort((first, second) => {
        const firstScore =
          first.distanceKm * 10 +
          first.queueMinutes * 2 +
          first.detourMinutes * 3 +
          first.pricePerUnit -
          first.rating * 5;

        const secondScore =
          second.distanceKm * 10 +
          second.queueMinutes * 2 +
          second.detourMinutes * 3 +
          second.pricePerUnit -
          second.rating * 5;

        return firstScore - secondScore;
      })[0] ?? null,
    [filteredStops]
  );

  const shouldRefuelSoon =
    fuelLevelPercent <= 30 || vehicleRangeKm <= 100;

  const emergencyFuelRisk =
    fuelLevelPercent <= 8 || vehicleRangeKm <= 20;

  function navigateToStop() {
    if (!selectedStop) return;

    const mapsUrl =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(selectedStop.name);

    window.open(
      mapsUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function callStation() {
    if (!selectedStop?.phone) {
      setStatusMessage(
        "Station phone number is not available."
      );
      return;
    }

    window.location.href =
      `tel:${selectedStop.phone}`;
  }

  function addStopToRoute() {
    if (!selectedStop) return;

    setStatusMessage(
      `${selectedStop.name} added to the local route preview.`
    );
  }

  function requestEmergencyFuelHelp() {
    setStatusMessage(
      "Emergency fuel-help request prepared. Partner dispatch still requires a connected assistance network."
    );
    router.push("/mira");
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
        bestStop
          ? `${bestStop.name} is currently the best preview option based on distance, queue, detour, rating and price.`
          : "No matching stop is available with the current filters."
      );
    } else if (
      question.includes("range") ||
      question.includes("enough")
    ) {
      setMiraReply(
        emergencyFuelRisk
          ? `Your estimated range is only ${vehicleRangeKm} km. Stop safely and refuel or recharge as soon as possible.`
          : shouldRefuelSoon
            ? `Your estimated range is ${vehicleRangeKm} km. Mira recommends planning a stop soon.`
            : `Your estimated range is ${vehicleRangeKm} km, which appears sufficient for the current preview journey.`
      );
    } else if (
      question.includes("price")
    ) {
      setMiraReply(
        selectedStop
          ? `${selectedStop.name} is shown at ₹${selectedStop.pricePerUnit}/${selectedStop.unitLabel} in demo data. Verify live pricing before travel.`
          : "Select a station to compare price details."
      );
    } else if (
      question.includes("queue") ||
      question.includes("wait")
    ) {
      setMiraReply(
        selectedStop
          ? `${selectedStop.name} currently shows an estimated ${selectedStop.queueMinutes}-minute queue in demo data.`
          : "Select a station to view its estimated queue."
      );
    } else {
      setMiraReply(
        selectedStop
          ? `${selectedStop.name} is ${selectedStop.distanceKm.toFixed(
              1
            )} km away with an estimated ${selectedStop.detourMinutes}-minute detour.`
          : "Select a station and ask me about distance, price, queue or route impact."
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Fuel & Charging Assistant
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Mira estimates remaining range, recommends the best fuel or charging
            stop, and compares distance, queue time, rating, and price.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Range Awareness"
            description="Warns when fuel or battery range may not safely cover the journey."
          />
          <FeatureCard
            title="Stop Comparison"
            description="Compares distance, price, queue, rating and estimated route detour."
          />
          <FeatureCard
            title="Emergency Fuel Support"
            description="Prepares assistance when the vehicle may not reach a verified stop."
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
                setMiraQuestion(event.target.value)
              }
              placeholder="Ask about range, price, queue or the best stop..."
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
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          {liveProviderConnected
            ? "Live fuel and charging data is connected."
            : "This page currently uses demo prices, queues and availability. Live data requires fuel-price, EV-network and station-partner integrations."}
        </section>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Energy Type"
            value={formatLabel(fuelType)}
          />
          <Metric
            label="Level"
            value={`${fuelLevelPercent}%`}
          />
          <Metric
            label="Estimated Range"
            value={`${vehicleRangeKm} km`}
          />
          <Metric
            label="Matching Stops"
            value={String(filteredStops.length)}
          />
          <Metric
            label="Best Detour"
            value={
              bestStop
                ? `${bestStop.detourMinutes} min`
                : "Unavailable"
            }
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Vehicle energy status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Adjust values to preview Mira&apos;s recommendation.
              </p>
            </div>

            <SelectField
              label="Fuel or energy type"
              value={fuelType}
              options={[
                ["petrol", "Petrol"],
                ["diesel", "Diesel"],
                ["cng", "CNG"],
                ["ev", "Electric"],
              ]}
              onChange={(value) => {
                setFuelType(value as FuelType);
                setSelectedStopId(0);
              }}
            />

            <RangeField
              label="Fuel / battery level"
              value={fuelLevelPercent}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={setFuelLevelPercent}
            />

            <RangeField
              label="Estimated range"
              value={vehicleRangeKm}
              min={0}
              max={600}
              step={5}
              suffix=" km"
              onChange={setVehicleRangeKm}
            />

            <ToggleField
              label="Show stops on my route"
              checked={onlyOnRoute}
              onChange={setOnlyOnRoute}
            />

            <ToggleField
              label="Open now only"
              checked={openNowOnly}
              onChange={setOpenNowOnly}
            />

            <div
              className={
                shouldRefuelSoon
                  ? "rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"
                  : "rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Mira recommendation
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-200">
                {shouldRefuelSoon
                  ? bestStop
                    ? `Refuel or recharge soon. ${bestStop.name} is the best option on your route.`
                    : "Refuel or recharge soon. No matching stop is available with the selected filters."
                  : "Your current range is sufficient for this journey."}
              </p>
            </div>

            {emergencyFuelRisk ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
                  Critical fuel warning
                </p>

                <p className="mt-2 text-sm leading-6 text-rose-50/90">
                  Remaining fuel or battery range is critically low.
                  Stop safely and arrange assistance if you cannot reach
                  a verified station.
                </p>

                <button
                  type="button"
                  onClick={requestEmergencyFuelHelp}
                  className="mt-4 w-full rounded-2xl bg-rose-500 px-5 py-3 text-sm font-bold text-white"
                >
                  Request Emergency Fuel Help
                </button>
              </div>
            ) : null}
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Recommended stops
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Compare nearby fuel and charging locations.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {filteredStops.length ? (
                filteredStops.map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => setSelectedStopId(stop.id)}
                    className={
                      selectedStop?.id === stop.id
                        ? "rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5 text-left"
                        : "rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-amber-400/30"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">
                          {stop.name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {stop.distanceKm.toFixed(1)} km away
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                        Open
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SmallDetail
                        label="Price"
                        value={`₹${stop.pricePerUnit}/${stop.unitLabel}`}
                      />

                      <SmallDetail
                        label="Queue"
                        value={`${stop.queueMinutes} min`}
                      />

                      <SmallDetail
                        label="Rating"
                        value={`★ ${stop.rating.toFixed(1)}`}
                      />

                      <SmallDetail
                        label="Detour"
                        value={`${stop.detourMinutes} min`}
                      />

                      <SmallDetail
                        label="On route"
                        value={stop.onRoute ? "Yes" : "No"}
                      />
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                  No matching fuel or charging stops found.
                </div>
              )}
            </div>
          </section>
        </section>

        {selectedStop ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Selected stop
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {selectedStop.name}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {selectedStop.distanceKm.toFixed(1)} km away ·{" "}
                  {selectedStop.queueMinutes} min estimated queue
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                {formatLabel(selectedStop.fuelType)}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="Price"
                value={`₹${selectedStop.pricePerUnit}/${selectedStop.unitLabel}`}
              />

              <Metric
                label="Distance"
                value={`${selectedStop.distanceKm.toFixed(1)} km`}
              />

              <Metric
                label="Queue"
                value={`${selectedStop.queueMinutes} min`}
              />

              <Metric
                label="Rating"
                value={`★ ${selectedStop.rating.toFixed(1)}`}
              />

              <Metric
                label="Detour"
                value={`${selectedStop.detourMinutes} min`}
              />

              <Metric
                label={
                  selectedStop.fuelType === "ev"
                    ? "Connectors"
                    : "On route"
                }
                value={
                  selectedStop.fuelType === "ev"
                    ? String(selectedStop.availableConnectors ?? 0)
                    : selectedStop.onRoute
                      ? "Yes"
                      : "No"
                }
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={navigateToStop}
                className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950"
              >
                Navigate
              </button>

              <button
                type="button"
                onClick={callStation}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
              >
                Call Station
              </button>

              <button
                type="button"
                onClick={addStopToRoute}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
              >
                Add to Route
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this screen currently uses demo
          price, availability and queue information. Live data requires fuel
          pricing, EV-network and station-partner integrations.
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

function SelectField(props: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <select
        value={props.value}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {props.label}
        </span>

        <span className="text-sm font-semibold text-slate-300">
          {props.value}
          {props.suffix}
        </span>
      </div>

      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) =>
          props.onChange(Number(event.target.value))
        }
        className="w-full"
      />
    </label>
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

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}