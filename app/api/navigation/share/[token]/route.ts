import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 10) {
      return NextResponse.json(
        { error: "Invalid journey share link." },
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

    const { data: journey, error: journeyError } =
      await supabase
        .from("navigation_journeys")
        .select(
          `
            id,
            status,
            destination_name,
            current_location,
            destination,
            started_at,
            completed_at,
            distance_meters,
            total_stop_seconds,
            share_enabled,
            share_token,
            metadata,
            updated_at
          `
        )
        .eq("share_token", token)
        .eq("share_enabled", true)
        .limit(1)
        .maybeSingle();

    if (journeyError) {
      throw new Error(journeyError.message);
    }

    if (!journey) {
      return NextResponse.json(
        {
          error:
            "This journey link is unavailable or sharing has been disabled.",
        },
        { status: 404 }
      );
    }

    const metadata =
      journey.metadata &&
      typeof journey.metadata === "object"
        ? journey.metadata
        : {};

    const expiryValue =
      (metadata as Record<string, unknown>)
        .share_expires_at;

    const expiresAt =
      typeof expiryValue === "string"
        ? expiryValue
        : null;

    if (
      expiresAt &&
      new Date(expiresAt).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "This journey sharing link has expired.",
          expired: true,
        },
        { status: 410 }
      );
    }

    const includeCurrentLocation =
      readBoolean(
        (metadata as Record<string, unknown>)
          .share_current_location,
        true
      );

    const includeDestination =
      readBoolean(
        (metadata as Record<string, unknown>)
          .share_destination,
        true
      );

    const includeEta =
      readBoolean(
        (metadata as Record<string, unknown>)
          .share_eta,
        true
      );

    const includeStops =
      readBoolean(
        (metadata as Record<string, unknown>)
          .share_stops,
        true
      );

    let events: unknown[] = [];

    if (includeStops) {
      const { data: eventRows, error: eventError } =
        await supabase
          .from("navigation_journey_events")
          .select(
            `
              id,
              event_type,
              title,
              description,
              coordinates,
              created_at
            `
          )
          .eq("journey_id", journey.id)
          .in("event_type", [
            "journey_started",
            "stop_detected",
            "stop_reason_added",
            "journey_resumed",
            "journey_completed",
            "journey_cancelled",
          ])
          .order("created_at", {
            ascending: true,
          })
          .limit(50);

      if (eventError) {
        console.warn(
          "Unable to load shared journey events:",
          eventError.message
        );
      } else {
        events = eventRows ?? [];
      }
    }

    const etaValue =
      (metadata as Record<string, unknown>)
        .estimated_arrival_time;

    return NextResponse.json(
      {
        success: true,
        journey: {
          id: journey.id,
          status: journey.status,
          destination_name:
            journey.destination_name,
          current_location:
            includeCurrentLocation
              ? journey.current_location
              : null,
          destination:
            includeDestination
              ? journey.destination
              : null,
          started_at:
            journey.started_at,
          completed_at:
            journey.completed_at,
          distance_meters:
            Number(
              journey.distance_meters ?? 0
            ),
          total_stop_seconds:
            includeStops
              ? Number(
                  journey.total_stop_seconds ?? 0
                )
              : null,
          estimated_arrival_time:
            includeEta &&
            typeof etaValue === "string"
              ? etaValue
              : null,
          updated_at:
            journey.updated_at,
          expires_at:
            expiresAt,
          permissions: {
            current_location:
              includeCurrentLocation,
            destination:
              includeDestination,
            eta:
              includeEta,
            stops:
              includeStops,
          },
          events,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Shared journey API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load shared journey.",
      },
      { status: 500 }
    );
  }
}

function readBoolean(
  value: unknown,
  fallback: boolean
) {
  return typeof value === "boolean"
    ? value
    : fallback;
}