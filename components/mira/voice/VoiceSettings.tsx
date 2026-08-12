"use client";

import { useEffect, useState } from "react";

interface VoiceSettingsProps {
  autoSpeak: boolean;
  setAutoSpeak: (value: boolean) => void;

  language: string;
  setLanguage: (value: string) => void;

  speechRate: number;
  setSpeechRate: (value: number) => void;

  selectedVoice: string;
  setSelectedVoice: (value: string) => void;
}

const languages = [
  { code: "en-IN", name: "🇬🇧 English" },
  { code: "kn-IN", name: "🇮🇳 Kannada" },
  { code: "te-IN", name: "🇮🇳 Telugu" },
  { code: "hi-IN", name: "🇮🇳 Hindi" },
  { code: "ta-IN", name: "🇮🇳 Tamil" },
  { code: "ml-IN", name: "🇮🇳 Malayalam" },
  { code: "mr-IN", name: "🇮🇳 Marathi" },
  { code: "bn-IN", name: "🇮🇳 Bengali" },
];

export default function VoiceSettings({
  autoSpeak,
  setAutoSpeak,
  language,
  setLanguage,
  speechRate,
  setSpeechRate,
  selectedVoice,
  setSelectedVoice,
}: VoiceSettingsProps) {
  const [open, setOpen] = useState(false);

  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    }

    loadVoices();

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
    };
  }, []);

  const filteredVoices = availableVoices.filter((voice) => {
    const selectedLanguageCode = language.split("-")[0];
    const voiceLanguageCode = voice.lang.split("-")[0];

    return selectedLanguageCode === voiceLanguageCode;
  });

  function previewVoice() {
    if (typeof window === "undefined") return;

    window.speechSynthesis.cancel();

    const previewText: Record<string, string> = {
      "en-IN":
        "Hello, I am Mira, your proactive AI vehicle companion.",
      "kn-IN":
        "ನಮಸ್ಕಾರ, ನಾನು ಮೀರಾ, ನಿಮ್ಮ ಎಐ ವಾಹನ ಸಹಾಯಕಿ.",
      "te-IN":
        "నమస్కారం, నేను మీరా, మీ ఏఐ వాహన సహాయకురాలిని.",
      "hi-IN":
        "नमस्ते, मैं मीरा हूं, आपकी एआई वाहन सहायक।",
      "ta-IN":
        "வணக்கம், நான் மீரா, உங்கள் ஏஐ வாகன உதவியாளர்.",
      "ml-IN":
        "നമസ്കാരം, ഞാൻ മീര, നിങ്ങളുടെ എഐ വാഹന സഹായി.",
      "mr-IN":
        "नमस्कार, मी मीरा आहे, तुमची एआय वाहन सहाय्यक.",
      "bn-IN":
        "নমস্কার, আমি মীরা, আপনার এআই যানবাহন সহায়ক।",
    };

    const utterance = new SpeechSynthesisUtterance(
      previewText[language] ||
        "Hello, I am Mira, your AI vehicle companion."
    );

    utterance.lang = language;
    utterance.rate = speechRate;

    const voice = availableVoices.find(
      (item) => item.name === selectedVoice
    );

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setIsPreviewing(true);
    };

    utterance.onend = () => {
      setIsPreviewing(false);
    };

    utterance.onerror = () => {
      setIsPreviewing(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopPreview() {
    window.speechSynthesis.cancel();
    setIsPreviewing(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-xl border border-cyan-500/30 bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
      >
        ⚙️ Voice Settings
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-80 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Mira Voice Settings
            </h2>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm text-gray-400">
              Voice Language
            </label>

            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                setSelectedVoice("");
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none"
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm text-gray-400">
              Mira Voice
            </label>

            <select
              value={selectedVoice}
              onChange={(event) =>
                setSelectedVoice(event.target.value)
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none"
            >
              <option value="">Default device voice</option>

              {filteredVoices.map((voice) => (
                <option
                  key={`${voice.name}-${voice.lang}`}
                  value={voice.name}
                >
                  {voice.name} — {voice.lang}
                </option>
              ))}
            </select>

            {filteredVoices.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">
                No matching voice is installed on this device.
                Mira will use the closest available voice.
              </p>
            )}
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm text-gray-400">
              Speaking Speed
            </label>

            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(event) =>
                setSpeechRate(Number(event.target.value))
              }
              className="w-full"
            />

            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>Slow</span>

              <span className="font-semibold text-cyan-300">
                {speechRate.toFixed(1)}x
              </span>

              <span>Fast</span>
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-800 p-3">
            <div className="pr-3">
              <p className="font-medium text-white">
                Auto Speak
              </p>

              <p className="text-xs text-gray-400">
                Mira automatically reads replies aloud.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoSpeak(!autoSpeak)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                autoSpeak
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {autoSpeak ? "ON" : "OFF"}
            </button>
          </div>

          <button
            type="button"
            onClick={
              isPreviewing ? stopPreview : previewVoice
            }
            className="mb-5 w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            {isPreviewing
              ? "⏹ Stop Preview"
              : "🔊 Preview Mira Voice"}
          </button>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
            <p className="text-sm text-cyan-200">
              🎤 Available voices depend on the languages
              installed on the user’s phone or computer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}