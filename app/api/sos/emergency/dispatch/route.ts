import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type DispatchService =
  | "ambulance"
  | "fire_service"
  | "police_support"
  | "tow_truck"
  | "mechanic"
  | "fuel_delivery"
  | "tyre_assistance"
  | "battery_assistance"
  | "support_team";

type DispatchBody = {
  emergency_id?: number | null;
  services?: DispatchService[] | null;
  coordinates?: Coordinates | null;
  partner_batch_size?: number | null;
  notify_family?: boolean;
  share_live_location?: boolean;
  notes?: string | null;
};

type EmergencyRow = {
  id: number;
  user_id: string;
  reference: string;
  emergency_type: string;
  priority: string;
  status: string;
  coordinates: Coordinates | null;
  dispatch_services: DispatchService[] | null;
  notify_family: boolean | null;
  share_live_location: boolean | null;
};

type PartnerRow = {
  id: number;
  partner_name: string;
  service_type: DispatchService;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number | null;
  availability_status: string;
  verification_status: string;
  rating: number | null;
};

type DispatchJob = {
  id: number;
  dispatch_reference: string;
  service_type: DispatchService;
  partner_id: number | null;
  partner_name: string | null;
  status: string;
  distance_km: number | null;
  expires_at: string | null;
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
            "You must be signed in to dispatch emergency support.",
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
      (await request.json()) as DispatchBody;

    const emergencyId =
      positiveInteger(body.emergency_id);

    if (!emergencyId) {
      return NextResponse.json(
        {
          error:
            "A valid emergency_id is required.",
        },
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

    const emergency =
      await loadEmergency({
        adminClient: adminClient as any,
        emergencyId,
        userId: user.id,
      });

    if (!emergency) {
      return NextResponse.json(
        {
          error:
            "Emergency record was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const coordinates =
      validateCoordinates(body.coordinates) ??
      validateCoordinates(
        emergency.coordinates
      );

    const requestedServices =
      normalizeServices(
        body.services ??
          emergency.dispatch_services ??
          []
      );

    if (!requestedServices.length) {
      return NextResponse.json(
        {
          error:
            "No dispatch services were selected.",
        },
        { status: 400 }
      );
    }

    const partnerBatchSize =
      clampInteger(
        body.partner_batch_size,
        1,
        8,
        5
      );

    const dispatchJobs: DispatchJob[] = [];

    for (const service of requestedServices) {
      const jobs =
        await createDispatchForService({
          adminClient: adminClient as any,
          emergency,
          service,
          coordinates,
          partnerBatchSize,
          notes:
            cleanNullableText(
              body.notes,
              2000
            ),
        });

      dispatchJobs.push(...jobs);
    }

    const notifyFamily =
      body.notify_family ??
      emergency.notify_family ??
      true;

    const shareLiveLocation =
      body.share_live_location ??
      emergency.share_live_location ??
      true;

    const notificationPlan =
      buildNotificationPlan({
        emergency,
        notifyFamily,
        shareLiveLocation,
        dispatchJobs,
      });

    await saveNotificationPlan({
      adminClient: adminClient as any,
      userId: user.id,
      emergencyId: emergency.id,
      notificationPlan,
      coordinates,
    });

    const now =
      new Date().toISOString();

    const { error: updateError } =
      await adminClient
        .from("sos_emergencies")
        .update({
          status:
            dispatchJobs.length
              ? "dispatching"
              : "dispatch_pending",
          dispatch_started_at:
            now,
          notify_family:
            notifyFamily,
          share_live_location:
            shareLiveLocation,
          updated_at:
            now,
        })
        .eq("id", emergency.id)
        .eq("user_id", user.id);

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    await saveDispatchEvent({
      adminClient: adminClient as any,
      userId: user.id,
      emergency,
      dispatchJobs,
      notificationPlan,
      coordinates,
    });

    return NextResponse.json({
      success: true,
      emergency_id:
        emergency.id,
      emergency_reference:
        emergency.reference,
      dispatch_count:
        dispatchJobs.length,
      dispatch_jobs:
        dispatchJobs,
      notification_plan:
        notificationPlan,
      message:
        dispatchJobs.length
          ? (
              `Mira has sent the emergency request to ` +
              `${dispatchJobs.length} available response partner(s).`
            )
          : (
              "No verified response partners were found nearby. " +
              "The request has been placed in the emergency support queue."
            ),
    });
  } catch (error) {
    console.error(
      "Emergency dispatch error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to dispatch emergency support.",
      },
      { status: 500 }
    );
  }
}

async function loadEmergency(args: {
  adminClient: any;
  emergencyId: number;
  userId: string;
}) {
  const { data, error } =
    await args.adminClient
      .from("sos_emergencies")
      .select(
        `
          id,
          user_id,
          reference,
          emergency_type,
          priority,
          status,
          coordinates,
          dispatch_services,
          notify_family,
          share_live_location
        `
      )
      .eq("id", args.emergencyId)
      .eq("user_id", args.userId)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as EmergencyRow | null;
}

async function createDispatchForService(args: {
  adminClient: any;
  emergency: EmergencyRow;
  service: DispatchService;
  coordinates: Coordinates | null;
  partnerBatchSize: number;
  notes: string | null;
}) {
  const partners =
    await loadPartners({
      adminClient:
        args.adminClient,
      service:
        args.service,
      coordinates:
        args.coordinates,
      limit:
        args.partnerBatchSize,
    });

  const expiresAt =
    new Date(
      Date.now() + 15_000
    ).toISOString();

  if (!partners.length) {
    const dispatchReference =
      generateDispatchReference(
        args.service
      );

    const { data, error } =
      await args.adminClient
        .from("sos_dispatch_jobs")
        .insert({
          user_id:
            args.emergency.user_id,
          emergency_id:
            args.emergency.id,
          dispatch_reference:
            dispatchReference,
          service_type:
            args.service,
          partner_id:
            null,
          partner_name:
            null,
          status:
            "support_queue",
          priority:
            args.emergency.priority,
          coordinates:
            args.coordinates,
          notes:
            args.notes,
          expires_at:
            null,
          created_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .select(
          `
            id,
            dispatch_reference,
            service_type,
            partner_id,
            partner_name,
            status,
            distance_km,
            expires_at
          `
        )
        .single();

    if (error) {
      throw new Error(error.message);
    }

    return [data as DispatchJob];
  }

  const rows =
    partners.map((partner) => ({
      user_id:
        args.emergency.user_id,
      emergency_id:
        args.emergency.id,
      dispatch_reference:
        generateDispatchReference(
          args.service
        ),
      service_type:
        args.service,
      partner_id:
        partner.id,
      partner_name:
        partner.partner_name,
      partner_phone:
        partner.phone,
      status:
        "offered",
      priority:
        args.emergency.priority,
      coordinates:
        args.coordinates,
      distance_km:
        partner.distance_km,
      notes:
        args.notes,
      offer_timeout_seconds:
        15,
      expires_at:
        expiresAt,
      created_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString(),
    }));

  const { data, error } =
    await args.adminClient
      .from("sos_dispatch_jobs")
      .insert(rows)
      .select(
        `
          id,
          dispatch_reference,
          service_type,
          partner_id,
          partner_name,
          status,
          distance_km,
          expires_at
        `
      );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DispatchJob[];
}

async function loadPartners(args: {
  adminClient: any;
  service: DispatchService;
  coordinates: Coordinates | null;
  limit: number;
}) {
  const { data, error } =
    await args.adminClient
      .from("sos_service_partners")
      .select(
        `
          id,
          partner_name,
          service_type,
          phone,
          latitude,
          longitude,
          service_radius_km,
          availability_status,
          verification_status,
          rating
        `
      )
      .eq("service_type", args.service)
      .eq("availability_status", "available")
      .eq("verification_status", "verified")
      .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const partners =
    ((data ?? []) as PartnerRow[])
      .map((partner) => {
        const partnerCoordinates =
          partner.latitude !== null &&
          partner.longitude !== null
            ? {
                latitude:
                  Number(partner.latitude),
                longitude:
                  Number(partner.longitude),
              }
            : null;

        const distanceKm =
          args.coordinates &&
          partnerCoordinates
            ? (
                haversineDistance(
                  args.coordinates,
                  partnerCoordinates
                ) / 1000
              )
            : null;

        return {
          ...partner,
          distance_km:
            distanceKm,
        };
      })
      .filter((partner) => {
        if (
          partner.distance_km === null
        ) {
          return true;
        }

        const serviceRadius =
          Number(
            partner.service_radius_km ??
            25
          );

        return (
          partner.distance_km <=
          serviceRadius
        );
      })
      .sort((first, second) => {
        const firstDistance =
          first.distance_km ??
          Number.MAX_SAFE_INTEGER;

        const secondDistance =
          second.distance_km ??
          Number.MAX_SAFE_INTEGER;

        if (
          firstDistance !==
          secondDistance
        ) {
          return (
            firstDistance -
            secondDistance
          );
        }

        return (
          Number(second.rating ?? 0) -
          Number(first.rating ?? 0)
        );
      })
      .slice(0, args.limit);

  return partners;
}

function buildNotificationPlan(args: {
  emergency: EmergencyRow;
  notifyFamily: boolean;
  shareLiveLocation: boolean;
  dispatchJobs: DispatchJob[];
}) {
  const channels: string[] = [];
  const recipients: string[] = [];

  if (args.notifyFamily) {
    channels.push(
      "sms",
      "push_notification"
    );

    recipients.push(
      "saved_emergency_contacts"
    );
  }

  if (args.shareLiveLocation) {
    channels.push(
      "live_location_link"
    );
  }

  if (
    args.emergency.priority ===
    "critical"
  ) {
    channels.push(
      "high_priority_in_app_alert"
    );
  }

  if (args.dispatchJobs.length) {
    recipients.push(
      "response_partners"
    );
  } else {
    recipients.push(
      "emergency_support_team"
    );
  }

  return {
    channels:
      uniqueStrings(channels),
    recipients:
      uniqueStrings(recipients),
    family_notification:
      args.notifyFamily,
    live_location_sharing:
      args.shareLiveLocation,
    dispatch_partner_count:
      args.dispatchJobs.length,
  };
}

async function saveNotificationPlan(args: {
  adminClient: any;
  userId: string;
  emergencyId: number;
  notificationPlan: Record<string, unknown>;
  coordinates: Coordinates | null;
}) {
  const { error } =
    await args.adminClient
      .from("sos_notification_jobs")
      .insert({
        user_id:
          args.userId,
        emergency_id:
          args.emergencyId,
        notification_type:
          "emergency_dispatch",
        status:
          "pending",
        channels:
          args.notificationPlan.channels,
        recipients:
          args.notificationPlan.recipients,
        payload: {
          notification_plan:
            args.notificationPlan,
          coordinates:
            args.coordinates,
        },
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      });

  if (error) {
    console.warn(
      "Unable to save notification job:",
      error.message
    );
  }
}

async function saveDispatchEvent(args: {
  adminClient: any;
  userId: string;
  emergency: EmergencyRow;
  dispatchJobs: DispatchJob[];
  notificationPlan: Record<string, unknown>;
  coordinates: Coordinates | null;
}) {
  const { error } =
    await args.adminClient
      .from("sos_emergency_events")
      .insert({
        user_id:
          args.userId,
        emergency_id:
          args.emergency.id,
        event_type:
          "dispatch_started",
        event_status:
          args.dispatchJobs.length
            ? "dispatching"
            : "support_queue",
        title:
          "Emergency response dispatch started",
        description:
          args.dispatchJobs.length
            ? (
                `Request offered to ` +
                `${args.dispatchJobs.length} response partner(s).`
              )
            : (
                "No nearby verified partner was available. " +
                "Request moved to the emergency support queue."
              ),
        coordinates:
          args.coordinates,
        metadata: {
          emergency_reference:
            args.emergency.reference,
          dispatch_jobs:
            args.dispatchJobs,
          notification_plan:
            args.notificationPlan,
        },
        created_at:
          new Date().toISOString(),
      });

  if (error) {
    console.warn(
      "Unable to save dispatch event:",
      error.message
    );
  }
}

function normalizeServices(
  values: unknown
) {
  if (!Array.isArray(values)) {
    return [];
  }

  const allowed:
    DispatchService[] = [
      "ambulance",
      "fire_service",
      "police_support",
      "tow_truck",
      "mechanic",
      "fuel_delivery",
      "tyre_assistance",
      "battery_assistance",
      "support_team",
    ];

  return uniqueStrings(
    values
      .map((value) =>
        cleanText(value, 60)
      )
      .filter(
        (value): value is DispatchService =>
          allowed.includes(
            value as DispatchService
          )
      )
  ) as DispatchService[];
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

function haversineDistance(
  first: Coordinates,
  second: Coordinates
) {
  const earthRadius =
    6371000;

  const latitudeOne =
    toRadians(
      first.latitude
    );

  const latitudeTwo =
    toRadians(
      second.latitude
    );

  const latitudeDifference =
    toRadians(
      second.latitude -
      first.latitude
    );

  const longitudeDifference =
    toRadians(
      second.longitude -
      first.longitude
    );

  const value =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(latitudeOne) *
    Math.cos(latitudeTwo) *
    Math.sin(
      longitudeDifference / 2
    ) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(value),
      Math.sqrt(1 - value)
    )
  );
}

function toRadians(
  value: number
) {
  return (
    value *
    (Math.PI / 180)
  );
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

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.round(numeric)
    )
  );
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

function generateDispatchReference(
  service: DispatchService
) {
  const serviceCode =
    service
      .split("_")
      .map((part) =>
        part[0]?.toUpperCase()
      )
      .join("")
      .slice(0, 4);

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
    `DSP-${serviceCode}-` +
    `${datePart}-${randomPart}`
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