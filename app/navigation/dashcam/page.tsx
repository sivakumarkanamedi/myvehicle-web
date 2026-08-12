"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";

type DetectionStatus =
  | "safe"
  | "warning"
  | "critical"
  | "inactive";

type DetectionCard = {
  id: number;
  title: string;
  value: string;
  status: DetectionStatus;
  description: string;
};

type DashcamEvent = {
  id: number;
  type:
    | "lane_departure"
    | "collision_warning"
    | "sudden_braking"
    | "pothole"
    | "hazard"
    | "manual_clip";
  title: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
  protected: boolean;
};

const detectionCards: DetectionCard[] = [
  {
    id: 1,
    title: "Lane Position",
    value: "Centered",
    status: "safe",
    description: "Vehicle is within the detected lane boundaries.",
  },
  {
    id: 2,
    title: "Forward Distance",
    value: "28 m",
    status: "warning",
    description: "Maintain additional distance from the vehicle ahead.",
  },
  {
    id: 3,
    title: "Pedestrian Detection",
    value: "Clear",
    status: "safe",
    description: "No pedestrian risk detected in the current path.",
  },
  {
    id: 4,
    title: "Cyclist Detection",
    value: "1 nearby",
    status: "warning",
    description: "Cyclist detected near the left side of the vehicle.",
  },
  {
    id: 5,
    title: "Collision Risk",
    value: "Low",
    status: "safe",
    description: "No immediate forward-collision risk detected.",
  },
  {
    id: 6,
    title: "Driver Attention",
    value: "Focused",
    status: "safe",
    description: "No attention warning detected in this preview.",
  },
];

