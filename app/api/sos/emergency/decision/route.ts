import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type EmergencyType =
  | "accident"
  | "breakdown"
  | "medical"
  | "fire"
  | "personal_safety"
  | "theft"
  | "fuel"
  | "tyre"
  | "battery"
  | "other";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type DecisionBody = {
  emergency_id?: number | null;
  emergency_type?: EmergencyType | null;
  coordinates?: Coordinates | null;

  injuries_reported?: boolean;
  vehicle_mobile?: boolean;
  fire_or_smoke?: boolean;
  personal_threat?: boolean;
  fuel_empty?: boolean;
  tyre_damaged?: boolean;
  battery_dead?: boolean;

  police_required?: boolean;
  ambulance_required?: boolean;
  towing_required?: boolean;

  user_responsive?: boolean;
  silent_mode?: boolean;
  notify_family?: boolean;
  share_live_location?: boolean;

  notes?: string | null;
};

type DecisionResult = {
  priority: "critical" | "high" | "medium" | "low";
  response_mode:
    | "emergency_services"
    | "roadside_assistance"
    | "personal_safety"
    | "police_support"
    | "self_help"
    | "manual_review";

  recommended_actions: string[];
  dispatch_services: string[];
  notify_channels: string[];
  mira_message: string;
  requires_confirmation: boolean;
  escalation_required: boolean;
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

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to use the emergency decision engine.",
        },
        { status: 401 }
      );
    }

    const accessToken = authorization
      .replace("Bearer ", "")
      .trim();

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
        {
          error:
            "Your session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as DecisionBody;

    const emergencyType =
      normalizeEmergencyType(
        body.emergency_type
      );

    if (!emergencyType) {
      return NextResponse.json(
        {
          error:
            "A valid emergency_type is required.",
        },
        { status: 400 }
      );
    }

    const coordinates =
      validateCoordinates(
        body.coordinates
      );

    const decision =
      createEmergencyDecision({
        emergencyType,
        injuriesReported:
          Boolean(body.injuries_reported),
        vehicleMobile:
          body.vehicle_mobile !== false,
        fireOrSmoke:
          Boolean(body.fire_or_smoke),
        personalThreat:
          Boolean(body.personal_threat),
        fuelEmpty:
          Boolean(body.fuel_empty),
        tyreDamaged:
          Boolean(body.tyre_damaged),
        batteryDead:
          Boolean(body.battery_dead),
        policeRequired:
          Boolean(body.police_required),
        ambulanceRequired:
          Boolean(body.ambulance_required),
        towingRequired:
          Boolean(body.towing_required),
        userResponsive:
          body.user_responsive !== false,
        silentMode:
          Boolean(body.silent_mode),
        notifyFamily:
          body.notify_family !== false,
        shareLiveLocation:
          body.share_live_location !== false,
      });

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

    const now =
      new Date().toISOString();

    let emergencyId =
      positiveInteger(
        body.emergency_id
      );

    if (emergencyId) {
      const { data: ownedEmergency, error: ownedError } =
        await adminClient
          .from("sos_emergencies")
          .select("id")
          .eq("id", emergencyId)
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (ownedError) {
        throw new Error(
          ownedError.message
        );
      }

      if (!ownedEmergency) {
        return NextResponse.json(
          {
            error:
              "Emergency record was not found or does not belong to you.",
          },
          { status: 404 }
        );
      }

      const { error: updateError } =
        await adminClient
          .from("sos_emergencies")
          .update({
            priority:
              decision.priority,
            recommended_action:
              decision.recommended_actions.join(
                " | "
              ),
            response_mode:
              decision.response_mode,
            dispatch_services:
              decision.dispatch_services,
            notify_channels:
              decision.notify_channels,
            escalation_required:
              decision.escalation_required,
            decision_result:
              decision,
            coordinates:
              coordinates ?? undefined,
            notes:
              cleanNullableText(
                body.notes,
                2000
              ),
            status:
              decision.escalation_required
                ? "escalated"
                : "decision_completed",
            updated_at:
              now,
          })
          .eq("id", emergencyId)
          .eq("user_id", user.id);

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }
    } else {
      const reference =
        generateEmergencyReference();

      const { data: createdEmergency, error: createError } =
        await adminClient
          .from("sos_emergencies")
          .insert({
            user_id:
              user.id,
            reference,
            emergency_type:
              emergencyType,
            coordinates:
              coordinates,
            notes:
              cleanNullableText(
                body.notes,
                2000
              ),
            silent_mode:
              Boolean(body.silent_mode),
            notify_family:
              body.notify_family !== false,
            share_live_location:
              body.share_live_location !== false,
            priority:
              decision.priority,
            response_mode:
              decision.response_mode,
            recommended_action:
              decision.recommended_actions.join(
                " | "
              ),
            dispatch_services:
              decision.dispatch_services,
            notify_channels:
              decision.notify_channels,
            escalation_required:
              decision.escalation_required,
            decision_result:
              decision,
            status:
              decision.escalation_required
                ? "escalated"
                : "decision_completed",
            created_at:
              now,
            updated_at:
              now,
          })
          .select("id")
          .single();

      if (createError || !createdEmergency) {
        throw new Error(
          createError?.message ||
            "Unable to create emergency decision record."
        );
      }

      emergencyId =
        Number(
          createdEmergency.id
        );
    }

    await saveDecisionAudit({
      adminClient: adminClient as any,
      userId: user.id,
      emergencyId,
      emergencyType,
      decision,
      coordinates,
      notes:
        cleanNullableText(
          body.notes,
          2000
        ),
    });

    return NextResponse.json({
      success: true,
      emergency_id:
        emergencyId,
      decision,
      message:
        decision.mira_message,
    });
  } catch (error) {
    console.error(
      "Emergency decision engine error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process emergency decision.",
      },
      { status: 500 }
    );
  }
}

