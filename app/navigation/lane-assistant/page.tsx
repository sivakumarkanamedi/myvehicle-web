"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type LaneStatus =
  | "recommended"
  | "busy"
  | "avoid"
  | "restricted";

type LanePosition =
  | "left"
  | "middle"
  | "right";

type LaneInfo = {
  id: number;
  position: LanePosition;
  name: string;
  status: LaneStatus;
  reason: string;
  speedKph: number;
  trafficLevel: "light" | "moderate" | "heavy";
  restricted: boolean;
  mergeAhead: boolean;
  suitableForTurn:
    | "left"
    | "right"
    | "straight"
    | "none";
};

const initialLanes: LaneInfo[] = [
  {
    id: 1,
    position: "left",
    name: "Left Lane",
    status: "recommended",
    reason:
      "Best flow for the current route and upcoming turn.",
    speedKph: 42,
    trafficLevel: "light",
    restricted: false,
    mergeAhead: false,
    suitableForTurn: "right",
  },
  {
    id: 2,
    position: "middle",
    name: "Middle Lane",
    status: "busy",
    reason:
      "Moderate congestion with frequent braking.",
    speedKph: 31,
    trafficLevel: "moderate",
    restricted: false,
    mergeAhead: true,
    suitableForTurn: "straight",
  },
  {
    id: 3,
    position: "right",
    name: "Right Lane",
    status: "avoid",
    reason:
      "Construction and lane narrowing reported ahead.",
    speedKph: 18,
    trafficLevel: "heavy",
    restricted: false,
    mergeAhead: true,
    suitableForTurn: "none",
  },
];

