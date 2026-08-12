import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type AnalyseTotalLossBody = {
  claim_id?: number;
  total_loss_review_id?: number;
  damage_assessment_id?: number | null;
  survey_review_id?: number | null;
  fraud_review_id?: number | null;
  repair_job_id?: number | null;
  garage_id?: number | null;
  estimated_market_value?: number | null;
  salvage_value_min?: number | null;
  salvage_value_max?: number | null;
};

type TotalLossReviewRow = {
  id: number;
  user_id: string;
  claim_id: number;
  policy_id: number | null;
  vehicle_id: number;
  damage_assessment_id: number | null;
  survey_review_id: number | null;
  fraud_review_id: number | null;
  repair_job_id: number | null;
  garage_id: number | null;
  total_loss_reference: string | null;
  review_status: string;
};

type TotalLossIndicator = {
  indicator_code: string;
  indicator_category: string;
  indicator_title: string;
  indicator_description: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  confidence: number;
  source_type: string;
  source_id: number | null;
  source_reference: string;
  observed_value: string;
  threshold_value: string;
  ratio_value: number | null;
  supports_repair: boolean;
  supports_total_loss_review: boolean;
  requires_physical_confirmation: boolean;
  metadata: Record<string, unknown>;
};

type TotalLossAnalysis = {
  review_status: "completed" | "manual_review_required";

  recommendation:
    | "economical_repair"
    | "repair_with_conditions"
    | "reinspection_required"
    | "constructive_total_loss_review"
    | "total_loss_review"
    | "salvage_review"
    | "high_risk_repair"
    | "manual_review";

  recommendation_confidence: number;

  total_loss_score: number;
  repairability_score: number;
  safety_score: number;
  cost_efficiency_score: number;
  salvage_recovery_score: number;

  vehicle_age_years: number | null;

  insured_declared_value: number | null;
  estimated_market_value: number | null;
  ai_repair_cost_min: number | null;
  ai_repair_cost_max: number | null;
  garage_repair_estimate: number | null;
  survey_recommended_amount_min: number | null;
  survey_recommended_amount_max: number | null;

  salvage_value_min: number | null;
  salvage_value_max: number | null;

  repair_to_idv_ratio_min: number | null;
  repair_to_idv_ratio_max: number | null;
  repair_to_market_value_ratio_min: number | null;
  repair_to_market_value_ratio_max: number | null;

  structural_damage_suspected: boolean;
  chassis_damage_suspected: boolean;
  airbag_deployment_detected: boolean;
  flood_damage_suspected: boolean;
  fire_damage_suspected: boolean;
  engine_damage_suspected: boolean;
  suspension_damage_suspected: boolean;
  electrical_damage_suspected: boolean;

  oem_repair_feasible: boolean | null;
  parts_availability_status:
    | "unknown"
    | "available"
    | "limited"
    | "backordered"
    | "unavailable"
    | "requires_verification";

  roadworthiness_after_repair:
    | "unknown"
    | "likely"
    | "possible_with_conditions"
    | "uncertain"
    | "unlikely"
    | "requires_physical_confirmation";

  recommendation_summary: string;
  repairability_summary: string;
  safety_summary: string;
  financial_summary: string;
  salvage_summary: string;

  decision_reasons: string[];
  safety_risks: string[];
  financial_risks: string[];
  missing_evidence: string[];
  clarification_questions: string[];
  required_physical_checks: string[];
  approval_conditions: string[];

  manual_review_required: boolean;
  manual_review_reasons: string[];

  indicators: TotalLossIndicator[];
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

const TOTAL_LOSS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "review_status",
    "recommendation",
    "recommendation_confidence",
    "total_loss_score",
    "repairability_score",
    "safety_score",
    "cost_efficiency_score",
    "salvage_recovery_score",
    "vehicle_age_years",
    "insured_declared_value",
    "estimated_market_value",
    "ai_repair_cost_min",
    "ai_repair_cost_max",
    "garage_repair_estimate",
    "survey_recommended_amount_min",
    "survey_recommended_amount_max",
    "salvage_value_min",
    "salvage_value_max",
    "repair_to_idv_ratio_min",
    "repair_to_idv_ratio_max",
    "repair_to_market_value_ratio_min",
    "repair_to_market_value_ratio_max",
    "structural_damage_suspected",
    "chassis_damage_suspected",
    "airbag_deployment_detected",
    "flood_damage_suspected",
    "fire_damage_suspected",
    "engine_damage_suspected",
    "suspension_damage_suspected",
    "electrical_damage_suspected",
    "oem_repair_feasible",
    "parts_availability_status",
    "roadworthiness_after_repair",
    "recommendation_summary",
    "repairability_summary",
    "safety_summary",
    "financial_summary",
    "salvage_summary",
    "decision_reasons",
    "safety_risks",
    "financial_risks",
    "missing_evidence",
    "clarification_questions",
    "required_physical_checks",
    "approval_conditions",
    "manual_review_required",
    "manual_review_reasons",
    "indicators",
    "report_summary",
  ],
  properties: {
    review_status: {
      type: "string",
      enum: ["completed", "manual_review_required"],
    },
    recommendation: {
      type: "string",
      enum: [
        "economical_repair",
        "repair_with_conditions",
        "reinspection_required",
        "constructive_total_loss_review",
        "total_loss_review",
        "salvage_review",
        "high_risk_repair",
        "manual_review",
      ],
    },
    recommendation_confidence: percentSchema(),
    total_loss_score: percentSchema(),
    repairability_score: percentSchema(),
    safety_score: percentSchema(),
    cost_efficiency_score: percentSchema(),
    salvage_recovery_score: percentSchema(),
    vehicle_age_years: nullableNumberSchema(),
    insured_declared_value: nullableNumberSchema(),
    estimated_market_value: nullableNumberSchema(),
    ai_repair_cost_min: nullableNumberSchema(),
    ai_repair_cost_max: nullableNumberSchema(),
    garage_repair_estimate: nullableNumberSchema(),
    survey_recommended_amount_min: nullableNumberSchema(),
    survey_recommended_amount_max: nullableNumberSchema(),
    salvage_value_min: nullableNumberSchema(),
    salvage_value_max: nullableNumberSchema(),
    repair_to_idv_ratio_min: nullableNumberSchema(),
    repair_to_idv_ratio_max: nullableNumberSchema(),
    repair_to_market_value_ratio_min: nullableNumberSchema(),
    repair_to_market_value_ratio_max: nullableNumberSchema(),
    structural_damage_suspected: { type: "boolean" },
    chassis_damage_suspected: { type: "boolean" },
    airbag_deployment_detected: { type: "boolean" },
    flood_damage_suspected: { type: "boolean" },
    fire_damage_suspected: { type: "boolean" },
    engine_damage_suspected: { type: "boolean" },
    suspension_damage_suspected: { type: "boolean" },
    electrical_damage_suspected: { type: "boolean" },
    oem_repair_feasible: {
      anyOf: [{ type: "boolean" }, { type: "null" }],
    },
    parts_availability_status: {
      type: "string",
      enum: [
        "unknown",
        "available",
        "limited",
        "backordered",
        "unavailable",
        "requires_verification",
      ],
    },
    roadworthiness_after_repair: {
      type: "string",
      enum: [
        "unknown",
        "likely",
        "possible_with_conditions",
        "uncertain",
        "unlikely",
        "requires_physical_confirmation",
      ],
    },
    recommendation_summary: { type: "string" },
    repairability_summary: { type: "string" },
    safety_summary: { type: "string" },
    financial_summary: { type: "string" },
    salvage_summary: { type: "string" },
    decision_reasons: stringArraySchema(40),
    safety_risks: stringArraySchema(40),
    financial_risks: stringArraySchema(40),
    missing_evidence: stringArraySchema(40),
    clarification_questions: stringArraySchema(40),
    required_physical_checks: stringArraySchema(40),
    approval_conditions: stringArraySchema(40),
    manual_review_required: { type: "boolean" },
    manual_review_reasons: stringArraySchema(40),
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
          "observed_value",
          "threshold_value",
          "ratio_value",
          "supports_repair",
          "supports_total_loss_review",
          "requires_physical_confirmation",
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
          observed_value: { type: "string" },
          threshold_value: { type: "string" },
          ratio_value: nullableNumberSchema(),
          supports_repair: { type: "boolean" },
          supports_total_loss_review: { type: "boolean" },
          requires_physical_confirmation: { type: "boolean" },
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
  let reviewId: number | null = null;

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
        { error: "You must be signed in to analyse total-loss risk." },
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

    const body = (await request.json()) as AnalyseTotalLossBody;

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

    const reviewResult = await getOrCreateReview(
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
    reviewId = review.id;

    await adminClient
      .from("insurance_total_loss_reviews")
      .update({ review_status: "analysing" })
      .eq("id", review.id);

    const sourceData = await loadSourceData(
      adminClient as any,
      review
    );

    if (!sourceData.claim) {
      throw new Error("The linked insurance claim was not found.");
    }

    if (!sourceData.vehicle) {
      throw new Error("The linked vehicle was not found.");
    }

    const deterministic = buildDeterministicInputs(
      sourceData,
      body
    );

    const aiAnalysis = await analyseWithOpenAI({
      apiKey: environment.openAiApiKey,
      model: environment.totalLossModel,
      review,
      sourceData,
      deterministic,
    });

    const normalized = normalizeAnalysis(
      aiAnalysis,
      sourceData,
      deterministic
    );

    await saveAnalysis({
      adminClient: adminClient as any,
      review,
      model: environment.totalLossModel,
      analysis: normalized,
    });

    return NextResponse.json({
      success: true,
      total_loss_review_id: review.id,
      total_loss_reference: review.total_loss_reference,
      review_status: normalized.review_status,
      recommendation: normalized.recommendation,
      recommendation_confidence:
        normalized.recommendation_confidence,
      total_loss_score: normalized.total_loss_score,
      repairability_score: normalized.repairability_score,
      safety_score: normalized.safety_score,
      manual_review_required:
        normalized.manual_review_required,
      analysis: normalized,
    });
  } catch (error) {
    console.error("AI Total Loss Decision Engine error:", error);

    try {
      const environment = readEnvironment();

      if (!("error" in environment) && reviewId) {
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
          .from("insurance_total_loss_reviews")
          .update({ review_status: "failed" })
          .eq("id", reviewId);
      }
    } catch (cleanupError) {
      console.error("Total-loss review cleanup failed:", cleanupError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mira could not complete the total-loss analysis.",
      },
      { status: 500 }
    );
  }
}

