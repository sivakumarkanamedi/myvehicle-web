"use client";

import { FormEvent, useMemo, useState } from "react";

type VerificationStatus =
  | "verified"
  | "expired"
  | "cancelled"
  | "suspended"
  | "not_yet_active"
  | "invalid";

type VerificationResponse = {
  success: boolean;
  valid: boolean;
  verification_status: VerificationStatus;

  reasons: string[];
  warnings: string[];

  policy: {
    policy_number: string;
    policy_version: number;
    policy_status: string;
    issuance_status: string;
    policy_type: string;
    policy_category: string;
    insurer_name: string | null;

    insured_name_masked: string;

    vehicle_registration_number: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_variant: string | null;
    vehicle_year: number | null;
    vehicle_fuel_type: string | null;

    policy_start_date: string;
    policy_end_date: string;
    issued_at: string | null;

    idv: number | null;
    ncb_percent: number | null;

    digital_signature_status: string;
    signed_at: string | null;
  } | null;

  verification: {
    checked_at: string;
    verification_reference: string;
    verification_code_matched: boolean;
    registration_number_matched: boolean | null;
    document_count: number;
    latest_document_status: string | null;
  };

  error?: string;
};

type FormState = {
  policyNumber: string;
  verificationCode: string;
  registrationNumber: string;
};

export default function PolicyVerification() {
  const [form, setForm] = useState<FormState>({
    policyNumber: "",
    verificationCode: "",
    registrationNumber: "",
  });

  const [result, setResult] =
    useState<VerificationResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(
    () =>
      form.policyNumber.trim().length > 0 &&
      form.verificationCode.trim().length > 0,
    [form]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/insurance/policy/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            policy_number:
              form.policyNumber.trim(),
            verification_code:
              form.verificationCode.trim(),
            vehicle_registration_number:
              form.registrationNumber.trim() ||
              null,
          }),
        }
      );

      const data =
        (await response.json()) as VerificationResponse;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to verify this policy."
        );
      }

      setResult(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to verify this policy."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      policyNumber: "",
      verificationCode: "",
      registrationNumber: "",
    });

    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Verify Your Insurance Policy
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Enter the policy number and QR verification code shown on the
            digital policy schedule. You may also enter the vehicle registration
            number for an additional match check.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            <h2 className="text-xl font-bold">
              Verification details
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              The verification code is stored inside the policy QR metadata
              generated during policy issuance.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              <Field
                label="Policy number"
                value={form.policyNumber}
                placeholder="MV-POL-20260801-XXXXXXXXXX"
                required
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    policyNumber: value,
                  }))
                }
              />

              <Field
                label="Verification code"
                value={form.verificationCode}
                placeholder="Enter QR verification code"
                required
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    verificationCode: value,
                  }))
                }
              />

              <Field
                label="Vehicle registration number"
                value={form.registrationNumber}
                placeholder="Optional, for example KA01AB1234"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    registrationNumber: value,
                  }))
                }
              />

              {error ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Verifying..."
                    : "Verify policy"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-sm font-semibold text-slate-300">
                Privacy protection
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                The public result masks the insured person&apos;s name and does
                not expose contact information, full address, chassis number,
                engine number or VIN.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
            {!result ? (
              <VerificationPlaceholder />
            ) : (
              <VerificationResultCard result={result} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function VerificationResultCard(props: {
  result: VerificationResponse;
}) {
  const { result } = props;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Verification result
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            {result.valid
              ? "Policy verified"
              : statusTitle(
                  result.verification_status
                )}
          </h2>
        </div>

        <StatusBadge
          status={result.verification_status}
          valid={result.valid}
        />
      </div>

      <div className="mt-5 space-y-3">
        {result.reasons.map((reason, index) => (
          <MessageRow
            key={`${reason}-${index}`}
            text={reason}
            tone={
              result.valid
                ? "success"
                : "danger"
            }
          />
        ))}
      </div>

      {result.warnings.length ? (
        <div className="mt-4 space-y-3">
          {result.warnings.map((warning, index) => (
            <MessageRow
              key={`${warning}-${index}`}
              text={warning}
              tone="warning"
            />
          ))}
        </div>
      ) : null}

      {result.policy ? (
        <>
          <section className="mt-6">
            <SectionHeading
              title="Policy details"
              subtitle="Verified public policy information."
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailRow
                label="Policy number"
                value={result.policy.policy_number}
              />

              <DetailRow
                label="Version"
                value={String(
                  result.policy.policy_version
                )}
              />

              <DetailRow
                label="Insurer"
                value={
                  result.policy.insurer_name ||
                  "Not available"
                }
              />

              <DetailRow
                label="Insured"
                value={
                  result.policy
                    .insured_name_masked
                }
              />

              <DetailRow
                label="Policy type"
                value={formatLabel(
                  result.policy.policy_type
                )}
              />

              <DetailRow
                label="Policy status"
                value={formatLabel(
                  result.policy.policy_status
                )}
              />

              <DetailRow
                label="Coverage start"
                value={formatDate(
                  result.policy
                    .policy_start_date
                )}
              />

              <DetailRow
                label="Coverage end"
                value={formatDate(
                  result.policy
                    .policy_end_date
                )}
              />

              <DetailRow
                label="IDV"
                value={formatCurrency(
                  result.policy.idv
                )}
              />

              <DetailRow
                label="NCB"
                value={`${
                  result.policy.ncb_percent ??
                  0
                }%`}
              />
            </div>
          </section>

          <section className="mt-6">
            <SectionHeading
              title="Vehicle details"
              subtitle="Vehicle information linked to this policy."
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailRow
                label="Registration"
                value={
                  result.policy
                    .vehicle_registration_number ||
                  "Not available"
                }
              />

              <DetailRow
                label="Vehicle"
                value={vehicleName(
                  result.policy
                )}
              />

              <DetailRow
                label="Year"
                value={
                  result.policy.vehicle_year
                    ? String(
                        result.policy
                          .vehicle_year
                      )
                    : "Not available"
                }
              />

              <DetailRow
                label="Fuel type"
                value={
                  result.policy
                    .vehicle_fuel_type
                    ? formatLabel(
                        result.policy
                          .vehicle_fuel_type
                      )
                    : "Not available"
                }
              />
            </div>
          </section>
        </>
      ) : null}

      <section className="mt-6">
        <SectionHeading
          title="Verification log"
          subtitle="Technical checks performed by the verification engine."
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CheckRow
            label="QR code matched"
            value={
              result.verification
                .verification_code_matched
            }
          />

          <CheckRow
            label="Registration matched"
            value={
              result.verification
                .registration_number_matched
            }
            nullable
          />

          <DetailRow
            label="Policy documents"
            value={String(
              result.verification
                .document_count
            )}
          />

          <DetailRow
            label="Latest document"
            value={
              result.verification
                .latest_document_status
                ? formatLabel(
                    result.verification
                      .latest_document_status
                  )
                : "Not available"
            }
          />

          <DetailRow
            label="Reference"
            value={
              result.verification
                .verification_reference
            }
          />

          <DetailRow
            label="Checked at"
            value={formatDateTime(
              result.verification.checked_at
            )}
          />
        </div>
      </section>
    </div>
  );
}

function VerificationPlaceholder() {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-3xl">
        ✓
      </div>

      <h2 className="mt-5 text-2xl font-bold">
        Ready to verify
      </h2>

      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        Enter a policy number and verification code. The result will show
        whether the policy is active, expired, cancelled, suspended or invalid.
      </p>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  placeholder: string;
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
        type="text"
        value={props.value}
        required={props.required}
        onChange={(event) =>
          props.onChange(event.target.value)
        }
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
      />
    </label>
  );
}

function SectionHeading(props: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-bold">
        {props.title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {props.subtitle}
      </p>
    </div>
  );
}

function DetailRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-200">
        {props.value}
      </p>
    </div>
  );
}

