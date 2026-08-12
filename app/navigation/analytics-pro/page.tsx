"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RangeOption = "7d" | "30d" | "90d";

type TripSummary = {
  totalTrips: number;
  distanceKm: number;
  timeSavedMinutes: number;
  fuelSavedLitres: number;
  trafficAlerts: number;
  safetyScore: number;
};

type DailyTrip = {
  day: string;
  trips: number;
  distance: number;
  trafficDelayMinutes: number;
};

type FrequentRoute = {
  id: number;
  route: string;
  trips: number;
  averageDurationMinutes: number;
  averageDelayMinutes: number;
  efficiencyScore: number;
};

type PeakPeriod = {
  label: string;
  congestionLevel: "Light" | "Moderate" | "Heavy";
  averageDelayMinutes: number;
};

const summaryByRange: Record<RangeOption, TripSummary> = {
  "7d": {
    totalTrips: 50,
    distanceKm: 673,
    timeSavedMinutes: 184,
    fuelSavedLitres: 8.4,
    trafficAlerts: 17,
    safetyScore: 91,
  },
  "30d": {
    totalTrips: 184,
    distanceKm: 3842,
    timeSavedMinutes: 684,
    fuelSavedLitres: 38.6,
    trafficAlerts: 67,
    safetyScore: 92,
  },
  "90d": {
    totalTrips: 541,
    distanceKm: 11270,
    timeSavedMinutes: 1938,
    fuelSavedLitres: 109.2,
    trafficAlerts: 196,
    safetyScore: 90,
  },
};

const weeklyTrips: DailyTrip[] = [
  {
    day: "Mon",
    trips: 6,
    distance: 82,
    trafficDelayMinutes: 18,
  },
  {
    day: "Tue",
    trips: 8,
    distance: 104,
    trafficDelayMinutes: 31,
  },
  {
    day: "Wed",
    trips: 5,
    distance: 69,
    trafficDelayMinutes: 14,
  },
  {
    day: "Thu",
    trips: 9,
    distance: 121,
    trafficDelayMinutes: 36,
  },
  {
    day: "Fri",
    trips: 11,
    distance: 146,
    trafficDelayMinutes: 49,
  },
  {
    day: "Sat",
    trips: 7,
    distance: 97,
    trafficDelayMinutes: 20,
  },
  {
    day: "Sun",
    trips: 4,
    distance: 54,
    trafficDelayMinutes: 9,
  },
];

const frequentRoutes: FrequentRoute[] = [
  {
    id: 1,
    route: "Yeshwantpur → Marathahalli",
    trips: 42,
    averageDurationMinutes: 61,
    averageDelayMinutes: 18,
    efficiencyScore: 86,
  },
  {
    id: 2,
    route: "Hebbal → Electronic City",
    trips: 31,
    averageDurationMinutes: 58,
    averageDelayMinutes: 14,
    efficiencyScore: 90,
  },
  {
    id: 3,
    route: "Majestic → Whitefield",
    trips: 24,
    averageDurationMinutes: 67,
    averageDelayMinutes: 22,
    efficiencyScore: 81,
  },
];

const peakPeriods: PeakPeriod[] = [
  {
    label: "Weekdays 8:15–9:10 AM",
    congestionLevel: "Heavy",
    averageDelayMinutes: 24,
  },
  {
    label: "Weekdays 5:45–7:20 PM",
    congestionLevel: "Heavy",
    averageDelayMinutes: 29,
  },
  {
    label: "Saturday 11:30 AM–1:00 PM",
    congestionLevel: "Moderate",
    averageDelayMinutes: 14,
  },
];

const recommendations = [
  "Leave 12 minutes earlier on weekdays to avoid peak traffic.",
  "Your preferred office route saved 38 minutes this week.",
  "Fuel efficiency improves when average speed stays between 40–55 km/h.",
  "You usually face congestion near Hebbal between 8:15 AM and 9:10 AM.",
  "One frequent route has repeated construction delays. Mira recommends an alternate corridor.",
];

