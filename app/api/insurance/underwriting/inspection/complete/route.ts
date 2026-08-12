import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type CompleteInspectionBody = {
  inspection_id?: number;

  inspection_status?:
    | "in_progress"
    | "completed"
    | "approved"
    | "rejected"
    | "cancelled";

  inspection_mode?:
    | "self_inspection"
    | "partner_inspection"
    | "surveyor_inspection"
    | "video_inspection";

  inspector_name?: string | null;
  inspector_reference?: string | null;

  odometer_reading?: number | null;

  exterior_condition?: string | null;
  interior_condition?: string | null;
  tyre_condition?: string | null;
  glass_condition?: string | null;
  electrical_condition?: string | null;
  mechanical_condition?: string | null;

  existing_damage_detected?: boolean;
  existing_damage_summary?: string | null;

  existing_damage_items?: Array<{
    part: string;
    damage_type?: string | null;
    severity?: "minor" | "moderate" | "major" | "critical";
    estimated_cost?: number | null;
    notes?: string | null;
  }>;

  image_paths?: string[];
  video_paths?: string[];

  ai_damage_assessment?: Record<string, unknown>;
  ai_tampering_flags?: Array<Record<string, unknown> | string>;
  ai_blur_flags?: Array<Record<string, unknown> | string>;
  ai_duplicate_flags?: Array<Record<string, unknown> | string>;

  inspection_score?: number | null;
  inspection_result?:
    | "pass"
    | "pass_with_conditions"
    | "manual_review"
    | "rejected";

  inspection_notes?: string | null;

  approved_by_name?: string | null;

  metadata?: Record<string, unknown>;
};

type InspectionRow = {
  id: number;
  user_id: string;

  underwriting_case_id: number | null;
  policy_id: number | null;
  vehicle_id: number | null;

  inspection_reference: string | null;

  inspection_type: string;
  inspection_status: string;
  inspection_mode: string;

  inspector_name: string | null;
  inspector_reference: string | null;

  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;

  odometer_reading: number | null;

  exterior_condition: string | null;
  interior_condition: string | null;
  tyre_condition: string | null;
  glass_condition: string | null;
  electrical_condition: string | null;
  mechanical_condition: string | null;

  existing_damage_detected: boolean;
  existing_damage_summary: string | null;
  existing_damage_items: Array<Record<string, unknown>>;

  image_paths: string[];
  video_paths: string[];

  ai_damage_assessment: Record<string, unknown>;
  ai_tampering_flags: Array<Record<string, unknown> | string>;
  ai_blur_flags: Array<Record<string, unknown> | string>;
  ai_duplicate_flags: Array<Record<string, unknown> | string>;

  inspection_score: number | null;
  inspection_result: string | null;
  inspection_notes: string | null;

  approved_by_name: string | null;
  approved_at: string | null;

  created_at: string;
  updated_at: string;
};

type UnderwritingCaseRow = {
  id: number;
  user_id: string;

  underwriting_status: string;
  decision_status: string;
  referral_status: string;

  inspection_required: boolean;
  inspection_status: string;

  overall_risk_score: number | null;
  overall_risk_band: string | null;

  recommended_idv: number | null;
  recommended_total_premium: number | null;

  ai_risk_reasons: string[];
  ai_recommendations: string[];

  updated_at: string;
};

type InspectionAssessment = {
  calculated_score: number;
  inspection_result:
    | "pass"
    | "pass_with_conditions"
    | "manual_review"
    | "rejected";

  manual_review_required: boolean;
  underwriting_status: string;
  inspection_status: string;

  risk_adjustment: number;
  warnings: string[];
  recommendations: string[];
};

