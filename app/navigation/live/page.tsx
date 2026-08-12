"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabase";
import MiraMap, {
  type SelectedPlace,
} from "../components/MiraMap";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type RouteOption = {
  route_index: number;
  distance_km: number;
  traffic_duration_minutes: number;
  traffic_delay_minutes: number;
  estimated_arrival_time: string;
  encoded_polyline: string | null;
  congestion: {
    overall_level: "light" | "moderate" | "heavy" | "severe";
  };
};

type TrafficResponse = {
  routes?: RouteOption[];
  recommendation?: {
    should_reroute: boolean;
    recommended_route_index: number;
    current_route_index: number;
    time_saved_minutes: number;
    reason: string;
    mira_message: string;
  };
  error?: string;
};

export default function LiveNavigationPage() {
  const [currentLocation, setCurrentLocation] =
    useState<Coordinates | null>(null);

  const [destination, setDestination] =
    useState<SelectedPlace | null>(null);

  const [traffic, setTraffic] =
    useState<TrafficResponse | null>(null);

  const [selectedRouteIndex, setSelectedRouteIndex] =
    useState(0);

  const [status, setStatus] =
    useState<"idle" | "active" | "paused" | "completed">("idle");

  const [speedKph, setSpeedKph] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const router = useRouter();

  const watchIdRef = useRef<number | null>(null);
  const trafficTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedSinceRef = useRef<string | null>(null);
  const lastTrafficCheckRef = useRef<string | null>(null);

  const [stoppedSince, setStoppedSince] =
    useState<string | null>(null);
  const [nextTurnText, setNextTurnText] =
    useState("Turn guidance will appear after the route provider is connected.");

  const stopTracking = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );
      watchIdRef.current = null;
    }

    if (trafficTimerRef.current) {
      clearInterval(trafficTimerRef.current);
      trafficTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  const selectedRoute = useMemo(() => {
    return (
      traffic?.routes?.find(
        (route) => route.route_index === selectedRouteIndex
      ) ??
      traffic?.routes?.[0] ??
      null
    );
  }, [traffic, selectedRouteIndex]);

  const remainingDistanceKm = useMemo(() => {
    if (!currentLocation || !destination) return 0;

    return (
      haversineDistance(
        currentLocation,
        destination.coordinates
      ) / 1000
    );
  }, [currentLocation, destination]);

  const routeProgressPercent = useMemo(() => {
    if (!selectedRoute || selectedRoute.distance_km <= 0) {
      return 0;
    }

    const travelled =
      selectedRoute.distance_km - remainingDistanceKm;

    return Math.min(
      100,
      Math.max(
        0,
        (travelled / selectedRoute.distance_km) * 100
      )
    );
  }, [selectedRoute, remainingDistanceKm]);

  const stoppedDurationMinutes = useMemo(() => {
    if (!stoppedSince) return 0;

    const startTime = new Date(stoppedSince).getTime();

    if (Number.isNaN(startTime)) return 0;

    return Math.max(
      0,
      Math.floor((Date.now() - startTime) / 60000)
    );
  }, [stoppedSince, currentLocation]);

  async function detectCurrentLocation() {
    setError("");

    try {
      const position = await getCurrentPosition();

      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const detectedSpeed =
        typeof position.coords.speed === "number" &&
        Number.isFinite(position.coords.speed)
          ? Math.max(0, position.coords.speed * 3.6)
          : 0;

      setSpeedKph(detectedSpeed);
      updateStoppedState(detectedSpeed);

      setMessage("Current location detected.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to detect current location."
      );
    }
  }

  async function startNavigation() {
    if (!destination || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const position = await getCurrentPosition();

      const origin = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setCurrentLocation(origin);

      await analyseTraffic(origin, destination.coordinates);

      setStatus("active");
      startTracking();

      setMessage(
        `Navigation started to ${destination.name}. Mira will monitor traffic automatically.`
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start navigation."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateStoppedState(currentSpeedKph: number) {
    const isStopped = currentSpeedKph < 2;

    if (isStopped) {
      const startedAt =
        stoppedSinceRef.current ||
        new Date().toISOString();

      stoppedSinceRef.current = startedAt;
      setStoppedSince(startedAt);
    } else {
      stoppedSinceRef.current = null;
      setStoppedSince(null);
    }
  }

  function startTracking() {
    stopTracking();

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const liveSpeed =
          typeof position.coords.speed === "number" &&
          Number.isFinite(position.coords.speed)
            ? Math.max(0, position.coords.speed * 3.6)
            : 0;

        setCurrentLocation(location);
        setSpeedKph(liveSpeed);
        updateStoppedState(liveSpeed);

        if (
          destination &&
          haversineDistance(
            location,
            destination.coordinates
          ) <= 75
        ) {
          stopTracking();
          setStatus("completed");
          setMessage(
            `You have arrived near ${destination.name}.`
          );
        }
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was denied."
            : geoError.message ||
                "Live location could not be updated."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );

    trafficTimerRef.current = setInterval(() => {
      setCurrentLocation((origin) => {
        if (origin && destination) {
          lastTrafficCheckRef.current =
            new Date().toISOString();

          void analyseTraffic(
            origin,
            destination.coordinates
          );
        }

        return origin;
      });
    }, 120000);
  }

  async function analyseTraffic(
    origin: Coordinates,
    target: Coordinates
  ) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.access_token) {
      throw new Error("Please sign in again.");
    }

    const response = await fetch(
      "/api/navigation/traffic/predict",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          origin,
          destination: target,
          vehicle_type: "car",
          minimum_time_saving_minutes: 5,
          strong_warning_minutes: 10,
          language_code: "en-IN",
        }),
      }
    );

    const data =
      (await response.json()) as TrafficResponse;

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to update traffic."
      );
    }

    setTraffic(data);
    lastTrafficCheckRef.current =
      new Date().toISOString();

    setNextTurnText(
      "Live turn-by-turn instructions require the connected route guidance provider."
    );

    setSelectedRouteIndex(
      data.recommendation?.recommended_route_index ??
        data.routes?.[0]?.route_index ??
        0
    );

    if (data.recommendation?.should_reroute) {
      setMessage(data.recommendation.mira_message);
    }
  }

  function pauseOrResume() {
    if (status === "paused") {
      setStatus("active");
      startTracking();
      setMessage("Navigation resumed.");
      return;
    }

    stopTracking();
    setStatus("paused");
    setMessage("Navigation paused.");
  }

  function endNavigation() {
    stopTracking();
    setStatus("completed");
    setMessage("Navigation completed.");
  }

  function openAskMira() {
    router.push("/navigation/codriver");
  }

  function openEmergency() {
    router.push("/navigation/emergency");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Live Navigation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Search your destination, follow your position on the map and let Mira monitor traffic throughout the journey.
          </p>
        </header>

        {error ? <Alert tone="error" text={error} /> : null}
        {message ? <Alert tone="success" text={message} /> : null}

        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold">
              Navigation controls
            </h2>

            <button
              type="button"
              onClick={() => void detectCurrentLocation()}
              className="w-full rounded-2xl border border-sky-400/30 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-100"
            >
              Detect current location
            </button>

            {destination ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Destination
                </p>

                <p className="mt-2 font-bold">
                  {destination.name}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  {destination.address || "Address unavailable"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                Search your destination on the map.
              </div>
            )}

            <button
              type="button"
              onClick={() => void startNavigation()}
              disabled={!destination || loading || status === "active"}
              className="w-full rounded-2xl bg-sky-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {loading ? "Starting..." : "Start Navigation"}
            </button>

            {status === "active" || status === "paused" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={pauseOrResume}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold"
                >
                  {status === "paused" ? "Resume" : "Pause"}
                </button>

                <button
                  type="button"
                  onClick={endNavigation}
                  className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100"
                >
                  End
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openAskMira}
                className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-100"
              >
                Ask Mira
              </button>

              <button
                type="button"
                onClick={openEmergency}
                className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100"
              >
                Emergency
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Status"
                value={formatLabel(status)}
              />
              <Metric
                label="Speed"
                value={`${speedKph.toFixed(0)} km/h`}
              />
              <Metric
                label="Remaining"
                value={`${remainingDistanceKm.toFixed(1)} km`}
              />
              <Metric
                label="ETA"
                value={
                  selectedRoute
                    ? formatTime(
                        selectedRoute.estimated_arrival_time
                      )
                    : "Not available"
                }
              />
            </div>

            {selectedRoute ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Route progress
                  </p>
                  <p className="text-sm font-bold text-sky-200">
                    {routeProgressPercent.toFixed(0)}%
                  </p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all"
                    style={{
                      width: `${routeProgressPercent}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Next turn
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {nextTurnText}
              </p>
            </div>

            {stoppedSince ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Stop detected
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-50/90">
                  The vehicle appears stopped
                  {stoppedDurationMinutes > 0
                    ? ` for approximately ${stoppedDurationMinutes} minute${
                        stoppedDurationMinutes === 1 ? "" : "s"
                      }`
                    : ""}
                  .
                </p>
              </div>
            ) : null}

            {lastTrafficCheckRef.current ? (
              <p className="text-xs text-slate-600">
                Traffic last checked at{" "}
                {formatTime(lastTrafficCheckRef.current)}
              </p>
            ) : null}

            {traffic?.recommendation ? (
              <div
                className={
                  traffic.recommendation.should_reroute
                    ? "rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"
                    : "rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
                }
              >
                <p className="font-semibold">
                  Mira recommendation
                </p>

                <p className="mt-2 text-sm leading-6">
                  {traffic.recommendation.mira_message}
                </p>
              </div>
            ) : null}
          </aside>

          <MiraMap
            currentLocation={currentLocation}
            destination={destination?.coordinates ?? null}
            destinationName={destination?.name ?? "Destination"}
            routes={traffic?.routes ?? []}
            selectedRouteIndex={selectedRouteIndex}
            onPlaceSelected={(place) => {
              setDestination(place);
              setTraffic(null);
              setSelectedRouteIndex(0);
              setStatus("idle");
              setMessage("");
              setNextTurnText(
                "Turn guidance will appear after the route provider is connected."
              );
            }}
            onError={setError}
            heightClassName="h-[680px]"
          />
        </section>

        {traffic?.routes?.length ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold">
              Available routes
            </h2>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {traffic.routes.map((route) => (
                <button
                  key={route.route_index}
                  type="button"
                  onClick={() =>
                    setSelectedRouteIndex(route.route_index)
                  }
                  className={
                    route.route_index === selectedRouteIndex
                      ? "rounded-2xl border border-sky-400/40 bg-sky-400/10 p-4 text-left"
                      : "rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left"
                  }
                >
                  <p className="font-bold">
                    Route {route.route_index + 1}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    {route.distance_km} km ·{" "}
                    {route.traffic_duration_minutes} min
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

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

async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error(
      "Geolocation is not supported by this browser."
    );
  }

  return new Promise<GeolocationPosition>(
    (resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        }
      );
    }
  );
}

function haversineDistance(
  first: Coordinates,
  second: Coordinates
) {
  const earthRadius = 6371000;
  const latitudeOne = toRadians(first.latitude);
  const latitudeTwo = toRadians(second.latitude);
  const latitudeDifference = toRadians(
    second.latitude - first.latitude
  );
  const longitudeDifference = toRadians(
    second.longitude - first.longitude
  );

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitudeOne) *
      Math.cos(latitudeTwo) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )
  );
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
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

function Alert(props: {
  tone: "error" | "success";
  text: string;
}) {
  const classes =
    props.tone === "error"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}
    >
      {props.text}
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}