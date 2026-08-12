import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type AnalyseFraudBody = {
  claim_id?: number;
  fraud_review_id?: number;
  damage_assessment_id?: number | null;
  survey_review_id?: number | null;
  repair_job_id?: number | null;
  garage_id?: number | null;
};

type FraudReviewRow = {
  id: number;
  user_id: string;
  claim_id: number;
  policy_id: number | null;
  vehicle_id: number;
  damage_assessment_id: number | null;
  survey_review_id: number | null;
  repair_job_id: number | null;
  garage_id: number | null;
  fraud_review_reference: string | null;
  review_status: string;
};

type FraudIndicator = {
  indicator_code: string;
  indicator_category: string;
  indicator_title: string;
  indicator_description: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  confidence: number;
  source_type: string;
  source_id: number | null;
  source_reference: string;
  expected_value: string;
  observed_value: string;
  variance_amount: number | null;
  variance_percent: number | null;
  requires_manual_check: boolean;
  metadata: Record<string, unknown>;
};

type FraudAnalysis = {
  review_status: "completed" | "manual_review_required";

  risk_level: "unknown" | "low" | "medium" | "high" | "critical";
  risk_score: number;
  risk_confidence: number;

  recommendation:
    | "continue_normal_processing"
    | "clarification_required"
    | "manual_review"
    | "enhanced_investigation"
    | "hold_for_investigation";

  recommendation_summary: string;

  duplicate_evidence_score: number;
  image_integrity_score: number;
  timeline_consistency_score: number;
  estimate_consistency_score: number;
  policy_timing_score: number;
  document_completeness_score: number;
  historical_pattern_score: number;

  duplicate_photo_detected: boolean;
  possible_image_editing_detected: boolean;
  repeated_damage_pattern_detected: boolean;
  policy_recently_purchased: boolean;
  repeated_claim_frequency_detected: boolean;
  estimate_inflation_detected: boolean;
  unsupported_parts_detected: boolean;
  invoice_mismatch_detected: boolean;
  timeline_inconsistency_detected: boolean;
  location_inconsistency_detected: boolean;
  mandatory_documents_missing: boolean;

  risk_reasons: string[];
  evidence_summary: Record<string, unknown>;
  conflicting_facts: string[];
  missing_evidence: string[];
  recommended_checks: string[];
  clarification_questions: string[];

  manual_investigation_required: boolean;
  manual_investigation_reasons: string[];

  indicators: FraudIndicator[];
  report_summary: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const FRAUD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "review_status",
    "risk_level",
    "risk_score",
    "risk_confidence",
    "recommendation",
    "recommendation_summary",
    "duplicate_evidence_score",
    "image_integrity_score",
    "timeline_consistency_score",
    "estimate_consistency_score",
    "policy_timing_score",
    "document_completeness_score",
    "historical_pattern_score",
    "duplicate_photo_detected",
    "possible_image_editing_detected",
    "repeated_damage_pattern_detected",
    "policy_recently_purchased",
    "repeated_claim_frequency_detected",
    "estimate_inflation_detected",
    "unsupported_parts_detected",
    "invoice_mismatch_detected",
    "timeline_inconsistency_detected",
    "location_inconsistency_detected",
    "mandatory_documents_missing",
    "risk_reasons",
    "evidence_summary",
    "conflicting_facts",
    "missing_evidence",
    "recommended_checks",
    "clarification_questions",
    "manual_investigation_required",
    "manual_investigation_reasons",
    "indicators",
    "report_summary",
  ],
  properties: {
    review_status: {
      type: "string",
      enum: ["completed", "manual_review_required"],
    },
    risk_level: {
      type: "string",
      enum: ["unknown", "low", "medium", "high", "critical"],
    },
    risk_score: percentSchema(),
    risk_confidence: percentSchema(),
    recommendation: {
      type: "string",
      enum: [
        "continue_normal_processing",
        "clarification_required",
        "manual_review",
        "enhanced_investigation",
        "hold_for_investigation",
      ],
    },
    recommendation_summary: { type: "string" },
    duplicate_evidence_score: percentSchema(),
    image_integrity_score: percentSchema(),
    timeline_consistency_score: percentSchema(),
    estimate_consistency_score: percentSchema(),
    policy_timing_score: percentSchema(),
    document_completeness_score: percentSchema(),
    historical_pattern_score: percentSchema(),
    duplicate_photo_detected: { type: "boolean" },
    possible_image_editing_detected: { type: "boolean" },
    repeated_damage_pattern_detected: { type: "boolean" },
    policy_recently_purchased: { type: "boolean" },
    repeated_claim_frequency_detected: { type: "boolean" },
    estimate_inflation_detected: { type: "boolean" },
    unsupported_parts_detected: { type: "boolean" },
    invoice_mismatch_detected: { type: "boolean" },
    timeline_inconsistency_detected: { type: "boolean" },
    location_inconsistency_detected: { type: "boolean" },
    mandatory_documents_missing: { type: "boolean" },
    risk_reasons: stringArraySchema(40),
    evidence_summary: {
      type: "object",
      additionalProperties: true,
    },
    conflicting_facts: stringArraySchema(40),
    missing_evidence: stringArraySchema(40),
    recommended_checks: stringArraySchema(40),
    clarification_questions: stringArraySchema(40),
    manual_investigation_required: { type: "boolean" },
    manual_investigation_reasons: stringArraySchema(40),
    indicators: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "indicator_code",
          "indicator_category",
          "indicator_title",
          "indicator_description",
          "severity",
          "confidence",
          "source_type",
          "source_id",
          "source_reference",
          "expected_value",
          "observed_value",
          "variance_amount",
          "variance_percent",
          "requires_manual_check",
          "metadata",
        ],
        properties: {
          indicator_code: { type: "string" },
          indicator_category: { type: "string" },
          indicator_title: { type: "string" },
          indicator_description: { type: "string" },
          severity: {
            type: "string",
            enum: ["info", "low", "medium", "high", "critical"],
          },
          confidence: percentSchema(),
          source_type: { type: "string" },
          source_id: nullableIntegerSchema(),
          source_reference: { type: "string" },
          expected_value: { type: "string" },
          observed_value: { type: "string" },
          variance_amount: nullableSignedNumberSchema(),
          variance_percent: nullableSignedNumberSchema(),
          requires_manual_check: { type: "boolean" },
          metadata: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    report_summary: { type: "string" },
  },
} as const;

