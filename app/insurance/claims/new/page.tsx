"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type ClaimForm = {
  policyId: string;
  vehicleId: string;
  incidentDate: string;
  incidentTime: string;
  incidentType: string;
  incidentLocation: string;
  description: string;
  policeComplaintNumber: string;
  estimatedLossAmount: string;
  driverName: string;
  driverPhone: string;
  injuriesReported: boolean;
  thirdPartyInvolved: boolean;
};

type ClaimResponse = {
  success?: boolean;
  claim_id?: number;
  claim_reference?: string;
  message?: string;
  error?: string;
};

const initialForm: ClaimForm = {
  policyId: "",
  vehicleId: "",
  incidentDate: "",
  incidentTime: "",
  incidentType: "accident",
  incidentLocation: "",
  description: "",
  policeComplaintNumber: "",
  estimatedLossAmount: "",
  driverName: "",
  driverPhone: "",
  injuriesReported: false,
  thirdPartyInvolved: false,
};

export default function NewClaimPage() {
  const [form, setForm] = useState<ClaimForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<ClaimResponse | null>(null);

  const canSubmit = useMemo(() => {
    return (
      Number(form.policyId) > 0 &&
      Number(form.vehicleId) > 0 &&
      Boolean(form.incidentDate) &&
      Boolean(form.incidentTime) &&
      Boolean(form.incidentLocation.trim()) &&
      Boolean(form.description.trim()) &&
      Boolean(form.driverName.trim()) &&
      Boolean(form.driverPhone.trim())
    );
  }, [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        throw new Error("Please sign in again before registering a claim.");
      }

      const response = await fetch("/api/insurance/claims/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          policy_id: Number(form.policyId),
          vehicle_id: Number(form.vehicleId),
          incident_date: form.incidentDate,
          incident_time: form.incidentTime,
          incident_type: form.incidentType,
          incident_location: form.incidentLocation.trim(),
          incident_description: form.description.trim(),
          police_complaint_number:
            form.policeComplaintNumber.trim() || null,
          estimated_loss_amount:
            form.estimatedLossAmount.trim()
              ? Number(form.estimatedLossAmount)
              : null,
          driver_name: form.driverName.trim(),
          driver_phone: form.driverPhone.trim(),
          injuries_reported: form.injuriesReported,
          third_party_involved: form.thirdPartyInvolved,
        }),
      });

      const result = (await response.json()) as ClaimResponse;

      if (!response.ok) {
        throw new Error(result.error || "Unable to register the claim.");
      }

      setSuccess(result);
      setForm(initialForm);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to register the claim."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof ClaimForm>(
    field: K,
    value: ClaimForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Register New Claim
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Capture incident, driver, vehicle and estimated-loss details to
            start the insurance claim process.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"
        >
          <SectionTitle
            title="Policy and vehicle"
            subtitle="Enter the policy and vehicle connected to this claim."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Policy ID"
              type="number"
              value={form.policyId}
              required
              onChange={(value) => updateField("policyId", value)}
            />

            <Field
              label="Vehicle ID"
              type="number"
              value={form.vehicleId}
              required
              onChange={(value) => updateField("vehicleId", value)}
            />
          </div>

          <SectionTitle
            title="Incident details"
            subtitle="Describe when, where and how the incident occurred."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Incident date"
              type="date"
              value={form.incidentDate}
              required
              onChange={(value) => updateField("incidentDate", value)}
            />

            <Field
              label="Incident time"
              type="time"
              value={form.incidentTime}
              required
              onChange={(value) => updateField("incidentTime", value)}
            />

            <SelectField
              label="Incident type"
              value={form.incidentType}
              options={[
                ["accident", "Accident"],
                ["theft", "Theft"],
                ["fire", "Fire"],
                ["flood", "Flood"],
                ["vandalism", "Vandalism"],
                ["glass_damage", "Glass Damage"],
                ["third_party", "Third-Party Damage"],
                ["other", "Other"],
              ]}
              onChange={(value) => updateField("incidentType", value)}
            />

            <Field
              label="Incident location"
              value={form.incidentLocation}
              required
              placeholder="City, road or landmark"
              onChange={(value) =>
                updateField("incidentLocation", value)
              }
            />
          </div>

          <TextAreaField
            label="Incident description"
            value={form.description}
            required
            placeholder="Explain what happened, visible damage and immediate action taken."
            onChange={(value) => updateField("description", value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Police complaint number"
              value={form.policeComplaintNumber}
              placeholder="Optional"
              onChange={(value) =>
                updateField("policeComplaintNumber", value)
              }
            />

            <Field
              label="Estimated loss amount"
              type="number"
              value={form.estimatedLossAmount}
              placeholder="Optional"
              onChange={(value) =>
                updateField("estimatedLossAmount", value)
              }
            />
          </div>

          <SectionTitle
            title="Driver details"
            subtitle="Provide the driver contact details at the time of incident."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Driver name"
              value={form.driverName}
              required
              onChange={(value) => updateField("driverName", value)}
            />

            <Field
              label="Driver phone"
              value={form.driverPhone}
              required
              placeholder="+91..."
              onChange={(value) => updateField("driverPhone", value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CheckboxField
              label="Injuries reported"
              checked={form.injuriesReported}
              onChange={(value) =>
                updateField("injuriesReported", value)
              }
            />

            <CheckboxField
              label="Third party involved"
              checked={form.thirdPartyInvolved}
              onChange={(value) =>
                updateField("thirdPartyInvolved", value)
              }
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
              <p className="font-semibold">Claim registered successfully.</p>

              <p className="mt-1">
                Claim reference:{" "}
                {success.claim_reference || "Generated successfully"}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="rounded-2xl bg-rose-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Registering claim..." : "Register claim"}
            </button>

            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setError("");
                setSuccess(null);
              }}
              className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
            >
              Clear
            </button>
          </div>
        </form>

        <div className="mt-8">
          <Link
            href="/insurance/claims"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Claims
          </Link>
        </div>
      </div>
    </main>
  );
}

function SectionTitle(props: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">{props.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
    </div>
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
        min={props.type === "number" ? "0" : undefined}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-rose-400/50"
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
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-rose-400/50"
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  value: string;
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

      <textarea
        value={props.value}
        required={props.required}
        placeholder={props.placeholder}
        rows={5}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-rose-400/50"
      />
    </label>
  );
}

function CheckboxField(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-300">{props.label}</span>

      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-5 w-5 rounded border-white/20 bg-slate-900"
      />
    </label>
  );
}