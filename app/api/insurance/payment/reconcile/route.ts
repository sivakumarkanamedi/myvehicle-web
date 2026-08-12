import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type ReconcilePaymentBody = {
  payment_instruction_id?: number;
  force_refresh?: boolean;
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
  net_payable_amount: number;
  currency_code: string;
  gateway_provider: string | null;
  gateway_payment_id: string | null;
  bank_transaction_reference: string | null;
  utr_number: string | null;
  payment_initiated_at: string | null;
  payment_completed_at: string | null;
  payment_failed_at: string | null;
};

type PaymentAttemptRow = {
  id: number;
  attempt_number: number;
  attempt_status: string;
  gateway_provider: string | null;
  gateway_payment_id: string | null;
  bank_transaction_reference: string | null;
  response_payload: Record<string, unknown> | null;
  failure_code: string | null;
  failure_reason: string | null;
  initiated_at: string;
  completed_at: string | null;
};

type ReconciliationResult = {
  reconciliation_status:
    | "matched"
    | "matched_with_warnings"
    | "pending"
    | "mismatch"
    | "manual_review_required";

  expected_status: string;
  observed_status: string;

  amount_match: boolean | null;
  currency_match: boolean | null;
  transaction_reference_match: boolean | null;
  utr_match: boolean | null;

  warnings: string[];
  errors: string[];

  reconciled_payment_status: string;
  should_update_payment: boolean;

  reconciliation_summary: string;
};

export async function POST(request: NextRequest) {
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
        { error: "You must be signed in to reconcile a payment." },
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

    const body = (await request.json()) as ReconcilePaymentBody;

    const paymentInstructionId = positiveInteger(
      body.payment_instruction_id
    );

    if (!paymentInstructionId) {
      return NextResponse.json(
        { error: "payment_instruction_id is required." },
        { status: 400 }
      );
    }

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

    const payment = await loadPaymentInstruction(
      adminClient as any,
      paymentInstructionId
    );

    if (!payment) {
      return NextResponse.json(
        { error: "Payment instruction was not found." },
        { status: 404 }
      );
    }

    if (payment.user_id !== user.id) {
      return NextResponse.json(
        { error: "You are not allowed to reconcile this payment." },
        { status: 403 }
      );
    }

    const attempts = await loadPaymentAttempts(
      adminClient as any,
      payment.id
    );

    const providerStatus = await fetchProviderStatus({
      payment,
      attempts,
      paymentExecutionMode: environment.paymentExecutionMode,
    });

    const reconciliation = reconcilePayment({
      payment,
      attempts,
      providerStatus,
    });

    await saveReconciliationAudit({
      adminClient: adminClient as any,
      payment,
      providerStatus,
      reconciliation,
      actorUserId: user.id,
    });

    if (reconciliation.should_update_payment) {
      await adminClient
        .from("insurance_payment_instructions")
        .update({
          payment_status:
            reconciliation.reconciled_payment_status,
          gateway_provider:
            providerStatus.provider ||
            payment.gateway_provider,
          gateway_payment_id:
            providerStatus.gatewayPaymentId ||
            payment.gateway_payment_id,
          bank_transaction_reference:
            providerStatus.bankTransactionReference ||
            payment.bank_transaction_reference,
          utr_number:
            providerStatus.utrNumber ||
            payment.utr_number,
          payment_completed_at:
            reconciliation.reconciled_payment_status === "paid"
              ? payment.payment_completed_at ||
                new Date().toISOString()
              : payment.payment_completed_at,
          payment_failed_at:
            reconciliation.reconciled_payment_status === "failed"
              ? payment.payment_failed_at ||
                new Date().toISOString()
              : payment.payment_failed_at,
          validation_status:
            reconciliation.reconciliation_status === "mismatch" ||
            reconciliation.reconciliation_status ===
              "manual_review_required"
              ? "manual_review_required"
              : "passed",
          validation_warnings: reconciliation.warnings,
          validation_errors: reconciliation.errors,
        })
        .eq("id", payment.id);
    }

    return NextResponse.json({
      success: true,
      payment_instruction_id: payment.id,
      payment_reference: payment.payment_reference,
      reconciliation,
      provider_status: providerStatus,
    });
  } catch (error) {
    console.error("Payment reconciliation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reconcile the payment.",
      },
      { status: 500 }
    );
  }
}

