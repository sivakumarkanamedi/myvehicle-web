import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

type OptimizeRequestBody = {
  service_request_id?: number;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
  limit?: number | null;
};

type ServiceRequestRow = {
  id: number;
  user_id: string;
  vehicle_id: number;
  policy_id: number | null;
  claim_id: number | null;
  requested_services: string[];
  primary_service_id: number | null;
  problem_description: string | null;
  priority_type: string;
  priority_score: number;
  pickup_required: boolean;
  towing_required: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  selected_garage_id: number | null;
  routing_status: string;
};

type ServiceCatalogRow = {
  id: number;
  service_code: string;
  service_name: string;
  service_category: string;
  default_duration_minutes: number | null;
  is_emergency_eligible: boolean;
  is_insurance_eligible: boolean;
};

type GarageCapability = {
  garage_id: number;
  service_id: number;
  is_available: boolean;
  is_certified: boolean;
  supported_vehicle_types: string[];
  supported_brands: string[];
  supported_fuel_types: string[];
  average_duration_minutes: number | null;
  average_price: number | null;
  maximum_daily_jobs: number | null;
  current_skill_rating: number | null;
};

type GarageRow = {
  id: number;
  name: string;
  phone: string | null;
  address_line1: string;
  city: string;
  state: string;

  latitude: number | null;
  longitude: number | null;

  rating: number | null;
  review_count: number;

  is_verified: boolean;
  is_cashless: boolean;
  is_24x7: boolean;
  pickup_drop_available: boolean;
  towing_available: boolean;
  emergency_support_available: boolean;

  estimated_wait_minutes: number | null;
  average_repair_days: number | null;

  supported_vehicle_types: string[];
  supported_brands: string[];
  specializations: string[];

  cashless_garage_insurers?: Array<{
    insurer_name: string;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
  }>;

  garage_partner_capabilities?: GarageCapability[];
};

type CapacitySnapshot = {
  garage_id: number;
  snapshot_at: string;
  total_mechanics: number;
  available_mechanics: number;
  total_service_bays: number;
  available_service_bays: number;
  vehicles_waiting: number;
  vehicles_under_repair: number;
  estimated_queue_minutes: number | null;
  estimated_inspection_start: string | null;
  estimated_repair_start: string | null;
  estimated_completion_at: string | null;
  workload_percent: number | null;
  accepts_new_jobs: boolean;
};

type QueuePreview = {
  queue_position: number;
  estimated_wait_minutes: number;
  estimated_inspection_start: string;
  estimated_repair_start: string;
  estimated_completion_at: string;
  vehicles_waiting: number;
  vehicles_under_repair: number;
  available_mechanics: number;
  available_service_bays: number;
};

