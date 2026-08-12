"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type CancellationForm = {
  policyId: string;
  cancellationReason: string;
  cancellationType: "customer_request" | "vehicle_sold" | "duplicate_policy" | "non_payment" | "other";
  effectiveDate: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  remarks: string;
};

type ApiResult = {
  success?: boolean;
  cancellation_id?: number;
  cancellation_reference?: string;
  refund_id?: number;
  refund_reference?: string;
  refund_amount?: number;
  message?: string;
  error?: string;
};

const initialForm: CancellationForm = {
  policyId: "",
  cancellationReason: "",
  cancellationType: "customer_request",
  effectiveDate: "",
  bankAccountName: "",
  bankAccountNumber: "",
  ifscCode: "",
  remarks: "",
};

export default function PolicyCancellationCenterPage() {
  const [form, setForm] = useState<CancellationForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);

  const canSubmit = useMemo(() => {
    return (
      Number(form.policyId) > 0 &&
      Boolean(form.cancellationReason.trim()) &&
      Boolean(form.effectiveDate)
    );
  }, [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        throw new Error("Please sign in again before cancelling a policy.");
      }

      const cancellationResponse = await fetch(
        "/api/insurance/policy/cancel",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            policy_id: Number(form.policyId),
            cancellation_type: form.cancellationType,
            cancellation_reason: form.cancellationReason.trim(),
            effective_date: form.effectiveDate,
            remarks: form.remarks.trim() || null,
            bank_details:
              form.bankAccountName.trim() &&
              form.bankAccountNumber.trim() &&
              form.ifscCode.trim()
                ? {
                    account_name: form.bankAccountName.trim(),
                    account_number: form.bankAccountNumber.trim(),
                    ifsc_code: form.ifscCode.trim().toUpperCase(),
                  }
                : null,
          }),
        }
      );

      const cancellationResult =
        (await cancellationResponse.json()) as ApiResult;

      if (!cancellationResponse.ok) {
        throw new Error(
          cancellationResult.error ||
            "Unable to submit policy cancellation."
        );
      }

      let finalResult = cancellationResult;

      if (
        cancellationResult.success &&
        cancellationResult.cancellation_id
      ) {
        const refundResponse = await fetch(
          "/api/insurance/refund/process",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              policy_id: Number(form.policyId),
              cancellation_id: cancellationResult.cancellation_id,
              refund_reason: "policy_cancellation",
              bank_details:
                form.bankAccountName.trim() &&
                form.bankAccountNumber.trim() &&
                form.ifscCode.trim()
                  ? {
                      account_name: form.bankAccountName.trim(),
                      account_number: form.bankAccountNumber.trim(),
                      ifsc_code: form.ifscCode.trim().toUpperCase(),
                    }
                  : null,
            }),
          }
        );

        const refundResult =
          (await refundResponse.json()) as ApiResult;

        if (refundResponse.ok) {
          finalResult = {
            ...cancellationResult,
            ...refundResult,
          };
        }
      }

      setResult(finalResult);
      setForm(initialForm);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to process cancellation."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof CancellationForm>(
    field: K,
    value: CancellationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Policy Cancellation & Refund Center
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Submit a policy cancellation request, calculate eligible refund,
            capture bank details and track the complete cancellation workflow.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Pending Requests"
            value="0"
            helper="Awaiting review"
          />

          <MetricCard
            label="Approved Cancellations"
            value="0"
            helper="Approved requests"
          />

          <MetricCard
            label="Refunds Processing"
            value="0"
            helper="Payment in progress"
          />

          <MetricCard
            label="Refunds Completed"
            value="0"
            helper="Successfully paid"
          />
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"
        >
          <SectionTitle
            title="Cancellation details"
            subtitle="Select the policy and provide the reason and effective date."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Policy ID"
              type="number"
              value={form.policyId}
              required
              onChange={(value) =>
                updateField("policyId", value)
              }
            />

            <SelectField
              label="Cancellation type"
              value={form.cancellationType}
              options={[
                ["customer_request", "Customer Request"],
                ["vehicle_sold", "Vehicle Sold"],
                ["duplicate_policy", "Duplicate Policy"],
                ["non_payment", "Non-Payment"],
                ["other", "Other"],
              ]}
              onChange={(value) =>
                updateField(
                  "cancellationType",
                  value as CancellationForm["cancellationType"]
                )
              }
            />

            <Field
              label="Effective date"
              type="date"
              value={form.effectiveDate}
              required
              onChange={(value) =>
                updateField("effectiveDate", value)
              }
            />
          </div>

          <TextAreaField
            label="Cancellation reason"
            value={form.cancellationReason}
            required
            placeholder="Explain why the policy should be cancelled."
            onChange={(value) =>
              updateField("cancellationReason", value)
            }
          />

          <SectionTitle
            title="Refund bank details"
            subtitle="Optional. Required when the refund must be paid to a bank account."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Account holder name"
              value={form.bankAccountName}
              onChange={(value) =>
                updateField("bankAccountName", value)
              }
            />

            <Field
              label="Account number"
              value={form.bankAccountNumber}
              onChange={(value) =>
                updateField("bankAccountNumber", value)
              }
            />

            <Field
              label="IFSC code"
              value={form.ifscCode}
              onChange={(value) =>
                updateField("ifscCode", value)
              }
            />
          </div>

          <TextAreaField
            label="Additional remarks"
            value={form.remarks}
            placeholder="Optional notes for the cancellation team."
            onChange={(value) =>
              updateField("remarks", value)
            }
          />

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
              <p className="font-semibold">
                Cancellation request submitted successfully.
              </p>

              <div className="mt-2 space-y-1">
                <p>
                  Cancellation reference:{" "}
                  {result.cancellation_reference ||
                    "Generated successfully"}
                </p>

                {result.refund_reference ? (
                  <p>
                    Refund reference: {result.refund_reference}
                  </p>
                ) : null}

                {typeof result.refund_amount === "number" ? (
                  <p>
                    Refund amount:{" "}
                    {formatCurrency(result.refund_amount)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="rounded-2xl bg-rose-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : "Submit cancellation"}
            </button>

            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setError("");
                setResult(null);
              }}
              className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
            >
              Clear
            </button>
          </div>
        </form>

        <div className="mt-8">
          <Link
            href="/insurance/dashboard"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Insurance Dashboard
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
      <p className="mt-1 text-sm text-slate-500">
        {props.subtitle}
      </p>
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{props.label}</p>
      <p className="mt-2 text-3xl font-bold">{props.value}</p>
      <p className="mt-2 text-xs text-slate-600">
        {props.helper}
      </p>
    </article>
  );
}

function Field(props: {
  label: string;
  value: string;
  type?: string;
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
        min={props.type === "number" ? "1" : undefined}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-rose-400/50"
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
          props.onChange(event.target.value)
        }
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
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-rose-400/50"
      />
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}