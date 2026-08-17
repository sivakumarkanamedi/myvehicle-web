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

type EmergencyType =
  | "accident"
  | "breakdown"
  | "medical"
  | "personal_safety";

type SosStage =
  | "idle"
  | "confirming"
  | "active"
  | "cancelled";

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

type EmergencyContact = {
  id: number;
  contact_name: string;
  relationship: string | null;
  mobile_number: string;
  is_primary: boolean;
  is_active: boolean;
};

type EmergencyService = {
  id: number;
  type:
    | "hospital"
    | "police"
    | "tow"
    | "roadside";
  name: string;
  distanceKm: number;
  etaMinutes: number;
  available: boolean;
};

const nearbyServices: EmergencyService[] = [
  {
    id: 1,
    type: "hospital",
    name: "Nearest Emergency Hospital",
    distanceKm: 3.2,
    etaMinutes: 8,
    available: true,
  },
  {
    id: 2,
    type: "police",
    name: "Nearest Police Station",
    distanceKm: 4.1,
    etaMinutes: 11,
    available: true,
  },
  {
    id: 3,
    type: "tow",
    name: "Verified Tow Partner",
    distanceKm: 5.6,
    etaMinutes: 18,
    available: true,
  },
  {
    id: 4,
    type: "roadside",
    name: "Roadside Assistance Partner",
    distanceKm: 2.8,
    etaMinutes: 14,
    available: true,
  },
];

