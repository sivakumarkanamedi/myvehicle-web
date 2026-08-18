import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SosMode = "normal" | "silent";

type SosRequestBody = {
  mode?: SosMode;
  emergency_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  destination?: string | null;
  navigation_status?: string | null;
  speed_kph?: number | null;
  selected_vehicle_id?: number | null;
  selected_vehicle_registration?: string | null;
  share_location?: boolean;
  notify_contacts?: boolean;
  message?: string | null;
  contact_ids?: number[];
  created_at?: string | null;
};

type EmergencyContact = {
  id: number;
  contact_name: string;
  relationship: string | null;
  mobile_number: string;
  is_primary: boolean;
  is_active: boolean;
};

function createSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
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
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function isValidLatitude(value: number | null | undefined) {
  return (
    value === null ||
    value === undefined ||
    (Number.isFinite(value) && value >= -90 && value <= 90)
  );
}

function isValidLongitude(value: number | null | undefined) {
  return (
    value === null ||
    value === undefined ||
    (Number.isFinite(value) && value >= -180 && value <= 180)
  );
}

function normalizeMode(value: unknown): SosMode {
  return value === "silent" ? "silent" : "normal";
}

function normalizeText(
  value: unknown,
  maximumLength: number
) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  if (!normalized) return null;

  return normalized.slice(0, maximumLength);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object"
  ) {
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

  return "Unable to create the SOS event.";
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Authorization token is required.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SosRequestBody;

    if (!isValidLatitude(body.latitude)) {
      return NextResponse.json(
        {
          error: "Latitude must be between -90 and 90.",
        },
        { status: 400 }
      );
    }

    if (!isValidLongitude(body.longitude)) {
      return NextResponse.json(
        {
          error: "Longitude must be between -180 and 180.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Your session has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    const duplicateWindowStart = new Date(
      Date.now() - 60_000
    ).toISOString();

    const { data: recentSos, error: recentSosError } =
      await supabase
        .from("sos_events")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .in("status", ["triggered", "acknowledged"])
        .gte("created_at", duplicateWindowStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (recentSosError) {
      throw new Error(
        `Unable to read SOS events: ${getErrorMessage(
          recentSosError
        )}`
      );
    }

    if (recentSos) {
      return NextResponse.json(
        {
          success: true,
          duplicate: true,
          event_id: recentSos.id,
          status: recentSos.status,
          message:
            "An SOS event is already active. Mira will not create a duplicate alert.",
        },
        { status: 200 }
      );
    }

    const {
      data: emergencyContacts,
      error: contactsError,
    } = await supabase
      .from("emergency_contacts")
      .select(
        "id, contact_name, relationship, mobile_number, is_primary, is_active"
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (contactsError) {
      throw new Error(
        `Unable to load emergency contacts: ${getErrorMessage(
          contactsError
        )}`
      );
    }

    const contacts =
      (emergencyContacts || []) as EmergencyContact[];

    const mode = normalizeMode(body.mode);

    const eventPayload = {
      user_id: user.id,
      vehicle_id:
        typeof body.selected_vehicle_id === "number"
          ? body.selected_vehicle_id
          : null,
      vehicle_registration: normalizeText(
        body.selected_vehicle_registration,
        30
      ),
      mode,
      latitude:
        typeof body.latitude === "number"
          ? body.latitude
          : null,
      longitude:
        typeof body.longitude === "number"
          ? body.longitude
          : null,
      destination: normalizeText(body.destination, 300),
      navigation_status: normalizeText(
        body.navigation_status,
        40
      ),
      speed_kph:
        typeof body.speed_kph === "number" &&
        Number.isFinite(body.speed_kph)
          ? Math.max(0, Math.min(body.speed_kph, 400))
          : null,
      status: "triggered",
      contact_count: contacts.length,
      contact_snapshot: contacts.map((contact) => ({
        id: contact.id,
        name: contact.contact_name,
        relationship: contact.relationship,
        mobile: contact.mobile_number,
        primary: contact.is_primary,
      })),
      triggered_at: new Date().toISOString(),
    };

    const { data: createdEvent, error: insertError } =
      await supabase
        .from("sos_events")
        .insert(eventPayload)
        .select(
          "id, status, mode, latitude, longitude, contact_count, created_at"
        )
        .single();

    if (insertError) {
      throw new Error(
        `Unable to create SOS event: ${getErrorMessage(
          insertError
        )}`
      );
    }

    /*
     * Future production integrations:
     * - SMS provider
     * - WhatsApp Business provider
     * - emergency partner dispatch
     * - push notifications
     *
     * Do not claim contacts were notified until one of those
     * providers returns a confirmed delivery or acceptance result.
     */

    return NextResponse.json({
      success: true,
      duplicate: false,
      event_id: createdEvent.id,
      status: createdEvent.status,
      mode: createdEvent.mode,
      coordinates:
        createdEvent.latitude !== null &&
        createdEvent.longitude !== null
          ? {
              latitude: createdEvent.latitude,
              longitude: createdEvent.longitude,
            }
          : null,
      emergency_contacts_found: createdEvent.contact_count,
      contacts_notified: 0,
      message:
        contacts.length > 0
          ? "SOS event saved successfully. Emergency contacts are ready for future SMS, WhatsApp or dispatch integration."
          : "SOS event saved successfully, but no active emergency contact is configured.",
    });
  } catch (error: unknown) {
    console.error("SOS API error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Authorization token is required.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      event_id?: number;
      action?: "cancel" | "acknowledge" | "resolve";
      resolution_note?: string | null;
    };

    if (
      typeof body.event_id !== "number" ||
      !Number.isInteger(body.event_id)
    ) {
      return NextResponse.json(
        {
          error: "A valid SOS event ID is required.",
        },
        { status: 400 }
      );
    }

    const statusMap = {
      cancel: "cancelled",
      acknowledge: "acknowledged",
      resolve: "resolved",
    } as const;

    const nextStatus =
      body.action && statusMap[body.action];

    if (!nextStatus) {
      return NextResponse.json(
        {
          error:
            "Action must be cancel, acknowledge or resolve.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Your session has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    const timestampColumn =
      nextStatus === "cancelled"
        ? "cancelled_at"
        : nextStatus === "acknowledged"
          ? "acknowledged_at"
          : "resolved_at";

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      [timestampColumn]: new Date().toISOString(),
    };

    const resolutionNote = normalizeText(
      body.resolution_note,
      500
    );

    if (resolutionNote) {
      updatePayload.resolution_note = resolutionNote;
    }

    const { data: updatedEvent, error: updateError } =
      await supabase
        .from("sos_events")
        .update(updatePayload)
        .eq("id", body.event_id)
        .eq("user_id", user.id)
        .select("id, status, updated_at")
        .single();

    if (updateError) {
      throw new Error(
        `Unable to update SOS event: ${getErrorMessage(
          updateError
        )}`
      );
    }

    return NextResponse.json({
      success: true,
      event_id: updatedEvent.id,
      status: updatedEvent.status,
      message: `SOS event marked as ${updatedEvent.status}.`,
    });
  } catch (error: unknown) {
    console.error("SOS API update error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}