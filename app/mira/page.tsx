"use client";

import {
  ArrowLeft,
  Bot,
  Car,
  FileText,
  Map,
  Mic,
  ShoppingBag,
  MicOff,
  Navigation,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal?: boolean;
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const LANGUAGES = [
  { code: "en", label: "English", speechCode: "en-IN" },
  { code: "hi", label: "Hindi", speechCode: "hi-IN" },
  { code: "kn", label: "Kannada", speechCode: "kn-IN" },
  { code: "te", label: "Telugu", speechCode: "te-IN" },
  { code: "ta", label: "Tamil", speechCode: "ta-IN" },
  { code: "ml", label: "Malayalam", speechCode: "ml-IN" },
  { code: "mr", label: "Marathi", speechCode: "mr-IN" },
  { code: "bn", label: "Bengali", speechCode: "bn-IN" },
];

const QUICK_COMMANDS = [
  {
    label: "Plan a Trip",
    prompt: "Plan a trip from Bengaluru to Mysuru",
    icon: Route,
  },
  {
    label: "Check Challans",
    prompt: "Check my traffic challans",
    icon: ShieldAlert,
  },
  {
    label: "Show Documents",
    prompt: "Show my vehicle documents",
    icon: FileText,
  },
  {
    label: "Find Workshop",
    prompt: "Find a nearby workshop",
    icon: Wrench,
  },
  {
    label: "Start Navigation",
    prompt: "Navigate to Bengaluru Airport",
    icon: Navigation,
  },
  {
    label: "Vehicle Summary",
    prompt: "Give me today's vehicle summary",
    icon: Car,
  },
  {
    label: "Service History",
    prompt: "Show my service history",
    icon: Wrench,
  },
  {
    label: "Marketplace",
    prompt: "Open marketplace",
    icon: ShoppingBag,
  },
];

const WAKE_PHRASES = ["hey mira", "hi mira", "okay mira", "ok mira", "mira"];

function removeWakePhrase(value: string) {
  const normalized = value.trim();

  for (const phrase of WAKE_PHRASES) {
    const index = normalized.toLowerCase().indexOf(phrase);

    if (index !== -1) {
      return normalized
        .slice(index + phrase.length)
        .replace(/^[,.\s!?-]+/, "")
        .trim();
    }
  }

  return normalized;
}

function getIntentRoute(command: string) {
  const text = command.toLowerCase();

  if (
    text.includes("challan") ||
    text.includes("fine") ||
    text.includes("traffic ticket")
  ) {
    return "/challans";
  }

  if (
    text.includes("document") ||
    text.includes("insurance") ||
    text.includes("rc") ||
    text.includes("puc") ||
    text.includes("driving licence") ||
    text.includes("driving license")
  ) {
    return "/documents";
  }

  if (
    text.includes("workshop") ||
    text.includes("mechanic") ||
    text.includes("service centre") ||
    text.includes("service center")
  ) {
    return "/workshops";
  }

  if (
    text.includes("service history") ||
    text.includes("service records") ||
    text.includes("maintenance history") ||
    text.includes("maintenance records")
  ) {
    return "/service-history";
  }

  if (
    text.includes("book service") ||
    text.includes("book my service") ||
    text.includes("book vehicle service") ||
    text.includes("service booking") ||
    text.includes("schedule service")
  ) {
    return "/service-booking";
  }

  if (
    text.includes("marketplace") ||
    text.includes("accessories") ||
    text.includes("dashcam") ||
    text.includes("gps tracker") ||
    text.includes("engine oil") ||
    text.includes("buy tyre") ||
    text.includes("buy tire") ||
    text.includes("buy battery")
  ) {
    return "/marketplace";
  }

  if (
    text.includes("vehicle summary") ||
    text.includes("today's vehicle summary") ||
    text.includes("todays vehicle summary") ||
    text.includes("show my vehicle") ||
    text.includes("my vehicle status")
  ) {
    return "/";
  }

  if (
    text.includes("reminder") ||
    text.includes("service due") ||
    text.includes("renewal")
  ) {
    return "/reminders";
  }

  if (
    text.includes("sos") ||
    text.includes("emergency") ||
    text.includes("accident")
  ) {
    return "/sos";
  }

  if (
    text.includes("plan a trip") ||
    text.includes("trip plan") ||
    text.includes("road trip")
  ) {
    return `/navigation/trip-planner?query=${encodeURIComponent(command)}`;
  }

  if (
    text.includes("navigate") ||
    text.includes("directions") ||
    text.includes("take me to") ||
    text.includes("go to")
  ) {
    const destination = command
      .replace(/navigate to/gi, "")
      .replace(/take me to/gi, "")
      .replace(/directions to/gi, "")
      .replace(/go to/gi, "")
      .trim();

    return destination
      ? `/navigation?destination=${encodeURIComponent(destination)}`
      : "/navigation";
  }

  return null;
}

function getDirectActionReply(route: string): string {
  if (route.startsWith("/documents")) return "Opening your Document Vault.";
  if (route.startsWith("/challans")) return "Opening your challans.";
  if (route.startsWith("/workshops")) return "Opening nearby workshops.";
  if (route.startsWith("/service-history")) return "Opening your service history.";
  if (route.startsWith("/service-booking")) return "Opening service booking.";
  if (route.startsWith("/marketplace")) return "Opening the marketplace.";
  if (route.startsWith("/reminders")) return "Opening your reminders.";
  if (route.startsWith("/sos")) return "Opening emergency assistance.";
  if (route.startsWith("/navigation/trip-planner")) return "Opening the trip planner.";
  if (route.startsWith("/navigation")) return "Opening navigation.";
  if (route === "/") return "Opening your vehicle dashboard.";

  return "Opening that for you.";
}

export default function MiraPage() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const shouldRestartListeningRef = useRef(false);
  const waitingForCommandRef = useRef(false);
  const wakeWordEnabledRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hello, I’m Mira. Say “Hey Mira” or tap the microphone and tell me what you need.",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [waitingForCommand, setWaitingForCommand] = useState(false);

  const currentLanguage = useMemo(
    () =>
      LANGUAGES.find(
        (language) => language.code === selectedLanguage
      ) || LANGUAGES[0],
    [selectedLanguage]
  );

  const latestAssistantMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant")
        ?.content || "",
    [messages]
  );

  useEffect(() => {
    waitingForCommandRef.current = waitingForCommand;
  }, [waitingForCommand]);

  useEffect(() => {
    wakeWordEnabledRef.current = wakeWordEnabled;

    if (!wakeWordEnabled) {
      waitingForCommandRef.current = false;
      setWaitingForCommand(false);
    }
  }, [wakeWordEnabled]);

  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as typeof window & {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).SpeechRecognition ||
        (
          window as typeof window & {
            SpeechRecognition?: SpeechRecognitionConstructor;
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
          }
        ).webkitSpeechRecognition
    );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!autoSpeak || !latestAssistantMessage.trim()) return;

    speak(latestAssistantMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAssistantMessage]);

  useEffect(() => {
    return () => {
      shouldRestartListeningRef.current = false;

      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }

      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function getRecognitionConstructor() {
    if (typeof window === "undefined") return null;

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

  function getPreferredFemaleVoice(
    voices: SpeechSynthesisVoice[],
    languageCode: string
  ) {
    const normalizedLanguage = languageCode.toLowerCase();
    const baseLanguage = normalizedLanguage.split("-")[0];

    const preferredFemaleNames = [
      "Microsoft Neerja",
      "Microsoft Heera",
      "Microsoft Zira",
      "Microsoft Hazel",
      "Microsoft Susan",
      "Microsoft Sonia",
      "Google UK English Female",
      "Google US English",
      "Samantha",
      "Karen",
      "Moira",
      "Tessa",
      "Veena",
      "Lekha",
    ];

    const languageVoices = voices.filter((voice) => {
      const voiceLanguage = voice.lang.toLowerCase();

      return (
        voiceLanguage === normalizedLanguage ||
        voiceLanguage.startsWith(`${baseLanguage}-`) ||
        voiceLanguage === baseLanguage
      );
    });

    for (const preferredName of preferredFemaleNames) {
      const exactMatch = languageVoices.find((voice) =>
        voice.name.toLowerCase().includes(preferredName.toLowerCase())
      );

      if (exactMatch) {
        return exactMatch;
      }
    }

    const femaleHintMatch = languageVoices.find((voice) => {
      const name = voice.name.toLowerCase();

      return [
        "female",
        "woman",
        "neerja",
        "heera",
        "zira",
        "hazel",
        "susan",
        "sonia",
        "samantha",
        "karen",
        "moira",
        "tessa",
        "veena",
        "lekha",
      ].some((hint) => name.includes(hint));
    });

    if (femaleHintMatch) {
      return femaleHintMatch;
    }

    return languageVoices[0] || voices[0] || null;
  }

  function speak(text: string) {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !text.trim()
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const speakWithAvailableVoices = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = getPreferredFemaleVoice(
        voices,
        currentLanguage.speechCode
      );

      utterance.lang = currentLanguage.speechCode;
      utterance.rate = 0.98;
      utterance.pitch = 1.08;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    const availableVoices = window.speechSynthesis.getVoices();

    if (availableVoices.length > 0) {
      speakWithAvailableVoices();
      return;
    }

    const handleVoicesChanged = () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged
      );
      speakWithAvailableVoices();
    };

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      handleVoicesChanged,
      { once: true }
    );

    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged
      );

      if (!window.speechSynthesis.speaking) {
        speakWithAvailableVoices();
      }
    }, 500);
  }

  function stopSpeaking() {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }
  }

  function startListening() {
    setVoiceError("");

    if (!speechRecognitionSupported) {
      setVoiceError(
        "Voice recognition is not supported in this browser. Use Chrome or Edge."
      );
      return;
    }

    const RecognitionConstructor = getRecognitionConstructor();
    if (!RecognitionConstructor) return;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Avoid aborting an already active recognizer. That was causing
    // Chrome/Edge to immediately report "Voice input failed: aborted".
    if (recognitionRef.current && isListening) {
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;

      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore cleanup errors from an already-ended recognizer.
      }

      recognitionRef.current = null;
    }

    const recognition = new RecognitionConstructor();
    recognition.lang = currentLanguage.speechCode;

    // Single-utterance recognition is more reliable in Chrome/Edge.
    // Wake phrase mode is kept alive by restarting after each clean end.
    recognition.continuous = false;
    recognition.interimResults = false;

    shouldRestartListeningRef.current = true;

    recognition.onresult = (event) => {
      const latestResult =
        event.results[event.results.length - 1]?.[0]?.transcript?.trim() ||
        "";

      if (!latestResult) return;

      const normalizedResult = latestResult.toLowerCase().trim();
      const containsWakePhrase = WAKE_PHRASES.some(
        (phrase) =>
          normalizedResult === phrase ||
          normalizedResult.startsWith(`${phrase} `) ||
          normalizedResult.includes(` ${phrase} `)
      );

      if (waitingForCommandRef.current) {
        waitingForCommandRef.current = false;
        setWaitingForCommand(false);
        setInput(latestResult);
        void sendMessage(latestResult);
        return;
      }

      if (wakeWordEnabledRef.current && !containsWakePhrase) {
        return;
      }

      const command = removeWakePhrase(latestResult);

      if (!command) {
        const acknowledgement = "Yes, I’m listening. How can I help?";

        waitingForCommandRef.current = true;
        setWaitingForCommand(true);
        setMessages((current) => [
          ...current,
          {
            id: Date.now(),
            role: "assistant",
            content: acknowledgement,
          },
        ]);

        speak(acknowledgement);
        setVoiceError("");
        return;
      }

      setInput(command);
      void sendMessage(command);
    };

    recognition.onerror = (event) => {
      const errorName = event.error || "unknown";

      // "aborted" is normally generated by browser cleanup and should not
      // be presented to the user as a microphone failure.
      if (errorName !== "aborted") {
        setVoiceError(
          errorName === "not-allowed"
            ? "Microphone permission was denied."
            : errorName === "no-speech"
              ? "No speech was detected. Tap the microphone and try again."
              : errorName === "audio-capture"
                ? "No microphone was detected."
                : `Voice input failed: ${errorName}`
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }

      setIsListening(false);

      const shouldKeepListening =
        shouldRestartListeningRef.current &&
        (wakeWordEnabledRef.current || waitingForCommandRef.current);

      if (shouldKeepListening) {
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          startListening();
        }, 650);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError(
        "The microphone is busy. Wait a moment, then tap Tap to Talk again."
      );
    }
  }

  function stopListening() {
    shouldRestartListeningRef.current = false;
    waitingForCommandRef.current = false;
    setWaitingForCommand(false);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const recognition = recognitionRef.current;

    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;

      try {
        recognition.stop();
      } catch {
        // Recognition may already have stopped.
      }

      recognitionRef.current = null;
    }

    setIsListening(false);
    setVoiceError("");
  }

  async function sendMessage(rawMessage?: string) {
    const message = (rawMessage ?? input).trim();

    if (!message || isThinking) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: message,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsThinking(true);
    setVoiceError("");

    try {
      // Simple My Vehicle actions should feel immediate.
      // Mira confirms the action first, then opens the correct page.
      // No AI/API call is needed for these straightforward commands.
      const directRoute = getIntentRoute(message);

      if (directRoute) {
        const directReply = getDirectActionReply(directRoute);

        setMessages((current) => [
          ...current,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: directReply,
          },
        ]);

        if (autoSpeak) {
          speak(directReply);
        }

        window.setTimeout(() => {
          router.push(directRoute);
        }, 2500);

        return;
      }

      // For conversational or non-direct requests, use authenticated Mira AI.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error("Unable to verify your login. Please sign in again.");
      }

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in to use Mira.");
      }

      const response = await fetch("/api/mira", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message,
          language: currentLanguage.label,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        output_text?: string;
        text?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Mira could not respond.");
      }

      const reply =
        data.reply ||
        data.output_text ||
        data.text ||
        "I understood your request.";

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (caughtError) {
      const fallbackReply =
        caughtError instanceof Error
          ? caughtError.message
          : "Mira is temporarily unavailable.";

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: fallbackReply,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#312e81_0%,#0f172a_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_15px_45px_rgba(139,92,246,0.35)]">
                <Sparkles size={30} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  Voice-First AI Vehicle Companion
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  Ask Mira
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Say “Hey Mira” or tap the microphone to navigate,
                  check challans, open documents, plan trips and get
                  vehicle assistance.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <span className="mr-3 text-xs font-bold text-slate-500">
                  Language
                </span>

                <select
                  value={selectedLanguage}
                  onChange={(event) =>
                    setSelectedLanguage(event.target.value)
                  }
                  className="bg-transparent text-sm font-bold text-white outline-none"
                >
                  {LANGUAGES.map((language) => (
                    <option
                      key={language.code}
                      value={language.code}
                      className="bg-slate-950"
                    >
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => setAutoSpeak((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                  autoSpeak
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-slate-400"
                }`}
              >
                {autoSpeak ? (
                  <Volume2 size={18} />
                ) : (
                  <VolumeX size={18} />
                )}
                Speak replies
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl">
              <div className="text-center">
                <div
                  className={`mx-auto grid h-32 w-32 place-items-center rounded-full border-4 transition ${
                    isListening
                      ? "animate-pulse border-violet-300 bg-violet-500/20 text-violet-100"
                      : "border-white/10 bg-slate-950/70 text-violet-300"
                  }`}
                >
                  {isListening ? (
                    <Mic size={48} />
                  ) : (
                    <Bot size={48} />
                  )}
                </div>

                <h2 className="mt-5 text-2xl font-black">
                  {isListening
                    ? waitingForCommand
                      ? "Tell me what you need"
                      : "Mira is listening"
                    : "Say “Mira”"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {isListening
                    ? waitingForCommand
                      ? "Mira is ready for your command."
                      : "Say “Mira” and she will respond immediately."
                    : "Tap once to activate hands-free listening."}
                </p>
              </div>

              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black transition ${
                  isListening
                    ? "bg-rose-500 text-white"
                    : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff size={20} />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    Tap to Talk
                  </>
                )}
              </button>

              <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div>
                  <p className="text-sm font-black text-slate-200">
                    Wake phrase mode
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Mira responds immediately when you say “Mira” or “Hey Mira”.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setWakeWordEnabled((current) => !current)
                  }
                  aria-pressed={wakeWordEnabled}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    wakeWordEnabled ? "bg-violet-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                      wakeWordEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </label>

              {voiceError ? (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs leading-5 text-rose-200">
                  {voiceError}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-black">Quick Voice Commands</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {QUICK_COMMANDS.map((command) => {
                  const Icon = command.icon;

                  return (
                    <button
                      key={command.label}
                      type="button"
                      onClick={() => void sendMessage(command.prompt)}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-left transition hover:border-violet-400/30 hover:bg-violet-500/10"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-violet-300">
                        <Icon size={19} />
                      </span>

                      <span>
                        <span className="block text-sm font-black">
                          {command.label}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {command.prompt}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <section className="flex min-h-[720px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                  Live Conversation
                </p>
                <h2 className="mt-1 text-xl font-black">Mira Assistant</h2>
              </div>

              <button
                type="button"
                onClick={stopSpeaking}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white/[0.08]"
              >
                <Square size={14} />
                Stop Voice
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-6 sm:max-w-[75%] ${
                      message.role === "user"
                        ? "rounded-br-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                        : "rounded-bl-lg border border-white/10 bg-white/[0.05] text-slate-300"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isThinking ? (
                <div className="flex justify-start">
                  <div className="rounded-3xl rounded-bl-lg border border-violet-400/20 bg-violet-500/10 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={submitMessage}
              className="border-t border-white/10 bg-slate-950/90 p-4 sm:p-5"
            >
              <div className="flex items-end gap-3">
                <div className="relative flex-1">
                  <textarea
                    rows={2}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask Mira anything about your vehicle..."
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/40"
                  />

                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-xl transition ${
                      isListening
                        ? "bg-rose-500 text-white"
                        : "bg-violet-500/15 text-violet-300"
                    }`}
                    aria-label={
                      isListening ? "Stop listening" : "Start voice input"
                    }
                  >
                    {isListening ? (
                      <MicOff size={17} />
                    ) : (
                      <Mic size={17} />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-950/40 transition disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send size={20} />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Map size={13} />
                  Navigation
                </span>
                <span>•</span>
                <span>Documents</span>
                <span>•</span>
                <span>Challans</span>
                <span>•</span>
                <span>Service</span>
                <span>•</span>
                <span>Service History</span>
                <span>•</span>
                <span>Marketplace</span>
                <span>•</span>
                <span>Trip Planning</span>
                <span>•</span>
                <span>SOS</span>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}