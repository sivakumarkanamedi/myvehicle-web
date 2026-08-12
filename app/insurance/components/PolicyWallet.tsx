"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type WalletSummary = {
  active_policies: number;
  expiring_soon: number;
  expired_policies: number;
  grace_period_policies: number;
  renewal_due: number;
  pending_endorsements: number;
  pending_installments: number;
  overdue_installments: number;
  unsigned_policies: number;
  incomplete_documents: number;
  total_idv: number;
  total_premium: number;
};

type PolicyRecord = {
  id: number;
  user_id: string;
  vehicle_id: number;

  policy_number: string;
  policy_version: number;

  policy_status: string;
  issuance_status: string;
  renewal_status: string;

  policy_type: string;
  policy_category: string;

  insurer_name: string | null;

  insured_name: string;
  insured_email: string | null;
  insured_phone: string | null;

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
  total_premium: number;
  net_premium: number;
  tax_amount: number;
  ncb_percent: number | null;

  grace_period_days: number;
  grace_period_end_date: string | null;

  cancellation_status: string;
  digital_signature_status: string;
  signed_at: string | null;

  created_at: string;
  updated_at: string;
};

type PolicyHealth = {
  is_active: boolean;
  is_expired: boolean;
  is_expiring_soon: boolean;
  days_to_expiry: number;
  is_in_grace_period: boolean;
  documents_complete: boolean;
  signature_complete: boolean;
  payment_plan_active: boolean;
  pending_installments: number;
  overdue_installments: number;
  open_endorsements: number;
  renewal_due: boolean;
};

type PolicyDocument = {
  id: number;
  policy_id: number;
  document_type: string;
  document_number: string | null;
  document_status: string;
  document_title: string | null;
  document_summary: string | null;
  storage_path: string | null;
  version_number: number;
  generated_at: string;
  signed_at: string | null;
  delivered_at: string | null;
};

