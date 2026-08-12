"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ActiveTrip = {
  destination: string;
  distanceKm: number;
  etaMinutes: number;
  trafficDelayMinutes: number;
  currentSpeedKph: number;
  fuelRangeKm: number;
  weather: string;
  safetyScore: number;
  trafficLevel: "Light" | "Moderate" | "Heavy";
};

type NavigationModule = {
  icon: string;
  title: string;
  href: string;
  description: string;
  status?: "ready" | "preview" | "integration";
};

const modules: NavigationModule[] = [
  {
    icon: "🗺️",
    title: "Live Navigation",
    href: "/navigation/live",
    description: "Routes, ETA and turn guidance",
    status: "ready",
  },
  {
    icon: "🚦",
    title: "AI Traffic Signals",
    href: "/navigation/traffic-signals",
    description: "Signal count and countdown framework",
    status: "integration",
  },
  {
    icon: "⚠️",
    title: "Hazard Detection",
    href: "/navigation/hazards",
    description: "Accidents, potholes and roadworks",
    status: "preview",
  },
  {
    icon: "🛣️",
    title: "Smart Lane Assistant",
    href: "/navigation/lane-assistant",
    description: "Best-lane recommendations",
    status: "preview",
  },
  {
    icon: "⛽",
    title: "Fuel & Charging",
    href: "/navigation/fuel-assistant",
    description: "Range, price and queue comparison",
    status: "preview",
  },
  {
    icon: "🅿️",
    title: "Smart Parking AI",
    href: "/navigation/parking-ai",
    description: "Availability, price and parking memory",
    status: "preview",
  },
  {
    icon: "🌦️",
    title: "Weather Along Route",
    href: "/navigation/weather",
    description: "Rain, fog, wind and visibility",
    status: "integration",
  },
  {
    icon: "🎙️",
    title: "Voice Navigation",
    href: "/navigation/voice",
    description: "Multilingual spoken guidance",
    status: "preview",
  },
  {
    icon: "🤖",
    title: "Mira AI Co-Driver",
    href: "/navigation/codriver",
    description: "Traffic, fuel, parking and safety help",
    status: "ready",
  },
  {
    icon: "🚨",
    title: "Emergency Navigation",
    href: "/navigation/emergency",
    description: "SOS, hospital, police and towing",
    status: "ready",
  },
  {
    icon: "👨‍👩‍👧",
    title: "Family Tracking",
    href: "/navigation/family-tracking",
    description: "Live journey and ETA sharing",
    status: "preview",
  },
  {
    icon: "🚗",
    title: "Convoy Mode",
    href: "/navigation/convoy",
    description: "Group tracking and regroup alerts",
    status: "ready",
  },
  {
    icon: "🎥",
    title: "AI Dashcam",
    href: "/navigation/dashcam",
    description: "Lane and collision alert preview",
    status: "preview",
  },
  {
    icon: "📡",
    title: "Offline Navigation",
    href: "/navigation/offline",
    description: "Downloaded regions and offline guidance",
    status: "preview",
  },
  {
    icon: "🕘",
    title: "Journey History",
    href: "/navigation/history",
    description: "Trip records and timeline",
    status: "preview",
  },
  {
    icon: "📍",
    title: "Saved Places",
    href: "/navigation/saved",
    description: "Home, office and favourites",
    status: "preview",
  },
  {
    icon: "🔮",
    title: "Predictive Navigation",
    href: "/navigation/predictive",
    description: "Best departure-time prediction",
    status: "preview",
  },
  {
    icon: "📊",
    title: "Navigation Insights",
    href: "/navigation/insights",
    description: "Time, distance and fuel savings",
    status: "preview",
  },
  {
    icon: "📈",
    title: "Analytics Pro",
    href: "/navigation/analytics-pro",
    description: "Weekly trends and safety score",
    status: "ready",
  },
  {
    icon: "🔗",
    title: "Journey Sharing",
    href: "/navigation/share",
    description: "Secure live journey links",
    status: "preview",
  },
];

const defaultTrip: ActiveTrip = {
  destination: "Marathahalli",
  distanceKm: 18.6,
  etaMinutes: 24,
  trafficDelayMinutes: 8,
  currentSpeedKph: 48,
  fuelRangeKm: 92,
  weather: "Rain ahead",
  safetyScore: 92,
  trafficLevel: "Moderate",
};

