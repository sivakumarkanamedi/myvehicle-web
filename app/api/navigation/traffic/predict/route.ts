import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type TrafficPredictionBody = {
  origin?: Coordinates;
  destination?: Coordinates;

  planned_departure_time?: string | null;

  avoid_tolls?: boolean;
  avoid_highways?: boolean;
  avoid_ferries?: boolean;

  vehicle_type?: "car" | "two_wheeler";
  allow_narrow_shortcuts?: boolean;

  minimum_time_saving_minutes?: number;
  strong_warning_minutes?: number;

  current_route_duration_seconds?: number | null;
  current_route_distance_meters?: number | null;

  language_code?: string;
};

type GoogleRoute = {
  routeLabels?: string[];
  description?: string;
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;

  polyline?: {
    encodedPolyline?: string;
  };

  travelAdvisory?: {
    speedReadingIntervals?: Array<{
      startPolylinePointIndex?: number;
      endPolylinePointIndex?: number;
      speed?: "NORMAL" | "SLOW" | "TRAFFIC_JAM";
    }>;
  };
};

type RouteOption = {
  route_index: number;
  route_type: "default" | "alternative";

  distance_meters: number;
  distance_km: number;

  traffic_duration_seconds: number;
  traffic_duration_minutes: number;

  normal_duration_seconds: number;
  normal_duration_minutes: number;

  traffic_delay_seconds: number;
  traffic_delay_minutes: number;

  estimated_arrival_time: string;

  encoded_polyline: string | null;

  congestion: {
    normal_segments: number;
    slow_segments: number;
    traffic_jam_segments: number;
    overall_level: "light" | "moderate" | "heavy" | "severe";
  };

  description: string | null;
};

