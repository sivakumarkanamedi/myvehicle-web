"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type OfflineRegion = {
  id: number;
  name: string;
  area: string;
  sizeMb: number;
  roadsIncluded: number;
  placesIncluded: number;
  lastUpdated: string;
  status: "downloaded" | "available" | "updating";
  expiresInDays: number;
  offlineRoutes: number;
  emergencyPoints: number;
  fuelPoints: number;
};

const regions: OfflineRegion[] = [
  {
    id: 1,
    name: "Bengaluru Central",
    area: "Central Bengaluru and nearby roads",
    sizeMb: 420,
    roadsIncluded: 18240,
    placesIncluded: 7340,
    lastUpdated: "Today",
    status: "downloaded",
    expiresInDays: 29,
    offlineRoutes: 12,
    emergencyPoints: 48,
    fuelPoints: 126,
  },
  {
    id: 2,
    name: "Bengaluru Urban",
    area: "Complete Bengaluru urban region",
    sizeMb: 980,
    roadsIncluded: 42100,
    placesIncluded: 18400,
    lastUpdated: "2 days ago",
    status: "available",
    expiresInDays: 27,
    offlineRoutes: 28,
    emergencyPoints: 96,
    fuelPoints: 214,
  },
  {
    id: 3,
    name: "Mysuru",
    area: "Mysuru city and connecting highways",
    sizeMb: 360,
    roadsIncluded: 12850,
    placesIncluded: 5100,
    lastUpdated: "5 days ago",
    status: "available",
    expiresInDays: 24,
    offlineRoutes: 16,
    emergencyPoints: 39,
    fuelPoints: 88,
  },
  {
    id: 4,
    name: "Bengaluru to Chennai",
    area: "Major highways and key stops",
    sizeMb: 1240,
    roadsIncluded: 26800,
    placesIncluded: 8900,
    lastUpdated: "1 week ago",
    status: "available",
    expiresInDays: 21,
    offlineRoutes: 8,
    emergencyPoints: 54,
    fuelPoints: 74,
  },
];

