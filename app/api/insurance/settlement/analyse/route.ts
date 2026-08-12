import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type AnalyseSettlementBody = {
  claim_id?: number;
  settlement_review_id?: number;
  damage_assessment_id?: number | null;
  survey_review_id?: number | null;
  fraud_review_id?: number | null;
  total_loss_review_id?: number | null;
  repair_job_id?: number | null;
  garage_id?: number | null;
};

type SettlementReviewRow = {
  id: number;
  user_id: string;
  claim_id: number;
  policy_id: number | null;
  vehicle_id: number;
  damage_assessment_id: number | null;
  survey_review_id: number | null;
  fraud_review_id: number | null;
  total_loss_review_id: number | null;
  repair_job_id: number | null;
  garage_id: number | null;
  settlement_reference: string | null;
  review_status: string;
};

type SettlementLineItem = {
  item_code: string;
  item_category: string;
  item_name: string;
  item_description: string;

  source_type: string;
  source_id: number | null;
  source_reference: string;

  claimed_amount: number | null;
  assessed_amount: number | null;
  approved_amount: number | null;

  depreciation_percent: number | null;
  depreciation_amount: number | null;
  deductible_amount: number | null;
  betterment_amount: number | null;
  salvage_adjustment: number | null;
  non_payable_amount: number | null;
  customer_payable_amount: number | null;

  coverage_status:
    | "covered"
    | "partially_covered"
    | "not_covered"
    | "requires_verification"
    | "not_applicable";

  approval_status:
    | "pending"
    | "approved"
    | "partially_approved"
    | "not_approved"
    | "clarification_required"
    | "manual_review";

  decision_reason: string;
  policy_clause_reference: string;

  confidence: number;
  requires_manual_check: boolean;
  metadata: Record<string, unknown>;
};

type SettlementIndicator = {
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
  expected_value: string;
  variance_amount: number | null;
  variance_percent: number | null;

  supports_approval: boolean;
  supports_deduction: boolean;
  requires_manual_check: boolean;

  metadata: Record<string, unknown>;
};

type ChecklistDecision = {
  item_key: string;
  finding_status:
    | "pending"
    | "verified"
    | "not_available"
    | "mismatch"
    | "clarification_required"
    | "not_applicable";
  finding_notes: string;
  is_completed: boolean;
};

