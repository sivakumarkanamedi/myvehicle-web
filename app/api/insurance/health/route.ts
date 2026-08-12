import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "Insurance Health Check",
    modules: {
      underwriting: "ok",
      rating: "ok",
      ncb: "ok",
      policy_issue: "ok",
      policy_verify: "ok"
    },
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
}