function CheckRow(props: {
  label: string;
  value: boolean | null;
  nullable?: boolean;
}) {
  const display =
    props.value === null && props.nullable
      ? "Not checked"
      : props.value
        ? "Matched"
        : "Not matched";

  const classes =
    props.value === null && props.nullable
      ? "text-slate-400"
      : props.value
        ? "text-emerald-300"
        : "text-rose-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className={`mt-1 text-sm font-semibold ${classes}`}>
        {display}
      </p>
    </div>
  );
}

function MessageRow(props: {
  text: string;
  tone: "success" | "warning" | "danger";
}) {
  const classes =
    props.tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : props.tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-rose-400/30 bg-rose-400/10 text-rose-100";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${classes}`}
    >
      {props.text}
    </div>
  );
}

function StatusBadge(props: {
  status: VerificationStatus;
  valid: boolean;
}) {
  const classes = props.valid
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : [
          "expired",
          "cancelled",
          "suspended",
          "invalid",
        ].includes(props.status)
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : "border-amber-400/30 bg-amber-400/10 text-amber-100";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${classes}`}
    >
      {formatLabel(props.status)}
    </span>
  );
}

function statusTitle(
  status: VerificationStatus
) {
  switch (status) {
    case "expired":
      return "Policy expired";

    case "cancelled":
      return "Policy cancelled";

    case "suspended":
      return "Policy suspended";

    case "not_yet_active":
      return "Policy not yet active";

    default:
      return "Policy verification failed";
  }
}

function vehicleName(
  policy: NonNullable<
    VerificationResponse["policy"]
  >
) {
  const parts = [
    policy.vehicle_make,
    policy.vehicle_model,
    policy.vehicle_variant,
  ].filter(Boolean);

  return parts.length
    ? parts.join(" ")
    : "Not available";
}

function formatCurrency(
  value: number | null | undefined
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
    }
  ).format(date);
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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