type SettlementAnalysis = {
  review_status: "completed" | "manual_review_required";

  recommendation:
    | "full_approval"
    | "partial_approval"
    | "approve_with_conditions"
    | "clarification_required"
    | "manual_review"
    | "settlement_not_recommended";

  settlement_mode:
    | "undetermined"
    | "cashless"
    | "reimbursement"
    | "total_loss"
    | "constructive_total_loss"
    | "repair_payment"
    | "salvage_adjusted"
    | "mixed";

  recommendation_confidence: number;
  policy_coverage_confidence: number;
  calculation_confidence: number;
  evidence_consistency_confidence: number;
  payment_readiness_score: number;

  gross_assessed_amount: number | null;
  approved_parts_amount: number | null;
  approved_labour_amount: number | null;
  approved_paint_material_amount: number | null;
  approved_consumables_amount: number | null;
  approved_towing_amount: number | null;
  approved_other_amount: number | null;

  depreciation_deduction: number | null;
  compulsory_deductible: number | null;
  voluntary_deductible: number | null;
  betterment_deduction: number | null;
  salvage_deduction: number | null;
  non_payable_amount: number | null;
  uncovered_amount: number | null;
  previous_payment_adjustment: number | null;

  recommended_settlement_amount_min: number | null;
  recommended_settlement_amount_max: number | null;

  recommended_insurer_payable: number | null;
  recommended_customer_payable: number | null;

  settlement_summary: string;
  coverage_summary: string;
  deduction_summary: string;
  payment_summary: string;
  negotiation_summary: string;

  payable_items: string[];
  non_payable_items: string[];
  uncovered_items: string[];
  deductions_applied: string[];
  calculation_assumptions: string[];
  missing_evidence: string[];
  clarification_questions: string[];
  approval_conditions: string[];
  recommended_checks: string[];
  negotiation_suggestions: string[];

  manual_review_required: boolean;
  manual_review_reasons: string[];

  line_items: SettlementLineItem[];
  indicators: SettlementIndicator[];
  checklist_decisions: ChecklistDecision[];

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

const SETTLEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "review_status",
    "recommendation",
    "settlement_mode",
    "recommendation_confidence",
    "policy_coverage_confidence",
    "calculation_confidence",
    "evidence_consistency_confidence",
    "payment_readiness_score",
    "gross_assessed_amount",
    "approved_parts_amount",
    "approved_labour_amount",
    "approved_paint_material_amount",
    "approved_consumables_amount",
    "approved_towing_amount",
    "approved_other_amount",
    "depreciation_deduction",
    "compulsory_deductible",
    "voluntary_deductible",
    "betterment_deduction",
    "salvage_deduction",
    "non_payable_amount",
    "uncovered_amount",
    "previous_payment_adjustment",
    "recommended_settlement_amount_min",
    "recommended_settlement_amount_max",
    "recommended_insurer_payable",
    "recommended_customer_payable",
    "settlement_summary",
    "coverage_summary",
    "deduction_summary",
    "payment_summary",
    "negotiation_summary",
    "payable_items",
    "non_payable_items",
    "uncovered_items",
    "deductions_applied",
    "calculation_assumptions",
    "missing_evidence",
    "clarification_questions",
    "approval_conditions",
    "recommended_checks",
    "negotiation_suggestions",
    "manual_review_required",
    "manual_review_reasons",
    "line_items",
    "indicators",
    "checklist_decisions",
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
        "full_approval",
        "partial_approval",
        "approve_with_conditions",
        "clarification_required",
        "manual_review",
        "settlement_not_recommended",
      ],
    },
    settlement_mode: {
      type: "string",
      enum: [
        "undetermined",
        "cashless",
        "reimbursement",
        "total_loss",
        "constructive_total_loss",
        "repair_payment",
        "salvage_adjusted",
        "mixed",
      ],
    },
    recommendation_confidence: percentSchema(),
    policy_coverage_confidence: percentSchema(),
    calculation_confidence: percentSchema(),
    evidence_consistency_confidence: percentSchema(),
    payment_readiness_score: percentSchema(),

    gross_assessed_amount: nullableNumberSchema(),
    approved_parts_amount: nullableNumberSchema(),
    approved_labour_amount: nullableNumberSchema(),
    approved_paint_material_amount: nullableNumberSchema(),
    approved_consumables_amount: nullableNumberSchema(),
    approved_towing_amount: nullableNumberSchema(),
    approved_other_amount: nullableNumberSchema(),

    depreciation_deduction: nullableNumberSchema(),
    compulsory_deductible: nullableNumberSchema(),
    voluntary_deductible: nullableNumberSchema(),
    betterment_deduction: nullableNumberSchema(),
    salvage_deduction: nullableNumberSchema(),
    non_payable_amount: nullableNumberSchema(),
    uncovered_amount: nullableNumberSchema(),
    previous_payment_adjustment: nullableSignedNumberSchema(),

    recommended_settlement_amount_min: nullableNumberSchema(),
    recommended_settlement_amount_max: nullableNumberSchema(),
    recommended_insurer_payable: nullableNumberSchema(),
    recommended_customer_payable: nullableNumberSchema(),

    settlement_summary: { type: "string" },
    coverage_summary: { type: "string" },
    deduction_summary: { type: "string" },
    payment_summary: { type: "string" },
    negotiation_summary: { type: "string" },

    payable_items: stringArraySchema(50),
    non_payable_items: stringArraySchema(50),
    uncovered_items: stringArraySchema(50),
    deductions_applied: stringArraySchema(50),
    calculation_assumptions: stringArraySchema(50),
    missing_evidence: stringArraySchema(50),
    clarification_questions: stringArraySchema(50),
    approval_conditions: stringArraySchema(50),
    recommended_checks: stringArraySchema(50),
    negotiation_suggestions: stringArraySchema(50),

    manual_review_required: { type: "boolean" },
    manual_review_reasons: stringArraySchema(50),

    line_items: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "item_code",
          "item_category",
          "item_name",
          "item_description",
          "source_type",
          "source_id",
          "source_reference",
          "claimed_amount",
          "assessed_amount",
          "approved_amount",
          "depreciation_percent",
          "depreciation_amount",
          "deductible_amount",
          "betterment_amount",
          "salvage_adjustment",
          "non_payable_amount",
          "customer_payable_amount",
          "coverage_status",
          "approval_status",
          "decision_reason",
          "policy_clause_reference",
          "confidence",
          "requires_manual_check",
          "metadata",
        ],
        properties: {
          item_code: { type: "string" },
          item_category: { type: "string" },
          item_name: { type: "string" },
          item_description: { type: "string" },
          source_type: { type: "string" },
          source_id: nullableIntegerSchema(),
          source_reference: { type: "string" },
          claimed_amount: nullableNumberSchema(),
          assessed_amount: nullableNumberSchema(),
          approved_amount: nullableNumberSchema(),
          depreciation_percent: nullableNumberSchema(),
          depreciation_amount: nullableNumberSchema(),
          deductible_amount: nullableNumberSchema(),
          betterment_amount: nullableNumberSchema(),
          salvage_adjustment: nullableSignedNumberSchema(),
          non_payable_amount: nullableNumberSchema(),
          customer_payable_amount: nullableNumberSchema(),
          coverage_status: {
            type: "string",
            enum: [
              "covered",
              "partially_covered",
              "not_covered",
              "requires_verification",
              "not_applicable",
            ],
          },
          approval_status: {
            type: "string",
            enum: [
              "pending",
              "approved",
              "partially_approved",
              "not_approved",
              "clarification_required",
              "manual_review",
            ],
          },
          decision_reason: { type: "string" },
          policy_clause_reference: { type: "string" },
          confidence: percentSchema(),
          requires_manual_check: { type: "boolean" },
          metadata: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },

    indicators: {
      type: "array",
      maxItems: 100,
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
          "expected_value",
          "variance_amount",
          "variance_percent",
          "supports_approval",
          "supports_deduction",
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
          observed_value: { type: "string" },
          expected_value: { type: "string" },
          variance_amount: nullableSignedNumberSchema(),
          variance_percent: nullableSignedNumberSchema(),
          supports_approval: { type: "boolean" },
          supports_deduction: { type: "boolean" },
          requires_manual_check: { type: "boolean" },
          metadata: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },

    checklist_decisions: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "item_key",
          "finding_status",
          "finding_notes",
          "is_completed",
        ],
        properties: {
          item_key: { type: "string" },
          finding_status: {
            type: "string",
            enum: [
              "pending",
              "verified",
              "not_available",
              "mismatch",
              "clarification_required",
              "not_applicable",
            ],
          },
          finding_notes: { type: "string" },
          is_completed: { type: "boolean" },
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
        { error: "You must be signed in to analyse a settlement." },
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

    const body = (await request.json()) as AnalyseSettlementBody;

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

    const reviewResult = await getOrCreateSettlementReview(
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
      .from("insurance_settlement_reviews")
      .update({ review_status: "analysing" })
      .eq("id", review.id);

    const sourceData = await loadSettlementSourceData(
      adminClient as any,
      review
    );

    if (!sourceData.claim) {
      throw new Error("The linked insurance claim was not found.");
    }

    if (!sourceData.vehicle) {
      throw new Error("The linked vehicle was not found.");
    }

    const deterministic = buildDeterministicSettlementInputs(
      sourceData
    );

    const aiAnalysis = await analyseWithOpenAI({
      apiKey: environment.openAiApiKey,
      model: environment.settlementModel,
      review,
      sourceData,
      deterministic,
    });

    const normalized = normalizeAnalysis(
      aiAnalysis,
      sourceData,
      deterministic
    );

    await saveSettlementAnalysis({
      adminClient: adminClient as any,
      review,
      model: environment.settlementModel,
      analysis: normalized,
    });

    return NextResponse.json({
      success: true,
      settlement_review_id: review.id,
      settlement_reference: review.settlement_reference,
      review_status: normalized.review_status,
      recommendation: normalized.recommendation,
      settlement_mode: normalized.settlement_mode,
      recommendation_confidence:
        normalized.recommendation_confidence,
      recommended_insurer_payable:
        normalized.recommended_insurer_payable,
      recommended_customer_payable:
        normalized.recommended_customer_payable,
      manual_review_required:
        normalized.manual_review_required,
      analysis: normalized,
    });
  } catch (error) {
    console.error("AI Settlement Engine error:", error);

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
          .from("insurance_settlement_reviews")
          .update({ review_status: "failed" })
          .eq("id", reviewId);
      }
    } catch (cleanupError) {
      console.error("Settlement cleanup failed:", cleanupError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mira could not complete the settlement review.",
      },
      { status: 500 }
    );
  }
}

