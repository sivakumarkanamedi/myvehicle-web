"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type VehicleMode =
  | "car"
  | "bike"
  | "ev";

type StopType =
  | "start"
  | "breakfast"
  | "fuel"
  | "charging"
  | "food"
  | "rest"
  | "hotel"
  | "destination";

type TripStop = {
  id: number;
  type: StopType;
  title: string;
  location: string;
  distanceKm: number;
  durationMinutes: number;
  note: string;
};

type TripPlan = {
  start: string;
  destination: string;
  departureTime: string;
  vehicleMode: VehicleMode;
  distanceKm: number;
  driveMinutes: number;
  fuelCost: number;
  tollCost: number;
  foodCost: number;
  hotelCost: number;
};

const initialStops: TripStop[] = [
  {
    id: 1,
    type: "start",
    title: "Start",
    location: "Home",
    distanceKm: 0,
    durationMinutes: 0,
    note: "Begin journey after vehicle and document checks.",
  },
  {
    id: 2,
    type: "breakfast",
    title: "Breakfast",
    location: "Recommended Highway Restaurant",
    distanceKm: 45,
    durationMinutes: 30,
    note: "Family-friendly stop with washroom facilities.",
  },
  {
    id: 3,
    type: "fuel",
    title: "Fuel Stop",
    location: "IndianOil Highway Station",
    distanceKm: 118,
    durationMinutes: 15,
    note: "Recommended fuel stop based on current range.",
  },
  {
    id: 4,
    type: "food",
    title: "Lunch",
    location: "Family Restaurant",
    distanceKm: 210,
    durationMinutes: 45,
    note: "Good option before entering city traffic.",
  },
  {
    id: 5,
    type: "destination",
    title: "Destination",
    location: "Mysuru",
    distanceKm: 286,
    durationMinutes: 0,
    note: "Final destination.",
  },
];

const defaultPlan: TripPlan = {
  start: "Bengaluru",
  destination: "Mysuru",
  departureTime: "",
  vehicleMode: "car",
  distanceKm: 286,
  driveMinutes: 282,
  fuelCost: 1820,
  tollCost: 420,
  foodCost: 300,
  hotelCost: 0,
};