async function getOrCreateReview(
  adminClient: any,
  userId: string,
  body: AnalyseTotalLossBody
): Promise<
  | { review: TotalLossReviewRow }
  | { error: string; status: number }
> {
  const requestedReviewId = positiveInteger(
    body.total_loss_review_id
  );

  if (requestedReviewId) {
    const { data, error } = await adminClient
      .from("insurance_total_loss_reviews")
      .select("*")
      .eq("id", requestedReviewId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message, status: 500 };
    }

    if (!data) {
      return { error: "Total-loss review was not found.", status: 404 };
    }

    if (data.user_id !== userId) {
      return {
        error: "You are not allowed to access this review.",
        status: 403,
      };
    }

    return { review: data as TotalLossReviewRow };
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

  const fraudReviewId =
    positiveInteger(body.fraud_review_id) ??
    (await findLatestId(
      adminClient,
      "insurance_fraud_reviews",
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
    .from("insurance_total_loss_reviews")
    .insert({
      user_id: userId,
      claim_id: claimId,
      policy_id: positiveInteger(claim.policy_id),
      vehicle_id: positiveInteger(claim.vehicle_id),
      damage_assessment_id: damageAssessmentId,
      survey_review_id: surveyReviewId,
      fraud_review_id: fraudReviewId,
      repair_job_id: repairJobId,
      garage_id: garageId,
      review_status: "draft",
      recommendation: "manual_review",
      manual_review_required: true,
      estimated_market_value:
        cleanMoney(body.estimated_market_value),
      salvage_value_min:
        cleanMoney(body.salvage_value_min),
      salvage_value_max:
        cleanMoney(body.salvage_value_max),
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      error: error?.message || "Unable to create total-loss review.",
      status: 500,
    };
  }

  return { review: data as TotalLossReviewRow };
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

async function loadSourceData(
  adminClient: any,
  review: TotalLossReviewRow
) {
  const [
    claimResult,
    policyResult,
    vehicleResult,
    damageResult,
    damageFindingsResult,
    surveyResult,
    surveyFindingsResult,
    fraudResult,
    fraudIndicatorsResult,
    repairResult,
    timelineResult,
    historyResult,
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

    review.fraud_review_id
      ? adminClient
          .from("insurance_fraud_reviews")
          .select("*")
          .eq("id", review.fraud_review_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    review.fraud_review_id
      ? adminClient
          .from("insurance_fraud_indicators")
          .select("*")
          .eq("fraud_review_id", review.fraud_review_id)
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
  ]);

  const error = [
    claimResult.error,
    policyResult.error,
    vehicleResult.error,
    damageResult.error,
    damageFindingsResult.error,
    surveyResult.error,
    surveyFindingsResult.error,
    fraudResult.error,
    fraudIndicatorsResult.error,
    repairResult.error,
    timelineResult.error,
    historyResult.error,
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
    surveyReview: surveyResult.data,
    surveyFindings: surveyFindingsResult.data ?? [],
    fraudReview: fraudResult.data,
    fraudIndicators: fraudIndicatorsResult.data ?? [],
    repairJob: repairResult.data,
    claimTimeline: timelineResult.data ?? [],
    historicalClaims: historyResult.data ?? [],
  };
}

function buildDeterministicInputs(
  sourceData: Awaited<ReturnType<typeof loadSourceData>>,
  body: AnalyseTotalLossBody
) {
  const year =
    positiveInteger(sourceData.vehicle?.manufacturing_year) ??
    positiveInteger(sourceData.vehicle?.year);

  const currentYear = new Date().getFullYear();

  const vehicleAgeYears =
    year && year <= currentYear
      ? currentYear - year
      : null;

  const idv =
    cleanMoney(sourceData.policy?.idv) ??
    cleanMoney(sourceData.claim?.insured_declared_value);

  const marketValue =
    cleanMoney(body.estimated_market_value) ??
    cleanMoney(sourceData.claim?.estimated_market_value);

  let aiMin = cleanMoney(
    sourceData.damageAssessment?.estimated_repair_cost_min
  );

  let aiMax = cleanMoney(
    sourceData.damageAssessment?.estimated_repair_cost_max
  );

  [aiMin, aiMax] = normalizeRange(aiMin, aiMax);

  const garageEstimate = cleanMoney(
    sourceData.repairJob?.estimated_cost ??
      sourceData.claim?.estimated_repair_cost
  );

  let surveyMin = cleanMoney(
    sourceData.surveyReview?.recommended_approved_amount_min
  );

  let surveyMax = cleanMoney(
    sourceData.surveyReview?.recommended_approved_amount_max
  );

  [surveyMin, surveyMax] = normalizeRange(
    surveyMin,
    surveyMax
  );

  let salvageMin =
    cleanMoney(body.salvage_value_min) ??
    cleanMoney(sourceData.claim?.salvage_value_min);

  let salvageMax =
    cleanMoney(body.salvage_value_max) ??
    cleanMoney(sourceData.claim?.salvage_value_max);

  [salvageMin, salvageMax] = normalizeRange(
    salvageMin,
    salvageMax
  );

  const repairCostMin =
    firstNonNull(
      surveyMin,
      aiMin,
      garageEstimate
    );

  const repairCostMax =
    firstNonNull(
      garageEstimate,
      surveyMax,
      aiMax
    );

  const repairToIdvRatioMin =
    ratio(repairCostMin, idv);

  const repairToIdvRatioMax =
    ratio(repairCostMax, idv);

  const repairToMarketValueRatioMin =
    ratio(repairCostMin, marketValue);

  const repairToMarketValueRatioMax =
    ratio(repairCostMax, marketValue);

  const textCorpus = JSON.stringify({
    damage: sourceData.damageAssessment,
    findings: sourceData.damageFindings,
    survey: sourceData.surveyReview,
    surveyFindings: sourceData.surveyFindings,
    repair: sourceData.repairJob,
  }).toLowerCase();

  const structuralDamage = includesAny(
    textCorpus,
    ["structural", "crumple zone", "frame damage"]
  );

  const chassisDamage = includesAny(
    textCorpus,
    ["chassis", "frame rail"]
  );

  const airbagDeployment = includesAny(
    textCorpus,
    ["airbag deployed", "airbag deployment"]
  );

  const floodDamage = includesAny(
    textCorpus,
    ["flood", "water ingress", "submerged"]
  );

  const fireDamage = includesAny(
    textCorpus,
    ["fire damage", "burn damage", "smoke damage"]
  );

  const engineDamage = includesAny(
    textCorpus,
    ["engine damage", "engine replacement", "engine seized"]
  );

  const suspensionDamage = includesAny(
    textCorpus,
    ["suspension damage", "axle damage", "control arm"]
  );

  const electricalDamage = includesAny(
    textCorpus,
    ["electrical damage", "wiring damage", "ecu damage"]
  );

  return {
    vehicle_age_years: vehicleAgeYears,
    insured_declared_value: idv,
    estimated_market_value: marketValue,
    ai_repair_cost_min: aiMin,
    ai_repair_cost_max: aiMax,
    garage_repair_estimate: garageEstimate,
    survey_recommended_amount_min: surveyMin,
    survey_recommended_amount_max: surveyMax,
    salvage_value_min: salvageMin,
    salvage_value_max: salvageMax,
    repair_to_idv_ratio_min: repairToIdvRatioMin,
    repair_to_idv_ratio_max: repairToIdvRatioMax,
    repair_to_market_value_ratio_min:
      repairToMarketValueRatioMin,
    repair_to_market_value_ratio_max:
      repairToMarketValueRatioMax,
    structural_damage_suspected: structuralDamage,
    chassis_damage_suspected: chassisDamage,
    airbag_deployment_detected: airbagDeployment,
    flood_damage_suspected: floodDamage,
    fire_damage_suspected: fireDamage,
    engine_damage_suspected: engineDamage,
    suspension_damage_suspected: suspensionDamage,
    electrical_damage_suspected: electricalDamage,
  };
}

async function analyseWithOpenAI(args: {
  apiKey: string;
  model: string;
  review: TotalLossReviewRow;
  sourceData: Awaited<ReturnType<typeof loadSourceData>>;
  deterministic: ReturnType<typeof buildDeterministicInputs>;
}) {
  const prompt = buildPrompt(
    args.review,
    args.sourceData,
    args.deterministic
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
          name: "insurance_total_loss_analysis",
          strict: true,
          schema: TOTAL_LOSS_SCHEMA,
        },
      },
    }),
  });

  const result = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        "The AI service could not complete the total-loss review."
    );
  }

  const outputText = extractOutputText(result);

  if (!outputText) {
    throw new Error(
      "The AI service returned an empty total-loss review."
    );
  }

  try {
    return JSON.parse(outputText) as TotalLossAnalysis;
  } catch {
    throw new Error(
      "The AI service returned invalid total-loss JSON."
    );
  }
}

