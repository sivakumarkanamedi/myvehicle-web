import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type PartnerWebhookPayload = {
  event_id?: string;
  event_type?: string;

  renewal_order_id?: number;
  partner_order_reference?: string;
  quote_reference?: string;

  order_status?: string;
  payment_status?: string;
  partner_status?: string;

  payment_transaction_id?: string;
  payment_failure_reason?: string;
  failure_reason?: string;

  new_policy_number?: string;
  new_policy_start_date?: string;
  new_policy_expiry_date?: string;
  new_policy_document_path?: string;

  metadata?: Record<string, unknown>;
};

type RenewalOrder = {
  id: number;
  user_id: string;
  policy_id: number;
  order_status: string;
  payment_status: string;
  partner_name: string;
  partner_order_reference: string | null;
  quote_reference: string | null;
};

const ORDER_STATUSES = new Set([
  "created",
  "payment_pending",
  "payment_completed",
  "submitted_to_partner",
  "processing",
  "policy_issued",
  "completed",
  "failed",
  "cancelled",
  "refunded",
]);

const PAYMENT_STATUSES = new Set([
  "not_started",
  "pending",
  "authorised",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const webhookSecret =
      process.env.INSURANCE_PARTNER_WEBHOOK_SECRET;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    if (!webhookSecret) {
      return NextResponse.json(
        {
          error:
            "INSURANCE_PARTNER_WEBHOOK_SECRET is missing.",
        },
        { status: 500 }
      );
    }

    const rawBody = await request.text();

    if (!verifySignature(request, rawBody, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    let payload: PartnerWebhookPayload;

    try {
      payload = JSON.parse(rawBody) as PartnerWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Webhook body must be valid JSON." },
        { status: 400 }
      );
    }

    const validationError = validatePayload(payload);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const renewalOrder = await findRenewalOrder(
      adminClient,
      payload
    );

    if (!renewalOrder) {
      return NextResponse.json(
        { error: "Renewal order was not found." },
        { status: 404 }
      );
    }

    const eventId =
      cleanOptionalString(payload.event_id) ||
      `${renewalOrder.id}-${payload.event_type}-${Date.now()}`;

    const duplicateEvent = await findDuplicateWebhookEvent(
      adminClient,
      renewalOrder.id,
      eventId
    );

    if (duplicateEvent) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        renewal_order_id: renewalOrder.id,
      });
    }

    const eventType =
      cleanOptionalString(payload.event_type) ||
      "partner_update";

    if (eventType === "policy_issued") {
      const completionError =
        validatePolicyIssuedPayload(payload);

      if (completionError) {
        return NextResponse.json(
          { error: completionError },
          { status: 400 }
        );
      }

      const { data, error } = await adminClient.rpc(
        "complete_insurance_renewal",
        {
          target_order_id: renewalOrder.id,
          new_policy_number:
            payload.new_policy_number!.trim(),
          new_policy_start_date:
            payload.new_policy_start_date!,
          new_policy_expiry_date:
            payload.new_policy_expiry_date!,
          new_policy_document_path:
            payload.new_policy_document_path!.trim(),
          partner_order_reference_input:
            cleanOptionalString(
              payload.partner_order_reference
            ),
          payment_transaction_id_input:
            cleanOptionalString(
              payload.payment_transaction_id
            ),
        }
      );

      if (error) {
        console.error(
          "Partner policy-issued completion error:",
          error
        );

        return NextResponse.json(
          {
            error:
              error.message ||
              "The issued policy could not be applied.",
          },
          { status: 500 }
        );
      }

      await insertWebhookTimelineEvent(
        adminClient,
        renewalOrder,
        eventId,
        payload,
        "Partner confirmed policy issuance."
      );

      return NextResponse.json({
        success: true,
        renewal_order_id: renewalOrder.id,
        result: data,
      });
    }

    const updatePayload =
      buildRenewalOrderUpdate(payload);

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        {
          error:
            "The webhook did not contain any supported status updates.",
        },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from("insurance_renewal_orders")
      .update(updatePayload)
      .eq("id", renewalOrder.id);

    if (updateError) {
      console.error(
        "Renewal webhook update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message ||
            "The renewal order could not be updated.",
        },
        { status: 500 }
      );
    }

    await insertWebhookTimelineEvent(
      adminClient,
      renewalOrder,
      eventId,
      payload,
      "Insurance partner sent a renewal status update."
    );

    return NextResponse.json({
      success: true,
      renewal_order_id: renewalOrder.id,
      event_type: eventType,
    });
  } catch (error) {
    console.error(
      "Insurance partner webhook error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The partner webhook could not be processed.",
      },
      { status: 500 }
    );
  }
}

function verifySignature(
  request: NextRequest,
  rawBody: string,
  secret: string
) {
  const receivedSignature =
    request.headers.get("x-insurance-signature")?.trim();

  if (!receivedSignature) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    secret
  )
    .update(rawBody)
    .digest("hex");

  const received = Buffer.from(
    receivedSignature.replace(/^sha256=/i, ""),
    "utf8"
  );

  const expected = Buffer.from(
    expectedSignature,
    "utf8"
  );

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

