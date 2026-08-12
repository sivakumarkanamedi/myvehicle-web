"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type SignalStatus = "green" | "red" | "yellow" | "unknown";

type TrafficSignal = {
  id: number;
  name: string;
  status: SignalStatus;
  countdownSeconds: number | null;
  distanceMeters: number;
  estimatedDelaySeconds: number;
  advice: string;
  source: "demo" | "live";
};

const demoSignals: TrafficSignal[] = [
  {
    id: 1,
    name: "Jalahalli Cross",
    status: "green",
    countdownSeconds: 18,
    distanceMeters: 250,
    estimatedDelaySeconds: 0,
    advice:
      "Maintain a steady and legal speed. Do not accelerate only to catch the green signal.",
    source: "demo",
  },
  {
    id: 2,
    name: "BEL Circle",
    status: "red",
    countdownSeconds: 52,
    distanceMeters: 1400,
    estimatedDelaySeconds: 22,
    advice:
      "The signal may clear before arrival. Continue at a safe speed and be prepared to stop.",
    source: "demo",
  },
  {
    id: 3,
    name: "Hebbal Flyover",
    status: "yellow",
    countdownSeconds: 6,
    distanceMeters: 3200,
    estimatedDelaySeconds: 34,
    advice:
      "Yellow indicates transition. Do not speed up. Prepare to stop safely if required.",
    source: "demo",
  },
];