function createEmergencyDecision(args: {
  emergencyType: EmergencyType;
  injuriesReported: boolean;
  vehicleMobile: boolean;
  fireOrSmoke: boolean;
  personalThreat: boolean;
  fuelEmpty: boolean;
  tyreDamaged: boolean;
  batteryDead: boolean;
  policeRequired: boolean;
  ambulanceRequired: boolean;
  towingRequired: boolean;
  userResponsive: boolean;
  silentMode: boolean;
  notifyFamily: boolean;
  shareLiveLocation: boolean;
}): DecisionResult {
  const recommendedActions: string[] = [];
  const dispatchServices: string[] = [];
  const notifyChannels: string[] = [];

  let priority:
    DecisionResult["priority"] =
      "medium";

  let responseMode:
    DecisionResult["response_mode"] =
      "manual_review";

  let escalationRequired =
    false;

  let requiresConfirmation =
    true;

  if (
    !args.userResponsive ||
    args.injuriesReported ||
    args.ambulanceRequired
  ) {
    priority = "critical";
    responseMode =
      "emergency_services";
    escalationRequired = true;
    requiresConfirmation = false;

    recommendedActions.push(
      "Contact emergency medical services immediately"
    );

    dispatchServices.push(
      "ambulance"
    );
  }

  if (
    args.fireOrSmoke ||
    args.emergencyType === "fire"
  ) {
    priority = "critical";
    responseMode =
      "emergency_services";
    escalationRequired = true;
    requiresConfirmation = false;

    recommendedActions.push(
      "Move away from the vehicle and contact fire services"
    );

    dispatchServices.push(
      "fire_service"
    );
  }

  if (
    args.personalThreat ||
    args.emergencyType ===
      "personal_safety"
  ) {
    priority =
      priority === "critical"
        ? "critical"
        : "high";

    responseMode =
      "personal_safety";
    escalationRequired = true;
    requiresConfirmation = false;

    recommendedActions.push(
      "Activate silent safety response"
    );

    dispatchServices.push(
      "police_support"
    );
  }

  if (
    args.policeRequired ||
    args.emergencyType === "theft"
  ) {
    priority =
      priority === "critical"
        ? "critical"
        : "high";

    responseMode =
      "police_support";
    escalationRequired = true;

    recommendedActions.push(
      "Prepare police assistance and incident details"
    );

    dispatchServices.push(
      "police_support"
    );
  }

  if (
    args.emergencyType === "accident"
  ) {
    if (
      args.injuriesReported ||
      !args.userResponsive
    ) {
      priority = "critical";
      responseMode =
        "emergency_services";
      escalationRequired = true;
      requiresConfirmation = false;
    } else {
      priority = "high";
      responseMode =
        args.vehicleMobile
          ? "manual_review"
          : "roadside_assistance";

      recommendedActions.push(
        "Move to a safe location if possible"
      );

      if (!args.vehicleMobile) {
        dispatchServices.push(
          "tow_truck"
        );
      }
    }
  }

  if (
    args.emergencyType === "breakdown" ||
    args.towingRequired ||
    !args.vehicleMobile
  ) {
    if (
      priority !== "critical"
    ) {
      priority = "medium";
      responseMode =
        "roadside_assistance";
    }

    recommendedActions.push(
      "Arrange roadside assistance"
    );

    dispatchServices.push(
      args.towingRequired ||
      !args.vehicleMobile
        ? "tow_truck"
        : "mechanic"
    );
  }

  if (
    args.emergencyType === "fuel" ||
    args.fuelEmpty
  ) {
    priority = "low";
    responseMode =
      "roadside_assistance";

    recommendedActions.push(
      "Arrange emergency fuel delivery"
    );

    dispatchServices.push(
      "fuel_delivery"
    );
  }

  if (
    args.emergencyType === "tyre" ||
    args.tyreDamaged
  ) {
    priority = "medium";
    responseMode =
      "roadside_assistance";

    recommendedActions.push(
      "Arrange tyre assistance"
    );

    dispatchServices.push(
      "tyre_assistance"
    );
  }

  if (
    args.emergencyType === "battery" ||
    args.batteryDead
  ) {
    priority = "medium";
    responseMode =
      "roadside_assistance";

    recommendedActions.push(
      "Arrange battery jump-start support"
    );

    dispatchServices.push(
      "battery_assistance"
    );
  }

  if (
    args.emergencyType === "medical" &&
    !args.injuriesReported
  ) {
    priority = "critical";
    responseMode =
      "emergency_services";
    escalationRequired = true;
    requiresConfirmation = false;

    recommendedActions.push(
      "Contact emergency medical services"
    );

    dispatchServices.push(
      "ambulance"
    );
  }

  if (
    args.emergencyType === "other" &&
    recommendedActions.length === 0
  ) {
    priority = "medium";
    responseMode =
      "manual_review";

    recommendedActions.push(
      "Route request to the emergency support team"
    );

    dispatchServices.push(
      "support_team"
    );
  }

  if (
    args.notifyFamily
  ) {
    notifyChannels.push(
      "family_contact"
    );
  }

  if (
    args.shareLiveLocation
  ) {
    notifyChannels.push(
      "live_location"
    );
  }

  if (
    args.silentMode
  ) {
    notifyChannels.push(
      "silent_notification"
    );
  } else {
    notifyChannels.push(
      "in_app_alert"
    );
  }

  const uniqueActions =
    uniqueStrings(
      recommendedActions
    );

  const uniqueDispatch =
    uniqueStrings(
      dispatchServices
    );

  const uniqueNotify =
    uniqueStrings(
      notifyChannels
    );

  const miraMessage =
    buildMiraMessage({
      priority,
      responseMode,
      dispatchServices:
        uniqueDispatch,
      escalationRequired,
      silentMode:
        args.silentMode,
    });

  return {
    priority,
    response_mode:
      responseMode,
    recommended_actions:
      uniqueActions,
    dispatch_services:
      uniqueDispatch,
    notify_channels:
      uniqueNotify,
    mira_message:
      miraMessage,
    requires_confirmation:
      requiresConfirmation,
    escalation_required:
      escalationRequired,
  };
}