function validatePayload(
  payload: PartnerWebhookPayload
) {
  if (
    !payload.renewal_order_id &&
    !payload.partner_order_reference &&
    !payload.quote_reference
  ) {
    return (
      "Provide renewal_order_id, partner_order_reference " +
      "or quote_reference."
    );
  }

  if (
    payload.renewal_order_id !== undefined &&
    (!Number.isInteger(Number(payload.renewal_order_id)) ||
      Number(payload.renewal_order_id) <= 0)
  ) {
    return "renewal_order_id must be a positive integer.";
  }

  if (
    payload.order_status &&
    !ORDER_STATUSES.has(payload.order_status)
  ) {
    return "Unsupported renewal order status.";
  }

  if (
    payload.payment_status &&
    !PAYMENT_STATUSES.has(payload.payment_status)
  ) {
    return "Unsupported payment status.";
  }

  return "";
}

function validatePolicyIssuedPayload(
  payload: PartnerWebhookPayload
) {
  if (!payload.new_policy_number?.trim()) {
    return "New policy number is required.";
  }

  if (!isIsoDate(payload.new_policy_start_date)) {
    return "Valid new policy start date is required.";
  }

  if (!isIsoDate(payload.new_policy_expiry_date)) {
    return "Valid new policy expiry date is required.";
  }

  if (
    new Date(
      `${payload.new_policy_expiry_date}T00:00:00`
    ).getTime() <=
    new Date(
      `${payload.new_policy_start_date}T00:00:00`
    ).getTime()
  ) {
    return "New policy expiry date must follow the start date.";
  }

  if (!payload.new_policy_document_path?.trim()) {
    return "Renewed policy document path is required.";
  }

  return "";
}

async function findRenewalOrder(
  adminClient: any,
  payload: PartnerWebhookPayload
): Promise<RenewalOrder | null> {
  let query = adminClient
    .from("insurance_renewal_orders")
    .select(
      `
        id,
        user_id,
        policy_id,
        order_status,
        payment_status,
        partner_name,
        partner_order_reference,
        quote_reference
      `
    );

  if (payload.renewal_order_id) {
    query = query.eq(
      "id",
      Number(payload.renewal_order_id)
    );
  } else if (payload.partner_order_reference) {
    query = query.eq(
      "partner_order_reference",
      payload.partner_order_reference.trim()
    );
  } else {
    query = query.eq(
      "quote_reference",
      payload.quote_reference!.trim()
    );
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RenewalOrder | null;
}

async function findDuplicateWebhookEvent(
  adminClient: any,
  renewalOrderId: number,
  eventId: string
) {
  const { data, error } = await adminClient
    .from("insurance_renewal_timeline")
    .select("id")
    .eq("renewal_order_id", renewalOrderId)
    .contains("metadata", {
      webhook_event_id: eventId,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function buildRenewalOrderUpdate(
  payload: PartnerWebhookPayload
) {
  const update: Record<string, unknown> = {};

  if (payload.order_status) {
    update.order_status = payload.order_status;
  }

  if (payload.payment_status) {
    update.payment_status = payload.payment_status;
  }

  if (payload.partner_status) {
    update.partner_status =
      payload.partner_status.trim();
  }

  if (payload.partner_order_reference) {
    update.partner_order_reference =
      payload.partner_order_reference.trim();
  }

  if (payload.payment_transaction_id) {
    update.payment_transaction_id =
      payload.payment_transaction_id.trim();
  }

  if (payload.payment_failure_reason) {
    update.payment_failure_reason =
      payload.payment_failure_reason.trim();
  }

  if (payload.failure_reason) {
    update.failure_reason =
      payload.failure_reason.trim();
  }

  return update;
}

async function insertWebhookTimelineEvent(
  adminClient: any,
  renewalOrder: RenewalOrder,
  eventId: string,
  payload: PartnerWebhookPayload,
  fallbackDescription: string
) {
  const eventType =
    cleanOptionalString(payload.event_type) ||
    "partner_update";

  const eventStatus =
    cleanOptionalString(payload.order_status) ||
    cleanOptionalString(payload.payment_status) ||
    cleanOptionalString(payload.partner_status);

  const { error } = await adminClient
    .from("insurance_renewal_timeline")
    .insert({
      user_id: renewalOrder.user_id,
      renewal_order_id: renewalOrder.id,
      event_type: eventType,
      event_status: eventStatus,
      title: formatEventTitle(eventType),
      description: fallbackDescription,
      metadata: {
        webhook_event_id: eventId,
        partner_order_reference:
          payload.partner_order_reference || null,
        payment_transaction_id:
          payload.payment_transaction_id || null,
        quote_reference:
          payload.quote_reference || null,
        partner_metadata:
          payload.metadata || {},
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

function formatEventTitle(
  value: string
) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function isIsoDate(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  return !Number.isNaN(
    date.getTime()
  );
}

function cleanOptionalString(
  value: string | null | undefined
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}