export async function POST(request: NextRequest) {
  try {
    const env = readEnvironment();

    if ("error" in env) {
      return NextResponse.json(
        { error: env.error },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to complete a vehicle inspection.",
        },
        { status: 401 }
      );
    }

    const accessToken = authorization
      .replace("Bearer ", "")
      .trim();

    const authClient = createClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
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
        { error: "Your session is invalid or expired." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CompleteInspectionBody;
    const inspectionId = positiveInteger(body.inspection_id);

    if (!inspectionId) {
      return NextResponse.json(
        { error: "inspection_id is required." },
        { status: 400 }
      );
    }

    const adminClient = createClient(
      env.supabaseUrl,
      env.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const inspection = await loadOwnedInspection(
      adminClient as any,
      inspectionId,
      user.id
    );

    if (!inspection) {
      return NextResponse.json(
        {
          error:
            "Inspection was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const stateError = validateInspectionState(inspection);

    if (stateError) {
      return NextResponse.json(
        { error: stateError },
        { status: 409 }
      );
    }

    const underwritingCase =
      inspection.underwriting_case_id
        ? await loadOwnedUnderwritingCase(
            adminClient as any,
            inspection.underwriting_case_id,
            user.id
          )
        : null;

    const assessment = assessInspection(body);

    const reviewerName =
      cleanText(body.approved_by_name, 250) ||
      cleanText(body.inspector_name, 250) ||
      user.email ||
      "Authorized Inspector";

    const finalStatus =
      normalizeInspectionStatus(
        body.inspection_status,
        assessment.inspection_result
      );

    const startedAt =
      inspection.started_at ??
      new Date().toISOString();

    const completedAt =
      ["completed", "approved", "rejected"].includes(
        finalStatus
      )
        ? new Date().toISOString()
        : null;

    const snapshot = structuredCloneSafe(inspection);

    try {
      const { data: updatedInspection, error: inspectionError } =
        await adminClient
          .from("insurance_vehicle_inspections")
          .update({
            inspection_status: finalStatus,
            inspection_mode:
              normalizeInspectionMode(
                body.inspection_mode
              ),

            inspector_name:
              cleanNullableText(
                body.inspector_name,
                250
              ),
            inspector_reference:
              cleanNullableText(
                body.inspector_reference,
                250
              ),

            started_at: startedAt,
            completed_at: completedAt,

            odometer_reading:
              cleanNonNegativeNumber(
                body.odometer_reading
              ),

            exterior_condition:
              cleanNullableText(
                body.exterior_condition,
                500
              ),
            interior_condition:
              cleanNullableText(
                body.interior_condition,
                500
              ),
            tyre_condition:
              cleanNullableText(
                body.tyre_condition,
                500
              ),
            glass_condition:
              cleanNullableText(
                body.glass_condition,
                500
              ),
            electrical_condition:
              cleanNullableText(
                body.electrical_condition,
                500
              ),
            mechanical_condition:
              cleanNullableText(
                body.mechanical_condition,
                500
              ),

            existing_damage_detected:
              Boolean(
                body.existing_damage_detected
              ),

            existing_damage_summary:
              cleanNullableText(
                body.existing_damage_summary,
                4000
              ),

            existing_damage_items:
              Array.isArray(
                body.existing_damage_items
              )
                ? body.existing_damage_items
                : [],

            image_paths:
              sanitizeStringArray(
                body.image_paths
              ),

            video_paths:
              sanitizeStringArray(
                body.video_paths
              ),

            ai_damage_assessment:
              validObject(
                body.ai_damage_assessment
              ) ?? {},

            ai_tampering_flags:
              Array.isArray(
                body.ai_tampering_flags
              )
                ? body.ai_tampering_flags
                : [],

            ai_blur_flags:
              Array.isArray(
                body.ai_blur_flags
              )
                ? body.ai_blur_flags
                : [],

            ai_duplicate_flags:
              Array.isArray(
                body.ai_duplicate_flags
              )
                ? body.ai_duplicate_flags
                : [],

            inspection_score:
              assessment.calculated_score,

            inspection_result:
              assessment.inspection_result,

            inspection_notes:
              cleanNullableText(
                body.inspection_notes,
                4000
              ),

            approved_by_name:
              finalStatus === "approved"
                ? reviewerName
                : null,

            approved_at:
              finalStatus === "approved"
                ? new Date().toISOString()
                : null,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", inspection.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

      if (inspectionError || !updatedInspection) {
        throw new Error(
          inspectionError?.message ||
            "Unable to update vehicle inspection."
        );
      }

      if (underwritingCase) {
        await updateUnderwritingCase({
          adminClient: adminClient as any,
          userId: user.id,
          underwritingCase,
          assessment,
        });
      }

      if (
        assessment.manual_review_required &&
        underwritingCase
      ) {
        await createInspectionReferral({
          adminClient: adminClient as any,
          userId: user.id,
          underwritingCaseId:
            underwritingCase.id,
          inspectionId: inspection.id,
          assessment,
        });
      }

      await writeInspectionAudit({
        adminClient: adminClient as any,
        userId: user.id,
        inspection,
        underwritingCaseId:
          underwritingCase?.id ?? null,
        assessment,
        reviewerName,
        metadata:
          validObject(body.metadata) ?? {},
      });

      return NextResponse.json({
        success: true,
        inspection_id: inspection.id,
        inspection_reference:
          inspection.inspection_reference,

        inspection_status: finalStatus,
        inspection_result:
          assessment.inspection_result,
        inspection_score:
          assessment.calculated_score,

        manual_review_required:
          assessment.manual_review_required,

        underwriting_case_id:
          underwritingCase?.id ?? null,

        underwriting_status:
          underwritingCase
            ? assessment.underwriting_status
            : null,

        risk_adjustment:
          assessment.risk_adjustment,

        warnings: assessment.warnings,
        recommendations:
          assessment.recommendations,

        message:
          assessment.inspection_result ===
          "rejected"
            ? "Vehicle inspection completed with a rejected result."
            : assessment.manual_review_required
              ? "Vehicle inspection completed and sent for manual review."
              : "Vehicle inspection completed successfully.",
      });
    } catch (operationError) {
      await rollbackInspection({
        adminClient: adminClient as any,
        userId: user.id,
        snapshot,
      });

      throw operationError;
    }
  } catch (error) {
    console.error(
      "Vehicle inspection completion error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete vehicle inspection.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedInspection(
  adminClient: any,
  inspectionId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_vehicle_inspections")
    .select("*")
    .eq("id", inspectionId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as InspectionRow | null;
}

async function loadOwnedUnderwritingCase(
  adminClient: any,
  underwritingCaseId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_underwriting_cases")
    .select("*")
    .eq("id", underwritingCaseId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as UnderwritingCaseRow | null;
}

function validateInspectionState(
  inspection: InspectionRow
) {
  if (
    ["approved", "rejected", "cancelled"].includes(
      inspection.inspection_status
    )
  ) {
    return (
      `Inspection cannot be updated while status is ` +
      `${inspection.inspection_status}.`
    );
  }

  return "";
}

function assessInspection(
  body: CompleteInspectionBody
): InspectionAssessment {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  let score =
    cleanInspectionScore(
      body.inspection_score
    ) ?? 100;

  const damageItems =
    Array.isArray(
      body.existing_damage_items
    )
      ? body.existing_damage_items
      : [];

  for (const item of damageItems) {
    const severity =
      cleanText(item.severity, 40) ||
      "minor";

    if (severity === "critical") {
      score -= 35;
    } else if (severity === "major") {
      score -= 20;
    } else if (severity === "moderate") {
      score -= 10;
    } else {
      score -= 3;
    }
  }

  const tamperingCount =
    Array.isArray(
      body.ai_tampering_flags
    )
      ? body.ai_tampering_flags.length
      : 0;

  const blurCount =
    Array.isArray(body.ai_blur_flags)
      ? body.ai_blur_flags.length
      : 0;

  const duplicateCount =
    Array.isArray(
      body.ai_duplicate_flags
    )
      ? body.ai_duplicate_flags.length
      : 0;

  score -= tamperingCount * 20;
  score -= blurCount * 5;
  score -= duplicateCount * 10;

  const existingDamageDetected =
    Boolean(
      body.existing_damage_detected
    );

  if (
    existingDamageDetected &&
    !damageItems.length
  ) {
    score -= 10;

    warnings.push(
      "Existing damage was reported without detailed damage items."
    );
  }

  if (tamperingCount > 0) {
    warnings.push(
      `${tamperingCount} possible tampering flag(s) were detected.`
    );

    recommendations.push(
      "Send the inspection for manual fraud and image review."
    );
  }

  if (blurCount > 0) {
    warnings.push(
      `${blurCount} blurred image flag(s) were detected.`
    );

    recommendations.push(
      "Request replacement images before final approval."
    );
  }

  if (duplicateCount > 0) {
    warnings.push(
      `${duplicateCount} duplicate image flag(s) were detected.`
    );

    recommendations.push(
      "Verify image authenticity and inspection timestamps."
    );
  }

  score = Math.max(
    0,
    Math.min(100, Math.round(score))
  );

  const explicitResult =
    normalizeInspectionResult(
      body.inspection_result
    );

  let inspectionResult =
    explicitResult ??
    (
      score < 35
        ? "rejected"
        : score < 60
          ? "manual_review"
          : score < 80
            ? "pass_with_conditions"
            : "pass"
    );

  if (
    tamperingCount > 0 &&
    inspectionResult === "pass"
  ) {
    inspectionResult =
      "manual_review";
  }

  const manualReviewRequired =
    inspectionResult ===
      "manual_review" ||
    inspectionResult ===
      "pass_with_conditions" ||
    tamperingCount > 0 ||
    duplicateCount > 0;

  if (
    inspectionResult ===
    "pass_with_conditions"
  ) {
    recommendations.push(
      "Apply coverage restrictions for declared pre-existing damage."
    );
  }

  if (
    inspectionResult === "rejected"
  ) {
    recommendations.push(
      "Decline own-damage cover or request a new inspection."
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "Proceed with underwriting approval subject to standard checks."
    );
  }

  const riskAdjustment =
    inspectionResult === "rejected"
      ? 35
      : inspectionResult ===
          "manual_review"
        ? 20
        : inspectionResult ===
            "pass_with_conditions"
          ? 10
          : 0;

  const underwritingStatus =
    inspectionResult === "rejected"
      ? "declined"
      : manualReviewRequired
        ? "referred"
        : "assessing";

  const inspectionStatus =
    inspectionResult === "rejected"
      ? "rejected"
      : manualReviewRequired
        ? "completed"
        : "approved";

  return {
    calculated_score: score,
    inspection_result:
      inspectionResult,
    manual_review_required:
      manualReviewRequired,
    underwriting_status:
      underwritingStatus,
    inspection_status:
      inspectionStatus,
    risk_adjustment:
      riskAdjustment,
    warnings,
    recommendations,
  };
}

async function updateUnderwritingCase(args: {
  adminClient: any;
  userId: string;
  underwritingCase: UnderwritingCaseRow;
  assessment: InspectionAssessment;
}) {
  const previousScore =
    numberOrZero(
      args.underwritingCase
        .overall_risk_score
    );

  const adjustedScore = Math.min(
    100,
    Math.max(
      0,
      previousScore +
        args.assessment.risk_adjustment
    )
  );

  const adjustedBand =
    adjustedScore >= 90
      ? "decline"
      : adjustedScore >= 75
        ? "very_high"
        : adjustedScore >= 60
          ? "high"
          : adjustedScore >= 40
            ? "medium"
            : adjustedScore >= 20
              ? "low"
              : "very_low";

  const riskReasons = [
    ...(
      Array.isArray(
        args.underwritingCase.ai_risk_reasons
      )
        ? args.underwritingCase.ai_risk_reasons
        : []
    ),
    ...args.assessment.warnings,
  ];

  const recommendations = [
    ...(
      Array.isArray(
        args.underwritingCase.ai_recommendations
      )
        ? args.underwritingCase.ai_recommendations
        : []
    ),
    ...args.assessment.recommendations,
  ];

  const { error } = await args.adminClient
    .from("insurance_underwriting_cases")
    .update({
      underwriting_status:
        args.assessment.underwriting_status,

      decision_status:
        args.assessment.inspection_result ===
        "rejected"
          ? "declined"
          : args.assessment
              .manual_review_required
            ? "recommended"
            : args.underwritingCase
                .decision_status,

      referral_status:
        args.assessment
          .manual_review_required
          ? "pending"
          : args.underwritingCase
              .referral_status,

      inspection_status:
        args.assessment.inspection_status,

      overall_risk_score:
        adjustedScore,

      overall_risk_band:
        adjustedBand,

      ai_risk_reasons:
        riskReasons,

      ai_recommendations:
        recommendations,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      args.underwritingCase.id
    )
    .eq("user_id", args.userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function createInspectionReferral(args: {
  adminClient: any;
  userId: string;
  underwritingCaseId: number;
  inspectionId: number;
  assessment: InspectionAssessment;
}) {
  const { error } = await args.adminClient
    .from("insurance_underwriting_referrals")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCaseId,

      referral_type:
        args.assessment.inspection_result ===
        "rejected"
          ? "inspection_rejection_review"
          : "inspection_review",

      referral_status: "pending",

      referral_reason:
        args.assessment.warnings.join(" ") ||
        "Inspection requires manual review.",

      referral_priority:
        args.assessment.inspection_result ===
        "rejected"
          ? "high"
          : "medium",

      requested_at:
        new Date().toISOString(),

      recommended_changes: {
        inspection_id:
          args.inspectionId,
        inspection_score:
          args.assessment
            .calculated_score,
        inspection_result:
          args.assessment
            .inspection_result,
        recommendations:
          args.assessment
            .recommendations,
      },

      approved_changes: {},
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeInspectionAudit(args: {
  adminClient: any;
  userId: string;
  inspection: InspectionRow;
  underwritingCaseId: number | null;
  assessment: InspectionAssessment;
  reviewerName: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await args.adminClient
    .from("insurance_underwriting_audit_log")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCaseId,

      action_type:
        "vehicle_inspection_completed",

      action_status:
        args.assessment
          .inspection_result,

      actor_type:
        "authorized_inspector",

      actor_name:
        args.reviewerName,

      actor_reference:
        args.inspection
          .inspection_reference,

      previous_values: {
        inspection_status:
          args.inspection
            .inspection_status,
        inspection_result:
          args.inspection
            .inspection_result,
        inspection_score:
          args.inspection
            .inspection_score,
      },

      new_values: {
        inspection_status:
          args.assessment
            .inspection_status,
        inspection_result:
          args.assessment
            .inspection_result,
        inspection_score:
          args.assessment
            .calculated_score,
        manual_review_required:
          args.assessment
            .manual_review_required,
        risk_adjustment:
          args.assessment
            .risk_adjustment,
      },

      metadata: {
        ...args.metadata,
        warnings:
          args.assessment.warnings,
        recommendations:
          args.assessment
            .recommendations,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackInspection(args: {
  adminClient: any;
  userId: string;
  snapshot: InspectionRow;
}) {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...inspectionValues
  } = args.snapshot;

  await args.adminClient
    .from("insurance_vehicle_inspections")
    .update({
      ...inspectionValues,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.snapshot.id)
    .eq("user_id", args.userId);
}

function normalizeInspectionMode(
  value: unknown
) {
  const allowed = new Set([
    "self_inspection",
    "partner_inspection",
    "surveyor_inspection",
    "video_inspection",
  ]);

  const normalized =
    cleanText(value, 80) ||
    "self_inspection";

  return allowed.has(normalized)
    ? normalized
    : "self_inspection";
}

function normalizeInspectionStatus(
  value: unknown,
  result: string
) {
  const allowed = new Set([
    "in_progress",
    "completed",
    "approved",
    "rejected",
    "cancelled",
  ]);

  const normalized =
    cleanText(value, 80);

  if (allowed.has(normalized)) {
    return normalized;
  }

  if (result === "rejected") {
    return "rejected";
  }

  if (result === "pass") {
    return "approved";
  }

  return "completed";
}

function normalizeInspectionResult(
  value: unknown
):
  | "pass"
  | "pass_with_conditions"
  | "manual_review"
  | "rejected"
  | null {
  const allowed = new Set([
    "pass",
    "pass_with_conditions",
    "manual_review",
    "rejected",
  ]);

  const normalized =
    cleanText(value, 80);

  return allowed.has(normalized)
    ? normalized as
        | "pass"
        | "pass_with_conditions"
        | "manual_review"
        | "rejected"
    : null;
}

function cleanInspectionScore(
  value: unknown
) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(
    Math.min(
      100,
      Math.max(0, numeric)
    )
  );
}

function sanitizeStringArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) =>
      item.trim().slice(0, 2000)
    )
    .filter(Boolean);
}

function structuredCloneSafe<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(value)
  ) as T;
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

function numberOrZero(
  value: unknown
) {
  const numeric =
    Number(value ?? 0);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function validObject(
  value: unknown
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}