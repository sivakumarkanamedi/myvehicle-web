"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type HazardSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

type HazardType =
  | "accident"
  | "roadwork"
  | "pothole"
  | "waterlogging"
  | "broken_vehicle"
  | "weather"
  | "checkpoint";

type Hazard = {
  id: number;
  type: HazardType;
  icon: string;
  title: string;
  distanceMeters: number;
  severity: HazardSeverity;
  routeDelayMinutes: number;
  action: string;
  source: "demo" | "live";
  reportedAt: string;
};

const initialHazards: Hazard[] = [
  {
    id: 1,
    type: "roadwork",
    icon: "🚧",
    title: "Road Construction",
    distanceMeters: 350,
    severity: "medium",
    routeDelayMinutes: 4,
    action:
      "Reduce speed and follow lane markings. Do not change lanes abruptly.",
    source: "demo",
    reportedAt: "2 min ago",
  },
  {
    id: 2,
    type: "accident",
    icon: "🚨",
    title: "Accident Ahead",
    distanceMeters: 1800,
    severity: "high",
    routeDelayMinutes: 9,
    action:
      "A safer alternate route may save time. Slow down and watch for emergency vehicles.",
    source: "demo",
    reportedAt: "1 min ago",
  },
  {
    id: 3,
    type: "pothole",
    icon: "🕳️",
    title: "Pothole Zone",
    distanceMeters: 700,
    severity: "low",
    routeDelayMinutes: 1,
    action:
      "Reduce speed smoothly and avoid sudden swerving.",
    source: "demo",
    reportedAt: "5 min ago",
  },
  {
    id: 4,
    type: "waterlogging",
    icon: "🌊",
    title: "Waterlogging Reported",
    distanceMeters: 5200,
    severity: "medium",
    routeDelayMinutes: 6,
    action:
      "Avoid deep water, keep a larger following distance and use an alternate route if flooding increases.",
    source: "demo",
    reportedAt: "8 min ago",
  },
  {
    id: 5,
    type: "broken_vehicle",
    icon: "🚙",
    title: "Broken-Down Vehicle",
    distanceMeters: 2300,
    severity: "medium",
    routeDelayMinutes: 3,
    action:
      "Move cautiously and expect a temporary lane obstruction.",
    source: "demo",
    reportedAt: "4 min ago",
  },
];