type RankedGarage = {
  garage: GarageRow;
  capability: GarageCapability | null;
  capacity: CapacitySnapshot | null;
  distance_km: number | null;
  insurer_match: boolean;
  queue_preview: QueuePreview;
  optimizer_score: number;
  recommendation_reasons: string[];
  warnings: string[];
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_RADIUS_KM = 50;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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
            "You must be signed in to optimize garage appointments.",
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
      (await request.json()) as OptimizeRequestBody;

    const serviceRequestId =
      Number(body.service_request_id);

    if (
      !Number.isInteger(serviceRequestId) ||
      serviceRequestId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "A valid service_request_id is required.",
        },
        { status: 400 }
      );
    }

    const radiusKm =
      normalizeRadius(body.radius_km);

    const limit =
      normalizeLimit(body.limit);

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

    const serviceRequest = await loadServiceRequest(
      adminClient as any,
      serviceRequestId
    );

    if (!serviceRequest) {
      return NextResponse.json(
        {
          error:
            "Garage service request was not found.",
        },
        { status: 404 }
      );
    }

    if (serviceRequest.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "You are not allowed to optimize this service request.",
        },
        { status: 403 }
      );
    }

    const service = await loadPrimaryService(
      adminClient as any,
      serviceRequest.primary_service_id
    );

    if (!service) {
      return NextResponse.json(
        {
          error:
            "A valid primary service must be selected before optimization.",
        },
        { status: 400 }
      );
    }

    const vehicle = await loadVehicle(
      adminClient as any,
      serviceRequest.vehicle_id
    );

    const insurerName = serviceRequest.policy_id
      ? await loadPolicyInsurer(
          adminClient as any,
          serviceRequest.policy_id
        )
      : null;

    const latitude =
      normalizeCoordinate(
        body.latitude,
        serviceRequest.current_latitude
      );

    const longitude =
      normalizeCoordinate(
        body.longitude,
        serviceRequest.current_longitude
      );

    const coordinateError =
      validateCoordinates(
        latitude,
        longitude,
        radiusKm
      );

    if (coordinateError) {
      return NextResponse.json(
        { error: coordinateError },
        { status: 400 }
      );
    }

    const garages = await loadEligibleGarages(
      adminClient as any,
      service.id
    );

    const latestCapacityMap =
      await loadLatestCapacityMap(
        adminClient as any,
        garages.map((garage) => garage.id)
      );

    const ranked: RankedGarage[] = [];

    for (const garage of garages) {
      const capability =
        garage.garage_partner_capabilities?.find(
          (item) =>
            item.service_id === service.id &&
            item.is_available
        ) ?? null;

      if (!capability) continue;

      if (
        !matchesVehicle(
          capability,
          garage,
          vehicle
        )
      ) {
        continue;
      }

      const distanceKm =
        calculateOptionalDistance(
          latitude,
          longitude,
          garage.latitude,
          garage.longitude
        );

      if (
        distanceKm !== null &&
        distanceKm > radiusKm
      ) {
        continue;
      }

      const insurerMatch =
        checkInsurerMatch(
          garage,
          insurerName
        );

      if (
        serviceRequest.claim_id &&
        insurerName &&
        !insurerMatch
      ) {
        continue;
      }

      if (
        serviceRequest.pickup_required &&
        !garage.pickup_drop_available
      ) {
        continue;
      }

      if (
        serviceRequest.towing_required &&
        !garage.towing_available
      ) {
        continue;
      }

      const capacity =
        latestCapacityMap.get(garage.id) ?? null;

      if (
        capacity &&
        !capacity.accepts_new_jobs
      ) {
        continue;
      }

      const queuePreview =
        buildQueuePreview(
          serviceRequest,
          service,
          capability,
          capacity
        );

      const evaluation =
        scoreGarage({
          garage,
          capability,
          capacity,
          queuePreview,
          distanceKm,
          insurerMatch,
          insurerName,
          serviceRequest,
        });

      ranked.push({
        garage,
        capability,
        capacity,
        distance_km:
          distanceKm === null
            ? null
            : Number(distanceKm.toFixed(2)),
        insurer_match: insurerMatch,
        queue_preview: queuePreview,
        optimizer_score:
          evaluation.score,
        recommendation_reasons:
          evaluation.reasons,
        warnings:
          evaluation.warnings,
      });
    }

    ranked.sort((a, b) => {
      if (
        b.optimizer_score !==
        a.optimizer_score
      ) {
        return (
          b.optimizer_score -
          a.optimizer_score
        );
      }

      if (
        a.queue_preview
          .estimated_completion_at !==
        b.queue_preview
          .estimated_completion_at
      ) {
        return (
          new Date(
            a.queue_preview
              .estimated_completion_at
          ).getTime() -
          new Date(
            b.queue_preview
              .estimated_completion_at
          ).getTime()
        );
      }

      if (
        a.distance_km !== null &&
        b.distance_km !== null
      ) {
        return a.distance_km - b.distance_km;
      }

      return 0;
    });

    const results =
      ranked.slice(0, limit);

    const bestGarage =
      results[0] ?? null;

    await adminClient
      .from("garage_service_requests")
      .update({
        routing_status:
          results.length > 0
            ? "partners_found"
            : "analysing",
      })
      .eq("id", serviceRequest.id);

    return NextResponse.json({
      success: true,
      service_request_id:
        serviceRequest.id,
      primary_service: {
        id: service.id,
        service_code:
          service.service_code,
        service_name:
          service.service_name,
        service_category:
          service.service_category,
      },
      optimizer: {
        recommended_garage_id:
          bestGarage?.garage.id ?? null,
        recommended_garage_name:
          bestGarage?.garage.name ?? null,
        total_matches:
          results.length,
      },
      garages: results.map((item, index) => ({
        rank: index + 1,

        garage_id:
          item.garage.id,

        garage_name:
          item.garage.name,

        phone:
          item.garage.phone,

        address:
          `${item.garage.address_line1}, ${item.garage.city}, ${item.garage.state}`,

        distance_km:
          item.distance_km,

        rating:
          item.garage.rating,

        review_count:
          item.garage.review_count,

        is_verified:
          item.garage.is_verified,

        is_cashless:
          item.garage.is_cashless,

        insurer_match:
          item.insurer_match,

        pickup_available:
          item.garage
            .pickup_drop_available,

        towing_available:
          item.garage
            .towing_available,

        emergency_support:
          item.garage
            .emergency_support_available,

        service_certified:
          item.capability
            ?.is_certified ?? false,

        skill_rating:
          item.capability
            ?.current_skill_rating ?? null,

        average_service_price:
          item.capability
            ?.average_price ?? null,

        distance_and_queue: {
          queue_position:
            item.queue_preview
              .queue_position,

          vehicles_waiting:
            item.queue_preview
              .vehicles_waiting,

          vehicles_under_repair:
            item.queue_preview
              .vehicles_under_repair,

          available_mechanics:
            item.queue_preview
              .available_mechanics,

          available_service_bays:
            item.queue_preview
              .available_service_bays,

          estimated_wait_minutes:
            item.queue_preview
              .estimated_wait_minutes,

          estimated_inspection_start:
            item.queue_preview
              .estimated_inspection_start,

          estimated_repair_start:
            item.queue_preview
              .estimated_repair_start,

          estimated_completion_at:
            item.queue_preview
              .estimated_completion_at,
        },

        optimizer_score:
          item.optimizer_score,

        recommendation_reasons:
          item.recommendation_reasons,

        warnings:
          item.warnings,
      })),
    });
  } catch (error) {
    console.error(
      "Garage optimizer route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to optimize garage appointments.",
      },
      { status: 500 }
    );
  }
}

