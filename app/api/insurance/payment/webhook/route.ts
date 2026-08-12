import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type PaymentWebhookPayload = {
  event_id?: string;
  event_type?:
    | "payment.created"
    | "payment.pending"
    | "payment.processing"
    | "payment.succeeded"
    | "payment.failed"
    | "payment.reversed"
    | "payment.refunded"
    | "payment.partially_refunded"
    | "payment.cancelled"
    | "payment.chargeback";

  provider?: string;
  created_at?: string;

  data?: {
    payment_id?: string;
    payment_reference?: string;
    bank_transaction_reference?: string;
    utr_number?: string;
    status?: string;
    amount?: number;
    currency?: string;

    failure_code?: string;
    failure_reason?: string;

    refund_id?: string;
    refund_amount?: number;

    metadata?: Record<string, unknown>;
  };
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
  retry_count: number;
  max_retry_count: number;
};

type NormalizedWebhookEvent = {
  eventId: string;
  eventType: string;
  provider: string;
  gatewayPaymentId: string;
  paymentReference: string;
  bankTransactionReference: string;
  utrNumber: string;
  amount: number | null;
  currency: string;
  failureCode: string;
  failureReason: string;
  refundId: string;
  refundAmount: number | null;
  rawPayload: PaymentWebhookPayload;
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

    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: "Webhook body is empty." },
        { status: 400 }
      );
    }

    const signature =
      request.headers.get("x-payment-signature") ??
      request.headers.get("x-webhook-signature") ??
      "";

    if (
      !verifyWebhookSignature({
        rawBody,
        receivedSignature: signature,
        secret: environment.webhookSecret,
      })
    ) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    let payload: PaymentWebhookPayload;

    try {
      payload = JSON.parse(rawBody) as PaymentWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Webhook payload is not valid JSON." },
        { status: 400 }
      );
    }

    const event = normalizeWebhookEvent(
      payload,
      request.headers
    );

    const validationError = validateWebhookEvent(event);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
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

    const alreadyProcessed = await isEventAlreadyProcessed(
      adminClient as any,
      event.eventId
    );

    if (alreadyProcessed) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        event_id: event.eventId,
        message: "Webhook event was already processed.",
      });
    }

    const payment = await findPaymentInstruction(
      adminClient as any,
      event
    );

    if (!payment) {
      await writeUnmatchedWebhookAudit({
        adminClient: adminClient as any,
        event,
      });

      return NextResponse.json(
        {
          error: "No payment instruction matched this webhook.",
          event_id: event.eventId,
        },
        { status: 404 }
      );
    }

    const amountError = validateWebhookAmount(
      payment,
      event
    );

    if (amountError) {
      await writePaymentAudit({
        adminClient: adminClient as any,
        payment,
        event,
        actionType: "payment_webhook_amount_mismatch",
        actionStatus: "manual_review_required",
        previousValues: {
          net_payable_amount: payment.net_payable_amount,
          currency_code: payment.currency_code,
        },
        newValues: {
          webhook_amount: event.amount,
          webhook_currency: event.currency,
        },
        metadata: {
          error: amountError,
        },
      });

      await adminClient
        .from("insurance_payment_instructions")
        .update({
          approval_status: "manual_review",
          validation_status: "manual_review_required",
          validation_warnings: [amountError],
        })
        .eq("id", payment.id);

      return NextResponse.json(
        {
          error: amountError,
          event_id: event.eventId,
          payment_instruction_id: payment.id,
        },
        { status: 409 }
      );
    }

    const outcome = await processWebhookEvent({
      adminClient: adminClient as any,
      payment,
      event,
    });

    await writePaymentAudit({
      adminClient: adminClient as any,
      payment,
      event,
      actionType: "payment_webhook_processed",
      actionStatus: outcome.paymentStatus,
      previousValues: {
        payment_status: payment.payment_status,
        gateway_payment_id: payment.gateway_payment_id,
        bank_transaction_reference:
          payment.bank_transaction_reference,
        utr_number: payment.utr_number,
      },
      newValues: {
        payment_status: outcome.paymentStatus,
        gateway_payment_id: event.gatewayPaymentId,
        bank_transaction_reference:
          event.bankTransactionReference,
        utr_number: event.utrNumber,
      },
      metadata: {
        event_id: event.eventId,
        event_type: event.eventType,
        provider: event.provider,
      },
    });

    return NextResponse.json({
      success: true,
      idempotent: false,
      event_id: event.eventId,
      event_type: event.eventType,
      payment_instruction_id: payment.id,
      payment_reference: payment.payment_reference,
      payment_status: outcome.paymentStatus,
      message: outcome.message,
    });
  } catch (error) {
    console.error("Payment webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process payment webhook.",
      },
      { status: 500 }
    );
  }
}

