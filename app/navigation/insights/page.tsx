"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type InsightMetric = {
  label: string;
  value: string;
  note: string;
};

type DailyInsight = {
  day: string;
  trips: number;
  distanceKm: number;
  timeSavedMinutes: number;
  fuelSavedLitres: number;
};

const metrics: InsightMetric[] = [
  {
    label: "Trips Today",
    value: "8",
    note: "+2 versus yesterday",
  },
  {
    label: "Distance",
    value: "126 km",
    note: "Across all journeys",
  },
  {
    label: "Average Speed",
    value: "42 km/h",
    note: "Urban and highway combined",
  },
  {
    label: "Time Saved",
    value: "18 min",
    note: "Using Mira rerouting",
  },
  {
    label: "Traffic Alerts",
    value: "5",
    note: "3 avoided successfully",
  },
  {
    label: "Fuel Saved",
    value: "1.4 L",
    note: "Estimated",
  },
];

const weeklyInsights: DailyInsight[] = [
  {
    day: "Mon",
    trips: 6,
    distanceKm: 82,
    timeSavedMinutes: 9,
    fuelSavedLitres: 0.7,
  },
  {
    day: "Tue",
    trips: 8,
    distanceKm: 104,
    timeSavedMinutes: 14,
    fuelSavedLitres: 1.0,
  },
  {
    day: "Wed",
    trips: 5,
    distanceKm: 69,
    timeSavedMinutes: 7,
    fuelSavedLitres: 0.5,
  },
  {
    day: "Thu",
    trips: 9,
    distanceKm: 121,
    timeSavedMinutes: 18,
    fuelSavedLitres: 1.3,
  },
  {
    day: "Fri",
    trips: 11,
    distanceKm: 146,
    timeSavedMinutes: 23,
    fuelSavedLitres: 1.8,
  },
  {
    day: "Sat",
    trips: 7,
    distanceKm: 97,
    timeSavedMinutes: 11,
    fuelSavedLitres: 0.8,
  },
  {
    day: "Sun",
    trips: 4,
    distanceKm: 54,
    timeSavedMinutes: 6,
    fuelSavedLitres: 0.4,
  },
];

const recommendations = [
  "Leave 15 minutes earlier on weekdays to avoid peak congestion.",
  "Your preferred route saved approximately 18 minutes today.",
  "Reduce harsh acceleration to improve fuel efficiency.",
  "A fuel stop is recommended within the next 12 km.",
  "One regular route has repeated construction delays. Mira recommends an alternate corridor.",
];

