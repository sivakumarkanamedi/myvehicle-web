"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ParkingRecord = {
  id: number;
  user_id: string;
  vehicle_id: number | null;
  location_name: string | null;
  address: string | null;
  coordinates: Coordinates;
  parking_type: string | null;
  floor: string | null;
  zone: string | null;
  pillar: string | null;
  slot_number: string | null;
  entry_gate: string | null;
  landmark: string | null;
  notes: string | null;
  photo_url: string | null;
  parked_at: string;
  reminder_at: string | null;
  expected_expiry_at: string | null;
  hourly_rate: number | null;
  fixed_fee: number | null;
  status: string;
  created_at: string;
};

type ParkingForm = {
  vehicleId: string;
  locationName: string;
  address: string;
  parkingType: string;
  floor: string;
  zone: string;
  pillar: string;
  slotNumber: string;
  entryGate: string;
  landmark: string;
  notes: string;
  reminderMinutes: string;
  expectedDurationMinutes: string;
  hourlyRate: string;
  fixedFee: string;
};

const initialForm: ParkingForm = {
  vehicleId: "",
  locationName: "",
  address: "",
  parkingType: "outdoor",
  floor: "",
  zone: "",
  pillar: "",
  slotNumber: "",
  entryGate: "",
  landmark: "",
  notes: "",
  reminderMinutes: "60",
  expectedDurationMinutes: "",
  hourlyRate: "",
  fixedFee: "",
};

