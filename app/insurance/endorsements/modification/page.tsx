"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type ModificationForm = {
  policyId: string;
  modificationType: string;
  modificationDate: string;
  partName: string;
  brandName: string;
  estimatedValue: string;
  invoiceNumber: string;
  description: string;
  affectsPerformance: boolean;
  requiresInspection: boolean;
};

type ApiResponse = {
  success?: boolean;
  endorsement_id?: number;
  endorsement_reference?: string;
  message?: string;
  error?: string;
};

const initialForm: ModificationForm = {
  policyId: "",
  modificationType: "accessory_addition",
  modificationDate: "",
  partName: "",
  brandName: "",
  estimatedValue: "",
  invoiceNumber: "",
  description: "",
  affectsPerformance: false,
  requiresInspection: false,
};

export default function VehicleModificationEndorsementPage() {
  const [form, setForm] =
    useState<ModificationForm>(initialForm);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState<ApiResponse | null>(null);

  const canSubmit = useMemo(() => {
    return (
      Number(form.policyId) > 0 &&
      Boolean(form.modificationDate) &&
      Boolean(form.partName.trim()) &&
      Boolean(form.description.trim())
    );
  }, [form]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
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
        throw new Error(
          "Please sign in again before submitting an endorsement."
        );
      }

      const response = await fetch(
        "/api/insurance/policy/endorsement/request",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            policy_id:
              Number(form.policyId),

            endorsement_type:
              "vehicle_modification",

            effective_date:
              form.modificationDate,

            requested_changes: {
              modification_type:
                form.modificationType,

              part_name:
                form.partName.trim(),

              brand_name:
                form.brandName.trim() ||
                null,

              estimated_value:
                form.estimatedValue.trim()
                  ? Number(
                      form.estimatedValue
                    )
                  : null,

              invoice_number:
                form.invoiceNumber.trim() ||
                null,

              description:
                form.description.trim(),

              affects_performance:
                form.affectsPerformance,

              requires_inspection:
                form.requiresInspection,
            },
          }),
        }
      );

      const result =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to submit vehicle modification endorsement."
        );
      }

      setSuccess(result);
      setForm(initialForm);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to submit vehicle modification endorsement."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<
    K extends keyof ModificationForm
  >(
    field: K,
    value: ModificationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">
            Policy Endorsements
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Vehicle Modification Request
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Declare accessories, structural changes, performance upgrades
            or other modifications made to the insured vehicle.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"
        >
          <SectionTitle
            title="Policy and modification"
            subtitle="Select the policy and describe the modification."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Policy ID"
              type="number"
              value={form.policyId}
              required
              onChange={(value) =>
                updateField(
                  "policyId",
                  value
                )
              }
            />

            <SelectField
              label="Modification type"
              value={
                form.modificationType
              }
              options={[
                [
                  "accessory_addition",
                  "Accessory Addition",
                ],
                [
                  "performance_upgrade",
                  "Performance Upgrade",
                ],
                [
                  "structural_change",
                  "Structural Change",
                ],
                [
                  "fuel_conversion",
                  "Fuel Conversion",
                ],
                [
                  "security_device",
                  "Security Device",
                ],
                [
                  "audio_system",
                  "Audio System",
                ],
                [
                  "other",
                  "Other",
                ],
              ]}
              onChange={(value) =>
                updateField(
                  "modificationType",
                  value
                )
              }
            />

            <Field
              label="Modification date"
              type="date"
              value={
                form.modificationDate
              }
              required
              onChange={(value) =>
                updateField(
                  "modificationDate",
                  value
                )
              }
            />

            <Field
              label="Part or accessory name"
              value={form.partName}
              required
              placeholder="For example alloy wheels"
              onChange={(value) =>
                updateField(
                  "partName",
                  value
                )
              }
            />

            <Field
              label="Brand name"
              value={form.brandName}
              placeholder="Optional"
              onChange={(value) =>
                updateField(
                  "brandName",
                  value
                )
              }
            />

            <Field
              label="Estimated value"
              type="number"
              value={
                form.estimatedValue
              }
              placeholder="Optional"
              onChange={(value) =>
                updateField(
                  "estimatedValue",
                  value
                )
              }
            />

            <Field
              label="Invoice number"
              value={
                form.invoiceNumber
              }
              placeholder="Optional"
              onChange={(value) =>
                updateField(
                  "invoiceNumber",
                  value
                )
              }
            />
          </div>

          <TextAreaField
            label="Modification description"
            value={form.description}
            required
            placeholder="Explain what was changed, how it was installed and whether it changes vehicle value or performance."
            onChange={(value) =>
              updateField(
                "description",
                value
              )
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <CheckboxField
              label="Modification affects performance"
              checked={
                form.affectsPerformance
              }
              onChange={(value) =>
                updateField(
                  "affectsPerformance",
                  value
                )
              }
            />

            <CheckboxField
              label="Inspection may be required"
              checked={
                form.requiresInspection
              }
              onChange={(value) =>
                updateField(
                  "requiresInspection",
                  value
                )
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
              <p className="font-semibold">
                Modification endorsement submitted successfully.
              </p>

              <p className="mt-1">
                Reference:{" "}
                {success.endorsement_reference ||
                  "Generated successfully"}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={
                !canSubmit ||
                loading
              }
              className="rounded-2xl bg-violet-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Submitting..."
                : "Submit endorsement"}
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
            href="/insurance/endorsements"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Endorsements
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
      <h2 className="text-xl font-bold">
        {props.title}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {props.subtitle}
      </p>
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-400/50"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<
    [string, string]
  >;
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-violet-400/50"
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
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-400/50"
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
        className="h-5 w-5 rounded border-white/20 bg-slate-900"
      />
    </label>
  );
}