async function getOrCreateSettlementReview(
  adminClient: any,
  userId: string,
  body: AnalyseSettlementBody
): Promise<
  | { review: SettlementReviewRow }
  | { error: string; status: number }
> {
  const requestedReviewId = positiveInteger(
    body.settlement_review_id
  );

  if (requestedReviewId) {
    const { data, error } = await adminClient
      .from("insurance_settlement_reviews")
      .select("*")
      .eq("id", requestedReviewId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message, status: 500 };
    }

    if (!data) {
      return {
        error: "Settlement review was not found.",
        status: 404,
      };
    }

    if (data.user_id !== userId) {
      return {
        error: "You are not allowed to access this settlement review.",
        status: 403,
      };
    }

    return { review: data as SettlementReviewRow };
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

  const totalLossReviewId =
    positiveInteger(body.total_loss_review_id) ??
    (await findLatestId(
      adminClient,
      "insurance_total_loss_reviews",
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
    .from("insurance_settlement_reviews")
    .insert({
      user_id: userId,
      claim_id: claimId,
      policy_id: positiveInteger(claim.policy_id),
      vehicle_id: positiveInteger(claim.vehicle_id),
      damage_assessment_id: damageAssessmentId,
      survey_review_id: surveyReviewId,
      fraud_review_id: fraudReviewId,
      total_loss_review_id: totalLossReviewId,
      repair_job_id: repairJobId,
      garage_id: garageId,
      review_status: "draft",
      recommendation: "manual_review",
      settlement_mode: "undetermined",
      manual_review_required: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      error:
        error?.message || "Unable to create settlement review.",
      status: 500,
    };
  }

  return { review: data as SettlementReviewRow };
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

async function loadSettlementSourceData(
  adminClient: any,
  review: SettlementReviewRow
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
    totalLossResult,
    totalLossIndicatorsResult,
    repairResult,
    claimDocumentsResult,
    timelineResult,
    checklistResult,
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

    review.total_loss_review_id
      ? adminClient
          .from("insurance_total_loss_reviews")
          .select("*")
          .eq("id", review.total_loss_review_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    review.total_loss_review_id
      ? adminClient
          .from("insurance_total_loss_indicators")
          .select("*")
          .eq(
            "total_loss_review_id",
            review.total_loss_review_id
          )
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
      .from("insurance_settlement_checklist")
      .select("*")
      .eq("settlement_review_id", review.id)
      .order("created_at", { ascending: true }),
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
    totalLossResult.error,
    totalLossIndicatorsResult.error,
    repairResult.error,
    claimDocumentsResult.error,
    timelineResult.error,
    checklistResult.error,
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
    totalLossReview: totalLossResult.data,
    totalLossIndicators: totalLossIndicatorsResult.data ?? [],
    repairJob: repairResult.data,
    claimDocuments: claimDocumentsResult.data ?? [],
    claimTimeline: timelineResult.data ?? [],
    checklist: checklistResult.data ?? [],
  };
}

function buildDeterministicSettlementInputs(
  sourceData: Awaited<ReturnType<typeof loadSettlementSourceData>>
) {
  const grossEstimate = firstNonNull(
    cleanMoney(sourceData.repairJob?.estimated_cost),
    cleanMoney(sourceData.claim?.estimated_repair_cost),
    cleanMoney(
      sourceData.surveyReview?.recommended_approved_amount_max
    ),
    cleanMoney(
      sourceData.damageAssessment?.estimated_repair_cost_max
    )
  );

  const insurerApproved = firstNonNull(
    cleanMoney(sourceData.repairJob?.insurer_approved_amount),
    cleanMoney(sourceData.claim?.approved_claim_amount),
    cleanMoney(
      sourceData.surveyReview?.recommended_approved_amount_max
    )
  );

  const customerPayable = firstNonNull(
    cleanMoney(sourceData.repairJob?.customer_payable_amount),
    null
  );

  const policyActive = isPolicyActive(
    sourceData.policy?.start_date,
    sourceData.policy?.expiry_date,
    sourceData.claim?.incident_date
  );

  const totalLossRecommendation = String(
    sourceData.totalLossReview?.recommendation ?? ""
  );

  const settlementMode =
    totalLossRecommendation === "total_loss_review"
      ? "total_loss"
      : totalLossRecommendation ===
          "constructive_total_loss_review"
        ? "constructive_total_loss"
        : sourceData.repairJob?.cashless_garages?.is_cashless
          ? "cashless"
          : "reimbursement";

  const mandatoryDocuments = [
    "rc",
    "driving_licence",
    "insurance_policy",
  ];

  const availableDocumentTokens = sourceData.claimDocuments.map(
    (document: any) =>
      String(
        document.document_type ??
          document.ai_classification ??
          document.document_name ??
          ""
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
  );

  const missingMandatoryDocuments = mandatoryDocuments.filter(
    (required) =>
      !availableDocumentTokens.some((actual: string) =>
        actual.includes(required)
      )
  );

  const fraudHighRisk = ["high", "critical"].includes(
    String(sourceData.fraudReview?.risk_level ?? "")
  );

  const surveyManualReview = Boolean(
    sourceData.surveyReview?.manual_review_required
  );

  const totalLossManualReview = Boolean(
    sourceData.totalLossReview?.manual_review_required
  );

  return {
    gross_estimate: grossEstimate,
    current_insurer_approved_amount: insurerApproved,
    current_customer_payable: customerPayable,
    policy_active_on_incident_date: policyActive,
    recommended_settlement_mode: settlementMode,
    missing_mandatory_documents: missingMandatoryDocuments,
    fraud_high_risk: fraudHighRisk,
    survey_manual_review_required: surveyManualReview,
    total_loss_manual_review_required: totalLossManualReview,
  };
}

async function analyseWithOpenAI(args: {
  apiKey: string;
  model: string;
  review: SettlementReviewRow;
  sourceData: Awaited<ReturnType<typeof loadSettlementSourceData>>;
  deterministic: ReturnType<
    typeof buildDeterministicSettlementInputs
  >;
}) {
  const prompt = buildSettlementPrompt(
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
      max_output_tokens: 9000,
      text: {
        format: {
          type: "json_schema",
          name: "insurance_settlement_analysis",
          strict: true,
          schema: SETTLEMENT_SCHEMA,
        },
      },
    }),
  });

  const result = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        "The AI service could not complete settlement analysis."
    );
  }

  const outputText = extractOutputText(result);

  if (!outputText) {
    throw new Error(
      "The AI service returned an empty settlement review."
    );
  }

  try {
    return JSON.parse(outputText) as SettlementAnalysis;
  } catch {
    throw new Error(
      "The AI service returned invalid settlement JSON."
    );
  }
}

