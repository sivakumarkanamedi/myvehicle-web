"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../supabase";
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  Phone,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";

type LocationState =
  | { status: "waiting"; latitude: null; longitude: null; error: "" }
  | { status: "loading"; latitude: null; longitude: null; error: "" }
  | {
      status: "ready";
      latitude: number;
      longitude: number;
      error: "";
    }
  | {
      status: "error";
      latitude: null;
      longitude: null;
      error: string;
    };

type EmergencyContact = {
  id: number | string;
  contact_name: string;
  relationship: string | null;
  mobile_number: string;
  is_primary: boolean;
  is_active: boolean;
};

export default function SOSPage() {
  const [sosActive, setSosActive] = useState(false);
  const [location, setLocation] = useState<LocationState>({
    status: "waiting",
    latitude: null,
    longitude: null,
    error: "",
  });

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState("");

  const [activeSosEventId, setActiveSosEventId] = useState<number | null>(null);
  const [sosSaving, setSosSaving] = useState(false);
  const [sosError, setSosError] = useState("");

  const loadEmergencyContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { data, error } = await supabase
        .from("emergency_contacts")
        .select(
          "id, contact_name, relationship, mobile_number, is_primary, is_active"
        )
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });

      if (error) throw error;

      setEmergencyContacts((data || []) as EmergencyContact[]);
    } catch (caughtError) {
      setEmergencyContacts([]);
      setContactsError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load emergency contacts."
      );
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({
        status: "error",
        latitude: null,
        longitude: null,
        error: "Location is not supported by this browser.",
      });
      return;
    }

    setLocation({
      status: "loading",
      latitude: null,
      longitude: null,
      error: "",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: "ready",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: "",
        });
      },
      (error) => {
        let message = "Unable to get your current location.";

        if (error.code === error.PERMISSION_DENIED) {
          message =
            "Location permission is blocked. Allow location access in your browser and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Your current location is temporarily unavailable.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out. Please try again.";
        }

        setLocation({
          status: "error",
          latitude: null,
          longitude: null,
          error: message,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
    void loadEmergencyContacts();
  }, [requestLocation, loadEmergencyContacts]);

  async function activateSOS() {
    if (sosSaving || sosActive) return;

    setSosSaving(true);
    setSosError("");

    try {
      if (location.status !== "ready") {
        requestLocation();
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const savedVehicleId = Number(
        window.localStorage.getItem("myvehicle.activeVehicleId")
      );

      const payload = {
        user_id: user.id,
        vehicle_id: Number.isFinite(savedVehicleId) && savedVehicleId > 0
          ? savedVehicleId
          : null,
        status: "active",
        latitude: location.status === "ready" ? location.latitude : null,
        longitude: location.status === "ready" ? location.longitude : null,
        emergency_contact_id: primaryEmergencyContact
          ? Number(primaryEmergencyContact.id)
          : null,
        emergency_contact_name:
          primaryEmergencyContact?.contact_name || null,
        emergency_contact_mobile:
          primaryEmergencyContact?.mobile_number || null,
      };

      const { data: createdEvent, error: createError } = await supabase
        .from("sos_events")
        .insert(payload)
        .select("id")
        .single();

      if (createError) throw createError;

      const eventId = Number(createdEvent.id);
      setActiveSosEventId(eventId);

      const { error: actionError } = await supabase
        .from("sos_event_actions")
        .insert({
          sos_event_id: eventId,
          user_id: user.id,
          action_type: "sos_activated",
          action_label: "SOS Activated",
          action_data: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            emergency_contact_name: payload.emergency_contact_name,
          },
        });

      if (actionError) throw actionError;

      setSosActive(true);
    } catch (caughtError) {
      setSosError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to activate SOS."
      );
    } finally {
      setSosSaving(false);
    }
  }

  async function cancelSOS() {
    if (sosSaving) return;

    setSosSaving(true);
    setSosError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      if (activeSosEventId) {
        const { error: updateError } = await supabase
          .from("sos_events")
          .update({
            status: "safe",
            resolved_at: new Date().toISOString(),
            resolution_note: "User marked themselves safe.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeSosEventId)
          .eq("user_id", user.id);

        if (updateError) throw updateError;

        const { error: actionError } = await supabase
          .from("sos_event_actions")
          .insert({
            sos_event_id: activeSosEventId,
            user_id: user.id,
            action_type: "marked_safe",
            action_label: "User Marked Safe",
            action_data: {},
          });

        if (actionError) throw actionError;
      }

      setSosActive(false);
      setActiveSosEventId(null);
    } catch (caughtError) {
      setSosError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to close SOS."
      );
    } finally {
      setSosSaving(false);
    }
  }

  const locationStatus =
    location.status === "ready"
      ? "Location ready"
      : location.status === "loading"
        ? "Getting location..."
        : location.status === "error"
          ? "Permission needed"
          : "Waiting";

  const mapsUrl =
    location.status === "ready"
      ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
      : null;

  const primaryEmergencyContact =
    emergencyContacts.find((contact) => contact.is_primary) ||
    emergencyContacts[0] ||
    null;

  const emergencyContactStatus = contactsLoading
    ? "Checking..."
    : primaryEmergencyContact
      ? primaryEmergencyContact.contact_name
      : "Not connected yet";

  const emergencyMessage =
    location.status === "ready" && primaryEmergencyContact
      ? [
          "🚨 MY VEHICLE — EMERGENCY SOS",
          "",
          "I need immediate assistance.",
          `Current location: https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
          `Time: ${new Date().toLocaleString("en-IN")}`,
          "",
          "Sent using My Vehicle — Mira AI",
        ].join("\n")
      : "";

  const whatsappNumber = primaryEmergencyContact
    ? primaryEmergencyContact.mobile_number.replace(/\D/g, "")
    : "";

  const whatsappUrl =
    primaryEmergencyContact && emergencyMessage
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
          emergencyMessage
        )}`
      : null;

  const smsUrl =
    primaryEmergencyContact && emergencyMessage
      ? `sms:${primaryEmergencyContact.mobile_number}?body=${encodeURIComponent(
          emergencyMessage
        )}`
      : null;

  const nearbyHospitalUrl =
    location.status === "ready"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `hospital near ${location.latitude},${location.longitude}`
        )}`
      : null;

  const roadsideAssistanceUrl =
    location.status === "ready"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `towing service near ${location.latitude},${location.longitude}`
        )}`
      : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#30101b_0%,#071426_35%,#020617_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HEADER */}
        <section className="rounded-3xl border border-rose-400/20 bg-gradient-to-br from-rose-950/50 via-slate-900 to-slate-950 p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/15 text-rose-300">
              <ShieldAlert size={28} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                Emergency Assistance
              </p>

              <h1 className="mt-1 text-3xl font-black">SOS</h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Get emergency assistance, share your location and quickly
                access nearby help.
              </p>
            </div>
          </div>
        </section>

        {/* MAIN SOS */}
        <section className="rounded-[32px] border border-rose-400/20 bg-slate-900/70 p-6 text-center sm:p-10">
          {!sosActive ? (
            <>
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-rose-400/30 bg-rose-500/10 text-rose-400">
                <AlertTriangle size={42} />
              </div>

              <h2 className="mt-6 text-2xl font-black">
                Need Emergency Help?
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Activate SOS only when you need immediate assistance. My Vehicle
                will prepare your location and emergency actions.
              </p>

              <button
                type="button"
                onClick={activateSOS}
                disabled={sosSaving}
                className="mt-7 w-full max-w-xl rounded-3xl bg-gradient-to-r from-rose-600 to-red-500 px-8 py-5 text-xl font-black shadow-[0_0_35px_rgba(244,63,94,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sosSaving ? "ACTIVATING SOS..." : "ACTIVATE SOS"}
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-rose-500 text-white shadow-[0_0_45px_rgba(244,63,94,0.45)]">
                <ShieldAlert size={43} />
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-rose-300">
                SOS Active
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Emergency Mode Activated
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Choose the assistance you need below.
              </p>

              <button
                type="button"
                onClick={cancelSOS}
                disabled={sosSaving}
                className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sosSaving ? "CLOSING SOS..." : "I'm Safe — Cancel SOS"}
              </button>
            </>
          )}
        </section>

        {sosError ? (
          <section className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {sosError}
          </section>
        ) : null}

        {/* STATUS */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard
            icon={
              location.status === "loading" ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <MapPin size={21} />
              )
            }
            title="Current Location"
            status={locationStatus}
          />

          <StatusCard
            icon={
              contactsLoading ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <Users size={21} />
              )
            }
            title="Emergency Contacts"
            status={emergencyContactStatus}
          />

          <StatusCard
            icon={<CheckCircle2 size={21} />}
            title="Vehicle"
            status="Selected vehicle"
          />
        </section>

        {/* EMERGENCY CONTACT DETAILS */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Emergency Contact
              </p>

              {contactsLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={17} className="animate-spin" />
                  Loading saved contact...
                </div>
              ) : primaryEmergencyContact ? (
                <>
                  <h2 className="mt-1 text-xl font-black">
                    {primaryEmergencyContact.contact_name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {primaryEmergencyContact.relationship
                      ? `${primaryEmergencyContact.relationship} • `
                      : ""}
                    {primaryEmergencyContact.mobile_number}
                  </p>
                  <p className="mt-2 text-xs font-bold text-emerald-300">
                    Primary SOS contact ready
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-xl font-black">
                    No emergency contact saved
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Add a primary emergency contact in your profile before using
                    family notification or live-location sharing.
                  </p>
                  {contactsError ? (
                    <p className="mt-2 text-xs text-rose-300">{contactsError}</p>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {primaryEmergencyContact ? (
                <a
                  href={`tel:${primaryEmergencyContact.mobile_number}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-200"
                >
                  <Phone size={17} />
                  Call Contact
                </a>
              ) : null}

              <Link
                href="/profile"
                className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-3 text-sm font-black text-blue-200"
              >
                {primaryEmergencyContact ? "Manage Contact" : "Add Contact"}
              </Link>
            </div>
          </div>
        </section>

        {/* LOCATION DETAILS */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Live Location
              </p>

              {location.status === "ready" ? (
                <>
                  <h2 className="mt-1 text-xl font-black">Location Ready</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {location.latitude.toFixed(6)},{" "}
                    {location.longitude.toFixed(6)}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-xl font-black">
                    {location.status === "loading"
                      ? "Getting your location..."
                      : "Location not available"}
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {location.status === "error"
                      ? location.error
                      : "Allow location permission so SOS can prepare your position."}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-3 text-sm font-black text-blue-200"
                >
                  Open in Maps
                </a>
              ) : null}

              {location.status !== "ready" ? (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black"
                >
                  Try Location Again
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* SOS SHARING */}
        <section className="rounded-3xl border border-rose-400/20 bg-rose-400/[0.05] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-300">
                Notify Family
              </p>

              <h2 className="mt-1 text-xl font-black">
                Share SOS with your emergency contact
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your current GPS location will be included. My Vehicle will open
                the selected messaging app so you can review and send the alert.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white"
                >
                  <MessageCircle size={17} />
                  WhatsApp SOS
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl bg-emerald-500/20 px-5 py-3 text-sm font-black text-emerald-200/50"
                >
                  <MessageCircle size={17} />
                  WhatsApp SOS
                </button>
              )}

              {smsUrl ? (
                <a
                  href={smsUrl}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-5 py-3 text-sm font-black text-blue-200"
                >
                  <Phone size={17} />
                  SMS SOS
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-black text-slate-500"
                >
                  <Phone size={17} />
                  SMS SOS
                </button>
              )}
            </div>
          </div>

          {!primaryEmergencyContact ? (
            <p className="mt-4 text-xs font-bold text-amber-300">
              Add a primary emergency contact before using SOS sharing.
            </p>
          ) : location.status !== "ready" ? (
            <p className="mt-4 text-xs font-bold text-amber-300">
              Current location must be ready before SOS sharing is enabled.
            </p>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Message Preview
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-slate-300">
                {emergencyMessage}
              </pre>
            </div>
          )}
        </section>

        {/* EMERGENCY ACTIONS */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Emergency Actions
          </p>

          <h2 className="mt-1 text-xl font-black">Get Help</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <EmergencyAction
              icon={<Ambulance size={23} />}
              title="Emergency Services"
              description="Official emergency calling will be connected after verification"
            />

            <EmergencyAction
              icon={<Users size={23} />}
              title="Notify Family"
              description={
                primaryEmergencyContact
                  ? `${primaryEmergencyContact.contact_name} is ready for SOS sharing`
                  : "Add an emergency contact in Profile first"
              }
            />

            {roadsideAssistanceUrl ? (
              <EmergencyLink
                href={roadsideAssistanceUrl}
                icon={<Wrench size={23} />}
                title="Roadside Assistance"
                description="Find nearby towing and roadside support"
              />
            ) : (
              <EmergencyAction
                icon={<Wrench size={23} />}
                title="Roadside Assistance"
                description="Location required to find nearby help"
              />
            )}

            {nearbyHospitalUrl ? (
              <EmergencyLink
                href={nearbyHospitalUrl}
                icon={<Navigation size={23} />}
                title="Nearest Hospital"
                description="Open nearby hospitals using your current location"
              />
            ) : (
              <EmergencyAction
                icon={<Navigation size={23} />}
                title="Nearest Hospital"
                description="Location required to find nearby hospitals"
              />
            )}
          </div>
        </section>

        {/* IMPORTANT SAFETY NOTE */}
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5">
          <div className="flex gap-3">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-amber-300"
            />

            <div>
              <h3 className="font-black">Emergency Safety</h3>

              <p className="mt-1 text-sm leading-6 text-slate-400">
                My Vehicle can help you access emergency actions and prepare
                location information, but it should not replace official
                emergency services. Automatic notifications and partner
                dispatch will only be shown as active after they are actually
                connected.
              </p>
            </div>
          </div>
        </section>

        {/* ASK MIRA */}
        <Link
          href="/mira"
          className="flex w-full items-center justify-between rounded-3xl border border-violet-400/30 bg-gradient-to-r from-blue-950 via-slate-950 to-violet-950 px-6 py-5"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Mira Emergency Assistance
            </p>

            <h3 className="mt-1 text-lg font-black">Ask Mira for Help</h3>
          </div>

          <div className="grid h-11 w-11 place-items-center rounded-full border border-violet-400/30 bg-violet-400/10 text-violet-300">
            <Mic size={20} />
          </div>
        </Link>
      </div>
    </main>
  );
}

function StatusCard({
  icon,
  title,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-400/10 text-blue-300">
          {icon}
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500">{title}</p>
          <p className="mt-1 font-black">{status}</p>
        </div>
      </div>
    </div>
  );
}

function EmergencyLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-rose-400/30 hover:bg-rose-400/5"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-400/10 text-rose-300">
        {icon}
      </div>

      <div>
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
    </a>
  );
}

function EmergencyAction({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:border-rose-400/30 hover:bg-rose-400/5"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-400/10 text-rose-300">
        {icon}
      </div>

      <div>
        <h3 className="font-black">{title}</h3>

        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
    </button>
  );
}