type Endorsement = {
  id: number;
  policy_id: number;
  endorsement_reference: string | null;
  endorsement_type: string;
  endorsement_status: string;
  premium_difference: number;
  tax_difference: number;
  refund_amount: number;
  effective_date: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

type Renewal = {
  id: number;
  current_policy_id: number;
  renewed_policy_id: number | null;
  renewal_reference: string | null;
  renewal_status: string;
  renewal_due_date: string;
  grace_period_end_date: string | null;
  proposed_idv: number | null;
  proposed_total_premium: number | null;
  proposed_ncb_percent: number | null;
  retention_risk_score: number | null;
  renewal_probability: number | null;
  renewed_at: string | null;
  declined_at: string | null;
  created_at: string;
};

type Installment = {
  id: number;
  payment_plan_id: number;
  policy_id: number;
  installment_number: number;
  due_date: string;
  installment_amount: number;
  installment_status: string;
  payment_reference: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  failure_reason: string | null;
  retry_count: number;
};

type PaymentPlan = {
  id: number;
  policy_id: number;
  payment_plan_type: string;
  installment_count: number;
  total_payable_amount: number;
  initial_payment_amount: number | null;
  financed_amount: number | null;
  interest_rate: number | null;
  processing_fee: number | null;
  total_interest_amount: number | null;
  plan_status: string;
  start_date: string | null;
  end_date: string | null;
  installments: Installment[];
};

type QuickAction = {
  code: string;
  label: string;
  enabled: boolean;
  reason?: string;
};

type WalletPolicy = {
  policy: PolicyRecord;
  health: PolicyHealth;
  documents: PolicyDocument[];
  endorsements: Endorsement[];
  renewals: Renewal[];
  payment_plans: PaymentPlan[];
  quick_actions: QuickAction[];
};

type WalletResponse = {
  success: boolean;
  generated_at: string;
  total_policies: number;
  summary: WalletSummary;
  wallet: WalletPolicy[];
};

type Filters = {
  vehicleId: string;
  includeInactive: boolean;
};

export default function PolicyWallet() {
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<Filters>({
    vehicleId: "",
    includeInactive: false,
  });

  const [expandedPolicyId, setExpandedPolicyId] = useState<number | null>(
    null
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set(
      "include_inactive",
      String(filters.includeInactive)
    );

    params.set("limit", "50");

    if (filters.vehicleId.trim()) {
      params.set("vehicle_id", filters.vehicleId.trim());
    }

    return params.toString();
  }, [filters]);

  const loadWallet = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

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
            "Please sign in again to view your policy wallet."
          );
        }

        const response = await fetch(
          `/api/insurance/policy/wallet?${queryString}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error || "Unable to load the policy wallet."
          );
        }

        setData(result as WalletResponse);

        if (
          !expandedPolicyId &&
          Array.isArray(result?.wallet) &&
          result.wallet.length
        ) {
          setExpandedPolicyId(result.wallet[0].policy.id);
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the policy wallet."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queryString, expandedPolicyId]
  );

  useEffect(() => {
    void loadWallet("initial");
  }, [loadWallet]);

  if (loading) {
    return <WalletSkeleton />;
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ErrorCard
            message={error || "Policy wallet data is unavailable."}
            onRetry={() => void loadWallet("initial")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                My Vehicle Insurance
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Digital Policy Wallet
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                View policy health, documents, renewals, endorsements,
                installments and important actions in one secure place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadWallet("refresh")}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh wallet"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Vehicle ID
              </span>

              <input
                type="number"
                min="1"
                value={filters.vehicleId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    vehicleId: event.target.value,
                  }))
                }
                placeholder="All vehicles"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </label>

            <label className="flex items-end">
              <span className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <span className="text-sm text-slate-300">
                  Include inactive policies
                </span>

                <input
                  type="checkbox"
                  checked={filters.includeInactive}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      includeInactive: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded border-white/20 bg-slate-900"
                />
              </span>
            </label>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active policies"
            value={formatNumber(data.summary.active_policies)}
            helper={`${formatNumber(
              data.summary.expiring_soon
            )} expiring soon`}
          />

          <MetricCard
            label="Renewals due"
            value={formatNumber(data.summary.renewal_due)}
            helper={`${formatNumber(
              data.summary.grace_period_policies
            )} in grace period`}
          />

          <MetricCard
            label="Total IDV"
            value={formatCurrency(data.summary.total_idv)}
            helper={`${formatNumber(
              data.total_policies
            )} policies in wallet`}
          />

          <MetricCard
            label="Total premium"
            value={formatCurrency(data.summary.total_premium)}
            helper={`${formatNumber(
              data.summary.pending_installments
            )} pending installments`}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <CompactMetric
            label="Pending endorsements"
            value={formatNumber(data.summary.pending_endorsements)}
          />

          <CompactMetric
            label="Overdue installments"
            value={formatNumber(data.summary.overdue_installments)}
          />

          <CompactMetric
            label="Unsigned policies"
            value={formatNumber(data.summary.unsigned_policies)}
          />

          <CompactMetric
            label="Missing documents"
            value={formatNumber(data.summary.incomplete_documents)}
          />

          <CompactMetric
            label="Expired"
            value={formatNumber(data.summary.expired_policies)}
          />

          <CompactMetric
            label="Expiring soon"
            value={formatNumber(data.summary.expiring_soon)}
          />
        </section>

        {data.wallet.length ? (
          <section className="space-y-4">
            {data.wallet.map((item) => {
              const expanded =
                expandedPolicyId === item.policy.id;

              return (
                <PolicyCard
                  key={item.policy.id}
                  item={item}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedPolicyId(
                      expanded ? null : item.policy.id
                    )
                  }
                />
              );
            })}
          </section>
        ) : (
          <EmptyState
            title="No policies found"
            description="Your digital policy wallet does not contain any matching policies."
          />
        )}

        <footer className="pb-4 text-center text-xs text-slate-600">
          Last generated: {formatDateTime(data.generated_at)}
        </footer>
      </div>
    </main>
  );
}

function PolicyCard(props: {
  item: WalletPolicy;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { policy, health } = props.item;

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg shadow-black/10">
      <button
        type="button"
        onClick={props.onToggle}
        className="w-full p-5 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">
                {policy.policy_number}
              </h2>

              <StatusBadge value={policy.policy_status} />

              {health.is_expiring_soon ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  Expiring soon
                </span>
              ) : null}

              {health.is_in_grace_period ? (
                <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-xs font-semibold text-violet-100">
                  Grace period
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm text-slate-400">
              {policy.insurer_name || "Insurance provider"} ·{" "}
              {policy.vehicle_registration_number || "Vehicle number unavailable"}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              {policy.vehicle_make || ""}
              {policy.vehicle_model ? ` ${policy.vehicle_model}` : ""}
              {policy.vehicle_variant ? ` · ${policy.vehicle_variant}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              label="IDV"
              value={formatCurrency(policy.idv)}
            />

            <MiniStat
              label="Premium"
              value={formatCurrency(policy.total_premium)}
            />

            <MiniStat
              label="Expiry"
              value={formatDate(policy.policy_end_date)}
            />

            <MiniStat
              label="Days left"
              value={
                health.days_to_expiry < 0
                  ? "Expired"
                  : String(health.days_to_expiry)
              }
            />
          </div>
        </div>
      </button>

      {props.expanded ? (
        <div className="border-t border-white/10 p-5">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section>
              <SectionTitle
                title="Policy health"
                subtitle="Current status and action readiness."
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <HealthRow
                  label="Documents complete"
                  value={health.documents_complete}
                />

                <HealthRow
                  label="Signature complete"
                  value={health.signature_complete}
                />

                <HealthRow
                  label="Payment plan active"
                  value={health.payment_plan_active}
                />

                <HealthRow
                  label="Renewal due"
                  value={health.renewal_due}
                />

                <HealthCount
                  label="Pending installments"
                  value={health.pending_installments}
                />

                <HealthCount
                  label="Open endorsements"
                  value={health.open_endorsements}
                />
              </div>
            </section>

            <section>
              <SectionTitle
                title="Quick actions"
                subtitle="Available actions for this policy."
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {props.item.quick_actions.map((action) => (
                  <QuickActionButton
                    key={action.code}
                    action={action}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <DocumentsPanel
              documents={props.item.documents}
            />

            <EndorsementsPanel
              endorsements={props.item.endorsements}
            />

            <RenewalsPanel
              renewals={props.item.renewals}
            />

            <PaymentPlansPanel
              plans={props.item.payment_plans}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DocumentsPanel(props: {
  documents: PolicyDocument[];
}) {
  return (
    <Panel
      title="Policy documents"
      subtitle="Schedules, certificates, receipts and notices."
    >
      <div className="space-y-3">
        {props.documents.length ? (
          props.documents.slice(0, 8).map((document) => (
            <div
              key={document.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              <div>
                <p className="font-medium">
                  {document.document_title ||
                    formatLabel(document.document_type)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {document.document_number || "No document number"} · Version{" "}
                  {document.version_number}
                </p>
              </div>

              <StatusBadge value={document.document_status} />
            </div>
          ))
        ) : (
          <EmptyInline message="No policy documents found." />
        )}
      </div>
    </Panel>
  );
}

function EndorsementsPanel(props: {
  endorsements: Endorsement[];
}) {
  return (
    <Panel
      title="Endorsements"
      subtitle="Policy changes and approval history."
    >
      <div className="space-y-3">
        {props.endorsements.length ? (
          props.endorsements.slice(0, 8).map((endorsement) => (
            <div
              key={endorsement.id}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {formatLabel(endorsement.endorsement_type)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {endorsement.endorsement_reference ||
                      `Endorsement ${endorsement.id}`}
                  </p>
                </div>

                <StatusBadge value={endorsement.endorsement_status} />
              </div>

              {endorsement.premium_difference !== 0 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Premium adjustment:{" "}
                  {formatCurrency(endorsement.premium_difference)}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyInline message="No endorsements found." />
        )}
      </div>
    </Panel>
  );
}

function RenewalsPanel(props: {
  renewals: Renewal[];
}) {
  return (
    <Panel
      title="Renewals"
      subtitle="Renewal quotes, probability and due dates."
    >
      <div className="space-y-3">
        {props.renewals.length ? (
          props.renewals.slice(0, 8).map((renewal) => (
            <div
              key={renewal.id}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {renewal.renewal_reference ||
                      `Renewal ${renewal.id}`}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Due {formatDate(renewal.renewal_due_date)}
                  </p>
                </div>

                <StatusBadge value={renewal.renewal_status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                <span>
                  Premium{" "}
                  {formatCurrency(renewal.proposed_total_premium)}
                </span>

                <span>
                  Probability{" "}
                  {renewal.renewal_probability === null
                    ? "N/A"
                    : `${renewal.renewal_probability}%`}
                </span>
              </div>
            </div>
          ))
        ) : (
          <EmptyInline message="No renewal records found." />
        )}
      </div>
    </Panel>
  );
}

function PaymentPlansPanel(props: {
  plans: PaymentPlan[];
}) {
  return (
    <Panel
      title="Payment plans"
      subtitle="Installments, due dates and payment status."
    >
      <div className="space-y-3">
        {props.plans.length ? (
          props.plans.slice(0, 5).map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {formatLabel(plan.payment_plan_type)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {plan.installment_count} installments ·{" "}
                    {formatCurrency(plan.total_payable_amount)}
                  </p>
                </div>

                <StatusBadge value={plan.plan_status} />
              </div>

              <div className="mt-3 space-y-2">
                {plan.installments.slice(0, 4).map((installment) => (
                  <div
                    key={installment.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-500">
                      #{installment.installment_number} ·{" "}
                      {formatDate(installment.due_date)}
                    </span>

                    <span className="font-medium text-slate-300">
                      {formatCurrency(installment.installment_amount)} ·{" "}
                      {formatLabel(installment.installment_status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyInline message="No payment plans found." />
        )}
      </div>
    </Panel>
  );
}

function Panel(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
      <SectionTitle
        title={props.title}
        subtitle={props.subtitle}
      />

      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-black/10">
      <p className="text-sm font-medium text-slate-400">
        {props.label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {props.value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {props.helper}
      </p>
    </article>
  );
}

function CompactMetric(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {props.label}
      </p>

      <p className="mt-2 text-lg font-semibold">
        {props.value}
      </p>
    </article>
  );
}

function MiniStat(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-200">
        {props.value}
      </p>
    </div>
  );
}

function HealthRow(props: {
  label: string;
  value: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-400">
        {props.label}
      </span>

      <span
        className={
          props.value
            ? "text-sm font-semibold text-emerald-300"
            : "text-sm font-semibold text-amber-200"
        }
      >
        {props.value ? "Complete" : "Attention"}
      </span>
    </div>
  );
}

function HealthCount(props: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-400">
        {props.label}
      </span>

      <span className="font-semibold">
        {props.value}
      </span>
    </div>
  );
}

function QuickActionButton(props: {
  action: QuickAction;
}) {
  return (
    <button
      type="button"
      disabled={!props.action.enabled}
      title={props.action.reason}
      className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-left text-sm font-semibold transition hover:border-cyan-400/30 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {props.action.label}
    </button>
  );
}

function SectionTitle(props: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold">
        {props.title}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {props.subtitle}
      </p>
    </div>
  );
}

function StatusBadge(props: {
  value: string;
}) {
  const normalized = props.value.toLowerCase();

  const classes =
    [
      "active",
      "approved",
      "issued",
      "paid",
      "generated",
      "signed",
      "delivered",
      "completed",
      "renewed",
    ].includes(normalized)
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : [
            "cancelled",
            "failed",
            "rejected",
            "expired",
            "overdue",
          ].includes(normalized)
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : [
              "pending",
              "pending_approval",
              "due",
              "quote_generated",
              "payment_pending",
              "grace_period",
              "suspended",
            ].includes(normalized)
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}
    >
      {formatLabel(props.value)}
    </span>
  );
}

function EmptyInline(props: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
      {props.message}
    </div>
  );
}

function EmptyState(props: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 p-8 text-center">
      <h2 className="text-xl font-bold">
        {props.title}
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        {props.description}
      </p>
    </section>
  );
}

function ErrorCard(props: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6">
      <h2 className="text-xl font-bold text-rose-100">
        Unable to load Policy Wallet
      </h2>

      <p className="mt-2 text-sm text-rose-200/80">
        {props.message}
      </p>

      <button
        type="button"
        onClick={props.onRetry}
        className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
      >
        Try again
      </button>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-56 rounded-3xl bg-white/5" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 rounded-3xl bg-white/5"
            />
          ))}
        </div>

        <div className="h-72 rounded-3xl bg-white/5" />
        <div className="h-72 rounded-3xl bg-white/5" />
      </div>
    </main>
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
  return new Intl.NumberFormat("en-IN", {
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