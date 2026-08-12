"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabase";

type ConvoyMember = {
  id: number;
  name: string;
  vehicle: string;
  status: "leader" | "following" | "stopped" | "offline";
  distanceBehindKm: number;
  etaMinutes: number;
  fuelPercent: number;
  lastUpdate: string;
};

type ConvoyRole = "leader" | "member";

type MiraApiResponse = {
  reply?: string;
  error?: string;
  mode?: "ai" | "fallback" | "emergency" | "action";
};

const initialMembers: ConvoyMember[] = [
  {
    id: 1,
    name: "Siva",
    vehicle: "KA 01 AB 1234",
    status: "leader",
    distanceBehindKm: 0,
    etaMinutes: 24,
    fuelPercent: 62,
    lastUpdate: "Now",
  },
  {
    id: 2,
    name: "Ravi",
    vehicle: "KA 05 MN 4821",
    status: "following",
    distanceBehindKm: 0.8,
    etaMinutes: 25,
    fuelPercent: 48,
    lastUpdate: "10 sec ago",
  },
  {
    id: 3,
    name: "Srinivasulu",
    vehicle: "KA 03 PQ 9087",
    status: "stopped",
    distanceBehindKm: 2.4,
    etaMinutes: 31,
    fuelPercent: 35,
    lastUpdate: "1 min ago",
  },
];