export async function POST(request: NextRequest) {
  let fraudReviewId: number | null = null;

  try {
    const environment = readEnvironment();

    if ("error" in environment) {
      return NextResponse.json(
        { error: environment.error },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to analyse claim risk." },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

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
        { error: "Your session is invalid or expired." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as AnalyseFraudBody;

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

    const reviewResult = await getOrCreateFraudReview(
      adminClient as any,
      user.id,
      body
    );

    if ("error" in reviewResult) {
      return NextResponse.json(
        { error: reviewResult.error },
        { status: reviewResult.status }
      );
    }

    const review = reviewResult.review;
    fraudReviewId = review.id;

    await adminClient
      .from("insurance_fraud_reviews")
      .update({ review_status: "analysing" })
      .eq("id", review.id);

    const sourceData = await loadFraudSourceData(
      adminClient as any,
      review
    );

    if (!sourceData.claim) {
      throw new Error("The linked insurance claim was not found.");
    }

    if (!sourceData.vehicle) {
      throw new Error("The linked vehicle was not found.");
    }

    await syncImageFingerprints(
      adminClient as any,
      review,
      sourceData
    );

    const refreshedSourceData = await loadFraudSourceData(
      adminClient as any,
      review
    );

    const deterministicSignals = buildDeterministicSignals(
      refreshedSourceData
    );

    const aiAnalysis = await analyseWithOpenAI({
      apiKey: environment.openAiApiKey,
      model: environment.fraudModel,
      review,
      sourceData: refreshedSourceData,
      deterministicSignals,
    });

    const normalized = normalizeAnalysis(
      aiAnalysis,
      refreshedSourceData,
      deterministicSignals
    );

    await saveFraudAnalysis({
      adminClient: adminClient as any,
      review,
      model: environment.fraudModel,
      analysis: normalized,
      sourceData: refreshedSourceData,
    });

    await adminClient.rpc("sync_claim_risk_history", {
      target_claim_id: review.claim_id,
    });

    return NextResponse.json({
      success: true,
      fraud_review_id: review.id,
      fraud_review_reference: review.fraud_review_reference,
      review_status: normalized.review_status,
      risk_level: normalized.risk_level,
      risk_score: normalized.risk_score,
      risk_confidence: normalized.risk_confidence,
      recommendation: normalized.recommendation,
      manual_investigation_required:
        normalized.manual_investigation_required,
      analysis: normalized,
    });
  } catch (error) {
    console.error("AI Fraud Detection Engine error:", error);

    try {
      const environment = readEnvironment();

      if (!("error" in environment) && fraudReviewId) {
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

        await adminClient
          .from("insurance_fraud_reviews")
          .update({ review_status: "failed" })
          .eq("id", fraudReviewId);
      }
    } catch (cleanupError) {
      console.error("Fraud review cleanup failed:", cleanupError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mira could not complete the claim-risk analysis.",
      },
      { status: 500 }
    );
  }
}

async function getOrCreateFraudReview(
  adminClient: any,
  userId: string,
  body: AnalyseFraudBody
): Promise<
  | { review: FraudReviewRow }
  | { error: string; status: number }
> {
  const requestedReviewId = positiveInteger(body.fraud_review_id);

  if (requestedReviewId) {
    const { data, error } = await adminClient
      .from("insurance_fraud_reviews")
      .select("*")
      .eq("id", requestedReviewId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message, status: 500 };
    }

    if (!data) {
      return { error: "Fraud review was not found.", status: 404 };
    }

    if (data.user_id !== userId) {
      return {
        error: "You are not allowed to access this fraud review.",
        status: 403,
      };
    }

    return { review: data as FraudReviewRow };
  }

  const claimId = positiveInteger(body.claim_id);

  if (!claimId) {
    return { error: "claim_id is required.", status: 400 };
  }

  const { data: claim, error: claimError } = await adminClient
    .from("insurance_claims")
    .select("*")
    .eq("id", claimId)
    .limit(1)
    .maybeSingle();

  if (claimError) {
    return { error: claimError.message, status: 500 };
  }

  if (!claim) {
    return { error: "Insurance claim was not found.", status: 404 };
  }

  if (claim.user_id !== userId) {
    return {
      error: "You are not allowed to analyse this claim.",
      status: 403,
    };
  }

  const damageAssessmentId =
    positiveInteger(body.damage_assessment_id) ??
    (await findLatestId(
      adminClient,
      "smart_damage_assessments",
      "claim_id",
      claimId
    ));

  const surveyReviewId =
    positiveInteger(body.survey_review_id) ??
    (await findLatestId(
      adminClient,
      "insurance_survey_reviews",
      "claim_id",
      claimId
    ));

  const repairJobId =
    positiveInteger(body.repair_job_id) ??
    (await findLatestId(
      adminClient,
      "garage_repair_jobs",
      "claim_id",
      claimId
    ));

  let garageId = positiveInteger(body.garage_id);

  if (!garageId && repairJobId) {
    const { data: repairJob } = await adminClient
      .from("garage_repair_jobs")
      .select("garage_id")
      .eq("id", repairJobId)
      .limit(1)
      .maybeSingle();

    garageId = positiveInteger(repairJob?.garage_id);
  }

  const { data, error } = await adminClient
    .from("insurance_fraud_reviews")
    .insert({
      user_id: userId,
      claim_id: claimId,
      policy_id: positiveInteger(claim.policy_id),
      vehicle_id: positiveInteger(claim.vehicle_id),
      damage_assessment_id: damageAssessmentId,
      survey_review_id: surveyReviewId,
      repair_job_id: repairJobId,
      garage_id: garageId,
      review_status: "draft",
      risk_level: "unknown",
      recommendation: "manual_review",
      manual_investigation_required: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      error: error?.message || "Unable to create fraud review.",
      status: 500,
    };
  }

  return { review: data as FraudReviewRow };
}

async function findLatestId(
  adminClient: any,
  table: string,
  filterColumn: string,
  filterValue: number
) {
  const { data } = await adminClient
    .from(table)
    .select("id")
    .eq(filterColumn, filterValue)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return positiveInteger(data?.id);
}

async function loadFraudSourceData(
  adminClient: any,
  review: FraudReviewRow
) {
  const [
    claimResult,
    policyResult,
    vehicleResult,
    damageResult,
    damageFindingsResult,
    damageImagesResult,
    surveyResult,
    surveyFindingsResult,
    repairResult,
    claimDocumentsResult,
    claimTimelineResult,
    claimHistoryResult,
    fingerprintsResult,
  ] = await Promise.all([
    adminClient
      .from("insurance_claims")
      .select("*")
      .eq("id", review.claim_id)
      .limit(1)
      .maybeSingle(),

    review.policy_id
      ? adminClient
          .from("insurance_policies")
          .select("*")
          .eq("id", review.policy_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    adminClient
      .from("vehicles")
      .select("*")
      .eq("id", review.vehicle_id)
      .limit(1)
      .maybeSingle(),

    review.damage_assessment_id
      ? adminClient
          .from("smart_damage_assessments")
          .select("*")
          .eq("id", review.damage_assessment_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    review.damage_assessment_id
      ? adminClient
          .from("smart_damage_findings")
          .select("*")
          .eq("assessment_id", review.damage_assessment_id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    review.damage_assessment_id
      ? adminClient
          .from("smart_damage_images")
          .select("*")
          .eq("assessment_id", review.damage_assessment_id)
          .order("capture_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    review.survey_review_id
      ? adminClient
          .from("insurance_survey_reviews")
          .select("*")
          .eq("id", review.survey_review_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    review.survey_review_id
      ? adminClient
          .from("insurance_survey_findings")
          .select("*")
          .eq("survey_review_id", review.survey_review_id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    review.repair_job_id
      ? adminClient
          .from("garage_repair_jobs")
          .select(
            `
              *,
              cashless_garages (
                id,
                name,
                city,
                state,
                is_verified,
                is_cashless
              )
            `
          )
          .eq("id", review.repair_job_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    adminClient
      .from("insurance_claim_documents")
      .select("*")
      .eq("claim_id", review.claim_id)
      .order("created_at", { ascending: false }),

    adminClient
      .from("insurance_claim_timeline")
      .select("*")
      .eq("claim_id", review.claim_id)
      .order("created_at", { ascending: true }),

    adminClient
      .from("insurance_claim_risk_history")
      .select("*")
      .eq("vehicle_id", review.vehicle_id)
      .neq("claim_id", review.claim_id)
      .order("incident_date", { ascending: false })
      .limit(20),

    adminClient
      .from("insurance_claim_image_fingerprints")
      .select("*")
      .eq("claim_id", review.claim_id)
      .order("created_at", { ascending: true }),
  ]);

  const error = [
    claimResult.error,
    policyResult.error,
    vehicleResult.error,
    damageResult.error,
    damageFindingsResult.error,
    damageImagesResult.error,
    surveyResult.error,
    surveyFindingsResult.error,
    repairResult.error,
    claimDocumentsResult.error,
    claimTimelineResult.error,
    claimHistoryResult.error,
    fingerprintsResult.error,
  ].find(Boolean);

  if (error) {
    throw new Error(error.message);
  }

  return {
    claim: claimResult.data,
    policy: policyResult.data,
    vehicle: vehicleResult.data,
    damageAssessment: damageResult.data,
    damageFindings: damageFindingsResult.data ?? [],
    damageImages: damageImagesResult.data ?? [],
    surveyReview: surveyResult.data,
    surveyFindings: surveyFindingsResult.data ?? [],
    repairJob: repairResult.data,
    claimDocuments: claimDocumentsResult.data ?? [],
    claimTimeline: claimTimelineResult.data ?? [],
    historicalClaims: claimHistoryResult.data ?? [],
    fingerprints: fingerprintsResult.data ?? [],
  };
}

async function syncImageFingerprints(
  adminClient: any,
  review: FraudReviewRow,
  sourceData: Awaited<ReturnType<typeof loadFraudSourceData>>
) {
  for (const image of sourceData.damageImages) {
    const existing = sourceData.fingerprints.find(
      (fingerprint: any) =>
        Number(fingerprint.damage_image_id) === Number(image.id)
    );

    if (existing) continue;

    let exactDuplicate: any = null;

    if (image.perceptual_hash) {
      const { data } = await adminClient
        .from("insurance_claim_image_fingerprints")
        .select("*")
        .eq("sha256_hash", image.perceptual_hash)
        .neq("claim_id", review.claim_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      exactDuplicate = data;
    }

    const { error } = await adminClient
      .from("insurance_claim_image_fingerprints")
      .insert({
        user_id: review.user_id,
        claim_id: review.claim_id,
        damage_assessment_id: review.damage_assessment_id,
        damage_image_id: image.id,
        storage_path: image.storage_path,
        sha256_hash: image.perceptual_hash,
        perceptual_hash: image.perceptual_hash,
        original_file_name: image.original_file_name,
        mime_type: image.mime_type,
        file_size_bytes: image.file_size_bytes,
        taken_at: image.taken_at,
        metadata_summary: {
          capture_angle: image.capture_angle,
          image_quality_status: image.image_quality_status,
          blur_score: image.blur_score,
          brightness_score: image.brightness_score,
        },
        metadata_warnings: image.metadata_warning
          ? [image.metadata_warning]
          : [],
        is_exact_duplicate: Boolean(exactDuplicate),
        exact_duplicate_of_id: exactDuplicate?.id ?? null,
        is_visual_near_duplicate: false,
        duplicate_similarity: exactDuplicate ? 100 : null,
        manual_review_required:
          Boolean(exactDuplicate) ||
          image.duplicate_status === "manual_review_required",
      });

    if (error) {
      throw new Error(error.message);
    }
  }
}

function buildDeterministicSignals(
  sourceData: Awaited<ReturnType<typeof loadFraudSourceData>>
) {
  const exactDuplicates = sourceData.fingerprints.filter(
    (item: any) => item.is_exact_duplicate
  );

  const duplicateImages = sourceData.damageImages.filter(
    (item: any) =>
      item.duplicate_status === "confirmed_duplicate" ||
      item.duplicate_status === "possible_duplicate" ||
      item.duplicate_status === "manual_review_required"
  );

  const poorQualityImages = sourceData.damageImages.filter(
    (item: any) =>
      ["blurry", "too_dark", "too_bright", "unusable"].includes(
        item.image_quality_status
      )
  );

  const mandatoryDocuments = [
    "rc",
    "driving_licence",
    "insurance_policy",
  ];

  const documentTypes = new Set<string>(
    sourceData.claimDocuments.map((item: any): string =>
      String(
        item.document_type ??
          item.ai_classification ??
          item.document_name ??
          ""
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
    )
  );

  const missingMandatoryDocuments = mandatoryDocuments.filter(
    (required) =>
      !Array.from(documentTypes).some((actual: string) =>
        actual.includes(required)
      )
  );

  const policyStartDate = parseDate(sourceData.policy?.start_date);
  const incidentDate = parseDate(sourceData.claim?.incident_date);

  const daysFromPolicyStartToIncident =
    policyStartDate && incidentDate
      ? Math.floor(
          (incidentDate.getTime() - policyStartDate.getTime()) /
            86400000
        )
      : null;

  const recentPolicy =
    daysFromPolicyStartToIncident !== null &&
    daysFromPolicyStartToIncident >= 0 &&
    daysFromPolicyStartToIncident <= 15;

  const historicalClaims = sourceData.historicalClaims ?? [];

  const recentHistoricalClaims = historicalClaims.filter(
    (item: any) => {
      const historicalDate = parseDate(item.incident_date);
      if (!historicalDate || !incidentDate) return false;

      const days = Math.abs(
        (incidentDate.getTime() - historicalDate.getTime()) /
          86400000
      );

      return days <= 180;
    }
  );

  const currentParts = new Set<string>(
    sourceData.damageFindings.map((item: any): string =>
      String(item.vehicle_part_code || "").toLowerCase()
    )
  );

  const repeatedPartCodes = historicalClaims.flatMap((item: any) =>
    Array.isArray(item.repeated_part_codes)
      ? item.repeated_part_codes
      : []
  );

  const repeatedParts = Array.from(currentParts).filter((part) =>
    repeatedPartCodes.some(
      (historicalPart: unknown) =>
        String(historicalPart).toLowerCase() === part
    )
  );

  const aiCostMin = numberOrNull(
    sourceData.damageAssessment?.estimated_repair_cost_min
  );

  const aiCostMax = numberOrNull(
    sourceData.damageAssessment?.estimated_repair_cost_max
  );

  const garageEstimate = numberOrNull(
    sourceData.repairJob?.estimated_cost ??
      sourceData.claim?.estimated_repair_cost
  );

  const estimateVariancePercent =
    aiCostMax !== null &&
    garageEstimate !== null &&
    aiCostMax > 0
      ? ((garageEstimate - aiCostMax) / aiCostMax) * 100
      : null;

  const estimateAboveAiRange =
    estimateVariancePercent !== null &&
    estimateVariancePercent > 35;

  const timelineDates = sourceData.claimTimeline
    .map((event: any) => parseDate(event.created_at))
    .filter((date: Date | null): date is Date => Boolean(date));

  const timelineOutOfOrder = timelineDates.some(
    (date: Date, index: number) =>
      index > 0 && date.getTime() < timelineDates[index - 1].getTime()
  );

  return {
    exact_duplicate_count: exactDuplicates.length,
    duplicate_image_count: duplicateImages.length,
    poor_quality_image_count: poorQualityImages.length,
    missing_mandatory_documents: missingMandatoryDocuments,
    days_from_policy_start_to_incident:
      daysFromPolicyStartToIncident,
    policy_recently_purchased: recentPolicy,
    historical_claim_count: historicalClaims.length,
    recent_claim_count_180_days: recentHistoricalClaims.length,
    repeated_part_codes: repeatedParts,
    ai_cost_min: aiCostMin,
    ai_cost_max: aiCostMax,
    garage_estimate: garageEstimate,
    estimate_variance_percent: estimateVariancePercent,
    estimate_above_ai_range: estimateAboveAiRange,
    timeline_out_of_order: timelineOutOfOrder,
  };
}

async function analyseWithOpenAI(args: {
  apiKey: string;
  model: string;
  review: FraudReviewRow;
  sourceData: Awaited<ReturnType<typeof loadFraudSourceData>>;
  deterministicSignals: ReturnType<typeof buildDeterministicSignals>;
}) {
  const prompt = buildFraudPrompt(
    args.review,
    args.sourceData,
    args.deterministicSignals
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      temperature: 0,
      max_output_tokens: 8000,
      text: {
        format: {
          type: "json_schema",
          name: "insurance_claim_risk_analysis",
          strict: true,
          schema: FRAUD_SCHEMA,
        },
      },
    }),
  });

  const result = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        "The AI service could not complete the claim-risk review."
    );
  }

  const outputText = extractOutputText(result);

  if (!outputText) {
    throw new Error("The AI service returned an empty risk review.");
  }

  try {
    return JSON.parse(outputText) as FraudAnalysis;
  } catch {
    throw new Error("The AI service returned invalid risk-review JSON.");
  }
}

function buildFraudPrompt(
  review: FraudReviewRow,
  sourceData: Awaited<ReturnType<typeof loadFraudSourceData>>,
  deterministicSignals: ReturnType<typeof buildDeterministicSignals>
) {
  const compactData = {
    fraud_review: review,
    deterministic_signals: deterministicSignals,
    claim: sanitizeForPrompt(sourceData.claim),
    policy: sanitizeForPrompt(sourceData.policy),
    vehicle: sanitizeForPrompt(sourceData.vehicle),
    smart_damage_assessment: sanitizeForPrompt(
      sourceData.damageAssessment
    ),
    smart_damage_findings: sanitizeForPrompt(
      sourceData.damageFindings
    ),
    damage_images: sanitizeForPrompt(
      sourceData.damageImages.map((image: any) => ({
        id: image.id,
        capture_angle: image.capture_angle,
        image_quality_status: image.image_quality_status,
        duplicate_status: image.duplicate_status,
        metadata_warning: image.metadata_warning,
        taken_at: image.taken_at,
        created_at: image.created_at,
      }))
    ),
    image_fingerprints: sanitizeForPrompt(
      sourceData.fingerprints.map((item: any) => ({
        id: item.id,
        is_exact_duplicate: item.is_exact_duplicate,
        is_visual_near_duplicate: item.is_visual_near_duplicate,
        duplicate_similarity: item.duplicate_similarity,
        metadata_warnings: item.metadata_warnings,
        taken_at: item.taken_at,
        uploaded_at: item.uploaded_at,
      }))
    ),
    survey_review: sanitizeForPrompt(sourceData.surveyReview),
    survey_findings: sanitizeForPrompt(sourceData.surveyFindings),
    repair_job: sanitizeForPrompt(sourceData.repairJob),
    claim_documents: sanitizeForPrompt(
      sourceData.claimDocuments.map((document: any) => ({
        id: document.id,
        document_type: document.document_type,
        document_name: document.document_name,
        verification_status: document.verification_status,
        ai_classification: document.ai_classification,
        is_duplicate: document.is_duplicate,
        created_at: document.created_at,
      }))
    ),
    claim_timeline: sanitizeForPrompt(
      sourceData.claimTimeline.map((event: any) => ({
        event_type: event.event_type,
        event_status: event.event_status,
        title: event.title,
        description: event.description,
        created_at: event.created_at,
      }))
    ),
    historical_claims: sanitizeForPrompt(sourceData.historicalClaims),
  };

  return `
You are Mira AI performing a cautious motor-insurance claim-consistency
and risk-indicator review for India.

This is not a fraud verdict. Your output must support human investigators,
surveyors and insurers. Never accuse a claimant, garage, surveyor or insurer
of fraud, dishonesty, manipulation or criminal conduct.

Core rules:

1. Produce risk indicators only, not a legal or factual finding of fraud.
2. Never automatically reject or hold a claim. Recommendations are advisory.
3. Treat exact duplicate hashes as exact-file matches only.
4. Do not claim visual near-duplicate detection unless supplied data says it
   was performed. A SHA-256 match is not perceptual similarity.
5. Do not claim image manipulation, editing or AI generation unless supplied
   metadata or evidence clearly supports a warning. Missing metadata alone
   is not proof of editing.
6. A garage estimate above an AI range is not automatically suspicious.
   Consider hidden damage, OEM parts, calibration, paint material, taxes,
   labour rates, city variation and physical inspection.
7. Repeated claims or repeated parts do not prove wrongdoing. They are only
   manual-review indicators when frequency or consistency needs checking.
8. Policy purchased shortly before an incident is a timing indicator only.
9. Missing documents should reduce completeness and trigger clarification.
10. Timeline differences should be flagged only when dates actually conflict.
11. Location inconsistency must remain false unless supplied location facts
    conflict.
12. Unsupported-parts detection requires garage estimate or invoice line-item
    evidence. Do not invent line items.
13. Invoice mismatch requires an actual invoice or final-bill comparison.
14. Scores:
    - risk_score: 0 means no meaningful indicator found; 100 means many strong
      indicators need urgent human investigation.
    - consistency sub-scores use 100 as strong consistency/completeness and
      0 as poor consistency/completeness.
15. risk_level:
    - low: no material inconsistency; normal processing can continue.
    - medium: clarification or focused manual checks are appropriate.
    - high: multiple or material indicators require enhanced investigation.
    - critical: rare; strong, corroborated and material inconsistencies need
      immediate authorized human review.
16. recommendation:
    - continue_normal_processing
    - clarification_required
    - manual_review
    - enhanced_investigation
    - hold_for_investigation
   "hold_for_investigation" is advisory only and should be used rarely.
17. High and critical indicators must require manual checking.
18. If evidence is incomplete, lower confidence and choose manual review or
    clarification rather than making a strong conclusion.
19. Explain every indicator using only supplied evidence.
20. Never infer protected personal traits or identity attributes.
21. Use professional, neutral wording such as "inconsistency", "requires
    verification", "possible duplicate" or "manual review recommended".
22. review_status must be manual_review_required when:
    - risk is high or critical;
    - recommendation is manual_review, enhanced_investigation or
      hold_for_investigation;
    - essential evidence is missing;
    - a high/critical indicator exists.
23. Return only valid data matching the JSON schema.

Source data:
${JSON.stringify(compactData, null, 2)}
`;
}

function normalizeAnalysis(
  value: FraudAnalysis,
  sourceData: Awaited<ReturnType<typeof loadFraudSourceData>>,
  deterministicSignals: ReturnType<typeof buildDeterministicSignals>
): FraudAnalysis {
  const indicators = (value.indicators ?? [])
    .filter((item) => Boolean(cleanText(item.indicator_title)))
    .map(normalizeIndicator);

  const hasHighIndicator = indicators.some(
    (item) =>
      item.severity === "high" ||
      item.severity === "critical"
  );

  const missingEvidence = uniqueStrings([
    ...cleanStringArray(value.missing_evidence, 40),
    ...deterministicSignals.missing_mandatory_documents.map(
      (item) => `Missing mandatory document: ${item}`
    ),
    ...(!sourceData.damageAssessment
      ? ["Smart damage assessment is unavailable."]
      : []),
    ...(!sourceData.policy
      ? ["Policy details are unavailable."]
      : []),
  ]).slice(0, 40);

  const duplicateDetected =
    Boolean(value.duplicate_photo_detected) ||
    deterministicSignals.exact_duplicate_count > 0 ||
    deterministicSignals.duplicate_image_count > 0;

  const recentlyPurchased =
    Boolean(value.policy_recently_purchased) ||
    deterministicSignals.policy_recently_purchased;

  const repeatedFrequency =
    Boolean(value.repeated_claim_frequency_detected) ||
    deterministicSignals.recent_claim_count_180_days >= 3;

  const repeatedDamage =
    Boolean(value.repeated_damage_pattern_detected) ||
    deterministicSignals.repeated_part_codes.length > 0;

  const estimateInflation =
    Boolean(value.estimate_inflation_detected) ||
    deterministicSignals.estimate_above_ai_range;

  const timelineInconsistency =
    Boolean(value.timeline_inconsistency_detected) ||
    deterministicSignals.timeline_out_of_order;

  const mandatoryMissing =
    Boolean(value.mandatory_documents_missing) ||
    deterministicSignals.missing_mandatory_documents.length > 0;

  const normalizedRiskLevel = normalizeRiskLevel(value.risk_level);

  const manualReviewRequired =
    Boolean(value.manual_investigation_required) ||
    hasHighIndicator ||
    missingEvidence.length > 0 ||
    normalizedRiskLevel === "high" ||
    normalizedRiskLevel === "critical" ||
    value.recommendation === "manual_review" ||
    value.recommendation === "enhanced_investigation" ||
    value.recommendation === "hold_for_investigation";

  return {
    review_status: manualReviewRequired
      ? "manual_review_required"
      : "completed",
    risk_level: normalizedRiskLevel,
    risk_score: clampPercent(value.risk_score),
    risk_confidence: clampPercent(value.risk_confidence),
    recommendation: normalizeRecommendation(value.recommendation),
    recommendation_summary: cleanText(
      value.recommendation_summary
    ),
    duplicate_evidence_score: clampPercent(
      value.duplicate_evidence_score
    ),
    image_integrity_score: clampPercent(
      value.image_integrity_score
    ),
    timeline_consistency_score: clampPercent(
      value.timeline_consistency_score
    ),
    estimate_consistency_score: clampPercent(
      value.estimate_consistency_score
    ),
    policy_timing_score: clampPercent(
      value.policy_timing_score
    ),
    document_completeness_score: clampPercent(
      value.document_completeness_score
    ),
    historical_pattern_score: clampPercent(
      value.historical_pattern_score
    ),
    duplicate_photo_detected: duplicateDetected,
    possible_image_editing_detected: Boolean(
      value.possible_image_editing_detected
    ),
    repeated_damage_pattern_detected: repeatedDamage,
    policy_recently_purchased: recentlyPurchased,
    repeated_claim_frequency_detected: repeatedFrequency,
    estimate_inflation_detected: estimateInflation,
    unsupported_parts_detected: Boolean(
      value.unsupported_parts_detected
    ),
    invoice_mismatch_detected: Boolean(
      value.invoice_mismatch_detected
    ),
    timeline_inconsistency_detected: timelineInconsistency,
    location_inconsistency_detected: Boolean(
      value.location_inconsistency_detected
    ),
    mandatory_documents_missing: mandatoryMissing,
    risk_reasons: cleanStringArray(value.risk_reasons, 40),
    evidence_summary:
      typeof value.evidence_summary === "object" &&
      value.evidence_summary !== null &&
      !Array.isArray(value.evidence_summary)
        ? value.evidence_summary
        : {},
    conflicting_facts: cleanStringArray(
      value.conflicting_facts,
      40
    ),
    missing_evidence: missingEvidence,
    recommended_checks: cleanStringArray(
      value.recommended_checks,
      40
    ),
    clarification_questions: cleanStringArray(
      value.clarification_questions,
      40
    ),
    manual_investigation_required: manualReviewRequired,
    manual_investigation_reasons: uniqueStrings([
      ...cleanStringArray(
        value.manual_investigation_reasons,
        40
      ),
      ...(hasHighIndicator
        ? ["One or more high-severity indicators require human review."]
        : []),
      ...(missingEvidence.length
        ? ["Material evidence is missing or incomplete."]
        : []),
    ]).slice(0, 40),
    indicators,
    report_summary: cleanText(value.report_summary),
  };
}

function normalizeIndicator(
  indicator: FraudIndicator
): FraudIndicator {
  const expected = cleanText(indicator.expected_value);
  const observed = cleanText(indicator.observed_value);

  return {
    indicator_code:
      slugify(indicator.indicator_code) ||
      `indicator_${crypto.randomUUID()}`,
    indicator_category:
      slugify(indicator.indicator_category) || "general",
    indicator_title: cleanText(indicator.indicator_title),
    indicator_description: cleanText(
      indicator.indicator_description
    ),
    severity: normalizeIndicatorSeverity(indicator.severity),
    confidence: clampPercent(indicator.confidence),
    source_type: cleanText(indicator.source_type) || "claim",
    source_id: positiveInteger(indicator.source_id),
    source_reference: cleanText(
      indicator.source_reference
    ),
    expected_value: expected,
    observed_value: observed,
    variance_amount: cleanSignedNumber(
      indicator.variance_amount
    ),
    variance_percent: cleanSignedNumber(
      indicator.variance_percent
    ),
    requires_manual_check:
      Boolean(indicator.requires_manual_check) ||
      indicator.severity === "high" ||
      indicator.severity === "critical",
    metadata:
      typeof indicator.metadata === "object" &&
      indicator.metadata !== null &&
      !Array.isArray(indicator.metadata)
        ? indicator.metadata
        : {},
  };
}

async function saveFraudAnalysis(args: {
  adminClient: any;
  review: FraudReviewRow;
  model: string;
  analysis: FraudAnalysis;
  sourceData: Awaited<ReturnType<typeof loadFraudSourceData>>;
}) {
  const {
    adminClient,
    review,
    model,
    analysis,
  } = args;

  const { error: reviewError } = await adminClient
    .from("insurance_fraud_reviews")
    .update({
      review_status: analysis.review_status,
      risk_level: analysis.risk_level,
      risk_score: analysis.risk_score,
      risk_confidence: analysis.risk_confidence,
      recommendation: analysis.recommendation,
      recommendation_summary:
        analysis.recommendation_summary,
      duplicate_evidence_score:
        analysis.duplicate_evidence_score,
      image_integrity_score:
        analysis.image_integrity_score,
      timeline_consistency_score:
        analysis.timeline_consistency_score,
      estimate_consistency_score:
        analysis.estimate_consistency_score,
      policy_timing_score:
        analysis.policy_timing_score,
      document_completeness_score:
        analysis.document_completeness_score,
      historical_pattern_score:
        analysis.historical_pattern_score,
      duplicate_photo_detected:
        analysis.duplicate_photo_detected,
      possible_image_editing_detected:
        analysis.possible_image_editing_detected,
      repeated_damage_pattern_detected:
        analysis.repeated_damage_pattern_detected,
      policy_recently_purchased:
        analysis.policy_recently_purchased,
      repeated_claim_frequency_detected:
        analysis.repeated_claim_frequency_detected,
      estimate_inflation_detected:
        analysis.estimate_inflation_detected,
      unsupported_parts_detected:
        analysis.unsupported_parts_detected,
      invoice_mismatch_detected:
        analysis.invoice_mismatch_detected,
      timeline_inconsistency_detected:
        analysis.timeline_inconsistency_detected,
      location_inconsistency_detected:
        analysis.location_inconsistency_detected,
      mandatory_documents_missing:
        analysis.mandatory_documents_missing,
      risk_reasons: analysis.risk_reasons,
      evidence_summary: analysis.evidence_summary,
      conflicting_facts: analysis.conflicting_facts,
      missing_evidence: analysis.missing_evidence,
      recommended_checks: analysis.recommended_checks,
      clarification_questions:
        analysis.clarification_questions,
      manual_investigation_required:
        analysis.manual_investigation_required,
      manual_investigation_reasons:
        analysis.manual_investigation_reasons,
      ai_model: model,
      ai_raw_response: analysis,
      analysed_at: new Date().toISOString(),
    })
    .eq("id", review.id);

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  await adminClient
    .from("insurance_fraud_indicators")
    .delete()
    .eq("fraud_review_id", review.id);

  if (analysis.indicators.length) {
    const rows = analysis.indicators.map((indicator) => ({
      user_id: review.user_id,
      fraud_review_id: review.id,
      indicator_code: indicator.indicator_code,
      indicator_category: indicator.indicator_category,
      indicator_title: indicator.indicator_title,
      indicator_description:
        indicator.indicator_description,
      severity: indicator.severity,
      confidence: indicator.confidence,
      source_type: indicator.source_type,
      source_id: indicator.source_id,
      source_reference:
        indicator.source_reference || null,
      expected_value:
        indicator.expected_value || null,
      observed_value:
        indicator.observed_value || null,
      variance_amount: indicator.variance_amount,
      variance_percent: indicator.variance_percent,
      requires_manual_check:
        indicator.requires_manual_check,
      metadata: indicator.metadata,
    }));

    const { error } = await adminClient
      .from("insurance_fraud_indicators")
      .insert(rows);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: latestReport } = await adminClient
    .from("insurance_fraud_reports")
    .select("report_version")
    .eq("fraud_review_id", review.id)
    .order("report_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion =
    Number(latestReport?.report_version ?? 0) + 1;

  const { error: reportError } = await adminClient
    .from("insurance_fraud_reports")
    .insert({
      user_id: review.user_id,
      fraud_review_id: review.id,
      report_version: nextVersion,
      report_status:
        analysis.manual_investigation_required
          ? "draft"
          : "generated",
      report_title: "AI-Assisted Claim Risk Review",
      report_summary: analysis.report_summary,
      report_json: {
        fraud_review_reference:
          review.fraud_review_reference,
        source_ids: {
          claim_id: review.claim_id,
          policy_id: review.policy_id,
          vehicle_id: review.vehicle_id,
          damage_assessment_id:
            review.damage_assessment_id,
          survey_review_id: review.survey_review_id,
          repair_job_id: review.repair_job_id,
          garage_id: review.garage_id,
        },
        analysis,
      },
    });

  if (reportError) {
    throw new Error(reportError.message);
  }
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
      openAiApiKey: string;
      fraudModel: string;
    }
  | { error: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey ||
    !openAiApiKey
  ) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL, " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY are required.",
    };
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    openAiApiKey,
    fraudModel:
      process.env.OPENAI_FRAUD_MODEL ||
      "gpt-4.1-mini",
  };
}

function extractOutputText(result: OpenAIResponse) {
  if (typeof result.output_text === "string") {
    return result.output_text.trim();
  }

  for (const outputItem of result.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (typeof contentItem.text === "string") {
        return contentItem.text.trim();
      }
    }
  }

  return "";
}

function sanitizeForPrompt(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (
        typeof item === "string" &&
        item.length > 4000
      ) {
        return `${item.slice(0, 4000)}…`;
      }

      return item;
    })
  );
}

