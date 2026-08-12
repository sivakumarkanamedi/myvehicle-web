"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";

type DashboardSummary = {
  payment_count: number;
  settlement_count: number;
  refund_count: number;
  total_gross_amount: number;
  total_deduction_amount: number;
  total_net_payable: number;
  total_paid_amount: number;
  total_pending_amount: number;
  total_failed_amount: number;
  total_refunded_amount: number;
  payment_success_rate: number;
  average_settlement_to_payment_hours: number | null;
  cashless_payment_count: number;
  cashless_payment_amount: number;
  reimbursement_payment_count: number;
  reimbursement_payment_amount: number;
  duplicate_warning_count: number;
  validation_warning_count: number;
  approval_pending_count: number;
  retry_scheduled_count: number;
  reconciliation_mismatch_count: number;
};

type BreakdownItem = {
  key: string;
  count: number;
  gross_amount: number;
  net_payable_amount: number;
  paid_amount: number;
};

type DailyTrendItem = {
  date: string;
  created_count: number;
  created_amount: number;
  paid_count: number;
  paid_amount: number;
  failed_count: number;
  failed_amount: number;
  refund_count: number;
  refunded_amount: number;
};

type DashboardAlert = {
  code: string;
  severity: "info" | "warning" | "high";
  title: string;
  description: string;
  count: number;
};

type RecentTransaction = {
  id: number;
  claim_id: number;
  settlement_review_id: number;
  payment_reference: string | null;
  payment_type: string;
  payment_mode: string;
  payment_status: string;
  beneficiary_type: string;
  beneficiary_name: string | null;
  gross_amount: number;
  deduction_amount: number;
  net_payable_amount: number;
  currency_code: string;
  duplicate_check_status: string;
  validation_status: string;
  approval_status: string;
  gateway_provider: string | null;
  bank_transaction_reference: string | null;
  utr_number: string | null;
  retry_count: number;
  max_retry_count: number;
  payment_initiated_at: string | null;
  payment_completed_at: string | null;
  payment_failed_at: string | null;
  created_at: string;
  updated_at: string;
};

type RecentRefund = {
  id: number;
  payment_instruction_id: number;
  refund_reference: string | null;
  refund_amount: number;
  refund_status: string;
  refund_reason: string;
  requested_at: string;
  completed_at: string | null;
};

type PaymentDashboardResponse = {
  success: boolean;
  generated_at: string;
  filters: {
    start_date: string;
    end_date: string;
    claim_id: number | null;
    payment_status: string | null;
    payment_type: string | null;
    beneficiary_type: string | null;
    limit: number;
  };
  summary: DashboardSummary;
  breakdowns: {
    by_payment_status: BreakdownItem[];
    by_payment_type: BreakdownItem[];
    by_beneficiary_type: BreakdownItem[];
    by_payment_mode: BreakdownItem[];
  };
  trends: {
    daily: DailyTrendItem[];
  };
  alerts: DashboardAlert[];
  recent_transactions: RecentTransaction[];
  recent_refunds: RecentRefund[];
};

type Filters = {
  startDate: string;
  endDate: string;
  paymentStatus: string;
  paymentType: string;
  beneficiaryType: string;
  claimId: string;
};

const STATUS_OPTIONS = [
  "",
  "draft",
  "validation_pending",
  "validation_failed",
  "approval_pending",
  "approved",
  "scheduled",
  "initiated",
  "processing",
  "retry_scheduled",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
];

const TYPE_OPTIONS = [
  "",
  "cashless_garage",
  "customer_reimbursement",
  "split_settlement",
  "total_loss_settlement",
  "salvage_adjusted_settlement",
  "partial_payment",
  "supplementary_payment",
];

const BENEFICIARY_OPTIONS = [
  "",
  "customer",
  "garage",
  "lender",
  "salvage_buyer",
  "insurer",
  "multiple",
];