async function loadServiceRequest(
  adminClient: any,
  serviceRequestId: number
): Promise<ServiceRequestRow | null> {
  const { data, error } =
    await adminClient
      .from("garage_service_requests")
      .select(
        `
          id,
          user_id,
          vehicle_id,
          policy_id,
          claim_id,
          requested_services,
          primary_service_id,
          problem_description,
          priority_type,
          priority_score,
          pickup_required,
          towing_required,
          current_latitude,
          current_longitude,
          selected_garage_id,
          routing_status
        `
      )
      .eq("id", serviceRequestId)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | ServiceRequestRow
    | null;
}

async function loadPrimaryService(
  adminClient: any,
  serviceId: number | null
): Promise<ServiceCatalogRow | null> {
  if (!serviceId) return null;

  const { data, error } =
    await adminClient
      .from("garage_service_catalog")
      .select(
        `
          id,
          service_code,
          service_name,
          service_category,
          default_duration_minutes,
          is_emergency_eligible,
          is_insurance_eligible
        `
      )
      .eq("id", serviceId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | ServiceCatalogRow
    | null;
}

async function loadVehicle(
  adminClient: any,
  vehicleId: number
) {
  const { data, error } =
    await adminClient
      .from("vehicles")
      .select(
        `
          id,
          brand,
          model,
          vehicle_type,
          fuel_type
        `
      )
      .eq("id", vehicleId)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | {
        id: number;
        brand: string | null;
        model: string | null;
        vehicle_type: string | null;
        fuel_type: string | null;
      }
    | null;
}

async function loadPolicyInsurer(
  adminClient: any,
  policyId: number
) {
  const { data, error } =
    await adminClient
      .from("insurance_policies")
      .select("insurance_company")
      .eq("id", policyId)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.insurance_company
    ? String(data.insurance_company)
    : null;
}

async function loadEligibleGarages(
  adminClient: any,
  serviceId: number
): Promise<GarageRow[]> {
  const { data, error } =
    await adminClient
      .from("cashless_garages")
      .select(
        `
          id,
          name,
          phone,
          address_line1,
          city,
          state,
          latitude,
          longitude,
          rating,
          review_count,
          is_verified,
          is_cashless,
          is_24x7,
          pickup_drop_available,
          towing_available,
          emergency_support_available,
          estimated_wait_minutes,
          average_repair_days,
          supported_vehicle_types,
          supported_brands,
          specializations,
          cashless_garage_insurers (
            insurer_name,
            is_active,
            valid_from,
            valid_until
          ),
          garage_partner_capabilities!inner (
            garage_id,
            service_id,
            is_available,
            is_certified,
            supported_vehicle_types,
            supported_brands,
            supported_fuel_types,
            average_duration_minutes,
            average_price,
            maximum_daily_jobs,
            current_skill_rating
          )
        `
      )
      .eq("active", true)
      .eq(
        "garage_partner_capabilities.service_id",
        serviceId
      )
      .eq(
        "garage_partner_capabilities.is_available",
        true
      );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GarageRow[];
}

async function loadLatestCapacityMap(
  adminClient: any,
  garageIds: number[]
) {
  const map =
    new Map<number, CapacitySnapshot>();

  if (!garageIds.length) {
    return map;
  }

  const { data, error } =
    await adminClient
      .from("garage_capacity_snapshots")
      .select("*")
      .in("garage_id", garageIds)
      .order("snapshot_at", {
        ascending: false,
      });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of
    (data ?? []) as CapacitySnapshot[]) {
    if (!map.has(row.garage_id)) {
      map.set(row.garage_id, row);
    }
  }

  return map;
}