export default function NavigationInsightsPage() {
  const [period, setPeriod] =
    useState<"today" | "week" | "month">("week");

  const [includeFuelInsights, setIncludeFuelInsights] =
    useState(true);

  const [includeSafetyInsights, setIncludeSafetyInsights] =
    useState(true);

  const [includeTrafficInsights, setIncludeTrafficInsights] =
    useState(true);

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain your time saved, traffic patterns, fuel efficiency and driving behaviour."
    );

  const maxTrips = useMemo(
    () =>
      Math.max(
        ...weeklyInsights.map(
          (item) => item.trips
        )
      ),
    []
  );

  const weeklySummary = useMemo(() => {
    return weeklyInsights.reduce(
      (summary, item) => ({
        trips:
          summary.trips +
          item.trips,
        distanceKm:
          summary.distanceKm +
          item.distanceKm,
        timeSavedMinutes:
          summary.timeSavedMinutes +
          item.timeSavedMinutes,
        fuelSavedLitres:
          summary.fuelSavedLitres +
          item.fuelSavedLitres,
      }),
      {
        trips: 0,
        distanceKm: 0,
        timeSavedMinutes: 0,
        fuelSavedLitres: 0,
      }
    );
  }, []);

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion
        .trim()
        .toLowerCase();

    if (!question) {
      return;
    }

    if (
      question.includes("time") ||
      question.includes("saved")
    ) {
      setMiraReply(
        `Mira saved approximately ${weeklySummary.timeSavedMinutes} minutes this week through route changes and better departure timing.`
      );
    } else if (
      question.includes("fuel")
    ) {
      setMiraReply(
        includeFuelInsights
          ? `Estimated fuel saving this week is ${weeklySummary.fuelSavedLitres.toFixed(
              1
            )} litres.`
          : "Fuel insights are currently disabled."
      );
    } else if (
      question.includes("traffic")
    ) {
      setMiraReply(
        includeTrafficInsights
          ? "Your most frequent delays occur during weekday morning peak hours. Leaving earlier may reduce congestion exposure."
          : "Traffic insights are currently disabled."
      );
    } else if (
      question.includes("safety") ||
      question.includes("driving")
    ) {
      setMiraReply(
        includeSafetyInsights
          ? "Driving behaviour is generally stable, but reducing harsh acceleration can improve safety and efficiency."
          : "Safety insights are currently disabled."
      );
    } else {
      setMiraReply(
        `For the selected ${period} view, Mira is tracking trips, distance, time saved, traffic alerts and fuel efficiency.`
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Navigation Insights
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review trip activity, traffic patterns, time saved,
            fuel efficiency and Mira&apos;s personalised recommendations.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              metric={metric}
            />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Weekly Activity
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Trips, distance and savings across the last seven days.
                </p>
              </div>

              <select
                value={period}
                onChange={(event) =>
                  setPeriod(
                    event.target.value as
                      | "today"
                      | "week"
                      | "month"
                  )
                }
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
              >
                <option value="today">
                  Today
                </option>

                <option value="week">
                  This week
                </option>

                <option value="month">
                  This month
                </option>
              </select>
            </div>

            <div className="mt-8 grid grid-cols-7 items-end gap-3">
              {weeklyInsights.map((item) => {
                const heightPercent =
                  (item.trips / maxTrips) *
                  100;

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
                      {item.distanceKm} km
                    </p>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Weekly Summary
              </p>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Trips"
                  value={String(
                    weeklySummary.trips
                  )}
                />

                <SummaryRow
                  label="Distance"
                  value={`${weeklySummary.distanceKm} km`}
                />

                <SummaryRow
                  label="Time saved"
                  value={`${weeklySummary.timeSavedMinutes} min`}
                />

                <SummaryRow
                  label="Fuel saved"
                  value={`${weeklySummary.fuelSavedLitres.toFixed(
                    1
                  )} L`}
                />
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Insight Preferences
              </h2>

              <div className="mt-5 space-y-3">
                <ToggleField
                  label="Fuel insights"
                  checked={
                    includeFuelInsights
                  }
                  onChange={
                    setIncludeFuelInsights
                  }
                />

                <ToggleField
                  label="Safety insights"
                  checked={
                    includeSafetyInsights
                  }
                  onChange={
                    setIncludeSafetyInsights
                  }
                />

                <ToggleField
                  label="Traffic insights"
                  checked={
                    includeTrafficInsights
                  }
                  onChange={
                    setIncludeTrafficInsights
                  }
                />
              </div>
            </article>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-2xl font-bold">
              Mira Recommendations
            </h2>

            <div className="mt-5 space-y-3">
              {recommendations.map(
                (recommendation, index) => (
                  <div
                    key={recommendation}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-xs font-bold text-cyan-200">
                      {index + 1}
                    </div>

                    <p className="text-sm leading-6 text-slate-300">
                      {recommendation}
                    </p>
                  </div>
                )
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
              Ask Mira About Insights
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
              {miraReply}
            </p>

            <form
              onSubmit={askMira}
              className="mt-4 flex flex-col gap-3"
            >
              <input
                value={miraQuestion}
                onChange={(event) =>
                  setMiraQuestion(
                    event.target.value
                  )
                }
                placeholder="Ask about time saved, traffic, fuel or safety..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
              />

              <button
                type="submit"
                disabled={!miraQuestion.trim()}
                className="rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Ask Mira
              </button>
            </form>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Traffic Intelligence"
            description="Identifies repeated congestion patterns and better departure windows."
          />

          <FeatureCard
            title="Fuel Efficiency"
            description="Estimates fuel saved through smoother routes and reduced idling."
          />

          <FeatureCard
            title="Driving Behaviour"
            description="Highlights acceleration, braking and speed patterns that affect safety."
          />
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this page currently uses
          demonstration insights. Production values will come from
          Supabase journey history, traffic events, fuel estimates and
          driving behaviour data.
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

function MetricCard(props: {
  metric: InsightMetric;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.metric.label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {props.metric.value}
      </p>

      <p className="mt-2 text-xs text-cyan-300">
        {props.metric.note}
      </p>
    </article>
  );
}

function SummaryRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <span className="text-sm text-slate-400">
        {props.label}
      </span>

      <span className="text-sm font-bold text-cyan-100">
        {props.value}
      </span>
    </div>
  );
}

function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
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
          props.onChange(
            event.target.checked
          )
        }
        className="h-5 w-5"
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