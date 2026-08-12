"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type DashboardSummary = {
  total_cases: number;
  pending_cases: number;
  approved_cases: number;
  declined_cases: number;
  high_risk_cases: number;
  fraud_attention_cases: number;
  inspection_pending: number;
  referral_pending: number;
  documents_incomplete: number;
  decision_overdue: number;
  average_risk_score: number;
  total_recommended_premium: number;
  approval_rate: number;
  decline_rate: number;
};

type UnderwritingCase = {
  id: number;
  case_reference: string | null;
  underwriting_status: string;
  decision_status: string;
  referral_status: string;
  applicant_name: string | null;
  applicant_type: string;
  vehicle_registration_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;
  vehicle_year: number | null;
  vehicle_fuel_type: string | null;
  vehicle_usage_type: string | null;
  requested_policy_type: string | null;
  requested_idv: number | null;
  requested_total_premium: number | null;
  claim_count: number;
  settled_claim_count: number;
  rejected_claim_count: number;
  fraud_alert_count: number;
  vehicle_age_years: number | null;
  overall_risk_score: number | null;
  overall_risk_band: string | null;
  inspection_required: boolean;
  inspection_status: string;
  documents_complete: boolean;
  kyc_status: string;
  rc_validation_status: string;
  licence_validation_status: string;
  recommended_idv: number | null;
  recommended_total_premium: number | null;
  recommended_ncb_percent: number | null;
  recommended_deductible: number | null;
  premium_loading_percent: number;
  premium_discount_percent: number;
  ai_summary: string | null;
  ai_risk_reasons: string[];
  ai_recommendations: string[];
  ai_confidence: number | null;
  submitted_at: string | null;
  assessed_at: string | null;
  decided_at: string | null;
  created_at: string;
};

type Referral = {
  id: number;
  referral_reference: string | null;
  referral_type: string;
  referral_status: string;
  referral_priority: string;
  assigned_to_name: string | null;
  assigned_to_role: string | null;
  requested_at: string;
  reviewed_at: string | null;
  review_decision: string | null;
};