function buildQueuePreview(
  request: ServiceRequestRow,
  service: ServiceCatalogRow,
  capability: GarageCapability,
  capacity: CapacitySnapshot | null
): QueuePreview {
  const averageDuration =
    capability.average_duration_minutes ??
    service.default_duration_minutes ??
    120;

  const waiting =
    capacity?.vehicles_waiting ?? 0;

  const active =
    capacity?.vehicles_under_repair ?? 0;

  const mechanics =
    capacity?.available_mechanics ?? 0;

  const bays =
    capacity?.available_service_bays ?? 0;

  let queuePosition =
    waiting + 1;

  if (
    request.priority_type ===
    "emergency"
  ) {
    queuePosition = 1;
  } else if (
    request.priority_type ===
    "insurance"
  ) {
    queuePosition = Math.max(
      1,
      Math.ceil(queuePosition * 0.5)
    );
  } else if (
    request.priority_type ===
    "express"
  ) {
    queuePosition = Math.max(
      1,
      Math.ceil(queuePosition * 0.7)
    );
  }

  const parallelCapacity =
    Math.max(
      1,
      Math.min(
        mechanics || 1,
        bays || 1
      )
    );

  const estimatedWait =
    capacity
      ?.estimated_queue_minutes ??
    Math.max(
      0,
      Math.round(
        ((queuePosition - 1) *
          averageDuration) /
          parallelCapacity
      )
    );

  const now =
    new Date();

  const inspectionStart =
    capacity
      ?.estimated_inspection_start
      ? new Date(
          capacity
            .estimated_inspection_start
        )
      : new Date(
          now.getTime() +
            estimatedWait * 60000
        );

  const repairStart =
    capacity
      ?.estimated_repair_start
      ? new Date(
          capacity
            .estimated_repair_start
        )
      : new Date(
          inspectionStart.getTime() +
            30 * 60000
        );

  const completionAt =
    capacity
      ?.estimated_completion_at
      ? new Date(
          capacity
            .estimated_completion_at
        )
      : new Date(
          repairStart.getTime() +
            averageDuration * 60000
        );

  return {
    queue_position:
      queuePosition,

    estimated_wait_minutes:
      estimatedWait,

    estimated_inspection_start:
      inspectionStart.toISOString(),

    estimated_repair_start:
      repairStart.toISOString(),

    estimated_completion_at:
      completionAt.toISOString(),

    vehicles_waiting:
      waiting,

    vehicles_under_repair:
      active,

    available_mechanics:
      mechanics,

    available_service_bays:
      bays,
  };
}

