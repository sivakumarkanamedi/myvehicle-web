"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type Policy = {
  id: number;
  policy_number: string;
  policy_status: string;
  insured_name: string;
  vehicle_registration_number: string | null;
  total_premium: number;
  created_at: string;
};

type Claim = {
  id: number;
  claim_reference: string | null;
  claim_status: string | null;
  incident_date: string | null;
  estimated_loss_amount: number | null;
  settlement_amount: number | null;
  created_at: string;
};

type UnderwritingCase = {
  id: number;
  case_reference: string | null;
  underwriting_status: string;
  applicant_name: string | null;
  vehicle_registration_number: string | null;
  overall_risk_score: number | null;
  created_at: string;
};

type OperationItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  amount?: number | null;
  type: "policy" | "claim" | "underwriting";
  createdAt: string;
};

export default function InsuranceOperationsPortalPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [underwriting, setUnderwriting] = useState<UnderwritingCase[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "policies" | "claims" | "underwriting"
  >("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadOperationsData();
  }, []);

  async function loadOperationsData() {
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

      const [policyResult, claimResult, underwritingResult] =
        await Promise.all([
          supabase
            .from("insurance_policy_records")
            .select(
              `
                id,
                policy_number,
                policy_status,
                insured_name,
                vehicle_registration_number,
                total_premium,
                created_at
              `
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),

          supabase
            .from("insurance_claims")
            .select(
              `
                id,
                claim_reference,
                claim_status,
                incident_date,
                estimated_loss_amount,
                settlement_amount,
                created_at
              `
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),

          supabase
            .from("insurance_underwriting_cases")
            .select(
              `
                id,
                case_reference,
                underwriting_status,
                applicant_name,
                vehicle_registration_number,
                overall_risk_score,
                created_at
              `
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      if (policyResult.error) {
        throw policyResult.error;
      }

      if (claimResult.error) {
        throw claimResult.error;
      }

      if (underwritingResult.error) {
        throw underwritingResult.error;
      }

      setPolicies((policyResult.data ?? []) as Policy[]);
      setClaims((claimResult.data ?? []) as Claim[]);
      setUnderwriting(
        (underwritingResult.data ?? []) as UnderwritingCase[]
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load insurance operations."
      );
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const activePolicies = policies.filter((policy) =>
      ["active", "issued"].includes(policy.policy_status.toLowerCase())
    ).length;

    const openClaims = claims.filter(
      (claim) =>
        !["settled", "closed", "rejected"].includes(
          (claim.claim_status ?? "").toLowerCase()
        )
    ).length;

    const pendingUnderwriting = underwriting.filter((item) =>
      ["pending", "assessing", "inspection_pending", "referred"].includes(
        item.underwriting_status.toLowerCase()
      )
    ).length;

    const totalPremium = policies.reduce(
      (sum, policy) => sum + Number(policy.total_premium ?? 0),
      0
    );

    return {
      activePolicies,
      openClaims,
      pendingUnderwriting,
      totalPremium,
    };
  }, [policies, claims, underwriting]);

  const operationItems = useMemo<OperationItem[]>(() => {
    const policyItems = policies.map((policy) => ({
      id: `policy-${policy.id}`,
      title: policy.policy_number,
      subtitle:
        `${policy.insured_name} · ` +
        `${policy.vehicle_registration_number || "Vehicle unavailable"}`,
      status: policy.policy_status,
      amount: policy.total_premium,
      type: "policy" as const,
      createdAt: policy.created_at,
    }));

    const claimItems = claims.map((claim) => ({
      id: `claim-${claim.id}`,
      title: claim.claim_reference || `Claim ${claim.id}`,
      subtitle: `Incident: ${formatDate(claim.incident_date)}`,
      status: claim.claim_status || "pending",
      amount:
        claim.settlement_amount ??
        claim.estimated_loss_amount,
      type: "claim" as const,
      createdAt: claim.created_at,
    }));

    const underwritingItems = underwriting.map((item) => ({
      id: `underwriting-${item.id}`,
      title:
        item.case_reference ||
        `Underwriting Case ${item.id}`,
      subtitle:
        `${item.applicant_name || "Applicant unavailable"} · ` +
        `${item.vehicle_registration_number || "Vehicle unavailable"}`,
      status: item.underwriting_status,
      amount: item.overall_risk_score,
      type: "underwriting" as const,
      createdAt: item.created_at,
    }));

    return [
      ...policyItems,
      ...claimItems,
      ...underwritingItems,
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, 12);
  }, [policies, claims, underwriting]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading Operations Portal...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-300">
                My Vehicle Insurance
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                Unified Agent & Admin Operations Portal
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Manage policies, claims, underwriting, customers and operational
                workflows from one control center.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadOperationsData()}
              className="rounded-2xl border border-indigo-400/30 bg-indigo-400/10 px-5 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/20"
            >
              Refresh data
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active Policies"
            value={formatNumber(summary.activePolicies)}
            helper="Currently active"
          />

          <MetricCard
            label="Open Claims"
            value={formatNumber(summary.openClaims)}
            helper="Need action"
          />

          <MetricCard
            label="Pending Underwriting"
            value={formatNumber(summary.pendingUnderwriting)}
            helper="Awaiting decision"
          />

          <MetricCard
            label="Total Premium"
            value={formatCurrency(summary.totalPremium)}
            helper="Recorded policy value"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-2">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["overview", "Overview"],
              ["policies", "Policies"],
              ["claims", "Claims"],
              ["underwriting", "Underwriting"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setActiveTab(
                    value as
                      | "overview"
                      | "policies"
                      | "claims"
                      | "underwriting"
                  )
                }
                className={
                  activeTab === value
                    ? "rounded-2xl bg-indigo-400 px-4 py-3 text-sm font-bold text-slate-950"
                    : "rounded-2xl px-4 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "overview" ? (
          <>
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <PortalCard
                title="Policy Administration"
                description="Issue policies, view history, renew coverage and verify documents."
                href="/insurance/policy/history"
              />

              <PortalCard
                title="Claims Management"
                description="Register, review, assess and settle insurance claims."
                href="/insurance/claims"
              />

              <PortalCard
                title="AI Underwriting"
                description="Review risks, inspections, referrals and decisions."
                href="/insurance/underwriting"
              />

              <PortalCard
                title="Customer Portal"
                description="Access the customer-facing policy and claim experience."
                href="/insurance/customer"
              />

              <PortalCard
                title="Policy Endorsements"
                description="Manage policy updates and coverage changes."
                href="/insurance/endorsements"
              />

              <PortalCard
                title="Cancellation & Refund"
                description="Process policy cancellation and refund requests."
                href="/insurance/policy/cancellation"
              />
            </section>

            <OperationsFeed items={operationItems} />
          </>
        ) : null}

        {activeTab === "policies" ? (
          <DataTable
            title="Policies"
            headers={[
              "Policy Number",
              "Insured",
              "Vehicle",
              "Status",
              "Premium",
            ]}
            rows={policies.map((policy) => [
              policy.policy_number,
              policy.insured_name,
              policy.vehicle_registration_number || "Not available",
              formatLabel(policy.policy_status),
              formatCurrency(policy.total_premium),
            ])}
          />
        ) : null}

        {activeTab === "claims" ? (
          <DataTable
            title="Claims"
            headers={[
              "Claim",
              "Incident Date",
              "Status",
              "Estimated Loss",
              "Settlement",
            ]}
            rows={claims.map((claim) => [
              claim.claim_reference || `Claim ${claim.id}`,
              formatDate(claim.incident_date),
              formatLabel(claim.claim_status || "pending"),
              formatCurrency(claim.estimated_loss_amount),
              formatCurrency(claim.settlement_amount),
            ])}
          />
        ) : null}

        {activeTab === "underwriting" ? (
          <DataTable
            title="Underwriting Cases"
            headers={[
              "Case",
              "Applicant",
              "Vehicle",
              "Status",
              "Risk Score",
            ]}
            rows={underwriting.map((item) => [
              item.case_reference || `Case ${item.id}`,
              item.applicant_name || "Not available",
              item.vehicle_registration_number || "Not available",
              formatLabel(item.underwriting_status),
              `${item.overall_risk_score ?? 0}/100`,
            ])}
          />
        ) : null}

        <div className="pb-4">
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

function OperationsFeed(props: {
  items: OperationItem[];
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <h2 className="text-xl font-bold">
        Latest Operations
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Recent activity across policies, claims and underwriting.
      </p>

      <div className="mt-4 space-y-3">
        {props.items.length ? (
          props.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.title}</p>
                  <TypeBadge value={item.type} />
                  <StatusBadge value={item.status} />
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {item.subtitle}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold">
                  {item.type === "underwriting"
                    ? `${item.amount ?? 0}/100`
                    : formatCurrency(item.amount)}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
            No operations found.
          </p>
        )}
      </div>
    </section>
  );
}

function DataTable(props: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-xl font-bold">{props.title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {props.headers.map((header) => (
                <th key={header} className="px-5 py-4">
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {props.rows.length ? (
              props.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-t border-white/10 text-sm"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="px-5 py-4 text-slate-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={props.headers.length}
                  className="px-5 py-10 text-center text-sm text-slate-500"
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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

function PortalCard(props: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="group rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-indigo-400/30"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">{props.title}</h2>
        <span className="text-xl text-slate-600 group-hover:text-indigo-300">
          →
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {props.description}
      </p>
    </Link>
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
      : ["declined", "rejected", "cancelled", "expired"].includes(
            normalized
          )
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

function TypeBadge(props: {
  value: OperationItem["type"];
}) {
  const label =
    props.value === "policy"
      ? "Policy"
      : props.value === "claim"
        ? "Claim"
        : "Underwriting";

  return (
    <span className="inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2.5 py-1 text-xs font-semibold text-indigo-200">
      {label}
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

function formatNumber(
  value: number | null | undefined
) {
  return new Intl.NumberFormat("en-IN").format(
    Number(value ?? 0)
  );
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

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}