type Recommendation = {
  should_reroute: boolean;
  urgency: "none" | "suggestion" | "strong";
  recommended_route_index: number;

  current_route_index: number;
  time_saved_seconds: number;
  time_saved_minutes: number;

  distance_difference_meters: number;
  distance_difference_km: number;

  reason: string;
  mira_message: string;

  actions: Array<
    "take_faster_route" | "show_comparison" | "stay_on_current_route"
  >;
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
            "You must be signed in to use Mira traffic prediction.",
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

    let body: TrafficPredictionBody;

    try {
      body = (await request.json()) as TrafficPredictionBody;
    } catch {
      return NextResponse.json(
        {
          error: "The request body must be valid JSON.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const origin = validateCoordinates(body.origin);
    const destination = validateCoordinates(
      body.destination
    );

    if (!origin || !destination) {
      return NextResponse.json(
        {
          error:
            "Valid origin and destination coordinates are required.",
        },
        { status: 400 }
      );
    }

    const minimumSavingMinutes = clampNumber(
      body.minimum_time_saving_minutes,
      1,
      60,
      5
    );

    const strongWarningMinutes = clampNumber(
      body.strong_warning_minutes,
      minimumSavingMinutes,
      120,
      10
    );

    const departureTime = normalizeDepartureTime(
      body.planned_departure_time
    );

    if (
      body.planned_departure_time &&
      !departureTime
    ) {
      return NextResponse.json(
        {
          error:
            "Departure time must be a valid current or future date and time.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const googleResponse = await computeGoogleRoutes({
      apiKey: environment.googleMapsApiKey,
      origin,
      destination,
      departureTime,
      avoidTolls: Boolean(body.avoid_tolls),
      avoidHighways: Boolean(body.avoid_highways),
      avoidFerries: Boolean(body.avoid_ferries),
      vehicleType:
        body.vehicle_type === "two_wheeler"
          ? "TWO_WHEELER"
          : "DRIVE",
      languageCode:
        cleanText(body.language_code, 20) ||
        "en-IN",
    });

    const routes = googleResponse.routes ?? [];

    if (!routes.length) {
      return NextResponse.json(
        {
          error:
            "No route was found between the selected locations.",
        },
        { status: 404 }
      );
    }

    const departureDate =
      departureTime
        ? new Date(departureTime)
        : new Date();

    const routeOptions = routes.map(
      (route, index) =>
        transformRoute(
          route,
          index,
          departureDate
        )
    );

    const recommendation = buildRecommendation({
      routes: routeOptions,
      currentRouteDurationSeconds:
        cleanNonNegativeNumber(
          body.current_route_duration_seconds
        ),
      currentRouteDistanceMeters:
        cleanNonNegativeNumber(
          body.current_route_distance_meters
        ),
      minimumSavingMinutes,
      strongWarningMinutes,
      allowNarrowShortcuts:
        Boolean(body.allow_narrow_shortcuts),
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

    await saveTrafficAnalysis({
      adminClient,
      userId: user.id,
      origin,
      destination,
      departureTime:
        departureTime ??
        new Date().toISOString(),
      routeOptions,
      recommendation,
      preferences: {
        avoid_tolls:
          Boolean(body.avoid_tolls),
        avoid_highways:
          Boolean(body.avoid_highways),
        avoid_ferries:
          Boolean(body.avoid_ferries),
        vehicle_type:
          body.vehicle_type ?? "car",
        allow_narrow_shortcuts:
          Boolean(body.allow_narrow_shortcuts),
      },
    });

    return NextResponse.json({
      success: true,

      analysis_time:
        new Date().toISOString(),

      departure_time:
        departureTime ??
        new Date().toISOString(),

      origin,
      destination,

      route_count:
        routeOptions.length,

      routes:
        routeOptions,

      recommendation,

      disclaimer:
        "Traffic and time savings are estimates based on available map traffic data and can change during the journey.",
      integration_status: {
        live_traffic: true,
        alternative_routes: true,
        road_closures: "provider_dependent",
        weather_impact: "not_connected",
        signal_countdown: "not_connected",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "Mira traffic prediction error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyse traffic routes.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

async function computeGoogleRoutes(args: {
  apiKey: string;
  origin: Coordinates;
  destination: Coordinates;
  departureTime: string | null;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  vehicleType: "DRIVE" | "TWO_WHEELER";
  languageCode: string;
}) {
  const requestBody: Record<string, unknown> = {
    origin: {
      location: {
        latLng: {
          latitude:
            args.origin.latitude,
          longitude:
            args.origin.longitude,
        },
      },
    },

    destination: {
      location: {
        latLng: {
          latitude:
            args.destination.latitude,
          longitude:
            args.destination.longitude,
        },
      },
    },

    travelMode:
      args.vehicleType,

    routingPreference:
      "TRAFFIC_AWARE_OPTIMAL",

    computeAlternativeRoutes:
      true,

    routeModifiers: {
      avoidTolls:
        args.avoidTolls,
      avoidHighways:
        args.avoidHighways,
      avoidFerries:
        args.avoidFerries,
    },

    languageCode:
      args.languageCode,

    units:
      "METRIC",

    polylineQuality:
      "OVERVIEW",

    polylineEncoding:
      "ENCODED_POLYLINE",

    extraComputations: [
      "TRAFFIC_ON_POLYLINE",
    ],
  };

  if (args.departureTime) {
    requestBody.departureTime =
      args.departureTime;
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",

        "X-Goog-Api-Key":
          args.apiKey,

        "X-Goog-FieldMask": [
          "routes.routeLabels",
          "routes.description",
          "routes.distanceMeters",
          "routes.duration",
          "routes.staticDuration",
          "routes.polyline.encodedPolyline",
          "routes.travelAdvisory.speedReadingIntervals",
        ].join(","),
      },
      body: JSON.stringify(
        requestBody
      ),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    }
  );

  const result =
    await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message ||
      "Google Routes API request failed.";

    throw new Error(message);
  }

  return result as {
    routes?: GoogleRoute[];
  };
}

function transformRoute(
  route: GoogleRoute,
  index: number,
  departureDate: Date
): RouteOption {
  const trafficSeconds =
    parseGoogleDuration(
      route.duration
    );

  const normalSeconds =
    parseGoogleDuration(
      route.staticDuration
    );

  if (trafficSeconds <= 0) {
    throw new Error(
      `Google Routes returned an invalid duration for route ${index + 1}.`
    );
  }

  const effectiveNormalSeconds =
    normalSeconds > 0
      ? normalSeconds
      : trafficSeconds;

  const delaySeconds =
    Math.max(
      0,
      trafficSeconds -
        effectiveNormalSeconds
    );

  const arrival =
    new Date(
      departureDate.getTime() +
        trafficSeconds * 1000
    );

  const congestion =
    calculateCongestion(
      route.travelAdvisory
        ?.speedReadingIntervals,
      delaySeconds,
      effectiveNormalSeconds
    );

  return {
    route_index:
      index,

    route_type:
      route.routeLabels?.includes(
        "DEFAULT_ROUTE"
      )
        ? "default"
        : index === 0
          ? "default"
          : "alternative",

    distance_meters:
      Number(
        route.distanceMeters ?? 0
      ),

    distance_km:
      round(
        Number(
          route.distanceMeters ?? 0
        ) / 1000,
        2
      ),

    traffic_duration_seconds:
      trafficSeconds,

    traffic_duration_minutes:
      round(
        trafficSeconds / 60,
        1
      ),

    normal_duration_seconds:
      effectiveNormalSeconds,

    normal_duration_minutes:
      round(
        effectiveNormalSeconds / 60,
        1
      ),

    traffic_delay_seconds:
      delaySeconds,

    traffic_delay_minutes:
      round(
        delaySeconds / 60,
        1
      ),

    estimated_arrival_time:
      arrival.toISOString(),

    encoded_polyline:
      route.polyline
        ?.encodedPolyline ??
      null,

    congestion,

    description:
      cleanNullableText(
        route.description,
        500
      ),
  };
}

function buildRecommendation(args: {
  routes: RouteOption[];
  currentRouteDurationSeconds:
    number | null;
  currentRouteDistanceMeters:
    number | null;
  minimumSavingMinutes: number;
  strongWarningMinutes: number;
  allowNarrowShortcuts: boolean;
}): Recommendation {
  const sorted = [...args.routes].sort(
    (first, second) =>
      first.traffic_duration_seconds -
      second.traffic_duration_seconds
  );

  const fastest = sorted[0];

  const defaultRoute =
    args.routes.find(
      (route) =>
        route.route_type ===
        "default"
    ) ?? args.routes[0];

  const currentDuration =
    args.currentRouteDurationSeconds ??
    defaultRoute
      .traffic_duration_seconds;

  const currentDistance =
    args.currentRouteDistanceMeters ??
    defaultRoute.distance_meters;

  const timeSavedSeconds =
    Math.max(
      0,
      currentDuration -
        fastest.traffic_duration_seconds
    );

  const timeSavedMinutes =
    round(
      timeSavedSeconds / 60,
      1
    );

  const distanceDifference =
    fastest.distance_meters -
    currentDistance;

  const meetsSavingThreshold =
    timeSavedMinutes >=
    args.minimumSavingMinutes;

  const isDifferentRoute =
    fastest.route_index !==
    defaultRoute.route_index ||
    args.currentRouteDurationSeconds !==
      null;

  const suspiciouslyShortLocalCut =
    !args.allowNarrowShortcuts &&
    distanceDifference < -5000 &&
    timeSavedMinutes < 8;

  const shouldReroute =
    meetsSavingThreshold &&
    isDifferentRoute &&
    !suspiciouslyShortLocalCut;

  const urgency:
    Recommendation["urgency"] =
      !shouldReroute
        ? "none"
        : timeSavedMinutes >=
            args.strongWarningMinutes
          ? "strong"
          : "suggestion";

  let reason =
    "The current route remains the best available option.";

  let miraMessage =
    "Your current route is still the best available route. I will continue checking traffic ahead.";

  if (suspiciouslyShortLocalCut) {
    reason =
      "A shorter route was found, but it may rely heavily on local roads and narrow shortcuts.";

    miraMessage =
      "I found a shorter local-road option, but your settings do not allow narrow shortcuts. I will keep you on the safer route.";
  } else if (shouldReroute) {
    reason =
      `The recommended route is estimated to save ` +
      `${timeSavedMinutes} minutes.`;

    miraMessage =
      urgency === "strong"
        ? (
            `Heavy traffic is building ahead. ` +
            `An alternate route can save approximately ` +
            `${timeSavedMinutes} minutes. Shall I reroute?`
          )
        : (
            `A faster route is available and may save ` +
            `approximately ${timeSavedMinutes} minutes. ` +
            `Would you like to take it?`
          );
  }

  return {
    should_reroute:
      shouldReroute,

    urgency,

    recommended_route_index:
      fastest.route_index,

    current_route_index:
      defaultRoute.route_index,

    time_saved_seconds:
      timeSavedSeconds,

    time_saved_minutes:
      timeSavedMinutes,

    distance_difference_meters:
      distanceDifference,

    distance_difference_km:
      round(
        distanceDifference / 1000,
        2
      ),

    reason,
    mira_message:
      miraMessage,

    actions: shouldReroute
      ? [
          "take_faster_route",
          "show_comparison",
          "stay_on_current_route",
        ]
      : [
          "show_comparison",
          "stay_on_current_route",
        ],
  };
}

function calculateCongestion(
  intervals: Array<{
    startPolylinePointIndex?: number;
    endPolylinePointIndex?: number;
    speed?: "NORMAL" | "SLOW" | "TRAFFIC_JAM";
  }> = [],
  delaySeconds = 0,
  normalDurationSeconds = 0
) {
  let normalSegments = 0;
  let slowSegments = 0;
  let trafficJamSegments = 0;

  for (const interval of intervals ?? []) {
    if (
      interval.speed ===
      "TRAFFIC_JAM"
    ) {
      trafficJamSegments += 1;
    } else if (
      interval.speed ===
      "SLOW"
    ) {
      slowSegments += 1;
    } else {
      normalSegments += 1;
    }
  }

  const total =
    normalSegments +
    slowSegments +
    trafficJamSegments;

  let overallLevel:
    | "light"
    | "moderate"
    | "heavy"
    | "severe" =
      "light";

  if (total > 0) {
    const jamRatio =
      trafficJamSegments / total;

    const slowRatio =
      slowSegments / total;

    if (jamRatio >= 0.35) {
      overallLevel =
        "severe";
    } else if (
      jamRatio >= 0.15 ||
      slowRatio >= 0.45
    ) {
      overallLevel =
        "heavy";
    } else if (
      jamRatio > 0 ||
      slowRatio >= 0.2
    ) {
      overallLevel =
        "moderate";
    }
  } else if (normalDurationSeconds > 0) {
    const delayRatio =
      delaySeconds / normalDurationSeconds;

    if (delayRatio >= 0.75) {
      overallLevel = "severe";
    } else if (delayRatio >= 0.4) {
      overallLevel = "heavy";
    } else if (delayRatio >= 0.15) {
      overallLevel = "moderate";
    }
  }

  return {
    normal_segments:
      normalSegments,

    slow_segments:
      slowSegments,

    traffic_jam_segments:
      trafficJamSegments,

    overall_level:
      overallLevel,
  };
}

async function saveTrafficAnalysis(args: {
  adminClient: SupabaseClient;
  userId: string;
  origin: Coordinates;
  destination: Coordinates;
  departureTime: string;
  routeOptions: RouteOption[];
  recommendation: Recommendation;
  preferences: Record<string, unknown>;
}) {
  const { error } =
    await args.adminClient
      .from(
        "navigation_traffic_analyses"
      )
      .insert({
        user_id:
          args.userId,

        origin:
          args.origin,

        destination:
          args.destination,

        departure_time:
          args.departureTime,

        routes:
          args.routeOptions,

        recommendation:
          args.recommendation,

        preferences:
          args.preferences,

        should_reroute:
          args.recommendation
            .should_reroute,

        recommended_route_index:
          args.recommendation
            .recommended_route_index,

        estimated_time_saved_minutes:
          args.recommendation
            .time_saved_minutes,

        created_at:
          new Date().toISOString(),
      });

  if (error) {
    console.warn(
      "Unable to save traffic analysis:",
      error.message
    );
  }
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

function parseGoogleDuration(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return 0;
  }

  const match =
    value.match(
      /^([\d.]+)s$/
    );

  if (!match) {
    return 0;
  }

  const seconds =
    Number(match[1]);

  return Number.isFinite(seconds)
    ? Math.max(
        0,
        Math.round(seconds)
      )
    : 0;
}

function normalizeDepartureTime(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(String(value));

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const minimumAllowedTime =
    Date.now() - 60_000;

  if (
    date.getTime() <
    minimumAllowedTime
  ) {
    return null;
  }

  return date.toISOString();
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
      googleMapsApiKey: string;
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

  const googleMapsApiKey =
    process.env
      .GOOGLE_MAPS_SERVER_API_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey ||
    !googleMapsApiKey
  ) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "SUPABASE_SERVICE_ROLE_KEY and " +
        "GOOGLE_MAPS_SERVER_API_KEY are required.",
    };
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    googleMapsApiKey,
  };
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(numeric)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      numeric
    )
  );
}

function cleanNonNegativeNumber(
  value: unknown
): number | null {
  const numeric =
    Number(value);

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanText(
  value: unknown,
  limit = 8000
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(0, limit)
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

function round(
  value: number,
  decimals = 2
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}