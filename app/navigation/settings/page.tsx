"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type VehicleType =
  | "Car"
  | "Bike"
  | "Truck"
  | "Bus"
  | "EV";

type NavigationLanguage =
  | "English"
  | "Kannada"
  | "Hindi"
  | "Telugu"
  | "Tamil";

type DistanceUnit =
  | "Kilometres"
  | "Miles";

type NavigationSettings = {
  vehicleType: VehicleType;
  language: NavigationLanguage;
  distanceUnit: DistanceUnit;
  voiceGuidance: boolean;
  spokenStreetNames: boolean;
  speedAlerts: boolean;
  trafficRerouting: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  weatherAlerts: boolean;
  hazardAlerts: boolean;
  signalAlerts: boolean;
  laneGuidance: boolean;
  offlineFallback: boolean;
  wifiOnlyDownloads: boolean;
  autoUpdateOfflineMaps: boolean;
  dataSaver: boolean;
  familyTracking: boolean;
  safeArrivalAlerts: boolean;
  silentSos: boolean;
  autoShareLocationDuringSos: boolean;
  emergencyContactAlerts: boolean;
  privacyMode: boolean;
  saveJourneyHistory: boolean;
  personalisedMiraSuggestions: boolean;
};

const defaultSettings: NavigationSettings = {
  vehicleType: "Car",
  language: "English",
  distanceUnit: "Kilometres",
  voiceGuidance: true,
  spokenStreetNames: true,
  speedAlerts: true,
  trafficRerouting: true,
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  weatherAlerts: true,
  hazardAlerts: true,
  signalAlerts: true,
  laneGuidance: true,
  offlineFallback: true,
  wifiOnlyDownloads: true,
  autoUpdateOfflineMaps: true,
  dataSaver: false,
  familyTracking: false,
  safeArrivalAlerts: true,
  silentSos: false,
  autoShareLocationDuringSos: true,
  emergencyContactAlerts: true,
  privacyMode: true,
  saveJourneyHistory: true,
  personalisedMiraSuggestions: true,
};

