"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Prediction = {
  time: string;
  trafficLevel: "light" | "moderate" | "heavy" | "severe";
  travelMinutes: number;
  delayMinutes: number;
  confidence: number;
};

const predictions: Prediction[] = [
  {
    time: "07:30",
    trafficLevel: "light",
    travelMinutes: 34,
    delayMinutes: 3,
    confidence: 91,
  },
  {
    time: "08:00",
    trafficLevel: "moderate",
    travelMinutes: 42,
    delayMinutes: 11,
    confidence: 94,
  },
  {
    time: "08:30",
    trafficLevel: "heavy",
    travelMinutes: 56,
    delayMinutes: 24,
    confidence: 93,
  },
  {
    time: "09:00",
    trafficLevel: "severe",
    travelMinutes: 64,
    delayMinutes: 31,
    confidence: 90,
  },
  {
    time: "09:30",
    trafficLevel: "heavy",
    travelMinutes: 52,
    delayMinutes: 20,
    confidence: 88,
  },
  {
    time: "10:00",
    trafficLevel: "moderate",
    travelMinutes: 41,
    delayMinutes: 9,
    confidence: 86,
  },
];

export default function PredictiveNavigationPage() {
  const [origin, setOrigin] = useState("Yeshwanthpur");
  const [destination, setDestination] = useState("Marathahalli");
  const [selectedTime, setSelectedTime] = useState("08:30");
  const [vehicleType, setVehicleType] = useState("car");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);

  const selectedPrediction = useMemo(
    () =>
      predictions.find(
        (prediction) => prediction.time === selectedTime
      ) ?? predictions[0],
    [selectedTime]
  );

  const bestPrediction = useMemo(
    () =>
      [...predictions].sort(
        (first, second) =>
          first.travelMinutes - second.travelMinutes
      )[0],
    []
  );

  const timeSaved =
    selectedPrediction.travelMinutes -
    bestPrediction.travelMinutes;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Predictive Navigation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Mira predicts congestion before departure and recommends the best
            time and route to reduce delays.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Plan prediction
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter your journey preferences.
              </p>
            </div>

            <Field
              label="Origin"
              value={origin}
              onChange={setOrigin}
            />

            <Field
              label="Destination"
              value={destination}
              onChange={setDestination}
            />

            <SelectField
              label="Departure time"
              value={selectedTime}
              options={predictions.map((item) => [
                item.time,
                item.time,
              ])}
              onChange={setSelectedTime}
            />

            <SelectField
              label="Vehicle type"
              value={vehicleType}
              options={[
                ["car", "Car"],
                ["two_wheeler", "Two Wheeler"],
              ]}
              onChange={setVehicleType}
            />

            <ToggleField
              label="Avoid tolls"
              checked={avoidTolls}
              onChange={setAvoidTolls}
            />

            <ToggleField
              label="Avoid highways"
              checked={avoidHighways}
              onChange={setAvoidHighways}
            />

            <button
              type="button"
              className="w-full rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950"
            >
              Recalculate Prediction
            </button>
          </aside>

          <section className="space-y-6">
            <article className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Mira recommendation
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Leave at {bestPrediction.time}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                This is the fastest predicted departure window for your route
                from {origin} to {destination}.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Metric
                  label="Travel time"
                  value={`${bestPrediction.travelMinutes} min`}
                />

                <Metric
                  label="Expected delay"
                  value={`${bestPrediction.delayMinutes} min`}
                />

                <Metric
                  label="Confidence"
                  value={`${bestPrediction.confidence}%`}
                />
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Departure comparison
              </h2>

              <div className="mt-5 space-y-3">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.time}
                    type="button"
                    onClick={() =>
                      setSelectedTime(prediction.time)
                    }
                    className={
                      selectedTime === prediction.time
                        ? "w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-4 text-left"
                        : "w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left"
                    }
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-bold">
                          {prediction.time}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {prediction.travelMinutes} min total ·{" "}
                          {prediction.delayMinutes} min delay
                        </p>
                      </div>

                      <TrafficBadge
                        level={prediction.trafficLevel}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </section>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Selected departure analysis
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Departure"
              value={selectedPrediction.time}
            />

            <Metric
              label="Traffic"
              value={formatLabel(
                selectedPrediction.trafficLevel
              )}
            />

            <Metric
              label="Travel time"
              value={`${selectedPrediction.travelMinutes} min`}
            />

            <Metric
              label="Time saved by Mira"
              value={`${Math.max(0, timeSaved)} min`}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this screen currently uses demo
          prediction data. Live predictions will later come from the Routes API,
          historical journey data, current traffic and Mira&apos;s prediction
          engine.
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

function Field(props: {
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
        type="text"
        value={props.value}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
      />
    </label>
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

function TrafficBadge(props: {
  level: Prediction["trafficLevel"];
}) {
  const classes =
    props.level === "severe"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : props.level === "heavy"
        ? "border-orange-400/30 bg-orange-400/10 text-orange-200"
        : props.level === "moderate"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.level)}
    </span>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}