"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type BiSnapshot = {
  id: number;
  snapshot_reference: string | null;
  snapshot_type: string;
  snapshot_status: string;
  period_start: string;
  period_end: string;
  total_policies: number;
  active_policies: number;
  expired_policies: number;
  total_claims: number;
  open_claims: number;
  settled_claims: number;
  rejected_claims: number;
  total_claimed_amount: number;
  total_assessed_amount: number;
  total_settled_amount: number;
  total_paid_amount: number;
  total_refunded_amount: number;
  average_claim_amount: number | null;
  average_settlement_amount: number | null;
  average_claim_cycle_hours: number | null;
  average_payment_cycle_hours: number | null;
  claim_frequency_rate: number | null;
  claim_settlement_rate: number | null;
  payment_success_rate: number | null;
  fraud_alert_rate: number | null;
  total_loss_review_rate: number | null;
  cashless_adoption_rate: number | null;
  high_risk_claims: number;
  duplicate_payment_alerts: number;
  reconciliation_mismatches: number;
  manual_review_cases: number;
  cashless_claim_count: number;
  reimbursement_claim_count: number;
  total_loss_claim_count: number;
  ai_summary: string | null;
  ai_opportunities: string[];
  ai_risks: string[];
  ai_recommendations: string[];
  generated_at: string;
};

type BiKpi = {
  id: number;
  kpi_code: string;
  kpi_name: string;
  kpi_category: string;
  current_value: number | null;
  previous_value: number | null;
  target_value: number | null;
  value_unit: string;
  change_value: number | null;
  change_percent: number | null;
  performance_status: string;
  trend_direction: string;
  severity: string;
  insight_text: string | null;
  recommended_action: string | null;
};

type BiDimension = {
  id: number;
  dimension_type: string;
  dimension_key: string;
  dimension_label: string;
  record_count: number;
  total_amount: number;
  average_amount: number | null;
  success_rate: number | null;
  risk_rate: number | null;
  rank_position: number | null;
};

type BiAlert = {
  id: number;
  alert_reference: string | null;
  alert_type: string;
  alert_category: string;
  alert_status: string;
  severity: string;
  title: string;
  description: string;
  detected_value: number | null;
  expected_value: number | null;
  threshold_value: number | null;
  variance_percent: number | null;
  recommended_action: string | null;
  detected_at: string;
};

type BiInsight = {
  id: number;
  insight_reference: string | null;
  insight_type: string;
  insight_category: string;
  priority: string;
  title: string;
  summary: string;
  detailed_explanation: string | null;
  confidence: number | null;
  requires_human_review: boolean;
  status: string;
  created_at: string;
};

type BiReportRun = {
  id: number;
  run_reference: string | null;
  run_status: string;
  report_format: string;
  period_start: string | null;
  period_end: string | null;
  report_summary: string | null;
  file_path: string | null;
  requested_at: string;
  completed_at: string | null;
};

type AnalyticsResponse = {
  success: boolean;
  generated_at: string;
  snapshot: BiSnapshot | null;
  kpis: BiKpi[];
  dimensions: BiDimension[];
  alerts: BiAlert[];
  ai_insights: BiInsight[];
  recent_reports: BiReportRun[];
};

type Filters = {
  startDate: string;
  endDate: string;
};