async function loadPaymentInstruction(
  adminClient: any,
  paymentInstructionId: number
) {
  const { data, error } = await adminClient
    .from("insurance_payment_instructions")
    .select("*")
    .eq("id", paymentInstructionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PaymentInstructionRow | null;
}

async function loadPaymentAttempts(
  adminClient: any,
  paymentInstructionId: number
) {
  const { data, error } = await adminClient
    .from("insurance_payment_attempts")
    .select("*")
    .eq("payment_instruction_id", paymentInstructionId)
    .order("attempt_number", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PaymentAttemptRow[];
}

async function fetchProviderStatus(args: {
  payment: PaymentInstructionRow;
  attempts: PaymentAttemptRow[];
  paymentExecutionMode: "sandbox" | "live";
}) {
  if (args.paymentExecutionMode === "sandbox") {
    return getSandboxProviderStatus(
      args.payment,
      args.attempts
    );
  }

  throw new Error(
    "Live reconciliation is not configured. " +
      "Connect an authorized bank or gateway status adapter first."
  );
}

function getSandboxProviderStatus(
  payment: PaymentInstructionRow,
  attempts: PaymentAttemptRow[]
) {
  const latestAttempt = attempts[0] ?? null;

  const observedStatus =
    payment.payment_status === "paid"
      ? "paid"
      : latestAttempt?.attempt_status === "succeeded"
        ? "paid"
        : latestAttempt?.attempt_status === "failed"
          ? "failed"
          : latestAttempt?.attempt_status === "processing"
            ? "processing"
            : payment.payment_status;

  return {
    provider:
      payment.gateway_provider ||
      latestAttempt?.gateway_provider ||
      "sandbox_reconciliation_adapter",

    gatewayPaymentId:
      payment.gateway_payment_id ||
      latestAttempt?.gateway_payment_id ||
      "",

    bankTransactionReference:
      payment.bank_transaction_reference ||
      latestAttempt?.bank_transaction_reference ||
      "",

    utrNumber: payment.utr_number || "",

    observedStatus,
    observedAmount: payment.net_payable_amount,
    observedCurrency: payment.currency_code,

    rawResponse: {
      sandbox: true,
      latest_attempt_number:
        latestAttempt?.attempt_number ?? null,
      latest_attempt_status:
        latestAttempt?.attempt_status ?? null,
      reconciled_at: new Date().toISOString(),
    },
  };
}

function reconcilePayment(args: {
  payment: PaymentInstructionRow;
  attempts: PaymentAttemptRow[];
  providerStatus: ReturnType<
    typeof getSandboxProviderStatus
  >;
}): ReconciliationResult {
  const {
    payment,
    attempts,
    providerStatus,
  } = args;

  const warnings: string[] = [];
  const errors: string[] = [];

  const amountMatch =
    providerStatus.observedAmount === null ||
    providerStatus.observedAmount === undefined
      ? null
      : Math.abs(
          Number(providerStatus.observedAmount) -
            Number(payment.net_payable_amount)
        ) <= 0.01;

  const currencyMatch =
    providerStatus.observedCurrency
      ? providerStatus.observedCurrency ===
        payment.currency_code
      : null;

  const transactionReferenceMatch =
    payment.bank_transaction_reference &&
    providerStatus.bankTransactionReference
      ? payment.bank_transaction_reference ===
        providerStatus.bankTransactionReference
      : null;

  const utrMatch =
    payment.utr_number &&
    providerStatus.utrNumber
      ? payment.utr_number === providerStatus.utrNumber
      : null;

  if (amountMatch === false) {
    errors.push(
      "Provider amount does not match the internal net payable amount."
    );
  }

  if (currencyMatch === false) {
    errors.push(
      "Provider currency does not match the internal payment currency."
    );
  }

  if (transactionReferenceMatch === false) {
    warnings.push(
      "Bank transaction reference differs from the internal record."
    );
  }

  if (utrMatch === false) {
    warnings.push(
      "UTR number differs from the internal record."
    );
  }

  if (
    providerStatus.observedStatus === "paid" &&
    !providerStatus.bankTransactionReference
  ) {
    warnings.push(
      "Provider reports payment as paid but no transaction reference is available."
    );
  }

  if (
    providerStatus.observedStatus === "paid" &&
    !providerStatus.utrNumber &&
    ["bank_transfer", "neft", "rtgs", "imps"].includes(
      payment.payment_mode
    )
  ) {
    warnings.push(
      "Provider reports payment as paid but no UTR number is available."
    );
  }

  if (!attempts.length) {
    warnings.push(
      "No payment attempt record was found."
    );
  }

  const reconciledPaymentStatus =
    normalizeObservedStatus(
      providerStatus.observedStatus
    );

  const shouldUpdatePayment =
    reconciledPaymentStatus !==
      payment.payment_status &&
    errors.length === 0;

  let reconciliationStatus:
    ReconciliationResult["reconciliation_status"];

  if (errors.length) {
    reconciliationStatus = "mismatch";
  } else if (
    reconciledPaymentStatus === "processing" ||
    reconciledPaymentStatus === "initiated" ||
    reconciledPaymentStatus === "scheduled"
  ) {
    reconciliationStatus = "pending";
  } else if (warnings.length) {
    reconciliationStatus = "matched_with_warnings";
  } else if (
    reconciledPaymentStatus === "paid" ||
    reconciledPaymentStatus === "failed" ||
    reconciledPaymentStatus === "cancelled" ||
    reconciledPaymentStatus === "refunded" ||
    reconciledPaymentStatus ===
      "partially_refunded"
  ) {
    reconciliationStatus = "matched";
  } else {
    reconciliationStatus =
      "manual_review_required";
  }

  const summary =
    reconciliationStatus === "matched"
      ? "Internal payment data matches the provider status."
      : reconciliationStatus ===
          "matched_with_warnings"
        ? "Payment matched with warnings that require review."
        : reconciliationStatus === "pending"
          ? "Payment remains pending with the provider."
          : reconciliationStatus === "mismatch"
            ? "Payment reconciliation found material mismatches."
            : "Payment requires manual reconciliation review.";

  return {
    reconciliation_status: reconciliationStatus,
    expected_status: payment.payment_status,
    observed_status:
      providerStatus.observedStatus,
    amount_match: amountMatch,
    currency_match: currencyMatch,
    transaction_reference_match:
      transactionReferenceMatch,
    utr_match: utrMatch,
    warnings,
    errors,
    reconciled_payment_status:
      reconciledPaymentStatus,
    should_update_payment: shouldUpdatePayment,
    reconciliation_summary: summary,
  };
}

async function saveReconciliationAudit(args: {
  adminClient: any;
  payment: PaymentInstructionRow;
  providerStatus: ReturnType<
    typeof getSandboxProviderStatus
  >;
  reconciliation: ReconciliationResult;
  actorUserId: string;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_audit_log")
    .insert({
      user_id: args.payment.user_id,
      payment_instruction_id: args.payment.id,
      action_type: "payment_reconciled",
      action_status:
        args.reconciliation.reconciliation_status,
      actor_type: "authenticated_user",
      actor_reference: args.actorUserId,
      previous_values: {
        payment_status:
          args.payment.payment_status,
        bank_transaction_reference:
          args.payment.bank_transaction_reference,
        utr_number: args.payment.utr_number,
      },
      new_values: {
        observed_status:
          args.providerStatus.observedStatus,
        bank_transaction_reference:
          args.providerStatus.bankTransactionReference,
        utr_number:
          args.providerStatus.utrNumber,
        reconciliation_status:
          args.reconciliation.reconciliation_status,
      },
      metadata: {
        provider: args.providerStatus.provider,
        provider_payment_id:
          args.providerStatus.gatewayPaymentId,
        warnings: args.reconciliation.warnings,
        errors: args.reconciliation.errors,
        raw_provider_response:
          args.providerStatus.rawResponse,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeObservedStatus(value: unknown) {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  if (
    [
      "paid",
      "failed",
      "cancelled",
      "refunded",
      "partially_refunded",
      "processing",
      "initiated",
      "scheduled",
    ].includes(status)
  ) {
    return status;
  }

  if (
    status === "success" ||
    status === "succeeded" ||
    status === "completed"
  ) {
    return "paid";
  }

  if (
    status === "pending" ||
    status === "submitted"
  ) {
    return "processing";
  }

  return "manual_review";
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
      paymentExecutionMode: "sandbox" | "live";
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
    paymentExecutionMode:
      process.env.PAYMENT_EXECUTION_MODE === "live"
        ? "live"
        : "sandbox",
  };
}

function positiveInteger(value: unknown) {
  const numeric = Number(value);

  return Number.isInteger(numeric) &&
    numeric > 0
    ? numeric
    : null;
}