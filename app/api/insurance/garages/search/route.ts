import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

type GarageRow = {
  id: number;
  name: string;
  legal_name: string | null;
  garage_code: string | null;

  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  website_url: string | null;

  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;

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

  opening_time: string | null;
  closing_time: string | null;
  weekly_off_days: string[];

  specializations: string[];
  supported_vehicle_types: string[];
  supported_brands: string[];

  estimated_wait_minutes: number | null;
  average_repair_days: number | null;

  active: boolean;

  cashless_garage_insurers?: Array<{
    insurer_name: string;
    insurer_code: string | null;
    network_type: string;
    valid_from: string | null;
    valid_until: string | null;
    is_active: boolean;
  }>;

  cashless_garage_services?: Array<{
    id: number;
    service_code: string | null;
    service_name: string;
    service_category: string;
    description: string | null;
    estimated_duration_minutes: number | null;
    starting_price: number | null;
    is_available: boolean;
  }>;
};

type RankedGarage = GarageRow & {
  distance_km: number | null;
  is_open_now: boolean | null;
  insurer_cashless_match: boolean;
  mira_score: number;
  recommendation_reasons: string[];
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_RADIUS_KM = 50;

export async function GET(request: NextRequest) {
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
            "You must be signed in to search cashless garages.",
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

    const params = request.nextUrl.searchParams;

    const latitude = parseOptionalNumber(
      params.get("latitude")
    );

    const longitude = parseOptionalNumber(
      params.get("longitude")
    );

    const radiusKm =
      parseOptionalNumber(params.get("radiusKm")) ??
      DEFAULT_RADIUS_KM;

    const limit = clampInteger(
      params.get("limit"),
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );

    const city = cleanOptionalString(
      params.get("city")
    );

    const state = cleanOptionalString(
      params.get("state")
    );

    const insurer = cleanOptionalString(
      params.get("insurer")
    );

    const brand = cleanOptionalString(
      params.get("brand")
    );

    const vehicleType = cleanOptionalString(
      params.get("vehicleType")
    );

    const specialization = cleanOptionalString(
      params.get("specialization")
    );

    const serviceCategory = cleanOptionalString(
      params.get("serviceCategory")
    );

    const emergencyOnly =
      parseBoolean(params.get("emergencyOnly"));

    const pickupDropOnly =
      parseBoolean(params.get("pickupDropOnly"));

    const towingOnly =
      parseBoolean(params.get("towingOnly"));

    const verifiedOnly =
      parseBoolean(params.get("verifiedOnly"));

    const openNowOnly =
      parseBoolean(params.get("openNowOnly"));

    const cashlessOnly =
      params.get("cashlessOnly") === null
        ? true
        : parseBoolean(params.get("cashlessOnly"));

    const validationError = validateCoordinates(
      latitude,
      longitude,
      radiusKm
    );

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

    let query = adminClient
      .from("cashless_garages")
      .select(
        `
          id,
          name,
          legal_name,
          garage_code,
          phone,
          alternate_phone,
          email,
          website_url,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
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
          opening_time,
          closing_time,
          weekly_off_days,
          specializations,
          supported_vehicle_types,
          supported_brands,
          estimated_wait_minutes,
          average_repair_days,
          active,
          cashless_garage_insurers (
            insurer_name,
            insurer_code,
            network_type,
            valid_from,
            valid_until,
            is_active
          ),
          cashless_garage_services (
            id,
            service_code,
            service_name,
            service_category,
            description,
            estimated_duration_minutes,
            starting_price,
            is_available
          )
        `
      )
      .eq("active", true);

    if (cashlessOnly) {
      query = query.eq("is_cashless", true);
    }

    if (verifiedOnly) {
      query = query.eq("is_verified", true);
    }

    if (emergencyOnly) {
      query = query.eq(
        "emergency_support_available",
        true
      );
    }

    if (pickupDropOnly) {
      query = query.eq(
        "pickup_drop_available",
        true
      );
    }

    if (towingOnly) {
      query = query.eq(
        "towing_available",
        true
      );
    }

    if (city) {
      query = query.ilike("city", city);
    }

    if (state) {
      query = query.ilike("state", state);
    }

    const { data, error } = await query.limit(300);

    if (error) {
      console.error(
        "Cashless garage search error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Unable to search cashless garages.",
        },
        { status: 500 }
      );
    }

    let garages = ((data ?? []) as GarageRow[])
      .map((garage) =>
        rankGarage(garage, {
          latitude,
          longitude,
          insurer,
          brand,
          vehicleType,
          specialization,
          serviceCategory,
        })
      )
      .filter((garage) => {
        if (
          latitude !== null &&
          longitude !== null &&
          garage.distance_km !== null &&
          garage.distance_km > radiusKm
        ) {
          return false;
        }

        if (
          insurer &&
          !garage.insurer_cashless_match
        ) {
          return false;
        }

        if (
          brand &&
          !includesIgnoreCase(
            garage.supported_brands,
            brand
          )
        ) {
          return false;
        }

        if (
          vehicleType &&
          !includesIgnoreCase(
            garage.supported_vehicle_types,
            vehicleType
          )
        ) {
          return false;
        }

        if (
          specialization &&
          !includesIgnoreCase(
            garage.specializations,
            specialization
          )
        ) {
          return false;
        }

        if (
          serviceCategory &&
          !garage.cashless_garage_services?.some(
            (service) =>
              service.is_available &&
              service.service_category
                .toLowerCase()
                .includes(
                  serviceCategory.toLowerCase()
                )
          )
        ) {
          return false;
        }

        if (
          openNowOnly &&
          garage.is_open_now !== true
        ) {
          return false;
        }

        return true;
      });

    garages = garages
      .sort((a, b) => {
        if (b.mira_score !== a.mira_score) {
          return b.mira_score - a.mira_score;
        }

        if (
          a.distance_km !== null &&
          b.distance_km !== null &&
          a.distance_km !== b.distance_km
        ) {
          return a.distance_km - b.distance_km;
        }

        return (
          (b.rating ?? 0) -
          (a.rating ?? 0)
        );
      })
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      count: garages.length,
      search: {
        latitude,
        longitude,
        radius_km: radiusKm,
        city,
        state,
        insurer,
        brand,
        vehicle_type: vehicleType,
        specialization,
        service_category: serviceCategory,
        emergency_only: emergencyOnly,
        pickup_drop_only: pickupDropOnly,
        towing_only: towingOnly,
        verified_only: verifiedOnly,
        open_now_only: openNowOnly,
        cashless_only: cashlessOnly,
      },
      garages,
    });
  } catch (error) {
    console.error(
      "Cashless garage route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to search cashless garages.",
      },
      { status: 500 }
    );
  }
}