export default function EmergencyNavigationPage() {
  const router = useRouter();

  const [emergencyType, setEmergencyType] =
    useState<EmergencyType>("accident");

  const [stage, setStage] =
    useState<SosStage>("idle");

  const [silentSos, setSilentSos] =
    useState(false);

  const [shareLocation, setShareLocation] =
    useState(true);

  const [notifyContacts, setNotifyContacts] =
    useState(true);

  const [requestDispatch, setRequestDispatch] =
    useState(false);

  const [countdown, setCountdown] =
    useState(5);

  const [location, setLocation] =
    useState<Coordinates | null>(null);

  const [locationError, setLocationError] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState(
      "Emergency mode is ready. No service has been contacted."
    );

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "Tell me whether this is an accident, breakdown, medical emergency or personal-safety situation."
    );

  const timerRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);

  const liveDispatchConnected = false;

  const [emergencyContacts, setEmergencyContacts] =
    useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] =
    useState(true);
  const [contactsError, setContactsError] =
    useState("");

  const emergencyContactsConfigured =
    emergencyContacts.length > 0;

  useEffect(() => {
    void loadEmergencyContacts();
  }, []);

  async function loadEmergencyContacts() {
    setContactsLoading(true);
    setContactsError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Please sign in again to load emergency contacts."
        );
      }

      const { data, error } = await supabase
        .from("emergency_contacts")
        .select(
          "id, contact_name, relationship, mobile_number, is_primary, is_active"
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;

      setEmergencyContacts(
        (data || []) as EmergencyContact[]
      );
    } catch (caughtError) {
      setContactsError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load emergency contacts."
      );
      setEmergencyContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  function maskPhoneNumber(value: string) {
    const digits = value.replace(/\D/g, "");

    if (digits.length <= 4) {
      return value;
    }

    return `${"*".repeat(
      Math.max(0, digits.length - 4)
    )}${digits.slice(-4)}`;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const requestedType = params.get("type");

    let locationLoaded = false;

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      setLocation({
        latitude: lat,
        longitude: lng,
        accuracyMeters: 0,
      });
      setLocationError("");
      setStatusMessage(
        "Emergency location received from live navigation. Refreshing GPS in the background."
      );
      locationLoaded = true;
    }

    if (
      requestedType === "accident" ||
      requestedType === "breakdown" ||
      requestedType === "medical" ||
      requestedType === "personal_safety"
    ) {
      setEmergencyType(requestedType);
    }

    if (!locationLoaded) {
      try {
        const saved = window.localStorage.getItem(
          "myvehicle:last-navigation-location"
        );

        if (saved) {
          const parsed = JSON.parse(saved) as {
            latitude?: number;
            longitude?: number;
          };

          if (
            Number.isFinite(parsed.latitude) &&
            Number.isFinite(parsed.longitude)
          ) {
            setLocation({
              latitude: Number(parsed.latitude),
              longitude: Number(parsed.longitude),
              accuracyMeters: 0,
            });
            setLocationError("");
            setStatusMessage(
              "Using the last known navigation location while refreshing GPS."
            );
            locationLoaded = true;
          }
        }
      } catch {
        // Ignore invalid cached location and continue to live GPS detection.
      }
    }

    void detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedServices = useMemo(() => {
    if (
      emergencyType === "accident" ||
      emergencyType === "medical"
    ) {
      return nearbyServices.filter(
        (service) =>
          service.type === "hospital" ||
          service.type === "police"
      );
    }

    if (emergencyType === "breakdown") {
      return nearbyServices.filter(
        (service) =>
          service.type === "tow" ||
          service.type === "roadside"
      );
    }

    return nearbyServices.filter(
      (service) =>
        service.type === "police"
    );
  }, [emergencyType]);

  const emergencyPlan = useMemo(() => {
    if (emergencyType === "accident") {
      return [
        "Move to a safe position only if it is safe to do so.",
        "Check whether anyone is injured.",
        "Share location with trusted contacts.",
        "Contact local emergency services when immediate help is required.",
        "Preserve photos and incident details when safe.",
      ];
    }

    if (emergencyType === "breakdown") {
      return [
        "Move the vehicle away from live traffic if possible.",
        "Switch on hazard lights.",
        "Stand behind a barrier or away from traffic.",
        "Request towing or roadside assistance.",
        "Share location and vehicle details with the assigned partner.",
      ];
    }

    if (emergencyType === "medical") {
      return [
        "Stop the vehicle safely.",
        "Contact local emergency medical services immediately.",
        "Share the precise location.",
        "Do not continue driving if the driver is unwell.",
        "Follow instructions from qualified emergency responders.",
      ];
    }

    return [
      "Move toward a safe, populated or well-lit place.",
      "Use Silent SOS when an audible alarm may increase risk.",
      "Share live location with trusted contacts.",
      "Contact local police or emergency services when needed.",
      "Do not confront a threatening person.",
    ];
  }, [emergencyType]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (
      stage !== "confirming"
    ) {
      return;
    }

    timerRef.current =
      setInterval(() => {
        setCountdown((current) => {
          if (current <= 1) {
            if (timerRef.current) {
              clearInterval(
                timerRef.current
              );
              timerRef.current = null;
            }

            activateSos();

            return 0;
          }

          return current - 1;
        });
      }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function detectLocation() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError(
        "Location is not supported by this browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
          accuracyMeters:
            position.coords.accuracy,
        });

        setStatusMessage(
          "Current location detected for the emergency preview."
        );
      },
      (error) => {
        setLocation((currentLocation) => {
          if (currentLocation) {
            setLocationError(
              error.code === error.PERMISSION_DENIED
                ? "Live GPS permission was denied. Using the last known navigation location."
                : "Live GPS refresh failed. Using the last known navigation location."
            );
            return currentLocation;
          }

          setLocationError(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : "Current location could not be detected."
          );
          return null;
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );
  }

  function beginSosConfirmation() {
    setCountdown(5);
    setStage("confirming");
    setStatusMessage(
      "SOS confirmation started. Cancel within five seconds if this was accidental."
    );
  }

  function cancelSos() {
    if (timerRef.current) {
      clearInterval(
        timerRef.current
      );
      timerRef.current = null;
    }

    setStage("cancelled");
    setCountdown(5);
    setStatusMessage(
      "SOS cancelled. No service or contact was notified."
    );
  }

  function activateSos() {
    setStage("active");

    const actions: string[] = [];

    if (shareLocation) {
      actions.push(
        location
          ? "location ready to share"
          : "location permission still required"
      );
    }

    if (notifyContacts) {
      actions.push(
        emergencyContactsConfigured
          ? `${emergencyContacts.length} trusted contact${
              emergencyContacts.length === 1 ? "" : "s"
            } ready`
          : "emergency contacts not configured"
      );
    }

    if (requestDispatch) {
      actions.push(
        liveDispatchConnected
          ? "dispatch requested"
          : "dispatch integration not connected"
      );
    }

    setStatusMessage(
      `SOS active in preview mode: ${actions.join(
        ", "
      )}. No real emergency service has been contacted.`
    );

    if (
      !silentSos &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          "Emergency mode activated."
        );

      utterance.lang = "en-IN";

      window.speechSynthesis.speak(
        utterance
      );
    }
  }

  function resetEmergency() {
    if (timerRef.current) {
      clearInterval(
        timerRef.current
      );
      timerRef.current = null;
    }

    setStage("idle");
    setCountdown(5);
    setStatusMessage(
      "Emergency mode reset. No service has been contacted."
    );
  }

  function shareLiveLocation() {
    if (!location) {
      setStatusMessage(
        "Detect your location before preparing a live-location share."
      );
      return;
    }

    const text =
      `Emergency location: https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setStatusMessage(
          "Emergency location link copied to the clipboard."
        );
      })
      .catch(() => {
        setStatusMessage(
          "Location is available, but the browser could not copy the link."
        );
      });
  }

  function openService(
    service: EmergencyService
  ) {
    const query =
      encodeURIComponent(
        service.name
      );

    window.open(
      `https://www.google.com/maps/search/${query}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function requestAssistance(
    service: EmergencyService
  ) {
    setStatusMessage(
      `${service.name} request prepared in preview mode. Live dispatch is not connected yet.`
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
      question.includes("accident")
    ) {
      setMiraReply(
        "Check for injuries, move away from traffic if safe, contact local emergency services when needed, and share your precise location."
      );
    } else if (
      question.includes("breakdown") ||
      question.includes("tow")
    ) {
      setMiraReply(
        "Switch on hazard lights, move away from live traffic, and request towing or roadside assistance. Do not stand beside the vehicle on a fast road."
      );
    } else if (
      question.includes("silent")
    ) {
      setMiraReply(
        "Silent SOS suppresses the audible alert while preparing location and trusted-contact actions."
      );
    } else if (
      question.includes("cancel") ||
      question.includes("false")
    ) {
      setMiraReply(
        "Use the five-second confirmation window to cancel an accidental SOS. After activation, use Reset Emergency only when it is safe."
      );
    } else if (
      question.includes("hospital") ||
      question.includes("police")
    ) {
      setMiraReply(
        "The nearby-services cards can open map searches. Live availability and dispatch require verified partner integrations."
      );
    } else {
      setMiraReply(
        `For ${formatLabel(
          emergencyType
        ).toLowerCase()}, follow the safety steps shown and contact qualified local emergency responders when immediate help is required.`
      );
    }

    setMiraQuestion("");
  }

  function openAskMira() {
    router.push("/mira");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/50 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Emergency Navigation
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Prepare SOS actions, location sharing, trusted-contact
            notifications, nearby emergency routes, towing and roadside
            assistance.
          </p>
        </header>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Important:</strong> this screen is a development preview.
          It does not automatically contact emergency services, police,
          hospitals, towing partners or family members.
        </section>

        <section
          className={
            stage === "active"
              ? "rounded-3xl border border-rose-500/50 bg-rose-500/20 p-6 sm:p-8"
              : "rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 sm:p-8"
          }
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">
                SOS status
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {formatLabel(stage)}
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-rose-50/90">
                {statusMessage}
              </p>
            </div>

            <div className="min-w-[280px]">
              {stage === "idle" ||
              stage === "cancelled" ? (
                <button
                  type="button"
                  onClick={beginSosConfirmation}
                  className="w-full rounded-2xl bg-rose-600 px-6 py-5 text-xl font-bold text-white"
                >
                  🚨 Activate SOS
                </button>
              ) : null}

              {stage === "confirming" ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-rose-300/30 bg-slate-950/50 p-5 text-center">
                    <p className="text-sm text-rose-100">
                      SOS activates in
                    </p>

                    <p className="mt-2 text-5xl font-bold">
                      {countdown}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={cancelSos}
                    className="w-full rounded-2xl bg-white px-6 py-4 text-lg font-bold text-rose-700"
                  >
                    Cancel False Alarm
                  </button>
                </div>
              ) : null}

              {stage === "active" ? (
                <button
                  type="button"
                  onClick={resetEmergency}
                  className="w-full rounded-2xl border border-white/20 bg-slate-950/50 px-6 py-4 text-lg font-bold text-white"
                >
                  Reset Emergency
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {locationError ? (
          <section className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {locationError}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Emergency Type"
            value={formatLabel(
              emergencyType
            )}
          />

          <Metric
            label="Location"
            value={
              location
                ? "Detected"
                : "Not detected"
            }
          />

          <Metric
            label="Trusted Contacts"
            value={
              emergencyContactsConfigured
                ? "Configured"
                : "Missing"
            }
          />

          <Metric
            label="Silent SOS"
            value={
              silentSos
                ? "Enabled"
                : "Disabled"
            }
          />

          <Metric
            label="Live Dispatch"
            value={
              liveDispatchConnected
                ? "Connected"
                : "Not connected"
            }
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                SOS recipients
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Emergency Contacts
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Only active contacts saved in your Profile are prepared for SOS alerts.
              </p>
            </div>

            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900"
            >
              Manage Contacts
            </Link>
          </div>

          {contactsLoading ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-slate-400">
              Loading emergency contacts…
            </div>
          ) : contactsError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
              {contactsError}
            </div>
          ) : emergencyContacts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
              No active emergency contact is configured. Add at least one contact in Profile before relying on SOS contact alerts.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {emergencyContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">
                        {contact.contact_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {contact.relationship || "Emergency contact"}
                      </p>
                    </div>

                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
                      {contact.is_primary ? "Primary" : "Ready"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <span className="text-sm text-slate-300">
                      {maskPhoneNumber(contact.mobile_number)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      Alert prepared
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-slate-500">
            “Alert prepared” does not mean SMS or WhatsApp has been delivered. Delivery will only be shown after a messaging provider confirms it.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Emergency controls
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select the situation and prepare the required actions.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Emergency type
              </span>

              <select
                value={emergencyType}
                onChange={(event) =>
                  setEmergencyType(
                    event.target
                      .value as EmergencyType
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm"
              >
                <option value="accident">
                  Accident or collision
                </option>
                <option value="breakdown">
                  Vehicle breakdown
                </option>
                <option value="medical">
                  Medical emergency
                </option>
                <option value="personal_safety">
                  Personal safety
                </option>
              </select>
            </label>

            <ToggleField
              label="Silent SOS"
              checked={silentSos}
              onChange={setSilentSos}
            />

            <ToggleField
              label="Prepare live-location share"
              checked={shareLocation}
              onChange={setShareLocation}
            />

            <ToggleField
              label="Prepare trusted-contact alert"
              checked={notifyContacts}
              onChange={setNotifyContacts}
            />

            <ToggleField
              label="Request partner dispatch"
              checked={requestDispatch}
              onChange={setRequestDispatch}
            />

            <button
              type="button"
              onClick={() =>
                void detectLocation()
              }
              className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100"
            >
              Detect Current Location
            </button>

            {location ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <SmallDetail
                  label="Latitude"
                  value={location.latitude.toFixed(
                    6
                  )}
                />

                <div className="mt-3">
                  <SmallDetail
                    label="Longitude"
                    value={location.longitude.toFixed(
                      6
                    )}
                  />
                </div>

                <div className="mt-3">
                  <SmallDetail
                    label="Accuracy"
                    value={`${Math.round(
                      location.accuracyMeters
                    )} m`}
                  />
                </div>

                <button
                  type="button"
                  onClick={shareLiveLocation}
                  className="mt-4 w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  Copy Location Link
                </button>
              </div>
            ) : null}
          </aside>

          <section className="space-y-6">
            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-2xl font-bold">
                Mira Emergency Flow
              </h2>

              <div className="mt-5 space-y-3">
                {emergencyPlan.map(
                  (step, index) => (
                    <div
                      key={step}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10 text-xs font-bold text-rose-200">
                        {index + 1}
                      </div>

                      <p className="text-sm leading-6 text-slate-300">
                        {step}
                      </p>
                    </div>
                  )
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
              <h2 className="text-2xl font-bold">
                Nearby Emergency Services
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Preview services selected for the current emergency type.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {selectedServices.map(
                  (service) => (
                    <div
                      key={service.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {formatLabel(
                              service.type
                            )}
                          </p>

                          <h3 className="mt-2 font-bold">
                            {service.name}
                          </h3>
                        </div>

                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                          Preview
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <SmallDetail
                          label="Distance"
                          value={`${service.distanceKm} km`}
                        />

                        <SmallDetail
                          label="ETA"
                          value={`${service.etaMinutes} min`}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            openService(
                              service
                            )
                          }
                          className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
                        >
                          Open Route
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            requestAssistance(
                              service
                            )
                          }
                          className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold"
                        >
                          Request
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Ask Mira
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
                  placeholder="Ask about accident, breakdown, silent SOS or false alarms..."
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

              <button
                type="button"
                onClick={openAskMira}
                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-fuchsia-100"
              >
                Open Full Ask Mira
              </button>
            </article>
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <FeatureCard
            title="False-Alarm Protection"
            description="Provides a five-second confirmation window before SOS activation."
          />

          <FeatureCard
            title="Accident vs Breakdown"
            description="Changes the response plan between emergency services and roadside assistance."
          />

          <FeatureCard
            title="Silent SOS"
            description="Suppresses audible alerts when personal safety requires discretion."
          />
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

function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
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

function formatLabel(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}