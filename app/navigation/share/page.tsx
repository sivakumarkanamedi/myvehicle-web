"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type Journey = {
  id: number;
  destination_name: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  current_location: {
    latitude?: number;
    longitude?: number;
  } | null;
  destination: {
    latitude?: number;
    longitude?: number;
  } | null;
  share_enabled: boolean;
  share_token: string;
  metadata: Record<string, unknown>;
};

type ShareSettings = {
  expiryMinutes: number;
  includeCurrentLocation: boolean;
  includeDestination: boolean;
  includeEta: boolean;
  includeStops: boolean;
};

const defaultSettings: ShareSettings = {
  expiryMinutes: 120,
  includeCurrentLocation: true,
  includeDestination: true,
  includeEta: true,
  includeStops: true,
};

export default function JourneySharePage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] =
    useState<number | null>(null);

  const [settings, setSettings] =
    useState<ShareSettings>(defaultSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadJourneys();
  }, []);

  async function loadJourneys() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { data, error: journeyError } = await supabase
        .from("navigation_journeys")
        .select(
          `
            id,
            destination_name,
            status,
            started_at,
            completed_at,
            current_location,
            destination,
            share_enabled,
            share_token,
            metadata
          `
        )
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);

      if (journeyError) throw journeyError;

      const rows = (data ?? []) as Journey[];

      setJourneys(rows);

      const firstShareable =
        rows.find((journey) =>
          ["active", "paused"].includes(journey.status)
        ) ?? rows[0] ?? null;

      if (firstShareable) {
        setSelectedJourneyId(firstShareable.id);

        const metadata =
          firstShareable.metadata ?? {};

        setSettings({
          expiryMinutes:
            getNumber(metadata.share_expiry_minutes) ?? 120,
          includeCurrentLocation:
            getBoolean(metadata.share_current_location) ?? true,
          includeDestination:
            getBoolean(metadata.share_destination) ?? true,
          includeEta:
            getBoolean(metadata.share_eta) ?? true,
          includeStops:
            getBoolean(metadata.share_stops) ?? true,
        });
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load journeys."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedJourney = useMemo(
    () =>
      journeys.find(
        (journey) => journey.id === selectedJourneyId
      ) ?? null,
    [journeys, selectedJourneyId]
  );

  const shareUrl = useMemo(() => {
    if (
      !selectedJourney ||
      !selectedJourney.share_enabled ||
      !selectedJourney.share_token ||
      typeof window === "undefined"
    ) {
      return "";
    }

    return `${window.location.origin}/navigation/share/${selectedJourney.share_token}`;
  }, [selectedJourney]);

  async function enableSharing() {
    if (!selectedJourney || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + settings.expiryMinutes * 60_000
      ).toISOString();

      const currentMetadata =
        selectedJourney.metadata ?? {};

      const { data, error: updateError } = await supabase
        .from("navigation_journeys")
        .update({
          share_enabled: true,
          metadata: {
            ...currentMetadata,
            share_expires_at: expiresAt,
            share_expiry_minutes: settings.expiryMinutes,
            share_current_location:
              settings.includeCurrentLocation,
            share_destination: settings.includeDestination,
            share_eta: settings.includeEta,
            share_stops: settings.includeStops,
          },
          updated_at: now.toISOString(),
        })
        .eq("id", selectedJourney.id)
        .eq("user_id", user.id)
        .select(
          `
            id,
            destination_name,
            status,
            started_at,
            completed_at,
            current_location,
            destination,
            share_enabled,
            share_token,
            metadata
          `
        )
        .single();

      if (updateError) throw updateError;

      setJourneys((current) =>
        current.map((journey) =>
          journey.id === selectedJourney.id
            ? (data as Journey)
            : journey
        )
      );

      setMessage("Secure journey sharing enabled.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to enable journey sharing."
      );
    } finally {
      setSaving(false);
    }
  }

  async function disableSharing() {
    if (!selectedJourney || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again.");

      const { data, error: updateError } = await supabase
        .from("navigation_journeys")
        .update({
          share_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedJourney.id)
        .eq("user_id", user.id)
        .select(
          `
            id,
            destination_name,
            status,
            started_at,
            completed_at,
            current_location,
            destination,
            share_enabled,
            share_token,
            metadata
          `
        )
        .single();

      if (updateError) throw updateError;

      setJourneys((current) =>
        current.map((journey) =>
          journey.id === selectedJourney.id
            ? (data as Journey)
            : journey
        )
      );

      setMessage("Journey sharing disabled.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to disable journey sharing."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Share link copied.");
    } catch {
      setError("Unable to copy the share link.");
    }
  }

  async function shareJourney() {
    if (!shareUrl || !selectedJourney) return;

    const text =
      `Track my journey to ${
        selectedJourney.destination_name || "my destination"
      } using My Vehicle.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My Vehicle Live Journey",
          text,
          url: shareUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(
        `${text}\n${shareUrl}`
      );

      setMessage("Journey link copied.");
    } catch {
      setError("Unable to share this journey.");
    }
  }

  function selectJourney(journey: Journey) {
    setSelectedJourneyId(journey.id);

    const metadata =
      journey.metadata ?? {};

    setSettings({
      expiryMinutes:
        getNumber(metadata.share_expiry_minutes) ?? 120,
      includeCurrentLocation:
        getBoolean(metadata.share_current_location) ?? true,
      includeDestination:
        getBoolean(metadata.share_destination) ?? true,
      includeEta:
        getBoolean(metadata.share_eta) ?? true,
      includeStops:
        getBoolean(metadata.share_stops) ?? true,
    });

    setError("");
    setMessage("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading Journey Sharing...
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
            Secure Journey Sharing
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Create a secure journey link for family or trusted contacts and
            control what information they can view.
          </p>
        </header>

        {error ? <Alert tone="error" text={error} /> : null}
        {message ? <Alert tone="success" text={message} /> : null}

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Select journey
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Active and recent journeys are shown below.
            </p>

            <div className="mt-5 space-y-3">
              {journeys.length ? (
                journeys.map((journey) => (
                  <button
                    key={journey.id}
                    type="button"
                    onClick={() => selectJourney(journey)}
                    className={
                      selectedJourneyId === journey.id
                        ? "w-full rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-4 text-left"
                        : "w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:border-cyan-400/30"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {journey.destination_name ||
                            `Journey ${journey.id}`}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateTime(journey.started_at)}
                        </p>
                      </div>

                      <StatusBadge value={journey.status} />
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  No journeys found.
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-6">
            {selectedJourney ? (
              <>
                <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Selected journey
                      </p>

                      <h2 className="mt-2 text-2xl font-bold">
                        {selectedJourney.destination_name ||
                          `Journey ${selectedJourney.id}`}
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        Started {formatDateTime(selectedJourney.started_at)}
                      </p>
                    </div>

                    <StatusBadge value={selectedJourney.status} />
                  </div>
                </article>

                <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
                  <div>
                    <h2 className="text-xl font-bold">
                      Sharing settings
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Choose what trusted viewers can see.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Link expiry
                    </span>

                    <select
                      value={settings.expiryMinutes}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          expiryMinutes: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
                    >
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={360}>6 hours</option>
                      <option value={720}>12 hours</option>
                      <option value={1440}>24 hours</option>
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleField
                      label="Current location"
                      checked={settings.includeCurrentLocation}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          includeCurrentLocation: value,
                        }))
                      }
                    />

                    <ToggleField
                      label="Destination"
                      checked={settings.includeDestination}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          includeDestination: value,
                        }))
                      }
                    />

                    <ToggleField
                      label="ETA"
                      checked={settings.includeEta}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          includeEta: value,
                        }))
                      }
                    />

                    <ToggleField
                      label="Stop updates"
                      checked={settings.includeStops}
                      onChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          includeStops: value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void enableSharing()}
                      disabled={saving}
                      className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : selectedJourney.share_enabled
                          ? "Update sharing"
                          : "Enable sharing"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void disableSharing()}
                      disabled={
                        saving ||
                        !selectedJourney.share_enabled
                      }
                      className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-6 py-3 text-sm font-semibold text-rose-100 disabled:opacity-40"
                    >
                      Disable sharing
                    </button>
                  </div>
                </article>

                {selectedJourney.share_enabled && shareUrl ? (
                  <article className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                      Secure link active
                    </p>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                      <p className="break-all text-sm text-slate-300">
                        {shareUrl}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void copyShareLink()}
                        className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-bold text-slate-950"
                      >
                        Copy link
                      </button>

                      <button
                        type="button"
                        onClick={() => void shareJourney()}
                        className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
                      >
                        Share
                      </button>

                      <Link
                        href={`/navigation/share/${selectedJourney.share_token}`}
                        target="_blank"
                        className="rounded-2xl border border-white/10 px-5 py-3 text-center text-sm font-semibold"
                      >
                        Preview
                      </Link>
                    </div>
                  </article>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-[540px] items-center justify-center rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center">
                <div>
                  <h2 className="text-2xl font-bold">
                    Select a journey
                  </h2>

                  <p className="mt-3 text-sm text-slate-500">
                    Choose a journey from the left panel.
                  </p>
                </div>
              </div>
            )}
          </section>
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

function StatusBadge(props: {
  value: string;
}) {
  const normalized = props.value.toLowerCase();

  const classes =
    normalized === "active"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : normalized === "paused"
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

function getNumber(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean"
    ? value
    : null;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}