export default function InsuranceAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(() => {
    const today = new Date();
    const start = new Date(today.getTime() - 29 * 86400000);

    return {
      startDate: toInputDate(start),
      endDate: toInputDate(today),
    };
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("start_date", filters.startDate);
    params.set("end_date", filters.endDate);
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
          throw new Error("Please sign in again to view insurance analytics.");
        }

        const response = await fetch(
          `/api/insurance/analytics/dashboard?${queryString}`,
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
            result?.error || "Unable to load the insurance BI dashboard."
          );
        }

        setData(result as AnalyticsResponse);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the insurance BI dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queryString]
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
            message={error || "Insurance analytics are unavailable."}
            onRetry={() => void loadDashboard("initial")}
          />
        </div>
      </main>
    );
  }

  const snapshot = data.snapshot;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/50 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">
                Mira Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Insurance Analytics & BI Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Executive visibility into policies, claims, settlements,
                payments, fraud risks, operational performance and AI insights.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard("refresh")}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh analytics"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <DateField
              label="Start date"
              value={filters.startDate}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  startDate: value,
                }))
              }
            />

            <DateField
              label="End date"
              value={filters.endDate}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  endDate: value,
                }))
              }
            />
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        {!snapshot ? (
          <EmptyState
            title="No BI snapshot found"
            description="Generate an analytics snapshot first, then refresh this dashboard."
          />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total claims"
                value={formatNumber(snapshot.total_claims)}
                helper={`${formatNumber(snapshot.open_claims)} open · ${formatNumber(
                  snapshot.settled_claims
                )} settled`}
              />
              <MetricCard
                label="Total paid"
                value={formatCurrency(snapshot.total_paid_amount)}
                helper={`${formatPercent(
                  snapshot.payment_success_rate
                )} payment success`}
              />
              <MetricCard
                label="Settlement rate"
                value={formatPercent(snapshot.claim_settlement_rate)}
                helper={`${formatNumber(
                  snapshot.manual_review_cases
                )} manual reviews`}
              />
              <MetricCard
                label="High-risk claims"
                value={formatNumber(snapshot.high_risk_claims)}
                helper={`${formatPercent(snapshot.fraud_alert_rate)} fraud alert rate`}
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <CompactMetric
                label="Policies"
                value={formatNumber(snapshot.total_policies)}
              />
              <CompactMetric
                label="Active"
                value={formatNumber(snapshot.active_policies)}
              />
              <CompactMetric
                label="Claimed"
                value={formatCurrency(snapshot.total_claimed_amount)}
              />
              <CompactMetric
                label="Settled"
                value={formatCurrency(snapshot.total_settled_amount)}
              />
              <CompactMetric
                label="Refunded"
                value={formatCurrency(snapshot.total_refunded_amount)}
              />
              <CompactMetric
                label="Cashless adoption"
                value={formatPercent(snapshot.cashless_adoption_rate)}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <SectionTitle
                  title="Mira executive summary"
                  subtitle={`Snapshot ${snapshot.snapshot_reference || snapshot.id} · ${formatDate(
                    snapshot.period_start
                  )} to ${formatDate(snapshot.period_end)}`}
                />

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {snapshot.ai_summary ||
                    "No AI summary has been generated for this snapshot yet."}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <InsightList
                    title="Opportunities"
                    items={snapshot.ai_opportunities}
                    emptyMessage="No opportunities recorded."
                  />
                  <InsightList
                    title="Risks"
                    items={snapshot.ai_risks}
                    emptyMessage="No risks recorded."
                  />
                  <InsightList
                    title="Recommendations"
                    items={snapshot.ai_recommendations}
                    emptyMessage="No recommendations recorded."
                  />
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <SectionTitle
                  title="Operational health"
                  subtitle="Core exception and workflow indicators."
                />

                <div className="mt-4 space-y-3">
                  <OperationsRow
                    label="Duplicate payment alerts"
                    value={snapshot.duplicate_payment_alerts}
                  />
                  <OperationsRow
                    label="Reconciliation mismatches"
                    value={snapshot.reconciliation_mismatches}
                  />
                  <OperationsRow
                    label="Manual review cases"
                    value={snapshot.manual_review_cases}
                  />
                  <OperationsRow
                    label="Total-loss reviews"
                    value={formatPercent(snapshot.total_loss_review_rate)}
                  />
                  <OperationsRow
                    label="Claim cycle"
                    value={formatHours(snapshot.average_claim_cycle_hours)}
                  />
                  <OperationsRow
                    label="Payment cycle"
                    value={formatHours(snapshot.average_payment_cycle_hours)}
                  />
                </div>
              </article>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <SectionTitle
                title="Executive KPIs"
                subtitle="Current value, movement and performance status."
              />

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.kpis.length ? (
                  data.kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)
                ) : (
                  <EmptyInline message="No KPI records found for this snapshot." />
                )}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <DimensionPanel
                title="Top garages"
                items={filterDimensions(data.dimensions, "garage")}
              />
              <DimensionPanel
                title="Top cities"
                items={filterDimensions(data.dimensions, "city")}
              />
              <DimensionPanel
                title="Vehicle insights"
                items={filterDimensions(data.dimensions, "vehicle")}
              />
              <DimensionPanel
                title="Surveyor performance"
                items={filterDimensions(data.dimensions, "surveyor")}
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <SectionTitle
                title="BI alerts"
                subtitle="Anomalies and executive issues requiring attention."
              />

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.alerts.length ? (
                  data.alerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                ) : (
                  <EmptyInline message="No active BI alerts found." />
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <SectionTitle
                title="Mira AI insights"
                subtitle="Prioritized opportunities, risks and recommended actions."
              />

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.ai_insights.length ? (
                  data.ai_insights.map((insight) => (
                    <AiInsightCard key={insight.id} insight={insight} />
                  ))
                ) : (
                  <EmptyInline message="No AI insights have been generated yet." />
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <SectionTitle
                title="Recent reports"
                subtitle="Latest dashboard, PDF, Excel and CSV report runs."
              />

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 font-semibold">Reference</th>
                      <th className="px-3 py-3 font-semibold">Format</th>
                      <th className="px-3 py-3 font-semibold">Period</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_reports.length ? (
                      data.recent_reports.map((report) => (
                        <ReportRow key={report.id} report={report} />
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-10 text-center text-slate-500"
                        >
                          No report runs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer className="pb-4 text-center text-xs text-slate-600">
          Last generated: {formatDateTime(data.generated_at)}
        </footer>
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
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-black/10">
      <p className="text-sm font-medium text-slate-400">{props.label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {props.value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{props.helper}</p>
    </article>
  );
}

function CompactMetric(props: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <p className="mt-2 text-lg font-semibold">{props.value}</p>
    </article>
  );
}

function SectionTitle(props: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{props.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
    </div>
  );
}

function InsightList(props: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <div className="mt-3 space-y-2">
        {props.items?.length ? (
          props.items.slice(0, 5).map((item, index) => (
            <p key={`${item}-${index}`} className="text-xs leading-5 text-slate-400">
              • {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-slate-600">{props.emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

function OperationsRow(props: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-400">{props.label}</span>
      <span className="font-semibold">{props.value}</span>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: BiKpi }) {
  const tone =
    kpi.performance_status === "critical"
      ? "border-rose-400/30 bg-rose-400/10"
      : kpi.performance_status === "warning"
        ? "border-amber-400/30 bg-amber-400/10"
        : kpi.performance_status === "excellent"
          ? "border-emerald-400/30 bg-emerald-400/10"
          : "border-white/10 bg-slate-950/60";

  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {formatLabel(kpi.kpi_category)}
          </p>
          <h3 className="mt-1 font-semibold">{kpi.kpi_name}</h3>
        </div>
        <StatusBadge value={kpi.performance_status} />
      </div>

      <p className="mt-4 text-2xl font-bold">
        {formatKpiValue(kpi.current_value, kpi.value_unit)}
      </p>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{formatLabel(kpi.trend_direction)}</span>
        {kpi.change_percent !== null ? (
          <span>{formatSignedPercent(kpi.change_percent)}</span>
        ) : null}
        {kpi.target_value !== null ? (
          <span>Target {formatKpiValue(kpi.target_value, kpi.value_unit)}</span>
        ) : null}
      </div>

      {kpi.insight_text ? (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          {kpi.insight_text}
        </p>
      ) : null}
    </article>
  );
}

function DimensionPanel(props: {
  title: string;
  items: BiDimension[];
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <SectionTitle
        title={props.title}
        subtitle="Ranked by volume and value for the selected snapshot."
      />

      <div className="mt-4 space-y-3">
        {props.items.length ? (
          props.items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3"
            >
              <div>
                <p className="font-medium">{item.dimension_label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatNumber(item.record_count)} records
                  {item.success_rate !== null
                    ? ` · ${formatPercent(item.success_rate)} success`
                    : ""}
                </p>
              </div>

              <div className="text-right">
                <p className="font-semibold">{formatCurrency(item.total_amount)}</p>
                {item.rank_position !== null ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Rank #{item.rank_position}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyInline message={`No ${props.title.toLowerCase()} data found.`} />
        )}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: BiAlert }) {
  const tone =
    alert.severity === "critical" || alert.severity === "high"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : alert.severity === "medium"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";

  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-70">
            {formatLabel(alert.alert_category)}
          </p>
          <h3 className="mt-1 font-semibold">{alert.title}</h3>
        </div>
        <StatusBadge value={alert.severity} />
      </div>

      <p className="mt-3 text-xs leading-5 opacity-80">{alert.description}</p>

      {alert.recommended_action ? (
        <p className="mt-3 text-xs font-medium">
          Action: {alert.recommended_action}
        </p>
      ) : null}
    </article>
  );
}

function AiInsightCard({ insight }: { insight: BiInsight }) {
  return (
    <article className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-violet-300">
            {formatLabel(insight.insight_category)}
          </p>
          <h3 className="mt-1 font-semibold">{insight.title}</h3>
        </div>
        <StatusBadge value={insight.priority} />
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">{insight.summary}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span>{formatLabel(insight.status)}</span>
        {insight.confidence !== null ? (
          <span>{insight.confidence}% confidence</span>
        ) : null}
        {insight.requires_human_review ? <span>Human review required</span> : null}
      </div>
    </article>
  );
}

function ReportRow({ report }: { report: BiReportRun }) {
  return (
    <tr className="border-b border-white/5 text-slate-300 transition hover:bg-white/[0.03]">
      <td className="whitespace-nowrap px-3 py-4 font-medium text-white">
        {report.run_reference || `Report ${report.id}`}
      </td>
      <td className="whitespace-nowrap px-3 py-4">
        {formatLabel(report.report_format)}
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-slate-500">
        {report.period_start && report.period_end
          ? `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`
          : "Not available"}
      </td>
      <td className="whitespace-nowrap px-3 py-4">
        <StatusBadge value={report.run_status} />
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-slate-500">
        {formatDateTime(report.requested_at)}
      </td>
    </tr>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();

  const classes =
    ["excellent", "good", "completed", "generated", "resolved"].includes(
      normalized
    )
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : ["critical", "high", "failed", "open"].includes(normalized)
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : ["warning", "medium", "reviewing", "queued", "running"].includes(
              normalized
            )
          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}
    >
      {formatLabel(value)}
    </span>
  );
}

function DateField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {props.label}
      </span>
      <input
        type="date"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/50"
      />
    </label>
  );
}

function EmptyInline({ message }: { message: string }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 p-8 text-center">
      <h2 className="text-xl font-bold">{props.title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        {props.description}
      </p>
    </section>
  );
}

function ErrorCard(props: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6">
      <h2 className="text-xl font-bold text-rose-100">
        Unable to load Insurance Analytics
      </h2>
      <p className="mt-2 text-sm text-rose-200/80">{props.message}</p>
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
            <div key={index} className="h-32 rounded-3xl bg-white/5" />
          ))}
        </div>
        <div className="h-80 rounded-3xl bg-white/5" />
        <div className="h-96 rounded-3xl bg-white/5" />
      </div>
    </main>
  );
}

function filterDimensions(items: BiDimension[], type: string) {
  return items
    .filter((item) => item.dimension_type.toLowerCase().includes(type))
    .sort((a, b) => (a.rank_position ?? 999) - (b.rank_position ?? 999));
}

function formatKpiValue(value: number | null, unit: string) {
  if (value === null) return "Not available";

  if (unit === "currency") return formatCurrency(value);
  if (unit === "percentage") return formatPercent(value);
  if (unit === "hours") return `${value.toFixed(1)} hours`;
  if (unit === "days") return `${value.toFixed(1)} days`;
  if (unit === "ratio") return value.toFixed(2);

  return formatNumber(value);
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return `${Number(value).toFixed(1)}%`;
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatHours(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not available";
  return `${value.toFixed(1)} hours`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}