function buildSettlementPrompt(
  review: SettlementReviewRow,
  sourceData: Awaited<ReturnType<typeof loadSettlementSourceData>>,
  deterministic: ReturnType<
    typeof buildDeterministicSettlementInputs
  >
) {
  const compactData = {
    settlement_review: review,
    deterministic_inputs: deterministic,
    claim: sanitizeForPrompt(sourceData.claim),
    policy: sanitizeForPrompt(sourceData.policy),
    vehicle: sanitizeForPrompt(sourceData.vehicle),
    damage_assessment: sanitizeForPrompt(
      sourceData.damageAssessment
    ),
    damage_findings: sanitizeForPrompt(
      sourceData.damageFindings
    ),
    survey_review: sanitizeForPrompt(sourceData.surveyReview),
    survey_findings: sanitizeForPrompt(
      sourceData.surveyFindings
    ),
    claim_risk_review: sanitizeForPrompt(
      sourceData.fraudReview
    ),
    claim_risk_indicators: sanitizeForPrompt(
      sourceData.fraudIndicators
    ),
    total_loss_review: sanitizeForPrompt(
      sourceData.totalLossReview
    ),
    total_loss_indicators: sanitizeForPrompt(
      sourceData.totalLossIndicators
    ),
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
      sourceData.claimTimeline
    ),
    settlement_checklist: sanitizeForPrompt(
      sourceData.checklist
    ),
  };

  return `
You are Mira AI preparing a cautious motor-insurance claim settlement
recommendation for India.

This is advisory decision support only. Final authorization, settlement,
deductions and payment must be completed by an authorized insurer.

Rules:

1. Never invent policy clauses, depreciation tables, deductibles, excess,
   betterment percentages, salvage values or covered items.
2. If policy wording or an exact deductible is unavailable, keep the amount
   null and require manual verification.
3. Use only supplied financial values and evidence.
4. Do not automatically reject a claim because of fraud-risk indicators.
   High-risk indicators require authorized investigation.
5. Total-loss review recommendations are not final total-loss decisions.
6. Do not mark an item covered unless the supplied policy or review supports
   it. Use "requires_verification" when policy wording is absent.
7. Separate insurer-payable and customer-payable amounts.
8. Every deduction must have a clear reason and source.
9. Gross assessed amount should represent the assessed repair or settlement
   base before deductions.
10. Recommended insurer payable should broadly equal:
    approved payable items minus applicable deductions and adjustments.
11. Recommended customer payable should include uncovered, non-payable,
    deductible and other supported customer amounts.
12. Use null instead of zero when an amount is unknown.
13. Settlement modes:
    - cashless
    - reimbursement
    - total_loss
    - constructive_total_loss
    - repair_payment
    - salvage_adjusted
    - mixed
    - undetermined
14. Recommendations:
    - full_approval
    - partial_approval
    - approve_with_conditions
    - clarification_required
    - manual_review
    - settlement_not_recommended
15. "settlement_not_recommended" is advisory and requires human review.
16. review_status must be manual_review_required when:
    - recommendation is manual_review or settlement_not_recommended;
    - essential policy wording is missing;
    - exact deductibles or depreciation are unknown;
    - fraud risk is high/critical;
    - total-loss review is unresolved;
    - high/critical indicator exists;
    - mandatory documents are missing.
17. Never state that payment is guaranteed.
18. Use professional, neutral and concise language.
19. Return only data matching the JSON schema.

Source data:
${JSON.stringify(compactData, null, 2)}
`;
}