type Inspection = {
  id: number;
  inspection_reference: string | null;
  inspection_status: string;
  inspection_result: string | null;
  inspection_score: number | null;
  existing_damage_detected: boolean;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type Decision = {
  id: number;
  decision_reference: string | null;
  decision_type: string;
  decision_status: string;
  approved_idv: number | null;
  approved_total_premium: number | null;
  approved_ncb_percent: number | null;
  approved_deductible: number | null;
  human_override: boolean;
  decided_by_name: string | null;
  decided_by_role: string | null;
  decided_at: string;
};

type DashboardCase = {
  case: UnderwritingCase;
  latest_referral: Referral | null;
  latest_inspection: Inspection | null;
  latest_decision: Decision | null;
  flags: {
    high_risk: boolean;
    fraud_attention: boolean;
    inspection_pending: boolean;
    referral_pending: boolean;
    documents_incomplete: boolean;
    decision_overdue: boolean;
  };
};

type DashboardResponse = {
  success: boolean;
  generated_at: string;
  summary: DashboardSummary;
  cases: DashboardCase[];
};

type Filters = {
  search: string;
  status: string;
  riskBand: string;
  referralStatus: string;
  inspectionStatus: string;
  dateFrom: string;
  dateTo: string;
};

export default function UnderwritingDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "",
    riskBand: "",
    referralStatus: "",
    inspectionStatus: "",
    dateFrom: "",
    dateTo: "",
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");

    if (filters.search.trim()) {
      params.set("search", filters.search.trim());
    }

    if (filters.status) {
      params.set("status", filters.status);
    }

    if (filters.riskBand) {
      params.set("risk_band", filters.riskBand);
    }

    if (filters.referralStatus) {
      params.set("referral_status", filters.referralStatus);
    }

    if (filters.inspectionStatus) {
      params.set("inspection_status", filters.inspectionStatus);
    }

    if (filters.dateFrom) {
      params.set("date_from", filters.dateFrom);
    }

    if (filters.dateTo) {
      params.set("date_to", filters.dateTo);
    }

    return params.toString();
  }, [filters]);

  const loadDashboard = useCallback(
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
            "Please sign in again to view underwriting operations."
          );
        }

        const response = await fetch(
          `/api/insurance/underwriting/dashboard?${queryString}`,
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
            result?.error || "Unable to load underwriting dashboard."
          );
        }

        setData(result as DashboardResponse);

        if (
          !expandedCaseId &&
          Array.isArray(result?.cases) &&
          result.cases.length
        ) {
          setExpandedCaseId(result.cases[0].case.id);
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load underwriting dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queryString, expandedCaseId]
  );

  useEffect(() => {
    void loadDashboard("initial");
  }, [loadDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ErrorCard
            message={error || "Underwriting data is unavailable."}
            onRetry={() => void loadDashboard("initial")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-300">
                My Vehicle Insurance
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                AI Underwriting Command Center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Review risk, inspections, referrals, AI recommendations and
                underwriting decisions from one operational dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard("refresh")}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-400/10 px-5 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh dashboard"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total cases"
            value={formatNumber(data.summary.total_cases)}
            helper={`${formatNumber(data.summary.pending_cases)} pending`}
          />

          <MetricCard
            label="Approval rate"
            value={`${data.summary.approval_rate.toFixed(1)}%`}
            helper={`${formatNumber(data.summary.approved_cases)} approved`}
          />

          <MetricCard
            label="Average risk"
            value={`${data.summary.average_risk_score.toFixed(1)}/100`}
            helper={`${formatNumber(data.summary.high_risk_cases)} high risk`}
          />

          <MetricCard
            label="Recommended premium"
            value={formatCurrency(data.summary.total_recommended_premium)}
            helper={`${formatNumber(data.summary.declined_cases)} declined`}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <CompactMetric
            label="Fraud attention"
            value={formatNumber(data.summary.fraud_attention_cases)}
          />

          <CompactMetric
            label="Inspection pending"
            value={formatNumber(data.summary.inspection_pending)}
          />

          <CompactMetric
            label="Referral pending"
            value={formatNumber(data.summary.referral_pending)}
          />

          <CompactMetric
            label="Documents incomplete"
            value={formatNumber(data.summary.documents_incomplete)}
          />

          <CompactMetric
            label="Decision overdue"
            value={formatNumber(data.summary.decision_overdue)}
          />

          <CompactMetric
            label="Decline rate"
            value={`${data.summary.decline_rate.toFixed(1)}%`}
          />
        </section>

        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onReset={() =>
            setFilters({
              search: "",
              status: "",
              riskBand: "",
              referralStatus: "",
              inspectionStatus: "",
              dateFrom: "",
              dateTo: "",
            })
          }
        />

        {data.cases.length ? (
          <section className="space-y-4">
            {data.cases.map((item) => {
              const expanded =
                expandedCaseId === item.case.id;

              return (
                <UnderwritingCaseCard
                  key={item.case.id}
                  item={item}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedCaseId(
                      expanded ? null : item.case.id
                    )
                  }
                />
              );
            })}
          </section>
        ) : (
          <EmptyState
            title="No underwriting cases found"
            description="No cases match the selected filters."
          />
        )}

        <footer className="pb-4 text-center text-xs text-slate-600">
          Last generated: {formatDateTime(data.generated_at)}
        </footer>
      </div>
    </main>
  );
}