async function processWebhookEvent(args: {
  adminClient: any;
  payment: PaymentInstructionRow;
  event: NormalizedWebhookEvent;
}) {
  const {
    adminClient,
    payment,
    event,
  } = args;

  switch (event.eventType) {
    case "payment.created":
    case "payment.pending":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "initiated",
        gateway_provider: event.provider,
        gateway_payment_id:
          event.gatewayPaymentId || payment.gateway_payment_id,
        payment_initiated_at: new Date().toISOString(),
      });

      await updateLatestAttempt(
        adminClient,
        payment.id,
        {
          attempt_status: "submitted",
          gateway_provider: event.provider,
          gateway_payment_id:
            event.gatewayPaymentId || null,
          response_payload: event.rawPayload,
        }
      );

      return {
        paymentStatus: "initiated",
        message: "Payment initiation was confirmed.",
      };

    case "payment.processing":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "processing",
        gateway_provider: event.provider,
        gateway_payment_id:
          event.gatewayPaymentId || payment.gateway_payment_id,
        bank_transaction_reference:
          event.bankTransactionReference || null,
        utr_number: event.utrNumber || null,
        payment_processing_at: new Date().toISOString(),
      });

      await updateLatestAttempt(
        adminClient,
        payment.id,
        {
          attempt_status: "processing",
          gateway_provider: event.provider,
          gateway_payment_id:
            event.gatewayPaymentId || null,
          bank_transaction_reference:
            event.bankTransactionReference || null,
          response_payload: event.rawPayload,
        }
      );

      return {
        paymentStatus: "processing",
        message: "Payment is processing.",
      };

    case "payment.succeeded":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "paid",
        approval_status: "approved",
        gateway_provider: event.provider,
        gateway_payment_id:
          event.gatewayPaymentId || payment.gateway_payment_id,
        bank_transaction_reference:
          event.bankTransactionReference || null,
        utr_number: event.utrNumber || null,
        payment_processing_at: new Date().toISOString(),
        payment_completed_at: new Date().toISOString(),
        payment_failed_at: null,
        failure_code: null,
        failure_reason: null,
        next_retry_at: null,
      });

      await updateLatestAttempt(
        adminClient,
        payment.id,
        {
          attempt_status: "succeeded",
          gateway_provider: event.provider,
          gateway_payment_id:
            event.gatewayPaymentId || null,
          bank_transaction_reference:
            event.bankTransactionReference || null,
          response_payload: event.rawPayload,
          failure_code: null,
          failure_reason: null,
          completed_at: new Date().toISOString(),
        }
      );

      await adminClient
        .from("insurance_payment_splits")
        .update({
          payment_status: "paid",
          bank_transaction_reference:
            event.bankTransactionReference || null,
          utr_number: event.utrNumber || null,
        })
        .eq("payment_instruction_id", payment.id);

      await createPaymentReceiptIfMissing({
        adminClient,
        payment,
        event,
      });

      return {
        paymentStatus: "paid",
        message: "Payment success was confirmed.",
      };

    case "payment.failed":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "failed",
        gateway_provider: event.provider,
        gateway_payment_id:
          event.gatewayPaymentId || payment.gateway_payment_id,
        payment_failed_at: new Date().toISOString(),
        failure_code:
          event.failureCode || "GATEWAY_FAILURE",
        failure_reason:
          event.failureReason ||
          "The payment provider reported a failure.",
        next_retry_at: null,
      });

      await updateLatestAttempt(
        adminClient,
        payment.id,
        {
          attempt_status: "failed",
          gateway_provider: event.provider,
          gateway_payment_id:
            event.gatewayPaymentId || null,
          response_payload: event.rawPayload,
          failure_code:
            event.failureCode || "GATEWAY_FAILURE",
          failure_reason:
            event.failureReason ||
            "The payment provider reported a failure.",
          completed_at: new Date().toISOString(),
        }
      );

      return {
        paymentStatus: "failed",
        message: "Payment failure was recorded.",
      };

    case "payment.cancelled":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "cancelled",
        payment_cancelled_at: new Date().toISOString(),
        failure_code:
          event.failureCode || "PAYMENT_CANCELLED",
        failure_reason:
          event.failureReason ||
          "The payment provider cancelled the payment.",
      });

      await updateLatestAttempt(
        adminClient,
        payment.id,
        {
          attempt_status: "cancelled",
          response_payload: event.rawPayload,
          failure_code:
            event.failureCode || "PAYMENT_CANCELLED",
          failure_reason:
            event.failureReason ||
            "The payment provider cancelled the payment.",
          completed_at: new Date().toISOString(),
        }
      );

      return {
        paymentStatus: "cancelled",
        message: "Payment cancellation was recorded.",
      };

    case "payment.reversed":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "failed",
        failure_code: "PAYMENT_REVERSED",
        failure_reason:
          event.failureReason ||
          "The payment was reversed by the provider.",
        payment_failed_at: new Date().toISOString(),
      });

      await createRefundRecord({
        adminClient,
        payment,
        event,
        status: "completed",
        reason:
          event.failureReason ||
          "Payment reversed by provider.",
      });

      return {
        paymentStatus: "failed",
        message: "Payment reversal was recorded.",
      };

    case "payment.refunded":
      await createRefundRecord({
        adminClient,
        payment,
        event,
        status: "completed",
        reason: "Payment refunded by provider.",
      });

      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "refunded",
      });

      return {
        paymentStatus: "refunded",
        message: "Full refund was recorded.",
      };

    case "payment.partially_refunded":
      await createRefundRecord({
        adminClient,
        payment,
        event,
        status: "completed",
        reason: "Partial payment refund processed.",
      });

      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "partially_refunded",
      });

      return {
        paymentStatus: "partially_refunded",
        message: "Partial refund was recorded.",
      };

    case "payment.chargeback":
      await updatePaymentInstruction(adminClient, payment.id, {
        payment_status: "failed",
        approval_status: "manual_review",
        failure_code: "CHARGEBACK",
        failure_reason:
          event.failureReason ||
          "The provider reported a payment chargeback.",
      });

      await createRefundRecord({
        adminClient,
        payment,
        event,
        status: "approval_pending",
        reason:
          event.failureReason ||
          "Chargeback reported by provider.",
      });

      return {
        paymentStatus: "failed",
        message:
          "Chargeback was recorded for authorized review.",
      };

    default:
      throw new Error(
        `Unsupported webhook event type: ${event.eventType}`
      );
  }
}

