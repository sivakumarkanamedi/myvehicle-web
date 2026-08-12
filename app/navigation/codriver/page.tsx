"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabase";

type CoDriverMessage = {
  id: number;
  role: "mira" | "user";
  text: string;
  createdAt: string;
};

type QuickAction = {
  label: string;
  prompt: string;
};

type MiraApiResponse = {
  reply?: string;
  error?: string;
  mode?: "ai" | "fallback" | "emergency" | "action";
  intent?: string;
};

type LiveDriveState = {
  latitude: number | null;
  longitude: number | null;
  speedKph: number;
  accuracyMeters: number | null;
  lastUpdatedAt: string | null;
  stoppedSince: string | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const quickActions: QuickAction[] = [
  {
    label: "Traffic ahead",
    prompt: "Check traffic ahead and suggest a faster route.",
  },
  {
    label: "Fuel stop",
    prompt: "Find a fuel station on my route.",
  },
  {
    label: "Parking",
    prompt: "Find parking near my destination.",
  },
  {
    label: "Weather",
    prompt: "Tell me the weather along my route.",
  },
  {
    label: "Break reminder",
    prompt: "Should I take a driving break now?",
  },
  {
    label: "Emergency help",
    prompt: "Show emergency options while navigating.",
  },
];

const initialMessages: CoDriverMessage[] = [
  {
    id: 1,
    role: "mira",
    text:
      "Hello. I am Mira, your AI co-driver. I can help with traffic, routes, fuel, parking, weather, safety and emergency assistance.",
    createdAt: new Date().toISOString(),
  },
];

const initialDriveState: LiveDriveState = {
  latitude: null,
  longitude: null,
  speedKph: 0,
  accuracyMeters: null,
  lastUpdatedAt: null,
  stoppedSince: null,
};

export default function MiraCoDriverPage() {
  const router = useRouter();

  const [messages, setMessages] =
    useState<CoDriverMessage[]>(initialMessages);

  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState(true);
  const [proactiveAlerts, setProactiveAlerts] = useState(true);
  const [safetyMode, setSafetyMode] = useState(true);
  const [liveTracking, setLiveTracking] = useState(false);
  const [speedLimitKph, setSpeedLimitKph] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [driveState, setDriveState] =
    useState<LiveDriveState>(initialDriveState);

  const watchIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const lastMiraMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "mira") ?? null,
    [messages]
  );

  const speedWarning =
    liveTracking &&
    driveState.speedKph > speedLimitKph;

  const stoppedDurationMinutes = useMemo(() => {
    if (!driveState.stoppedSince) return 0;

    const startedAt = new Date(driveState.stoppedSince).getTime();

    if (Number.isNaN(startedAt)) return 0;

    return Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 60_000)
    );
  }, [driveState.stoppedSince, driveState.lastUpdatedAt]);

  useEffect(() => {
    return () => {
      if (
        watchIdRef.current !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }

      recognitionRef.current?.abort();

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!speedWarning || !proactiveAlerts) return;

    const warning =
      `You are travelling at ${Math.round(
        driveState.speedKph
      )} kilometres per hour, above the selected ${speedLimitKph} kilometre per hour limit. Please reduce speed safely.`;

    appendMiraMessage(warning);

    if (voiceReply) {
      speak(warning);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedWarning]);

  async function submitMessage(
    event?: FormEvent<HTMLFormElement>,
    overridePrompt?: string
  ) {
    event?.preventDefault();

    const prompt = (
      overridePrompt ?? input
    ).trim();

    if (!prompt || loading) {
      return;
    }

    setLoading(true);
    setError("");

    const userMessage: CoDriverMessage = {
      id: Date.now(),
      role: "user",
      text: prompt,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setInput("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/mira", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          message: prompt,
          language: "en",
          conversation: [
            ...messages.slice(-10).map((message) => ({
              role:
                message.role === "mira"
                  ? "assistant"
                  : "user",
              content: message.text,
            })),
            {
              role: "user",
              content: prompt,
            },
          ],
          userContext: {
            userId: session?.user?.id,
            fullName:
              session?.user?.user_metadata?.full_name ||
              session?.user?.user_metadata?.name ||
              null,
            preferredLanguage: "en",
            hasLocationPermission:
              driveState.latitude !== null &&
              driveState.longitude !== null,
            hasNotificationPermission:
              typeof Notification !== "undefined" &&
              Notification.permission === "granted",
            hasEmergencyContact: Boolean(
              session?.user?.user_metadata
                ?.emergency_contact ||
                session?.user?.user_metadata
                  ?.emergency_contact_number
            ),
          },
          navigationContext: {
            liveTracking,
            currentLocation:
              driveState.latitude !== null &&
              driveState.longitude !== null
                ? {
                    latitude: driveState.latitude,
                    longitude: driveState.longitude,
                  }
                : null,
            speedKph: driveState.speedKph,
            selectedSpeedLimitKph: speedLimitKph,
            stoppedDurationMinutes,
            proactiveAlerts,
            safetyMode,
          },
        }),
      });

      const data =
        (await response.json()) as MiraApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Mira could not process the co-driver request."
        );
      }

      const reply =
        data.reply ||
        "I understood your request, but I could not prepare a response.";

      appendMiraMessage(reply);

      if (voiceReply) {
        speak(reply);
      }

      if (data.mode === "emergency") {
        router.push("/mira");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mira could not process the request."
      );
    } finally {
      setLoading(false);
    }
  }

  function appendMiraMessage(text: string) {
    const message: CoDriverMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      role: "mira",
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      message,
    ]);
  }

  function runQuickAction(prompt: string) {
    void submitMessage(undefined, prompt);
  }

  function startVoiceInput() {
    setError("");

    const browserWindow =
      window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

    const SpeechRecognition =
      browserWindow.SpeechRecognition ||
      browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice recognition is not supported in this browser. Use Chrome or Edge."
      );
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript =
        event.results[0]?.[0]?.transcript?.trim() ?? "";

      if (!transcript) return;

      setInput(transcript);
    };

    recognition.onerror = () => {
      setError(
        "Unable to capture voice input. Check microphone permission."
      );
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    setListening(true);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError(
        "Voice input could not start. Please try again."
      );
    }
  }

  function repeatLastReply() {
    if (!lastMiraMessage) {
      return;
    }

    speak(lastMiraMessage.text);
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
    utterance.pitch = 1;

    window.speechSynthesis.speak(
      utterance
    );
  }

  function startLiveTracking() {
    setError("");

    if (!navigator.geolocation) {
      setError(
        "Live GPS tracking is not supported by this browser."
      );
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const speedMetersPerSecond =
          position.coords.speed;

        const speedKph =
          typeof speedMetersPerSecond === "number" &&
          Number.isFinite(speedMetersPerSecond)
            ? Math.max(
                0,
                speedMetersPerSecond * 3.6
              )
            : 0;

        const isStopped = speedKph < 2;

        setDriveState((current) => ({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speedKph,
          accuracyMeters: position.coords.accuracy,
          lastUpdatedAt: new Date().toISOString(),
          stoppedSince: isStopped
            ? current.stoppedSince ||
              new Date().toISOString()
            : null,
        }));
      },
      (geolocationError) => {
        setError(
          geolocationError.code ===
            geolocationError.PERMISSION_DENIED
            ? "Location permission was denied."
            : "Mira could not read live GPS data."
        );
        stopLiveTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 2_000,
      }
    );

    watchIdRef.current = watchId;
    setLiveTracking(true);
  }

  function stopLiveTracking() {
    if (
      watchIdRef.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );
    }

    watchIdRef.current = null;
    setLiveTracking(false);
    setDriveState(initialDriveState);
  }

  function openEmergencyMode() {
    router.push("/mira");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-fuchsia-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-fuchsia-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Mira AI Co-Driver
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Ask Mira for route guidance, traffic updates, fuel stops,
            parking, weather, breaks and emergency support while driving.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Co-driver controls
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure how Mira assists during the journey.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DriveMetric
                label="Live speed"
                value={`${Math.round(
                  driveState.speedKph
                )} km/h`}
                warning={speedWarning}
              />

              <DriveMetric
                label="GPS accuracy"
                value={
                  driveState.accuracyMeters !== null
                    ? `${Math.round(
                        driveState.accuracyMeters
                      )} m`
                    : "Not available"
                }
              />
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Speed-limit alert
              </span>

              <select
                value={speedLimitKph}
                onChange={(event) =>
                  setSpeedLimitKph(
                    Number(event.target.value)
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
              >
                {[30, 40, 50, 60, 80, 100, 120].map(
                  (speed) => (
                    <option
                      key={speed}
                      value={speed}
                    >
                      {speed} km/h
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={
                liveTracking
                  ? stopLiveTracking
                  : startLiveTracking
              }
              className={
                liveTracking
                  ? "w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100"
                  : "w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
              }
            >
              {liveTracking
                ? "Stop Live GPS"
                : "Start Live GPS"}
            </button>

            <ToggleField
              label="Voice replies"
              checked={voiceReply}
              onChange={setVoiceReply}
            />

            <ToggleField
              label="Proactive alerts"
              checked={proactiveAlerts}
              onChange={setProactiveAlerts}
            />

            <ToggleField
              label="Safety-first mode"
              checked={safetyMode}
              onChange={setSafetyMode}
            />

            <button
              type="button"
              onClick={startVoiceInput}
              disabled={listening}
              className="w-full rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 disabled:opacity-50"
            >
              {listening
                ? "Listening..."
                : "Speak to Mira"}
            </button>

            <button
              type="button"
              onClick={repeatLastReply}
              disabled={!lastMiraMessage}
              className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-40"
            >
              Repeat Last Reply
            </button>

            <button
              type="button"
              onClick={openEmergencyMode}
              className="w-full rounded-2xl border border-rose-400/30 bg-rose-500 px-5 py-3 text-sm font-bold text-white"
            >
              🚨 Emergency SOS
            </button>

            {speedWarning ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
                  Speed warning
                </p>

                <p className="mt-2 text-sm leading-6 text-rose-50/90">
                  Current speed is above the selected limit. Reduce
                  speed safely.
                </p>
              </div>
            ) : null}

            {driveState.stoppedSince ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Stop detected
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-50/90">
                  Vehicle appears stopped
                  {stoppedDurationMinutes > 0
                    ? ` for approximately ${stoppedDurationMinutes} minute${
                        stoppedDurationMinutes === 1 ? "" : "s"
                      }`
                    : ""}
                  . Mira can help record the stop reason later.
                </p>
              </div>
            ) : null}
          </aside>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80">
            <div className="border-b border-white/10 p-5 sm:p-6">
              <h2 className="text-xl font-bold">
                Ask Mira
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Use short commands while driving.
              </p>
            </div>

            <div className="max-h-[520px] space-y-4 overflow-y-auto p-5 sm:p-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                />
              ))}

              {loading ? (
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 text-sm text-fuchsia-100">
                  Mira is thinking...
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() =>
                      runQuickAction(action.prompt)
                    }
                    disabled={loading}
                    className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(event) =>
                  void submitMessage(event)
                }
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="text"
                  value={input}
                  placeholder="Ask Mira something..."
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="rounded-2xl bg-fuchsia-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          </section>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Mira Co-Driver Capabilities
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              title="Route Intelligence"
              description="Explains route choices, delays and alternate options."
            />

            <FeatureCard
              title="Live Driving Data"
              description="Reads browser GPS speed, stop state and current location."
            />

            <FeatureCard
              title="Safety Assistance"
              description="Provides speed, hazard, weather and driving-break alerts."
            />

            <FeatureCard
              title="Emergency Support"
              description="Opens SOS and immediate Ask Mira emergency actions."
            />
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Important:</strong> browser GPS speed depends on device
          support and signal quality. Live traffic, turn guidance and road
          speed limits still require the connected map provider.
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

function MessageBubble(props: {
  message: CoDriverMessage;
}) {
  const isMira =
    props.message.role === "mira";

  return (
    <article
      className={
        isMira
          ? "mr-auto max-w-[86%] rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-4"
          : "ml-auto max-w-[86%] rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {isMira ? "Mira" : "You"}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
        {props.message.text}
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
          props.onChange(
            event.target.checked
          )
        }
        className="h-5 w-5"
      />
    </label>
  );
}

function DriveMetric(props: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={
        props.warning
          ? "rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4"
          : "rounded-2xl border border-white/10 bg-slate-950/60 p-4"
      }
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {props.label}
      </p>

      <p
        className={
          props.warning
            ? "mt-1 text-lg font-bold text-rose-200"
            : "mt-1 text-lg font-bold text-white"
        }
      >
        {props.value}
      </p>
    </div>
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