export default function OfflineNavigationPage() {
  const [offlineRegions, setOfflineRegions] =
    useState<OfflineRegion[]>(regions);

  const [selectedRegionId, setSelectedRegionId] = useState(1);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [includePlaces, setIncludePlaces] = useState(true);
  const [includeVoiceGuidance, setIncludeVoiceGuidance] =
    useState(true);
  const [lowStorageMode, setLowStorageMode] = useState(false);
  const [message, setMessage] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [autoOfflineFallback, setAutoOfflineFallback] =
    useState(true);
  const [downloadProgress, setDownloadProgress] =
    useState<Record<number, number>>({});
  const [miraQuestion, setMiraQuestion] = useState("");
  const [miraReply, setMiraReply] = useState(
    "I can explain downloaded regions, storage, freshness, offline routes and what remains unavailable without internet."
  );

  const selectedRegion = useMemo(
    () =>
      offlineRegions.find((region) => region.id === selectedRegionId) ??
      offlineRegions[0],
    [offlineRegions, selectedRegionId]
  );

  const downloadedRegions = useMemo(
    () =>
      offlineRegions.filter(
        (region) => region.status === "downloaded"
      ),
    [offlineRegions]
  );

  useEffect(() => {
    function updateConnectionStatus() {
      setIsOnline(navigator.onLine);

      if (
        !navigator.onLine &&
        autoOfflineFallback
      ) {
        setMessage(
          "Internet connection lost. Mira switched to offline preview mode."
        );
      }
    }

    updateConnectionStatus();

    window.addEventListener(
      "online",
      updateConnectionStatus
    );

    window.addEventListener(
      "offline",
      updateConnectionStatus
    );

    return () => {
      window.removeEventListener(
        "online",
        updateConnectionStatus
      );

      window.removeEventListener(
        "offline",
        updateConnectionStatus
      );
    };
  }, [autoOfflineFallback]);

  const estimatedStorage = useMemo(() => {
    let size = selectedRegion.sizeMb;

    if (!includePlaces) {
      size *= 0.72;
    }

    if (!includeVoiceGuidance) {
      size *= 0.92;
    }

    if (lowStorageMode) {
      size *= 0.65;
    }

    return Math.round(size);
  }, [
    selectedRegion,
    includePlaces,
    includeVoiceGuidance,
    lowStorageMode,
  ]);

  function downloadRegion() {
    setOfflineRegions((current) =>
      current.map((region) =>
        region.id === selectedRegion.id
          ? {
              ...region,
              status: "updating",
            }
          : region
      )
    );

    setDownloadProgress((current) => ({
      ...current,
      [selectedRegion.id]: 25,
    }));

    setMessage(
      `${selectedRegion.name} download started. Estimated size: ${estimatedStorage} MB.`
    );

    window.setTimeout(() => {
      setDownloadProgress((current) => ({
        ...current,
        [selectedRegion.id]: 100,
      }));

      setOfflineRegions((current) =>
        current.map((region) =>
          region.id === selectedRegion.id
            ? {
                ...region,
                status: "downloaded",
                lastUpdated: "Just now",
                expiresInDays: 30,
              }
            : region
        )
      );

      setMessage(
        `${selectedRegion.name} is ready for offline preview.`
      );
    }, 900);
  }

  function updateRegion() {
    setOfflineRegions((current) =>
      current.map((region) =>
        region.id === selectedRegion.id
          ? {
              ...region,
              status: "updating",
            }
          : region
      )
    );

    setMessage(
      `${selectedRegion.name} offline data update started.`
    );

    window.setTimeout(() => {
      setOfflineRegions((current) =>
        current.map((region) =>
          region.id === selectedRegion.id
            ? {
                ...region,
                status: "downloaded",
                lastUpdated: "Just now",
                expiresInDays: 30,
              }
            : region
        )
      );

      setMessage(
        `${selectedRegion.name} offline data is up to date.`
      );
    }, 900);
  }

  function deleteRegion() {
    setOfflineRegions((current) =>
      current.map((region) =>
        region.id === selectedRegion.id
          ? {
              ...region,
              status: "available",
            }
          : region
      )
    );

    setDownloadProgress((current) => {
      const next = {
        ...current,
      };

      delete next[selectedRegion.id];

      return next;
    });

    setMessage(
      `${selectedRegion.name} offline data removed from this device.`
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
      question.includes("online") ||
      question.includes("internet")
    ) {
      setMiraReply(
        isOnline
          ? "The browser currently reports an internet connection."
          : "The browser currently reports that you are offline. Only downloaded preview data is available."
      );
    } else if (
      question.includes("storage") ||
      question.includes("space")
    ) {
      const storageMb =
        downloadedRegions.reduce(
          (total, region) =>
            total + region.sizeMb,
          0
        );

      setMiraReply(
        `Downloaded regions currently use approximately ${storageMb} MB in this preview.`
      );
    } else if (
      question.includes("route")
    ) {
      setMiraReply(
        selectedRegion.status === "downloaded"
          ? `${selectedRegion.name} includes ${selectedRegion.offlineRoutes} saved offline route previews.`
          : `${selectedRegion.name} must be downloaded before offline routes can be used.`
      );
    } else if (
      question.includes("hospital") ||
      question.includes("emergency")
    ) {
      setMiraReply(
        `${selectedRegion.name} includes ${selectedRegion.emergencyPoints} emergency points in preview data. Live availability is not available offline.`
      );
    } else if (
      question.includes("fuel")
    ) {
      setMiraReply(
        `${selectedRegion.name} includes ${selectedRegion.fuelPoints} stored fuel points in preview data. Live price and queue information require internet access.`
      );
    } else if (
      question.includes("fresh") ||
      question.includes("update") ||
      question.includes("expiry")
    ) {
      setMiraReply(
        `${selectedRegion.name} was updated ${selectedRegion.lastUpdated} and is shown as fresh for ${selectedRegion.expiresInDays} more days.`
      );
    } else {
      setMiraReply(
        `${selectedRegion.name} is ${formatLabel(
          selectedRegion.status
        ).toLowerCase()} and contains ${selectedRegion.roadsIncluded.toLocaleString()} roads and ${selectedRegion.placesIncluded.toLocaleString()} places.`
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Offline Navigation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Download selected regions for basic map access, saved routes,
            destination search, and turn guidance when mobile data is weak or
            unavailable.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {message}
          </div>
        ) : null}

        <section
          className={
            isOnline
              ? "rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-100"
              : "rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100"
          }
        >
          <strong>Connectivity:</strong>{" "}
          {isOnline
            ? "Online. Live services can be used when integrations are connected."
            : autoOfflineFallback
              ? "Offline. Mira has switched to downloaded-region preview mode."
              : "Offline. Automatic fallback is disabled."}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Downloaded regions"
            value={String(downloadedRegions.length)}
          />

          <Metric
            label="Offline storage"
            value="420 MB"
          />

          <Metric
            label="Last sync"
            value="Today"
          />

          <Metric
            label="Offline status"
            value={
              downloadedRegions.length > 0
                ? "Ready"
                : "Not ready"
            }
          />

          <Metric
            label="Connectivity"
            value={
              isOnline
                ? "Online"
                : "Offline"
            }
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Download settings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Control storage, updates, and included offline features.
              </p>
            </div>

            <ToggleField
              label="Download on Wi-Fi only"
              checked={wifiOnly}
              onChange={setWifiOnly}
            />

            <ToggleField
              label="Automatically update maps"
              checked={autoUpdate}
              onChange={setAutoUpdate}
            />

            <ToggleField
              label="Include places and landmarks"
              checked={includePlaces}
              onChange={setIncludePlaces}
            />

            <ToggleField
              label="Include voice guidance"
              checked={includeVoiceGuidance}
              onChange={setIncludeVoiceGuidance}
            />

            <ToggleField
              label="Low storage mode"
              checked={lowStorageMode}
              onChange={setLowStorageMode}
            />

            <ToggleField
              label="Automatic offline fallback"
              checked={autoOfflineFallback}
              onChange={setAutoOfflineFallback}
            />

            <div className="rounded-2xl border border-blue-400/30 bg-blue-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                Estimated download
              </p>

              <p className="mt-2 text-3xl font-bold">
                {estimatedStorage} MB
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-50/80">
                Includes road network
                {includePlaces ? ", places" : ""}
                {includeVoiceGuidance ? ", and voice guidance" : ""}.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadRegion}
              className="w-full rounded-2xl bg-blue-400 px-6 py-3 text-sm font-bold text-slate-950"
            >
              Download Selected Region
            </button>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Available regions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose a city, district, or travel corridor.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {offlineRegions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() =>
                    setSelectedRegionId(region.id)
                  }
                  className={
                    selectedRegionId === region.id
                      ? "w-full rounded-2xl border border-blue-400/40 bg-blue-400/10 p-5 text-left"
                      : "w-full rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-blue-400/30"
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold">
                        {region.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {region.area}
                      </p>
                    </div>

                    <StatusBadge status={region.status} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-5">
                    <SmallDetail
                      label="Size"
                      value={`${region.sizeMb} MB`}
                    />

                    <SmallDetail
                      label="Roads"
                      value={region.roadsIncluded.toLocaleString()}
                    />

                    <SmallDetail
                      label="Places"
                      value={region.placesIncluded.toLocaleString()}
                    />

                    <SmallDetail
                      label="Updated"
                      value={region.lastUpdated}
                    />

                    <SmallDetail
                      label="Fresh for"
                      value={`${region.expiresInDays} days`}
                    />
                  </div>

                  {downloadProgress[region.id] !== undefined ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Download progress</span>
                        <span>
                          {downloadProgress[region.id]}%
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all"
                          style={{
                            width: `${downloadProgress[region.id]}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Selected region
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {selectedRegion.name}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {selectedRegion.area}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="Base size"
                value={`${selectedRegion.sizeMb} MB`}
              />

              <Metric
                label="Roads"
                value={selectedRegion.roadsIncluded.toLocaleString()}
              />

              <Metric
                label="Places"
                value={selectedRegion.placesIncluded.toLocaleString()}
              />

              <Metric
                label="Status"
                value={formatLabel(selectedRegion.status)}
              />

              <Metric
                label="Offline routes"
                value={String(selectedRegion.offlineRoutes)}
              />

              <Metric
                label="Fresh for"
                value={`${selectedRegion.expiresInDays} days`}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={downloadRegion}
                className="rounded-2xl bg-blue-400 px-5 py-3 text-sm font-bold text-slate-950"
              >
                Download
              </button>

              <button
                type="button"
                onClick={updateRegion}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
              >
                Update
              </button>

              <button
                type="button"
                onClick={deleteRegion}
                className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100"
              >
                Delete
              </button>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Available offline
            </h2>

            <div className="mt-5 space-y-3">
              <FeatureRow
                label="Map browsing"
                available
              />

              <FeatureRow
                label="Saved places"
                available
              />

              <FeatureRow
                label="Downloaded routes"
                available={
                  selectedRegion.status === "downloaded"
                }
              />

              <FeatureRow
                label={`Fuel points (${selectedRegion.fuelPoints})`}
                available={
                  selectedRegion.status === "downloaded"
                }
              />

              <FeatureRow
                label={`Emergency points (${selectedRegion.emergencyPoints})`}
                available={
                  selectedRegion.status === "downloaded"
                }
              />

              <FeatureRow
                label="Voice guidance"
                available={includeVoiceGuidance}
              />

              <FeatureRow
                label="Live traffic"
                available={false}
              />

              <FeatureRow
                label="Live signal timers"
                available={false}
              />

              <FeatureRow
                label="Real-time rerouting"
                available={false}
              />
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="Connectivity Detection"
            description="Detects browser online or offline status and prepares automatic fallback."
          />

          <FeatureCard
            title="Offline Essentials"
            description="Keeps downloaded routes, fuel points and emergency locations available."
          />

          <FeatureCard
            title="Freshness Management"
            description="Tracks update age and expiry so stored map data does not become stale."
          />
        </section>

        <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            Ask Mira Offline Navigation
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
                setMiraQuestion(event.target.value)
              }
              placeholder="Ask about storage, routes, fuel, emergency points or updates..."
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
          <strong>Development status:</strong> this is an offline-navigation UI
          prototype. Production offline maps require a map provider licence,
          mobile-device storage, downloadable map tiles, offline routing data,
          update management, and strict compliance with provider terms.
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
  status: OfflineRegion["status"];
}) {
  const classes =
    props.status === "downloaded"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : props.status === "updating"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-blue-400/30 bg-blue-400/10 text-blue-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.status)}
    </span>
  );
}

function FeatureRow(props: {
  label: string;
  available: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">
        {props.label}
      </span>

      <span
        className={
          props.available
            ? "text-sm font-semibold text-emerald-300"
            : "text-sm font-semibold text-slate-600"
        }
      >
        {props.available ? "Available" : "Online only"}
      </span>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}