export default function MiraNavigationDashboardPage() {
  const [tripActive, setTripActive] = useState(true);
  const [trip, setTrip] = useState<ActiveTrip>(defaultTrip);
  const [moduleFilter, setModuleFilter] = useState<
    "all" | "ready" | "preview" | "integration"
  >("all");

  const visibleModules = useMemo(
    () =>
      moduleFilter === "all"
        ? modules
        : modules.filter(
            (module) => module.status === moduleFilter
          ),
    [moduleFilter]
  );

  const stats = [
    [
      "Current Speed",
      tripActive ? `${trip.currentSpeedKph} km/h` : "—",
      tripActive ? "Normal" : "No active trip",
    ],
    [
      "ETA",
      tripActive ? `${trip.etaMinutes} min` : "—",
      tripActive ? "On time" : "No active trip",
    ],
    [
      "Traffic Delay",
      tripActive ? `${trip.trafficDelayMinutes} min` : "—",
      tripActive ? trip.trafficLevel : "No active trip",
    ],
    [
      "Fuel Range",
      `${trip.fuelRangeKm} km`,
      trip.fuelRangeKm < 100 ? "Refuel soon" : "Healthy",
    ],
    ["Weather", "26°C", trip.weather],
    [
      "Safety Score",
      String(trip.safetyScore),
      trip.safetyScore >= 90 ? "Excellent" : "Good",
    ],
  ];

  function simulateTrafficUpdate() {
    setTrip((current) => ({
      ...current,
      etaMinutes: current.etaMinutes + 4,
      trafficDelayMinutes:
        current.trafficDelayMinutes + 4,
      trafficLevel: "Heavy",
      currentSpeedKph: Math.max(
        20,
        current.currentSpeedKph - 10
      ),
    }));
  }

  function endTrip() {
    setTripActive(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/50 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            My Vehicle · Powered by Mira AI
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
            Mira Navigation Command Center
          </h1>

          <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
            One premium dashboard for live navigation, traffic intelligence,
            signals, hazards, fuel, parking, weather, SOS, family tracking,
            convoy mode, voice guidance and journey analytics.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:max-w-2xl">
            <Link
              href="/navigation"
              className="rounded-2xl bg-cyan-400 px-5 py-4 text-center text-sm font-bold text-slate-950"
            >
              Start Navigation
            </Link>

            <Link
              href="/navigation/codriver"
              className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-4 text-center text-sm font-semibold text-fuchsia-100"
            >
              Ask Mira
            </Link>

            <Link
              href="/navigation/emergency"
              className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-center text-sm font-semibold text-rose-100"
            >
              Emergency
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {stats.map(([label, value, note]) => (
            <article
              key={label}
              className="rounded-2xl border border-white/10 bg-slate-900/80 p-4"
            >
              <p className="text-xs uppercase tracking-wide text-slate-600">
                {label}
              </p>

              <p className="mt-2 text-2xl font-bold">
                {value}
              </p>

              <p className="mt-2 text-xs font-semibold text-cyan-300">
                {note}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <h2 className="text-2xl font-bold">
                  Live Journey Overview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Active route summary and Mira traffic intelligence.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={simulateTrafficUpdate}
                  disabled={!tripActive}
                  className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 disabled:opacity-40"
                >
                  Simulate Traffic Update
                </button>

                <button
                  type="button"
                  onClick={endTrip}
                  disabled={!tripActive}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40"
                >
                  End Trip
                </button>
              </div>
            </div>

            {tripActive ? (
              <div className="relative h-[520px] overflow-hidden bg-gradient-to-br from-slate-950 via-sky-950 to-fuchsia-950">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute left-[8%] top-[15%] h-px w-[70%] rotate-12 bg-slate-500" />
                  <div className="absolute left-[18%] top-[36%] h-px w-[65%] -rotate-6 bg-slate-500" />
                  <div className="absolute left-[10%] top-[58%] h-px w-[76%] rotate-3 bg-slate-500" />
                  <div className="absolute left-[23%] top-[78%] h-px w-[58%] -rotate-12 bg-slate-500" />
                </div>

                <div className="absolute left-[14%] top-[68%] h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_30px_10px_rgba(34,211,238,0.6)]" />
                <div className="absolute left-[16%] top-[62%] h-3 w-[16%] -rotate-12 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 shadow-[0_0_24px_rgba(34,211,238,0.9)]" />
                <div className="absolute left-[29%] top-[52%] h-3 w-[20%] -rotate-6 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 shadow-[0_0_24px_rgba(99,102,241,0.8)]" />
                <div className="absolute left-[48%] top-[38%] h-3 w-[20%] rotate-12 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 shadow-[0_0_24px_rgba(217,70,239,0.8)]" />
                <div className="absolute left-[67%] top-[34%] h-4 w-4 rounded-full bg-fuchsia-300 shadow-[0_0_30px_10px_rgba(232,121,249,0.55)]" />

                <div className="absolute left-[28%] top-[57%] rounded-xl border border-cyan-400/30 bg-slate-950/80 px-3 py-2 text-xs">
                  🚦 Signal data pending
                </div>

                <div className="absolute left-[49%] top-[31%] rounded-xl border border-amber-400/30 bg-slate-950/80 px-3 py-2 text-xs">
                  🚧 Construction
                </div>

                <div className="absolute right-[14%] top-[43%] rounded-xl border border-emerald-400/30 bg-slate-950/80 px-3 py-2 text-xs">
                  ⛽ Fuel · 2.4 km
                </div>

                <div className="absolute bottom-5 left-5 right-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/85 p-4 sm:grid-cols-4">
                  <MiniMetric
                    label="Destination"
                    value={trip.destination}
                  />
                  <MiniMetric
                    label="Distance"
                    value={`${trip.distanceKm} km`}
                  />
                  <MiniMetric
                    label="ETA"
                    value={`${trip.etaMinutes} min`}
                  />
                  <MiniMetric
                    label="Route"
                    value="Mira Recommended"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <div className="text-5xl">🧭</div>
                <h3 className="mt-4 text-2xl font-bold">
                  No active journey
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                  Start a route to see ETA, traffic, fuel, weather and safety
                  information here.
                </p>
                <Link
                  href="/navigation"
                  className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  Plan a Route
                </Link>
              </div>
            )}
          </article>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-2xl font-bold">
                Active Mira Alerts
              </h2>

              <div className="mt-5 space-y-4">
                <AlertCard
                  title="Heavy traffic ahead"
                  detail="Congestion detected 5.8 km ahead. Mira is monitoring an alternate route."
                  tone="amber"
                />
                <AlertCard
                  title="Fuel level low"
                  detail="Best on-route fuel station is 2.4 km ahead with a 5-minute queue."
                  tone="cyan"
                />
                <AlertCard
                  title="Rain expected"
                  detail="Moderate rain is predicted near Hebbal. Reduce speed and increase distance."
                  tone="blue"
                />
              </div>
            </article>

            <article className="rounded-[2rem] border border-fuchsia-400/30 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Mira Proactive Suggestion
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Leave 12 minutes earlier tomorrow
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your office route is expected to become heavily congested
                after 8:20 AM.
              </p>

              <Link
                href="/navigation/predictive"
                className="mt-5 inline-flex rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950"
              >
                View Prediction
              </Link>
            </article>

            <article className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Quick Navigation Actions
              </h2>

              <div className="mt-4 grid gap-3">
                <Link
                  href="/navigation/codriver"
                  className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-100"
                >
                  Open Mira Co-Driver
                </Link>

                <Link
                  href="/navigation/convoy"
                  className="rounded-2xl border border-indigo-400/30 bg-indigo-400/10 px-4 py-3 text-sm font-semibold text-indigo-100"
                >
                  Open Convoy Mode
                </Link>

                <Link
                  href="/navigation/analytics-pro"
                  className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
                >
                  Open Analytics Pro
                </Link>
              </div>
            </article>
          </aside>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Navigation Modules
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Open every Mira Navigation feature from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["ready", "Ready"],
                  ["preview", "Preview"],
                  ["integration", "Integration"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setModuleFilter(value)}
                  className={
                    moduleFilter === value
                      ? "rounded-full bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
                      : "rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map((module) => (
              <Link
                key={module.title}
                href={module.href}
                className="group rounded-2xl border border-white/10 bg-slate-950/60 p-5 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-cyan-400/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="text-4xl">
                    {module.icon}
                  </div>

                  <ModuleStatus
                    status={module.status ?? "preview"}
                  />
                </div>

                <h3 className="mt-4 text-lg font-bold group-hover:text-cyan-200">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {module.description}
                </p>

                <p className="mt-4 text-sm font-semibold text-cyan-300">
                  Open module →
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="AI First"
            description="Mira predicts, recommends and alerts before the driver asks."
          />
          <FeatureCard
            title="Safety First"
            description="Hazards, weather, SOS, lane and dashcam assistance remain central."
          />
          <FeatureCard
            title="One Connected Experience"
            description="Navigation, vehicle health, family tracking and assistance work together."
          />
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> the dashboard currently uses
          structured preview data. Live journey, weather, road closure,
          signal and fuel values will come from connected providers and
          Supabase route sessions.
        </section>

        <Link
          href="/"
          className="inline-block pb-4 text-sm font-semibold text-cyan-300 hover:underline"
        >
          ← Back to My Vehicle Dashboard
        </Link>
      </div>
    </main>
  );
}

function MiniMetric(props: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-200">
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

function AlertCard(props: {
  title: string;
  detail: string;
  tone: "amber" | "cyan" | "blue";
}) {
  const classes =
    props.tone === "amber"
      ? "border-amber-400/30 bg-amber-400/10"
      : props.tone === "blue"
        ? "border-blue-400/30 bg-blue-400/10"
        : "border-cyan-400/30 bg-cyan-400/10";

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <h3 className="font-bold">
        {props.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {props.detail}
      </p>
    </div>
  );
}

function ModuleStatus(props: {
  status: "ready" | "preview" | "integration";
}) {
  const classes =
    props.status === "ready"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.status === "integration"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  const label =
    props.status === "ready"
      ? "Ready"
      : props.status === "integration"
        ? "Integration"
        : "Preview";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}