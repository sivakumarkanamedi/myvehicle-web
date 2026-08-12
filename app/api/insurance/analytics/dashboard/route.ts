import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Advanced Insurance Analytics is intentionally parked for the MVP.
 *
 * This endpoint previously used privileged server access.
 * Keep it disabled until the Insurance analytics feature is intentionally
 * reactivated with proper role-based authorization.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Insurance analytics are not available in the MVP.",
      code: "FEATURE_DISABLED",
    },
    { status: 404 }
  );
}