export default function TripPlannerPage() {
  const [plan, setPlan] =
    useState<TripPlan>(defaultPlan);

  const [stops, setStops] =
    useState<TripStop[]>(initialStops);

  const [avoidTolls, setAvoidTolls] =
    useState(false);

  const [familyFriendly, setFamilyFriendly] =
    useState(true);

  const [includeHotels, setIncludeHotels] =
    useState(false);

  const [includeEmergencyStops, setIncludeEmergencyStops] =
    useState(true);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can help with departure time, fuel stops, rest breaks, tolls, weather, family-friendly places and emergency support along the route."
    );

  const [newStopName, setNewStopName] =
    useState("");

  const [newStopDistance, setNewStopDistance] =
    useState("");

  const [newStopType, setNewStopType] =
    useState<StopType>("rest");

  const totalStopMinutes = useMemo(
    () =>
      stops.reduce(
        (total, stop) =>
          total + stop.durationMinutes,
        0
      ),
    [stops]
  );

  const totalTripMinutes =
    plan.driveMinutes + totalStopMinutes;

  const totalCost =
    plan.fuelCost +
    plan.tollCost +
    plan.foodCost +
    plan.hotelCost;

  const estimatedArrival = useMemo(() => {
    if (!plan.departureTime) {
      return "Not set";
    }

    const departure =
      new Date(plan.departureTime);

    if (
      Number.isNaN(
        departure.getTime()
      )
    ) {
      return "Not available";
    }

    const arrival =
      new Date(
        departure.getTime() +
          totalTripMinutes * 60_000
      );

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(arrival);
  }, [
    plan.departureTime,
    totalTripMinutes,
  ]);

  const bestDepartureAdvice = useMemo(() => {
    if (!plan.departureTime) {
      return "Set a departure time to receive traffic-aware timing guidance.";
    }

    const departure =
      new Date(plan.departureTime);

    if (
      Number.isNaN(
        departure.getTime()
      )
    ) {
      return "Departure time is invalid.";
    }

    const hour =
      departure.getHours();

    if (hour >= 8 && hour <= 10) {
      return "Consider leaving before 7:30 AM to avoid peak city traffic.";
    }

    if (hour >= 17 && hour <= 20) {
      return "Evening congestion may increase travel time. An earlier departure is recommended.";
    }

    return "Your selected departure time appears suitable for this demo route.";
  }, [plan.departureTime]);

  const insights = useMemo(
    () => [
      bestDepartureAdvice,
      "Rain may develop near Ramanagara after 2 PM. Verify live weather before departure.",
      plan.vehicleMode === "ev"
        ? "Plan charging stops with at least 20% battery reserve."
        : "Fuel stop recommended before the remaining range falls below 80 km.",
      "Take a 15-minute break after approximately two hours of continuous driving.",
      includeEmergencyStops
        ? "Emergency hospitals, police and fuel support should remain visible along the route."
        : "Emergency stop suggestions are currently disabled.",
      familyFriendly
        ? "Family-friendly food and washroom stops are prioritised."
        : "General stop recommendations are enabled.",
    ],
    [
      bestDepartureAdvice,
      plan.vehicleMode,
      includeEmergencyStops,
      familyFriendly,
    ]
  );

  function updatePlan<K extends keyof TripPlan>(
    field: K,
    value: TripPlan[K]
  ) {
    setPlan((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addStop(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name =
      newStopName.trim();

    const distance =
      Number(newStopDistance);

    if (
      !name ||
      !Number.isFinite(distance) ||
      distance < 0
    ) {
      setStatusMessage(
        "Enter a valid stop name and distance."
      );
      return;
    }

    const newStop: TripStop = {
      id: Date.now(),
      type: newStopType,
      title: formatLabel(newStopType),
      location: name,
      distanceKm: distance,
      durationMinutes:
        newStopType === "hotel"
          ? 480
          : newStopType === "food"
            ? 45
            : 20,
      note:
        "Added manually to the trip preview.",
    };

    setStops((current) =>
      [...current, newStop].sort(
        (first, second) =>
          first.distanceKm -
          second.distanceKm
      )
    );

    setNewStopName("");
    setNewStopDistance("");
    setStatusMessage(
      `${name} added to the trip plan.`
    );
  }

  function removeStop(
    stopId: number
  ) {
    setStops((current) =>
      current.filter(
        (stop) =>
          stop.id !== stopId ||
          stop.type === "start" ||
          stop.type === "destination"
      )
    );
  }

  function optimiseRoute() {
    const optimized =
      [...stops].sort(
        (first, second) =>
          first.distanceKm -
          second.distanceKm
      );

    setStops(optimized);

    setStatusMessage(
      "Stops reordered by route distance in preview mode."
    );
  }

  function saveTrip() {
    localStorage.setItem(
      "mira-trip-plan",
      JSON.stringify({
        plan,
        stops,
        avoidTolls,
        familyFriendly,
        includeHotels,
        includeEmergencyStops,
      })
    );

    setStatusMessage(
      "Trip plan saved in this browser."
    );
  }

  async function shareTrip() {
    const shareText =
      `${plan.start} to ${plan.destination} · ${plan.distanceKm} km · ${formatMinutes(
        totalTripMinutes
      )} · Estimated cost ₹${totalCost}`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "My Vehicle Trip Plan",
          text: shareText,
        });

        setStatusMessage(
          "Trip shared successfully."
        );

        return;
      }

      await navigator.clipboard.writeText(
        shareText
      );

      setStatusMessage(
        "Trip summary copied to clipboard."
      );
    } catch {
      setStatusMessage(
        "Trip sharing was cancelled."
      );
    }
  }

  function speakTripBriefing() {
    if (
      !("speechSynthesis" in window)
    ) {
      setStatusMessage(
        "Voice briefing is not supported in this browser."
      );
      return;
    }

    const briefing =
      `Your trip from ${plan.start} to ${plan.destination} is ${plan.distanceKm} kilometres. Estimated total time is ${formatMinutes(
        totalTripMinutes
      )}. Estimated total cost is ${totalCost} rupees. ${bestDepartureAdvice}`;

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        briefing
      );

    utterance.lang = "en-IN";

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
      question.includes("departure") ||
      question.includes("leave")
    ) {
      setMiraReply(
        bestDepartureAdvice
      );
    } else if (
      question.includes("fuel") ||
      question.includes("charging")
    ) {
      setMiraReply(
        plan.vehicleMode === "ev"
          ? "Plan a fast-charging stop before the battery falls below 20%, and verify connector availability before departure."
          : "Mira recommends refuelling before the remaining range falls below 80 km."
      );
    } else if (
      question.includes("cost") ||
      question.includes("expense")
    ) {
      setMiraReply(
        `Estimated total trip cost is ₹${totalCost}, including ₹${plan.fuelCost} fuel or charging, ₹${plan.tollCost} tolls, ₹${plan.foodCost} food and ₹${plan.hotelCost} hotel cost.`
      );
    } else if (
      question.includes("break") ||
      question.includes("rest")
    ) {
      setMiraReply(
        "Take a short break after about two hours of continuous driving. Use a safe, well-lit stop with washrooms and food."
      );
    } else if (
      question.includes("weather")
    ) {
      setMiraReply(
        "This preview expects possible rain near Ramanagara after 2 PM. Live weather integration is required for confirmed conditions."
      );
    } else if (
      question.includes("hotel")
    ) {
      setMiraReply(
        includeHotels
          ? "Hotel suggestions are enabled for this trip."
          : "Enable hotel suggestions to include overnight stop planning."
      );
    } else {
      setMiraReply(
        `Your current trip has ${stops.length} planned stops, an estimated duration of ${formatMinutes(
          totalTripMinutes
        )}, and an estimated cost of ₹${totalCost}.`
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Trip Planner
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Plan multi-stop journeys with Mira recommendations for
            fuel, charging, food, weather, traffic, safety, rest
            stops, tolls and total trip cost.
          </p>
        </header>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Distance"
            value={`${plan.distanceKm} km`}
          />

          <Metric
            label="Driving Time"
            value={formatMinutes(
              plan.driveMinutes
            )}
          />

          <Metric
            label="Stops"
            value={String(
              stops.length
            )}
          />

          <Metric
            label="Arrival"
            value={estimatedArrival}
          />

          <Metric
            label="Fuel / Charging"
            value={`₹${plan.fuelCost}`}
          />

          <Metric
            label="Total Cost"
            value={`₹${totalCost}`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Trip settings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Adjust the journey and Mira&apos;s planning preferences.
              </p>
            </div>

            <Field
              label="Start"
              value={plan.start}
              onChange={(value) =>
                updatePlan(
                  "start",
                  value
                )
              }
            />

            <Field
              label="Destination"
              value={plan.destination}
              onChange={(value) =>
                updatePlan(
                  "destination",
                  value
                )
              }
            />

            <Field
              label="Departure time"
              value={plan.departureTime}
              type="datetime-local"
              onChange={(value) =>
                updatePlan(
                  "departureTime",
                  value
                )
              }
            />

            <SelectField
              label="Vehicle mode"
              value={plan.vehicleMode}
              options={[
                ["car", "Car"],
                ["bike", "Bike"],
                ["ev", "Electric Vehicle"],
              ]}
              onChange={(value) =>
                updatePlan(
                  "vehicleMode",
                  value as VehicleMode
                )
              }
            />

            <ToggleField
              label="Avoid toll roads"
              checked={avoidTolls}
              onChange={(value) => {
                setAvoidTolls(value);
                updatePlan(
                  "tollCost",
                  value
                    ? 0
                    : defaultPlan.tollCost
                );
              }}
            />

            <ToggleField
              label="Family-friendly stops"
              checked={familyFriendly}
              onChange={setFamilyFriendly}
            />

            <ToggleField
              label="Include hotel suggestions"
              checked={includeHotels}
              onChange={(value) => {
                setIncludeHotels(value);
                updatePlan(
                  "hotelCost",
                  value
                    ? 2500
                    : 0
                );
              }}
            />

            <ToggleField
              label="Show emergency support"
              checked={includeEmergencyStops}
              onChange={setIncludeEmergencyStops}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={optimiseRoute}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
              >
                Optimise Route
              </button>

              <button
                type="button"
                onClick={speakTripBriefing}
                className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-3 text-sm font-semibold text-fuchsia-100"
              >
                Voice Briefing
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={saveTrip}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
              >
                Save Trip
              </button>

              <button
                type="button"
                onClick={() =>
                  void shareTrip()
                }
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
              >
                Share Trip
              </button>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-2xl font-bold">
                Journey Timeline
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Multi-stop journey ordered by route distance.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {stops.map(
                (stop, index) => (
                  <article
                    key={stop.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-sm font-bold text-cyan-200">
                          {index + 1}
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                            {stop.title}
                          </p>

                          <h3 className="mt-1 text-lg font-bold">
                            {stop.location}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {stop.note}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="font-bold">
                          {stop.distanceKm} km
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {stop.durationMinutes > 0
                            ? `${stop.durationMinutes} min stop`
                            : "Journey point"}
                        </p>
                      </div>
                    </div>

                    {stop.type !== "start" &&
                    stop.type !== "destination" ? (
                      <button
                        type="button"
                        onClick={() =>
                          removeStop(
                            stop.id
                          )
                        }
                        className="mt-4 text-xs font-semibold text-rose-300 hover:underline"
                      >
                        Remove stop
                      </button>
                    ) : null}
                  </article>
                )
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <form
            onSubmit={addStop}
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6"
          >
            <div>
              <h2 className="text-xl font-bold">
                Add Trip Stop
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add food, fuel, rest, charging or hotel stops.
              </p>
            </div>

            <SelectField
              label="Stop type"
              value={newStopType}
              options={[
                ["breakfast", "Breakfast"],
                ["fuel", "Fuel"],
                ["charging", "EV Charging"],
                ["food", "Food"],
                ["rest", "Rest"],
                ["hotel", "Hotel"],
              ]}
              onChange={(value) =>
                setNewStopType(
                  value as StopType
                )
              }
            />

            <Field
              label="Stop name"
              value={newStopName}
              placeholder="Example: Ramanagara Rest Stop"
              onChange={setNewStopName}
            />

            <Field
              label="Distance from start"
              value={newStopDistance}
              type="number"
              placeholder="120"
              onChange={setNewStopDistance}
            />

            <button
              type="submit"
              className="w-full rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-bold text-slate-950"
            >
              Add Stop
            </button>
          </form>

          <section className="space-y-6">
            <article className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 sm:p-6">
              <h2 className="text-2xl font-bold">
                Mira Suggestions
              </h2>

              <div className="mt-5 space-y-3">
                {insights.map(
                  (insight, index) => (
                    <div
                      key={insight}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-xs font-bold text-cyan-200">
                        {index + 1}
                      </div>

                      <p className="text-sm leading-6 text-cyan-50/90">
                        {insight}
                      </p>
                    </div>
                  )
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Ask Mira Trip Planner
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
                  placeholder="Ask about departure, fuel, cost, breaks or weather..."
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

        <section className="grid gap-6 lg:grid-cols-4">
          <FeatureCard
            title="Multi-Stop Planning"
            description="Builds a route with fuel, food, rest, charging and hotel stops."
          />

          <FeatureCard
            title="Cost Estimate"
            description="Combines fuel or charging, tolls, food and hotel expenses."
          />

          <FeatureCard
            title="Safety & Emergency"
            description="Keeps hospitals, police, fuel and assistance visible along the route."
          />

          <FeatureCard
            title="Family & Bike Modes"
            description="Adapts stop planning for family travel, motorcycles and EVs."
          />
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this planner currently uses
          structured demo distance, cost, traffic and weather estimates.
          Production planning requires live maps, toll, fuel, charging,
          weather, hotel and road-closure integrations.
        </section>

        <Link
          href="/navigation/dashboard"
          className="inline-block pb-4 text-sm font-semibold text-cyan-300 hover:underline"
        >
          ← Back to Navigation Dashboard
        </Link>
      </div>
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <input
        type={props.type || "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<
    [string, string]
  >;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <select
        value={props.value}
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm"
      >
        {props.options.map(
          ([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          )
        )}
      </select>
    </label>
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

function formatMinutes(
  totalMinutes: number
) {
  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    Math.round(
      totalMinutes % 60
    );

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
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