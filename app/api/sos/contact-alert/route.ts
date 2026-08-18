import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ContactAlertRequest = {
  sos_event_id?: number;
  contact_id?: number;
  emergency_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vehicle_registration?: string | null;
  message?: string | null;
};

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

function createSupabaseClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(
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
        detectSessionInUrl: false,
      },
    }
  );
}

function normalizeText(
  value: unknown,
  maximumLength: number
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maximumLength);
}

function isValidLatitude(
  value: number | null | undefined
) {
  return (
    value === null ||
    value === undefined ||
    (Number.isFinite(value) &&
      value >= -90 &&
      value <= 90)
  );
}

function isValidLongitude(
  value: number | null | undefined
) {
  return (
    value === null ||
    value === undefined ||
    (Number.isFinite(value) &&
      value >= -180 &&
      value <= 180)
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof candidate.message === "string"
        ? candidate.message
        : null,
      typeof candidate.details === "string"
        ? candidate.details
        : null,
      typeof candidate.hint === "string"
        ? candidate.hint
        : null,
      typeof candidate.code === "string"
        ? `Code: ${candidate.code}`
        : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return "Unable to create trusted-contact alert.";
}

export async function POST(request: Request) {
  try {
    const accessToken =
      getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Authorization token is required.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as ContactAlertRequest;

    if (
      typeof body.sos_event_id !== "number" ||
      !Number.isInteger(body.sos_event_id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid SOS event ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof body.contact_id !== "number" ||
      !Number.isInteger(body.contact_id)
    ) {
      return NextResponse.json(
        {
          error:
            "A valid emergency contact ID is required.",
        },
        { status: 400 }
      );
    }

    if (!isValidLatitude(body.latitude)) {
      return NextResponse.json(
        {
          error:
            "Latitude must be between -90 and 90.",
        },
        { status: 400 }
      );
    }

    if (!isValidLongitude(body.longitude)) {
      return NextResponse.json(
        {
          error:
            "Longitude must be between -180 and 180.",
        },
        { status: 400 }
      );
    }

    const supabase =
      createSupabaseClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Your session has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    const {
      data: sosEvent,
      error: sosEventError,
    } = await supabase
      .from("sos_events")
      .select(
        "id, user_id, status, latitude, longitude, vehicle_registration"
      )
      .eq("id", body.sos_event_id)
      .eq("user_id", user.id)
      .single();

    if (sosEventError || !sosEvent) {
      throw new Error(
        `Unable to load SOS event: ${getErrorMessage(
          sosEventError
        )}`
      );
    }

    const {
      data: contact,
      error: contactError,
    } = await supabase
      .from("emergency_contacts")
      .select(
        "id, user_id, contact_name, relationship, mobile_number, is_primary, is_active"
      )
      .eq("id", body.contact_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (contactError || !contact) {
      throw new Error(
        `Unable to load emergency contact: ${getErrorMessage(
          contactError
        )}`
      );
    }

    const alertToken =
      crypto.randomUUID();

    const latitude =
      typeof body.latitude === "number"
        ? body.latitude
        : sosEvent.latitude;

    const longitude =
      typeof body.longitude === "number"
        ? body.longitude
        : sosEvent.longitude;

    const vehicleRegistration =
      normalizeText(
        body.vehicle_registration,
        30
      ) ||
      sosEvent.vehicle_registration ||
      null;

    const emergencyType =
      normalizeText(
        body.emergency_type,
        80
      ) || "Emergency SOS";

    const message =
      normalizeText(body.message, 1200) ||
      "My Vehicle emergency alert. Please check the live location and acknowledge immediately.";

    const { data: alert, error: insertError } =
      await supabase
        .from("sos_contact_alerts")
        .insert({
          user_id: user.id,
          sos_event_id: sosEvent.id,
          contact_id: contact.id,
          contact_name: contact.contact_name,
          relationship: contact.relationship,
          mobile_number: contact.mobile_number,
          emergency_type: emergencyType,
          vehicle_registration:
            vehicleRegistration,
          latitude,
          longitude,
          message,
          alert_token: alertToken,
          status: "queued",
          attempt_count: 0,
          queued_at: new Date().toISOString(),
        })
        .select(
          "id, sos_event_id, contact_id, status, alert_token, queued_at"
        )
        .single();

    if (insertError || !alert) {
      throw new Error(
        `Unable to create trusted-contact alert: ${getErrorMessage(
          insertError
        )}`
      );
    }

    return NextResponse.json({
      success: true,
      alert_id: alert.id,
      sos_event_id: alert.sos_event_id,
      contact_id: alert.contact_id,
      status: alert.status,
      alert_token: alert.alert_token,
      queued_at: alert.queued_at,
      message:
        "Trusted-contact emergency alert queued successfully.",
    });
  } catch (error: unknown) {
    console.error(
      "Trusted-contact alert API error:",
      error
    );

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}