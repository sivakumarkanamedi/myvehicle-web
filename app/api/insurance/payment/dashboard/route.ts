import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type PaymentDashboardQuery = {
  start_date?: string | null;
  end_date?: string | null;
  claim_id?: number | null;
  payment_status?: string | null;
  payment_type?: string | null;
  beneficiary_type?: string | null;
  limit?: number | null;
};

type ResolvedPaymentDashboardQuery = {
  start_date: string;
  end_date: string;
  claim_id: number | null;
  payment_status: string | null;
  payment_type: string | null;
  beneficiary_type: string | null;
  limit: number;
};

type PaymentInstructionRow = {
  id: number;
  user_id: string;
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
  gateway_payment_id: string | null;
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

type PaymentRefundRow = {
  id: number;
  payment_instruction_id: number;
  refund_reference: string | null;
  refund_amount: number;
  refund_status: string;
  refund_reason: string;
  requested_at: string;
  completed_at: string | null;
  created_at: string;
};

type PaymentAuditRow = {
  id: number;
  payment_instruction_id: number | null;
  action_type: string;
  action_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type SettlementReviewRow = {
  id: number;
  claim_id: number;
  review_status: string;
  payment_status: string;
  recommended_insurer_payable: number | null;
  final_insurer_approved_amount: number | null;
  payment_initiated_at: string | null;
  payment_completed_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const environment = readEnvironment();

    if ("error" in environment) {
      return NextResponse.json(
        { error: environment.error },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to view the payment dashboard." },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    const authClient = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid or expired." },
        { status: 401 }
      );
    }

    const filters = parseFilters(request.nextUrl.searchParams);

    const adminClient = createClient(
      environment.supabaseUrl,
      environment.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const payments = await loadPayments({
      adminClient: adminClient as any,
      userId: user.id,
      filters,
    });

    const paymentIds = payments.map((payment) => payment.id);

    const [
      refunds,
      audits,
      settlements,
    ] = await Promise.all([
      loadRefunds(
        adminClient as any,
        user.id,
        paymentIds,
        filters
      ),
      loadAuditEvents(
        adminClient as any,
        user.id,
        paymentIds,
        filters
      ),
      loadSettlementReviews(
        adminClient as any,
        user.id,
        filters
      ),
    ]);

    const dashboard = buildDashboard({
      payments,
      refunds,
      audits,
      settlements,
      filters,
    });

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      filters,
      ...dashboard,
    });
  } catch (error) {
    console.error("Payment dashboard error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the payment dashboard.",
      },
      { status: 500 }
    );
  }
}