function buildMiraMessage(args: {
  priority: DecisionResult["priority"];
  responseMode: DecisionResult["response_mode"];
  dispatchServices: string[];
  escalationRequired: boolean;
  silentMode: boolean;
}) {
  if (
    args.silentMode &&
    args.escalationRequired
  ) {
    return (
      "Silent SOS is active. Mira has classified this as a " +
      `${args.priority} priority emergency and prepared the required response without drawing attention.`
    );
  }

  if (
    args.responseMode ===
    "emergency_services"
  ) {
    return (
      "Mira has classified this as a critical emergency. " +
      "Emergency services and saved contacts should be alerted immediately."
    );
  }

  if (
    args.responseMode ===
    "personal_safety"
  ) {
    return (
      "Mira has activated the personal safety response and prepared location sharing and police-support escalation."
    );
  }

  if (
    args.responseMode ===
    "police_support"
  ) {
    return (
      "Mira recommends police assistance and has prepared the emergency details for escalation."
    );
  }

  if (
    args.responseMode ===
    "roadside_assistance"
  ) {
    const services =
      args.dispatchServices
        .map(formatLabel)
        .join(", ");

    return (
      "Mira recommends roadside assistance. " +
      `Suggested service: ${services || "Support team"}.`
    );
  }

  return (
    "Mira has reviewed the emergency and recommends manual support-team review."
  );
}

