"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type WeatherLevel =
  | "clear"
  | "rain"
  | "fog"
  | "storm"
  | "heat";

type WeatherRisk =
  | "low"
  | "moderate"
  | "high"
  | "severe";

type RouteWeather = {
  id: number;
  location: string;
  distanceKm: number;
  condition: WeatherLevel;
  temperature: number;
  visibilityKm: number;
  windKph: number;
  rainChance: number;
  roadRisk: WeatherRisk;
  recommendedSpeedKph: number | null;
  expectedAt: string;
  advice: string;
};

const routeWeather: RouteWeather[] = [
  {
    id: 1,
    location: "Yeshwanthpur",
    distanceKm: 0,
    condition: "clear",
    temperature: 26,
    visibilityKm: 9,
    windKph: 8,
    rainChance: 10,
    roadRisk: "low",
    recommendedSpeedKph: null,
    expectedAt: "Now",
    advice: "Normal driving conditions.",
  },
  {
    id: 2,
    location: "Hebbal",
    distanceKm: 8,
    condition: "rain",
    temperature: 24,
    visibilityKm: 5,
    windKph: 14,
    rainChance: 72,
    roadRisk: "moderate",
    recommendedSpeedKph: 45,
    expectedAt: "In 18 min",
    advice:
      "Reduce speed, increase following distance and avoid sudden braking.",
  },
  {
    id: 3,
    location: "KR Puram",
    distanceKm: 18,
    condition: "fog",
    temperature: 23,
    visibilityKm: 2,
    windKph: 6,
    rainChance: 20,
    roadRisk: "high",
    recommendedSpeedKph: 35,
    expectedAt: "In 38 min",
    advice:
      "Use low-beam headlights, avoid sudden lane changes and increase following distance.",
  },
  {
    id: 4,
    location: "Marathahalli",
    distanceKm: 28,
    condition: "storm",
    temperature: 22,
    visibilityKm: 3,
    windKph: 32,
    rainChance: 88,
    roadRisk: "severe",
    recommendedSpeedKph: 25,
    expectedAt: "In 58 min",
    advice:
      "Heavy rain and wind may make driving unsafe. Consider delaying arrival or rerouting.",
  },
];

