import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Advanced Insurance Payment Notifications are intentionally parked for the MVP.
 *
 * This endpoint previously used the Supabase service-role key.
 * Keep it disabled until the payment-notification workflow is intentionally
 * reactivated with strong authentication and authorization.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Insurance payment notifications are not available in the MVP.",
      code: "FEATURE_DISABLED",
    },
    { status: 404 }
  );
}