async function saveDecisionAudit(args: {
  adminClient: any;
  userId: string;
  emergencyId: number;
  emergencyType: EmergencyType;
  decision: DecisionResult;
  coordinates: Coordinates | null;
  notes: string | null;
}) {
  const { error } =
    await args.adminClient
      .from("sos_emergency_events")
      .insert({
        user_id:
          args.userId,
        emergency_id:
          args.emergencyId,
        event_type:
          "decision_completed",
        event_status:
          args.decision
            .escalation_required
            ? "escalated"
            : "completed",
        title:
          "Mira emergency decision completed",
        description:
          args.decision
            .mira_message,
        coordinates:
          args.coordinates,
        metadata: {
          emergency_type:
            args.emergencyType,
          priority:
            args.decision.priority,
          response_mode:
            args.decision
              .response_mode,
          recommended_actions:
            args.decision
              .recommended_actions,
          dispatch_services:
            args.decision
              .dispatch_services,
          notify_channels:
            args.decision
              .notify_channels,
          notes:
            args.notes,
        },
        created_at:
          new Date().toISOString(),
      });

  if (error) {
    console.warn(
      "Unable to save emergency decision audit:",
      error.message
    );
  }
}

function normalizeEmergencyType(
  value: unknown
): EmergencyType | null {
  const allowed:
    EmergencyType[] = [
      "accident",
      "breakdown",
      "medical",
      "fire",
      "personal_safety",
      "theft",
      "fuel",
      "tyre",
      "battery",
      "other",
    ];

  const normalized =
    cleanText(value, 50) as EmergencyType;

  return allowed.includes(
    normalized
  )
    ? normalized
    : null;
}

function validateCoordinates(
  value: unknown
): Coordinates | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const latitude =
    Number(
      (value as Coordinates)
        .latitude
    );

  const longitude =
    Number(
      (value as Coordinates)
        .longitude
    );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function positiveInteger(
  value: unknown
) {
  const numeric =
    Number(value);

  return Number.isInteger(numeric) &&
    numeric > 0
    ? numeric
    : null;
}

function cleanText(
  value: unknown,
  limit = 8000
) {
  return typeof value === "string"
    ? value.trim().slice(0, limit)
    : "";
}

function cleanNullableText(
  value: unknown,
  limit = 8000
) {
  const cleaned =
    cleanText(value, limit);

  return cleaned || null;
}

function uniqueStrings(
  values: string[]
) {
  return Array.from(
    new Set(values)
  );
}

function formatLabel(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function generateEmergencyReference() {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

  return (
    `SOS-${datePart}-` +
    randomPart
  );
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
    }
  | { error: string } {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

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