"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<{
    0: { transcript: string };
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

export const MIRA_LANGUAGES = [
  { code: "en", label: "English", speechCode: "en-IN" },
  { code: "hi", label: "Hindi", speechCode: "hi-IN" },
  { code: "kn", label: "Kannada", speechCode: "kn-IN" },
  { code: "te", label: "Telugu", speechCode: "te-IN" },
  { code: "ta", label: "Tamil", speechCode: "ta-IN" },
  { code: "ml", label: "Malayalam", speechCode: "ml-IN" },
  { code: "mr", label: "Marathi", speechCode: "mr-IN" },
  { code: "bn", label: "Bengali", speechCode: "bn-IN" },
];

type Props = {
  disabled?: boolean;
  latestMiraReply?: string;
  onTranscript: (text: string) => void;
  onSubmitTranscript?: (text: string) => void;
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
};

const WAKE_PHRASES = ["hey mira", "hi mira", "okay mira", "ok mira"];

function removeWakePhrase(text: string): string {
  const normalized = text.trim();

  for (const phrase of WAKE_PHRASES) {
    const index = normalized.toLowerCase().indexOf(phrase);

    if (index !== -1) {
      return normalized
        .slice(index + phrase.length)
        .replace(/^[,.\s!?-]+/, "")
        .trim();
    }
  }

  return "";
}

function containsWakePhrase(text: string): boolean {
  const normalized = text.toLowerCase();
  return WAKE_PHRASES.some((phrase) => normalized.includes(phrase));
}