function buildPrompt(
  review: TotalLossReviewRow,
  sourceData: Awaited<ReturnType<typeof loadSourceData>>,
  deterministic: ReturnType<typeof buildDeterministicInputs>
) {
  const compactData = {
    total_loss_review: review,
    deterministic_inputs: deterministic,
    claim: sanitizeForPrompt(sourceData.claim),
    policy: sanitizeForPrompt(sourceData.policy),
    vehicle: sanitizeForPrompt(sourceData.vehicle),
    smart_damage_assessment: sanitizeForPrompt(
      sourceData.damageAssessment
    ),
    smart_damage_findings: sanitizeForPrompt(
      sourceData.damageFindings
    ),
    survey_review: sanitizeForPrompt(
      sourceData.surveyReview
    ),
    survey_findings: sanitizeForPrompt(
      sourceData.surveyFindings
    ),
    claim_risk_review: sanitizeForPrompt(
      sourceData.fraudReview
    ),
    claim_risk_indicators: sanitizeForPrompt(
      sourceData.fraudIndicators
    ),
    repair_job: sanitizeForPrompt(
      sourceData.repairJob
    ),
    claim_timeline: sanitizeForPrompt(
      sourceData.claimTimeline
    ),
    historical_claims: sanitizeForPrompt(
      sourceData.historicalClaims
    ),
  };

  return `
You are Mira AI preparing a cautious motor-insurance repairability and
total-loss review for India.

This is advisory decision support only. Final classification must be made
by an authorized insurer or licensed surveyor after physical inspection
and review of applicable policy terms and regulations.

Rules:

1. Never declare a vehicle definitely repairable, roadworthy, total loss,
   constructive total loss, salvage-only, or safe to drive.
2. Never invent policy wording, regulatory thresholds, OEM instructions,
   parts availability, salvage bids, market value or hidden damage.
3. Use supplied IDV, market value, repair estimates and salvage values only.
4. When a required value is missing, keep it null and lower confidence.
5. A repair-to-IDV or repair-to-market-value ratio is only an indicator.
   Do not hard-code a legal threshold unless it is supplied in the data.
6. Structural, chassis, suspension, airbag, engine, flood, fire and
   electrical issues require physical confirmation unless explicit evidence
   is supplied.
7. Fraud-risk output must not decide total loss. It may only indicate that
   settlement or evidence should be reviewed.
8. Scores:
   - total_loss_score: higher means stronger reason for total-loss review.
   - repairability_score: higher means repair appears more feasible.
   - safety_score: higher means fewer apparent safety concerns, but this is
     not a roadworthiness certification.
   - cost_efficiency_score: higher means repair appears economically sensible.
   - salvage_recovery_score: higher means salvage recovery may materially
     affect settlement review.
9. Recommendations:
   - economical_repair
   - repair_with_conditions
   - reinspection_required
   - constructive_total_loss_review
   - total_loss_review
   - salvage_review
   - high_risk_repair
   - manual_review
10. "constructive_total_loss_review" and "total_loss_review" are review
    recommendations only, never final classifications.
11. "salvage_review" means obtain authorized salvage bids and settlement
    guidance; do not invent salvage prices.
12. Set manual_review_required when:
    - recommendation is constructive_total_loss_review,
      total_loss_review, salvage_review, high_risk_repair or manual_review;
    - structural/chassis/airbag/flood/fire/engine concerns exist;
    - required financial data is missing;
    - safety is uncertain;
    - any high or critical indicator exists.
13. OEM repair feasibility must be null unless evidence supports a view.
14. Parts availability must be "requires_verification" when not supplied.
15. Roadworthiness after repair must be "requires_physical_confirmation"
    when safety-critical damage exists or evidence is incomplete.
16. Every high or critical indicator must require physical confirmation.
17. Use neutral, professional language.
18. Return only valid data matching the JSON schema.

Source data:
${JSON.stringify(compactData, null, 2)}
`;
}