function positiveInteger(value: unknown) {
  const numeric = Number(value);

  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : null;
}

function parseDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

function numberOrNull(value: unknown) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, 8000)
    : "";
}

function cleanStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function cleanSignedNumber(value: unknown): number | null {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value: unknown) {
  return Math.round(clampNumber(value, 0, 100));
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number
) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, numeric));
}

function normalizeRiskLevel(
  value: unknown
): FraudAnalysis["risk_level"] {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeRecommendation(
  value: unknown
): FraudAnalysis["recommendation"] {
  if (
    value === "continue_normal_processing" ||
    value === "clarification_required" ||
    value === "manual_review" ||
    value === "enhanced_investigation" ||
    value === "hold_for_investigation"
  ) {
    return value;
  }

  return "manual_review";
}

function normalizeIndicatorSeverity(
  value: unknown
): FraudIndicator["severity"] {
  if (
    value === "info" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
  ) {
    return value;
  }

  return "info";
}

function slugify(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function percentSchema() {
  return {
    type: "integer",
    minimum: 0,
    maximum: 100,
  } as const;
}

function nullableIntegerSchema() {
  return {
    anyOf: [
      { type: "integer", minimum: 1 },
      { type: "null" },
    ],
  } as const;
}

function nullableSignedNumberSchema() {
  return {
    anyOf: [
      { type: "number" },
      { type: "null" },
    ],
  } as const;
}

function stringArraySchema(maxItems: number) {
  return {
    type: "array",
    maxItems,
    items: { type: "string" },
  } as const;
}