export default function LaneAssistantPage() {
  const router = useRouter();

  const [lanes, setLanes] =
    useState<LaneInfo[]>(initialLanes);

  const [currentLane, setCurrentLane] =
    useState<LanePosition>("middle");

  const [nextTurn, setNextTurn] =
    useState<"left" | "right" | "straight">("right");

  const [distanceToTurnMeters, setDistanceToTurnMeters] =
    useState(800);

  const [cameraConnected] =
    useState(false);

  const [mapLaneDataConnected] =
    useState(false);

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain the recommended lane, merge risk and upcoming turn guidance. Live lane detection requires camera and map-lane data."
    );

  const [statusMessage, setStatusMessage] =
    useState("");

  const recommendedLane = useMemo(
    () =>
      lanes.find(
        (lane) =>
          lane.status === "recommended"
      ) ??
      lanes[0] ??
      null,
    [lanes]
  );

  const currentLaneInfo = useMemo(
    () =>
      lanes.find(
        (lane) =>
          lane.position === currentLane
      ) ?? null,
    [lanes, currentLane]
  );

  const laneChangeRecommended =
    Boolean(
      recommendedLane &&
      recommendedLane.position !== currentLane
    );

  const laneChangeSafe = useMemo(() => {
    if (!recommendedLane) return false;

    return (
      !recommendedLane.restricted &&
      recommendedLane.trafficLevel !== "heavy" &&
      !recommendedLane.mergeAhead
    );
  }, [recommendedLane]);

  const confidence = useMemo(() => {
    if (
      cameraConnected &&
      mapLaneDataConnected
    ) {
      return 97;
    }

    if (
      cameraConnected ||
      mapLaneDataConnected
    ) {
      return 74;
    }

    return 46;
  }, [
    cameraConnected,
    mapLaneDataConnected,
  ]);

  const guidanceText = useMemo(() => {
    if (!recommendedLane) {
      return "No lane recommendation is available.";
    }

    if (
      recommendedLane.position === currentLane
    ) {
      return `Stay in the ${recommendedLane.name.toLowerCase()} for the next ${formatDistance(
        distanceToTurnMeters
      )}.`;
    }

    if (!laneChangeSafe) {
      return `The ${recommendedLane.name.toLowerCase()} may be better, but wait until the lane change is clearly safe.`;
    }

    return `When safe, move to the ${recommendedLane.name.toLowerCase()} and remain there for the next ${formatDistance(
      distanceToTurnMeters
    )}.`;
  }, [
    recommendedLane,
    currentLane,
    laneChangeSafe,
    distanceToTurnMeters,
  ]);

  function chooseLane(
    position: LanePosition
  ) {
    setCurrentLane(position);

    const lane = lanes.find(
      (item) =>
        item.position === position
    );

    setStatusMessage(
      lane
        ? `Current lane set to ${lane.name}.`
        : "Lane selection updated."
    );
  }

  function simulateLaneUpdate() {
    setLanes((current) =>
      current.map((lane) =>
        lane.position === "middle"
          ? {
              ...lane,
              status: "recommended",
              reason:
                "Traffic has cleared and this lane now offers the best flow.",
              speedKph: 44,
              trafficLevel: "light",
              mergeAhead: false,
            }
          : lane.position === "left"
            ? {
                ...lane,
                status: "busy",
                reason:
                  "Traffic has slowed near the upcoming junction.",
                speedKph: 29,
                trafficLevel: "moderate",
              }
            : lane
      )
    );

    setStatusMessage(
      "Lane conditions updated in preview mode."
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
      question.includes("which lane") ||
      question.includes("best lane")
    ) {
      setMiraReply(
        recommendedLane
          ? `${recommendedLane.name} is currently recommended because ${recommendedLane.reason.toLowerCase()}`
          : "No lane recommendation is available."
      );
    } else if (
      question.includes("safe") ||
      question.includes("change")
    ) {
      setMiraReply(
        laneChangeSafe
          ? "The recommended lane currently appears suitable, but check mirrors, blind spots and surrounding traffic before changing lanes."
          : "Do not change lanes yet. Wait for a clear gap and verify your blind spots."
      );
    } else if (
      question.includes("turn") ||
      question.includes("next")
    ) {
      setMiraReply(
        `Your next manoeuvre is ${nextTurn}. ${guidanceText}`
      );
    } else if (
      question.includes("restricted") ||
      question.includes("bus lane")
    ) {
      const restrictedLane =
        lanes.find(
          (lane) =>
            lane.restricted
        );

      setMiraReply(
        restrictedLane
          ? `${restrictedLane.name} is restricted. Avoid entering it unless signs clearly permit your vehicle.`
          : "No restricted or bus lane is currently shown in this preview."
      );
    } else {
      setMiraReply(guidanceText);
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
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Smart Lane Assistant
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review the current lane, recommended lane, merge risk,
            upcoming turn and Mira&apos;s safety-first lane guidance.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          live lane detection requires camera input, vehicle position,
          road-lane geometry and map-provider lane guidance. This page
          currently uses structured preview data.
        </section>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Current Lane"
            value={
              currentLaneInfo?.name ??
              "Unknown"
            }
          />

          <Metric
            label="Recommended Lane"
            value={
              recommendedLane?.name ??
              "Unavailable"
            }
          />

          <Metric
            label="Next Turn"
            value={formatLabel(
              nextTurn
            )}
          />

          <Metric
            label="Turn Distance"
            value={formatDistance(
              distanceToTurnMeters
            )}
          />

          <Metric
            label="AI Confidence"
            value={`${confidence}%`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Lane Overview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select your current lane and review Mira&apos;s recommendation.
                </p>
              </div>

              <button
                type="button"
                onClick={simulateLaneUpdate}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              >
                Simulate Lane Update
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {lanes.map(
                (lane) => (
                  <button
                    key={lane.id}
                    type="button"
                    onClick={() =>
                      chooseLane(
                        lane.position
                      )
                    }
                    className={
                      lane.position ===
                      currentLane
                        ? "rounded-3xl border border-cyan-400/40 bg-cyan-400/10 p-5 text-left"
                        : "rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-left"
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xl font-bold">
                        {lane.name}
                      </h3>

                      <LaneStatusBadge
                        status={
                          lane.status
                        }
                      />
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {lane.reason}
                    </p>

                    <div className="mt-5 space-y-3">
                      <LaneDetail
                        label="Average speed"
                        value={`${lane.speedKph} km/h`}
                      />
                      <LaneDetail
                        label="Traffic"
                        value={formatLabel(
                          lane.trafficLevel
                        )}
                      />
                      <LaneDetail
                        label="Merge ahead"
                        value={
                          lane.mergeAhead
                            ? "Yes"
                            : "No"
                        }
                      />
                      <LaneDetail
                        label="Restricted lane"
                        value={
                          lane.restricted
                            ? "Yes"
                            : "No"
                        }
                      />
                    </div>
                  </button>
                )
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Mira Lane Guidance
              </p>

              <p className="mt-3 text-lg font-bold">
                {guidanceText}
              </p>

              <p className="mt-3 text-sm leading-6 text-fuchsia-50/80">
                Always check mirrors, indicators, blind spots, road markings
                and nearby traffic before changing lanes.
              </p>
            </div>
          </section>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                AI Recommendation
              </p>

              <h2 className="mt-3 text-3xl font-bold text-cyan-100">
                {recommendedLane
                  ? recommendedLane.name
                  : "Not available"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-cyan-50/80">
                {recommendedLane?.reason ??
                  "Mira does not currently have enough lane data."}
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <p className="text-sm font-semibold">
                  Lane-change check
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {laneChangeRecommended
                    ? laneChangeSafe
                      ? "A lane change may be helpful when a clear gap is available."
                      : "Do not change yet. The recommended lane has a merge or traffic risk."
                    : "You are already in the recommended lane."}
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Upcoming Manoeuvre
              </h2>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Next turn
                  </span>

                  <select
                    value={nextTurn}
                    onChange={(event) =>
                      setNextTurn(
                        event.target
                          .value as
                          | "left"
                          | "right"
                          | "straight"
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm"
                  >
                    <option value="left">
                      Left
                    </option>
                    <option value="right">
                      Right
                    </option>
                    <option value="straight">
                      Straight
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Distance to turn
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      distanceToTurnMeters
                    }
                    onChange={(event) =>
                      setDistanceToTurnMeters(
                        Math.max(
                          0,
                          Number(
                            event.target.value
                          ) || 0
                        )
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                  />
                </label>
              </div>
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
                  value={miraQuestion}
                  onChange={(event) =>
                    setMiraQuestion(
                      event.target.value
                    )
                  }
                  placeholder="Ask which lane or whether it is safe..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    !miraQuestion.trim()
                  }
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
            title="Lane Selection"
            description="Compares lane flow, traffic and upcoming route requirements."
          />

          <FeatureCard
            title="Merge Safety"
            description="Warns when a recommended lane has traffic, restrictions or a merge risk."
          />

          <FeatureCard
            title="Turn Preparation"
            description="Prepares the driver for the correct lane before the next manoeuvre."
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

function LaneDetail(props: {
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

function LaneStatusBadge(props: {
  status: LaneStatus;
}) {
  const classes =
    props.status === "recommended"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.status === "busy"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : props.status === "avoid"
          ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
          : "border-violet-400/30 bg-violet-400/10 text-violet-200";

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