async function findPaymentInstruction(
  adminClient: any,
  event: NormalizedWebhookEvent
) {
  if (event.gatewayPaymentId) {
    const { data, error } = await adminClient
      .from("insurance_payment_instructions")
      .select("*")
      .eq("gateway_payment_id", event.gatewayPaymentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as PaymentInstructionRow;
    }
  }

  if (event.paymentReference) {
    const { data, error } = await adminClient
      .from("insurance_payment_instructions")
      .select("*")
      .eq("payment_reference", event.paymentReference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as PaymentInstructionRow;
    }
  }

  return null;
}

async function isEventAlreadyProcessed(
  adminClient: any,
  eventId: string
) {
  const { data, error } = await adminClient
    .from("insurance_payment_audit_log")
    .select("id")
    .eq("action_type", "payment_webhook_processed")
    .contains("metadata", {
      event_id: eventId,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function updatePaymentInstruction(
  adminClient: any,
  paymentInstructionId: number,
  values: Record<string, unknown>
) {
  const { error } = await adminClient
    .from("insurance_payment_instructions")
    .update(values)
    .eq("id", paymentInstructionId);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateLatestAttempt(
  adminClient: any,
  paymentInstructionId: number,
  values: Record<string, unknown>
) {
  const { data: attempt, error } = await adminClient
    .from("insurance_payment_attempts")
    .select("id")
    .eq("payment_instruction_id", paymentInstructionId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!attempt?.id) {
    return;
  }

  const { error: updateError } = await adminClient
    .from("insurance_payment_attempts")
    .update(values)
    .eq("id", attempt.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function createPaymentReceiptIfMissing(args: {
  adminClient: any;
  payment: PaymentInstructionRow;
  event: NormalizedWebhookEvent;
}) {
  const { data: existingReceipt, error: lookupError } =
    await args.adminClient
      .from("insurance_payment_documents")
      .select("id")
      .eq(
        "payment_instruction_id",
        args.payment.id
      )
      .eq("document_type", "payment_receipt")
      .limit(1)
      .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existingReceipt) {
    return;
  }

  const { error } = await args.adminClient
    .from("insurance_payment_documents")
    .insert({
      user_id: args.payment.user_id,
      payment_instruction_id: args.payment.id,
      document_type: "payment_receipt",
      document_number:
        `RCT-${args.payment.id}-${Date.now()}`,
      document_status: "generated",
      document_title: "Payment Receipt",
      document_summary:
        "Payment receipt generated after provider confirmation.",
      metadata: {
        event_id: args.event.eventId,
        provider: args.event.provider,
        payment_reference:
          args.payment.payment_reference,
        gateway_payment_id:
          args.event.gatewayPaymentId,
        bank_transaction_reference:
          args.event.bankTransactionReference,
        utr_number: args.event.utrNumber,
        amount:
          args.event.amount ??
          args.payment.net_payable_amount,
        currency:
          args.event.currency ||
          args.payment.currency_code,
        paid_at: new Date().toISOString(),
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function createRefundRecord(args: {
  adminClient: any;
  payment: PaymentInstructionRow;
  event: NormalizedWebhookEvent;
  status: string;
  reason: string;
}) {
  const refundAmount =
    args.event.refundAmount ??
    args.event.amount ??
    args.payment.net_payable_amount;

  const refundReference =
    args.event.refundId ||
    `RF-WEBHOOK-${args.event.eventId}`;

  const { data: existing, error: lookupError } =
    await args.adminClient
      .from("insurance_payment_refunds")
      .select("id")
      .eq("refund_reference", refundReference)
      .limit(1)
      .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    return;
  }

  const now = new Date().toISOString();

  const { error } = await args.adminClient
    .from("insurance_payment_refunds")
    .insert({
      user_id: args.payment.user_id,
      payment_instruction_id: args.payment.id,
      refund_reference: refundReference,
      refund_reason: args.reason,
      refund_amount: refundAmount,
      refund_status: args.status,
      requested_by_name: "Payment Provider",
      requested_by_role: "webhook",
      requested_at: now,
      approved_by_name:
        args.status === "completed"
          ? "Payment Provider"
          : null,
      approved_by_role:
        args.status === "completed"
          ? "webhook"
          : null,
      approved_at:
        args.status === "completed"
          ? now
          : null,
      gateway_refund_id:
        args.event.refundId || null,
      bank_transaction_reference:
        args.event.bankTransactionReference || null,
      utr_number: args.event.utrNumber || null,
      processed_at:
        args.status === "completed"
          ? now
          : null,
      completed_at:
        args.status === "completed"
          ? now
          : null,
      metadata: {
        event_id: args.event.eventId,
        event_type: args.event.eventType,
        provider: args.event.provider,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writePaymentAudit(args: {
  adminClient: any;
  payment: PaymentInstructionRow;
  event: NormalizedWebhookEvent;
  actionType: string;
  actionStatus: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_audit_log")
    .insert({
      user_id: args.payment.user_id,
      payment_instruction_id: args.payment.id,
      action_type: args.actionType,
      action_status: args.actionStatus,
      actor_type: "payment_provider_webhook",
      actor_name: args.event.provider,
      actor_reference: args.event.eventId,
      previous_values: args.previousValues,
      new_values: args.newValues,
      metadata: {
        ...args.metadata,
        event_id: args.event.eventId,
        event_type: args.event.eventType,
        provider: args.event.provider,
        raw_payload: args.event.rawPayload,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeUnmatchedWebhookAudit(args: {
  adminClient: any;
  event: NormalizedWebhookEvent;
}) {
  const { error } = await args.adminClient
    .from("insurance_payment_audit_log")
    .insert({
      user_id: null,
      payment_instruction_id: null,
      action_type: "payment_webhook_unmatched",
      action_status: "manual_review_required",
      actor_type: "payment_provider_webhook",
      actor_name: args.event.provider,
      actor_reference: args.event.eventId,
      previous_values: {},
      new_values: {},
      metadata: {
        event_id: args.event.eventId,
        event_type: args.event.eventType,
        provider: args.event.provider,
        gateway_payment_id:
          args.event.gatewayPaymentId,
        payment_reference:
          args.event.paymentReference,
        raw_payload: args.event.rawPayload,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeWebhookEvent(
  payload: PaymentWebhookPayload,
  headers: Headers
): NormalizedWebhookEvent {
  const data = payload.data ?? {};

  return {
    eventId:
      cleanText(payload.event_id, 250) ||
      cleanText(
        headers.get("x-payment-event-id"),
        250
      ) ||
      cleanText(
        headers.get("x-webhook-event-id"),
        250
      ),

    eventType: normalizeEventType(
      payload.event_type ??
      data.status ??
      ""
    ),

    provider:
      cleanText(payload.provider, 120) ||
      cleanText(
        headers.get("x-payment-provider"),
        120
      ) ||
      "unknown_provider",

    gatewayPaymentId: cleanText(
      data.payment_id,
      250
    ),

    paymentReference: cleanText(
      data.payment_reference,
      250
    ),

    bankTransactionReference: cleanText(
      data.bank_transaction_reference,
      250
    ),

    utrNumber: cleanText(
      data.utr_number,
      250
    ),

    amount: cleanMoney(data.amount),

    currency:
      cleanText(data.currency, 10).toUpperCase() ||
      "INR",

    failureCode: cleanText(
      data.failure_code,
      250
    ),

    failureReason: cleanText(
      data.failure_reason,
      2000
    ),

    refundId: cleanText(
      data.refund_id,
      250
    ),

    refundAmount: cleanMoney(
      data.refund_amount
    ),

    rawPayload: payload,
  };
}

function validateWebhookEvent(
  event: NormalizedWebhookEvent
) {
  if (!event.eventId) {
    return "Webhook event_id is required.";
  }

  if (!event.eventType) {
    return "Webhook event_type is required or unsupported.";
  }

  if (
    !event.gatewayPaymentId &&
    !event.paymentReference
  ) {
    return (
      "Webhook must include payment_id or payment_reference."
    );
  }

  return "";
}

function validateWebhookAmount(
  payment: PaymentInstructionRow,
  event: NormalizedWebhookEvent
) {
  if (event.amount === null) {
    return "";
  }

  const difference = Math.abs(
    event.amount - Number(payment.net_payable_amount)
  );

  if (difference > 0.01) {
    return (
      `Webhook amount ${event.amount} does not match ` +
      `the payment amount ${payment.net_payable_amount}.`
    );
  }

  if (
    event.currency &&
    event.currency !== payment.currency_code
  ) {
    return (
      `Webhook currency ${event.currency} does not match ` +
      `payment currency ${payment.currency_code}.`
    );
  }

  return "";
}

function normalizeEventType(
  value: unknown
) {
  const normalized = cleanText(value, 100)
    .toLowerCase()
    .replace(/\s+/g, "_");

  const aliases: Record<string, string> = {
    created: "payment.created",
    payment_created: "payment.created",

    pending: "payment.pending",
    payment_pending: "payment.pending",

    processing: "payment.processing",
    payment_processing: "payment.processing",

    success: "payment.succeeded",
    succeeded: "payment.succeeded",
    paid: "payment.succeeded",
    completed: "payment.succeeded",
    payment_success: "payment.succeeded",
    payment_succeeded: "payment.succeeded",

    failed: "payment.failed",
    failure: "payment.failed",
    payment_failed: "payment.failed",

    reversed: "payment.reversed",
    payment_reversed: "payment.reversed",

    refunded: "payment.refunded",
    payment_refunded: "payment.refunded",

    partially_refunded:
      "payment.partially_refunded",
    payment_partially_refunded:
      "payment.partially_refunded",

    cancelled: "payment.cancelled",
    canceled: "payment.cancelled",
    payment_cancelled: "payment.cancelled",
    payment_canceled: "payment.cancelled",

    chargeback: "payment.chargeback",
    payment_chargeback: "payment.chargeback",
  };

  if (
    [
      "payment.created",
      "payment.pending",
      "payment.processing",
      "payment.succeeded",
      "payment.failed",
      "payment.reversed",
      "payment.refunded",
      "payment.partially_refunded",
      "payment.cancelled",
      "payment.chargeback",
    ].includes(normalized)
  ) {
    return normalized;
  }

  return aliases[normalized] ?? "";
}

function verifyWebhookSignature(args: {
  rawBody: string;
  receivedSignature: string;
  secret: string;
}) {
  if (!args.receivedSignature) {
    return false;
  }

  const received = args.receivedSignature
    .replace(/^sha256=/i, "")
    .trim()
    .toLowerCase();

  const expected = createHmac(
    "sha256",
    args.secret
  )
    .update(args.rawBody, "utf8")
    .digest("hex")
    .toLowerCase();

  try {
    const receivedBuffer = Buffer.from(
      received,
      "hex"
    );

    const expectedBuffer = Buffer.from(
      expected,
      "hex"
    );

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    );
  } catch {
    return false;
  }
}

function readEnvironment():
  | {
      supabaseUrl: string;
      serviceRoleKey: string;
      webhookSecret: string;
    }
  | { error: string } {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const webhookSecret =
    process.env.PAYMENT_WEBHOOK_SECRET;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !webhookSecret
  ) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL, " +
        "SUPABASE_SERVICE_ROLE_KEY and " +
        "PAYMENT_WEBHOOK_SECRET are required.",
    };
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    webhookSecret,
  };
}

function cleanText(
  value: unknown,
  limit = 8000
) {
  return typeof value === "string"
    ? value.trim().slice(0, limit)
    : "";
}

function cleanMoney(
  value: unknown
): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(
            value.replace(/[₹,\s]/g, "")
          )
        : NaN;

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}