"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SignalStatus = "red" | "amber" | "green" | "unknown";

type TrafficSignal = {
  id: number;
  name: string;
  distanceMeters: number;
  status: SignalStatus;
  secondsRemaining: number | null;
  latitude: number;
  longitude: number;
};

const demoSignals: TrafficSignal[] = [
  {
    id: 1,
    name: "Yeshwanthpur Circle",
    distanceMeters: 350,
    status: "red",
    secondsRemaining: 42,
    latitude: 13.0285,
    longitude: 77.5407,
  },
  {
    id: 2,
    name: "Mekhri Circle",
    distanceMeters: 3100,
    status: "green",
    secondsRemaining: 28,
    latitude: 13.0145,
    longitude: 77.5839,
  },
  {
    id: 3,
    name: "Hebbal Flyover Junction",
    distanceMeters: 6400,
    status: "amber",
    secondsRemaining: 5,
    latitude: 13.0358,
    longitude: 77.5970,
  },
  {
    id: 4,
    name: "Marathahalli Bridge",
    distanceMeters: 18800,
    status: "unknown",
    secondsRemaining: null,
    latitude: 12.9569,
    longitude: 77.7011,
  },
];

export default function TrafficSignalsPage() {
  const [signals] = useState<TrafficSignal[]>(demoSignals);
  const [currentSignalId, setCurrentSignalId] = useState(1);
  const [vehicleSpeed, setVehicleSpeed] = useState(34);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const currentSignal = useMemo(
    () =>
      signals.find((signal) => signal.id === currentSignalId) ??
      signals[0],
    [signals, currentSignalId]
  );

  const nextSignal = useMemo(() => {
    const currentIndex = signals.findIndex(
      (signal) => signal.id === currentSignal.id
    );

    return signals[currentIndex + 1] ?? null;
  }, [signals, currentSignal]);

  const miraAdvice = useMemo(() => {
    if (currentSignal.status === "red") {
      if (
        currentSignal.secondsRemaining !== null &&
        currentSignal.secondsRemaining > 25
      ) {
        return "Signal is red. Reduce speed smoothly and avoid sudden braking.";
      }

      return "The red phase may end shortly. Maintain a safe stopping distance.";
    }

    if (currentSignal.status === "green") {
      if (
        currentSignal.secondsRemaining !== null &&
        currentSignal.secondsRemaining < 10
      ) {
        return "Green phase is ending soon. Do not accelerate to cross the junction.";
      }

      return "Signal is green. Continue only if the junction is clear.";
    }

    if (currentSignal.status === "amber") {
      return "Amber signal ahead. Slow down and prepare to stop safely.";
    }

    return "Live signal timing is unavailable for this junction. Follow the physical traffic light.";
  }, [currentSignal]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Smart Traffic Signals
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            View upcoming junctions, signal status, estimated phase timing and
            Mira&apos;s safe-driving guidance.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Current signal
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select a junction to preview its status.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-center">
              <SignalLight status={currentSignal.status} />

              <h3 className="mt-5 text-xl font-bold">
                {currentSignal.name}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {formatDistance(currentSignal.distanceMeters)} ahead
              </p>

              <p className="mt-4 text-4xl font-bold">
                {currentSignal.secondsRemaining !== null
                  ? `${currentSignal.secondsRemaining}s`
                  : "--"}
              </p>

              <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
                estimated remaining time
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Vehicle speed"
                value={`${vehicleSpeed} km/h`}
              />

              <Metric
                label="Next signal"
                value={
                  nextSignal
                    ? formatDistance(nextSignal.distanceMeters)
                    : "None"
                }
              />
            </div>

            <label className="block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Demo vehicle speed
                </span>

                <span className="text-sm font-semibold text-slate-300">
                  {vehicleSpeed} km/h
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={vehicleSpeed}
                onChange={(event) =>
                  setVehicleSpeed(Number(event.target.value))
                }
                className="w-full"
              />
            </label>

            <ToggleField
              label="Mira signal alerts"
              checked={alertsEnabled}
              onChange={setAlertsEnabled}
            />

            {alertsEnabled ? (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
                <p className="font-semibold text-cyan-100">
                  Mira advice
                </p>

                <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                  {miraAdvice}
                </p>
              </div>
            ) : null}
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Signals on your route
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Planned sequence from origin to destination.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {signals.map((signal, index) => (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => setCurrentSignalId(signal.id)}
                  className={
                    signal.id === currentSignalId
                      ? "w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-5 text-left"
                      : "w-full rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-cyan-400/30"
                  }
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm font-bold">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-bold">
                            {signal.name}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {formatDistance(signal.distanceMeters)} ahead
                          </p>
                        </div>

                        <StatusBadge
                          status={signal.status}
                          seconds={signal.secondsRemaining}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <SmallDetail
                          label="Latitude"
                          value={signal.latitude.toFixed(5)}
                        />

                        <SmallDetail
                          label="Longitude"
                          value={signal.longitude.toFixed(5)}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this screen currently uses demo
          signal data. True live signal phase and countdown information requires
          authorised access from city traffic-control systems or approved
          infrastructure partners. Mira must always tell users to follow the
          physical traffic light when live data is unavailable.
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

function SignalLight(props: {
  status: SignalStatus;
}) {
  return (
    <div className="mx-auto flex w-24 flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900 p-4">
      <Light
        active={props.status === "red"}
        className="bg-rose-500"
      />

      <Light
        active={props.status === "amber"}
        className="bg-amber-400"
      />

      <Light
        active={props.status === "green"}
        className="bg-emerald-400"
      />
    </div>
  );
}

function Light(props: {
  active: boolean;
  className: string;
}) {
  return (
    <div
      className={`h-14 w-14 rounded-full ${
        props.active
          ? `${props.className} shadow-lg`
          : "bg-slate-800"
      }`}
    />
  );
}

function StatusBadge(props: {
  status: SignalStatus;
  seconds: number | null;
}) {
  const classes =
    props.status === "red"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : props.status === "amber"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : props.status === "green"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.status)}
      {props.seconds !== null ? ` · ${props.seconds}s` : ""}
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

      <p className="mt-2 font-bold">
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

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${distanceMeters} m`;
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}