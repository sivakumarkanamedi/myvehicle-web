import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type ProcessPaymentBody = {
  payment_instruction_id?: number;
  action?: "process" | "retry";
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
  beneficiary_reference: string | null;
  gross_amount: number;
  deduction_amount: number;
  net_payable_amount: number;
  currency_code: string;
  validation_status: string;
  approval_status: string;
  duplicate_check_status: string;
  retry_count: number;
  max_retry_count: number;
  gateway_provider: string | null;
  gateway_payment_id: string | null;
  bank_transaction_reference: string | null;
  utr_number: string | null;
};

type PaymentAttemptRow = {
  id: number;
  payment_instruction_id: number;
  attempt_number: number;
  attempt_status: string;
};

type PaymentAdapterResult =
  | {
      success: true;
      provider: string;
      providerPaymentId: string;
      bankTransactionReference: string;
      utrNumber: string | null;
      rawResponse: Record<string, unknown>;
    }
  | {
      success: false;
      provider: string;
      failureCode: string;
      failureReason: string;
      retryable: boolean;
      rawResponse: Record<string, unknown>;
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
        { error: "You must be signed in to process a payment." },
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

    const body = (await request.json()) as ProcessPaymentBody;

    const paymentInstructionId = positiveInteger(
      body.payment_instruction_id
    );

    if (!paymentInstructionId) {
      return NextResponse.json(
        { error: "payment_instruction_id is required." },
        { status: 400 }
      );
    }

    const action = body.action === "retry" ? "retry" : "process";

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
        { error: "You are not allowed to process this payment." },
        { status: 403 }
      );
    }

    const validationError = validatePaymentBeforeProcessing(
      payment,
      action
    );

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const duplicateResult = await adminClient.rpc(
      "check_duplicate_payment",
      {
        target_payment_instruction_id: payment.id,
      }
    );

    if (duplicateResult.error) {
      throw new Error(duplicateResult.error.message);
    }

    const refreshedAfterDuplicateCheck =
      await loadPaymentInstruction(
        adminClient as any,
        payment.id
      );

    if (!refreshedAfterDuplicateCheck) {
      throw new Error(
        "Payment could not be reloaded after duplicate check."
      );
    }

    if (
      refreshedAfterDuplicateCheck.duplicate_check_status ===
        "confirmed_duplicate" ||
      refreshedAfterDuplicateCheck.duplicate_check_status ===
        "manual_review_required"
    ) {
      await adminClient
        .from("insurance_payment_instructions")
        .update({
          payment_status: "approval_pending",
          approval_status: "manual_review",
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          success: false,
          payment_instruction_id: payment.id,
          payment_reference: payment.payment_reference,
          payment_status: "approval_pending",
          duplicate_check_status:
            refreshedAfterDuplicateCheck.duplicate_check_status,
          message:
            "Payment was not processed because duplicate review is required.",
        },
        { status: 409 }
      );
    }

    const attemptNumber =
      await getNextAttemptNumber(
        adminClient as any,
        payment.id
      );

    const attempt = await createPaymentAttempt({
      adminClient: adminClient as any,
      userId: user.id,
      payment,
      attemptNumber,
    });

    await adminClient
      .from("insurance_payment_instructions")
      .update({
        payment_status: "initiated",
        payment_initiated_at: new Date().toISOString(),
        retry_count:
          action === "retry"
            ? payment.retry_count + 1
            : payment.retry_count,
        next_retry_at: null,
      })
      .eq("id", payment.id);

    const adapterResult = await processThroughAdapter({
      payment,
      environment,
      attemptNumber,
    });

    if (adapterResult.success) {
      await markAttemptSuccessful({
        adminClient: adminClient as any,
        attemptId: attempt.id,
        result: adapterResult,
      });

      await adminClient
        .from("insurance_payment_instructions")
        .update({
          payment_status: "paid",
          approval_status: "approved",
          gateway_provider: adapterResult.provider,
          gateway_payment_id:
            adapterResult.providerPaymentId,
          bank_transaction_reference:
            adapterResult.bankTransactionReference,
          utr_number: adapterResult.utrNumber,
          payment_processing_at:
            new Date().toISOString(),
          payment_completed_at:
            new Date().toISOString(),
          failure_code: null,
          failure_reason: null,
          next_retry_at: null,
        })
        .eq("id", payment.id);

      await updatePaymentSplitsAsPaid({
        adminClient: adminClient as any,
        paymentInstructionId: payment.id,
        result: adapterResult,
      });

      await createPaymentReceipt({
        adminClient: adminClient as any,
        userId: user.id,
        paymentInstructionId: payment.id,
        payment,
        result: adapterResult,
      });

      await writeAuditLog({
        adminClient: adminClient as any,
        userId: user.id,
        paymentInstructionId: payment.id,
        actionType: "payment_processed",
        actionStatus: "paid",
        previousValues: {
          payment_status: payment.payment_status,
        },
        newValues: {
          payment_status: "paid",
          gateway_provider: adapterResult.provider,
          gateway_payment_id:
            adapterResult.providerPaymentId,
          bank_transaction_reference:
            adapterResult.bankTransactionReference,
          utr_number: adapterResult.utrNumber,
        },
        metadata: {
          attempt_number: attemptNumber,
          payment_mode: payment.payment_mode,
          net_payable_amount:
            payment.net_payable_amount,
        },
      });

      return NextResponse.json({
        success: true,
        payment_instruction_id: payment.id,
        payment_reference: payment.payment_reference,
        payment_status: "paid",
        gateway_provider: adapterResult.provider,
        gateway_payment_id:
          adapterResult.providerPaymentId,
        bank_transaction_reference:
          adapterResult.bankTransactionReference,
        utr_number: adapterResult.utrNumber,
        amount: payment.net_payable_amount,
        currency: payment.currency_code,
        message: "Payment processed successfully.",
      });
    }

    await markAttemptFailed({
      adminClient: adminClient as any,
      attemptId: attempt.id,
      result: adapterResult,
    });

    const canRetry =
      adapterResult.retryable &&
      payment.retry_count < payment.max_retry_count;

    const nextRetryAt = canRetry
      ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
      : null;

    await adminClient
      .from("insurance_payment_instructions")
      .update({
        payment_status: canRetry
          ? "retry_scheduled"
          : "failed",
        payment_failed_at: new Date().toISOString(),
        failure_code: adapterResult.failureCode,
        failure_reason: adapterResult.failureReason,
        next_retry_at: nextRetryAt,
      })
      .eq("id", payment.id);

    await writeAuditLog({
      adminClient: adminClient as any,
      userId: user.id,
      paymentInstructionId: payment.id,
      actionType: "payment_processing_failed",
      actionStatus: canRetry
        ? "retry_scheduled"
        : "failed",
      previousValues: {
        payment_status: payment.payment_status,
      },
      newValues: {
        payment_status: canRetry
          ? "retry_scheduled"
          : "failed",
        failure_code: adapterResult.failureCode,
        failure_reason: adapterResult.failureReason,
        next_retry_at: nextRetryAt,
      },
      metadata: {
        attempt_number: attemptNumber,
        retryable: adapterResult.retryable,
      },
    });

    return NextResponse.json(
      {
        success: false,
        payment_instruction_id: payment.id,
        payment_reference: payment.payment_reference,
        payment_status: canRetry
          ? "retry_scheduled"
          : "failed",
        failure_code: adapterResult.failureCode,
        failure_reason: adapterResult.failureReason,
        next_retry_at: nextRetryAt,
        message: canRetry
          ? "Payment failed temporarily and a retry was scheduled."
          : "Payment failed and requires manual review.",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("Payment processing error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process the payment.",
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

function validatePaymentBeforeProcessing(
  payment: PaymentInstructionRow,
  action: "process" | "retry"
) {
  if (payment.net_payable_amount <= 0) {
    return "Net payable amount must be greater than zero.";
  }

  if (payment.validation_status !== "passed") {
    return (
      "Payment validation must pass before processing."
    );
  }

  if (payment.approval_status !== "approved") {
    return (
      "Payment must be approved by an authorized user before processing."
    );
  }

  if (payment.payment_status === "paid") {
    return "Payment is already completed.";
  }

  if (
    payment.duplicate_check_status ===
      "confirmed_duplicate" ||
    payment.duplicate_check_status ===
      "manual_review_required"
  ) {
    return "Duplicate-payment review is required.";
  }

  if (action === "retry") {
    if (
      ![
        "failed",
        "retry_scheduled",
      ].includes(payment.payment_status)
    ) {
      return (
        "Only failed or retry-scheduled payments can be retried."
      );
    }

    if (payment.retry_count >= payment.max_retry_count) {
      return "Maximum retry count has been reached.";
    }
  } else if (
    ![
      "approved",
      "scheduled",
      "approval_pending",
    ].includes(payment.payment_status)
  ) {
    return (
      "Payment must be approved or scheduled before processing."
    );
  }

  return "";
}

async function getNextAttemptNumber(
  adminClient: any,
  paymentInstructionId: number
) {
  const { data, error } = await adminClient
    .from("insurance_payment_attempts")
    .select("attempt_number")
    .eq("payment_instruction_id", paymentInstructionId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.attempt_number ?? 0) + 1;
}

async function createPaymentAttempt(args: {
  adminClient: any;
  userId: string;
  payment: PaymentInstructionRow;
  attemptNumber: number;
}) {
  const { data, error } = await args.adminClient
    .from("insurance_payment_attempts")
    .insert({
      user_id: args.userId,
      payment_instruction_id: args.payment.id,
      attempt_number: args.attemptNumber,
      attempt_status: "created",
      gateway_provider:
        resolveProvider(args.payment.payment_mode),
      request_payload: {
        payment_reference:
          args.payment.payment_reference,
        payment_mode:
          args.payment.payment_mode,
        beneficiary_type:
          args.payment.beneficiary_type,
        beneficiary_name:
          args.payment.beneficiary_name,
        net_payable_amount:
          args.payment.net_payable_amount,
        currency_code:
          args.payment.currency_code,
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create payment attempt."
    );
  }

  return data as PaymentAttemptRow;
}

async function processThroughAdapter(args: {
  payment: PaymentInstructionRow;
  environment: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    serviceRoleKey: string;
    paymentExecutionMode: "sandbox" | "live";
  };
  attemptNumber: number;
}): Promise<PaymentAdapterResult> {
  if (args.environment.paymentExecutionMode === "sandbox") {
    return processWithSandboxAdapter(
      args.payment,
      args.attemptNumber
    );
  }

  throw new Error(
    "Live payment processing is not configured. " +
      "Connect an authorized bank or payment gateway adapter first."
  );
}

async function processWithSandboxAdapter(
  payment: PaymentInstructionRow,
  attemptNumber: number
): Promise<PaymentAdapterResult> {
  await delay(500);

  const provider = resolveProvider(payment.payment_mode);
  const timestamp = Date.now();
  const referenceBase = `${payment.id}-${attemptNumber}-${timestamp}`;

  if (
    payment.payment_mode === "undetermined" ||
    payment.payment_mode === "cheque"
  ) {
    return {
      success: false,
      provider,
      failureCode: "UNSUPPORTED_MODE",
      failureReason:
        "Selected payment mode cannot be processed automatically.",
      retryable: false,
      rawResponse: {
        sandbox: true,
        payment_mode: payment.payment_mode,
      },
    };
  }

  return {
    success: true,
    provider,
    providerPaymentId: `SBX-PAY-${referenceBase}`,
    bankTransactionReference: `SBX-TXN-${referenceBase}`,
    utrNumber:
      payment.payment_mode === "neft" ||
      payment.payment_mode === "rtgs" ||
      payment.payment_mode === "imps" ||
      payment.payment_mode === "bank_transfer"
        ? `SBXUTR${timestamp}`
        : null,
    rawResponse: {
      sandbox: true,
      status: "success",
      amount: payment.net_payable_amount,
      currency: payment.currency_code,
      processed_at: new Date().toISOString(),
    },
  };
}

async function markAttemptSuccessful(args: {
  adminClient: any;
  attemptId: number;
  result: Extract<
    PaymentAdapterResult,
    { success: true }
  >;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_attempts")
    .update({
      attempt_status: "succeeded",
      gateway_provider: args.result.provider,
      gateway_payment_id:
        args.result.providerPaymentId,
      bank_transaction_reference:
        args.result.bankTransactionReference,
      response_payload: args.result.rawResponse,
      completed_at: new Date().toISOString(),
      failure_code: null,
      failure_reason: null,
    })
    .eq("id", args.attemptId);

  if (error) {
    throw new Error(error.message);
  }
}

async function markAttemptFailed(args: {
  adminClient: any;
  attemptId: number;
  result: Extract<
    PaymentAdapterResult,
    { success: false }
  >;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_attempts")
    .update({
      attempt_status: "failed",
      gateway_provider: args.result.provider,
      response_payload: args.result.rawResponse,
      failure_code: args.result.failureCode,
      failure_reason: args.result.failureReason,
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.attemptId);

  if (error) {
    throw new Error(error.message);
  }
}

async function updatePaymentSplitsAsPaid(args: {
  adminClient: any;
  paymentInstructionId: number;
  result: Extract<
    PaymentAdapterResult,
    { success: true }
  >;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_splits")
    .update({
      payment_status: "paid",
      bank_transaction_reference:
        args.result.bankTransactionReference,
      utr_number: args.result.utrNumber,
    })
    .eq(
      "payment_instruction_id",
      args.paymentInstructionId
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function createPaymentReceipt(args: {
  adminClient: any;
  userId: string;
  paymentInstructionId: number;
  payment: PaymentInstructionRow;
  result: Extract<
    PaymentAdapterResult,
    { success: true }
  >;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_documents")
    .insert({
      user_id: args.userId,
      payment_instruction_id:
        args.paymentInstructionId,
      document_type: "payment_receipt",
      document_number:
        `RCT-${args.paymentInstructionId}-${Date.now()}`,
      document_status: "generated",
      document_title: "Payment Receipt",
      document_summary:
        "Payment receipt generated after successful processing.",
      metadata: {
        payment_reference:
          args.payment.payment_reference,
        beneficiary_name:
          args.payment.beneficiary_name,
        net_payable_amount:
          args.payment.net_payable_amount,
        currency_code:
          args.payment.currency_code,
        gateway_provider:
          args.result.provider,
        gateway_payment_id:
          args.result.providerPaymentId,
        bank_transaction_reference:
          args.result.bankTransactionReference,
        utr_number:
          args.result.utrNumber,
        paid_at:
          new Date().toISOString(),
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeAuditLog(args: {
  adminClient: any;
  userId: string;
  paymentInstructionId: number;
  actionType: string;
  actionStatus: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_audit_log")
    .insert({
      user_id: args.userId,
      payment_instruction_id:
        args.paymentInstructionId,
      action_type: args.actionType,
      action_status: args.actionStatus,
      actor_type: "authenticated_user",
      actor_reference: args.userId,
      previous_values: args.previousValues,
      new_values: args.newValues,
      metadata: args.metadata,
    });

  if (error) {
    throw new Error(error.message);
  }
}

function resolveProvider(paymentMode: string) {
  const providers: Record<string, string> = {
    bank_transfer: "bank_adapter",
    neft: "bank_neft_adapter",
    rtgs: "bank_rtgs_adapter",
    imps: "bank_imps_adapter",
    upi: "upi_gateway_adapter",
    gateway: "payment_gateway_adapter",
    internal_ledger: "internal_ledger_adapter",
    cheque: "manual_cheque",
    undetermined: "unconfigured",
  };

  return providers[paymentMode] ?? "unconfigured";
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

  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : null;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}