function rankGarage(
  garage: GarageRow,
  filters: {
    latitude: number | null;
    longitude: number | null;
    insurer: string | null;
    brand: string | null;
    vehicleType: string | null;
    specialization: string | null;
    serviceCategory: string | null;
  }
): RankedGarage {
  const distanceKm =
    filters.latitude !== null &&
    filters.longitude !== null &&
    garage.latitude !== null &&
    garage.longitude !== null
      ? calculateDistanceKm(
          filters.latitude,
          filters.longitude,
          Number(garage.latitude),
          Number(garage.longitude)
        )
      : null;

  const insurerCashlessMatch =
    !filters.insurer ||
    Boolean(
      garage.cashless_garage_insurers?.some(
        (network) =>
          network.is_active &&
          network.insurer_name
            .toLowerCase()
            .includes(
              filters.insurer!.toLowerCase()
            ) &&
          isNetworkCurrentlyValid(network)
      )
    );

  const isOpenNow = getOpenStatus(garage);

  let score = 0;
  const reasons: string[] = [];

  if (garage.is_verified) {
    score += 20;
    reasons.push("Verified garage");
  }

  if (garage.is_cashless) {
    score += 15;
    reasons.push("Cashless service available");
  }

  if (insurerCashlessMatch && filters.insurer) {
    score += 25;
    reasons.push(
      `Cashless network match for ${filters.insurer}`
    );
  }

  if (garage.rating !== null) {
    score += Math.min(20, garage.rating * 4);

    if (garage.rating >= 4.3) {
      reasons.push("Highly rated");
    }
  }

  if (distanceKm !== null) {
    if (distanceKm <= 5) {
      score += 20;
      reasons.push("Very close to your location");
    } else if (distanceKm <= 15) {
      score += 14;
      reasons.push("Nearby");
    } else if (distanceKm <= 30) {
      score += 8;
    }
  }

  if (isOpenNow === true) {
    score += 8;
    reasons.push("Open now");
  }

  if (garage.is_24x7) {
    score += 8;
    reasons.push("24×7 support");
  }

  if (garage.pickup_drop_available) {
    score += 5;
    reasons.push("Pickup and drop available");
  }

  if (garage.towing_available) {
    score += 5;
    reasons.push("Towing available");
  }

  if (
    garage.emergency_support_available
  ) {
    score += 5;
    reasons.push("Emergency support available");
  }

  if (
    filters.brand &&
    includesIgnoreCase(
      garage.supported_brands,
      filters.brand
    )
  ) {
    score += 10;
    reasons.push(
      `Supports ${filters.brand} vehicles`
    );
  }

  if (
    filters.specialization &&
    includesIgnoreCase(
      garage.specializations,
      filters.specialization
    )
  ) {
    score += 10;
    reasons.push(
      `${filters.specialization} specialization`
    );
  }

  if (
    filters.serviceCategory &&
    garage.cashless_garage_services?.some(
      (service) =>
        service.is_available &&
        service.service_category
          .toLowerCase()
          .includes(
            filters.serviceCategory!.toLowerCase()
          )
    )
  ) {
    score += 8;
    reasons.push(
      `Provides ${filters.serviceCategory} service`
    );
  }

  if (
    garage.estimated_wait_minutes !== null
  ) {
    if (garage.estimated_wait_minutes <= 30) {
      score += 8;
      reasons.push("Low estimated waiting time");
    } else if (
      garage.estimated_wait_minutes <= 60
    ) {
      score += 4;
    }
  }

  return {
    ...garage,
    distance_km:
      distanceKm === null
        ? null
        : Number(distanceKm.toFixed(2)),
    is_open_now: isOpenNow,
    insurer_cashless_match:
      insurerCashlessMatch,
    mira_score: Math.round(score),
    recommendation_reasons:
      reasons.slice(0, 6),
  };
}

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusKm = 6371;

  const latitudeDifference =
    degreesToRadians(lat2 - lat1);

  const longitudeDifference =
    degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * centralAngle;
}