export default function HazardDetectionPage() {
  const router = useRouter();

  const [hazards, setHazards] =
    useState<Hazard[]>(initialHazards);

  const [selectedHazardId, setSelectedHazardId] =
    useState<number>(
      initialHazards[0]?.id ?? 0
    );

  const [liveProviderConnected] =
    useState(false);

  const [reportType, setReportType] =
    useState<HazardType>("pothole");

  const [reportDistance, setReportDistance] =
    useState("500");

  const [reportNote, setReportNote] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain the most serious hazard, estimate delay and suggest whether the route should be changed."
    );

  const selectedHazard = useMemo(
    () =>
      hazards.find(
        (hazard) =>
          hazard.id === selectedHazardId
      ) ??
      hazards[0] ??
      null,
    [hazards, selectedHazardId]
  );

  const criticalHazards = useMemo(
    () =>
      hazards.filter(
        (hazard) =>
          hazard.severity === "critical" ||
          hazard.severity === "high"
      ),
    [hazards]
  );

  const totalDelayMinutes = useMemo(
    () =>
      hazards.reduce(
        (total, hazard) =>
          total + hazard.routeDelayMinutes,
        0
      ),
    [hazards]
  );

  const journeyRiskScore = useMemo(() => {
    const weights: Record<
      HazardSeverity,
      number
    > = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 4,
      info: 1,
    };

    return Math.min(
      100,
      hazards.reduce(
        (total, hazard) =>
          total + weights[hazard.severity],
        0
      )
    );
  }, [hazards]);

  const recommendedAction = useMemo(() => {
    const severe = hazards.find(
      (hazard) =>
        hazard.severity === "critical"
    );

    if (severe) {
      return "Stop safely if required and consider rerouting immediately.";
    }

    const high = hazards.find(
      (hazard) =>
        hazard.severity === "high"
    );

    if (high) {
      return `Mira recommends checking an alternate route because ${high.title.toLowerCase()} may add about ${high.routeDelayMinutes} minutes.`;
    }

    return "Stay on the current route, reduce speed near reported hazards and continue monitoring conditions.";
  }, [hazards]);

  function reportHazard(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const distanceMeters =
      Number(reportDistance);

    if (
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      setStatusMessage(
        "Enter a valid hazard distance."
      );
      return;
    }

    const templates: Record<
      HazardType,
      {
        icon: string;
        title: string;
        severity: HazardSeverity;
      }
    > = {
      accident: {
        icon: "🚨",
        title: "User-Reported Accident",
        severity: "high",
      },
      roadwork: {
        icon: "🚧",
        title: "User-Reported Roadwork",
        severity: "medium",
      },
      pothole: {
        icon: "🕳️",
        title: "User-Reported Pothole",
        severity: "low",
      },
      waterlogging: {
        icon: "🌊",
        title: "User-Reported Waterlogging",
        severity: "medium",
      },
      broken_vehicle: {
        icon: "🚙",
        title: "User-Reported Broken Vehicle",
        severity: "medium",
      },
      weather: {
        icon: "🌧️",
        title: "User-Reported Weather Hazard",
        severity: "medium",
      },
      checkpoint: {
        icon: "🚔",
        title: "User-Reported Checkpoint",
        severity: "info",
      },
    };

    const template =
      templates[reportType];

    const hazard: Hazard = {
      id: Date.now(),
      type: reportType,
      icon: template.icon,
      title: template.title,
      distanceMeters,
      severity: template.severity,
      routeDelayMinutes:
        template.severity === "high"
          ? 8
          : template.severity === "medium"
            ? 4
            : 1,
      action:
        reportNote.trim() ||
        "Drive cautiously and verify the road condition before proceeding.",
      source: "demo",
      reportedAt: "Now",
    };

    setHazards((current) => [
      hazard,
      ...current,
    ]);

    setSelectedHazardId(
      hazard.id
    );

    setReportNote("");

    setStatusMessage(
      "Hazard added to the local preview. Live reporting requires a verified provider and moderation workflow."
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
      question.includes("reroute") ||
      question.includes("alternate")
    ) {
      setMiraReply(recommendedAction);
    } else if (
      question.includes("delay") ||
      question.includes("time")
    ) {
      setMiraReply(
        `The current demo hazards may add approximately ${totalDelayMinutes} minutes. Live route delay requires connected traffic data.`
      );
    } else if (
      question.includes("serious") ||
      question.includes("danger")
    ) {
      setMiraReply(
        criticalHazards.length > 0
          ? `${criticalHazards[0].title} is the most serious current hazard. ${criticalHazards[0].action}`
          : "No high-severity hazard is currently shown."
      );
    } else {
      setMiraReply(
        selectedHazard
          ? `${selectedHazard.title} is ${formatDistance(
              selectedHazard.distanceMeters
            )} ahead. ${selectedHazard.action}`
          : "No hazard is currently selected."
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
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Hazard Detection
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review accidents, potholes, roadworks, waterlogging and
            broken-down vehicles before you reach them.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          {liveProviderConnected
            ? "Live hazard data is connected."
            : "This page currently uses demo hazard data. Verified live alerts require map, traffic, city or crowdsourced-provider integration."}
        </section>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Hazards Ahead"
            value={String(
              hazards.length
            )}
          />

          <Metric
            label="High Priority"
            value={String(
              criticalHazards.length
            )}
          />

          <Metric
            label="Estimated Delay"
            value={`${totalDelayMinutes} min`}
          />

          <Metric
            label="Journey Risk"
            value={`${journeyRiskScore}%`}
          />

          <Metric
            label="Data Source"
            value={
              liveProviderConnected
                ? "Live"
                : "Demo"
            }
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            {hazards.map(
              (hazard) => (
                <button
                  key={hazard.id}
                  type="button"
                  onClick={() =>
                    setSelectedHazardId(
                      hazard.id
                    )
                  }
                  className={
                    hazard.id ===
                    selectedHazardId
                      ? "w-full rounded-3xl border border-rose-400/40 bg-rose-400/10 p-5 text-left sm:p-6"
                      : "w-full rounded-3xl border border-white/10 bg-slate-900/80 p-5 text-left sm:p-6"
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-3xl">
                          {hazard.icon}
                        </span>

                        <h2 className="text-xl font-bold">
                          {hazard.title}
                        </h2>

                        <SeverityBadge
                          value={
                            hazard.severity
                          }
                        />
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {formatDistance(
                          hazard.distanceMeters
                        )}{" "}
                        ahead · reported{" "}
                        {hazard.reportedAt}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-lg font-bold text-amber-200">
                        +{hazard.routeDelayMinutes} min
                      </p>

                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        route impact
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                    <p className="text-sm leading-6 text-cyan-50/90">
                      <strong>Mira:</strong>{" "}
                      {hazard.action}
                    </p>
                  </div>
                </button>
              )
            )}
          </section>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Journey Risk Score
              </p>

              <p className="mt-3 text-5xl font-bold text-emerald-200">
                {journeyRiskScore}%
              </p>

              <p className="mt-3 text-sm leading-6 text-emerald-50/80">
                {journeyRiskScore >= 60
                  ? "Risk is elevated. Consider a safer alternate route."
                  : journeyRiskScore >= 30
                    ? "Risk is moderate. Drive cautiously and monitor updates."
                    : "Overall route risk is currently low."}
              </p>
            </article>

            <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Mira Recommendation
              </p>

              <p className="mt-3 text-sm leading-6 text-fuchsia-50/90">
                {recommendedAction}
              </p>

              <button
                type="button"
                onClick={openCoDriver}
                className="mt-4 w-full rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950"
              >
                Ask Mira in Co-Driver
              </button>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Report Hazard
              </h2>

              <form
                onSubmit={reportHazard}
                className="mt-4 space-y-3"
              >
                <select
                  value={reportType}
                  onChange={(event) =>
                    setReportType(
                      event.target
                        .value as HazardType
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm"
                >
                  <option value="accident">
                    Accident
                  </option>
                  <option value="roadwork">
                    Roadwork
                  </option>
                  <option value="pothole">
                    Pothole
                  </option>
                  <option value="waterlogging">
                    Waterlogging
                  </option>
                  <option value="broken_vehicle">
                    Broken vehicle
                  </option>
                  <option value="weather">
                    Weather hazard
                  </option>
                  <option value="checkpoint">
                    Checkpoint
                  </option>
                </select>

                <input
                  type="number"
                  min="0"
                  value={reportDistance}
                  onChange={(event) =>
                    setReportDistance(
                      event.target.value
                    )
                  }
                  placeholder="Distance in metres"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                />

                <textarea
                  value={reportNote}
                  onChange={(event) =>
                    setReportNote(
                      event.target.value
                    )
                  }
                  placeholder="Add a short note..."
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  Report Hazard
                </button>
              </form>
            </article>

            <article className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Ask Mira
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-cyan-50/90">
                {miraReply}
              </p>

              <form
                onSubmit={askMira}
                className="mt-4 space-y-3"
              >
                <input
                  value={miraQuestion}
                  onChange={(event) =>
                    setMiraQuestion(
                      event.target.value
                    )
                  }
                  placeholder="Ask about rerouting or delay..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    !miraQuestion.trim()
                  }
                  className="w-full rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  Ask Mira
                </button>
              </form>
            </article>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Hazard Awareness"
            description="Surfaces accidents, potholes, roadworks and temporary obstructions."
          />

          <FeatureCard
            title="Route Impact"
            description="Estimates delay and highlights hazards that may justify rerouting."
          />

          <FeatureCard
            title="Community Reporting"
            description="Prepares a moderated reporting workflow for verified live hazard sharing."
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

function SeverityBadge(props: {
  value: HazardSeverity;
}) {
  const classes =
    props.value === "critical"
      ? "border-rose-500/40 bg-rose-500/20 text-rose-100"
      : props.value === "high"
        ? "border-orange-400/30 bg-orange-400/10 text-orange-200"
        : props.value === "medium"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : props.value === "low"
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.value)}
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
    return `${Math.round(
      distanceMeters
    )} m`;
  }

  return `${(
    distanceMeters / 1000
  ).toFixed(1)} km`;
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}