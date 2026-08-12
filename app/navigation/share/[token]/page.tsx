"use client";

import Link from "next/link";
import {
  FormEvent,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import MiraMap from "../../components/MiraMap";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type SharedEvent = {
  id: number;
  event_type: string;
  title: string;
  description: string | null;
  coordinates: Coordinates | null;
  created_at: string;
};

type SharedJourney = {
  id: number;
  status: string;
  destination_name: string | null;
  current_location: Coordinates | null;
  destination: Coordinates | null;
  started_at: string;
  completed_at: string | null;
  distance_meters: number;
  total_stop_seconds: number | null;
  estimated_arrival_time: string | null;
  updated_at: string;
  expires_at: string | null;
  permissions: {
    current_location: boolean;
    destination: boolean;
    eta: boolean;
    stops: boolean;
  };
  events: SharedEvent[];
};

type SharedJourneyResponse = {
  success?: boolean;
  journey?: SharedJourney;
  error?: string;
  expired?: boolean;
};

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default function SharedJourneyViewerPage({
  params,
}: PageProps) {
  const { token } = use(params);

  const [journey, setJourney] =
    useState<SharedJourney | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastLoadedAt, setLastLoadedAt] =
    useState<string | null>(null);

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain the shared ETA, progress, stops, privacy permissions and latest journey updates."
    );

  const [viewerMessage, setViewerMessage] =
    useState("");

  useEffect(() => {
    void loadJourney(false);

    const timer = window.setInterval(
      () => {
        void loadJourney(true);
      },
      15000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [token]);

  async function loadJourney(
    backgroundRefresh: boolean
  ) {
    if (backgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `/api/navigation/share/${encodeURIComponent(
          token
        )}`,
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as SharedJourneyResponse;

      if (!response.ok || !data.journey) {
        throw new Error(
          data.error ||
            "Unable to load this shared journey."
        );
      }

      setJourney(data.journey);
      setError("");
      setLastLoadedAt(
        new Date().toISOString()
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load this shared journey."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const remainingDistanceKm =
    useMemo(() => {
      if (
        !journey?.current_location ||
        !journey.destination
      ) {
        return null;
      }

      return (
        haversineDistance(
          journey.current_location,
          journey.destination
        ) / 1000
      );
    }, [journey]);

  const progressPercent = useMemo(() => {
    if (
      !journey ||
      remainingDistanceKm === null ||
      journey.distance_meters <= 0
    ) {
      return null;
    }

    const trackedKm =
      journey.distance_meters / 1000;

    const estimatedTotalKm =
      trackedKm + remainingDistanceKm;

    if (estimatedTotalKm <= 0) {
      return null;
    }

    return Math.min(
      100,
      Math.max(
        0,
        (trackedKm / estimatedTotalKm) * 100
      )
    );
  }, [journey, remainingDistanceKm]);

  const expiresIn = useMemo(() => {
    if (!journey?.expires_at) {
      return "Until sharing is disabled";
    }

    const remainingMs =
      new Date(
        journey.expires_at
      ).getTime() - Date.now();

    if (remainingMs <= 0) {
      return "Expired";
    }

    const totalMinutes =
      Math.ceil(
        remainingMs / 60000
      );

    const hours =
      Math.floor(
        totalMinutes / 60
      );

    const minutes =
      totalMinutes % 60;

    return hours > 0
      ? `${hours}h ${minutes}m remaining`
      : `${minutes} min remaining`;
  }, [journey, lastLoadedAt]);

  const shareExpired =
    journey?.expires_at
      ? new Date(
          journey.expires_at
        ).getTime() <= Date.now()
      : false;

  async function copyJourneySummary() {
    if (!journey) return;

    const text =
      `${journey.destination_name || "Shared journey"} · ` +
      `Status: ${formatLabel(journey.status)} · ` +
      `ETA: ${
        journey.estimated_arrival_time
          ? formatTime(
              journey.estimated_arrival_time
            )
          : "Not shared"
      } · ` +
      `Link: ${window.location.href}`;

    try {
      await navigator.clipboard.writeText(
        text
      );

      setViewerMessage(
        "Journey summary copied to the clipboard."
      );
    } catch {
      setViewerMessage(
        "The browser could not copy the journey summary."
      );
    }
  }

  async function shareJourneyLink() {
    if (!journey) return;

    const text =
      `Track this journey to ${
        journey.destination_name ||
        "the destination"
      }.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            "My Vehicle Live Journey",
          text,
          url: window.location.href,
        });

        setViewerMessage(
          "Journey link shared successfully."
        );

        return;
      }

      await navigator.clipboard.writeText(
        window.location.href
      );

      setViewerMessage(
        "Journey link copied to the clipboard."
      );
    } catch {
      setViewerMessage(
        "Journey sharing was cancelled."
      );
    }
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!journey) return;

    const question =
      miraQuestion.trim().toLowerCase();

    if (!question) return;

    if (
      question.includes("eta") ||
      question.includes("arrive")
    ) {
      setMiraReply(
        journey.permissions.eta &&
        journey.estimated_arrival_time
          ? `The shared ETA is ${formatTime(
              journey.estimated_arrival_time
            )}.`
          : "The journey owner has not shared ETA information."
      );
    } else if (
      question.includes("location")
    ) {
      setMiraReply(
        journey.permissions.current_location &&
        journey.current_location
          ? `The current shared position is ${journey.current_location.latitude.toFixed(
              5
            )}, ${journey.current_location.longitude.toFixed(
              5
            )}.`
          : "The journey owner has hidden the current location."
      );
    } else if (
      question.includes("progress") ||
      question.includes("remaining")
    ) {
      setMiraReply(
        progressPercent !== null
          ? `The journey is approximately ${progressPercent.toFixed(
              0
            )}% complete, with ${
              remainingDistanceKm?.toFixed(
                1
              ) ?? "unknown"
            } km remaining.`
          : "There is not enough shared information to calculate journey progress."
      );
    } else if (
      question.includes("stop")
    ) {
      setMiraReply(
        journey.permissions.stops &&
        journey.total_stop_seconds !== null
          ? `Shared stop time is ${formatDuration(
              journey.total_stop_seconds
            )}.`
          : "The journey owner has hidden stop information."
      );
    } else if (
      question.includes("expire") ||
      question.includes("link")
    ) {
      setMiraReply(
        `This sharing link shows: ${expiresIn}.`
      );
    } else if (
      question.includes("privacy") ||
      question.includes("permission")
    ) {
      const shared: string[] = [];

      if (
        journey.permissions.current_location
      ) {
        shared.push("current location");
      }

      if (
        journey.permissions.destination
      ) {
        shared.push("destination");
      }

      if (journey.permissions.eta) {
        shared.push("ETA");
      }

      if (journey.permissions.stops) {
        shared.push("stops");
      }

      setMiraReply(
        shared.length
          ? `The owner has shared ${shared.join(
              ", "
            )}.`
          : "The owner has hidden all optional journey details."
      );
    } else {
      setMiraReply(
        `The journey status is ${formatLabel(
          journey.status
        )}. ${expiresIn}.`
      );
    }

    setMiraQuestion("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading shared journey...
          </p>
        </div>
      </main>
    );
  }

  if (!journey || error || shareExpired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-slate-900 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-300">
            Journey unavailable
          </p>

          <h1 className="mt-4 text-3xl font-bold">
            This sharing link cannot be opened
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-400">
            {error ||
              "This link has expired or journey sharing has been disabled."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950"
          >
            Open My Vehicle
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                My Vehicle Live Journey
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                {journey.destination_name ||
                  "Shared Journey"}
              </h1>

              <p className="mt-4 text-sm text-slate-400">
                Started{" "}
                {formatDateTime(
                  journey.started_at
                )}
              </p>
            </div>

            <StatusBadge
              value={journey.status}
            />
          </div>
        </header>

        {viewerMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {viewerMessage}
          </section>
        ) : null}

        {journey.status.toLowerCase() === "paused" ? (
          <section className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
            <strong>Sharing paused:</strong> the owner has paused journey updates. The last shared information remains visible.
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Status"
            value={formatLabel(
              journey.status
            )}
          />

          <Metric
            label="Distance tracked"
            value={`${(
              journey.distance_meters /
              1000
            ).toFixed(1)} km`}
          />

          <Metric
            label="Remaining"
            value={
              journey.permissions.current_location &&
              journey.permissions.destination &&
              remainingDistanceKm !== null
                ? `${remainingDistanceKm.toFixed(
                    1
                  )} km`
                : "Hidden"
            }
          />

          <Metric
            label="ETA"
            value={
              journey.permissions.eta &&
              journey.estimated_arrival_time
                ? formatTime(
                    journey.estimated_arrival_time
                  )
                : "Not shared"
            }
          />

          <Metric
            label="Stops"
            value={
              journey.permissions.stops &&
              journey.total_stop_seconds !==
                null
                ? formatDuration(
                    journey.total_stop_seconds
                  )
                : "Hidden"
            }
          />

          <Metric
            label="Link Expiry"
            value={expiresIn}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <MiraMap
            currentLocation={
              journey.permissions.current_location
                ? journey.current_location
                : null
            }
            destination={
              journey.permissions.destination
                ? journey.destination
                : null
            }
            destinationName={
              journey.destination_name ||
              "Destination"
            }
            showPlaceSearch={false}
            heightClassName="h-[620px]"
            onError={setError}
          />

          <aside className="space-y-6">
            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    Live update
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    This page refreshes every 15 seconds.
                  </p>
                </div>

                {refreshing ? (
                  <span className="text-xs font-semibold text-cyan-300">
                    Updating...
                  </span>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                <Detail
                  label="Journey updated"
                  value={formatDateTime(
                    journey.updated_at
                  )}
                />

                <Detail
                  label="Viewer refreshed"
                  value={
                    lastLoadedAt
                      ? formatDateTime(
                          lastLoadedAt
                        )
                      : "Not available"
                  }
                />

                <Detail
                  label="Link expires"
                  value={
                    journey.expires_at
                      ? formatDateTime(
                          journey.expires_at
                        )
                      : "When sharing is disabled"
                  }
                />
              </div>

              {progressPercent !== null ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Journey progress
                    </p>

                    <p className="text-sm font-bold text-cyan-200">
                      {progressPercent.toFixed(0)}%
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width: `${progressPercent}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() =>
                    void loadJourney(true)
                  }
                  disabled={refreshing}
                  className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-50"
                >
                  Refresh Now
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void shareJourneyLink()
                  }
                  className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-3 text-sm font-semibold text-fuchsia-100"
                >
                  Share Link
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void copyJourneySummary()
                  }
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
                >
                  Copy Summary
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Journey updates
              </h2>

              <div className="mt-5 space-y-3">
                {journey.events.length ? (
                  journey.events.map(
                    (event, index) => (
                      <TimelineItem
                        key={event.id}
                        event={event}
                        index={index}
                      />
                    )
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">
                    No shared journey updates.
                  </div>
                )}
              </div>
            </article>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Shared Information
            </h2>

            <div className="mt-5 space-y-3">
              <PermissionRow
                label="Current location"
                shared={
                  journey.permissions.current_location
                }
              />

              <PermissionRow
                label="Destination"
                shared={
                  journey.permissions.destination
                }
              />

              <PermissionRow
                label="Estimated arrival"
                shared={
                  journey.permissions.eta
                }
              />

              <PermissionRow
                label="Stop information"
                shared={
                  journey.permissions.stops
                }
              />
            </div>
          </article>

          <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
              Ask Mira About This Journey
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
              {miraReply}
            </p>

            <form
              onSubmit={askMira}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <input
                value={miraQuestion}
                onChange={(event) =>
                  setMiraQuestion(
                    event.target.value
                  )
                }
                placeholder="Ask about ETA, progress, stops, privacy or link expiry..."
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
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

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Safety note:</strong> this viewer is for journey awareness only. Contact the traveller or local emergency services directly if immediate help is required.
        </section>

        <p className="pb-4 text-center text-xs leading-5 text-slate-600">
          This live link only shows information that the journey owner chose to share.
        </p>
      </div>
    </main>
  );
}

function PermissionRow(props: {
  label: string;
  shared: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">
        {props.label}
      </span>

      <span
        className={
          props.shared
            ? "text-sm font-semibold text-emerald-300"
            : "text-sm font-semibold text-slate-600"
        }
      >
        {props.shared
          ? "Shared"
          : "Hidden"}
      </span>
    </div>
  );
}

function TimelineItem(props: {
  event: SharedEvent;
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
              formatLabel(
                props.event.event_type
              )}
          </p>

          <p className="mt-2 text-xs text-slate-600">
            {formatDateTime(
              props.event.created_at
            )}
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

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </article>
  );
}

function Detail(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-300">
        {props.value}
      </p>
    </div>
  );
}

function StatusBadge(props: {
  value: string;
}) {
  const normalized =
    props.value.toLowerCase();

  const classes =
    normalized === "active"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : normalized === "paused"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : normalized === "completed"
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.value)}
    </span>
  );
}

function haversineDistance(
  first: Coordinates,
  second: Coordinates
) {
  const earthRadius = 6371000;

  const latitudeOne =
    toRadians(first.latitude);

  const latitudeTwo =
    toRadians(second.latitude);

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

function formatDuration(
  seconds: number
) {
  const safeSeconds =
    Math.max(
      0,
      Number(seconds || 0)
    );

  const hours =
    Math.floor(
      safeSeconds / 3600
    );

  const minutes =
    Math.floor(
      (safeSeconds % 3600) /
        60
    );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} min`;
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

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

function formatTime(
  value: string
) {
  const date =
    new Date(value);

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
      hour: "2-digit",
      minute: "2-digit",
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