function normalizeAnalysis(
  value: SettlementAnalysis,
  sourceData: Awaited<ReturnType<typeof loadSettlementSourceData>>,
  deterministic: ReturnType<
    typeof buildDeterministicSettlementInputs
  >
): SettlementAnalysis {
  const lineItems = (value.line_items ?? [])
    .filter((item) => Boolean(cleanText(item.item_name)))
    .map(normalizeLineItem);

  const indicators = (value.indicators ?? [])
    .filter((item) => Boolean(cleanText(item.indicator_title)))
    .map(normalizeIndicator);

  const hasHighIndicator = indicators.some(
    (indicator) =>
      indicator.severity === "high" ||
      indicator.severity === "critical"
  );

  let settlementMin = cleanMoney(
    value.recommended_settlement_amount_min
  );
  let settlementMax = cleanMoney(
    value.recommended_settlement_amount_max
  );
  [settlementMin, settlementMax] = normalizeRange(
    settlementMin,
    settlementMax
  );

  const missingEvidence = uniqueStrings([
    ...cleanStringArray(value.missing_evidence, 50),
    ...deterministic.missing_mandatory_documents.map(
      (item) => `Missing mandatory document: ${item}`
    ),
    ...(!sourceData.policy
      ? ["Policy details are unavailable."]
      : []),
    ...(!sourceData.surveyReview
      ? ["Survey review is unavailable."]
      : []),
    ...(!sourceData.totalLossReview
      ? ["Total-loss review is unavailable."]
      : []),
  ]).slice(0, 50);

  const recommendation = normalizeRecommendation(
    value.recommendation
  );

  const manualReviewRequired =
    Boolean(value.manual_review_required) ||
    hasHighIndicator ||
    missingEvidence.length > 0 ||
    deterministic.fraud_high_risk ||
    deterministic.survey_manual_review_required ||
    deterministic.total_loss_manual_review_required ||
    recommendation === "manual_review" ||
    recommendation === "settlement_not_recommended";

  const grossAssessed =
    cleanMoney(value.gross_assessed_amount) ??
    deterministic.gross_estimate;

  const approvedParts = cleanMoney(
    value.approved_parts_amount
  );
  const approvedLabour = cleanMoney(
    value.approved_labour_amount
  );
  const approvedPaint = cleanMoney(
    value.approved_paint_material_amount
  );
  const approvedConsumables = cleanMoney(
    value.approved_consumables_amount
  );
  const approvedTowing = cleanMoney(
    value.approved_towing_amount
  );
  const approvedOther = cleanMoney(
    value.approved_other_amount
  );

  const depreciation = cleanMoney(
    value.depreciation_deduction
  );
  const compulsoryDeductible = cleanMoney(
    value.compulsory_deductible
  );
  const voluntaryDeductible = cleanMoney(
    value.voluntary_deductible
  );
  const betterment = cleanMoney(
    value.betterment_deduction
  );
  const salvage = cleanMoney(
    value.salvage_deduction
  );
  const nonPayable = cleanMoney(
    value.non_payable_amount
  );
  const uncovered = cleanMoney(
    value.uncovered_amount
  );
  const previousAdjustment = cleanSignedNumber(
    value.previous_payment_adjustment
  );

  const recommendedInsurerPayable =
    cleanMoney(value.recommended_insurer_payable) ??
    deriveInsurerPayable({
      approvedParts,
      approvedLabour,
      approvedPaint,
      approvedConsumables,
      approvedTowing,
      approvedOther,
      depreciation,
      compulsoryDeductible,
      voluntaryDeductible,
      betterment,
      salvage,
      nonPayable,
      uncovered,
      previousAdjustment,
    });

  const recommendedCustomerPayable =
    cleanMoney(value.recommended_customer_payable) ??
    deriveCustomerPayable({
      compulsoryDeductible,
      voluntaryDeductible,
      betterment,
      nonPayable,
      uncovered,
    });

  return {
    review_status: manualReviewRequired
      ? "manual_review_required"
      : "completed",
    recommendation,
    settlement_mode: normalizeSettlementMode(
      value.settlement_mode ||
        deterministic.recommended_settlement_mode
    ),
    recommendation_confidence: clampPercent(
      value.recommendation_confidence
    ),
    policy_coverage_confidence: clampPercent(
      value.policy_coverage_confidence
    ),
    calculation_confidence: clampPercent(
      value.calculation_confidence
    ),
    evidence_consistency_confidence: clampPercent(
      value.evidence_consistency_confidence
    ),
    payment_readiness_score: clampPercent(
      value.payment_readiness_score
    ),

    gross_assessed_amount: grossAssessed,
    approved_parts_amount: approvedParts,
    approved_labour_amount: approvedLabour,
    approved_paint_material_amount: approvedPaint,
    approved_consumables_amount: approvedConsumables,
    approved_towing_amount: approvedTowing,
    approved_other_amount: approvedOther,

    depreciation_deduction: depreciation,
    compulsory_deductible: compulsoryDeductible,
    voluntary_deductible: voluntaryDeductible,
    betterment_deduction: betterment,
    salvage_deduction: salvage,
    non_payable_amount: nonPayable,
    uncovered_amount: uncovered,
    previous_payment_adjustment: previousAdjustment,

    recommended_settlement_amount_min: settlementMin,
    recommended_settlement_amount_max: settlementMax,

    recommended_insurer_payable: recommendedInsurerPayable,
    recommended_customer_payable:
      recommendedCustomerPayable,

    settlement_summary: cleanText(value.settlement_summary),
    coverage_summary: cleanText(value.coverage_summary),
    deduction_summary: cleanText(value.deduction_summary),
    payment_summary: cleanText(value.payment_summary),
    negotiation_summary: cleanText(value.negotiation_summary),

    payable_items: cleanStringArray(value.payable_items, 50),
    non_payable_items: cleanStringArray(
      value.non_payable_items,
      50
    ),
    uncovered_items: cleanStringArray(
      value.uncovered_items,
      50
    ),
    deductions_applied: cleanStringArray(
      value.deductions_applied,
      50
    ),
    calculation_assumptions: cleanStringArray(
      value.calculation_assumptions,
      50
    ),
    missing_evidence: missingEvidence,
    clarification_questions: cleanStringArray(
      value.clarification_questions,
      50
    ),
    approval_conditions: cleanStringArray(
      value.approval_conditions,
      50
    ),
    recommended_checks: cleanStringArray(
      value.recommended_checks,
      50
    ),
    negotiation_suggestions: cleanStringArray(
      value.negotiation_suggestions,
      50
    ),

    manual_review_required: manualReviewRequired,
    manual_review_reasons: uniqueStrings([
      ...cleanStringArray(
        value.manual_review_reasons,
        50
      ),
      ...(hasHighIndicator
        ? ["High-severity settlement indicators require human review."]
        : []),
      ...(deterministic.fraud_high_risk
        ? ["Claim-risk review requires authorized investigation."]
        : []),
      ...(missingEvidence.length
        ? ["Material evidence is incomplete."]
        : []),
    ]).slice(0, 50),

    line_items: lineItems,
    indicators,
    checklist_decisions: (value.checklist_decisions ?? [])
      .map(normalizeChecklistDecision)
      .slice(0, 30),

    report_summary: cleanText(value.report_summary),
  };
}

