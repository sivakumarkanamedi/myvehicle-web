"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/supabase";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type JourneyEvent = {
  id: string;
  type:
    | "journey_started"
    | "location_update"
    | "stop_detected"
    | "stop_reason_added"
    | "journey_resumed"
    | "journey_completed";
  title: string;
  description: string;
  createdAt: string;
  coordinates?: Coordinates | null;
};

type JourneyState = {
  journeyId: number | null;
  status: "idle" | "active" | "paused" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  origin: Coordinates | null;
  destinationName: string;
  destination: Coordinates | null;
  currentLocation: Coordinates | null;
  distanceMeters: number;
  stopStartedAt: string | null;
  totalStopSeconds: number;
};

const initialJourney: JourneyState = {
  journeyId: null,
  status: "idle",
  startedAt: null,
  completedAt: null,
  origin: null,
  destinationName: "",
  destination: null,
  currentLocation: null,
  distanceMeters: 0,
  stopStartedAt: null,
  totalStopSeconds: 0,
};

const stopReasons = [
  "Tea break",
  "Food stop",
  "Fuel stop",
  "EV charging",
  "Restroom",
  "Shopping",
  "Picking someone up",
  "Dropping someone off",
  "Vehicle issue",
  "Personal stop",
  "Other",
];

export default function JourneyIntelligencePage() {
  const [journey, setJourney] =
    useState<JourneyState>(initialJourney);

  const [events, setEvents] =
    useState<JourneyEvent[]>([]);

  const [destinationLatitude, setDestinationLatitude] =
    useState("");

  const [destinationLongitude, setDestinationLongitude] =
    useState("");

  const [destinationName, setDestinationName] =
    useState("");

  const [selectedStopReason, setSelectedStopReason] =
    useState(stopReasons[0]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const watchIdRef =
    useRef<number | null>(null);

  const lastLocationRef =
    useRef<Coordinates | null>(null);

  const lastMovementAtRef =
    useRef<number>(Date.now());

  const stopTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stopLocationWatch();
    };
  }, []);

  const durationSeconds = useMemo(() => {
    if (!journey.startedAt) {
      return 0;
    }

    const endTime =
      journey.completedAt
        ? new Date(journey.completedAt).getTime()
        : Date.now();

    return Math.max(
      0,
      Math.floor(
        (endTime -
          new Date(journey.startedAt).getTime()) /
          1000
      )
    );
  }, [journey.startedAt, journey.completedAt, journey.status]);

  const drivingSeconds = Math.max(
    0,
    durationSeconds - journey.totalStopSeconds
  );

  async function startJourney() {
    if (loading) {
      return;
    }

    setError("");
    setMessage("");

    const destination = validateCoordinates(
      destinationLatitude,
      destinationLongitude
    );

    if (!destination) {
      setError(
        "Enter valid destination latitude and longitude."
      );
      return;
    }

    setLoading(true);

    try {
      const origin = await getCurrentPosition();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Please sign in again before starting a journey."
        );
      }

      const startedAt = new Date().toISOString();

      const { data, error: insertError } =
        await supabase
          .from("navigation_journeys")
          .insert({
            user_id: user.id,
            status: "active",
            started_at: startedAt,
            origin,
            destination,
            destination_name:
              destinationName.trim() ||
              "Selected destination",
            distance_meters: 0,
            total_stop_seconds: 0,
            created_at: startedAt,
            updated_at: startedAt,
          })
          .select("id")
          .single();

      if (insertError) {
        throw insertError;
      }

      const firstEvent: JourneyEvent = {
        id: crypto.randomUUID(),
        type: "journey_started",
        title: "Journey started",
        description:
          `Navigation started to ${
            destinationName.trim() ||
            "selected destination"
          }.`,
        createdAt: startedAt,
        coordinates: origin,
      };

      setJourney({
        journeyId: Number(data.id),
        status: "active",
        startedAt,
        completedAt: null,
        origin,
        destinationName:
          destinationName.trim() ||
          "Selected destination",
        destination,
        currentLocation: origin,
        distanceMeters: 0,
        stopStartedAt: null,
        totalStopSeconds: 0,
      });

      setEvents([firstEvent]);

      lastLocationRef.current = origin;
      lastMovementAtRef.current = Date.now();

      await saveJourneyEvent(
        Number(data.id),
        firstEvent
      );

      startLocationWatch(
        Number(data.id)
      );

      setMessage(
        "Journey started. Mira is tracking your route and stops."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start journey."
      );
    } finally {
      setLoading(false);
    }
  }

  function startLocationWatch(
    journeyId: number
  ) {
    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by this browser."
      );
      return;
    }

    stopLocationWatch();

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation: Coordinates = {
            latitude:
              position.coords.latitude,
            longitude:
              position.coords.longitude,
          };

          void processLocationUpdate(
            journeyId,
            nextLocation,
            position.coords.speed
          );
        },
        (geoError) => {
          setError(
            geoError.message ||
              "Unable to track current location."
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );

    stopTimerRef.current = setInterval(
      () => {
        void checkForStop(journeyId);
      },
      30000
    );
  }

  async function processLocationUpdate(
    journeyId: number,
    location: Coordinates,
    speed: number | null
  ) {
    const previous =
      lastLocationRef.current;

    const movedMeters = previous
      ? haversineDistance(
          previous,
          location
        )
      : 0;

    if (
      movedMeters >= 20 ||
      Number(speed ?? 0) > 1.5
    ) {
      lastMovementAtRef.current =
        Date.now();

      if (
        journey.status === "paused" &&
        journey.stopStartedAt
      ) {
        await resumeJourney(
          journeyId,
          location
        );
      }
    }

    lastLocationRef.current =
      location;

    setJourney((current) => ({
      ...current,
      currentLocation:
        location,
      distanceMeters:
        current.distanceMeters +
        movedMeters,
    }));

    await supabase
      .from("navigation_journeys")
      .update({
        current_location:
          location,
        distance_meters:
          journey.distanceMeters +
          movedMeters,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", journeyId);
  }

  async function checkForStop(
    journeyId: number
  ) {
    if (
      journey.status !== "active"
    ) {
      return;
    }

    const stationarySeconds =
      Math.floor(
        (Date.now() -
          lastMovementAtRef.current) /
          1000
      );

    if (
      stationarySeconds < 180
    ) {
      return;
    }

    const stoppedAt =
      new Date().toISOString();

    const stopEvent: JourneyEvent = {
      id: crypto.randomUUID(),
      type: "stop_detected",
      title: "Stop detected",
      description:
        "Mira detected that the vehicle has been stationary for approximately three minutes.",
      createdAt: stoppedAt,
      coordinates:
        lastLocationRef.current,
    };

    setJourney((current) => ({
      ...current,
      status: "paused",
      stopStartedAt:
        stoppedAt,
    }));

    setEvents((current) => [
      ...current,
      stopEvent,
    ]);

    await Promise.all([
      supabase
        .from("navigation_journeys")
        .update({
          status: "paused",
          stop_started_at:
            stoppedAt,
          updated_at:
            stoppedAt,
        })
        .eq("id", journeyId),

      saveJourneyEvent(
        journeyId,
        stopEvent
      ),
    ]);

    setMessage(
      "Mira detected a stop. Select the reason when convenient."
    );
  }

  async function addStopReason() {
    if (
      !journey.journeyId ||
      !journey.stopStartedAt
    ) {
      return;
    }

    const event: JourneyEvent = {
      id: crypto.randomUUID(),
      type: "stop_reason_added",
      title: selectedStopReason,
      description:
        `Stop reason updated as ${selectedStopReason}.`,
      createdAt:
        new Date().toISOString(),
      coordinates:
        journey.currentLocation,
    };

    setEvents((current) => [
      ...current,
      event,
    ]);

    await saveJourneyEvent(
      journey.journeyId,
      event,
      {
        stop_reason:
          selectedStopReason,
      }
    );

    setMessage(
      "Stop reason saved."
    );
  }

  async function resumeJourney(
    journeyId = journey.journeyId,
    location =
      journey.currentLocation
  ) {
    if (
      !journeyId ||
      !journey.stopStartedAt
    ) {
      return;
    }

    const resumedAt =
      new Date().toISOString();

    const stopSeconds =
      Math.max(
        0,
        Math.floor(
          (new Date(resumedAt).getTime() -
            new Date(
              journey.stopStartedAt
            ).getTime()) /
            1000
        )
      );

    const event: JourneyEvent = {
      id: crypto.randomUUID(),
      type: "journey_resumed",
      title: "Journey resumed",
      description:
        "Vehicle movement resumed after the stop.",
      createdAt:
        resumedAt,
      coordinates:
        location,
    };

    setJourney((current) => ({
      ...current,
      status: "active",
      stopStartedAt: null,
      totalStopSeconds:
        current.totalStopSeconds +
        stopSeconds,
    }));

    setEvents((current) => [
      ...current,
      event,
    ]);

    await Promise.all([
      supabase
        .from("navigation_journeys")
        .update({
          status: "active",
          stop_started_at: null,
          total_stop_seconds:
            journey.totalStopSeconds +
            stopSeconds,
          updated_at:
            resumedAt,
        })
        .eq("id", journeyId),

      saveJourneyEvent(
        journeyId,
        event
      ),
    ]);

    lastMovementAtRef.current =
      Date.now();

    setMessage(
      "Journey resumed."
    );
  }

  async function completeJourney() {
    if (
      !journey.journeyId ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const completedAt =
        new Date().toISOString();

      let finalStopSeconds =
        journey.totalStopSeconds;

      if (
        journey.stopStartedAt
      ) {
        finalStopSeconds +=
          Math.max(
            0,
            Math.floor(
              (new Date(completedAt).getTime() -
                new Date(
                  journey.stopStartedAt
                ).getTime()) /
                1000
            )
          );
      }

      const completedEvent: JourneyEvent = {
        id: crypto.randomUUID(),
        type: "journey_completed",
        title: "Destination reached",
        description:
          `Journey to ${journey.destinationName} completed.`,
        createdAt:
          completedAt,
        coordinates:
          journey.currentLocation,
      };

      const {
        error: updateError,
      } = await supabase
        .from("navigation_journeys")
        .update({
          status: "completed",
          completed_at:
            completedAt,
          current_location:
            journey.currentLocation,
          distance_meters:
            journey.distanceMeters,
          total_stop_seconds:
            finalStopSeconds,
          updated_at:
            completedAt,
        })
        .eq(
          "id",
          journey.journeyId
        );

      if (updateError) {
        throw updateError;
      }

      await saveJourneyEvent(
        journey.journeyId,
        completedEvent
      );

      setJourney((current) => ({
        ...current,
        status: "completed",
        completedAt,
        stopStartedAt: null,
        totalStopSeconds:
          finalStopSeconds,
      }));

      setEvents((current) => [
        ...current,
        completedEvent,
      ]);

      stopLocationWatch();

      setMessage(
        "Journey completed successfully."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to complete journey."
      );
    } finally {
      setLoading(false);
    }
  }

  function stopLocationWatch() {
    if (
      watchIdRef.current !== null
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;
    }

    if (
      stopTimerRef.current
    ) {
      clearInterval(
        stopTimerRef.current
      );

      stopTimerRef.current = null;
    }
  }

  async function shareJourney() {
    const text =
      journey.status === "idle"
        ? "No active journey."
        : (
            `I am travelling to ${journey.destinationName}. ` +
            `Current distance tracked: ${formatDistance(
              journey.distanceMeters
            )}.`
          );

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            "My Vehicle Journey",
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(
        text
      );

      setMessage(
        "Journey summary copied to clipboard."
      );
    } catch {
      setError(
        "Unable to share journey."
      );
    }
  }

  const canStart =
    journey.status === "idle" ||
    journey.status === "completed";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Journey Intelligence
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Track journey progress, stops, distance, driving time and journey events with user-controlled sharing.
          </p>
        </header>

        {error ? (
          <Alert
            tone="error"
            text={error}
          />
        ) : null}

        {message ? (
          <Alert
            tone="success"
            text={message}
          />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <div>
              <h2 className="text-xl font-bold">
                Journey setup
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter destination details and start tracking.
              </p>
            </div>

            <Field
              label="Destination name"
              value={destinationName}
              placeholder="For example Bengaluru Airport"
              onChange={setDestinationName}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Destination latitude"
                value={destinationLatitude}
                placeholder="12.971599"
                onChange={setDestinationLatitude}
              />

              <Field
                label="Destination longitude"
                value={destinationLongitude}
                placeholder="77.594566"
                onChange={setDestinationLongitude}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  void startJourney()
                }
                disabled={
                  !canStart ||
                  loading
                }
                className="rounded-2xl bg-blue-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Processing..."
                  : "Start journey"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void completeJourney()
                }
                disabled={
                  !["active", "paused"].includes(
                    journey.status
                  ) ||
                  loading
                }
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete journey
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                void shareJourney()
              }
              disabled={
                journey.status === "idle"
              }
              className="w-full rounded-2xl border border-blue-400/30 bg-blue-400/10 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Share journey
            </button>

            {journey.status === "paused" ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="font-semibold text-amber-100">
                  Stop detected
                </p>

                <select
                  value={selectedStopReason}
                  onChange={(event) =>
                    setSelectedStopReason(
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
                >
                  {stopReasons.map(
                    (reason) => (
                      <option
                        key={reason}
                        value={reason}
                      >
                        {reason}
                      </option>
                    )
                  )}
                </select>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      void addStopReason()
                    }
                    className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950"
                  >
                    Save stop reason
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void resumeJourney()
                    }
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Resume journey
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Status"
                value={formatLabel(
                  journey.status
                )}
              />

              <MetricCard
                label="Distance"
                value={formatDistance(
                  journey.distanceMeters
                )}
              />

              <MetricCard
                label="Driving time"
                value={formatDuration(
                  drivingSeconds
                )}
              />

              <MetricCard
                label="Stop time"
                value={formatDuration(
                  journey.totalStopSeconds
                )}
              />
            </div>

            <section>
              <h2 className="text-xl font-bold">
                Journey timeline
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Important events recorded during this journey.
              </p>

              <div className="mt-5 space-y-3">
                {events.length ? (
                  events.map((event) => (
                    <TimelineItem
                      key={event.id}
                      event={event}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                    Start a journey to create the timeline.
                  </div>
                )}
              </div>
            </section>
          </article>
        </section>

        <div className="pb-4">
          <Link
            href="/navigation"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Mira Navigation
          </Link>
        </div>
      </div>
    </main>
  );
}

async function getCurrentPosition(): Promise<Coordinates> {
  if (!navigator.geolocation) {
    throw new Error(
      "Geolocation is not supported by this browser."
    );
  }

  const position =
    await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      }
    );

  return {
    latitude:
      position.coords.latitude,
    longitude:
      position.coords.longitude,
  };
}