export default function AIDashcamPage() {
  const [recording, setRecording] = useState(false);
  const [emergencyRecording, setEmergencyRecording] =
    useState(false);
  const [cloudBackup, setCloudBackup] = useState(true);
  const [laneAlerts, setLaneAlerts] = useState(true);
  const [collisionAlerts, setCollisionAlerts] = useState(true);
  const [pedestrianAlerts, setPedestrianAlerts] =
    useState(true);
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [clipLength, setClipLength] = useState("3");
  const [message, setMessage] = useState("");
  const [cameraPermission, setCameraPermission] =
    useState<"unknown" | "granted" | "denied">("unknown");
  const [privacyMode, setPrivacyMode] = useState(true);
  const [audioRecording, setAudioRecording] = useState(false);
  const [locationTagging, setLocationTagging] = useState(true);
  const [events, setEvents] = useState<DashcamEvent[]>([]);
  const [miraQuestion, setMiraQuestion] = useState("");
  const [miraReply, setMiraReply] = useState(
    "I can explain lane, collision, braking and hazard events. Real detection requires on-device vision processing."
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeAlerts = useMemo(
    () =>
      detectionCards.filter(
        (card) =>
          card.status === "warning" ||
          card.status === "critical"
      ),
    []
  );

  function toggleRecording() {
    setRecording((current) => !current);
    setMessage(
      recording
        ? "Dashcam recording stopped."
        : "Dashcam recording started."
    );
  }

  function activateEmergencyRecording() {
    setEmergencyRecording(true);
    setRecording(true);
    setMessage(
      "Emergency recording activated. The current clip will be protected from automatic deletion."
    );
  }

  function saveCurrentClip() {
    const event: DashcamEvent = {
      id: Date.now(),
      type: "manual_clip",
      title: `Saved ${clipLength}-minute clip`,
      severity: "low",
      timestamp: new Date().toISOString(),
      protected: emergencyRecording,
    };

    setEvents((current) => [
      event,
      ...current,
    ]);

    setMessage(
      `Current ${clipLength}-minute clip saved locally.`
    );
  }

  async function requestCameraPermission() {
    setMessage("");

    if (
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraPermission("denied");
      setMessage(
        "Camera access is not supported by this browser."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
          audio: audioRecording,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraPermission("granted");
      setMessage(
        "Camera permission granted. This preview does not yet run AI detection."
      );
    } catch {
      setCameraPermission("denied");
      setMessage(
        "Camera permission was denied or unavailable."
      );
    }
  }

  function stopCameraPreview() {
    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraPermission("unknown");
    setMessage(
      "Camera preview stopped."
    );
  }

  function simulateEvent(
    type: DashcamEvent["type"],
    title: string,
    severity: DashcamEvent["severity"]
  ) {
    const event: DashcamEvent = {
      id: Date.now(),
      type,
      title,
      severity,
      timestamp: new Date().toISOString(),
      protected:
        severity === "high" ||
        emergencyRecording,
    };

    setEvents((current) => [
      event,
      ...current,
    ]);

    setMessage(
      `${title} recorded in preview mode.`
    );

    if (
      voiceAlerts &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(title);

      utterance.lang = "en-IN";

      window.speechSynthesis.speak(
        utterance
      );
    }
  }

  function toggleProtectedEvent(
    eventId: number
  ) {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              protected:
                !event.protected,
            }
          : event
      )
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
      question.includes("lane")
    ) {
      setMiraReply(
        laneAlerts
          ? "Lane-departure alerts are enabled. Real warnings require camera calibration and lane detection."
          : "Lane-departure alerts are disabled."
      );
    } else if (
      question.includes("collision") ||
      question.includes("distance")
    ) {
      setMiraReply(
        collisionAlerts
          ? "Forward-collision alerts are enabled. Maintain a safe following distance and do not rely only on the app."
          : "Forward-collision alerts are disabled."
      );
    } else if (
      question.includes("privacy") ||
      question.includes("cloud")
    ) {
      setMiraReply(
        privacyMode
          ? "Privacy mode is enabled. Keep recordings local unless the user explicitly chooses cloud backup."
          : "Privacy mode is disabled. Review recording and cloud-storage consent carefully."
      );
    } else if (
      question.includes("event") ||
      question.includes("clip")
    ) {
      setMiraReply(
        `${events.length} dashcam event${
          events.length === 1 ? "" : "s"
        } are currently stored in this preview.`
      );
    } else {
      setMiraReply(
        "I can help explain lane departure, collision risk, braking events, hazard clips and privacy settings."
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Dashcam
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Preview lane, vehicle, pedestrian and cyclist alerts while
            recording important journey clips.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80">
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Camera preview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Demonstration view for the future phone-camera
                  integration.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={recording ? "Recording" : "Standby"}
                  tone={recording ? "danger" : "neutral"}
                />

                {emergencyRecording ? (
                  <StatusBadge
                    label="Emergency Clip"
                    tone="danger"
                  />
                ) : null}

                {cloudBackup ? (
                  <StatusBadge
                    label="Cloud Backup"
                    tone="success"
                  />
                ) : null}
              </div>
            </div>

            <div
              className={
                nightMode
                  ? "relative flex h-[520px] items-center justify-center overflow-hidden bg-slate-950"
                  : "relative flex h-[520px] items-center justify-center overflow-hidden bg-gradient-to-b from-sky-900 via-slate-800 to-slate-950"
              }
            >
              {cameraPermission === "granted" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={!audioRecording}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}

              <div className="absolute inset-x-[12%] bottom-0 top-[20%] border-x-4 border-dashed border-cyan-300/60" />

              <div className="absolute left-[40%] top-[38%] h-24 w-40 rounded-xl border-2 border-amber-300/80">
                <span className="absolute -top-7 left-0 rounded-md bg-amber-400 px-2 py-1 text-xs font-bold text-slate-950">
                  Vehicle · 28 m
                </span>
              </div>

              <div className="absolute bottom-[24%] left-[14%] h-20 w-12 rounded-lg border-2 border-fuchsia-300/80">
                <span className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-fuchsia-400 px-2 py-1 text-xs font-bold text-slate-950">
                  Cyclist
                </span>
              </div>

              <div className="absolute left-5 top-5 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Speed
                </p>

                <p className="mt-1 text-2xl font-bold">
                  48 km/h
                </p>
              </div>

              <div className="absolute right-5 top-5 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Clip Time
                </p>

                <p className="mt-1 text-2xl font-bold">
                  00:01:42
                </p>
              </div>

              <div className="absolute bottom-5 left-1/2 w-[90%] -translate-x-1/2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 backdrop-blur">
                <p className="font-semibold text-cyan-100">
                  Mira safety alert
                </p>

                <p className="mt-1 text-sm text-cyan-50/80">
                  Cyclist detected on the left. Maintain lane position
                  and pass only when safe.
                </p>
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5">
              <button
                type="button"
                onClick={() =>
                  void requestCameraPermission()
                }
                disabled={
                  cameraPermission === "granted"
                }
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-40"
              >
                Enable Camera
              </button>

              <button
                type="button"
                onClick={stopCameraPreview}
                disabled={
                  cameraPermission !== "granted"
                }
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Stop Camera
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                className={
                  recording
                    ? "rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-bold text-rose-100"
                    : "rounded-2xl bg-rose-500 px-5 py-3 text-sm font-bold text-white"
                }
              >
                {recording
                  ? "Stop Recording"
                  : "Start Recording"}
              </button>

              <button
                type="button"
                onClick={saveCurrentClip}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
              >
                Save Current Clip
              </button>

              <button
                type="button"
                onClick={activateEmergencyRecording}
                className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100"
              >
                Emergency Record
              </button>
            </div>
          </article>

          <aside className="space-y-6">
            <article className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Dashcam settings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Choose which safety alerts Mira should use.
                </p>
              </div>

              <ToggleField
                label="Lane-departure alerts"
                checked={laneAlerts}
                onChange={setLaneAlerts}
              />

              <ToggleField
                label="Forward-collision alerts"
                checked={collisionAlerts}
                onChange={setCollisionAlerts}
              />

              <ToggleField
                label="Pedestrian and cyclist alerts"
                checked={pedestrianAlerts}
                onChange={setPedestrianAlerts}
              />

              <ToggleField
                label="Voice safety alerts"
                checked={voiceAlerts}
                onChange={setVoiceAlerts}
              />

              <ToggleField
                label="Cloud backup"
                checked={cloudBackup}
                onChange={setCloudBackup}
              />

              <ToggleField
                label="Privacy mode"
                checked={privacyMode}
                onChange={setPrivacyMode}
              />

              <ToggleField
                label="Audio recording"
                checked={audioRecording}
                onChange={setAudioRecording}
              />

              <ToggleField
                label="Location tagging"
                checked={locationTagging}
                onChange={setLocationTagging}
              />

              <ToggleField
                label="Night preview"
                checked={nightMode}
                onChange={setNightMode}
              />

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Protected clip length
                </span>

                <select
                  value={clipLength}
                  onChange={(event) =>
                    setClipLength(event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
                >
                  <option value="1">1 minute</option>
                  <option value="3">3 minutes</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                </select>
              </label>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Current risk
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Metric
                  label="Active alerts"
                  value={String(activeAlerts.length)}
                />

                <Metric
                  label="Journey risk"
                  value="Low"
                />

                <Metric
                  label="Recording storage"
                  value="2.8 GB free"
                />

                <Metric
                  label="Camera permission"
                  value={formatLabel(cameraPermission)}
                />
              </div>
            </article>
          </aside>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Simulate Safety Events
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create preview events for lane departure, braking, potholes and collision warnings.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <EventButton
              label="Lane Departure"
              onClick={() =>
                simulateEvent(
                  "lane_departure",
                  "Lane departure warning",
                  "medium"
                )
              }
            />

            <EventButton
              label="Collision Warning"
              onClick={() =>
                simulateEvent(
                  "collision_warning",
                  "Forward collision warning",
                  "high"
                )
              }
            />

            <EventButton
              label="Sudden Braking"
              onClick={() =>
                simulateEvent(
                  "sudden_braking",
                  "Sudden braking event",
                  "medium"
                )
              }
            />

            <EventButton
              label="Pothole"
              onClick={() =>
                simulateEvent(
                  "pothole",
                  "Pothole detected",
                  "low"
                )
              }
            />

            <EventButton
              label="Road Hazard"
              onClick={() =>
                simulateEvent(
                  "hazard",
                  "Road hazard captured",
                  "medium"
                )
              }
            />
          </div>
        </section>

        {events.length > 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Incident Timeline
            </h2>

            <div className="mt-5 space-y-3">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold">
                      {event.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {new Intl.DateTimeFormat(
                        "en-IN",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }
                      ).format(
                        new Date(event.timestamp)
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={formatLabel(event.severity)}
                      tone={
                        event.severity === "high"
                          ? "danger"
                          : event.severity === "low"
                            ? "success"
                            : "neutral"
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        toggleProtectedEvent(
                          event.id
                        )
                      }
                      className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold"
                    >
                      {event.protected
                        ? "Protected"
                        : "Protect Clip"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            AI detection status
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {detectionCards.map((card) => (
              <DetectionStatusCard
                key={card.id}
                card={card}
              />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            Ask Mira Dashcam
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
              placeholder="Ask about lane alerts, collision risk, clips or privacy..."
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
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this page is a UI
          demonstration. Real AI dashcam detection requires camera
          permission, native mobile processing, tested computer-vision
          models, storage controls, consent, and extensive safety
          validation. Drivers must not rely on this feature instead of
          watching the road.
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

function EventButton(props: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold transition hover:border-cyan-400/30 hover:bg-cyan-400/5"
    >
      {props.label}
    </button>
  );
}

function DetectionStatusCard(props: {
  card: DetectionCard;
}) {
  const classes =
    props.card.status === "critical"
      ? "border-rose-400/30 bg-rose-400/10"
      : props.card.status === "warning"
        ? "border-amber-400/30 bg-amber-400/10"
        : props.card.status === "safe"
          ? "border-emerald-400/30 bg-emerald-400/10"
          : "border-white/10 bg-slate-950/60";

  return (
    <article className={`rounded-2xl border p-5 ${classes}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {props.card.title}
          </p>

          <h3 className="mt-2 text-xl font-bold">
            {props.card.value}
          </h3>
        </div>

        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold">
          {formatLabel(props.card.status)}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {props.card.description}
      </p>
    </article>
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
          props.onChange(event.target.checked)
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

function StatusBadge(props: {
  label: string;
  tone: "success" | "danger" | "neutral";
}) {
  const classes =
    props.tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.tone === "danger"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : "border-white/10 bg-slate-950/60 text-slate-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {props.label}
    </span>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}