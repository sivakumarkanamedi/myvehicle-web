"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/supabase";
import MiraMap, {
  type SelectedPlace,
} from "../components/MiraMap";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type CongestionLevel =
  | "light"
  | "moderate"
  | "heavy"
  | "severe";

type RouteOption = {
  route_index: number;
  distance_km: number;
  traffic_duration_minutes: number;
  traffic_delay_minutes: number;
  estimated_arrival_time: string;
  encoded_polyline: string | null;
  congestion: {
    overall_level: CongestionLevel;
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

type NavStatus =
  | "idle"
  | "starting"
  | "active"
  | "paused"
  | "completed";

const DEFAULT_TURN =
  "Continue on the selected route";

export default function LiveNavigationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentLocation, setCurrentLocation] =
    useState<Coordinates | null>(null);

  const [destination, setDestination] =
    useState<SelectedPlace | null>(null);

  const [traffic, setTraffic] =
    useState<TrafficResponse | null>(null);

  const [selectedRouteIndex, setSelectedRouteIndex] =
    useState(0);

  const [status, setStatus] =
    useState<NavStatus>("idle");

  const [speedKph, setSpeedKph] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [followVehicle, setFollowVehicle] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showMiraPanel, setShowMiraPanel] = useState(true);
  const [nextTurnText, setNextTurnText] =
    useState(DEFAULT_TURN);
  const [stoppedSince, setStoppedSince] =
    useState<string | null>(null);
  const [lastTrafficCheckedAt, setLastTrafficCheckedAt] =
    useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const trafficTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedSinceRef = useRef<string | null>(null);
  const initialRouteStartedRef = useRef(false);

  const selectedRoute = useMemo(() => {
    return (
      traffic?.routes?.find(
        (route) =>
          route.route_index === selectedRouteIndex
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

    const startedAt = new Date(stoppedSince).getTime();

    if (Number.isNaN(startedAt)) return 0;

    return Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 60000)
    );
  }, [stoppedSince, currentLocation]);

  const congestionLevel =
    selectedRoute?.congestion?.overall_level ?? "light";

  const eta =
    selectedRoute?.estimated_arrival_time
      ? formatTime(selectedRoute.estimated_arrival_time)
      : "—";

  const timeRemaining =
    selectedRoute?.traffic_duration_minutes ?? 0;

  const trafficDelay =
    selectedRoute?.traffic_delay_minutes ?? 0;

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

  useEffect(() => {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const name = searchParams.get("name");
    const address = searchParams.get("address") || "";
    const route = Number(searchParams.get("route"));

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      name
    ) {
      setDestination({
        placeId: null,
        name,
        address,
        coordinates: {
          latitude: lat,
          longitude: lng,
        },
        rating: null,
        phoneNumber: null,
        websiteUrl: null,
        isOpenNow: null,
        regularOpeningHours: [],
      });

      if (Number.isFinite(route)) {
        setSelectedRouteIndex(route);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    void detectCurrentLocation();
  }, []);

  useEffect(() => {
    if (
      destination &&
      currentLocation &&
      !initialRouteStartedRef.current
    ) {
      initialRouteStartedRef.current = true;
      void startNavigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, currentLocation]);

  async function detectCurrentLocation() {
    setError("");

    try {
      const position = await getCurrentPosition();

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setCurrentLocation(location);

      const detectedSpeed =
        typeof position.coords.speed === "number" &&
        Number.isFinite(position.coords.speed)
          ? Math.max(0, position.coords.speed * 3.6)
          : 0;

      setSpeedKph(detectedSpeed);
      updateStoppedState(detectedSpeed);
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
    setStatus("starting");
    setError("");
    setMessage("");

    try {
      const position = await getCurrentPosition();

      const origin = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setCurrentLocation(origin);

      await analyseTraffic(
        origin,
        destination.coordinates
      );

      setStatus("active");
      startTracking();

      setMessage(
        `Navigating to ${destination.name}`
      );
    } catch (caughtError) {
      setStatus("idle");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start navigation."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateStoppedState(
    currentSpeedKph: number
  ) {
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
      setError(
        "Geolocation is not supported by this browser."
      );
      return;
    }

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const liveSpeed =
            typeof position.coords.speed === "number" &&
            Number.isFinite(position.coords.speed)
              ? Math.max(
                  0,
                  position.coords.speed * 3.6
                )
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
            geoError.code ===
              geoError.PERMISSION_DENIED
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
    setLastTrafficCheckedAt(
      new Date().toISOString()
    );

    const requestedRoute = Number(
      searchParams.get("route")
    );

    if (
      Number.isFinite(requestedRoute) &&
      data.routes?.some(
        (route) =>
          route.route_index === requestedRoute
      )
    ) {
      setSelectedRouteIndex(requestedRoute);
    } else {
      setSelectedRouteIndex(
        data.recommendation
          ?.recommended_route_index ??
          data.routes?.[0]?.route_index ??
          0
      );
    }

    if (data.recommendation?.should_reroute) {
      setMessage(
        data.recommendation.mira_message
      );
    }

    setNextTurnText(DEFAULT_TURN);
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
    setMessage("Navigation ended.");
  }

  function exitNavigation() {
    stopTracking();
    router.push("/navigation");
  }

  function openAskMira() {
    router.push("/navigation/codriver");
  }

  function openEmergency() {
    router.push("/navigation/emergency");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <section className="relative min-h-screen">
        <div className="absolute inset-0">
          <MiraMap
            currentLocation={currentLocation}
            destination={
              destination?.coordinates ?? null
            }
            destinationName={
              destination?.name ?? "Destination"
            }
            routes={traffic?.routes ?? []}
            selectedRouteIndex={
              selectedRouteIndex
            }
            onPlaceSelected={(place) => {
              if (status !== "idle") return;
              setDestination(place);
              setTraffic(null);
              setSelectedRouteIndex(0);
              setMessage("");
            }}
            onError={setError}
            heightClassName="h-screen"
          />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/80" />

        <div className="pointer-events-none relative z-20 flex min-h-screen flex-col justify-between p-3 sm:p-4 lg:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto flex max-w-[760px] flex-1 items-start gap-3">
              <button
                type="button"
                onClick={exitNavigation}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/90 text-xl shadow-2xl backdrop-blur-xl"
                aria-label="Back"
              >
                ←
              </button>

              <div className="min-w-0 flex-1 rounded-3xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-2xl shadow-lg shadow-cyan-500/20">
                    ↱
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                      Next turn
                    </p>
                    <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">
                      {nextTurnText}
                    </h1>
                    <p className="mt-1 truncate text-sm text-slate-400">
                      {destination?.name ??
                        "Choose a destination"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() =>
                  setVoiceEnabled((value) => !value)
                }
                className="rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-xl"
              >
                {voiceEnabled
                  ? "🔊 Voice"
                  : "🔇 Muted"}
              </button>

              <button
                type="button"
                onClick={openEmergency}
                className="rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-bold text-rose-100 shadow-xl backdrop-blur-xl"
              >
                SOS
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="pointer-events-auto hidden w-[300px] space-y-3 lg:block">
              <CockpitCard
                title="LIVE SIGNAL AHEAD"
                accent="emerald"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="h-3 w-3 rounded-full bg-slate-700" />
                    <span className="h-3 w-3 rounded-full bg-slate-700" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                  </div>
                  <div>
                    <p className="font-black text-emerald-300">
                      Signal data integration pending
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Countdown will appear when a supported city feed is connected.
                    </p>
                  </div>
                </div>
              </CockpitCard>

              <CockpitCard
                title="ROAD AHEAD"
                accent="amber"
              >
                <p className="text-sm font-bold">
                  No verified hazard feed connected
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Hazards, parking and charging markers will appear here when live data is available.
                </p>
              </CockpitCard>
            </div>

            <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-3">
              {showMiraPanel &&
              traffic?.recommendation ? (
                <div
                  className={`rounded-3xl border p-4 shadow-2xl backdrop-blur-xl ${
                    traffic.recommendation
                      .should_reroute
                      ? "border-amber-400/30 bg-amber-500/15"
                      : "border-emerald-400/30 bg-emerald-500/15"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/25 text-xl">
                      ✨
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                        Mira route intelligence
                      </p>
                      <p className="mt-1 text-sm font-bold leading-6">
                        {
                          traffic.recommendation
                            .mira_message
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setShowMiraPanel(false)
                      }
                      className="text-slate-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-950/90 px-4 py-3 text-sm text-rose-100 shadow-xl backdrop-blur-xl">
                  {error}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <BottomMetric
                  label="Speed"
                  value={`${speedKph.toFixed(0)}`}
                  suffix="km/h"
                />
                <BottomMetric
                  label="Remaining"
                  value={
                    remainingDistanceKm > 0
                      ? remainingDistanceKm.toFixed(1)
                      : "—"
                  }
                  suffix="km"
                />
                <BottomMetric
                  label="ETA"
                  value={eta}
                />
                <BottomMetric
                  label="Time"
                  value={
                    timeRemaining > 0
                      ? String(timeRemaining)
                      : "—"
                  }
                  suffix="min"
                />
                <BottomMetric
                  label="Traffic"
                  value={formatLabel(
                    congestionLevel
                  )}
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFollowVehicle(
                          (value) => !value
                        )
                      }
                      className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                        followVehicle
                          ? "bg-cyan-400 text-slate-950"
                          : "border border-white/10 bg-white/[0.05]"
                      }`}
                    >
                      {followVehicle
                        ? "◎ Following"
                        : "◎ Recenter"}
                    </button>

                    <button
                      type="button"
                      onClick={openAskMira}
                      className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-3 text-sm font-bold text-violet-100"
                    >
                      ✨ Ask Mira
                    </button>

                    {status === "active" ||
                    status === "paused" ? (
                      <button
                        type="button"
                        onClick={pauseOrResume}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold"
                      >
                        {status === "paused"
                          ? "Resume"
                          : "Pause"}
                      </button>
                    ) : null}
                  </div>

                  {status === "active" ||
                  status === "paused" ||
                  status === "starting" ? (
                    <button
                      type="button"
                      onClick={endNavigation}
                      className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/20"
                    >
                      End Navigation
                    </button>
                  ) : status === "completed" ? (
                    <button
                      type="button"
                      onClick={exitNavigation}
                      className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950"
                    >
                      Back to Route Preview
                    </button>
                  ) : destination ? (
                    <button
                      type="button"
                      onClick={() =>
                        void startNavigation()
                      }
                      disabled={loading}
                      className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                    >
                      {loading
                        ? "Starting…"
                        : "Start Navigation"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all"
                    style={{
                      width: `${routeProgressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                {trafficDelay > 0 ? (
                  <span>
                    Traffic delay +{trafficDelay} min
                  </span>
                ) : null}

                {lastTrafficCheckedAt ? (
                  <span>
                    Traffic updated{" "}
                    {formatTime(
                      lastTrafficCheckedAt
                    )}
                  </span>
                ) : null}

                {stoppedSince ? (
                  <span className="text-amber-300">
                    Stop detected
                    {stoppedDurationMinutes > 0
                      ? ` · ${stoppedDurationMinutes} min`
                      : ""}
                  </span>
                ) : null}

                <span>
                  Status: {formatLabel(status)}
                </span>
              </div>
            </div>

            <div className="pointer-events-auto hidden w-[300px] space-y-3 xl:block">
              <CockpitCard
                title="MIRA JOURNEY"
                accent="violet"
              >
                <div className="space-y-3">
                  <JourneyRow
                    label="Destination"
                    value={
                      destination?.name ?? "—"
                    }
                  />
                  <JourneyRow
                    label="Selected route"
                    value={`Route ${
                      selectedRouteIndex + 1
                    }`}
                  />
                  <JourneyRow
                    label="Progress"
                    value={`${routeProgressPercent.toFixed(
                      0
                    )}%`}
                  />
                  <JourneyRow
                    label="Traffic"
                    value={formatLabel(
                      congestionLevel
                    )}
                  />
                </div>
              </CockpitCard>

              <CockpitCard
                title="QUICK ACTIONS"
                accent="cyan"
              >
                <div className="grid grid-cols-2 gap-2">
                  <QuickButton
                    label="Mira"
                    icon="✨"
                    onClick={openAskMira}
                  />
                  <QuickButton
                    label="SOS"
                    icon="🆘"
                    onClick={openEmergency}
                  />
                  <QuickButton
                    label="Voice"
                    icon={
                      voiceEnabled ? "🔊" : "🔇"
                    }
                    onClick={() =>
                      setVoiceEnabled(
                        (value) => !value
                      )
                    }
                  />
                  <QuickButton
                    label="Route"
                    icon="🧭"
                    onClick={() =>
                      setShowMiraPanel(true)
                    }
                  />
                </div>
              </CockpitCard>
            </div>
          </div>
        </div>
      </section>

      {status === "idle" && !destination ? (
        <div className="absolute inset-x-0 bottom-5 z-30 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-white/10 bg-slate-950/95 p-5 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-lg font-black">
            No destination received
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Start from the Route Preview page, choose a route and tap Start Navigation.
          </p>
          <Link
            href="/navigation"
            className="mt-4 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950"
          >
            Open Route Preview
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function CockpitCard(props: {
  title: string;
  accent: "cyan" | "emerald" | "amber" | "violet";
  children: React.ReactNode;
}) {
  const titleClass = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  }[props.accent];

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/88 p-4 shadow-2xl backdrop-blur-xl">
      <p
        className={`text-[11px] font-black uppercase tracking-[0.18em] ${titleClass}`}
      >
        {props.title}
      </p>
      <div className="mt-3">
        {props.children}
      </div>
    </div>
  );
}

function BottomMetric(props: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-3 text-center shadow-xl backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {props.label}
      </p>
      <p className="mt-1 text-lg font-black">
        {props.value}
        {props.suffix ? (
          <span className="ml-1 text-[10px] font-semibold text-slate-400">
            {props.suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function JourneyRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">
        {props.label}
      </span>
      <span className="max-w-[150px] truncate font-bold">
        {props.value}
      </span>
    </div>
  );
}

function QuickButton(props: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-center transition hover:bg-white/[0.08]"
    >
      <span className="block text-lg">
        {props.icon}
      </span>
      <span className="mt-1 block text-xs font-bold">
        {props.label}
      </span>
    </button>
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

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
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