export default function TrafficSignalsPage() {
  const router = useRouter();

  const [signals] = useState<TrafficSignal[]>(demoSignals);
  const [liveIntegrationEnabled] = useState(false);
  const [selectedSignalId, setSelectedSignalId] =
    useState(signals[0]?.id ?? 0);
  const [routeName, setRouteName] =
    useState("Yeshwantpur → Marathahalli");
  const [askMiraText, setAskMiraText] = useState("");
  const [miraReply, setMiraReply] = useState(
    "I can explain the signal sequence, estimated delays and safe speed guidance. Live countdowns require a connected city traffic-signal provider."
  );

  const selectedSignal = useMemo(
    () =>
      signals.find(
        (signal) => signal.id === selectedSignalId
      ) ??
      signals[0] ??
      null,
    [signals, selectedSignalId]
  );

  const totalEstimatedDelaySeconds = useMemo(
    () =>
      signals.reduce(
        (total, signal) =>
          total + signal.estimatedDelaySeconds,
        0
      ),
    [signals]
  );

  const redSignalCount = useMemo(
    () =>
      signals.filter(
        (signal) => signal.status === "red"
      ).length,
    [signals]
  );

  const recommendedSpeedKph = useMemo(() => {
    if (!selectedSignal) return null;

    if (
      selectedSignal.status !== "green" ||
      selectedSignal.countdownSeconds === null ||
      selectedSignal.countdownSeconds <= 0
    ) {
      return null;
    }

    const requiredMetersPerSecond =
      selectedSignal.distanceMeters /
      selectedSignal.countdownSeconds;

    const speedKph =
      requiredMetersPerSecond * 3.6;

    if (
      !Number.isFinite(speedKph) ||
      speedKph < 10 ||
      speedKph > 60
    ) {
      return null;
    }

    return Math.round(speedKph);
  }, [selectedSignal]);

  const possibleTimeSavingMinutes = Math.max(
    0,
    Math.round(
      totalEstimatedDelaySeconds / 60
    )
  );

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const prompt = askMiraText.trim().toLowerCase();

    if (!prompt) return;

    if (
      prompt.includes("next signal") ||
      prompt.includes("current signal")
    ) {
      setMiraReply(
        selectedSignal
          ? `${selectedSignal.name} is currently shown as ${selectedSignal.status} in demo mode. ${selectedSignal.advice}`
          : "No signal is currently selected."
      );
    } else if (
      prompt.includes("delay") ||
      prompt.includes("time")
    ) {
      setMiraReply(
        `The current signal sequence is estimated to add about ${formatDuration(
          totalEstimatedDelaySeconds
        )}. This is demo data until live signal infrastructure is connected.`
      );
    } else if (
      prompt.includes("speed") ||
      prompt.includes("green wave")
    ) {
      setMiraReply(
        recommendedSpeedKph
          ? `A smooth speed near ${recommendedSpeedKph} km/h may align with the current demo signal timing, but always obey the posted speed limit and road conditions.`
          : "I cannot recommend a green-wave speed for the selected signal. Continue at a safe legal speed."
      );
    } else {
      setMiraReply(
        "I can help with the next signal, estimated signal delay, red-signal count and safe green-wave guidance."
      );
    }

    setAskMiraText("");
  }

  function openCoDriver() {
    router.push("/navigation/codriver");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Traffic Signal Intelligence
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review the upcoming signal sequence, estimated delays,
            safe-speed guidance and Mira&apos;s recommendations for the
            selected route.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          {liveIntegrationEnabled
            ? "Live city signal data is connected."
            : "This page currently uses demo signal timing. Real red/green status and countdown require an authorised city traffic-signal or mobility-data provider."}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Route"
            value={routeName}
          />
          <Metric
            label="Signals Ahead"
            value={String(signals.length)}
          />
          <Metric
            label="Red Signals"
            value={String(redSignalCount)}
          />
          <Metric
            label="Estimated Delay"
            value={formatDuration(
              totalEstimatedDelaySeconds
            )}
          />
          <Metric
            label="Possible Saving"
            value={`${possibleTimeSavingMinutes} min`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Upcoming Signals
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select a signal to review its current status and Mira guidance.
                </p>
              </div>

              <label className="block min-w-[240px]">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Selected route
                </span>

                <input
                  value={routeName}
                  onChange={(event) =>
                    setRouteName(event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>

            <div className="mt-6 space-y-4">
              {signals.map((signal, index) => (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() =>
                    setSelectedSignalId(signal.id)
                  }
                  className={
                    signal.id === selectedSignalId
                      ? "w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-5 text-left"
                      : "w-full rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left"
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm font-bold">
                          {index + 1}
                        </span>

                        <h3 className="text-lg font-bold">
                          {signal.name}
                        </h3>

                        <SignalStatusBadge
                          status={signal.status}
                        />
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {formatDistance(
                          signal.distanceMeters
                        )}{" "}
                        ahead
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-3xl font-bold text-cyan-300">
                        {signal.countdownSeconds !== null
                          ? `${signal.countdownSeconds}s`
                          : "—"}
                      </p>

                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        remaining
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                    <p className="text-sm leading-6 text-cyan-50/90">
                      <strong>Mira:</strong>{" "}
                      {signal.advice}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Green-Wave Guidance
              </p>

              <h2 className="mt-3 text-4xl font-bold text-emerald-200">
                {recommendedSpeedKph
                  ? `${recommendedSpeedKph} km/h`
                  : "Not available"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-emerald-50/80">
                {recommendedSpeedKph
                  ? "This is a demo calculation based on distance and remaining green time. Never exceed the posted speed limit or accelerate unsafely."
                  : "The selected signal does not currently support a safe green-wave recommendation."}
              </p>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Selected Signal
              </h2>

              {selectedSignal ? (
                <div className="mt-5 space-y-4">
                  <SignalDetail
                    label="Name"
                    value={selectedSignal.name}
                  />
                  <SignalDetail
                    label="Status"
                    value={formatLabel(
                      selectedSignal.status
                    )}
                  />
                  <SignalDetail
                    label="Distance"
                    value={formatDistance(
                      selectedSignal.distanceMeters
                    )}
                  />
                  <SignalDetail
                    label="Estimated delay"
                    value={formatDuration(
                      selectedSignal.estimatedDelaySeconds
                    )}
                  />
                  <SignalDetail
                    label="Data source"
                    value={formatLabel(
                      selectedSignal.source
                    )}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Select a signal to view details.
                </p>
              )}
            </article>

            <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Ask Mira
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
                {miraReply}
              </p>

              <form
                onSubmit={askMira}
                className="mt-4 space-y-3"
              >
                <input
                  value={askMiraText}
                  onChange={(event) =>
                    setAskMiraText(
                      event.target.value
                    )
                  }
                  placeholder="Ask about the next signal or delay..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={!askMiraText.trim()}
                  className="w-full rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
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
            </article>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Signal Count"
            description="Shows how many traffic signals are expected along the selected route."
          />
          <FeatureCard
            title="Countdown Framework"
            description="Displays red, green or yellow countdowns when authorised live data is available."
          />
          <FeatureCard
            title="Safe Green-Wave Guidance"
            description="Suggests a smooth legal speed only when the timing data supports it."
          />
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

function Metric(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-xl font-bold">
        {props.value}
      </p>
    </article>
  );
}

function SignalDetail(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <p className="text-sm text-slate-500">
        {props.label}
      </p>

      <p className="text-right text-sm font-semibold text-slate-200">
        {props.value}
      </p>
    </div>
  );
}

function SignalStatusBadge(props: {
  status: SignalStatus;
}) {
  const classes =
    props.status === "green"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.status === "red"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : props.status === "yellow"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.status)}
    </span>
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

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds)} sec`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);

  return seconds
    ? `${minutes} min ${seconds} sec`
    : `${minutes} min`;
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}