function scoreGarage(args: {
  garage: GarageRow;
  capability: GarageCapability;
  capacity: CapacitySnapshot | null;
  queuePreview: QueuePreview;
  distanceKm: number | null;
  insurerMatch: boolean;
  insurerName: string | null;
  serviceRequest: ServiceRequestRow;
}) {
  const {
    garage,
    capability,
    capacity,
    queuePreview,
    distanceKm,
    insurerMatch,
    insurerName,
    serviceRequest,
  } = args;

  let score = 0;

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (garage.is_verified) {
    score += 18;
    reasons.push("Verified partner");
  }

  if (capability.is_certified) {
    score += 18;
    reasons.push("Certified for selected service");
  }

  if (
    capability.current_skill_rating !==
    null
  ) {
    score += Math.min(
      15,
      capability.current_skill_rating * 3
    );

    if (
      capability.current_skill_rating >=
      4.2
    ) {
      reasons.push("Strong service skill rating");
    }
  }

  if (garage.rating !== null) {
    score += Math.min(
      15,
      garage.rating * 3
    );

    if (garage.rating >= 4.3) {
      reasons.push("Highly rated garage");
    }
  }

  if (
    insurerName &&
    insurerMatch
  ) {
    score += 22;
    reasons.push(
      `Cashless match for ${insurerName}`
    );
  }

  if (
    serviceRequest.pickup_required &&
    garage.pickup_drop_available
  ) {
    score += 8;
    reasons.push(
      "Pickup and drop available"
    );
  }

  if (
    serviceRequest.towing_required &&
    garage.towing_available
  ) {
    score += 8;
    reasons.push("Towing available");
  }

  if (
    serviceRequest.priority_type ===
      "emergency" &&
    garage.emergency_support_available
  ) {
    score += 15;
    reasons.push(
      "Emergency support available"
    );
  }

  if (distanceKm !== null) {
    if (distanceKm <= 5) {
      score += 18;
      reasons.push(
        "Very close to current location"
      );
    } else if (distanceKm <= 15) {
      score += 12;
      reasons.push("Nearby");
    } else if (distanceKm <= 30) {
      score += 6;
    } else {
      warnings.push(
        "Garage is relatively far away"
      );
    }
  }

  if (
    queuePreview
      .estimated_wait_minutes <= 30
  ) {
    score += 20;
    reasons.push("Very short waiting time");
  } else if (
    queuePreview
      .estimated_wait_minutes <= 90
  ) {
    score += 12;
    reasons.push("Reasonable waiting time");
  } else if (
    queuePreview
      .estimated_wait_minutes <= 180
  ) {
    score += 5;
  } else {
    score -= 12;
    warnings.push(
      "Long estimated waiting time"
    );
  }

  if (
    queuePreview.available_mechanics > 0
  ) {
    score += 8;
    reasons.push("Mechanic available");
  } else {
    score -= 10;
    warnings.push(
      "No mechanic currently marked available"
    );
  }

  if (
    queuePreview.available_service_bays > 0
  ) {
    score += 8;
    reasons.push("Service bay available");
  } else {
    score -= 10;
    warnings.push(
      "No service bay currently marked available"
    );
  }

  if (
    capacity?.workload_percent !==
      null &&
    capacity?.workload_percent !==
      undefined
  ) {
    if (
      capacity.workload_percent <= 60
    ) {
      score += 10;
      reasons.push("Balanced garage workload");
    } else if (
      capacity.workload_percent >= 90
    ) {
      score -= 15;
      warnings.push(
        "Garage is heavily occupied"
      );
    }
  }

  if (garage.is_24x7) {
    score += 4;
  }

  return {
    score: Math.round(score),
    reasons:
      reasons.slice(0, 8),
    warnings:
      warnings.slice(0, 5),
  };
}

