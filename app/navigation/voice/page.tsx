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

type VoiceLanguage = {
  code: string;
  label: string;
};

type GuidanceStep = {
  id: number;
  instruction: string;
  distanceMeters: number;
  roadName?: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
    confidence: number;
  };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceCommand = {
  id: number;
  phrase: string;
  action: string;
};

const supportedLanguages: VoiceLanguage[] = [
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "kn-IN", label: "Kannada" },
  { code: "te-IN", label: "Telugu" },
  { code: "ta-IN", label: "Tamil" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "bn-IN", label: "Bengali" },
  { code: "mr-IN", label: "Marathi" },
  { code: "or-IN", label: "Odia" },
];

const demoSteps: GuidanceStep[] = [
  {
    id: 1,
    instruction: "Continue straight for 500 metres.",
    distanceMeters: 500,
    roadName: "Main Road",
  },
  {
    id: 2,
    instruction: "Turn left at the next signal.",
    distanceMeters: 120,
    roadName: "MG Road",
  },
  {
    id: 3,
    instruction: "Keep right and continue for 1 kilometre.",
    distanceMeters: 1000,
    roadName: "Outer Ring Road",
  },
  {
    id: 4,
    instruction: "Your destination will be on the left.",
    distanceMeters: 80,
  },
];

const commandExamples: VoiceCommand[] = [
  {
    id: 1,
    phrase: "Hey Mira, navigate home",
    action: "Open saved Home navigation",
  },
  {
    id: 2,
    phrase: "Hey Mira, find a petrol pump",
    action: "Open Fuel Assistant",
  },
  {
    id: 3,
    phrase: "Hey Mira, find EV charging",
    action: "Open EV charging options",
  },
  {
    id: 4,
    phrase: "Hey Mira, find parking",
    action: "Open Smart Parking",
  },
  {
    id: 5,
    phrase: "Hey Mira, avoid tolls",
    action: "Update route preference",
  },
  {
    id: 6,
    phrase: "Hey Mira, share my trip",
    action: "Open secure journey sharing",
  },
  {
    id: 7,
    phrase: "Hey Mira, where did I park?",
    action: "Open saved parking location",
  },
  {
    id: 8,
    phrase: "Mira SOS",
    action: "Open Emergency Navigation",
  },
];

