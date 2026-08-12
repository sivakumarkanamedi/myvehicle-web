"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type Policy = {
  id: number;
  policy_number: string;
  policy_status: string;
  policy_type: string;
  vehicle_registration_number: string | null;
  policy_start_date: string;
  policy_end_date: string;
  total_premium: number;
  ncb_percent: number | null;
};

type Claim = {
  id: number;
  claim_reference: string | null;
  claim_status: string | null;
  incident_date: string | null;
  estimated_loss_amount: number | null;
  settlement_amount: number | null;
};

export default function InsuranceCustomerPortalPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPortalData();
  }, []);

  async function loadPortalData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const [policyResult, claimResult] = await Promise.all([
        supabase
          .from("insurance_policy_records")
          .select(
            `
              id,
              policy_number,
              policy_status,
              policy_type,
              vehicle_registration_number,
              policy_start_date,
              policy_end_date,
              total_premium,
              ncb_percent
            `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("insurance_claims")
          .select(
            `
              id,
              claim_reference,
              claim_status,
              incident_date,
              estimated_loss_amount,
              settlement_amount
            `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (policyResult.error) {
        throw policyResult.error;
      }

      if (claimResult.error) {
        throw claimResult.error;
      }

      setPolicies((policyResult.data ?? []) as Policy[]);
      setClaims((claimResult.data ?? []) as Claim[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load customer portal."
      );
    } finally {
      setLoading(false);
    }
  }

  const activePolicies = useMemo(
    () =>
      policies.filter((policy) =>
        ["active", "issued"].includes(
          policy.policy_status.toLowerCase()
        )
      ).length,
    [policies]
  );

  const openClaims = useMemo(
    () =>
      claims.filter(
        (claim) =>
          !["settled", "closed", "rejected"].includes(
            (claim.claim_status ?? "").toLowerCase()
          )
      ).length,
    [claims]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading Insurance Portal...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Customer Insurance Portal
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            View policies, claims, renewals, documents, endorsements,
            cancellations and refund status from one place.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Policies"
            value={String(policies.length)}
          />
          <MetricCard
            label="Active Policies"
            value={String(activePolicies)}
          />
          <MetricCard
            label="Total Claims"
            value={String(claims.length)}
          />
          <MetricCard
            label="Open Claims"
            value={String(openClaims)}
          />
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <PortalCard
            title="My Policies"
            description="View active, expired and cancelled policy records."
            href="/insurance/policy/history"
          />

          <PortalCard
            title="Renew Policy"
            description="Review upcoming renewals and continue coverage."
            href="/insurance/policy/renewal"
          />

          <PortalCard
            title="Register Claim"
            description="Start a new insurance claim."
            href="/insurance/claims/new"
          />

          <PortalCard
            title="Track Claims"
            description="Check claim progress, survey and settlement."
            href="/insurance/claims/dashboard"
          />

          <PortalCard
            title="Policy Endorsements"
            description="Request policy detail or coverage changes."
            href="/insurance/endorsements"
          />

          <PortalCard
            title="Cancel Policy"
            description="Submit cancellation and refund request."
            href="/insurance/policy/cancellation"
          />

          <PortalCard
            title="Verify Policy"
            description="Verify policy number and QR code."
            href="/insurance/verify"
          />

          <PortalCard
            title="Ask Mira"
            description="Get AI help for insurance questions."
            href="/mira"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DataPanel
            title="Recent Policies"
            emptyText="No policies found."
          >
            {policies.slice(0, 5).map((policy) => (
              <div
                key={policy.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {policy.policy_number}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {policy.vehicle_registration_number ||
                        "Vehicle not available"}
                    </p>
                  </div>

                  <StatusBadge value={policy.policy_status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Type" value={formatLabel(policy.policy_type)} />
                  <Detail
                    label="Premium"
                    value={formatCurrency(policy.total_premium)}
                  />
                  <Detail
                    label="Valid Until"
                    value={formatDate(policy.policy_end_date)}
                  />
                  <Detail
                    label="NCB"
                    value={`${policy.ncb_percent ?? 0}%`}
                  />
                </div>
              </div>
            ))}
          </DataPanel>

          <DataPanel
            title="Recent Claims"
            emptyText="No claims found."
          >
            {claims.slice(0, 5).map((claim) => (
              <div
                key={claim.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {claim.claim_reference || `Claim ${claim.id}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(claim.incident_date)}
                    </p>
                  </div>

                  <StatusBadge value={claim.claim_status || "pending"} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Detail
                    label="Estimated Loss"
                    value={formatCurrency(
                      claim.estimated_loss_amount
                    )}
                  />
                  <Detail
                    label="Settlement"
                    value={formatCurrency(
                      claim.settlement_amount
                    )}
                  />
                </div>
              </div>
            ))}
          </DataPanel>
        </section>
      </div>
    </main>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{props.label}</p>
      <p className="mt-2 text-3xl font-bold">{props.value}</p>
    </article>
  );
}

function PortalCard(props: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="group rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-cyan-400/30"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">{props.title}</h2>
        <span className="text-xl text-slate-600 group-hover:text-cyan-300">
          →
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {props.description}
      </p>
    </Link>
  );
}

function DataPanel(props: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasChildren =
    Array.isArray(props.children)
      ? props.children.length > 0
      : Boolean(props.children);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <h2 className="text-xl font-bold">{props.title}</h2>

      <div className="mt-4 space-y-3">
        {hasChildren ? (
          props.children
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
            {props.emptyText}
          </p>
        )}
      </div>
    </section>
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
  const normalized = props.value.toLowerCase();

  const classes =
    ["active", "issued", "approved", "settled", "closed"].includes(
      normalized
    )
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : ["cancelled", "rejected", "expired"].includes(normalized)
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : "border-amber-400/30 bg-amber-400/10 text-amber-100";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.value)}
    </span>
  );
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}