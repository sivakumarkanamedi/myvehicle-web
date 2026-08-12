import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type CompleteRenewalBody = {
  renewal_order_id?: number;
  new_policy_number?: string;
  new_policy_start_date?: string;
  new_policy_expiry_date?: string;
  new_policy_document_path?: string;
  partner_order_reference?: string | null;
  payment_transaction_id?: string | null;
};

type RenewalOrderOwnership = {
  id: number;
  user_id: string;
  policy_id: number;
  order_status: string;
  payment_status: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Supabase environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to complete a renewal.",
        },
        { status: 401 }
      );
    }

    const accessToken = authorization
      .replace("Bearer ", "")
      .trim();

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
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
        {
          error:
            "Your session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as CompleteRenewalBody;

    const validationError = validateBody(body);

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

    const renewalOrderId =
      Number(body.renewal_order_id);

    const { data: orderData, error: orderError } =
      await adminClient
        .from("insurance_renewal_orders")
        .select(
          "id, user_id, policy_id, order_status, payment_status"
        )
        .eq("id", renewalOrderId)
        .single();

    if (orderError || !orderData) {
      return NextResponse.json(
        {
          error:
            orderError?.message ||
            "Renewal order was not found.",
        },
        { status: 404 }
      );
    }

    const renewalOrder =
      orderData as RenewalOrderOwnership;

    if (renewalOrder.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "You are not allowed to complete this renewal order.",
        },
        { status: 403 }
      );
    }

    if (
      [
        "completed",
        "cancelled",
        "refunded",
      ].includes(renewalOrder.order_status)
    ) {
      return NextResponse.json(
        {
          error:
            "This renewal order cannot be completed from its current status.",
        },
        { status: 409 }
      );
    }

    const { data: result, error: completionError } =
      await adminClient.rpc(
        "complete_insurance_renewal",
        {
          target_order_id: renewalOrderId,
          new_policy_number:
            body.new_policy_number!.trim(),
          new_policy_start_date:
            body.new_policy_start_date!,
          new_policy_expiry_date:
            body.new_policy_expiry_date!,
          new_policy_document_path:
            body.new_policy_document_path!.trim(),
          partner_order_reference_input:
            cleanOptionalString(
              body.partner_order_reference
            ),
          payment_transaction_id_input:
            cleanOptionalString(
              body.payment_transaction_id
            ),
        }
      );

    if (completionError) {
      console.error(
        "Complete insurance renewal RPC error:",
        completionError
      );

      return NextResponse.json(
        {
          error:
            completionError.message ||
            "The renewal could not be completed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      renewal: result,
    });
  } catch (error) {
    console.error(
      "Insurance renewal completion route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The insurance renewal could not be completed.",
      },
      { status: 500 }
    );
  }
}

function validateBody(
  body: CompleteRenewalBody
) {
  if (
    !Number.isInteger(
      Number(body.renewal_order_id)
    ) ||
    Number(body.renewal_order_id) <= 0
  ) {
    return "A valid renewal order ID is required.";
  }

  if (
    !body.new_policy_number?.trim()
  ) {
    return "New policy number is required.";
  }

  if (
    !isIsoDate(
      body.new_policy_start_date
    )
  ) {
    return "A valid new policy start date is required.";
  }

  if (
    !isIsoDate(
      body.new_policy_expiry_date
    )
  ) {
    return "A valid new policy expiry date is required.";
  }

  const startDate = new Date(
    `${body.new_policy_start_date}T00:00:00`
  );

  const expiryDate = new Date(
    `${body.new_policy_expiry_date}T00:00:00`
  );

  if (
    expiryDate.getTime() <=
    startDate.getTime()
  ) {
    return "New policy expiry date must be after the start date.";
  }

  if (
    !body.new_policy_document_path?.trim()
  ) {
    return "Renewed policy document path is required.";
  }

  return "";
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
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}