function normalizeAnalysis(
  value: TotalLossAnalysis,
  sourceData: Awaited<ReturnType<typeof loadSourceData>>,
  deterministic: ReturnType<typeof buildDeterministicInputs>
): TotalLossAnalysis {
  const indicators = (value.indicators ?? [])
    .filter((item) => Boolean(cleanText(item.indicator_title)))
    .map(normalizeIndicator);

  const hasHighIndicator = indicators.some(
    (item) =>
      item.severity === "high" ||
      item.severity === "critical"
  );

  let aiMin =
    cleanMoney(value.ai_repair_cost_min) ??
    deterministic.ai_repair_cost_min;

  let aiMax =
    cleanMoney(value.ai_repair_cost_max) ??
    deterministic.ai_repair_cost_max;

  [aiMin, aiMax] = normalizeRange(aiMin, aiMax);

  let surveyMin =
    cleanMoney(value.survey_recommended_amount_min) ??
    deterministic.survey_recommended_amount_min;

  let surveyMax =
    cleanMoney(value.survey_recommended_amount_max) ??
    deterministic.survey_recommended_amount_max;

  [surveyMin, surveyMax] = normalizeRange(
    surveyMin,
    surveyMax
  );

  let salvageMin =
    cleanMoney(value.salvage_value_min) ??
    deterministic.salvage_value_min;

  let salvageMax =
    cleanMoney(value.salvage_value_max) ??
    deterministic.salvage_value_max;

  [salvageMin, salvageMax] = normalizeRange(
    salvageMin,
    salvageMax
  );

  const idv =
    cleanMoney(value.insured_declared_value) ??
    deterministic.insured_declared_value;

  const marketValue =
    cleanMoney(value.estimated_market_value) ??
    deterministic.estimated_market_value;

  const garageEstimate =
    cleanMoney(value.garage_repair_estimate) ??
    deterministic.garage_repair_estimate;

  const structural =
    Boolean(value.structural_damage_suspected) ||
    deterministic.structural_damage_suspected;

  const chassis =
    Boolean(value.chassis_damage_suspected) ||
    deterministic.chassis_damage_suspected;

  const airbag =
    Boolean(value.airbag_deployment_detected) ||
    deterministic.airbag_deployment_detected;

  const flood =
    Boolean(value.flood_damage_suspected) ||
    deterministic.flood_damage_suspected;

  const fire =
    Boolean(value.fire_damage_suspected) ||
    deterministic.fire_damage_suspected;

  const engine =
    Boolean(value.engine_damage_suspected) ||
    deterministic.engine_damage_suspected;

  const suspension =
    Boolean(value.suspension_damage_suspected) ||
    deterministic.suspension_damage_suspected;

  const electrical =
    Boolean(value.electrical_damage_suspected) ||
    deterministic.electrical_damage_suspected;

  const missingEvidence = uniqueStrings([
    ...cleanStringArray(value.missing_evidence, 40),
    ...(!sourceData.damageAssessment
      ? ["Smart damage assessment is unavailable."]
      : []),
    ...(!sourceData.surveyReview
      ? ["Survey review is unavailable."]
      : []),
    ...(idv === null
      ? ["Insured Declared Value is unavailable."]
      : []),
    ...(marketValue === null
      ? ["Current market value is unavailable."]
      : []),
    ...(garageEstimate === null && aiMax === null
      ? ["A reliable repair estimate is unavailable."]
      : []),
  ]).slice(0, 40);

  const recommendation = normalizeRecommendation(
    value.recommendation
  );

  const criticalSafetyConcern =
    structural ||
    chassis ||
    airbag ||
    flood ||
    fire ||
    engine ||
    suspension;

  const manualReviewRequired =
    Boolean(value.manual_review_required) ||
    hasHighIndicator ||
    criticalSafetyConcern ||
    missingEvidence.length > 0 ||
    [
      "constructive_total_loss_review",
      "total_loss_review",
      "salvage_review",
      "high_risk_repair",
      "manual_review",
    ].includes(recommendation);

  return {
    review_status: manualReviewRequired
      ? "manual_review_required"
      : "completed",
    recommendation,
    recommendation_confidence: clampPercent(
      value.recommendation_confidence
    ),
    total_loss_score: clampPercent(value.total_loss_score),
    repairability_score: clampPercent(
      value.repairability_score
    ),
    safety_score: clampPercent(value.safety_score),
    cost_efficiency_score: clampPercent(
      value.cost_efficiency_score
    ),
    salvage_recovery_score: clampPercent(
      value.salvage_recovery_score
    ),
    vehicle_age_years:
      cleanNonNegativeNumber(value.vehicle_age_years) ??
      deterministic.vehicle_age_years,
    insured_declared_value: idv,
    estimated_market_value: marketValue,
    ai_repair_cost_min: aiMin,
    ai_repair_cost_max: aiMax,
    garage_repair_estimate: garageEstimate,
    survey_recommended_amount_min: surveyMin,
    survey_recommended_amount_max: surveyMax,
    salvage_value_min: salvageMin,
    salvage_value_max: salvageMax,
    repair_to_idv_ratio_min:
      cleanNonNegativeNumber(
        value.repair_to_idv_ratio_min
      ) ?? deterministic.repair_to_idv_ratio_min,
    repair_to_idv_ratio_max:
      cleanNonNegativeNumber(
        value.repair_to_idv_ratio_max
      ) ?? deterministic.repair_to_idv_ratio_max,
    repair_to_market_value_ratio_min:
      cleanNonNegativeNumber(
        value.repair_to_market_value_ratio_min
      ) ?? deterministic.repair_to_market_value_ratio_min,
    repair_to_market_value_ratio_max:
      cleanNonNegativeNumber(
        value.repair_to_market_value_ratio_max
      ) ?? deterministic.repair_to_market_value_ratio_max,
    structural_damage_suspected: structural,
    chassis_damage_suspected: chassis,
    airbag_deployment_detected: airbag,
    flood_damage_suspected: flood,
    fire_damage_suspected: fire,
    engine_damage_suspected: engine,
    suspension_damage_suspected: suspension,
    electrical_damage_suspected: electrical,
    oem_repair_feasible:
      typeof value.oem_repair_feasible === "boolean"
        ? value.oem_repair_feasible
        : null,
    parts_availability_status:
      normalizePartsAvailability(
        value.parts_availability_status
      ),
    roadworthiness_after_repair:
      criticalSafetyConcern
        ? "requires_physical_confirmation"
        : normalizeRoadworthiness(
            value.roadworthiness_after_repair
          ),
    recommendation_summary: cleanText(
      value.recommendation_summary
    ),
    repairability_summary: cleanText(
      value.repairability_summary
    ),
    safety_summary: cleanText(value.safety_summary),
    financial_summary: cleanText(value.financial_summary),
    salvage_summary: cleanText(value.salvage_summary),
    decision_reasons: cleanStringArray(
      value.decision_reasons,
      40
    ),
    safety_risks: cleanStringArray(
      value.safety_risks,
      40
    ),
    financial_risks: cleanStringArray(
      value.financial_risks,
      40
    ),
    missing_evidence: missingEvidence,
    clarification_questions: cleanStringArray(
      value.clarification_questions,
      40
    ),
    required_physical_checks: uniqueStrings([
      ...cleanStringArray(
        value.required_physical_checks,
        40
      ),
      ...(structural
        ? ["Structural alignment inspection"]
        : []),
      ...(chassis
        ? ["Chassis and frame measurement"]
        : []),
      ...(airbag
        ? ["Airbag and restraint-system diagnostic"]
        : []),
      ...(suspension
        ? ["Suspension, steering and wheel-geometry inspection"]
        : []),
      ...(engine
        ? ["Engine and drivetrain physical inspection"]
        : []),
      ...(flood || electrical
        ? ["Electrical and water-ingress diagnostic"]
        : []),
      ...(fire
        ? ["Fire-damage and wiring-safety inspection"]
        : []),
    ]).slice(0, 40),
    approval_conditions: cleanStringArray(
      value.approval_conditions,
      40
    ),
    manual_review_required: manualReviewRequired,
    manual_review_reasons: uniqueStrings([
      ...cleanStringArray(
        value.manual_review_reasons,
        40
      ),
      ...(hasHighIndicator
        ? ["One or more high-severity indicators require human review."]
        : []),
      ...(criticalSafetyConcern
        ? ["Safety-critical damage requires physical confirmation."]
        : []),
      ...(missingEvidence.length
        ? ["Material financial or technical evidence is incomplete."]
        : []),
    ]).slice(0, 40),
    indicators,
    report_summary: cleanText(value.report_summary),
  };
}