export default function SmartParkingPage() {
  const [form, setForm] =
    useState<ParkingForm>(initialForm);

  const [currentLocation, setCurrentLocation] =
    useState<Coordinates | null>(null);

  const [records, setRecords] =
    useState<ParkingRecord[]>([]);

  const [activeParking, setActiveParking] =
    useState<ParkingRecord | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [locating, setLocating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    void loadParkingRecords();
  }, []);

  async function loadParkingRecords() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        return;
      }

      const { data, error: recordsError } =
        await supabase
          .from("navigation_parking_records")
          .select("*")
          .eq("user_id", user.id)
          .order("parked_at", {
            ascending: false,
          })
          .limit(20);

      if (recordsError) {
        throw recordsError;
      }

      const typedRecords =
        (data ?? []) as ParkingRecord[];

      setRecords(typedRecords);

      setActiveParking(
        typedRecords.find(
          (record) =>
            record.status === "active"
        ) ?? null
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load parking records."
      );
    }
  }

  async function detectCurrentLocation() {
    setLocating(true);
    setError("");

    try {
      if (!navigator.geolocation) {
        throw new Error(
          "Geolocation is not supported by this browser."
        );
      }

      const position =
        await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000,
              }
            );
          }
        );

      setCurrentLocation({
        latitude:
          position.coords.latitude,
        longitude:
          position.coords.longitude,
      });

      setMessage(
        "Current parking location detected."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to detect current location."
      );
    } finally {
      setLocating(false);
    }
  }

  const canSave = useMemo(() => {
    return (
      currentLocation !== null &&
      Boolean(form.locationName.trim())
    );
  }, [currentLocation, form.locationName]);

  async function saveParking(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canSave || loading || !currentLocation) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Please sign in again before saving parking."
        );
      }

      if (activeParking) {
        await supabase
          .from("navigation_parking_records")
          .update({
            status: "completed",
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", activeParking.id)
          .eq("user_id", user.id);
      }

      const parkedAt =
        new Date().toISOString();

      const reminderMinutes =
        cleanPositiveNumber(
          form.reminderMinutes
        );

      const expectedDurationMinutes =
        cleanPositiveNumber(
          form.expectedDurationMinutes
        );

      const reminderAt =
        reminderMinutes
          ? addMinutes(
              parkedAt,
              reminderMinutes
            )
          : null;

      const expectedExpiryAt =
        expectedDurationMinutes
          ? addMinutes(
              parkedAt,
              expectedDurationMinutes
            )
          : null;

      const { data, error: insertError } =
        await supabase
          .from("navigation_parking_records")
          .insert({
            user_id: user.id,
            vehicle_id:
              cleanPositiveInteger(
                form.vehicleId
              ),
            location_name:
              form.locationName.trim(),
            address:
              form.address.trim() || null,
            coordinates:
              currentLocation,
            parking_type:
              form.parkingType,
            floor:
              form.floor.trim() || null,
            zone:
              form.zone.trim() || null,
            pillar:
              form.pillar.trim() || null,
            slot_number:
              form.slotNumber.trim() || null,
            entry_gate:
              form.entryGate.trim() || null,
            landmark:
              form.landmark.trim() || null,
            notes:
              form.notes.trim() || null,
            photo_url: null,
            parked_at:
              parkedAt,
            reminder_at:
              reminderAt,
            expected_expiry_at:
              expectedExpiryAt,
            hourly_rate:
              cleanMoney(form.hourlyRate),
            fixed_fee:
              cleanMoney(form.fixedFee),
            status:
              "active",
            created_at:
              parkedAt,
            updated_at:
              parkedAt,
          })
          .select("*")
          .single();

      if (insertError) {
        throw insertError;
      }

      const saved =
        data as ParkingRecord;

      setActiveParking(saved);

      setRecords((current) => [
        saved,
        ...current.filter(
          (record) =>
            record.id !== saved.id
        ),
      ]);

      setMessage(
        "Parking location saved successfully."
      );

      setForm(initialForm);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save parking location."
      );
    } finally {
      setLoading(false);
    }
  }

  async function completeParking() {
    if (!activeParking || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const completedAt =
        new Date().toISOString();

      const { error: updateError } =
        await supabase
          .from("navigation_parking_records")
          .update({
            status: "completed",
            completed_at:
              completedAt,
            updated_at:
              completedAt,
          })
          .eq("id", activeParking.id)
          .eq("user_id", activeParking.user_id);

      if (updateError) {
        throw updateError;
      }

      setRecords((current) =>
        current.map((record) =>
          record.id === activeParking.id
            ? {
                ...record,
                status: "completed",
              }
            : record
        )
      );

      setActiveParking(null);

      setMessage(
        "Parking session completed."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to complete parking session."
      );
    } finally {
      setLoading(false);
    }
  }

  function navigateBackToVehicle() {
    if (!activeParking) {
      return;
    }

    const destination =
      `${activeParking.coordinates.latitude},` +
      `${activeParking.coordinates.longitude}`;

    const url =
      `https://www.google.com/maps/dir/?api=1&destination=` +
      encodeURIComponent(destination) +
      `&travelmode=walking`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function shareParking() {
    if (!activeParking) {
      return;
    }

    const mapUrl =
      `https://www.google.com/maps/search/?api=1&query=` +
      encodeURIComponent(
        `${activeParking.coordinates.latitude},` +
        `${activeParking.coordinates.longitude}`
      );

    const details = [
      `Vehicle parked at ${activeParking.location_name || "saved location"}.`,
      activeParking.floor
        ? `Floor: ${activeParking.floor}`
        : "",
      activeParking.zone
        ? `Zone: ${activeParking.zone}`
        : "",
      activeParking.pillar
        ? `Pillar: ${activeParking.pillar}`
        : "",
      activeParking.slot_number
        ? `Slot: ${activeParking.slot_number}`
        : "",
      mapUrl,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My Vehicle Parking Location",
          text: details,
        });

        return;
      }

      await navigator.clipboard.writeText(
        details
      );

      setMessage(
        "Parking details copied to clipboard."
      );
    } catch {
      setError(
        "Unable to share parking details."
      );
    }
  }

  function updateField<
    K extends keyof ParkingForm
  >(
    field: K,
    value: ParkingForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const activeDurationMinutes = useMemo(() => {
    if (!activeParking) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(
        (Date.now() -
          new Date(
            activeParking.parked_at
          ).getTime()) /
          60000
      )
    );
  }, [activeParking]);

  const estimatedFee = useMemo(() => {
    if (!activeParking) {
      return 0;
    }

    if (
      activeParking.fixed_fee !== null &&
      activeParking.fixed_fee !== undefined
    ) {
      return Number(
        activeParking.fixed_fee
      );
    }

    if (
      activeParking.hourly_rate !== null &&
      activeParking.hourly_rate !== undefined
    ) {
      const hours =
        Math.max(
          1,
          Math.ceil(
            activeDurationMinutes / 60
          )
        );

      return (
        Number(
          activeParking.hourly_rate
        ) *
        hours
      );
    }

    return 0;
  }, [
    activeParking,
    activeDurationMinutes,
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Mira Navigation
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Smart Parking & Vehicle Finder
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Save your parking location, floor, zone, pillar, slot, reminders and fee details, then navigate back to your vehicle.
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

        {activeParking ? (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Active parking
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {activeParking.location_name}
                </h2>

                <p className="mt-2 text-sm text-slate-300">
                  {activeParking.address ||
                    "Saved GPS location"}
                </p>
              </div>

              <StatusBadge value="active" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Parked for"
                value={`${activeDurationMinutes} min`}
              />

              <MetricCard
                label="Estimated fee"
                value={formatCurrency(
                  estimatedFee
                )}
              />

              <MetricCard
                label="Floor"
                value={
                  activeParking.floor ||
                  "Not added"
                }
              />

              <MetricCard
                label="Zone"
                value={
                  activeParking.zone ||
                  "Not added"
                }
              />

              <MetricCard
                label="Slot"
                value={
                  activeParking.slot_number ||
                  "Not added"
                }
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={
                  navigateBackToVehicle
                }
                className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200"
              >
                Navigate to vehicle
              </button>

              <button
                type="button"
                onClick={() =>
                  void shareParking()
                }
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Share parking
              </button>

              <button
                type="button"
                onClick={() =>
                  void completeParking()
                }
                disabled={loading}
                className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-50"
              >
                Complete parking
              </button>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={saveParking}
            className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6"
          >
            <div>
              <h2 className="text-xl font-bold">
                Save parking location
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add GPS location and indoor parking details.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void detectCurrentLocation()
              }
              disabled={locating}
              className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-50"
            >
              {locating
                ? "Detecting location..."
                : currentLocation
                  ? "Location detected"
                  : "Use current location"}
            </button>

            {currentLocation ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
                <p>
                  Latitude:{" "}
                  {currentLocation.latitude.toFixed(
                    6
                  )}
                </p>
                <p className="mt-1">
                  Longitude:{" "}
                  {currentLocation.longitude.toFixed(
                    6
                  )}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Vehicle ID"
                value={form.vehicleId}
                type="number"
                onChange={(value) =>
                  updateField(
                    "vehicleId",
                    value
                  )
                }
              />

              <Field
                label="Location name"
                value={form.locationName}
                required
                placeholder="For example Phoenix Mall"
                onChange={(value) =>
                  updateField(
                    "locationName",
                    value
                  )
                }
              />

              <Field
                label="Address"
                value={form.address}
                placeholder="Optional"
                onChange={(value) =>
                  updateField(
                    "address",
                    value
                  )
                }
              />

              <SelectField
                label="Parking type"
                value={form.parkingType}
                options={[
                  ["outdoor", "Outdoor"],
                  ["indoor", "Indoor"],
                  ["basement", "Basement"],
                  ["street", "Street"],
                  ["valet", "Valet"],
                  ["airport", "Airport"],
                  ["mall", "Mall"],
                ]}
                onChange={(value) =>
                  updateField(
                    "parkingType",
                    value
                  )
                }
              />

              <Field
                label="Floor"
                value={form.floor}
                placeholder="Basement 2"
                onChange={(value) =>
                  updateField(
                    "floor",
                    value
                  )
                }
              />

              <Field
                label="Zone"
                value={form.zone}
                placeholder="Zone C"
                onChange={(value) =>
                  updateField(
                    "zone",
                    value
                  )
                }
              />

              <Field
                label="Pillar"
                value={form.pillar}
                placeholder="C18"
                onChange={(value) =>
                  updateField(
                    "pillar",
                    value
                  )
                }
              />

              <Field
                label="Slot number"
                value={form.slotNumber}
                placeholder="42"
                onChange={(value) =>
                  updateField(
                    "slotNumber",
                    value
                  )
                }
              />

              <Field
                label="Entry gate"
                value={form.entryGate}
                placeholder="Gate 3"
                onChange={(value) =>
                  updateField(
                    "entryGate",
                    value
                  )
                }
              />

              <Field
                label="Nearby landmark"
                value={form.landmark}
                placeholder="Near lift 4"
                onChange={(value) =>
                  updateField(
                    "landmark",
                    value
                  )
                }
              />

              <Field
                label="Reminder after minutes"
                type="number"
                value={form.reminderMinutes}
                onChange={(value) =>
                  updateField(
                    "reminderMinutes",
                    value
                  )
                }
              />

              <Field
                label="Expected duration minutes"
                type="number"
                value={
                  form.expectedDurationMinutes
                }
                onChange={(value) =>
                  updateField(
                    "expectedDurationMinutes",
                    value
                  )
                }
              />

              <Field
                label="Hourly rate"
                type="number"
                value={form.hourlyRate}
                onChange={(value) =>
                  updateField(
                    "hourlyRate",
                    value
                  )
                }
              />

              <Field
                label="Fixed fee"
                type="number"
                value={form.fixedFee}
                onChange={(value) =>
                  updateField(
                    "fixedFee",
                    value
                  )
                }
              />
            </div>

            <TextAreaField
              label="Notes"
              value={form.notes}
              placeholder="Add parking instructions, lift number or other useful details."
              onChange={(value) =>
                updateField(
                  "notes",
                  value
                )
              }
            />

            <button
              type="submit"
              disabled={!canSave || loading}
              className="w-full rounded-2xl bg-emerald-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : "Save parking"}
            </button>
          </form>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">
                Parking history
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Recently saved parking locations.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {records.length ? (
                records.map((record) => (
                  <ParkingHistoryCard
                    key={record.id}
                    record={record}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  No parking records found.
                </div>
              )}
            </div>
          </section>
        </section>

        <div className="pb-4">
          <Link
            href="/navigation"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Mira Navigation
          </Link>
        </div>
      </div>
    </main>
  );
}

function ParkingHistoryCard(props: {
  record: ParkingRecord;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {props.record.location_name ||
              "Saved parking"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(
              props.record.parked_at
            )}
          </p>
        </div>

        <StatusBadge
          value={props.record.status}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Detail
          label="Type"
          value={formatLabel(
            props.record.parking_type ||
              "parking"
          )}
        />

        <Detail
          label="Floor"
          value={
            props.record.floor ||
            "Not added"
          }
        />

        <Detail
          label="Zone"
          value={
            props.record.zone ||
            "Not added"
          }
        />

        <Detail
          label="Slot"
          value={
            props.record.slot_number ||
            "Not added"
          }
        />
      </div>
    </article>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
        {props.required ? " *" : ""}
      </span>

      <input
        type={props.type || "text"}
        value={props.value}
        required={props.required}
        placeholder={props.placeholder}
        min={
          props.type === "number"
            ? "0"
            : undefined
        }
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
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

function TextAreaField(props: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <textarea
        value={props.value}
        placeholder={props.placeholder}
        rows={5}
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
      />
    </label>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </article>
  );
}

function Detail(props: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-1 font-semibold text-slate-300">
        {props.value}
      </p>
    </div>
  );
}

function StatusBadge(props: {
  value: string;
}) {
  const active =
    props.value.toLowerCase() ===
    "active";

  return (
    <span
      className={
        active
          ? "inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
          : "inline-flex rounded-full border border-slate-400/20 bg-slate-400/10 px-2.5 py-1 text-xs font-semibold text-slate-300"
      }
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

function cleanPositiveInteger(
  value: unknown
) {
  const numeric =
    Number(value);

  return Number.isInteger(numeric) &&
    numeric > 0
    ? numeric
    : null;
}

function cleanPositiveNumber(
  value: unknown
) {
  const numeric =
    Number(value);

  return Number.isFinite(numeric) &&
    numeric > 0
    ? numeric
    : null;
}

function cleanMoney(
  value: unknown
) {
  const numeric =
    Number(value);

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function addMinutes(
  value: string,
  minutes: number
) {
  const date =
    new Date(value);

  date.setMinutes(
    date.getMinutes() +
    minutes
  );

  return date.toISOString();
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
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