function FilterPanel(props: {
  filters: Filters;
  onChange: React.Dispatch<React.SetStateAction<Filters>>;
  onReset: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </span>

          <input
            type="text"
            value={props.filters.search}
            onChange={(event) =>
              props.onChange((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Case, applicant, vehicle..."
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-indigo-400/50"
          />
        </label>

        <FilterSelect
          label="Status"
          value={props.filters.status}
          onChange={(value) =>
            props.onChange((current) => ({
              ...current,
              status: value,
            }))
          }
          options={[
            ["", "All statuses"],
            ["pending", "Pending"],
            ["assessing", "Assessing"],
            ["inspection_pending", "Inspection pending"],
            ["referred", "Referred"],
            ["approved", "Approved"],
            ["approved_with_conditions", "Approved with conditions"],
            ["declined", "Declined"],
          ]}
        />

        <FilterSelect
          label="Risk band"
          value={props.filters.riskBand}
          onChange={(value) =>
            props.onChange((current) => ({
              ...current,
              riskBand: value,
            }))
          }
          options={[
            ["", "All risk bands"],
            ["very_low", "Very low"],
            ["low", "Low"],
            ["medium", "Medium"],
            ["high", "High"],
            ["very_high", "Very high"],
            ["decline", "Decline"],
          ]}
        />

        <FilterSelect
          label="Referral"
          value={props.filters.referralStatus}
          onChange={(value) =>
            props.onChange((current) => ({
              ...current,
              referralStatus: value,
            }))
          }
          options={[
            ["", "All referrals"],
            ["pending", "Pending"],
            ["assigned", "Assigned"],
            ["reviewing", "Reviewing"],
            ["approved", "Approved"],
            ["declined", "Declined"],
          ]}
        />

        <button
          type="button"
          onClick={props.onReset}
          className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="min-w-48">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </span>

      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-indigo-400/50"
      >
        {props.options.map(([value, label]) => (
          <option key={value || "all"} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UnderwritingCaseCard(props: {
  item: DashboardCase;
  expanded: boolean;
  onToggle: () => void;
}) {
  const underwritingCase = props.item.case;

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg shadow-black/10">
      <button
        type="button"
        onClick={props.onToggle}
        className="w-full p-5 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">
                {underwritingCase.case_reference ||
                  `Underwriting Case ${underwritingCase.id}`}
              </h2>

              <StatusBadge value={underwritingCase.underwriting_status} />
              <RiskBadge value={underwritingCase.overall_risk_band} />
            </div>

            <p className="mt-2 text-sm text-slate-400">
              {underwritingCase.applicant_name || "Applicant unavailable"} ·{" "}
              {underwritingCase.vehicle_registration_number ||
                "Vehicle number unavailable"}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              {underwritingCase.vehicle_make || ""}
              {underwritingCase.vehicle_model
                ? ` ${underwritingCase.vehicle_model}`
                : ""}
              {underwritingCase.vehicle_variant
                ? ` · ${underwritingCase.vehicle_variant}`
                : ""}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {props.item.flags.fraud_attention ? (
                <FlagBadge label="Fraud attention" tone="danger" />
              ) : null}

              {props.item.flags.inspection_pending ? (
                <FlagBadge label="Inspection pending" tone="warning" />
              ) : null}

              {props.item.flags.referral_pending ? (
                <FlagBadge label="Referral pending" tone="warning" />
              ) : null}

              {props.item.flags.documents_incomplete ? (
                <FlagBadge label="Documents incomplete" tone="neutral" />
              ) : null}

              {props.item.flags.decision_overdue ? (
                <FlagBadge label="Decision overdue" tone="danger" />
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              label="Risk score"
              value={`${underwritingCase.overall_risk_score ?? 0}/100`}
            />

            <MiniStat
              label="Recommended IDV"
              value={formatCurrency(underwritingCase.recommended_idv)}
            />

            <MiniStat
              label="Premium"
              value={formatCurrency(
                underwritingCase.recommended_total_premium
              )}
            />

            <MiniStat
              label="AI confidence"
              value={`${underwritingCase.ai_confidence ?? 0}%`}
            />
          </div>
        </div>
      </button>

      {props.expanded ? (
        <div className="border-t border-white/10 p-5">
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              title="AI assessment"
              subtitle="Risk summary and recommended actions."
            >
              <p className="text-sm leading-6 text-slate-300">
                {underwritingCase.ai_summary ||
                  "No AI summary is available."}
              </p>

              <div className="mt-4 space-y-3">
                <ListBlock
                  title="Risk reasons"
                  items={underwritingCase.ai_risk_reasons}
                />

                <ListBlock
                  title="Recommendations"
                  items={underwritingCase.ai_recommendations}
                />
              </div>
            </Panel>

            <Panel
              title="Risk and pricing"
              subtitle="Underwriting scores and recommended terms."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Risk band"
                  value={formatLabel(
                    underwritingCase.overall_risk_band || "unknown"
                  )}
                />

                <DetailRow
                  label="Claims"
                  value={String(underwritingCase.claim_count)}
                />

                <DetailRow
                  label="Fraud alerts"
                  value={String(underwritingCase.fraud_alert_count)}
                />

                <DetailRow
                  label="Vehicle age"
                  value={
                    underwritingCase.vehicle_age_years === null
                      ? "Unknown"
                      : `${underwritingCase.vehicle_age_years} years`
                  }
                />

                <DetailRow
                  label="NCB"
                  value={`${underwritingCase.recommended_ncb_percent ?? 0}%`}
                />

                <DetailRow
                  label="Deductible"
                  value={formatCurrency(
                    underwritingCase.recommended_deductible
                  )}
                />

                <DetailRow
                  label="Premium loading"
                  value={`${underwritingCase.premium_loading_percent}%`}
                />

                <DetailRow
                  label="Premium discount"
                  value={`${underwritingCase.premium_discount_percent}%`}
                />
              </div>
            </Panel>

            <ReferralPanel referral={props.item.latest_referral} />
            <InspectionPanel inspection={props.item.latest_inspection} />
            <DecisionPanel decision={props.item.latest_decision} />

            <Panel
              title="Validation"
              subtitle="Document and identity verification status."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <HealthRow
                  label="Documents complete"
                  value={underwritingCase.documents_complete}
                />

                <ValidationRow
                  label="KYC"
                  value={underwritingCase.kyc_status}
                />

                <ValidationRow
                  label="RC validation"
                  value={underwritingCase.rc_validation_status}
                />

                <ValidationRow
                  label="Licence validation"
                  value={underwritingCase.licence_validation_status}
                />
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ReferralPanel(props: {
  referral: Referral | null;
}) {
  return (
    <Panel
      title="Latest referral"
      subtitle="Manual underwriting review status."
    >
      {props.referral ? (
        <div className="space-y-3">
          <DetailRow
            label="Reference"
            value={
              props.referral.referral_reference ||
              `Referral ${props.referral.id}`
            }
          />

          <DetailRow
            label="Type"
            value={formatLabel(props.referral.referral_type)}
          />

          <DetailRow
            label="Priority"
            value={formatLabel(props.referral.referral_priority)}
          />

          <DetailRow
            label="Status"
            value={formatLabel(props.referral.referral_status)}
          />
        </div>
      ) : (
        <EmptyInline message="No referral found." />
      )}
    </Panel>
  );
}

function InspectionPanel(props: {
  inspection: Inspection | null;
}) {
  return (
    <Panel
      title="Latest inspection"
      subtitle="Vehicle inspection and damage review."
    >
      {props.inspection ? (
        <div className="space-y-3">
          <DetailRow
            label="Reference"
            value={
              props.inspection.inspection_reference ||
              `Inspection ${props.inspection.id}`
            }
          />

          <DetailRow
            label="Status"
            value={formatLabel(props.inspection.inspection_status)}
          />

          <DetailRow
            label="Result"
            value={formatLabel(
              props.inspection.inspection_result || "pending"
            )}
          />

          <DetailRow
            label="Score"
            value={`${props.inspection.inspection_score ?? 0}/100`}
          />
        </div>
      ) : (
        <EmptyInline message="No inspection found." />
      )}
    </Panel>
  );
}

function DecisionPanel(props: {
  decision: Decision | null;
}) {
  return (
    <Panel
      title="Latest decision"
      subtitle="Final or provisional underwriting decision."
    >
      {props.decision ? (
        <div className="space-y-3">
          <DetailRow
            label="Reference"
            value={
              props.decision.decision_reference ||
              `Decision ${props.decision.id}`
            }
          />

          <DetailRow
            label="Decision"
            value={formatLabel(props.decision.decision_type)}
          />

          <DetailRow
            label="Approved premium"
            value={formatCurrency(
              props.decision.approved_total_premium
            )}
          />

          <DetailRow
            label="Underwriter"
            value={props.decision.decided_by_name || "System"}
          />
        </div>
      ) : (
        <EmptyInline message="No decision found." />
      )}
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
      <div>
        <h3 className="text-lg font-bold">{props.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
      </div>

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

function DetailRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-500">
        {props.label}
      </span>

      <span className="text-right text-sm font-semibold text-slate-200">
        {props.value}
      </span>
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

function ValidationRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-400">
        {props.label}
      </span>

      <StatusBadge value={props.value} />
    </div>
  );
}

function ListBlock(props: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-sm font-semibold text-slate-300">
        {props.title}
      </p>

      {props.items?.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {props.items.map((item, index) => (
            <li key={`${item}-${index}`}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          No items available.
        </p>
      )}
    </div>
  );
}

function StatusBadge(props: {
  value: string;
}) {
  const normalized = props.value.toLowerCase();

  const classes =
    [
      "approved",
      "approved_with_conditions",
      "completed",
      "verified",
      "pass",
    ].includes(normalized)
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : ["declined", "rejected", "failed", "cancelled"].includes(
            normalized
          )
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : [
              "pending",
              "assessing",
              "inspection_pending",
              "referred",
              "reviewing",
              "manual_review",
            ].includes(normalized)
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(props.value)}
    </span>
  );
}

function RiskBadge(props: {
  value: string | null;
}) {
  const normalized = props.value || "unknown";

  const classes =
    ["very_low", "low"].includes(normalized)
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : normalized === "medium"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : ["high", "very_high", "decline"].includes(normalized)
          ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {formatLabel(normalized)} risk
    </span>
  );
}

function FlagBadge(props: {
  label: string;
  tone: "danger" | "warning" | "neutral";
}) {
  const classes =
    props.tone === "danger"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : props.tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {props.label}
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
        Unable to load Underwriting Dashboard
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

function DashboardSkeleton() {
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

        <div className="h-28 rounded-3xl bg-white/5" />
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