function normalizeIndicator(
  indicator: TotalLossIndicator
): TotalLossIndicator {
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
    severity: normalizeSeverity(indicator.severity),
    confidence: clampPercent(indicator.confidence),
    source_type: cleanText(indicator.source_type) || "claim",
    source_id: positiveInteger(indicator.source_id),
    source_reference: cleanText(
      indicator.source_reference
    ),
    observed_value: cleanText(indicator.observed_value),
    threshold_value: cleanText(indicator.threshold_value),
    ratio_value: cleanNonNegativeNumber(
      indicator.ratio_value
    ),
    supports_repair: Boolean(indicator.supports_repair),
    supports_total_loss_review: Boolean(
      indicator.supports_total_loss_review
    ),
    requires_physical_confirmation:
      Boolean(indicator.requires_physical_confirmation) ||
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

async function saveAnalysis(args: {
  adminClient: any;
  review: TotalLossReviewRow;
  model: string;
  analysis: TotalLossAnalysis;
}) {
  const {
    adminClient,
    review,
    model,
    analysis,
  } = args;

  const { error: reviewError } = await adminClient
    .from("insurance_total_loss_reviews")
    .update({
      review_status: analysis.review_status,
      recommendation: analysis.recommendation,
      recommendation_confidence:
        analysis.recommendation_confidence,
      total_loss_score: analysis.total_loss_score,
      repairability_score: analysis.repairability_score,
      safety_score: analysis.safety_score,
      cost_efficiency_score:
        analysis.cost_efficiency_score,
      salvage_recovery_score:
        analysis.salvage_recovery_score,
      vehicle_age_years: analysis.vehicle_age_years,
      insured_declared_value:
        analysis.insured_declared_value,
      estimated_market_value:
        analysis.estimated_market_value,
      ai_repair_cost_min:
        analysis.ai_repair_cost_min,
      ai_repair_cost_max:
        analysis.ai_repair_cost_max,
      garage_repair_estimate:
        analysis.garage_repair_estimate,
      survey_recommended_amount_min:
        analysis.survey_recommended_amount_min,
      survey_recommended_amount_max:
        analysis.survey_recommended_amount_max,
      salvage_value_min:
        analysis.salvage_value_min,
      salvage_value_max:
        analysis.salvage_value_max,
      repair_to_idv_ratio_min:
        analysis.repair_to_idv_ratio_min,
      repair_to_idv_ratio_max:
        analysis.repair_to_idv_ratio_max,
      repair_to_market_value_ratio_min:
        analysis.repair_to_market_value_ratio_min,
      repair_to_market_value_ratio_max:
        analysis.repair_to_market_value_ratio_max,
      structural_damage_suspected:
        analysis.structural_damage_suspected,
      chassis_damage_suspected:
        analysis.chassis_damage_suspected,
      airbag_deployment_detected:
        analysis.airbag_deployment_detected,
      flood_damage_suspected:
        analysis.flood_damage_suspected,
      fire_damage_suspected:
        analysis.fire_damage_suspected,
      engine_damage_suspected:
        analysis.engine_damage_suspected,
      suspension_damage_suspected:
        analysis.suspension_damage_suspected,
      electrical_damage_suspected:
        analysis.electrical_damage_suspected,
      oem_repair_feasible:
        analysis.oem_repair_feasible,
      parts_availability_status:
        analysis.parts_availability_status,
      roadworthiness_after_repair:
        analysis.roadworthiness_after_repair,
      recommendation_summary:
        analysis.recommendation_summary,
      repairability_summary:
        analysis.repairability_summary,
      safety_summary: analysis.safety_summary,
      financial_summary: analysis.financial_summary,
      salvage_summary: analysis.salvage_summary,
      decision_reasons: analysis.decision_reasons,
      safety_risks: analysis.safety_risks,
      financial_risks: analysis.financial_risks,
      missing_evidence: analysis.missing_evidence,
      clarification_questions:
        analysis.clarification_questions,
      required_physical_checks:
        analysis.required_physical_checks,
      approval_conditions:
        analysis.approval_conditions,
      manual_review_required:
        analysis.manual_review_required,
      manual_review_reasons:
        analysis.manual_review_reasons,
      ai_model: model,
      ai_raw_response: analysis,
      analysed_at: new Date().toISOString(),
    })
    .eq("id", review.id);

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  await adminClient
    .from("insurance_total_loss_indicators")
    .delete()
    .eq("total_loss_review_id", review.id);

  if (analysis.indicators.length) {
    const rows = analysis.indicators.map((indicator) => ({
      user_id: review.user_id,
      total_loss_review_id: review.id,
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
      observed_value:
        indicator.observed_value || null,
      threshold_value:
        indicator.threshold_value || null,
      ratio_value: indicator.ratio_value,
      supports_repair: indicator.supports_repair,
      supports_total_loss_review:
        indicator.supports_total_loss_review,
      requires_physical_confirmation:
        indicator.requires_physical_confirmation,
      metadata: indicator.metadata,
    }));

    const { error } = await adminClient
      .from("insurance_total_loss_indicators")
      .insert(rows);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: latestReport } = await adminClient
    .from("insurance_total_loss_reports")
    .select("report_version")
    .eq("total_loss_review_id", review.id)
    .order("report_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion =
    Number(latestReport?.report_version ?? 0) + 1;

  const { error: reportError } = await adminClient
    .from("insurance_total_loss_reports")
    .insert({
      user_id: review.user_id,
      total_loss_review_id: review.id,
      report_version: nextVersion,
      report_status:
        analysis.manual_review_required
          ? "draft"
          : "generated",
      report_title:
        "AI-Assisted Total Loss Review",
      report_summary: analysis.report_summary,
      report_json: {
        total_loss_reference:
          review.total_loss_reference,
        source_ids: {
          claim_id: review.claim_id,
          policy_id: review.policy_id,
          vehicle_id: review.vehicle_id,
          damage_assessment_id:
            review.damage_assessment_id,
          survey_review_id:
            review.survey_review_id,
          fraud_review_id:
            review.fraud_review_id,
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
      totalLossModel: string;
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
    totalLossModel:
      process.env.OPENAI_TOTAL_LOSS_MODEL ||
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

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, 8000)
    : "";
}

function cleanMoney(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[₹,\s]/g, ""))
        : NaN;

  return Number.isFinite(numeric) && numeric >= 0
    ? numeric
    : null;
}

function cleanNonNegativeNumber(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric >= 0
    ? numeric
    : null;
}

function cleanStringArray(
  value: unknown,
  limit: number
) {
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

function normalizeRange<T extends number | null>(
  minimum: T,
  maximum: T
): [T, T] {
  if (
    minimum !== null &&
    maximum !== null &&
    minimum > maximum
  ) {
    return [maximum as T, minimum as T];
  }

  return [minimum, maximum];
}

function firstNonNull(
  ...values: Array<number | null>
) {
  return values.find((value) => value !== null) ?? null;
}

function ratio(
  numerator: number | null,
  denominator: number | null
) {
  if (
    numerator === null ||
    denominator === null ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function includesAny(
  text: string,
  terms: string[]
) {
  return terms.some((term) => text.includes(term));
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

function normalizeRecommendation(
  value: unknown
): TotalLossAnalysis["recommendation"] {
  if (
    value === "economical_repair" ||
    value === "repair_with_conditions" ||
    value === "reinspection_required" ||
    value === "constructive_total_loss_review" ||
    value === "total_loss_review" ||
    value === "salvage_review" ||
    value === "high_risk_repair" ||
    value === "manual_review"
  ) {
    return value;
  }

  return "manual_review";
}

function normalizePartsAvailability(
  value: unknown
): TotalLossAnalysis["parts_availability_status"] {
  if (
    value === "available" ||
    value === "limited" ||
    value === "backordered" ||
    value === "unavailable" ||
    value === "requires_verification"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeRoadworthiness(
  value: unknown
): TotalLossAnalysis["roadworthiness_after_repair"] {
  if (
    value === "likely" ||
    value === "possible_with_conditions" ||
    value === "uncertain" ||
    value === "unlikely" ||
    value === "requires_physical_confirmation"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeSeverity(
  value: unknown
): TotalLossIndicator["severity"] {
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

function nullableNumberSchema() {
  return {
    anyOf: [
      { type: "number", minimum: 0 },
      { type: "null" },
    ],
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

function stringArraySchema(maxItems: number) {
  return {
    type: "array",
    maxItems,
    items: { type: "string" },
  } as const;
}