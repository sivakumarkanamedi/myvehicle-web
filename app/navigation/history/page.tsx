"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type RouteHistory = {
  id: number;
  journey_id: number | null;
  vehicle_id: number | null;
  origin: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  destination: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  route_summary: Record<string, unknown>;
  distance_meters: number;
  duration_seconds: number;
  traffic_delay_seconds: number;
  toll_estimate: number | null;
  fuel_cost_estimate: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type Journey = {
  id: number;
  status: string;
  destination_name: string | null;
  started_at: string;
  completed_at: string | null;
  distance_meters: number;
  total_stop_seconds: number;
  metadata: Record<string, unknown>;
};

type JourneyEvent = {
  id: number;
  journey_id: number;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
};

type FilterOption = "all" | "today" | "week" | "month";

export default function NavigationHistoryPage() {
  const [routes, setRoutes] = useState<RouteHistory[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] =
    useState<number | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const [routeResult, journeyResult] = await Promise.all([
        supabase
          .from("navigation_route_history")
          .select(
            `
              id,
              journey_id,
              vehicle_id,
              origin,
              destination,
              route_summary,
              distance_meters,
              duration_seconds,
              traffic_delay_seconds,
              toll_estimate,
              fuel_cost_estimate,
              started_at,
              completed_at,
              created_at
            `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("navigation_journeys")
          .select(
            `
              id,
              status,
              destination_name,
              started_at,
              completed_at,
              distance_meters,
              total_stop_seconds,
              metadata
            `
          )
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(100),
      ]);

      if (routeResult.error) throw routeResult.error;
      if (journeyResult.error) throw journeyResult.error;

      const routeRows = (routeResult.data ?? []) as RouteHistory[];
      const journeyRows = (journeyResult.data ?? []) as Journey[];

      setRoutes(routeRows);
      setJourneys(journeyRows);

      const initialJourneyId =
        journeyRows[0]?.id ?? routeRows[0]?.journey_id ?? null;

      if (initialJourneyId) {
        setSelectedJourneyId(initialJourneyId);
        await loadJourneyEvents(initialJourneyId);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load journey history."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadJourneyEvents(journeyId: number) {
    setSelectedJourneyId(journeyId);

    const { data, error: eventError } = await supabase
      .from("navigation_journey_events")
      .select(
        `
          id,
          journey_id,
          event_type,
          title,
          description,
          created_at
        `
      )
      .eq("journey_id", journeyId)
      .order("created_at", { ascending: true });

    if (eventError) {
      setError(eventError.message);
      return;
    }

    setEvents((data ?? []) as JourneyEvent[]);
  }

  const filteredRoutes = useMemo(() => {
    const cutoff = getCutoffDate(filter);
    const term = search.trim().toLowerCase();

    return routes.filter((route) => {
      const createdAt = new Date(route.created_at);

      const matchesTime =
        !cutoff || createdAt.getTime() >= cutoff.getTime();

      const haystack = [
        route.origin?.name,
        route.origin?.address,
        route.destination?.name,
        route.destination?.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      return matchesTime && matchesSearch;
    });
  }, [routes, filter, search]);

  const summary = useMemo(() => {
    const totalDistanceKm =
      filteredRoutes.reduce(
        (sum, route) => sum + Number(route.distance_meters || 0),
        0
      ) / 1000;

    const totalDurationSeconds =
      filteredRoutes.reduce(
        (sum, route) => sum + Number(route.duration_seconds || 0),
        0
      );

    const totalTrafficDelaySeconds =
      filteredRoutes.reduce(
        (sum, route) =>
          sum + Number(route.traffic_delay_seconds || 0),
        0
      );

    const totalFuelCost =
      filteredRoutes.reduce(
        (sum, route) =>
          sum + Number(route.fuel_cost_estimate || 0),
        0
      );

    const totalTolls =
      filteredRoutes.reduce(
        (sum, route) =>
          sum + Number(route.toll_estimate || 0),
        0
      );

    const averageSpeed =
      totalDurationSeconds > 0
        ? totalDistanceKm / (totalDurationSeconds / 3600)
        : 0;

    return {
      tripCount: filteredRoutes.length,
      totalDistanceKm,
      totalDurationSeconds,
      totalTrafficDelaySeconds,
      totalFuelCost,
      totalTolls,
      averageSpeed,
    };
  }, [filteredRoutes]);

  const selectedJourney = useMemo(
    () =>
      journeys.find(
        (journey) => journey.id === selectedJourneyId
      ) ?? null,
    [journeys, selectedJourneyId]
  );

  function openRoute(route: RouteHistory) {
    const origin = getCoordinateString(route.origin);
    const destination = getCoordinateString(route.destination);

    if (!destination) return;

    const url =
      "https://www.google.com/maps/dir/?api=1" +
      (origin
        ? `&origin=${encodeURIComponent(origin)}`
        : "") +
      `&destination=${encodeURIComponent(destination)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading Journey History...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Journey History
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review completed trips, distance, travel time, traffic delay,
            tolls, fuel estimates and journey events.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Trips"
            value={String(summary.tripCount)}
          />
          <Metric
            label="Distance"
            value={`${summary.totalDistanceKm.toFixed(1)} km`}
          />
          <Metric
            label="Driving Time"
            value={formatDuration(summary.totalDurationSeconds)}
          />
          <Metric
            label="Avg Speed"
            value={`${summary.averageSpeed.toFixed(0)} km/h`}
          />
          <Metric
            label="Traffic Delay"
            value={formatDuration(summary.totalTrafficDelaySeconds)}
          />
          <Metric
            label="Est. Cost"
            value={`₹${(
              summary.totalFuelCost + summary.totalTolls
            ).toFixed(0)}`}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
            <input
              type="text"
              value={search}
              placeholder="Search origin or destination..."
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
            />

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as FilterOption)
              }
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>

            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            {filteredRoutes.length ? (
              filteredRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onOpen={() => openRoute(route)}
                  onViewTimeline={() => {
                    if (route.journey_id) {
                      void loadJourneyEvents(route.journey_id);
                    }
                  }}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 p-12 text-center text-sm text-slate-500">
                No journey history found.
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Journey Timeline
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedJourney
                  ? selectedJourney.destination_name ||
                    `Journey ${selectedJourney.id}`
                  : "Select a trip to view events."}
              </p>
            </div>

            {selectedJourney ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SmallMetric
                  label="Status"
                  value={formatLabel(selectedJourney.status)}
                />
                <SmallMetric
                  label="Stops"
                  value={formatDuration(
                    selectedJourney.total_stop_seconds
                  )}
                />
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {events.length ? (
                events.map((event, index) => (
                  <TimelineItem
                    key={event.id}
                    event={event}
                    index={index}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  No journey events available.
                </div>
              )}
            </div>
          </aside>
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

function RouteCard(props: {
  route: RouteHistory;
  onOpen: () => void;
  onViewTimeline: () => void;
}) {
  const originName =
    props.route.origin?.name ||
    props.route.origin?.address ||
    "Starting point";

  const destinationName =
    props.route.destination?.name ||
    props.route.destination?.address ||
    "Destination";

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-300">
            {originName}
          </p>

          <p className="my-2 text-slate-600">
            ↓
          </p>

          <h2 className="text-xl font-bold">
            {destinationName}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {formatDateTime(
              props.route.started_at ||
                props.route.created_at
            )}
          </p>
        </div>

        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          Completed
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Detail
          label="Distance"
          value={`${(
            props.route.distance_meters / 1000
          ).toFixed(1)} km`}
        />
        <Detail
          label="Duration"
          value={formatDuration(
            props.route.duration_seconds
          )}
        />
        <Detail
          label="Traffic Delay"
          value={formatDuration(
            props.route.traffic_delay_seconds
          )}
        />
        <Detail
          label="Fuel Estimate"
          value={
            props.route.fuel_cost_estimate !== null
              ? `₹${props.route.fuel_cost_estimate.toFixed(0)}`
              : "Not available"
          }
        />
        <Detail
          label="Toll Estimate"
          value={
            props.route.toll_estimate !== null
              ? `₹${props.route.toll_estimate.toFixed(0)}`
              : "Not available"
          }
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={props.onOpen}
          className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
        >
          Open Route
        </button>

        <button
          type="button"
          onClick={props.onViewTimeline}
          disabled={!props.route.journey_id}
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold disabled:opacity-40"
        >
          View Timeline
        </button>
      </div>
    </article>
  );
}

function TimelineItem(props: {
  event: JourneyEvent;
  index: number;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-xs font-bold text-cyan-200">
          {props.index + 1}
        </div>

        <div className="min-w-0">
          <p className="font-semibold">
            {props.event.title}
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {props.event.description ||
              formatLabel(props.event.event_type)}
          </p>

          <p className="mt-2 text-xs text-slate-600">
            {formatDateTime(props.event.created_at)}
          </p>
        </div>
      </div>
    </article>
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

function SmallMetric(props: {
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

function Detail(props: {
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

function getCutoffDate(
  filter: FilterOption
) {
  if (filter === "all") return null;

  const date = new Date();

  if (filter === "today") {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  if (filter === "week") {
    date.setDate(date.getDate() - 7);
    return date;
  }

  date.setDate(date.getDate() - 30);
  return date;
}

function getCoordinateString(
  location: RouteHistory["origin"]
) {
  if (
    typeof location?.latitude === "number" &&
    typeof location?.longitude === "number"
  ) {
    return `${location.latitude},${location.longitude}`;
  }

  return (
    location?.address ||
    location?.name ||
    ""
  );
}

function formatDuration(
  seconds: number
) {
  const safeSeconds = Math.max(
    0,
    Number(seconds || 0)
  );

  const hours = Math.floor(
    safeSeconds / 3600
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} min`;
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}