async function loadPayments(args: {
  adminClient: any;
  userId: string;
  filters: ResolvedPaymentDashboardQuery;
}) {
  let query = args.adminClient
    .from("insurance_payment_instructions")
    .select("*")
    .eq("user_id", args.userId)
    .gte("created_at", `${args.filters.start_date}T00:00:00.000Z`)
    .lte("created_at", `${args.filters.end_date}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  if (args.filters.claim_id) {
    query = query.eq("claim_id", args.filters.claim_id);
  }

  if (args.filters.payment_status) {
    query = query.eq(
      "payment_status",
      args.filters.payment_status
    );
  }

  if (args.filters.payment_type) {
    query = query.eq(
      "payment_type",
      args.filters.payment_type
    );
  }

  if (args.filters.beneficiary_type) {
    query = query.eq(
      "beneficiary_type",
      args.filters.beneficiary_type
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PaymentInstructionRow[];
}

async function loadRefunds(
  adminClient: any,
  userId: string,
  paymentIds: number[],
  filters: ResolvedPaymentDashboardQuery
) {
  if (!paymentIds.length) {
    return [] as PaymentRefundRow[];
  }

  const { data, error } = await adminClient
    .from("insurance_payment_refunds")
    .select("*")
    .eq("user_id", userId)
    .in("payment_instruction_id", paymentIds)
    .gte("created_at", `${filters.start_date}T00:00:00.000Z`)
    .lte("created_at", `${filters.end_date}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PaymentRefundRow[];
}

async function loadAuditEvents(
  adminClient: any,
  userId: string,
  paymentIds: number[],
  filters: ResolvedPaymentDashboardQuery
) {
  if (!paymentIds.length) {
    return [] as PaymentAuditRow[];
  }

  const { data, error } = await adminClient
    .from("insurance_payment_audit_log")
    .select("*")
    .eq("user_id", userId)
    .in("payment_instruction_id", paymentIds)
    .gte("created_at", `${filters.start_date}T00:00:00.000Z`)
    .lte("created_at", `${filters.end_date}T23:59:59.999Z`)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PaymentAuditRow[];
}

async function loadSettlementReviews(
  adminClient: any,
  userId: string,
  filters: ResolvedPaymentDashboardQuery
) {
  let query = adminClient
    .from("insurance_settlement_reviews")
    .select(
      `
        id,
        claim_id,
        review_status,
        payment_status,
        recommended_insurer_payable,
        final_insurer_approved_amount,
        payment_initiated_at,
        payment_completed_at,
        created_at
      `
    )
    .eq("user_id", userId)
    .gte("created_at", `${filters.start_date}T00:00:00.000Z`)
    .lte("created_at", `${filters.end_date}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  if (filters.claim_id) {
    query = query.eq("claim_id", filters.claim_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SettlementReviewRow[];
}

function buildDashboard(args: {
  payments: PaymentInstructionRow[];
  refunds: PaymentRefundRow[];
  audits: PaymentAuditRow[];
  settlements: SettlementReviewRow[];
  filters: ResolvedPaymentDashboardQuery;
}) {
  const {
    payments,
    refunds,
    audits,
    settlements,
    filters,
  } = args;

  const totalGrossAmount = sum(
    payments.map((payment) => payment.gross_amount)
  );

  const totalDeductionAmount = sum(
    payments.map((payment) => payment.deduction_amount)
  );

  const totalNetPayable = sum(
    payments.map((payment) => payment.net_payable_amount)
  );

  const totalPaidAmount = sum(
    payments
      .filter((payment) => payment.payment_status === "paid")
      .map((payment) => payment.net_payable_amount)
  );

  const totalPendingAmount = sum(
    payments
      .filter((payment) =>
        [
          "draft",
          "validation_pending",
          "approval_pending",
          "approved",
          "scheduled",
          "initiated",
          "processing",
          "retry_scheduled",
        ].includes(payment.payment_status)
      )
      .map((payment) => payment.net_payable_amount)
  );

  const totalFailedAmount = sum(
    payments
      .filter((payment) => payment.payment_status === "failed")
      .map((payment) => payment.net_payable_amount)
  );

  const totalRefundedAmount = sum(
    refunds
      .filter((refund) => refund.refund_status === "completed")
      .map((refund) => refund.refund_amount)
  );

  const completedPayments = payments.filter(
    (payment) => payment.payment_status === "paid"
  );

  const attemptedPayments = payments.filter(
    (payment) =>
      ![
        "draft",
        "validation_pending",
        "validation_failed",
        "approval_pending",
      ].includes(payment.payment_status)
  );

  const paymentSuccessRate = attemptedPayments.length
    ? round(
        (completedPayments.length / attemptedPayments.length) * 100,
        2
      )
    : 0;

  const duplicateWarnings = payments.filter((payment) =>
    [
      "possible_duplicate",
      "confirmed_duplicate",
      "manual_review_required",
    ].includes(payment.duplicate_check_status)
  );

  const validationWarnings = payments.filter((payment) =>
    [
      "failed",
      "manual_review_required",
    ].includes(payment.validation_status)
  );

  const approvalPending = payments.filter(
    (payment) =>
      payment.approval_status === "pending" ||
      payment.payment_status === "approval_pending"
  );

  const retryScheduled = payments.filter(
    (payment) =>
      payment.payment_status === "retry_scheduled"
  );

  const reconciliationMismatches = audits.filter((audit) =>
    [
      "payment_reconciled",
      "payment_webhook_amount_mismatch",
    ].includes(audit.action_type) &&
    [
      "mismatch",
      "manual_review_required",
    ].includes(String(audit.action_status))
  );

  const averageSettlementToPaymentHours =
    calculateAverageSettlementToPaymentHours(settlements);

  const cashlessPayments = payments.filter(
    (payment) =>
      payment.payment_type === "cashless_garage" ||
      payment.beneficiary_type === "garage"
  );

  const reimbursementPayments = payments.filter(
    (payment) =>
      payment.payment_type === "customer_reimbursement" ||
      payment.beneficiary_type === "customer"
  );

  const paymentStatusBreakdown =
    groupPaymentsByStatus(payments);

  const paymentTypeBreakdown =
    groupPaymentsByType(payments);

  const beneficiaryBreakdown =
    groupPaymentsByBeneficiary(payments);

  const paymentModeBreakdown =
    groupPaymentsByMode(payments);

  const dailyTrend = buildDailyTrend(
    payments,
    refunds,
    filters.start_date,
    filters.end_date
  );

  const recentTransactions = payments
    .slice(0, filters.limit)
    .map(toRecentTransaction);

  const recentRefunds = refunds
    .slice(0, filters.limit)
    .map((refund) => ({
      id: refund.id,
      payment_instruction_id:
        refund.payment_instruction_id,
      refund_reference: refund.refund_reference,
      refund_amount: refund.refund_amount,
      refund_status: refund.refund_status,
      refund_reason: refund.refund_reason,
      requested_at: refund.requested_at,
      completed_at: refund.completed_at,
    }));

  const alerts = buildAlerts({
    duplicateWarnings,
    validationWarnings,
    approvalPending,
    retryScheduled,
    reconciliationMismatches,
    failedPayments: payments.filter(
      (payment) => payment.payment_status === "failed"
    ),
  });

  return {
    summary: {
      payment_count: payments.length,
      settlement_count: settlements.length,
      refund_count: refunds.length,

      total_gross_amount: round(totalGrossAmount, 2),
      total_deduction_amount: round(totalDeductionAmount, 2),
      total_net_payable: round(totalNetPayable, 2),
      total_paid_amount: round(totalPaidAmount, 2),
      total_pending_amount: round(totalPendingAmount, 2),
      total_failed_amount: round(totalFailedAmount, 2),
      total_refunded_amount: round(totalRefundedAmount, 2),

      payment_success_rate: paymentSuccessRate,
      average_settlement_to_payment_hours:
        averageSettlementToPaymentHours,

      cashless_payment_count: cashlessPayments.length,
      cashless_payment_amount: round(
        sum(
          cashlessPayments.map(
            (payment) => payment.net_payable_amount
          )
        ),
        2
      ),

      reimbursement_payment_count:
        reimbursementPayments.length,
      reimbursement_payment_amount: round(
        sum(
          reimbursementPayments.map(
            (payment) => payment.net_payable_amount
          )
        ),
        2
      ),

      duplicate_warning_count: duplicateWarnings.length,
      validation_warning_count: validationWarnings.length,
      approval_pending_count: approvalPending.length,
      retry_scheduled_count: retryScheduled.length,
      reconciliation_mismatch_count:
        reconciliationMismatches.length,
    },

    breakdowns: {
      by_payment_status: paymentStatusBreakdown,
      by_payment_type: paymentTypeBreakdown,
      by_beneficiary_type: beneficiaryBreakdown,
      by_payment_mode: paymentModeBreakdown,
    },

    trends: {
      daily: dailyTrend,
    },

    alerts,
    recent_transactions: recentTransactions,
    recent_refunds: recentRefunds,
  };
}

function groupPaymentsByStatus(
  payments: PaymentInstructionRow[]
) {
  return groupPayments(
    payments,
    (payment) => payment.payment_status
  );
}

function groupPaymentsByType(
  payments: PaymentInstructionRow[]
) {
  return groupPayments(
    payments,
    (payment) => payment.payment_type
  );
}

function groupPaymentsByBeneficiary(
  payments: PaymentInstructionRow[]
) {
  return groupPayments(
    payments,
    (payment) => payment.beneficiary_type
  );
}

function groupPaymentsByMode(
  payments: PaymentInstructionRow[]
) {
  return groupPayments(
    payments,
    (payment) => payment.payment_mode
  );
}

function groupPayments(
  payments: PaymentInstructionRow[],
  keySelector: (payment: PaymentInstructionRow) => string
) {
  const grouped = new Map<
    string,
    {
      key: string;
      count: number;
      gross_amount: number;
      net_payable_amount: number;
      paid_amount: number;
    }
  >();

  for (const payment of payments) {
    const key = keySelector(payment) || "unknown";

    const current = grouped.get(key) ?? {
      key,
      count: 0,
      gross_amount: 0,
      net_payable_amount: 0,
      paid_amount: 0,
    };

    current.count += 1;
    current.gross_amount += numberOrZero(
      payment.gross_amount
    );
    current.net_payable_amount += numberOrZero(
      payment.net_payable_amount
    );

    if (payment.payment_status === "paid") {
      current.paid_amount += numberOrZero(
        payment.net_payable_amount
      );
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      gross_amount: round(item.gross_amount, 2),
      net_payable_amount: round(
        item.net_payable_amount,
        2
      ),
      paid_amount: round(item.paid_amount, 2),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildDailyTrend(
  payments: PaymentInstructionRow[],
  refunds: PaymentRefundRow[],
  startDate: string,
  endDate: string
) {
  const days = enumerateDates(startDate, endDate);

  const result = new Map<
    string,
    {
      date: string;
      created_count: number;
      created_amount: number;
      paid_count: number;
      paid_amount: number;
      failed_count: number;
      failed_amount: number;
      refund_count: number;
      refunded_amount: number;
    }
  >();

  for (const day of days) {
    result.set(day, {
      date: day,
      created_count: 0,
      created_amount: 0,
      paid_count: 0,
      paid_amount: 0,
      failed_count: 0,
      failed_amount: 0,
      refund_count: 0,
      refunded_amount: 0,
    });
  }

  for (const payment of payments) {
    const createdDay = toDateKey(payment.created_at);
    const createdEntry = result.get(createdDay);

    if (createdEntry) {
      createdEntry.created_count += 1;
      createdEntry.created_amount += numberOrZero(
        payment.net_payable_amount
      );
    }

    if (
      payment.payment_status === "paid" &&
      payment.payment_completed_at
    ) {
      const paidDay = toDateKey(
        payment.payment_completed_at
      );

      const paidEntry = result.get(paidDay);

      if (paidEntry) {
        paidEntry.paid_count += 1;
        paidEntry.paid_amount += numberOrZero(
          payment.net_payable_amount
        );
      }
    }

    if (
      payment.payment_status === "failed" &&
      payment.payment_failed_at
    ) {
      const failedDay = toDateKey(
        payment.payment_failed_at
      );

      const failedEntry = result.get(failedDay);

      if (failedEntry) {
        failedEntry.failed_count += 1;
        failedEntry.failed_amount += numberOrZero(
          payment.net_payable_amount
        );
      }
    }
  }

  for (const refund of refunds) {
    const refundDay = toDateKey(
      refund.completed_at ?? refund.created_at
    );

    const entry = result.get(refundDay);

    if (entry) {
      entry.refund_count += 1;

      if (refund.refund_status === "completed") {
        entry.refunded_amount += numberOrZero(
          refund.refund_amount
        );
      }
    }
  }

  return Array.from(result.values()).map((entry) => ({
    ...entry,
    created_amount: round(entry.created_amount, 2),
    paid_amount: round(entry.paid_amount, 2),
    failed_amount: round(entry.failed_amount, 2),
    refunded_amount: round(entry.refunded_amount, 2),
  }));
}

function calculateAverageSettlementToPaymentHours(
  settlements: SettlementReviewRow[]
) {
  const durations = settlements
    .filter(
      (settlement) =>
        settlement.payment_initiated_at &&
        settlement.payment_completed_at
    )
    .map((settlement) => {
      const start = new Date(
        settlement.payment_initiated_at as string
      ).getTime();

      const end = new Date(
        settlement.payment_completed_at as string
      ).getTime();

      return (end - start) / 3600000;
    })
    .filter(
      (duration) =>
        Number.isFinite(duration) &&
        duration >= 0
    );

  if (!durations.length) {
    return null;
  }

  return round(
    durations.reduce(
      (sumValue, duration) =>
        sumValue + duration,
      0
    ) / durations.length,
    2
  );
}

function buildAlerts(args: {
  duplicateWarnings: PaymentInstructionRow[];
  validationWarnings: PaymentInstructionRow[];
  approvalPending: PaymentInstructionRow[];
  retryScheduled: PaymentInstructionRow[];
  reconciliationMismatches: PaymentAuditRow[];
  failedPayments: PaymentInstructionRow[];
}) {
  const alerts: Array<{
    code: string;
    severity: "info" | "warning" | "high";
    title: string;
    description: string;
    count: number;
  }> = [];

  if (args.duplicateWarnings.length) {
    alerts.push({
      code: "duplicate_payment_warning",
      severity: "high",
      title: "Duplicate-payment review required",
      description:
        "One or more payments have possible or confirmed duplicate indicators.",
      count: args.duplicateWarnings.length,
    });
  }

  if (args.reconciliationMismatches.length) {
    alerts.push({
      code: "reconciliation_mismatch",
      severity: "high",
      title: "Reconciliation mismatch",
      description:
        "Provider and internal payment records require manual reconciliation.",
      count: args.reconciliationMismatches.length,
    });
  }

  if (args.validationWarnings.length) {
    alerts.push({
      code: "payment_validation_issue",
      severity: "warning",
      title: "Payment validation issue",
      description:
        "Some payment instructions failed validation or require manual review.",
      count: args.validationWarnings.length,
    });
  }

  if (args.failedPayments.length) {
    alerts.push({
      code: "payment_failure",
      severity: "warning",
      title: "Failed payments",
      description:
        "Some payments failed and may require retry or manual action.",
      count: args.failedPayments.length,
    });
  }

  if (args.retryScheduled.length) {
    alerts.push({
      code: "retry_scheduled",
      severity: "info",
      title: "Payment retries scheduled",
      description:
        "Temporary failures are waiting for another processing attempt.",
      count: args.retryScheduled.length,
    });
  }

  if (args.approvalPending.length) {
    alerts.push({
      code: "approval_pending",
      severity: "info",
      title: "Payments awaiting approval",
      description:
        "Authorized approval is required before processing.",
      count: args.approvalPending.length,
    });
  }

  return alerts;
}

function toRecentTransaction(
  payment: PaymentInstructionRow
) {
  return {
    id: payment.id,
    claim_id: payment.claim_id,
    settlement_review_id:
      payment.settlement_review_id,
    payment_reference:
      payment.payment_reference,
    payment_type: payment.payment_type,
    payment_mode: payment.payment_mode,
    payment_status: payment.payment_status,
    beneficiary_type:
      payment.beneficiary_type,
    beneficiary_name:
      payment.beneficiary_name,
    gross_amount: payment.gross_amount,
    deduction_amount:
      payment.deduction_amount,
    net_payable_amount:
      payment.net_payable_amount,
    currency_code: payment.currency_code,
    duplicate_check_status:
      payment.duplicate_check_status,
    validation_status:
      payment.validation_status,
    approval_status:
      payment.approval_status,
    gateway_provider:
      payment.gateway_provider,
    bank_transaction_reference:
      payment.bank_transaction_reference,
    utr_number: payment.utr_number,
    retry_count: payment.retry_count,
    max_retry_count:
      payment.max_retry_count,
    payment_initiated_at:
      payment.payment_initiated_at,
    payment_completed_at:
      payment.payment_completed_at,
    payment_failed_at:
      payment.payment_failed_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

function parseFilters(
  searchParams: URLSearchParams
): ResolvedPaymentDashboardQuery {
  const today = new Date();
  const defaultStart = new Date(
    today.getTime() - 29 * 86400000
  );

  const startDate =
    normalizeDate(searchParams.get("start_date")) ??
    toDateKey(defaultStart.toISOString());

  const endDate =
    normalizeDate(searchParams.get("end_date")) ??
    toDateKey(today.toISOString());

  if (
    new Date(startDate).getTime() >
    new Date(endDate).getTime()
  ) {
    throw new Error(
      "start_date cannot be after end_date."
    );
  }

  const rangeDays =
    Math.floor(
      (new Date(endDate).getTime() -
        new Date(startDate).getTime()) /
        86400000
    ) + 1;

  if (rangeDays > 366) {
    throw new Error(
      "Dashboard date range cannot exceed 366 days."
    );
  }

  return {
    start_date: startDate,
    end_date: endDate,
    claim_id: positiveInteger(
      searchParams.get("claim_id")
    ),
    payment_status: cleanFilter(
      searchParams.get("payment_status")
    ),
    payment_type: cleanFilter(
      searchParams.get("payment_type")
    ),
    beneficiary_type: cleanFilter(
      searchParams.get("beneficiary_type")
    ),
    limit: clampInteger(
      searchParams.get("limit"),
      1,
      100,
      20
    ),
  };
}

function normalizeDate(value: unknown) {
  if (!value) return null;

  const raw = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(
      "Dates must use YYYY-MM-DD format."
    );
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Date is invalid.");
  }

  return raw;
}

function cleanFilter(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "");

  return cleaned || null;
}

function positiveInteger(value: unknown) {
  const numeric = Number(value);

  return Number.isInteger(numeric) &&
    numeric > 0
    ? numeric
    : null;
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, numeric)
  );
}

function numberOrZero(
  value: number | string | null | undefined
) {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function sum(
  values: Array<number | string | null | undefined>
): number {
  return values.reduce<number>(
    (total, value) =>
      total + numberOrZero(value),
    0
  );
}

function round(
  value: number | null | undefined,
  decimals: number
) {
  const factor = 10 ** decimals;
  const safeValue = value ?? 0;

  return Math.round(safeValue * factor) / factor;
}

function toDateKey(
  value: string | null | undefined
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function enumerateDates(
  startDate: string,
  endDate: string
) {
  const dates: string[] = [];

  const current = new Date(
    `${startDate}T00:00:00.000Z`
  );

  const end = new Date(
    `${endDate}T00:00:00.000Z`
  );

  while (current.getTime() <= end.getTime()) {
    dates.push(
      current.toISOString().slice(0, 10)
    );

    current.setUTCDate(
      current.getUTCDate() + 1
    );
  }

  return dates;
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
    }
  | { error: string } {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey
  ) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
        "SUPABASE_SERVICE_ROLE_KEY are required.",
    };
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
  };
}