export default function NavigationAnalyticsProPage() {
  const [range, setRange] = useState<RangeOption>("30d");

  const summary = summaryByRange[range];

  const maxTrips = Math.max(
    ...weeklyTrips.map((item) => item.trips)
  );

  const routeEfficiency = useMemo(() => {
    const total = frequentRoutes.reduce(
      (sum, route) => sum + route.efficiencyScore,
      0
    );

    return Math.round(total / frequentRoutes.length);
  }, []);

  const totalWeeklyDistance = useMemo(
    () =>
      weeklyTrips.reduce(
        (sum, item) => sum + item.distance,
        0
      ),
    []
  );

  const totalWeeklyDelay = useMemo(
    () =>
      weeklyTrips.reduce(
        (sum, item) =>
          sum + item.trafficDelayMinutes,
        0
      ),
    []
  );

  const estimatedFuelUsed = useMemo(() => {
    const assumedMileageKmPerLitre = 14;
    return (
      summary.distanceKm / assumedMileageKmPerLitre
    );
  }, [summary.distanceKm]);

  const summaryCards = [
    {
      label: "Total Trips",
      value: String(summary.totalTrips),
      note: range === "30d" ? "+12 this month" : "Selected period",
    },
    {
      label: "Distance Travelled",
      value: `${summary.distanceKm.toLocaleString("en-IN")} km`,
      note: "Across all journeys",
    },
    {
      label: "Time Saved",
      value: formatMinutes(summary.timeSavedMinutes),
      note: "Using Mira rerouting",
    },
    {
      label: "Fuel Saved",
      value: `${summary.fuelSavedLitres.toFixed(1)} L`,
      note: "Estimated",
    },
    {
      label: "Traffic Avoided",
      value: `${summary.trafficAlerts} alerts`,
      note: "Resolved proactively",
    },
    {
      label: "Safety Score",
      value: `${summary.safetyScore} / 100`,
      note:
        summary.safetyScore >= 90
          ? "Excellent"
          : "Good",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Mira Navigation
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                Navigation Analytics Pro
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Review journey trends, time saved, route efficiency,
                traffic avoidance and Mira&apos;s personalised driving
                insights.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["7d", "7 Days"],
                  ["30d", "30 Days"],
                  ["90d", "90 Days"],
                ] as Array<[RangeOption, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  className={
                    range === value
                      ? "rounded-full border border-cyan-400/40 bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
                      : "rounded-full border border-white/10 bg-slate-950/50 px-4 py-2 text-sm font-semibold text-slate-300"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-white/10 bg-slate-900/80 p-4"
            >
              <p className="text-xs uppercase tracking-wide text-slate-600">
                {card.label}
              </p>

              <p className="mt-2 text-2xl font-bold">
                {card.value}
              </p>

              <p className="mt-2 text-xs text-cyan-300">
                {card.note}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Weekly Trip Activity
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Trips and distance travelled over the last seven days.
                </p>
              </div>

              <div className="text-sm text-slate-400">
                {totalWeeklyDistance} km · {totalWeeklyDelay} min traffic delay
              </div>
            </div>

            <div className="mt-8 grid grid-cols-7 items-end gap-3">
              {weeklyTrips.map((item) => {
                const heightPercent =
                  (item.trips / maxTrips) * 100;

                return (
                  <div
                    key={item.day}
                    className="flex flex-col items-center"
                  >
                    <div className="flex h-64 w-full items-end justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-2">
                      <div
                        className="w-full rounded-xl bg-gradient-to-t from-cyan-500 to-fuchsia-500"
                        style={{
                          height: `${heightPercent}%`,
                        }}
                      />
                    </div>

                    <p className="mt-3 text-sm font-semibold">
                      {item.day}
                    </p>

                    <p className="text-xs text-slate-500">
                      {item.trips} trips
                    </p>

                    <p className="text-xs text-slate-600">
                      {item.distance} km
                    </p>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Mira Recommendations
              </h2>

              <div className="mt-5 space-y-3">
                {recommendations.map((item, index) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-xs font-bold text-cyan-200">
                      {index + 1}
                    </div>

                    <p className="text-sm leading-6 text-slate-300">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Monthly Highlight
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                {formatMinutes(summary.timeSavedMinutes)} saved
              </h2>

              <p className="mt-3 text-sm leading-6 text-cyan-50/80">
                Mira&apos;s route changes and departure-time suggestions
                reduced your estimated travel time significantly.
              </p>
            </article>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <InsightCard
            title="Traffic Performance"
            value="84%"
            description="Most journeys avoided severe congestion."
          />

          <InsightCard
            title="Route Efficiency"
            value={`${routeEfficiency}%`}
            description="Strong route consistency with limited unnecessary detours."
          />

          <InsightCard
            title="Driving Smoothness"
            value={`${summary.safetyScore - 4}%`}
            description="Good acceleration, braking and speed stability."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Most-Used Routes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Frequent routes ranked by usage and efficiency.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="pb-3 pr-4">Route</th>
                    <th className="pb-3 pr-4">Trips</th>
                    <th className="pb-3 pr-4">Avg. Time</th>
                    <th className="pb-3 pr-4">Avg. Delay</th>
                    <th className="pb-3">Efficiency</th>
                  </tr>
                </thead>

                <tbody>
                  {frequentRoutes.map((route) => (
                    <tr
                      key={route.id}
                      className="border-t border-white/10"
                    >
                      <td className="py-4 pr-4 font-semibold text-slate-200">
                        {route.route}
                      </td>
                      <td className="py-4 pr-4 text-slate-400">
                        {route.trips}
                      </td>
                      <td className="py-4 pr-4 text-slate-400">
                        {route.averageDurationMinutes} min
                      </td>
                      <td className="py-4 pr-4 text-slate-400">
                        {route.averageDelayMinutes} min
                      </td>
                      <td className="py-4">
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                          {route.efficiencyScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Peak Congestion Periods
            </h2>

            <div className="mt-5 space-y-3">
              {peakPeriods.map((period) => (
                <div
                  key={period.label}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">
                      {period.label}
                    </p>

                    <CongestionBadge
                      value={period.congestionLevel}
                    />
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Average delay: {period.averageDelayMinutes} minutes
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <InsightCard
            title="Estimated Fuel Used"
            value={`${estimatedFuelUsed.toFixed(1)} L`}
            description="Estimated using an assumed average mileage of 14 km/L."
          />

          <InsightCard
            title="Fuel Saved"
            value={`${summary.fuelSavedLitres.toFixed(1)} L`}
            description="Estimated savings from reduced idling and rerouting."
          />

          <InsightCard
            title="Time Saved"
            value={formatMinutes(summary.timeSavedMinutes)}
            description="Estimated difference between selected and avoided routes."
          />
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this page currently uses
          structured demo analytics. Production values will come from
          Supabase journey history, route events, traffic predictions,
          fuel estimates and driving insights.
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

function InsightCard(props: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.title}
      </p>

      <p className="mt-3 text-4xl font-bold text-cyan-300">
        {props.value}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {props.description}
      </p>
    </article>
  );
}

function CongestionBadge(props: {
  value: PeakPeriod["congestionLevel"];
}) {
  const classes =
    props.value === "Heavy"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : props.value === "Moderate"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {props.value}
    </span>
  );
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}