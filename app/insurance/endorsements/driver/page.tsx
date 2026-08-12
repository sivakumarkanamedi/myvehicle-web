"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type DriverEndorsementForm = {
  policyId: string;
  endorsementAction: "add_driver" | "remove_driver" | "update_driver";
  driverName: string;
  driverPhone: string;
  drivingLicenceNumber: string;
  relationshipToInsured: string;
  effectiveDate: string;
  reason: string;
};

type ApiResponse = {
  success?: boolean;
  endorsement_id?: number;
  endorsement_reference?: string;
  message?: string;
  error?: string;
};

const initialForm: DriverEndorsementForm = {
  policyId: "",
  endorsementAction: "add_driver",
  driverName: "",
  driverPhone: "",
  drivingLicenceNumber: "",
  relationshipToInsured: "",
  effectiveDate: "",
  reason: "",
};

export default function DriverEndorsementPage() {
  const [form, setForm] =
    useState<DriverEndorsementForm>(initialForm);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState<ApiResponse | null>(null);

  const canSubmit = useMemo(() => {
    return (
      Number(form.policyId) > 0 &&
      Boolean(form.driverName.trim()) &&
      Boolean(
        form.drivingLicenceNumber.trim()
      ) &&
      Boolean(form.effectiveDate) &&
      Boolean(form.reason.trim())
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
              "driver_change",

            effective_date:
              form.effectiveDate,

            requested_changes: {
              action:
                form.endorsementAction,

              driver_name:
                form.driverName.trim(),

              driver_phone:
                form.driverPhone.trim() ||
                null,

              driving_licence_number:
                form.drivingLicenceNumber
                  .trim()
                  .toUpperCase(),

              relationship_to_insured:
                form.relationshipToInsured
                  .trim() ||
                null,

              reason:
                form.reason.trim(),
            },
          }),
        }
      );

      const result =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to submit driver endorsement."
        );
      }

      setSuccess(result);
      setForm(initialForm);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to submit driver endorsement."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<
    K extends keyof DriverEndorsementForm
  >(
    field: K,
    value: DriverEndorsementForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Policy Endorsements
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Driver Change Request
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Add, remove or update a driver linked to an active
            motor insurance policy.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"
        >
          <SectionTitle
            title="Policy details"
            subtitle="Select the policy and endorsement action."
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
              label="Action"
              value={
                form.endorsementAction
              }
              options={[
                [
                  "add_driver",
                  "Add Driver",
                ],
                [
                  "remove_driver",
                  "Remove Driver",
                ],
                [
                  "update_driver",
                  "Update Driver",
                ],
              ]}
              onChange={(value) =>
                updateField(
                  "endorsementAction",
                  value as DriverEndorsementForm["endorsementAction"]
                )
              }
            />
          </div>

          <SectionTitle
            title="Driver information"
            subtitle="Provide the driver and licence details."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Driver name"
              value={form.driverName}
              required
              onChange={(value) =>
                updateField(
                  "driverName",
                  value
                )
              }
            />

            <Field
              label="Driver phone"
              value={form.driverPhone}
              placeholder="+91..."
              onChange={(value) =>
                updateField(
                  "driverPhone",
                  value
                )
              }
            />

            <Field
              label="Driving licence number"
              value={
                form.drivingLicenceNumber
              }
              required
              onChange={(value) =>
                updateField(
                  "drivingLicenceNumber",
                  value
                )
              }
            />

            <Field
              label="Relationship to insured"
              value={
                form.relationshipToInsured
              }
              placeholder="Self, spouse, employee..."
              onChange={(value) =>
                updateField(
                  "relationshipToInsured",
                  value
                )
              }
            />

            <Field
              label="Effective date"
              type="date"
              value={form.effectiveDate}
              required
              onChange={(value) =>
                updateField(
                  "effectiveDate",
                  value
                )
              }
            />
          </div>

          <TextAreaField
            label="Reason for change"
            value={form.reason}
            required
            placeholder="Explain why the driver details need to be changed."
            onChange={(value) =>
              updateField(
                "reason",
                value
              )
            }
          />

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
              <p className="font-semibold">
                Endorsement submitted successfully.
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
              disabled={!canSubmit || loading}
              className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
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
            ? "1"
            : undefined
        }
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
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
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
      />
    </label>
  );
}