function matchesVehicle(
  capability: GarageCapability,
  garage: GarageRow,
  vehicle:
    | {
        brand: string | null;
        vehicle_type: string | null;
        fuel_type: string | null;
      }
    | null
) {
  if (!vehicle) return true;

  if (
    vehicle.brand &&
    capability.supported_brands?.length &&
    !includesIgnoreCase(
      capability.supported_brands,
      vehicle.brand
    ) &&
    !includesIgnoreCase(
      garage.supported_brands,
      vehicle.brand
    )
  ) {
    return false;
  }

  if (
    vehicle.vehicle_type &&
    capability
      .supported_vehicle_types
      ?.length &&
    !includesIgnoreCase(
      capability
        .supported_vehicle_types,
      vehicle.vehicle_type
    ) &&
    !includesIgnoreCase(
      garage
        .supported_vehicle_types,
      vehicle.vehicle_type
    )
  ) {
    return false;
  }

  if (
    vehicle.fuel_type &&
    capability.supported_fuel_types
      ?.length &&
    !includesIgnoreCase(
      capability.supported_fuel_types,
      vehicle.fuel_type
    )
  ) {
    return false;
  }

  return true;
}

function checkInsurerMatch(
  garage: GarageRow,
  insurerName: string | null
) {
  if (!insurerName) return true;

  return Boolean(
    garage.cashless_garage_insurers
      ?.some((network) => {
        if (!network.is_active) {
          return false;
        }

        if (
          !network.insurer_name
            .toLowerCase()
            .includes(
              insurerName.toLowerCase()
            )
        ) {
          return false;
        }

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);

        if (
          network.valid_from &&
          network.valid_from > today
        ) {
          return false;
        }

        if (
          network.valid_until &&
          network.valid_until < today
        ) {
          return false;
        }

        return true;
      })
  );
}

function calculateOptionalDistance(
  latitude: number | null,
  longitude: number | null,
  garageLatitude: number | null,
  garageLongitude: number | null
) {
  if (
    latitude === null ||
    longitude === null ||
    garageLatitude === null ||
    garageLongitude === null
  ) {
    return null;
  }

  const earthRadiusKm = 6371;

  const latDifference =
    degreesToRadians(
      garageLatitude - latitude
    );

  const lonDifference =
    degreesToRadians(
      garageLongitude - longitude
    );

  const a =
    Math.sin(
      latDifference / 2
    ) ** 2 +
    Math.cos(
      degreesToRadians(latitude)
    ) *
      Math.cos(
        degreesToRadians(
          garageLatitude
        )
      ) *
      Math.sin(
        lonDifference / 2
      ) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

function degreesToRadians(
  value: number
) {
  return (value * Math.PI) / 180;
}

function includesIgnoreCase(
  values: string[] | null | undefined,
  expected: string
) {
  return Boolean(
    values?.some((value) =>
      value
        .toLowerCase()
        .includes(
          expected.toLowerCase()
        )
    )
  );
}

function normalizeCoordinate(
  provided: number | null | undefined,
  fallback: number | null
) {
  if (
    typeof provided === "number" &&
    Number.isFinite(provided)
  ) {
    return provided;
  }

  return fallback;
}

function normalizeRadius(
  value: number | null | undefined
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_RADIUS_KM;
  }

  return Math.min(
    500,
    Math.max(1, value)
  );
}

function normalizeLimit(
  value: number | null | undefined
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    MAX_LIMIT,
    Math.max(1, value)
  );
}

function validateCoordinates(
  latitude: number | null,
  longitude: number | null,
  radiusKm: number
) {
  if (
    (latitude === null) !==
    (longitude === null)
  ) {
    return (
      "Provide both latitude and longitude, or neither."
    );
  }

  if (
    latitude !== null &&
    (latitude < -90 ||
      latitude > 90)
  ) {
    return "Latitude must be between -90 and 90.";
  }

  if (
    longitude !== null &&
    (longitude < -180 ||
      longitude > 180)
  ) {
    return "Longitude must be between -180 and 180.";
  }

  if (
    radiusKm < 1 ||
    radiusKm > 500
  ) {
    return "Radius must be between 1 and 500 km.";
  }

  return "";
}