export default function MiraVoiceNavigationPage() {
  const router = useRouter();

  const [language, setLanguage] =
    useState("en-IN");

  const [volume, setVolume] =
    useState(1);

  const [rate, setRate] =
    useState(1);

  const [pitch, setPitch] =
    useState(1);

  const [enabled, setEnabled] =
    useState(true);

  const [announceEta, setAnnounceEta] =
    useState(true);

  const [announceTraffic, setAnnounceTraffic] =
    useState(true);

  const [announceSpeed, setAnnounceSpeed] =
    useState(true);

  const [currentStepIndex, setCurrentStepIndex] =
    useState(0);

  const [speaking, setSpeaking] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [voices, setVoices] =
    useState<SpeechSynthesisVoice[]>([]);

  const [selectedVoiceName, setSelectedVoiceName] =
    useState("");

  const [wakeWordEnabled, setWakeWordEnabled] =
    useState(false);

  const [handsFreeMode, setHandsFreeMode] =
    useState(false);

  const [listening, setListening] =
    useState(false);

  const [transcript, setTranscript] =
    useState("");

  const [lastCommand, setLastCommand] =
    useState("");

  const [confirmRerouting, setConfirmRerouting] =
    useState(true);

  const [autoVolumeBySpeed, setAutoVolumeBySpeed] =
    useState(false);

  const [bluetoothPreferred, setBluetoothPreferred] =
    useState(true);

  const [offlineVoicePack, setOfflineVoicePack] =
    useState(false);

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can help configure wake word, hands-free commands, language, rerouting confirmation, emergency commands and voice output."
    );

  const recognitionRef =
    useRef<SpeechRecognitionLike | null>(null);

  const speedWarningTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function loadVoices() {
      const available =
        window.speechSynthesis.getVoices();

      setVoices(available);

      const matchingVoice =
        available.find((voice) =>
          voice.lang
            .toLowerCase()
            .startsWith(
              language.toLowerCase()
            )
        );

      if (
        matchingVoice &&
        !selectedVoiceName
      ) {
        setSelectedVoiceName(
          matchingVoice.name
        );
      }
    }

    loadVoices();

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.cancel();

      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );

      if (
        speedWarningTimerRef.current
      ) {
        clearInterval(
          speedWarningTimerRef.current
        );
      }

      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [language, selectedVoiceName]);

  const filteredVoices = useMemo(
    () =>
      voices.filter((voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(
            language
              .slice(0, 2)
              .toLowerCase()
          )
      ),
    [voices, language]
  );

  const currentStep =
    demoSteps[currentStepIndex];

  function speak(
    text: string
  ) {
    setError("");
    setMessage("");

    if (!enabled) {
      setError(
        "Voice guidance is switched off."
      );
      return;
    }

    if (
      !("speechSynthesis" in window)
    ) {
      setError(
        "Speech synthesis is not supported in this browser."
      );
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      language;

    utterance.volume =
      volume;

    utterance.rate =
      rate;

    utterance.pitch =
      pitch;

    const selectedVoice =
      voices.find(
        (voice) =>
          voice.name ===
          selectedVoiceName
      );

    if (selectedVoice) {
      utterance.voice =
        selectedVoice;
    }

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setError(
        "Unable to play the voice instruction."
      );
    };

    window.speechSynthesis.speak(
      utterance
    );
  }

  function testVoice() {
    speak(
      getLocalizedTestMessage(
        language
      )
    );
  }

  function announceCurrentStep() {
    speak(
      buildGuidanceMessage(
        currentStep
      )
    );
  }

  function nextStep() {
    setCurrentStepIndex(
      (current) =>
        Math.min(
          current + 1,
          demoSteps.length - 1
        )
    );

    const next =
      demoSteps[
        Math.min(
          currentStepIndex + 1,
          demoSteps.length - 1
        )
      ];

    if (next) {
      speak(
        buildGuidanceMessage(
          next
        )
      );
    }
  }

  function previousStep() {
    setCurrentStepIndex(
      (current) =>
        Math.max(
          current - 1,
          0
        )
    );
  }

  function announceTripSummary() {
    const messages: string[] = [];

    if (announceEta) {
      messages.push(
        "Estimated arrival time is 25 minutes."
      );
    }

    if (announceTraffic) {
      messages.push(
        "Moderate traffic is reported ahead."
      );
    }

    if (announceSpeed) {
      messages.push(
        "The current speed limit is 60 kilometres per hour."
      );
    }

    speak(
      messages.join(" ")
    );
  }

  function simulateSpeedWarning() {
    if (!announceSpeed) {
      setError(
        "Speed warnings are disabled."
      );
      return;
    }

    speak(
      "Speed warning. Please reduce your speed."
    );
  }

  function stopVoice() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setMessage(
      "Voice guidance stopped."
    );
  }

  function getSpeechRecognitionConstructor() {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    return (
      browserWindow.SpeechRecognition ||
      browserWindow.webkitSpeechRecognition ||
      null
    );
  }

  function startListening() {
    setError("");
    setMessage("");

    const Recognition =
      getSpeechRecognitionConstructor();

    if (!Recognition) {
      setError(
        "Speech recognition is not supported in this browser. Chrome or the mobile app will be required."
      );
      return;
    }

    recognitionRef.current?.abort();

    const recognition =
      new Recognition();

    recognition.continuous =
      handsFreeMode;

    recognition.interimResults =
      false;

    recognition.lang =
      language;

    recognition.onresult = (
      event
    ) => {
      const result =
        event.results[
          event.results.length - 1
        ];

      const spokenText =
        result?.[0]?.transcript
          ?.trim() || "";

      setTranscript(
        spokenText
      );

      if (spokenText) {
        handleVoiceCommand(
          spokenText
        );
      }
    };

    recognition.onerror = (
      event
    ) => {
      setListening(false);
      setError(
        event.error
          ? `Voice recognition error: ${event.error}`
          : "Voice recognition failed."
      );
    };

    recognition.onend = () => {
      setListening(false);

      if (
        handsFreeMode &&
        wakeWordEnabled
      ) {
        window.setTimeout(() => {
          try {
            recognition.start();
            setListening(true);
          } catch {
            // Browser may block automatic restart.
          }
        }, 600);
      }
    };

    recognitionRef.current =
      recognition;

    recognition.start();

    setListening(true);
    setMessage(
      wakeWordEnabled
        ? 'Listening for "Hey Mira"...'
        : "Listening for a voice command..."
    );
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setMessage(
      "Voice listening stopped."
    );
  }

  function handleVoiceCommand(
    rawCommand: string
  ) {
    const command =
      rawCommand.trim().toLowerCase();

    const normalized =
      command
        .replace(/^hey mira[,\s]*/i, "")
        .replace(/^mira[,\s]*/i, "")
        .trim();

    setLastCommand(
      rawCommand
    );

    if (
      wakeWordEnabled &&
      !command.includes("mira")
    ) {
      setMessage(
        'Wake word not detected. Say "Hey Mira" before the command.'
      );
      return;
    }

    if (
      normalized.includes("stop") ||
      normalized.includes("cancel")
    ) {
      stopVoice();
      stopListening();
      return;
    }

    if (
      normalized.includes("navigate home")
    ) {
      speak(
        "Opening your saved Home location."
      );
      router.push(
        "/navigation/saved"
      );
      return;
    }

    if (
      normalized.includes("petrol") ||
      normalized.includes("fuel")
    ) {
      speak(
        "Opening nearby fuel stations."
      );
      router.push(
        "/navigation/fuel-assistant"
      );
      return;
    }

    if (
      normalized.includes("ev charger") ||
      normalized.includes("charging")
    ) {
      speak(
        "Opening nearby electric vehicle charging options."
      );
      router.push(
        "/navigation/fuel-assistant"
      );
      return;
    }

    if (
      normalized.includes("parking")
    ) {
      speak(
        "Opening smart parking."
      );
      router.push(
        "/navigation/parking-ai"
      );
      return;
    }

    if (
      normalized.includes("avoid toll")
    ) {
      speak(
        "Opening navigation settings so toll roads can be avoided."
      );
      router.push(
        "/navigation/settings"
      );
      return;
    }

    if (
      normalized.includes("share my trip") ||
      normalized.includes("share journey")
    ) {
      speak(
        "Opening secure journey sharing."
      );
      router.push(
        "/navigation/share"
      );
      return;
    }

    if (
      normalized.includes("where did i park") ||
      normalized.includes("parked location")
    ) {
      speak(
        "Opening your saved parking information."
      );
      router.push(
        "/navigation/parking-ai"
      );
      return;
    }

    if (
      normalized.includes("sos") ||
      normalized.includes("emergency") ||
      normalized.includes("hospital")
    ) {
      speak(
        "Opening Emergency Navigation."
      );
      router.push(
        "/navigation/emergency"
      );
      return;
    }

    if (
      normalized.includes("why did you reroute")
    ) {
      speak(
        "I reroute only when the alternate route is expected to save meaningful time or improve safety."
      );
      return;
    }

    setMiraReply(
      `I heard: "${rawCommand}". This command is not connected yet.`
    );

    speak(
      "I heard your command, but this action is not connected yet."
    );
  }

  function simulateRerouteRequest() {
    if (
      confirmRerouting
    ) {
      speak(
        "A faster route can save eight minutes. Say confirm reroute or keep current route."
      );

      setMessage(
        "Waiting for rerouting confirmation."
      );
      return;
    }

    speak(
      "Switching to the faster route."
    );

    setMessage(
      "Reroute accepted automatically in preview mode."
    );
  }

  function downloadOfflineVoicePack() {
    setOfflineVoicePack(
      true
    );

    setMessage(
      `${supportedLanguages.find(
        (item) =>
          item.code === language
      )?.label ?? "Selected"} offline voice pack marked for download in preview mode.`
    );
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion
        .trim()
        .toLowerCase();

    if (!question) return;

    if (
      question.includes("wake")
    ) {
      setMiraReply(
        wakeWordEnabled
          ? 'The "Hey Mira" wake-word framework is enabled.'
          : 'The "Hey Mira" wake-word framework is disabled.'
      );
    } else if (
      question.includes("offline")
    ) {
      setMiraReply(
        offlineVoicePack
          ? "An offline voice pack is marked as installed in this preview."
          : "No offline voice pack is currently installed."
      );
    } else if (
      question.includes("bluetooth")
    ) {
      setMiraReply(
        bluetoothPreferred
          ? "Bluetooth audio is preferred when a compatible device is connected."
          : "Bluetooth audio preference is disabled."
      );
    } else if (
      question.includes("reroute")
    ) {
      setMiraReply(
        confirmRerouting
          ? "Mira will ask before changing the route."
          : "Mira may accept meaningful reroutes automatically."
      );
    } else {
      setMiraReply(
        `Voice guidance is ${
          enabled
            ? "enabled"
            : "disabled"
        }, language is ${
          supportedLanguages.find(
            (item) =>
              item.code === language
          )?.label ?? language
        }, and hands-free mode is ${
          handsFreeMode
            ? "enabled"
            : "disabled"
        }.`
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Voice Navigation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Configure Mira's spoken directions, language, voice, traffic announcements and speed warnings.
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Voice Guidance"
            value={
              enabled
                ? "Enabled"
                : "Disabled"
            }
          />

          <Metric
            label="Wake Word"
            value={
              wakeWordEnabled
                ? "Hey Mira"
                : "Off"
            }
          />

          <Metric
            label="Hands-Free"
            value={
              handsFreeMode
                ? "Enabled"
                : "Disabled"
            }
          />

          <Metric
            label="Listening"
            value={
              listening
                ? "Active"
                : "Standby"
            }
          />

          <Metric
            label="Offline Voice"
            value={
              offlineVoicePack
                ? "Installed"
                : "Not installed"
            }
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Voice settings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose how Mira should speak during navigation.
              </p>
            </div>

            <ToggleField
              label="Voice guidance"
              checked={enabled}
              onChange={setEnabled}
            />

            <SelectField
              label="Language"
              value={language}
              options={supportedLanguages.map(
                (item) => [
                  item.code,
                  item.label,
                ]
              )}
              onChange={(value) => {
                setLanguage(value);
                setSelectedVoiceName("");
              }}
            />

            <SelectField
              label="Voice"
              value={selectedVoiceName}
              options={
                filteredVoices.length
                  ? filteredVoices.map(
                      (voice) => [
                        voice.name,
                        `${voice.name} (${voice.lang})`,
                      ]
                    )
                  : [
                      [
                        "",
                        "System default voice",
                      ],
                    ]
              }
              onChange={
                setSelectedVoiceName
              }
            />

            <RangeField
              label="Volume"
              value={volume}
              min={0}
              max={1}
              step={0.1}
              onChange={setVolume}
            />

            <RangeField
              label="Speech rate"
              value={rate}
              min={0.5}
              max={1.5}
              step={0.1}
              onChange={setRate}
            />

            <RangeField
              label="Pitch"
              value={pitch}
              min={0.5}
              max={1.5}
              step={0.1}
              onChange={setPitch}
            />

            <ToggleField
              label='Enable "Hey Mira" wake word'
              checked={wakeWordEnabled}
              onChange={setWakeWordEnabled}
            />

            <ToggleField
              label="Continuous hands-free mode"
              checked={handsFreeMode}
              onChange={setHandsFreeMode}
            />

            <ToggleField
              label="Confirm before rerouting"
              checked={confirmRerouting}
              onChange={setConfirmRerouting}
            />

            <ToggleField
              label="Automatic volume by speed"
              checked={autoVolumeBySpeed}
              onChange={setAutoVolumeBySpeed}
            />

            <ToggleField
              label="Prefer Bluetooth audio"
              checked={bluetoothPreferred}
              onChange={setBluetoothPreferred}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={
                  listening
                    ? stopListening
                    : startListening
                }
                className={
                  listening
                    ? "rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100"
                    : "rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
                }
              >
                {listening
                  ? "Stop Listening"
                  : "Start Listening"}
              </button>

              <button
                type="button"
                onClick={downloadOfflineVoicePack}
                className="rounded-2xl border border-blue-400/30 bg-blue-400/10 px-5 py-3 text-sm font-semibold text-blue-100"
              >
                {offlineVoicePack
                  ? "Offline Voice Installed"
                  : "Download Voice Pack"}
              </button>
            </div>

            {transcript ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last transcript
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {transcript}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={testVoice}
              disabled={!enabled}
              className="w-full rounded-2xl bg-violet-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              Test Mira Voice
            </button>

            {speaking ? (
              <button
                type="button"
                onClick={stopVoice}
                className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-6 py-3 text-sm font-semibold text-rose-100"
              >
                Stop speaking
              </button>
            ) : null}
          </article>

          <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Turn-by-turn preview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Preview how Mira will announce route instructions.
              </p>
            </div>

            <div className="rounded-3xl border border-violet-400/30 bg-violet-400/10 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                Current instruction
              </p>

              <h3 className="mt-3 text-2xl font-bold">
                {currentStep.instruction}
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                {currentStep.roadName
                  ? `Road: ${currentStep.roadName}`
                  : "Final destination instruction"}
              </p>

              <p className="mt-4 text-sm font-semibold text-violet-200">
                {formatDistance(
                  currentStep.distanceMeters
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={previousStep}
                disabled={
                  currentStepIndex === 0
                }
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={
                  announceCurrentStep
                }
                className="rounded-2xl bg-violet-400 px-4 py-3 text-sm font-bold text-slate-950"
              >
                Speak
              </button>

              <button
                type="button"
                onClick={nextStep}
                disabled={
                  currentStepIndex ===
                  demoSteps.length - 1
                }
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>

            <div className="space-y-3">
              <ToggleField
                label="Announce ETA"
                checked={announceEta}
                onChange={setAnnounceEta}
              />

              <ToggleField
                label="Announce traffic changes"
                checked={announceTraffic}
                onChange={
                  setAnnounceTraffic
                }
              />

              <ToggleField
                label="Announce speed warnings"
                checked={announceSpeed}
                onChange={
                  setAnnounceSpeed
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={
                  announceTripSummary
                }
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
              >
                Announce trip summary
              </button>

              <button
                type="button"
                onClick={
                  simulateSpeedWarning
                }
                className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100"
              >
                Test speed warning
              </button>
            </div>

            <button
              type="button"
              onClick={simulateRerouteRequest}
              className="w-full rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-100"
            >
              Test Voice Rerouting Confirmation
            </button>

            {lastCommand ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last command
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {lastCommand}
                </p>
              </div>
            ) : null}
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Hands-Free Command Centre
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Supported preview commands for navigation, fuel, parking, sharing and emergencies.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {commandExamples.map(
              (command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() =>
                    handleVoiceCommand(
                      command.phrase
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:border-violet-400/30"
                >
                  <p className="font-semibold text-violet-200">
                    “{command.phrase}”
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {command.action}
                  </p>
                </button>
              )
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            Ask Mira Voice Settings
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
              placeholder="Ask about wake word, offline voice, Bluetooth or rerouting..."
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

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-xl font-bold">
            Voice guidance behaviour
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FeatureCard
              title="Turn instructions"
              description="Mira announces upcoming turns, exits, road names and destination approach."
            />

            <FeatureCard
              title="Traffic updates"
              description="Mira announces meaningful congestion, delays and rerouting recommendations."
            />

            <FeatureCard
              title="Safety warnings"
              description="Mira can announce speed warnings, school zones and attention alerts when live data is available."
            />
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> browser speech synthesis and recognition are used for this preview. Reliable always-on wake word, offline recognition, Bluetooth routing and background listening require native mobile services and on-device voice processing.
        </section>

        <Link
          href="/navigation/live"
          className="inline-block pb-4 text-sm font-semibold text-cyan-300 hover:underline"
        >
          ← Back to AI Live Navigation
        </Link>
      </div>
    </main>
  );
}

function buildGuidanceMessage(
  step: GuidanceStep
) {
  if (step.roadName) {
    return `${step.instruction} Continue on ${step.roadName}.`;
  }

  return step.instruction;
}

function getLocalizedTestMessage(
  language: string
) {
  const messages: Record<
    string,
    string
  > = {
    "en-IN":
      "Hello. I am Mira. Voice navigation is ready.",
    "hi-IN":
      "नमस्ते। मैं मीरा हूँ। वॉइस नेविगेशन तैयार है।",
    "kn-IN":
      "ನಮಸ್ಕಾರ. ನಾನು ಮೀರಾ. ಧ್ವನಿ ನ್ಯಾವಿಗೇಶನ್ ಸಿದ್ಧವಾಗಿದೆ.",
    "te-IN":
      "నమస్కారం. నేను మీరా. వాయిస్ నావిగేషన్ సిద్ధంగా ఉంది.",
    "ta-IN":
      "வணக்கம். நான் மீரா. குரல் வழிசெலுத்தல் தயாராக உள்ளது.",
    "ml-IN":
      "നമസ്കാരം. ഞാൻ മീറയാണ്. വോയ്സ് നാവിഗേഷൻ തയ്യാറാണ്.",
    "bn-IN":
      "নমস্কার। আমি মীরা। ভয়েস নেভিগেশন প্রস্তুত।",
    "mr-IN":
      "नमस्कार. मी मीरा आहे. व्हॉइस नेव्हिगेशन तयार आहे.",
    "or-IN":
      "ନମସ୍କାର। ମୁଁ ମୀରା। ଭଏସ୍ ନାଭିଗେସନ୍ ପ୍ରସ୍ତୁତ ଅଛି।",
  };

  return (
    messages[language] ??
    messages["en-IN"]
  );
}

function formatDistance(
  distanceMeters: number
) {
  if (distanceMeters >= 1000) {
    return `${(
      distanceMeters / 1000
    ).toFixed(1)} km ahead`;
  }

  return `${distanceMeters} metres ahead`;
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

function SelectField(props: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
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

function RangeField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {props.label}
        </span>

        <span className="text-sm font-semibold text-slate-300">
          {props.value.toFixed(1)}
        </span>
      </div>

      <input
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(event) =>
          props.onChange(
            Number(
              event.target.value
            )
          )
        }
        className="w-full"
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