async function saveJourneyEvent(
  journeyId: number,
  event: JourneyEvent,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from("navigation_journey_events")
    .insert({
      journey_id:
        journeyId,
      event_type:
        event.type,
      title:
        event.title,
      description:
        event.description,
      coordinates:
        event.coordinates ??
        null,
      metadata,
      created_at:
        event.createdAt,
    });

  if (error) {
    console.warn(
      "Unable to save journey event:",
      error.message
    );
  }
}

function validateCoordinates(
  latitudeValue: string,
  longitudeValue: string
): Coordinates | null {
  const latitude =
    Number(latitudeValue);

  const longitude =
    Number(longitudeValue);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function haversineDistance(
  first: Coordinates,
  second: Coordinates
) {
  const earthRadius =
    6371000;

  const latitudeOne =
    toRadians(
      first.latitude
    );

  const latitudeTwo =
    toRadians(
      second.latitude
    );

  const latitudeDifference =
    toRadians(
      second.latitude -
        first.latitude
    );

  const longitudeDifference =
    toRadians(
      second.longitude -
        first.longitude
    );

  const value =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(latitudeOne) *
      Math.cos(latitudeTwo) *
      Math.sin(
        longitudeDifference / 2
      ) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )
  );
}

function toRadians(
  value: number
) {
  return (
    value *
    (Math.PI / 180)
  );
}

function Field(props: {
  label: string;
  value: string;
  placeholder?: string;
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
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-blue-400/50"
      />
    </label>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </article>
  );
}

function TimelineItem(props: {
  event: JourneyEvent;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {props.event.title}
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {props.event.description}
          </p>
        </div>

        <span className="text-xs text-slate-600">
          {formatDateTime(
            props.event.createdAt
          )}
        </span>
      </div>
    </article>
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

function formatDistance(
  meters: number
) {
  if (meters < 1000) {
    return `${Math.round(
      meters
    )} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(2)} km`;
}

function formatDuration(
  seconds: number
) {
  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
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

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
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