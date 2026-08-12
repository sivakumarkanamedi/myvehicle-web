"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type Policy = {
  id: number;
  policy_status: string;
  total_premium: number;
  created_at: string;
};

type Claim = {
  id: number;
  claim_status: string | null;
  estimated_loss_amount: number | null;
  settlement_amount: number | null;
  created_at: string;
};

type UnderwritingCase = {
  id: number;
  underwriting_status: string;
  overall_risk_score: number | null;
  created_at: string;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  createdAt: string;
};

export default function InsuranceManagementCenterPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [underwriting, setUnderwriting] = useState<UnderwritingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "warning" | "critical" | "success"
  >("all");

  useEffect(() => {
    void loadManagementData();
  }, []);

  async function loadManagementData() {
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
            .select("id, policy_status, total_premium, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),

          supabase
            .from("insurance_claims")
            .select(
              "id, claim_status, estimated_loss_amount, settlement_amount, created_at"
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),

          supabase
            .from("insurance_underwriting_cases")
            .select(
              "id, underwriting_status, overall_risk_score, created_at"
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
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
          : "Unable to load reports and notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  const analytics = useMemo(() => {
    const totalPremium = policies.reduce(
      (sum, item) => sum + Number(item.total_premium ?? 0),
      0
    );

    const settledClaims = claims.filter((item) =>
      ["settled", "closed", "paid"].includes(
        (item.claim_status ?? "").toLowerCase()
      )
    );

    const totalSettlement = settledClaims.reduce(
      (sum, item) =>
        sum +
        Number(
          item.settlement_amount ??
            item.estimated_loss_amount ??
            0
        ),
      0
    );

    const approvedPolicies = policies.filter((item) =>
      ["active", "issued"].includes(
        item.policy_status.toLowerCase()
      )
    ).length;

    const pendingUnderwriting = underwriting.filter((item) =>
      ["pending", "assessing", "inspection_pending", "referred"].includes(
        item.underwriting_status.toLowerCase()
      )
    ).length;

    const highRiskCases = underwriting.filter(
      (item) => Number(item.overall_risk_score ?? 0) >= 60
    ).length;

    const approvalRate = policies.length
      ? (approvedPolicies / policies.length) * 100
      : 0;

    const settlementRate = claims.length
      ? (settledClaims.length / claims.length) * 100
      : 0;

    const averageRisk = underwriting.length
      ? underwriting.reduce(
          (sum, item) =>
            sum + Number(item.overall_risk_score ?? 0),
          0
        ) / underwriting.length
      : 0;

    return {
      totalPremium,
      totalSettlement,
      approvedPolicies,
      pendingUnderwriting,
      highRiskCases,
      approvalRate,
      settlementRate,
      averageRisk,
    };
  }, [policies, claims, underwriting]);

  const monthlySeries = useMemo(() => {
    const monthMap = new Map<
      string,
      {
        month: string;
        policies: number;
        claims: number;
        premium: number;
      }
    >();

    for (const policy of policies) {
      const month = monthKey(policy.created_at);
      const current = monthMap.get(month) ?? {
        month,
        policies: 0,
        claims: 0,
        premium: 0,
      };

      current.policies += 1;
      current.premium += Number(policy.total_premium ?? 0);
      monthMap.set(month, current);
    }

    for (const claim of claims) {
      const month = monthKey(claim.created_at);
      const current = monthMap.get(month) ?? {
        month,
        policies: 0,
        claims: 0,
        premium: 0,
      };

      current.claims += 1;
      monthMap.set(month, current);
    }

    return Array.from(monthMap.values()).slice(-6);
  }, [policies, claims]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    if (analytics.pendingUnderwriting > 0) {
      items.push({
        id: "pending-underwriting",
        title: "Underwriting actions pending",
        message: `${analytics.pendingUnderwriting} case(s) require underwriting review.`,
        severity: "warning",
        createdAt: new Date().toISOString(),
      });
    }

    if (analytics.highRiskCases > 0) {
      items.push({
        id: "high-risk",
        title: "High-risk cases detected",
        message: `${analytics.highRiskCases} underwriting case(s) have a risk score of 60 or above.`,
        severity: "critical",
        createdAt: new Date().toISOString(),
      });
    }

    const openClaims = claims.filter(
      (item) =>
        !["settled", "closed", "rejected"].includes(
          (item.claim_status ?? "").toLowerCase()
        )
    ).length;

    if (openClaims > 0) {
      items.push({
        id: "open-claims",
        title: "Claims need attention",
        message: `${openClaims} claim(s) are still open.`,
        severity: "warning",
        createdAt: new Date().toISOString(),
      });
    }

    if (analytics.approvalRate >= 75) {
      items.push({
        id: "approval-performance",
        title: "Strong policy approval performance",
        message: `Current approval rate is ${analytics.approvalRate.toFixed(
          1
        )}%.`,
        severity: "success",
        createdAt: new Date().toISOString(),
      });
    }

    if (!items.length) {
      items.push({
        id: "all-clear",
        title: "No critical alerts",
        message: "Insurance operations are currently stable.",
        severity: "info",
        createdAt: new Date().toISOString(),
      });
    }

    return items;
  }, [analytics, claims]);

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === "all") {
      return notifications;
    }

    return notifications.filter(
      (item) => item.severity === notificationFilter
    );
  }, [notificationFilter, notifications]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-violet-400" />
          <p className="mt-4 text-sm text-slate-400">
            Loading Management Center...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/40 p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">
                My Vehicle Insurance
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                Reports, Analytics & Notifications Center
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Monitor insurance performance, operational risks, claims
                activity and important alerts from one management dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadManagementData()}
              className="rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20"
            >
              Refresh dashboard
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
            label="Total Premium"
            value={formatCurrency(analytics.totalPremium)}
            helper={`${policies.length} policy records`}
          />

          <MetricCard
            label="Settlement Value"
            value={formatCurrency(analytics.totalSettlement)}
            helper={`${claims.length} claim records`}
          />

          <MetricCard
            label="Approval Rate"
            value={`${analytics.approvalRate.toFixed(1)}%`}
            helper={`${analytics.approvedPolicies} active or issued`}
          />

          <MetricCard
            label="Average Risk"
            value={`${analytics.averageRisk.toFixed(1)}/100`}
            helper={`${analytics.highRiskCases} high-risk cases`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold">
              Six-Month Activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Policy creation, claims volume and premium trend.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-3">Month</th>
                    <th className="pb-3">Policies</th>
                    <th className="pb-3">Claims</th>
                    <th className="pb-3">Premium</th>
                  </tr>
                </thead>

                <tbody>
                  {monthlySeries.length ? (
                    monthlySeries.map((item) => (
                      <tr
                        key={item.month}
                        className="border-t border-white/10 text-sm"
                      >
                        <td className="py-4 font-semibold">
                          {formatMonth(item.month)}
                        </td>
                        <td className="py-4 text-slate-300">
                          {item.policies}
                        </td>
                        <td className="py-4 text-slate-300">
                          {item.claims}
                        </td>
                        <td className="py-4 text-violet-300">
                          {formatCurrency(item.premium)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No monthly data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold">
              Operational Performance
            </h2>

            <div className="mt-5 space-y-5">
              <ProgressMetric
                label="Policy Approval Rate"
                value={analytics.approvalRate}
              />

              <ProgressMetric
                label="Claim Settlement Rate"
                value={analytics.settlementRate}
              />

              <ProgressMetric
                label="Risk Control Score"
                value={Math.max(
                  0,
                  100 - analytics.averageRisk
                )}
              />
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Notifications Center
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Important operational alerts and performance updates.
              </p>
            </div>

            <select
              value={notificationFilter}
              onChange={(event) =>
                setNotificationFilter(
                  event.target.value as
                    | "all"
                    | "warning"
                    | "critical"
                    | "success"
                )
              }
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
            >
              <option value="all">All notifications</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {filteredNotifications.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
              />
            ))}
          </div>
        </section>

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

function MetricCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">
        {props.label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {props.value}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {props.helper}
      </p>
    </article>
  );
}

function ProgressMetric(props: {
  label: string;
  value: number;
}) {
  const safeValue = Math.min(
    100,
    Math.max(0, props.value)
  );

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">
          {props.label}
        </span>

        <span className="font-semibold">
          {safeValue.toFixed(1)}%
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-violet-400"
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>
    </div>
  );
}

function NotificationCard(props: {
  item: NotificationItem;
}) {
  const classes =
    props.item.severity === "critical"
      ? "border-rose-400/30 bg-rose-400/10"
      : props.item.severity === "warning"
        ? "border-amber-400/30 bg-amber-400/10"
        : props.item.severity === "success"
          ? "border-emerald-400/30 bg-emerald-400/10"
          : "border-slate-400/20 bg-slate-400/10";

  return (
    <article
      className={`rounded-2xl border p-4 ${classes}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {props.item.title}
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-300">
            {props.item.message}
          </p>
        </div>

        <span className="text-xs uppercase tracking-wide text-slate-500">
          {props.item.severity}
        </span>
      </div>
    </article>
  );
}

function monthKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMonth(value: string) {
  if (value === "Unknown") {
    return value;
  }

  const [year, month] = value.split("-");
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, 1)
  );

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(date);
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