function degreesToRadians(
  value: number
) {
  return (value * Math.PI) / 180;
}

function getOpenStatus(
  garage: GarageRow
): boolean | null {
  if (garage.is_24x7) {
    return true;
  }

  if (
    !garage.opening_time ||
    !garage.closing_time
  ) {
    return null;
  }

  const now = new Date();

  const weekday = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    })
    .toLowerCase();

  if (
    garage.weekly_off_days?.some(
      (day) =>
        day.toLowerCase() === weekday
    )
  ) {
    return false;
  }

  const currentMinutes = getIndiaMinutes();

  const openingMinutes =
    timeToMinutes(garage.opening_time);

  const closingMinutes =
    timeToMinutes(garage.closing_time);

  if (
    openingMinutes === null ||
    closingMinutes === null
  ) {
    return null;
  }

  if (closingMinutes > openingMinutes) {
    return (
      currentMinutes >= openingMinutes &&
      currentMinutes <= closingMinutes
    );
  }

  return (
    currentMinutes >= openingMinutes ||
    currentMinutes <= closingMinutes
  );
}

function getIndiaMinutes() {
  const parts = new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).formatToParts(new Date());

  const hour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value ?? 0
  );

  const minute = Number(
    parts.find(
      (part) => part.type === "minute"
    )?.value ?? 0
  );

  return hour * 60 + minute;
}

function timeToMinutes(
  value: string
) {
  const match = value.match(
    /^(\d{1,2}):(\d{2})/
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function isNetworkCurrentlyValid(
  network: {
    valid_from: string | null;
    valid_until: string | null;
  }
) {
  const today =
    new Date().toISOString().slice(0, 10);

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
}

function includesIgnoreCase(
  values: string[] | null | undefined,
  expected: string
) {
  return Boolean(
    values?.some((value) =>
      value
        .toLowerCase()
        .includes(expected.toLowerCase())
    )
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
      "Provide both latitude and longitude, " +
      "or neither."
    );
  }

  if (
    latitude !== null &&
    (latitude < -90 || latitude > 90)
  ) {
    return "Latitude must be between -90 and 90.";
  }

  if (
    longitude !== null &&
    (longitude < -180 || longitude > 180)
  ) {
    return "Longitude must be between -180 and 180.";
  }

  if (
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    radiusKm > 500
  ) {
    return "radiusKm must be between 1 and 500.";
  }

  return "";
}

function parseOptionalNumber(
  value: string | null
) {
  if (
    value === null ||
    value.trim() === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseBoolean(
  value: string | null
) {
  if (!value) {
    return false;
  }

  return [
    "true",
    "1",
    "yes",
    "on",
  ].includes(value.toLowerCase());
}

function clampInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed)
  );
}

function cleanOptionalString(
  value: string | null
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}