export default function WeatherAlongRoutePage() {
  const router = useRouter();

  const [selectedId, setSelectedId] =
    useState(1);

  const [voiceAlerts, setVoiceAlerts] =
    useState(true);

  const [autoReroute, setAutoReroute] =
    useState(true);

  const [avoidFloodRisk, setAvoidFloodRisk] =
    useState(true);

  const [liveProviderConnected] =
    useState(false);

  const [departureTime, setDepartureTime] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain route weather, visibility, rain, wind, driving risk and whether you should delay departure."
    );

  const [statusMessage, setStatusMessage] =
    useState("");

  const selectedWeather = useMemo(
    () =>
      routeWeather.find(
        (item) =>
          item.id === selectedId
      ) ?? routeWeather[0],
    [selectedId]
  );

  const highestRisk = useMemo(
    () =>
      [...routeWeather].sort(
        (first, second) =>
          weatherRiskScore(
            second.condition
          ) -
          weatherRiskScore(
            first.condition
          )
      )[0],
    []
  );

  const totalRiskScore = useMemo(() => {
    const score =
      routeWeather.reduce(
        (total, item) =>
          total +
          roadRiskWeight(
            item.roadRisk
          ),
        0
      );

    return Math.min(
      100,
      Math.round(
        (score /
          (routeWeather.length * 4)) *
          100
      )
    );
  }, []);

  const riskySegments = useMemo(
    () =>
      routeWeather.filter(
        (item) =>
          item.roadRisk === "high" ||
          item.roadRisk === "severe"
      ),
    []
  );

  const miraRecommendation = useMemo(() => {
    if (
      highestRisk.condition === "storm"
    ) {
      return `Severe weather is predicted near ${highestRisk.location}. Mira recommends slowing down and considering an alternate route or delayed departure.`;
    }

    if (
      highestRisk.condition === "fog"
    ) {
      return `Low visibility is expected near ${highestRisk.location}. Use low-beam lights and maintain extra distance.`;
    }

    if (
      highestRisk.condition === "rain"
    ) {
      return `Rain is expected near ${highestRisk.location}. Reduce speed and avoid sudden braking.`;
    }

    return "Weather conditions are suitable for the planned route.";
  }, [highestRisk]);

  const departureAdvice = useMemo(() => {
    if (!departureTime) {
      return "Set a departure time to compare it against the route weather timeline.";
    }

    const departure =
      new Date(departureTime);

    if (
      Number.isNaN(
        departure.getTime()
      )
    ) {
      return "Departure time is invalid.";
    }

    const hour =
      departure.getHours();

    if (
      highestRisk.condition === "storm" &&
      hour >= 13
    ) {
      return "Consider leaving earlier, before afternoon storm conditions intensify.";
    }

    if (
      highestRisk.condition === "fog" &&
      hour < 7
    ) {
      return "A later morning departure may provide better visibility.";
    }

    return "Your selected departure time appears reasonable for this demo forecast.";
  }, [
    departureTime,
    highestRisk,
  ]);

  function speakAlert() {
    if (
      !("speechSynthesis" in window)
    ) {
      setStatusMessage(
        "Voice alerts are not supported in this browser."
      );
      return;
    }

    const utterance =
      new SpeechSynthesisUtterance(
        miraRecommendation
      );

    utterance.lang = "en-IN";

    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(
      utterance
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
      question.includes("delay") ||
      question.includes("leave") ||
      question.includes("departure")
    ) {
      setMiraReply(
        departureAdvice
      );
    } else if (
      question.includes("safe") ||
      question.includes("risk")
    ) {
      setMiraReply(
        `The current route weather risk score is ${totalRiskScore}%. ${miraRecommendation}`
      );
    } else if (
      question.includes("speed")
    ) {
      setMiraReply(
        selectedWeather.recommendedSpeedKph
          ? `Near ${selectedWeather.location}, Mira suggests a cautious speed around ${selectedWeather.recommendedSpeedKph} km/h in this preview. Always follow posted limits and real road conditions.`
          : "No special speed reduction is suggested for the selected clear-weather segment."
      );
    } else if (
      question.includes("rain")
    ) {
      setMiraReply(
        `Rain chance near ${selectedWeather.location} is ${selectedWeather.rainChance}% in demo data.`
      );
    } else if (
      question.includes("fog") ||
      question.includes("visibility")
    ) {
      setMiraReply(
        `Visibility near ${selectedWeather.location} is estimated at ${selectedWeather.visibilityKm} km. ${selectedWeather.advice}`
      );
    } else if (
      question.includes("wind")
    ) {
      setMiraReply(
        `Wind near ${selectedWeather.location} is estimated at ${selectedWeather.windKph} km/h.`
      );
    } else {
      setMiraReply(
        `${selectedWeather.location} is expected to have ${formatLabel(
          selectedWeather.condition
        ).toLowerCase()} conditions with ${selectedWeather.visibilityKm} km visibility. ${selectedWeather.advice}`
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
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Weather Along Route
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            View rain, fog, wind, visibility and severe-weather risks
            along the route before reaching affected areas.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          {liveProviderConnected
            ? "Live route weather is connected."
            : "This page currently uses demo weather data. Production conditions require a weather provider matched to the active route, location and ETA."}
        </section>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Route Risk"
            value={`${totalRiskScore}%`}
          />

          <Metric
            label="Risky Segments"
            value={String(
              riskySegments.length
            )}
          />

          <Metric
            label="Highest Risk"
            value={formatLabel(
              highestRisk.roadRisk
            )}
          />

          <Metric
            label="Lowest Visibility"
            value={`${Math.min(
              ...routeWeather.map(
                (item) =>
                  item.visibilityKm
              )
            )} km`}
          />

          <Metric
            label="Peak Rain Chance"
            value={`${Math.max(
              ...routeWeather.map(
                (item) =>
                  item.rainChance
              )
            )}%`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Selected location
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review expected road-weather conditions.
              </p>
            </div>

            <div className="rounded-3xl border border-sky-400/30 bg-sky-400/10 p-6">
              <WeatherIcon
                condition={
                  selectedWeather.condition
                }
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-bold">
                  {selectedWeather.location}
                </h3>

                <RiskBadge
                  value={
                    selectedWeather.roadRisk
                  }
                />
              </div>

              <p className="mt-1 text-sm text-slate-400">
                {selectedWeather.distanceKm === 0
                  ? "Current location"
                  : `${selectedWeather.distanceKm} km ahead`}
                {" · "}
                {selectedWeather.expectedAt}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Temperature"
                  value={`${selectedWeather.temperature}°C`}
                />

                <Metric
                  label="Rain chance"
                  value={`${selectedWeather.rainChance}%`}
                />

                <Metric
                  label="Visibility"
                  value={`${selectedWeather.visibilityKm} km`}
                />

                <Metric
                  label="Wind"
                  value={`${selectedWeather.windKph} km/h`}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Driving advice
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {selectedWeather.advice}
                </p>

                <p className="mt-3 text-sm font-semibold text-sky-200">
                  {selectedWeather.recommendedSpeedKph
                    ? `Preview safe-speed guidance: ${selectedWeather.recommendedSpeedKph} km/h`
                    : "No special speed reduction suggested."}
                </p>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Planned departure
              </span>

              <input
                type="datetime-local"
                value={departureTime}
                onChange={(event) =>
                  setDepartureTime(
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Departure guidance
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {departureAdvice}
              </p>
            </div>

            <ToggleField
              label="Voice weather alerts"
              checked={voiceAlerts}
              onChange={setVoiceAlerts}
            />

            <ToggleField
              label="Auto-reroute for severe weather"
              checked={autoReroute}
              onChange={setAutoReroute}
            />

            <ToggleField
              label="Avoid flood-risk roads"
              checked={avoidFloodRisk}
              onChange={setAvoidFloodRisk}
            />

            <button
              type="button"
              onClick={speakAlert}
              disabled={!voiceAlerts}
              className="w-full rounded-2xl border border-sky-400/30 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-100 disabled:opacity-40"
            >
              Read Weather Alert
            </button>
          </aside>

          <section className="space-y-6">
            <article className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Mira Recommendation
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Weather-aware guidance
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {miraRecommendation}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openCoDriver}
                  className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  Ask Mira in Co-Driver
                </button>

                <Link
                  href="/navigation"
                  className="rounded-2xl border border-white/10 px-5 py-3 text-center text-sm font-semibold text-cyan-100"
                >
                  Review Route
                </Link>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Route Weather Timeline
              </h2>

              <div className="mt-5 space-y-4">
                {routeWeather.map(
                  (item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          item.id
                        )
                      }
                      className={
                        item.id === selectedId
                          ? "w-full rounded-2xl border border-sky-400/40 bg-sky-400/10 p-5 text-left"
                          : "w-full rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-sky-400/30"
                      }
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm font-bold">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="font-bold">
                                {item.location}
                              </h3>

                              <p className="mt-1 text-sm text-slate-500">
                                {item.distanceKm === 0
                                  ? "Current location"
                                  : `${item.distanceKm} km ahead`}
                                {" · "}
                                {item.expectedAt}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <WeatherBadge
                                condition={
                                  item.condition
                                }
                              />

                              <RiskBadge
                                value={
                                  item.roadRisk
                                }
                              />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <SmallDetail
                              label="Temp"
                              value={`${item.temperature}°C`}
                            />

                            <SmallDetail
                              label="Rain"
                              value={`${item.rainChance}%`}
                            />

                            <SmallDetail
                              label="Visibility"
                              value={`${item.visibilityKm} km`}
                            />

                            <SmallDetail
                              label="Wind"
                              value={`${item.windKph} km/h`}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                )}
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
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  value={miraQuestion}
                  onChange={(event) =>
                    setMiraQuestion(
                      event.target.value
                    )
                  }
                  placeholder="Ask about rain, visibility, speed, risk or departure..."
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    !miraQuestion.trim()
                  }
                  className="rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  Ask Mira
                </button>
              </form>
            </article>
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Route-Segment Weather"
            description="Shows weather conditions expected at different points along the journey."
          />

          <FeatureCard
            title="Driving Risk"
            description="Combines rain, wind and visibility into a route-weather risk score."
          />

          <FeatureCard
            title="Departure Guidance"
            description="Suggests whether leaving earlier or later may reduce weather exposure."
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

function WeatherIcon(props: {
  condition: WeatherLevel;
}) {
  const icon =
    props.condition === "storm"
      ? "⛈️"
      : props.condition === "rain"
        ? "🌧️"
        : props.condition === "fog"
          ? "🌫️"
          : props.condition === "heat"
            ? "☀️"
            : "🌤️";

  return (
    <div className="text-6xl">
      {icon}
    </div>
  );
}

function WeatherBadge(props: {
  condition: WeatherLevel;
}) {
  const classes =
    props.condition === "storm"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : props.condition === "rain"
        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
        : props.condition === "fog"
          ? "border-slate-400/30 bg-slate-400/10 text-slate-200"
          : props.condition === "heat"
            ? "border-orange-400/30 bg-orange-400/10 text-orange-200"
            : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(
        props.condition
      )}
    </span>
  );
}

function RiskBadge(props: {
  value: WeatherRisk;
}) {
  const classes =
    props.value === "severe"
      ? "border-rose-500/40 bg-rose-500/20 text-rose-100"
      : props.value === "high"
        ? "border-orange-400/30 bg-orange-400/10 text-orange-200"
        : props.value === "moderate"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(
        props.value
      )}
    </span>
  );
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

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </div>
  );
}

function SmallDetail(props: {
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

function weatherRiskScore(
  condition: WeatherLevel
) {
  if (condition === "storm") {
    return 5;
  }

  if (condition === "fog") {
    return 4;
  }

  if (condition === "rain") {
    return 3;
  }

  if (condition === "heat") {
    return 2;
  }

  return 1;
}

function roadRiskWeight(
  risk: WeatherRisk
) {
  if (risk === "severe") {
    return 4;
  }

  if (risk === "high") {
    return 3;
  }

  if (risk === "moderate") {
    return 2;
  }

  return 1;
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