export default function MiraVoiceControls({
  disabled = false,
  latestMiraReply = "",
  onTranscript,
  onSubmitTranscript,
  selectedLanguage,
  onLanguageChange,
}: Props) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeWordEnabledRef = useRef(false);
  const waitingForCommandRef = useRef(false);
  const shouldRestartRef = useRef(false);

  const [isListening, setIsListening] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [waitingForCommand, setWaitingForCommand] = useState(false);
  const [wakeStatus, setWakeStatus] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(true);

  const currentLanguage = useMemo(
    () =>
      MIRA_LANGUAGES.find(
        (item) => item.code === selectedLanguage
      ) ?? MIRA_LANGUAGES[0],
    [selectedLanguage]
  );

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
    wakeWordEnabledRef.current = wakeWordEnabled;
  }, [wakeWordEnabled]);

  useEffect(() => {
    waitingForCommandRef.current = waitingForCommand;
  }, [waitingForCommand]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedAutoSend = localStorage.getItem("mira-voice-auto-send");
    const savedAutoSpeak = localStorage.getItem("mira-voice-auto-speak");
    const savedHandsFree = localStorage.getItem("mira-hands-free-mode");

    if (savedAutoSend !== null) {
      setAutoSend(savedAutoSend === "true");
    }

    if (savedAutoSpeak !== null) {
      setAutoSpeak(savedAutoSpeak === "true");
    }

    if (savedHandsFree !== null) {
      setHandsFreeMode(savedHandsFree === "true");
    }

    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded || typeof window === "undefined") return;

    localStorage.setItem("mira-voice-auto-send", String(autoSend));
  }, [autoSend, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || typeof window === "undefined") return;

    localStorage.setItem("mira-voice-auto-speak", String(autoSpeak));
  }, [autoSpeak, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || typeof window === "undefined") return;

    localStorage.setItem("mira-hands-free-mode", String(handsFreeMode));
  }, [handsFreeMode, settingsLoaded]);

  useEffect(() => {
    if (autoSpeak && latestMiraReply.trim()) {
      speakText(latestMiraReply);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestMiraReply]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;

      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
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

  function getRecognitionConstructor():
    | SpeechRecognitionConstructor
    | null {
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

  function restartWakeRecognition() {
    if (
      !wakeWordEnabledRef.current ||
      disabled ||
      !shouldRestartRef.current
    ) {
      return;
    }

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }

    restartTimerRef.current = setTimeout(() => {
      startWakeWordListening();
    }, 700);
  }

  function createRecognition(
    continuous: boolean
  ): SpeechRecognitionLike | null {
    const RecognitionConstructor =
      getRecognitionConstructor();

    if (!RecognitionConstructor) {
      setVoiceError(
        "Voice recognition is not supported. Use Chrome or Edge."
      );
      return null;
    }

    const recognition = new RecognitionConstructor();
    recognition.lang = currentLanguage.speechCode;
    recognition.continuous = continuous;
    recognition.interimResults = false;

    return recognition;
  }

  function handleCommandTranscript(transcript: string) {
    const cleaned = transcript.trim();

    if (!cleaned) return;

    onTranscript(cleaned);

    if (onSubmitTranscript) {
      onSubmitTranscript(cleaned);
    }

    setWaitingForCommand(false);
    waitingForCommandRef.current = false;
    setWakeStatus("Command sent to Mira.");
  }

  function startWakeWordListening() {
    setVoiceError("");

    if (!speechRecognitionSupported) {
      setVoiceError(
        "Wake word is not supported. Use Chrome or Edge."
      );
      setWakeWordEnabled(false);
      wakeWordEnabledRef.current = false;
      return;
    }

    recognitionRef.current?.abort();

    const recognition = createRecognition(true);
    if (!recognition) return;

    recognition.onresult = (event) => {
      const startIndex = event.resultIndex ?? 0;

      for (
        let index = startIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcript =
          result?.[0]?.transcript?.trim() ?? "";

        if (!transcript) continue;

        if (waitingForCommandRef.current) {
          handleCommandTranscript(transcript);
          continue;
        }

        if (containsWakePhrase(transcript)) {
          const command = removeWakePhrase(transcript);

          setWakeStatus("Mira is listening...");
          setWaitingForCommand(true);
          waitingForCommandRef.current = true;

          if (command) {
            handleCommandTranscript(command);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      const errorName = event.error || "unknown";

      if (
        errorName !== "no-speech" &&
        errorName !== "aborted"
      ) {
        setVoiceError(
          errorName === "not-allowed"
            ? "Microphone permission was denied."
            : `Wake word failed: ${errorName}`
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      restartWakeRecognition();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      setWakeStatus('Waiting for "Hey Mira"...');
    } catch {
      restartWakeRecognition();
    }
  }

  function enableWakeWord() {
    if (disabled) return;

    setVoiceError("");
    setWakeWordEnabled(true);
    wakeWordEnabledRef.current = true;
    shouldRestartRef.current = true;
    setWaitingForCommand(false);
    waitingForCommandRef.current = false;
    startWakeWordListening();
  }

  function disableWakeWord() {
    shouldRestartRef.current = false;
    setWakeWordEnabled(false);
    wakeWordEnabledRef.current = false;
    setWaitingForCommand(false);
    waitingForCommandRef.current = false;
    setWakeStatus("");
    recognitionRef.current?.abort();
    setIsListening(false);
  }

  function startListening() {
    setVoiceError("");

    if (!speechRecognitionSupported) {
      setVoiceError(
        "Voice recognition is not supported. Use Chrome or Edge."
      );
      return;
    }

    if (wakeWordEnabled) {
      disableWakeWord();
    }

    const recognition = createRecognition(false);
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript =
        event.results[0]?.[0]?.transcript?.trim() ?? "";

      if (!transcript) return;

      onTranscript(transcript);

      if (autoSend && onSubmitTranscript) {
        onSubmitTranscript(transcript);
      }
    };

    recognition.onerror = (event) => {
      const errorName = event.error || "unknown";

      setVoiceError(
        errorName === "not-allowed"
          ? "Microphone permission was denied."
          : errorName === "no-speech"
            ? "No speech was detected."
            : `Voice input failed: ${errorName}`
      );

      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError(
        "Voice input could not start. Please try again."
      );
    }
  }

  function stopListening() {
    if (wakeWordEnabled) {
      disableWakeWord();
      return;
    }

    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function speakText(text: string) {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !text.trim()
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLanguage.speechCode;
    utterance.rate = 1;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();

    const exactVoice = voices.find(
      (item) =>
        item.lang.toLowerCase() ===
        currentLanguage.speechCode.toLowerCase()
    );

    const languageVoice = voices.find((item) =>
      item.lang
        .toLowerCase()
        .startsWith(
          currentLanguage.speechCode
            .split("-")[0]
            .toLowerCase()
        )
    );

    utterance.voice = exactVoice || languageVoice || null;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);

      if (
        handsFreeMode &&
        wakeWordEnabledRef.current &&
        shouldRestartRef.current
      ) {
        setWaitingForCommand(true);
        waitingForCommandRef.current = true;
        setWakeStatus("Mira finished speaking. Say your next question...");

        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }

        restartTimerRef.current = setTimeout(() => {
          recognitionRef.current?.abort();
          startWakeWordListening();
        }, 450);
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setVoiceError(
        "Mira could not speak this reply."
      );
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }

  return (
    <section
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid #1e293b",
        background:
          "linear-gradient(135deg, rgba(8,51,68,0.55), rgba(30,41,59,0.55))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <select
          value={selectedLanguage}
          onChange={(event) =>
            onLanguageChange(event.target.value)
          }
          disabled={disabled || isListening}
          style={{
            minHeight: "44px",
            padding: "0 12px",
            borderRadius: "12px",
            border: "1px solid #334155",
            background: "#020617",
            color: "white",
            fontWeight: 700,
          }}
        >
          {MIRA_LANGUAGES.map((language) => (
            <option
              key={language.code}
              value={language.code}
            >
              {language.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={
            isListening && !wakeWordEnabled
              ? stopListening
              : startListening
          }
          disabled={disabled || wakeWordEnabled}
          style={{
            minHeight: "44px",
            padding: "0 16px",
            borderRadius: "12px",
            border:
              isListening && !wakeWordEnabled
                ? "1px solid #f87171"
                : "1px solid #22d3ee",
            background:
              isListening && !wakeWordEnabled
                ? "#7f1d1d"
                : "#083344",
            color:
              isListening && !wakeWordEnabled
                ? "#fecaca"
                : "#cffafe",
            fontWeight: 800,
            cursor:
              disabled || wakeWordEnabled
                ? "not-allowed"
                : "pointer",
            opacity:
              disabled || wakeWordEnabled ? 0.55 : 1,
          }}
        >
          {isListening && !wakeWordEnabled
            ? "⏹ Stop Listening"
            : "🎤 Speak to Mira"}
        </button>

        <button
          type="button"
          onClick={
            wakeWordEnabled
              ? disableWakeWord
              : enableWakeWord
          }
          disabled={disabled}
          style={{
            minHeight: "44px",
            padding: "0 16px",
            borderRadius: "12px",
            border: wakeWordEnabled
              ? "1px solid #4ade80"
              : "1px solid #a78bfa",
            background: wakeWordEnabled
              ? "#14532d"
              : "#2e1065",
            color: wakeWordEnabled
              ? "#bbf7d0"
              : "#ede9fe",
            fontWeight: 800,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
          }}
        >
          {wakeWordEnabled
            ? '🟢 "Hey Mira" ON'
            : '✨ Enable "Hey Mira"'}
        </button>

        <button
          type="button"
          onClick={() => speakText(latestMiraReply)}
          disabled={
            disabled ||
            !latestMiraReply.trim() ||
            isSpeaking
          }
          style={{
            minHeight: "44px",
            padding: "0 16px",
            borderRadius: "12px",
            border: "1px solid #6366f1",
            background: "#1e1b4b",
            color: "#e0e7ff",
            fontWeight: 800,
            cursor:
              disabled ||
              !latestMiraReply.trim() ||
              isSpeaking
                ? "not-allowed"
                : "pointer",
            opacity:
              disabled ||
              !latestMiraReply.trim() ||
              isSpeaking
                ? 0.55
                : 1,
          }}
        >
          🔊 Read Last Reply
        </button>

        {isSpeaking && (
          <button
            type="button"
            onClick={stopSpeaking}
            style={{
              minHeight: "44px",
              padding: "0 16px",
              borderRadius: "12px",
              border: "1px solid #f87171",
              background: "#450a0a",
              color: "#fecaca",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🔇 Stop Speaking
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          marginTop: "12px",
        }}
      >
        <label
          style={{
            color: "#cbd5e1",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={autoSend}
            onChange={(event) =>
              setAutoSend(event.target.checked)
            }
            disabled={wakeWordEnabled}
          />{" "}
          Auto-send voice input
        </label>

        <label
          style={{
            color: "#cbd5e1",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) =>
              setAutoSpeak(event.target.checked)
            }
          />{" "}
          Speak Mira replies
        </label>

        <label
          style={{
            color: "#cbd5e1",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={handsFreeMode}
            onChange={(event) =>
              setHandsFreeMode(event.target.checked)
            }
            disabled={!wakeWordEnabled}
          />{" "}
          Continue hands-free conversation
        </label>
      </div>

      {wakeWordEnabled && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: waitingForCommand
              ? "1px solid #22d3ee"
              : "1px solid #4ade80",
            background: waitingForCommand
              ? "#083344"
              : "#052e16",
            color: waitingForCommand
              ? "#cffafe"
              : "#bbf7d0",
            fontWeight: 800,
          }}
        >
          {waitingForCommand
            ? "🎤 Mira heard you. Say your vehicle question now..."
            : `● ${wakeStatus || 'Waiting for "Hey Mira"...'}`}
        </div>
      )}

      {isListening && !wakeWordEnabled && (
        <div
          style={{
            marginTop: "12px",
            color: "#a5f3fc",
            fontWeight: 800,
          }}
        >
          ● Listening in {currentLanguage.label}...
        </div>
      )}

      {voiceError && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid #7f1d1d",
            background: "#450a0a",
            color: "#fecaca",
          }}
        >
          {voiceError}
        </div>
      )}

      <p
        style={{
          marginTop: "12px",
          marginBottom: 0,
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        “Hey Mira” works while this browser page remains open
        and microphone permission is allowed. When hands-free mode is
        enabled, Mira listens again after finishing each spoken reply.
      </p>
    </section>
  );
}