function normalizeLineItem(
  item: SettlementLineItem
): SettlementLineItem {
  return {
    item_code:
      slugify(item.item_code) ||
      `item_${crypto.randomUUID()}`,
    item_category:
      slugify(item.item_category) || "general",
    item_name: cleanText(item.item_name),
    item_description: cleanText(item.item_description),

    source_type: cleanText(item.source_type) || "claim",
    source_id: positiveInteger(item.source_id),
    source_reference: cleanText(item.source_reference),

    claimed_amount: cleanMoney(item.claimed_amount),
    assessed_amount: cleanMoney(item.assessed_amount),
    approved_amount: cleanMoney(item.approved_amount),

    depreciation_percent: cleanNonNegativeNumber(
      item.depreciation_percent
    ),
    depreciation_amount: cleanMoney(
      item.depreciation_amount
    ),
    deductible_amount: cleanMoney(item.deductible_amount),
    betterment_amount: cleanMoney(item.betterment_amount),
    salvage_adjustment: cleanSignedNumber(
      item.salvage_adjustment
    ),
    non_payable_amount: cleanMoney(
      item.non_payable_amount
    ),
    customer_payable_amount: cleanMoney(
      item.customer_payable_amount
    ),

    coverage_status: normalizeCoverageStatus(
      item.coverage_status
    ),
    approval_status: normalizeApprovalStatus(
      item.approval_status
    ),

    decision_reason: cleanText(item.decision_reason),
    policy_clause_reference: cleanText(
      item.policy_clause_reference
    ),

    confidence: clampPercent(item.confidence),
    requires_manual_check: Boolean(
      item.requires_manual_check
    ),
    metadata:
      typeof item.metadata === "object" &&
      item.metadata !== null &&
      !Array.isArray(item.metadata)
        ? item.metadata
        : {},
  };
}

