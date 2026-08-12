import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");

    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = auth.replace("Bearer ", "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
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
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const reference =
      "SOS-" +
      new Date().getFullYear() +
      "-" +
      crypto.randomBytes(3).toString("hex").toUpperCase();

    const actionMap: Record<string, string> = {
      accident: "Ambulance + Family + Police",
      breakdown: "Roadside Assistance",
      medical: "Nearest Hospital",
      fire: "Emergency Fire Response",
      theft: "Police Assistance",
      fuel: "Fuel Delivery",
      tyre: "Tyre Assistance",
      battery: "Battery Jump Start",
      personal_safety: "Emergency Contact Alert",
      other: "Support Team Review",
    };

    const priorityMap: Record<string, string> = {
      accident: "critical",
      medical: "critical",
      fire: "critical",
      personal_safety: "high",
      theft: "high",
      breakdown: "medium",
      battery: "medium",
      tyre: "medium",
      fuel: "low",
      other: "medium",
    };

    const { data, error: insertError } =
      await supabase
        .from("sos_emergencies")
        .insert({
          user_id: user.id,
          reference,
          emergency_type: body.emergency_type,
          coordinates: body.coordinates,
          notes: body.notes,
          silent_mode: body.silent_mode,
          notify_family: body.notify_family,
          share_live_location:
            body.share_live_location,
          status: "created",
          recommended_action:
            actionMap[
              body.emergency_type
            ] ?? "Support Review",
          priority:
            priorityMap[
              body.emergency_type
            ] ?? "medium",
        })
        .select("id")
        .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      emergency_id: data.id,
      emergency_reference: reference,
      priority:
        priorityMap[
          body.emergency_type
        ],
      recommended_action:
        actionMap[
          body.emergency_type
        ],
      message:
        "Emergency request created successfully. Mira is preparing the recommended response.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}