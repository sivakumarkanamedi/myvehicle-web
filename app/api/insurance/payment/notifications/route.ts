import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const {
      payment_instruction_id,
      channels = ["push", "email", "sms"],
    } = await request.json();

    if (!payment_instruction_id) {
      return NextResponse.json(
        {
          error: "payment_instruction_id is required.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: payment, error } =
      await supabase
        .from("insurance_payment_instructions")
        .select(
          `
            *,
            insurance_claims(*)
          `
        )
        .eq("id", payment_instruction_id)
        .single();

    if (error || !payment) {
      return NextResponse.json(
        {
          error: "Payment not found.",
        },
        { status: 404 }
      );
    }

    const notifications: Array<
      Record<string, unknown>
    > = [];

    if (channels.includes("push")) {
      notifications.push({
        channel: "push",
        status: "queued",
        title: "Payment Update",
        message:
          `Your payment status is ${payment.payment_status}.`,
      });
    }

    if (channels.includes("email")) {
      notifications.push({
        channel: "email",
        status: "queued",
        subject: "Insurance Payment Update",
      });
    }

    if (channels.includes("sms")) {
      notifications.push({
        channel: "sms",
        status: "queued",
        message:
          `Payment ${payment.payment_reference} is ${payment.payment_status}.`,
      });
    }

    const { error: auditError } =
      await supabase
        .from("insurance_payment_audit_log")
        .insert({
          user_id: payment.user_id,
          payment_instruction_id,
          action_type:
            "payment_notifications_queued",
          action_status:
            payment.payment_status,
          actor_type: "system",
          metadata: {
            channels,
            notifications,
          },
        });

    if (auditError) {
      console.error(
        "Unable to write payment notification audit:",
        auditError.message
      );
    }

    return NextResponse.json({
      success: true,
      payment_instruction_id,
      payment_status:
        payment.payment_status,
      notifications,
      message:
        "Notifications queued successfully.",
    });
  } catch (error: unknown) {
    console.error(
      "Payment notification error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to queue payment notifications.",
      },
      { status: 500 }
    );
  }
}