function normalizeIndicator(
  indicator: SettlementIndicator
): SettlementIndicator {
  return {
    indicator_code:
      slugify(indicator.indicator_code) ||
      `indicator_${crypto.randomUUID()}`,
    indicator_category:
      slugify(indicator.indicator_category) || "general",
    indicator_title: cleanText(
      indicator.indicator_title
    ),
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
    expected_value: cleanText(indicator.expected_value),
    variance_amount: cleanSignedNumber(
      indicator.variance_amount
    ),
    variance_percent: cleanSignedNumber(
      indicator.variance_percent
    ),
    supports_approval: Boolean(
      indicator.supports_approval
    ),
    supports_deduction: Boolean(
      indicator.supports_deduction
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

function normalizeChecklistDecision(
  decision: ChecklistDecision
): ChecklistDecision {
  return {
    item_key: slugify(decision.item_key),
    finding_status: normalizeChecklistStatus(
      decision.finding_status
    ),
    finding_notes: cleanText(decision.finding_notes),
    is_completed: Boolean(decision.is_completed),
  };
}

async function saveSettlementAnalysis(args: {
  adminClient: any;
  review: SettlementReviewRow;
  model: string;
  analysis: SettlementAnalysis;
}) {
  const {
    adminClient,
    review,
    model,
    analysis,
  } = args;

  const { error: reviewError } = await adminClient
    .from("insurance_settlement_reviews")
    .update({
      review_status: analysis.review_status,
      recommendation: analysis.recommendation,
      settlement_mode: analysis.settlement_mode,
      recommendation_confidence:
        analysis.recommendation_confidence,
      policy_coverage_confidence:
        analysis.policy_coverage_confidence,
      calculation_confidence:
        analysis.calculation_confidence,
      evidence_consistency_confidence:
        analysis.evidence_consistency_confidence,
      payment_readiness_score:
        analysis.payment_readiness_score,

      gross_assessed_amount:
        analysis.gross_assessed_amount,
      approved_parts_amount:
        analysis.approved_parts_amount,
      approved_labour_amount:
        analysis.approved_labour_amount,
      approved_paint_material_amount:
        analysis.approved_paint_material_amount,
      approved_consumables_amount:
        analysis.approved_consumables_amount,
      approved_towing_amount:
        analysis.approved_towing_amount,
      approved_other_amount:
        analysis.approved_other_amount,

      depreciation_deduction:
        analysis.depreciation_deduction,
      compulsory_deductible:
        analysis.compulsory_deductible,
      voluntary_deductible:
        analysis.voluntary_deductible,
      betterment_deduction:
        analysis.betterment_deduction,
      salvage_deduction:
        analysis.salvage_deduction,
      non_payable_amount:
        analysis.non_payable_amount,
      uncovered_amount:
        analysis.uncovered_amount,
      previous_payment_adjustment:
        analysis.previous_payment_adjustment,

      recommended_settlement_amount_min:
        analysis.recommended_settlement_amount_min,
      recommended_settlement_amount_max:
        analysis.recommended_settlement_amount_max,
      recommended_insurer_payable:
        analysis.recommended_insurer_payable,
      recommended_customer_payable:
        analysis.recommended_customer_payable,

      settlement_summary: analysis.settlement_summary,
      coverage_summary: analysis.coverage_summary,
      deduction_summary: analysis.deduction_summary,
      payment_summary: analysis.payment_summary,
      negotiation_summary: analysis.negotiation_summary,

      payable_items: analysis.payable_items,
      non_payable_items: analysis.non_payable_items,
      uncovered_items: analysis.uncovered_items,
      deductions_applied: analysis.deductions_applied,
      calculation_assumptions:
        analysis.calculation_assumptions,
      missing_evidence: analysis.missing_evidence,
      clarification_questions:
        analysis.clarification_questions,
      approval_conditions:
        analysis.approval_conditions,
      recommended_checks:
        analysis.recommended_checks,
      negotiation_suggestions:
        analysis.negotiation_suggestions,

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
    .from("insurance_settlement_line_items")
    .delete()
    .eq("settlement_review_id", review.id);

  if (analysis.line_items.length) {
    const rows = analysis.line_items.map((item) => ({
      user_id: review.user_id,
      settlement_review_id: review.id,
      item_code: item.item_code,
      item_category: item.item_category,
      item_name: item.item_name,
      item_description: item.item_description || null,
      source_type: item.source_type,
      source_id: item.source_id,
      source_reference: item.source_reference || null,
      claimed_amount: item.claimed_amount,
      assessed_amount: item.assessed_amount,
      approved_amount: item.approved_amount,
      depreciation_percent: item.depreciation_percent,
      depreciation_amount: item.depreciation_amount,
      deductible_amount: item.deductible_amount,
      betterment_amount: item.betterment_amount,
      salvage_adjustment: item.salvage_adjustment,
      non_payable_amount: item.non_payable_amount,
      customer_payable_amount:
        item.customer_payable_amount,
      coverage_status: item.coverage_status,
      approval_status: item.approval_status,
      decision_reason: item.decision_reason,
      policy_clause_reference:
        item.policy_clause_reference || null,
      confidence: item.confidence,
      requires_manual_check:
        item.requires_manual_check,
      metadata: item.metadata,
    }));

    const { error } = await adminClient
      .from("insurance_settlement_line_items")
      .insert(rows);

    if (error) {
      throw new Error(error.message);
    }
  }

  await adminClient
    .from("insurance_settlement_indicators")
    .delete()
    .eq("settlement_review_id", review.id);

  if (analysis.indicators.length) {
    const rows = analysis.indicators.map((indicator) => ({
      user_id: review.user_id,
      settlement_review_id: review.id,
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
      expected_value:
        indicator.expected_value || null,
      variance_amount: indicator.variance_amount,
      variance_percent: indicator.variance_percent,
      supports_approval: indicator.supports_approval,
      supports_deduction: indicator.supports_deduction,
      requires_manual_check:
        indicator.requires_manual_check,
      metadata: indicator.metadata,
    }));

    const { error } = await adminClient
      .from("insurance_settlement_indicators")
      .insert(rows);

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const decision of analysis.checklist_decisions) {
    if (!decision.item_key) continue;

    const { error } = await adminClient
      .from("insurance_settlement_checklist")
      .update({
        finding_status: decision.finding_status,
        finding_notes: decision.finding_notes || null,
        is_completed: decision.is_completed,
        completed_at: decision.is_completed
          ? new Date().toISOString()
          : null,
      })
      .eq("settlement_review_id", review.id)
      .eq("item_key", decision.item_key);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: latestReport } = await adminClient
    .from("insurance_settlement_reports")
    .select("report_version")
    .eq("settlement_review_id", review.id)
    .order("report_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion =
    Number(latestReport?.report_version ?? 0) + 1;

  const { error: reportError } = await adminClient
    .from("insurance_settlement_reports")
    .insert({
      user_id: review.user_id,
      settlement_review_id: review.id,
      report_version: nextVersion,
      report_status:
        analysis.manual_review_required
          ? "draft"
          : "generated",
      report_title:
        "AI-Assisted Claim Settlement Recommendation",
      report_summary: analysis.report_summary,
      report_json: {
        settlement_reference:
          review.settlement_reference,
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
          total_loss_review_id:
            review.total_loss_review_id,
          repair_job_id: review.repair_job_id,
          garage_id: review.garage_id,
        },
        analysis,
      },
    });

  if (reportError) {
    throw new Error(reportError.message);
  }

  await adminClient
    .from("insurance_claims")
    .update({
      claim_stage: "settlement",
      settlement_amount:
        analysis.recommended_insurer_payable,
      expected_settlement_date:
        analysis.manual_review_required
          ? null
          : new Date(
              Date.now() + 3 * 86400000
            )
              .toISOString()
              .slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.claim_id);
}

function deriveInsurerPayable(args: {
  approvedParts: number | null;
  approvedLabour: number | null;
  approvedPaint: number | null;
  approvedConsumables: number | null;
  approvedTowing: number | null;
  approvedOther: number | null;
  depreciation: number | null;
  compulsoryDeductible: number | null;
  voluntaryDeductible: number | null;
  betterment: number | null;
  salvage: number | null;
  nonPayable: number | null;
  uncovered: number | null;
  previousAdjustment: number | null;
}) {
  const approved =
    sumNullable([
      args.approvedParts,
      args.approvedLabour,
      args.approvedPaint,
      args.approvedConsumables,
      args.approvedTowing,
      args.approvedOther,
    ]) ?? null;

  if (approved === null) return null;

  const deductions =
    sumNullable([
      args.depreciation,
      args.compulsoryDeductible,
      args.voluntaryDeductible,
      args.betterment,
      args.salvage,
      args.nonPayable,
      args.uncovered,
    ]) ?? 0;

  return Math.max(
    0,
    approved - deductions + (args.previousAdjustment ?? 0)
  );
}

function deriveCustomerPayable(args: {
  compulsoryDeductible: number | null;
  voluntaryDeductible: number | null;
  betterment: number | null;
  nonPayable: number | null;
  uncovered: number | null;
}) {
  return sumNullable([
    args.compulsoryDeductible,
    args.voluntaryDeductible,
    args.betterment,
    args.nonPayable,
    args.uncovered,
  ]);
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
      openAiApiKey: string;
      settlementModel: string;
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
    settlementModel:
      process.env.OPENAI_SETTLEMENT_MODEL ||
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

function cleanSignedNumber(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
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

function sumNullable(values: Array<number | null>) {
  const present = values.filter(
    (value): value is number => value !== null
  );

  if (!present.length) return null;

  return present.reduce((sum, value) => sum + value, 0);
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

function isPolicyActive(
  startValue: unknown,
  expiryValue: unknown,
  incidentValue: unknown
) {
  const start = parseDate(startValue);
  const expiry = parseDate(expiryValue);
  const incident = parseDate(incidentValue);

  if (!start || !expiry || !incident) {
    return null;
  }

  return (
    incident.getTime() >= start.getTime() &&
    incident.getTime() <= expiry.getTime()
  );
}

function parseDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRecommendation(
  value: unknown
): SettlementAnalysis["recommendation"] {
  if (
    value === "full_approval" ||
    value === "partial_approval" ||
    value === "approve_with_conditions" ||
    value === "clarification_required" ||
    value === "manual_review" ||
    value === "settlement_not_recommended"
  ) {
    return value;
  }

  return "manual_review";
}

function normalizeSettlementMode(
  value: unknown
): SettlementAnalysis["settlement_mode"] {
  if (
    value === "cashless" ||
    value === "reimbursement" ||
    value === "total_loss" ||
    value === "constructive_total_loss" ||
    value === "repair_payment" ||
    value === "salvage_adjusted" ||
    value === "mixed"
  ) {
    return value;
  }

  return "undetermined";
}

function normalizeCoverageStatus(
  value: unknown
): SettlementLineItem["coverage_status"] {
  if (
    value === "covered" ||
    value === "partially_covered" ||
    value === "not_covered" ||
    value === "not_applicable"
  ) {
    return value;
  }

  return "requires_verification";
}

function normalizeApprovalStatus(
  value: unknown
): SettlementLineItem["approval_status"] {
  if (
    value === "approved" ||
    value === "partially_approved" ||
    value === "not_approved" ||
    value === "clarification_required" ||
    value === "manual_review"
  ) {
    return value;
  }

  return "pending";
}

function normalizeSeverity(
  value: unknown
): SettlementIndicator["severity"] {
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

function normalizeChecklistStatus(
  value: unknown
): ChecklistDecision["finding_status"] {
  if (
    value === "verified" ||
    value === "not_available" ||
    value === "mismatch" ||
    value === "clarification_required" ||
    value === "not_applicable"
  ) {
    return value;
  }

  return "pending";
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

function nullableSignedNumberSchema() {
  return {
    anyOf: [
      { type: "number" },
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