export default function NavigationSettingsPage() {
  const [settings, setSettings] =
    useState<NavigationSettings>(
      defaultSettings
    );

  const [statusMessage, setStatusMessage] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can help configure routes, voice guidance, safety alerts, offline maps, family tracking, privacy and emergency preferences."
    );

  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(
          "mira-navigation-settings"
        );

      if (stored) {
        const parsed =
          JSON.parse(
            stored
          ) as Partial<NavigationSettings>;

        setSettings({
          ...defaultSettings,
          ...parsed,
        });

        setStatusMessage(
          "Saved navigation settings loaded from this browser."
        );
      }
    } catch {
      setStatusMessage(
        "Saved settings could not be loaded. Default settings are active."
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  const enabledFeatureCount =
    useMemo(() => {
      return Object.values(
        settings
      ).filter(
        (value) =>
          typeof value ===
            "boolean" &&
          value
      ).length;
    }, [settings]);

  const routeProfile =
    useMemo(() => {
      const avoided: string[] = [];

      if (settings.avoidTolls) {
        avoided.push("tolls");
      }

      if (
        settings.avoidHighways
      ) {
        avoided.push("highways");
      }

      if (
        settings.avoidFerries
      ) {
        avoided.push("ferries");
      }

      return avoided.length
        ? `Avoid ${avoided.join(", ")}`
        : "Fastest suitable route";
    }, [
      settings.avoidTolls,
      settings.avoidHighways,
      settings.avoidFerries,
    ]);

  function updateSetting<
    K extends keyof NavigationSettings,
  >(
    key: K,
    value: NavigationSettings[K]
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setStatusMessage("");
  }

  function saveSettings() {
    localStorage.setItem(
      "mira-navigation-settings",
      JSON.stringify(settings)
    );

    setStatusMessage(
      "Navigation settings saved successfully in this browser."
    );
  }

  function resetSettings() {
    const confirmed =
      window.confirm(
        "Reset all Navigation settings to default?"
      );

    if (!confirmed) {
      return;
    }

    setSettings(
      defaultSettings
    );

    localStorage.removeItem(
      "mira-navigation-settings"
    );

    setStatusMessage(
      "Navigation settings reset to default."
    );
  }

  function previewVoice() {
    if (
      !("speechSynthesis" in window)
    ) {
      setStatusMessage(
        "Voice preview is not supported by this browser."
      );

      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        "Mira Navigation voice guidance is ready."
      );

    utterance.lang =
      getLanguageCode(
        settings.language
      );

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

    if (!question) {
      return;
    }

    if (
      question.includes("offline")
    ) {
      setMiraReply(
        settings.offlineFallback
          ? "Automatic offline fallback is enabled. Mira will use downloaded maps when internet access is lost."
          : "Automatic offline fallback is disabled. Enable it for safer navigation in weak-network areas."
      );
    } else if (
      question.includes("privacy")
    ) {
      setMiraReply(
        settings.privacyMode
          ? "Privacy mode is enabled. Journey and location features should use minimum required data."
          : "Privacy mode is disabled. Review journey history, family tracking and cloud features carefully."
      );
    } else if (
      question.includes("emergency") ||
      question.includes("sos")
    ) {
      setMiraReply(
        `Silent SOS is ${
          settings.silentSos
            ? "enabled"
            : "disabled"
        }, location sharing during SOS is ${
          settings.autoShareLocationDuringSos
            ? "enabled"
            : "disabled"
        }, and emergency-contact alerts are ${
          settings.emergencyContactAlerts
            ? "enabled"
            : "disabled"
        }.`
      );
    } else if (
      question.includes("voice") ||
      question.includes("language")
    ) {
      setMiraReply(
        `Voice guidance is ${
          settings.voiceGuidance
            ? "enabled"
            : "disabled"
        } in ${settings.language}.`
      );
    } else if (
      question.includes("route") ||
      question.includes("toll")
    ) {
      setMiraReply(
        `Your active route preference is: ${routeProfile}.`
      );
    } else {
      setMiraReply(
        `${enabledFeatureCount} optional Navigation features are enabled. The current vehicle profile is ${settings.vehicleType}.`
      );
    }

    setMiraQuestion("");
  }

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading Navigation Settings...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Navigation Settings
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Configure routes, voice guidance, safety alerts, offline
            maps, privacy, family tracking and emergency behaviour.
          </p>
        </header>

        {statusMessage ? (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {statusMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Vehicle Profile"
            value={
              settings.vehicleType
            }
          />

          <Metric
            label="Voice Language"
            value={
              settings.language
            }
          />

          <Metric
            label="Route Profile"
            value={routeProfile}
          />

          <Metric
            label="Enabled Features"
            value={String(
              enabledFeatureCount
            )}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SettingsCard
            title="Vehicle & Units"
            description="Set the default vehicle and distance format."
          >
            <SelectField
              label="Default vehicle"
              value={
                settings.vehicleType
              }
              options={[
                "Car",
                "Bike",
                "Truck",
                "Bus",
                "EV",
              ]}
              onChange={(value) =>
                updateSetting(
                  "vehicleType",
                  value as VehicleType
                )
              }
            />

            <SelectField
              label="Distance unit"
              value={
                settings.distanceUnit
              }
              options={[
                "Kilometres",
                "Miles",
              ]}
              onChange={(value) =>
                updateSetting(
                  "distanceUnit",
                  value as DistanceUnit
                )
              }
            />
          </SettingsCard>

          <SettingsCard
            title="Voice Navigation"
            description="Choose Mira's language and spoken guidance."
          >
            <ToggleField
              label="Voice guidance"
              checked={
                settings.voiceGuidance
              }
              onChange={(value) =>
                updateSetting(
                  "voiceGuidance",
                  value
                )
              }
            />

            <ToggleField
              label="Speak street names"
              checked={
                settings.spokenStreetNames
              }
              onChange={(value) =>
                updateSetting(
                  "spokenStreetNames",
                  value
                )
              }
            />

            <SelectField
              label="Voice language"
              value={
                settings.language
              }
              options={[
                "English",
                "Kannada",
                "Hindi",
                "Telugu",
                "Tamil",
              ]}
              onChange={(value) =>
                updateSetting(
                  "language",
                  value as NavigationLanguage
                )
              }
            />

            <button
              type="button"
              onClick={previewVoice}
              disabled={
                !settings.voiceGuidance
              }
              className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-40"
            >
              Preview Mira Voice
            </button>
          </SettingsCard>

          <SettingsCard
            title="Route Preferences"
            description="Control which roads Mira should prioritise or avoid."
          >
            <ToggleField
              label="Avoid tolls"
              checked={
                settings.avoidTolls
              }
              onChange={(value) =>
                updateSetting(
                  "avoidTolls",
                  value
                )
              }
            />

            <ToggleField
              label="Avoid highways"
              checked={
                settings.avoidHighways
              }
              onChange={(value) =>
                updateSetting(
                  "avoidHighways",
                  value
                )
              }
            />

            <ToggleField
              label="Avoid ferries"
              checked={
                settings.avoidFerries
              }
              onChange={(value) =>
                updateSetting(
                  "avoidFerries",
                  value
                )
              }
            />

            <ToggleField
              label="Automatic traffic rerouting"
              checked={
                settings.trafficRerouting
              }
              onChange={(value) =>
                updateSetting(
                  "trafficRerouting",
                  value
                )
              }
            />
          </SettingsCard>

          <SettingsCard
            title="Driving Safety"
            description="Enable proactive alerts during navigation."
          >
            <ToggleField
              label="Speed-limit alerts"
              checked={
                settings.speedAlerts
              }
              onChange={(value) =>
                updateSetting(
                  "speedAlerts",
                  value
                )
              }
            />

            <ToggleField
              label="Weather alerts"
              checked={
                settings.weatherAlerts
              }
              onChange={(value) =>
                updateSetting(
                  "weatherAlerts",
                  value
                )
              }
            />

            <ToggleField
              label="Hazard alerts"
              checked={
                settings.hazardAlerts
              }
              onChange={(value) =>
                updateSetting(
                  "hazardAlerts",
                  value
                )
              }
            />

            <ToggleField
              label="Traffic-signal alerts"
              checked={
                settings.signalAlerts
              }
              onChange={(value) =>
                updateSetting(
                  "signalAlerts",
                  value
                )
              }
            />

            <ToggleField
              label="Lane guidance"
              checked={
                settings.laneGuidance
              }
              onChange={(value) =>
                updateSetting(
                  "laneGuidance",
                  value
                )
              }
            />
          </SettingsCard>

          <SettingsCard
            title="Offline Maps & Data"
            description="Control offline navigation and mobile-data usage."
          >
            <ToggleField
              label="Automatic offline fallback"
              checked={
                settings.offlineFallback
              }
              onChange={(value) =>
                updateSetting(
                  "offlineFallback",
                  value
                )
              }
            />

            <ToggleField
              label="Download maps on Wi-Fi only"
              checked={
                settings.wifiOnlyDownloads
              }
              onChange={(value) =>
                updateSetting(
                  "wifiOnlyDownloads",
                  value
                )
              }
            />

            <ToggleField
              label="Automatically update offline maps"
              checked={
                settings.autoUpdateOfflineMaps
              }
              onChange={(value) =>
                updateSetting(
                  "autoUpdateOfflineMaps",
                  value
                )
              }
            />

            <ToggleField
              label="Data saver"
              checked={
                settings.dataSaver
              }
              onChange={(value) =>
                updateSetting(
                  "dataSaver",
                  value
                )
              }
            />

            <Link
              href="/navigation/offline"
              className="block rounded-2xl border border-blue-400/30 bg-blue-400/10 px-5 py-3 text-center text-sm font-semibold text-blue-100"
            >
              Manage Offline Maps
            </Link>
          </SettingsCard>

          <SettingsCard
            title="Family Tracking"
            description="Choose when trusted contacts receive journey updates."
          >
            <ToggleField
              label="Enable family tracking"
              checked={
                settings.familyTracking
              }
              onChange={(value) =>
                updateSetting(
                  "familyTracking",
                  value
                )
              }
            />

            <ToggleField
              label="Safe-arrival alerts"
              checked={
                settings.safeArrivalAlerts
              }
              onChange={(value) =>
                updateSetting(
                  "safeArrivalAlerts",
                  value
                )
              }
            />

            <Link
              href="/navigation/family-tracking"
              className="block rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-3 text-center text-sm font-semibold text-fuchsia-100"
            >
              Open Family Tracking
            </Link>
          </SettingsCard>

          <SettingsCard
            title="Emergency Settings"
            description="Configure SOS behaviour and trusted-contact actions."
          >
            <ToggleField
              label="Silent SOS"
              checked={
                settings.silentSos
              }
              onChange={(value) =>
                updateSetting(
                  "silentSos",
                  value
                )
              }
            />

            <ToggleField
              label="Share location during SOS"
              checked={
                settings.autoShareLocationDuringSos
              }
              onChange={(value) =>
                updateSetting(
                  "autoShareLocationDuringSos",
                  value
                )
              }
            />

            <ToggleField
              label="Alert emergency contacts"
              checked={
                settings.emergencyContactAlerts
              }
              onChange={(value) =>
                updateSetting(
                  "emergencyContactAlerts",
                  value
                )
              }
            />

            <Link
              href="/navigation/emergency"
              className="block rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-center text-sm font-semibold text-rose-100"
            >
              Open Emergency Settings
            </Link>
          </SettingsCard>

          <SettingsCard
            title="Privacy & Personalisation"
            description="Control saved journeys and personalised Mira suggestions."
          >
            <ToggleField
              label="Privacy mode"
              checked={
                settings.privacyMode
              }
              onChange={(value) =>
                updateSetting(
                  "privacyMode",
                  value
                )
              }
            />

            <ToggleField
              label="Save journey history"
              checked={
                settings.saveJourneyHistory
              }
              onChange={(value) =>
                updateSetting(
                  "saveJourneyHistory",
                  value
                )
              }
            />

            <ToggleField
              label="Personalised Mira suggestions"
              checked={
                settings.personalisedMiraSuggestions
              }
              onChange={(value) =>
                updateSetting(
                  "personalisedMiraSuggestions",
                  value
                )
              }
            />
          </SettingsCard>
        </section>

        <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            Ask Mira About Settings
          </p>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
            {miraReply}
          </p>

          <form
            onSubmit={askMira}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={
                miraQuestion
              }
              onChange={(event) =>
                setMiraQuestion(
                  event.target.value
                )
              }
              placeholder="Ask about routes, offline maps, privacy, voice or SOS..."
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

        <section className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={saveSettings}
            className="rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-bold text-slate-950"
          >
            Save Navigation Settings
          </button>

          <button
            type="button"
            onClick={resetSettings}
            className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-6 py-4 text-sm font-semibold text-rose-100"
          >
            Reset to Defaults
          </button>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> settings are currently
          stored in this browser. Supabase user-profile persistence can
          be connected after the navigation-preferences table and RLS
          policies are created.
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

function SettingsCard(props: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-bold">
          {props.title}
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {props.description}
        </p>
      </div>

      {props.children}
    </article>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: string[];
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
      >
        {props.options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
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
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">
        {props.label}
      </span>

      <input
        type="checkbox"
        checked={
          props.checked
        }
        onChange={(event) =>
          props.onChange(
            event.target.checked
          )
        }
        className="h-5 w-5 shrink-0"
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

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </article>
  );
}

function getLanguageCode(
  language: NavigationLanguage
) {
  const languageCodes: Record<
    NavigationLanguage,
    string
  > = {
    English: "en-IN",
    Kannada: "kn-IN",
    Hindi: "hi-IN",
    Telugu: "te-IN",
    Tamil: "ta-IN",
  };

  return languageCodes[
    language
  ];
}