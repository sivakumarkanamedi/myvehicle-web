"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type MemberStatus =
  | "on_route"
  | "home"
  | "live"
  | "delayed"
  | "arrived"
  | "offline";

type FamilyMember = {
  id: number;
  name: string;
  relation: string;
  etaMinutes: number | null;
  status: MemberStatus;
  locationLabel: string;
  lastUpdated: string;
  notified: boolean;
};

const initialMembers: FamilyMember[] = [
  {
    id: 1,
    name: "Dad",
    relation: "Family",
    etaMinutes: 18,
    status: "on_route",
    locationLabel: "Hebbal",
    lastUpdated: "Now",
    notified: true,
  },
  {
    id: 2,
    name: "Mom",
    relation: "Family",
    etaMinutes: null,
    status: "home",
    locationLabel: "Home",
    lastUpdated: "2 min ago",
    notified: true,
  },
  {
    id: 3,
    name: "Friend",
    relation: "Friend",
    etaMinutes: 21,
    status: "live",
    locationLabel: "Following your route",
    lastUpdated: "15 sec ago",
    notified: false,
  },
];

export default function FamilyTrackingPage() {
  const [members, setMembers] =
    useState<FamilyMember[]>(initialMembers);

  const [liveTrip, setLiveTrip] =
    useState(true);

  const [autoEtaUpdates, setAutoEtaUpdates] =
    useState(true);

  const [safeArrivalAlert, setSafeArrivalAlert] =
    useState(true);

  const [delayAlerts, setDelayAlerts] =
    useState(true);

  const [journeyProgress, setJourneyProgress] =
    useState(64);

  const [destination, setDestination] =
    useState("Marathahalli");

  const [currentLocation, setCurrentLocation] =
    useState("Hebbal");

  const [remainingMinutes, setRemainingMinutes] =
    useState(24);

  const [shareCode, setShareCode] =
    useState("MIRA-LIVE-4821");

  const [checkInMessage, setCheckInMessage] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain who is tracking the journey, current ETA, delays, safe-arrival status and check-in actions."
    );

  const [statusMessage, setStatusMessage] =
    useState("");

  const [realtimeConnected] =
    useState(false);

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.status !== "offline"
      ),
    [members]
  );

  const delayedMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.status === "delayed"
      ),
    [members]
  );

  const notifiedCount = useMemo(
    () =>
      members.filter(
        (member) =>
          member.notified
      ).length,
    [members]
  );

  function toggleMemberNotification(
    memberId: number
  ) {
    setMembers((current) =>
      current.map((member) =>
        member.id === memberId
          ? {
              ...member,
              notified:
                !member.notified,
              lastUpdated: "Now",
            }
          : member
      )
    );
  }

  function simulateDelay() {
    setRemainingMinutes((current) =>
      current + 8
    );

    setMembers((current) =>
      current.map((member) =>
        member.status === "on_route" ||
        member.status === "live"
          ? {
              ...member,
              status: "delayed",
              etaMinutes:
                member.etaMinutes !== null
                  ? member.etaMinutes + 8
                  : 8,
              lastUpdated: "Now",
            }
          : member
      )
    );

    setStatusMessage(
      "Delay preview activated. Family ETA updates were prepared."
    );
  }

  function markArrived() {
    setJourneyProgress(100);
    setRemainingMinutes(0);

    setMembers((current) =>
      current.map((member) => ({
        ...member,
        status:
          member.status === "offline"
            ? "offline"
            : "arrived",
        etaMinutes: 0,
        lastUpdated: "Now",
      }))
    );

    setStatusMessage(
      safeArrivalAlert
        ? "Safe-arrival notification prepared for trusted contacts."
        : "Journey marked complete."
    );
  }

  function shareJourney() {
    const shareText =
      `Track my journey to ${destination}. Share code: ${shareCode}. Current location: ${currentLocation}. ETA: ${remainingMinutes} minutes.`;

    void navigator.clipboard
      .writeText(shareText)
      .then(() => {
        setStatusMessage(
          "Live-journey details copied to the clipboard."
        );
      })
      .catch(() => {
        setStatusMessage(
          "The browser could not copy the journey details."
        );
      });
  }

  function regenerateShareCode() {
    const nextCode =
      `MIRA-LIVE-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    setShareCode(nextCode);

    setStatusMessage(
      `New share code ${nextCode} generated in preview mode.`
    );
  }

  function sendCheckIn(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const message =
      checkInMessage.trim();

    if (!message) {
      return;
    }

    setStatusMessage(
      `Check-in prepared: "${message}"`
    );

    setCheckInMessage("");
  }

  function emergencyCheckIn() {
    setStatusMessage(
      "Emergency check-in prepared for all trusted contacts. Live delivery requires notification and messaging integrations."
    );
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion.trim().toLowerCase();

    if (!question) {
      return;
    }

    if (
      question.includes("eta") ||
      question.includes("arrive")
    ) {
      setMiraReply(
        remainingMinutes > 0
          ? `Your current preview ETA is ${remainingMinutes} minutes to ${destination}.`
          : `The journey is marked as arrived at ${destination}.`
      );
    } else if (
      question.includes("who") ||
      question.includes("tracking")
    ) {
      setMiraReply(
        `${activeMembers.length} trusted contact${
          activeMembers.length === 1 ? " is" : "s are"
        } currently shown as active in this preview.`
      );
    } else if (
      question.includes("delay")
    ) {
      setMiraReply(
        delayedMembers.length > 0
          ? `${delayedMembers.length} member${
              delayedMembers.length === 1 ? " has" : "s have"
            } a delayed status.`
          : "No delayed member is currently shown."
      );
    } else if (
      question.includes("safe") ||
      question.includes("check in")
    ) {
      setMiraReply(
        safeArrivalAlert
          ? "Safe-arrival alerts are enabled. Mira will prepare a notification when the journey reaches 100%."
          : "Safe-arrival alerts are currently disabled."
      );
    } else if (
      question.includes("share")
    ) {
      setMiraReply(
        `Use share code ${shareCode} to prepare a journey share. Realtime tracking still requires Supabase location sessions and secure access rules.`
      );
    } else {
      setMiraReply(
        `The journey is ${journeyProgress}% complete, current location is ${currentLocation}, and the remaining ETA is ${remainingMinutes} minutes.`
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
            Family Live Tracking
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Share journey progress, ETA, delays, safe-arrival status and
            emergency check-ins with trusted contacts.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Integration status:</strong>{" "}
          {realtimeConnected
            ? "Realtime family tracking is connected."
            : "This page currently uses local preview data. Secure live tracking requires Supabase journey sessions, realtime location updates, row-level security and notifications."}
        </section>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Journey Status"
            value={
              liveTrip
                ? journeyProgress >= 100
                  ? "Arrived"
                  : "Live"
                : "Paused"
            }
          />

          <Metric
            label="Progress"
            value={`${journeyProgress}%`}
          />

          <Metric
            label="ETA"
            value={`${remainingMinutes} min`}
          />

          <Metric
            label="Active Members"
            value={String(
              activeMembers.length
            )}
          />

          <Metric
            label="Notified"
            value={String(
              notifiedCount
            )}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-2xl font-bold">
                Shared Members
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review who can see the journey and their latest status.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold">
                          {member.name}
                        </h3>

                        <StatusBadge
                          value={
                            member.status
                          }
                        />
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {member.relation} ·{" "}
                        {member.locationLabel}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600">
                      {member.lastUpdated}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <SmallDetail
                      label="ETA"
                      value={
                        member.etaMinutes !== null
                          ? `${member.etaMinutes} min`
                          : "Not applicable"
                      }
                    />

                    <SmallDetail
                      label="Notifications"
                      value={
                        member.notified
                          ? "Enabled"
                          : "Disabled"
                      }
                    />

                    <SmallDetail
                      label="Status"
                      value={formatLabel(
                        member.status
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      toggleMemberNotification(
                        member.id
                      )
                    }
                    className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
                  >
                    {member.notified
                      ? "Disable Updates"
                      : "Enable Updates"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Live Trip
              </p>

              <h2 className="mt-3 text-4xl font-bold text-emerald-200">
                {liveTrip ? "ON" : "OFF"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-emerald-50/80">
                {liveTrip
                  ? "Journey-sharing preview is active."
                  : "Journey sharing is paused."}
              </p>

              <ToggleField
                label="Live journey"
                checked={liveTrip}
                onChange={setLiveTrip}
              />
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Journey Progress
              </h2>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{
                    width: `${journeyProgress}%`,
                  }}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field
                  label="Current location"
                  value={currentLocation}
                  onChange={setCurrentLocation}
                />

                <Field
                  label="Destination"
                  value={destination}
                  onChange={setDestination}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={simulateDelay}
                  className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100"
                >
                  Simulate Delay
                </button>

                <button
                  type="button"
                  onClick={markArrived}
                  className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  Mark Arrived
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Share Journey
              </p>

              <p className="mt-3 text-2xl font-bold">
                {shareCode}
              </p>

              <p className="mt-2 text-sm text-fuchsia-50/80">
                Share this preview code with a trusted contact.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={shareJourney}
                  className="rounded-2xl bg-fuchsia-300 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  Share Live Journey
                </button>

                <button
                  type="button"
                  onClick={regenerateShareCode}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-fuchsia-100"
                >
                  New Share Code
                </button>
              </div>
            </article>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Tracking Preferences
            </h2>

            <ToggleField
              label="Automatic ETA updates"
              checked={autoEtaUpdates}
              onChange={setAutoEtaUpdates}
            />

            <ToggleField
              label="Safe-arrival alert"
              checked={safeArrivalAlert}
              onChange={setSafeArrivalAlert}
            />

            <ToggleField
              label="Delay alerts"
              checked={delayAlerts}
              onChange={setDelayAlerts}
            />

            <form
              onSubmit={sendCheckIn}
              className="space-y-3"
            >
              <textarea
                value={checkInMessage}
                onChange={(event) =>
                  setCheckInMessage(
                    event.target.value
                  )
                }
                placeholder="Send a quick check-in message..."
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
              />

              <button
                type="submit"
                disabled={
                  !checkInMessage.trim()
                }
                className="w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Send Check-In
              </button>
            </form>

            <button
              type="button"
              onClick={emergencyCheckIn}
              className="w-full rounded-2xl bg-rose-500 px-5 py-3 text-sm font-bold text-white"
            >
              Emergency Check-In
            </button>
          </aside>

          <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
              Ask Mira Family Tracking
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
                placeholder="Ask about ETA, delays, tracking or safe arrival..."
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
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Live Journey Sharing"
            description="Prepares secure journey progress, location and ETA sharing."
          />

          <FeatureCard
            title="Safe Arrival"
            description="Notifies trusted contacts when the journey is marked complete."
          />

          <FeatureCard
            title="Delay & Emergency Check-In"
            description="Prepares delay alerts and urgent check-ins for trusted contacts."
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

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <input
        value={props.value}
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

function StatusBadge(props: {
  value: MemberStatus;
}) {
  const classes =
    props.value === "arrived"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.value === "delayed"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : props.value === "offline"
          ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
          : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";

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

function formatLabel(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}