export default function PaymentCommandCenter() {
  const [data, setData] = useState<PaymentDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<Filters>(() => {
    const today = new Date();
    const start = new Date(today.getTime() - 29 * 86400000);

    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(today),
      paymentStatus: "",
      paymentType: "",
      beneficiaryType: "",
      claimId: "",
    };
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("start_date", filters.startDate);
    params.set("end_date", filters.endDate);
    params.set("limit", "25");

    if (filters.paymentStatus) {
      params.set("payment_status", filters.paymentStatus);
    }

    if (filters.paymentType) {
      params.set("payment_type", filters.paymentType);
    }

    if (filters.beneficiaryType) {
      params.set("beneficiary_type", filters.beneficiaryType);
    }

    if (filters.claimId.trim()) {
      params.set("claim_id", filters.claimId.trim());
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
          throw new Error("Please sign in again to view payment analytics.");
        }

        const response = await fetch(
          `/api/insurance/payment/dashboard?${queryString}`,
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
            result?.error || "Unable to load payment dashboard."
          );
        }

        setData(result as PaymentDashboardResponse);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load payment dashboard."
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
      <section className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ErrorCard
            message={error || "Payment dashboard data is unavailable."}
            onRetry={() => void loadDashboard("initial")}
          />
        </div>
      </section>
    );
  }

  const summary = data.summary;

  return (
    <section className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                My Vehicle Insurance
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Payment Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Monitor claim payments, settlement readiness, failures,
                refunds, duplicate-payment risks, reconciliation issues and
                recent finance activity in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard("refresh")}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh dashboard"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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

            <SelectField
              label="Payment status"
              value={filters.paymentStatus}
              options={STATUS_OPTIONS}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  paymentStatus: value,
                }))
              }
            />

            <SelectField
              label="Payment type"
              value={filters.paymentType}
              options={TYPE_OPTIONS}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  paymentType: value,
                }))
              }
            />

            <SelectField
              label="Beneficiary"
              value={filters.beneficiaryType}
              options={BENEFICIARY_OPTIONS}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  beneficiaryType: value,
                }))
              }
            />

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Claim ID
              </span>
              <input
                type="number"
                min="1"
                value={filters.claimId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    claimId: event.target.value,
                  }))
                }
                placeholder="All claims"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </label>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total paid"
            value={formatCurrency(summary.total_paid_amount)}
            helper={`${summary.payment_count} payment instructions`}
          />
          <MetricCard
            label="Pending"
            value={formatCurrency(summary.total_pending_amount)}
            helper={`${summary.approval_pending_count} awaiting approval`}
          />
          <MetricCard
            label="Success rate"
            value={`${summary.payment_success_rate.toFixed(1)}%`}
            helper="Across attempted payments"
          />
          <MetricCard
            label="Refunded"
            value={formatCurrency(summary.total_refunded_amount)}
            helper={`${summary.refund_count} refund records`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <CompactMetric
            label="Gross amount"
            value={formatCurrency(summary.total_gross_amount)}
          />
          <CompactMetric
            label="Deductions"
            value={formatCurrency(summary.total_deduction_amount)}
          />
          <CompactMetric
            label="Net payable"
            value={formatCurrency(summary.total_net_payable)}
          />
          <CompactMetric
            label="Failed"
            value={formatCurrency(summary.total_failed_amount)}
          />
          <CompactMetric
            label="Cashless"
            value={formatCurrency(summary.cashless_payment_amount)}
          />
          <CompactMetric
            label="Reimbursement"
            value={formatCurrency(summary.reimbursement_payment_amount)}
          />
        </div>

        {data.alerts.length ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <SectionTitle
              title="Action center"
              subtitle="Items that may need finance or claims-team attention."
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.alerts.map((alert) => (
                <AlertCard key={alert.code} alert={alert} />
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <SectionTitle
              title="Payment status breakdown"
              subtitle="Count and value by current payment stage."
            />

            <div className="mt-4 space-y-3">
              {data.breakdowns.by_payment_status.length ? (
                data.breakdowns.by_payment_status.map((item) => (
                  <BreakdownRow key={item.key} item={item} />
                ))
              ) : (
                <EmptyState message="No payment-status data found." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <SectionTitle
              title="Operations summary"
              subtitle="Current control and exception counts."
            />

            <div className="mt-4 space-y-3">
              <OperationsRow
                label="Duplicate warnings"
                value={summary.duplicate_warning_count}
              />
              <OperationsRow
                label="Validation warnings"
                value={summary.validation_warning_count}
              />
              <OperationsRow
                label="Approval pending"
                value={summary.approval_pending_count}
              />
              <OperationsRow
                label="Retry scheduled"
                value={summary.retry_scheduled_count}
              />
              <OperationsRow
                label="Reconciliation mismatches"
                value={summary.reconciliation_mismatch_count}
              />
              <OperationsRow
                label="Average payment time"
                value={
                  summary.average_settlement_to_payment_hours === null
                    ? "Not available"
                    : `${summary.average_settlement_to_payment_hours.toFixed(
                        1
                      )} hours`
                }
              />
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <SectionTitle
            title="Daily trend"
            subtitle="Created, paid, failed and refunded payment values."
          />

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[780px]">
              <TrendChart items={data.trends.daily} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <SectionTitle
            title="Recent transactions"
            subtitle="Latest payment activity for the selected filters."
          />

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-semibold">Reference</th>
                  <th className="px-3 py-3 font-semibold">Beneficiary</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Validation</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>

              <tbody>
                {data.recent_transactions.length ? (
                  data.recent_transactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      No transactions found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <BreakdownPanel
            title="Payment types"
            items={data.breakdowns.by_payment_type}
          />

          <BreakdownPanel
            title="Beneficiaries"
            items={data.breakdowns.by_beneficiary_type}
          />
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <SectionTitle
            title="Recent refunds"
            subtitle="Latest full or partial refund records."
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.recent_refunds.length ? (
              data.recent_refunds.map((refund) => (
                <RefundCard key={refund.id} refund={refund} />
              ))
            ) : (
              <EmptyState message="No refunds found for this period." />
            )}
          </div>
        </section>

        <footer className="pb-4 text-center text-xs text-slate-600">
          Last generated: {formatDateTime(data.generated_at)}
        </footer>
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
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-black/10">
      <p className="text-sm font-medium text-slate-400">{props.label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {props.value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{props.helper}</p>
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
      <p className="mt-2 text-lg font-semibold">{props.value}</p>
    </article>
  );
}

function SectionTitle(props: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold">{props.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: DashboardAlert }) {
  const classes =
    alert.severity === "high"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : alert.severity === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";

  return (
    <article className={`rounded-2xl border p-4 ${classes}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{alert.title}</h3>
          <p className="mt-1 text-xs leading-5 opacity-80">
            {alert.description}
          </p>
        </div>

        <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-bold">
          {alert.count}
        </span>
      </div>
    </article>
  );
}

function BreakdownRow({ item }: { item: BreakdownItem }) {
  const progress =
    item.net_payable_amount > 0
      ? Math.min(
          100,
          (item.paid_amount / item.net_payable_amount) * 100
        )
      : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold capitalize">
            {formatLabel(item.key)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {item.count} payments · {formatCurrency(item.net_payable_amount)}
          </p>
        </div>

        <p className="text-sm font-semibold text-emerald-300">
          Paid {formatCurrency(item.paid_amount)}
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function OperationsRow(props: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="text-sm text-slate-400">{props.label}</span>
      <span className="font-semibold">{props.value}</span>
    </div>
  );
}

function TrendChart({ items }: { items: DailyTrendItem[] }) {
  const visibleItems = items.slice(-30);

  const maximum = Math.max(
    1,
    ...visibleItems.map((item) =>
      Math.max(
        item.created_amount,
        item.paid_amount,
        item.failed_amount,
        item.refunded_amount
      )
    )
  );

  return (
    <div>
      <div className="flex h-72 items-end gap-2 border-b border-l border-white/10 px-3 pb-3">
        {visibleItems.map((item) => {
          const createdHeight = (item.created_amount / maximum) * 100;
          const paidHeight = (item.paid_amount / maximum) * 100;
          const failedHeight = (item.failed_amount / maximum) * 100;
          const refundedHeight = (item.refunded_amount / maximum) * 100;

          return (
            <div
              key={item.date}
              className="flex min-w-0 flex-1 items-end justify-center gap-0.5"
              title={`${item.date}
Created: ${formatCurrency(item.created_amount)}
Paid: ${formatCurrency(item.paid_amount)}
Failed: ${formatCurrency(item.failed_amount)}
Refunded: ${formatCurrency(item.refunded_amount)}`}
            >
              <div
                className="w-1/4 rounded-t bg-slate-500"
                style={{ height: `${createdHeight}%` }}
              />
              <div
                className="w-1/4 rounded-t bg-emerald-400"
                style={{ height: `${paidHeight}%` }}
              />
              <div
                className="w-1/4 rounded-t bg-rose-400"
                style={{ height: `${failedHeight}%` }}
              />
              <div
                className="w-1/4 rounded-t bg-amber-300"
                style={{ height: `${refundedHeight}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
        <Legend label="Created" className="bg-slate-500" />
        <Legend label="Paid" className="bg-emerald-400" />
        <Legend label="Failed" className="bg-rose-400" />
        <Legend label="Refunded" className="bg-amber-300" />
      </div>
    </div>
  );
}

function Legend(props: {
  label: string;
  className: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${props.className}`} />
      {props.label}
    </span>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: RecentTransaction;
}) {
  return (
    <tr className="border-b border-white/5 text-slate-300 transition hover:bg-white/[0.03]">
      <td className="whitespace-nowrap px-3 py-4">
        <p className="font-medium text-white">
          {transaction.payment_reference || `Payment ${transaction.id}`}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Claim {transaction.claim_id}
        </p>
      </td>

      <td className="whitespace-nowrap px-3 py-4">
        <p>{transaction.beneficiary_name || "Not available"}</p>
        <p className="mt-1 text-xs capitalize text-slate-600">
          {formatLabel(transaction.beneficiary_type)}
        </p>
      </td>

      <td className="whitespace-nowrap px-3 py-4 capitalize">
        {formatLabel(transaction.payment_type)}
      </td>

      <td className="whitespace-nowrap px-3 py-4 font-semibold text-white">
        {formatCurrency(transaction.net_payable_amount)}
      </td>

      <td className="whitespace-nowrap px-3 py-4">
        <StatusBadge value={transaction.payment_status} />
      </td>

      <td className="whitespace-nowrap px-3 py-4">
        <StatusBadge value={transaction.validation_status} />
      </td>

      <td className="whitespace-nowrap px-3 py-4 text-slate-500">
        {formatDateTime(transaction.created_at)}
      </td>
    </tr>
  );
}

function BreakdownPanel(props: {
  title: string;
  items: BreakdownItem[];
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <SectionTitle
        title={props.title}
        subtitle="Count and amount across the selected period."
      />

      <div className="mt-4 space-y-3">
        {props.items.length ? (
          props.items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3"
            >
              <div>
                <p className="font-medium capitalize">
                  {formatLabel(item.key)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.count} transactions
                </p>
              </div>

              <p className="font-semibold">
                {formatCurrency(item.net_payable_amount)}
              </p>
            </div>
          ))
        ) : (
          <EmptyState message="No breakdown data found." />
        )}
      </div>
    </section>
  );
}

function RefundCard({ refund }: { refund: RecentRefund }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {refund.refund_reference || `Refund ${refund.id}`}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {refund.refund_reason}
          </p>
        </div>

        <StatusBadge value={refund.refund_status} />
      </div>

      <p className="mt-4 text-xl font-bold">
        {formatCurrency(refund.refund_amount)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Requested {formatDateTime(refund.requested_at)}
      </p>
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();

  const classes =
    normalized === "paid" ||
    normalized === "passed" ||
    normalized === "approved" ||
    normalized === "completed"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : normalized === "failed" ||
          normalized === "cancelled" ||
          normalized === "confirmed_duplicate"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : normalized.includes("pending") ||
            normalized.includes("review") ||
            normalized === "retry_scheduled"
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
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
      >
        {props.options.map((option) => (
          <option key={option || "all"} value={option}>
            {option ? formatLabel(option) : "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ErrorCard(props: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6">
      <h2 className="text-xl font-bold text-rose-100">
        Unable to load Payment Command Center
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
    <section className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
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
    </section>
  );
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDateTime(value: string | null | undefined) {
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

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}