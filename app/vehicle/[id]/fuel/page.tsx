"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
};

type FuelEntry = {
  id: number;
  user_id: string;
  vehicle_id: number;
  litres: number;
  amount: number;
  odometer: number | null;
  date: string;
  created_at: string | null;
};

type FuelForm = {
  litres: string;
  amount: string;
  odometer: string;
  date: string;
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

const initialForm: FuelForm = {
  litres: "",
  amount: "",
  odometer: "",
  date: getToday(),
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

export default function FuelPage() {
  const params = useParams();
  const router = useRouter();

  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [form, setForm] = useState<FuelForm>(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPage = useCallback(async () => {
    if (!vehicleId) {
      setErrorMessage("Vehicle ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setVehicle(null);
      setErrorMessage("Please sign in to view fuel records.");
      setLoading(false);
      return;
    }

    const { data: vehicleData, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, vehicle_name, vehicle_number")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .single();

    if (vehicleError || !vehicleData) {
      setVehicle(null);
      setErrorMessage("Vehicle not found or access denied.");
      setLoading(false);
      return;
    }

    const { data: fuelData, error: fuelError } = await supabase
      .from("fuel_entries")
      .select("*")
      .eq("vehicle_id", Number(vehicleId))
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fuelError) {
      setErrorMessage(fuelError.message);
      setEntries([]);
    } else {
      setEntries((fuelData || []) as FuelEntry[]);
    }

    setVehicle(vehicleData as Vehicle);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  function updateField(field: keyof FuelForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateForm() {
    const litres = Number(form.litres);
    const amount = Number(form.amount);
    const odometer = form.odometer ? Number(form.odometer) : null;

    if (!form.litres || Number.isNaN(litres) || litres <= 0) {
      return "Enter a valid fuel quantity.";
    }

    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      return "Enter a valid fuel amount.";
    }

    if (
      odometer !== null &&
      (Number.isNaN(odometer) || odometer < 0)
    ) {
      return "Enter a valid odometer reading.";
    }

    if (!form.date) {
      return "Select the fuel date.";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!vehicleId) {
      setErrorMessage("Vehicle ID is missing.");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage("");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in before saving fuel details.");
      }

      const payload = {
        user_id: user.id,
        vehicle_id: Number(vehicleId),
        litres: Number(form.litres),
        amount: Number(form.amount),
        odometer: form.odometer ? Number(form.odometer) : null,
        date: form.date,
      };

      const { error } = await supabase
        .from("fuel_entries")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      setForm({
        ...initialForm,
        date: getToday(),
      });
      setSuccessMessage("Fuel entry saved successfully.");
      await loadPage();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save fuel entry."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entryId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this fuel entry?"
    );

    if (!confirmed) return;

    setDeletingId(entryId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in.");
      }

      const { error } = await supabase
        .from("fuel_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setEntries((current) =>
        current.filter((entry) => entry.id !== entryId)
      );
      setSuccessMessage("Fuel entry deleted.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete fuel entry."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const totals = useMemo(() => {
    return entries.reduce(
      (result, entry) => {
        result.litres += Number(entry.litres) || 0;
        result.amount += Number(entry.amount) || 0;
        return result;
      },
      { litres: 0, amount: 0 }
    );
  }, [entries]);

  const averagePrice =
    totals.litres > 0 ? totals.amount / totals.litres : 0;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-6xl">⛽</div>
          <p className="mt-4 font-semibold text-slate-600">
            Loading fuel records...
          </p>
        </div>
      </main>
    );
  }

  if (!vehicle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
          <div className="text-6xl">🔒</div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Unable to open fuel tracker
          </h1>

          <p className="mt-3 text-slate-500">
            {errorMessage || "Vehicle not found or access denied."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              My Vehicle
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Fuel Tracker
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {vehicle.vehicle_name || "Unnamed Vehicle"} ·{" "}
              {vehicle.vehicle_number || "Number not provided"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/vehicle/${vehicle.id}`)}
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Vehicle Details
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 p-7 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Fuel & Expenses
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Track every fuel refill
          </h2>

          <p className="mt-2 max-w-2xl text-white/80">
            Save fuel quantity, amount, odometer reading and date.
          </p>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 font-medium text-green-700">
            {successMessage}
          </div>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            icon="⛽"
            label="Total Fuel"
            value={`${totals.litres.toFixed(2)} L`}
          />

          <SummaryCard
            icon="₹"
            label="Total Spent"
            value={`₹${totals.amount.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}`}
          />

          <SummaryCard
            icon="📊"
            label="Average Price"
            value={`₹${averagePrice.toFixed(2)} / L`}
          />
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold text-slate-900">
              Add Fuel Entry
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter the latest refill details.
            </p>

            <div className="mt-6 space-y-5">
              <FormField label="Fuel Quantity (Litres)" required>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.litres}
                  disabled={saving}
                  onChange={(event) =>
                    updateField("litres", event.target.value)
                  }
                  placeholder="Example: 20"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Total Amount (₹)" required>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  disabled={saving}
                  onChange={(event) =>
                    updateField("amount", event.target.value)
                  }
                  placeholder="Example: 2100"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Odometer Reading (km)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.odometer}
                  disabled={saving}
                  onChange={(event) =>
                    updateField("odometer", event.target.value)
                  }
                  placeholder="Example: 24500"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Fuel Date" required>
                <input
                  type="date"
                  value={form.date}
                  disabled={saving}
                  max={getToday()}
                  onChange={(event) =>
                    updateField("date", event.target.value)
                  }
                  className={inputClass}
                />
              </FormField>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Fuel Entry"}
            </button>
          </form>

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Fuel History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {entries.length} saved{" "}
                  {entries.length === 1 ? "entry" : "entries"}
                </p>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center">
                <div className="text-6xl">⛽</div>

                <h3 className="mt-4 text-xl font-bold text-slate-900">
                  No fuel entries yet
                </h3>

                <p className="mt-2 text-slate-500">
                  Add your first refill using the form.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {entries.map((entry) => {
                  const pricePerLitre =
                    Number(entry.litres) > 0
                      ? Number(entry.amount) / Number(entry.litres)
                      : 0;

                  return (
                    <article
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold text-slate-900">
                            {Number(entry.litres).toFixed(2)} L · ₹
                            {Number(entry.amount).toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {new Date(
                              `${entry.date}T00:00:00`
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          disabled={deletingId === entry.id}
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === entry.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Price per litre
                          </p>

                          <p className="mt-1 font-bold text-slate-900">
                            ₹{pricePerLitre.toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Odometer
                          </p>

                          <p className="mt-1 font-bold text-slate-900">
                            {entry.odometer !== null
                              ? `${Number(
                                  entry.odometer
                                ).toLocaleString("en-IN")} km`
                              : "Not provided"}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      {children}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-3xl font-bold">{icon}</div>

      <p className="mt-3 text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}