export default function ConvoyModePage() {
  const router = useRouter();

  const [members, setMembers] =
    useState<ConvoyMember[]>(initialMembers);

  const [convoyActive, setConvoyActive] =
    useState(true);

  const [autoWaitAlerts, setAutoWaitAlerts] =
    useState(true);

  const [voiceUpdates, setVoiceUpdates] =
    useState(true);

  const [shareFuelStatus, setShareFuelStatus] =
    useState(true);

  const [role, setRole] =
    useState<ConvoyRole>("leader");

  const [convoyCode, setConvoyCode] =
    useState("MIRA-4821");

  const [joinCode, setJoinCode] =
    useState("");

  const [destination, setDestination] =
    useState("Marathahalli, Bengaluru");

  const [regroupPoint, setRegroupPoint] =
    useState("");

  const [inviteName, setInviteName] =
    useState("");

  const [inviteVehicleNumber, setInviteVehicleNumber] =
    useState("");

  const [miraPrompt, setMiraPrompt] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I am monitoring the convoy. One vehicle is currently behind the group."
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState("");

  const leader = useMemo(
    () =>
      members.find(
        (member) =>
          member.status === "leader"
      ) ?? members[0],
    [members]
  );

  const delayedMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.distanceBehindKm > 1.5 ||
          member.status === "stopped"
      ),
    [members]
  );

  const convoyHealth = useMemo(() => {
    if (
      members.some(
        (member) =>
          member.status === "offline"
      )
    ) {
      return "Attention";
    }

    if (
      delayedMembers.length > 0
    ) {
      return "Separated";
    }

    return "Together";
  }, [members, delayedMembers]);

  function markMemberMoving(
    memberId: number
  ) {
    setMembers((current) =>
      current.map((member) =>
        member.id === memberId
          ? {
              ...member,
              status:
                member.status === "leader"
                  ? "leader"
                  : "following",
              distanceBehindKm:
                Math.max(
                  0.4,
                  member.distanceBehindKm - 0.8
                ),
              etaMinutes:
                Math.max(
                  leader.etaMinutes,
                  member.etaMinutes - 3
                ),
              lastUpdate: "Now",
            }
          : member
      )
    );

    setStatusMessage(
      "Member status updated to moving."
    );
  }

  function handleInviteVehicle(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = inviteName.trim();
    const vehicle = inviteVehicleNumber.trim();

    if (!name || !vehicle) {
      setError(
        "Enter the driver name and vehicle number."
      );
      return;
    }

    const member: ConvoyMember = {
      id: Date.now(),
      name,
      vehicle,
      status: "following",
      distanceBehindKm: 0,
      etaMinutes: leader.etaMinutes,
      fuelPercent: 100,
      lastUpdate: "Invitation pending",
    };

    setMembers((current) => [
      ...current,
      member,
    ]);

    setInviteName("");
    setInviteVehicleNumber("");
    setError("");
    setStatusMessage(
      `Invitation prepared for ${name}. Realtime invitation delivery will be connected later.`
    );
  }

  function joinConvoy(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const code = joinCode.trim().toUpperCase();

    if (!code) {
      setError(
        "Enter a valid convoy code."
      );
      return;
    }

    setConvoyCode(code);
    setRole("member");
    setConvoyActive(true);
    setError("");
    setStatusMessage(
      `Joined convoy ${code} in local preview mode.`
    );
  }

  function createNewConvoy() {
    const generatedCode =
      `MIRA-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    setConvoyCode(generatedCode);
    setRole("leader");
    setConvoyActive(true);
    setStatusMessage(
      `New convoy ${generatedCode} created in local preview mode.`
    );
  }

  function setSafeRegroupPoint() {
    const point = regroupPoint.trim();

    if (!point) {
      setError(
        "Enter a safe regroup location."
      );
      return;
    }

    setError("");
    setStatusMessage(
      `Regroup point set to ${point}.`
    );

    if (voiceUpdates) {
      speak(
        `The convoy regroup point is ${point}.`
      );
    }
  }

  async function askMira(
    event?: FormEvent<HTMLFormElement>,
    overridePrompt?: string
  ) {
    event?.preventDefault();

    const prompt = (
      overridePrompt ?? miraPrompt
    ).trim();

    if (!prompt || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        "/api/mira",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...(session?.access_token
              ? {
                  Authorization:
                    `Bearer ${session.access_token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            message: prompt,
            language: "en",
            userContext: {
              userId:
                session?.user?.id,
              fullName:
                session?.user
                  ?.user_metadata
                  ?.full_name ||
                session?.user
                  ?.user_metadata
                  ?.name ||
                null,
              preferredLanguage:
                "en",
              hasLocationPermission:
                false,
              hasNotificationPermission:
                typeof Notification !==
                  "undefined" &&
                Notification.permission ===
                  "granted",
              hasEmergencyContact:
                Boolean(
                  session?.user
                    ?.user_metadata
                    ?.emergency_contact ||
                    session?.user
                      ?.user_metadata
                      ?.emergency_contact_number
                ),
            },
            navigationContext: {
              mode: "convoy",
              convoyCode,
              role,
              convoyActive,
              destination,
              regroupPoint:
                regroupPoint || null,
              memberCount:
                members.length,
              delayedMemberCount:
                delayedMembers.length,
              members: members.map(
                (member) => ({
                  name:
                    member.name,
                  vehicle:
                    member.vehicle,
                  status:
                    member.status,
                  distanceBehindKm:
                    member.distanceBehindKm,
                  etaMinutes:
                    member.etaMinutes,
                })
              ),
            },
          }),
        }
      );

      const data =
        (await response.json()) as MiraApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Mira could not process the convoy request."
        );
      }

      const reply =
        data.reply ||
        "I could not prepare a convoy response.";

      setMiraReply(reply);
      setMiraPrompt("");

      if (voiceUpdates) {
        speak(reply);
      }

      if (data.mode === "emergency") {
        router.push("/mira");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mira could not process the convoy request."
      );
    } finally {
      setLoading(false);
    }
  }

  function broadcastEmergency() {
    setStatusMessage(
      "Emergency broadcast prepared for all convoy members."
    );

    if (voiceUpdates) {
      speak(
        "Emergency alert. All convoy members should stop safely and check the group status."
      );
    }

    router.push("/mira");
  }

  function messageDriver(
    member: ConvoyMember
  ) {
    setStatusMessage(
      `Message action opened for ${member.name}. Realtime messaging will be connected later.`
    );
  }

  function speak(text: string) {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";
    utterance.rate = 1;

    window.speechSynthesis.speak(
      utterance
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Convoy Mode
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Keep multiple vehicles together with group status,
            distance-gap alerts, synchronized stops and Mira voice updates.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {statusMessage ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Convoy status"
            value={
              convoyActive
                ? convoyHealth
                : "Inactive"
            }
          />

          <Metric
            label="Vehicles"
            value={String(
              members.length
            )}
          />

          <Metric
            label="Leader ETA"
            value={`${leader.etaMinutes} min`}
          />

          <Metric
            label="Needs attention"
            value={String(
              delayedMembers.length
            )}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Convoy controls
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure how Mira coordinates the group.
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                Convoy code
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xl font-bold">
                  {convoyCode}
                </p>

                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                  {formatLabel(role)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={createNewConvoy}
              className="w-full rounded-2xl bg-indigo-400 px-6 py-3 text-sm font-bold text-slate-950"
            >
              Create New Convoy
            </button>

            <form
              onSubmit={joinConvoy}
              className="space-y-3"
            >
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(
                    event.target.value
                  )
                }
                placeholder="Enter convoy code"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
              />

              <button
                type="submit"
                className="w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold"
              >
                Join Convoy
              </button>
            </form>

            <ToggleField
              label="Convoy active"
              checked={convoyActive}
              onChange={setConvoyActive}
            />

            <ToggleField
              label="Automatic wait alerts"
              checked={autoWaitAlerts}
              onChange={setAutoWaitAlerts}
            />

            <ToggleField
              label="Voice status updates"
              checked={voiceUpdates}
              onChange={setVoiceUpdates}
            />

            <ToggleField
              label="Share fuel status"
              checked={shareFuelStatus}
              onChange={setShareFuelStatus}
            />

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Shared destination
              </span>

              <input
                value={destination}
                onChange={(event) =>
                  setDestination(
                    event.target.value
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
              />
            </label>

            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Mira convoy alert
              </p>

              <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                {delayedMembers.length
                  ? `${delayedMembers[0].name} is falling behind. Mira recommends slowing the lead vehicle or choosing a safe regroup point.`
                  : "All vehicles are travelling together."}
              </p>
            </div>

            <form
              onSubmit={handleInviteVehicle}
              className="space-y-3"
            >
              <input
                value={inviteName}
                onChange={(event) =>
                  setInviteName(
                    event.target.value
                  )
                }
                placeholder="Driver name"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
              />

              <input
                value={inviteVehicleNumber}
                onChange={(event) =>
                  setInviteVehicleNumber(
                    event.target.value
                  )
                }
                placeholder="Vehicle number"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
              />

              <button
                type="submit"
                className="w-full rounded-2xl bg-indigo-400 px-6 py-3 text-sm font-bold text-slate-950"
              >
                Invite Vehicle
              </button>
            </form>

            <input
              value={regroupPoint}
              onChange={(event) =>
                setRegroupPoint(
                  event.target.value
                )
              }
              placeholder="Safe regroup point"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
            />

            <button
              type="button"
              onClick={setSafeRegroupPoint}
              className="w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold"
            >
              Set Regroup Point
            </button>

            <button
              type="button"
              onClick={broadcastEmergency}
              className="w-full rounded-2xl bg-rose-500 px-6 py-3 text-sm font-bold text-white"
            >
              🚨 Emergency Broadcast
            </button>
          </aside>

          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Convoy members
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Monitor each vehicle in the group.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {members.map(
                  (member) => (
                    <article
                      key={member.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">
                              {member.name}
                            </h3>

                            <StatusBadge
                              value={member.status}
                            />
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {member.vehicle}
                          </p>
                        </div>

                        <p className="text-xs text-slate-600">
                          {member.lastUpdate}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <SmallDetail
                          label="Gap"
                          value={
                            member.status === "leader"
                              ? "Lead vehicle"
                              : `${member.distanceBehindKm.toFixed(
                                  1
                                )} km`
                          }
                        />

                        <SmallDetail
                          label="ETA"
                          value={`${member.etaMinutes} min`}
                        />

                        <SmallDetail
                          label="Fuel"
                          value={
                            shareFuelStatus
                              ? `${member.fuelPercent}%`
                              : "Hidden"
                          }
                        />

                        <SmallDetail
                          label="Role"
                          value={formatLabel(
                            member.status
                          )}
                        />
                      </div>

                      {member.status !==
                      "leader" ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() =>
                              markMemberMoving(
                                member.id
                              )
                            }
                            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100"
                          >
                            Mark Moving
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              messageDriver(
                                member
                              )
                            }
                            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold"
                          >
                            Message Driver
                          </button>
                        </div>
                      ) : null}
                    </article>
                  )
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Ask Mira about the convoy
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
                {miraReply}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Who is falling behind?",
                  "Should the convoy wait?",
                  "Suggest a regroup point.",
                  "Check fuel status.",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() =>
                      void askMira(
                        undefined,
                        prompt
                      )
                    }
                    disabled={loading}
                    className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(event) =>
                  void askMira(event)
                }
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <input
                  value={miraPrompt}
                  onChange={(event) =>
                    setMiraPrompt(
                      event.target.value
                    )
                  }
                  placeholder="Ask Mira about the convoy..."
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    !miraPrompt.trim() ||
                    loading
                  }
                  className="rounded-2xl bg-fuchsia-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  {loading
                    ? "Checking..."
                    : "Ask Mira"}
                </button>
              </form>
            </div>
          </section>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Convoy Features
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              title="Live Gap Alerts"
              description="Warns when a vehicle falls too far behind."
            />

            <FeatureCard
              title="Group Stops"
              description="Synchronizes fuel, food and rest stops."
            />

            <FeatureCard
              title="Regroup Points"
              description="Suggests safe places to wait for separated vehicles."
            />

            <FeatureCard
              title="Emergency Broadcast"
              description="Shares urgent alerts with every convoy member."
            />
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> convoy creation, joining,
          invitations and member updates currently work as a local preview.
          Realtime Supabase location sharing, background updates and push
          notifications still need backend tables and policies.
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

function StatusBadge(props: {
  value: ConvoyMember["status"];
}) {
  const classes =
    props.value === "leader"
      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
      : props.value === "following"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
        : props.value === "stopped"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.value)}
    </span>
  );
}

function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
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
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <h3 className="font-bold">
        {props.title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
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