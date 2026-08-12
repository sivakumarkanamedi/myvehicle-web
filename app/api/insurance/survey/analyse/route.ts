import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type AnalyseSurveyBody = {
  claim_id?: number;
  survey_review_id?: number;
  damage_assessment_id?: number | null;
  repair_job_id?: number | null;
  garage_id?: number | null;
};

type SurveyReviewRow = {
  id: number;
  user_id: string;
  claim_id: number;
  policy_id: number | null;
  vehicle_id: number;
  damage_assessment_id: number | null;
  repair_job_id: number | null;
  garage_id: number | null;
  survey_reference: string | null;
  review_status: string;
};

type SurveyFinding = {
  finding_code: string;
  finding_type: string;
  finding_severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  related_vehicle_part: string;
  related_document_type: string;
  related_estimate_item: string;
  expected_value: number | null;
  observed_value: number | null;
  variance_amount: number | null;
  variance_percent: number | null;
  confidence: number;
  requires_clarification: boolean;
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

type SurveyAnalysis = {
  review_status: "completed" | "manual_review_required";

  recommendation:
    | "approve"
    | "approve_with_conditions"
    | "clarification_required"
    | "manual_review"
    | "reject_recommended";

  recommendation_confidence: number;
  coverage_match_confidence: number;
  estimate_reasonableness_confidence: number;
  evidence_consistency_confidence: number;

  policy_coverage_summary: string;
  damage_consistency_summary: string;
  estimate_comparison_summary: string;
  replaced_parts_summary: string;
  surveyor_summary: string;

  ai_estimated_cost_min: number | null;
  ai_estimated_cost_max: number | null;
  garage_estimated_cost: number | null;
  insurer_approved_amount: number | null;
  customer_payable_amount: number | null;

  inflation_risk_level: "unknown" | "low" | "medium" | "high";
  inflation_risk_reasons: string[];

  coverage_exclusions_detected: string[];
  uncovered_items: string[];
  missing_evidence: string[];
  clarification_questions: string[];
  approval_conditions: string[];
  rejection_risk_reasons: string[];

  recommended_approved_amount_min: number | null;
  recommended_approved_amount_max: number | null;

  manual_review_required: boolean;
  manual_review_reasons: string[];

  checklist_decisions: ChecklistDecision[];
  findings: SurveyFinding[];

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

const SURVEY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "review_status",
    "recommendation",
    "recommendation_confidence",
    "coverage_match_confidence",
    "estimate_reasonableness_confidence",
    "evidence_consistency_confidence",
    "policy_coverage_summary",
    "damage_consistency_summary",
    "estimate_comparison_summary",
    "replaced_parts_summary",
    "surveyor_summary",
    "ai_estimated_cost_min",
    "ai_estimated_cost_max",
    "garage_estimated_cost",
    "insurer_approved_amount",
    "customer_payable_amount",
    "inflation_risk_level",
    "inflation_risk_reasons",
    "coverage_exclusions_detected",
    "uncovered_items",
    "missing_evidence",
    "clarification_questions",
    "approval_conditions",
    "rejection_risk_reasons",
    "recommended_approved_amount_min",
    "recommended_approved_amount_max",
    "manual_review_required",
    "manual_review_reasons",
    "checklist_decisions",
    "findings",
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
        "approve",
        "approve_with_conditions",
        "clarification_required",
        "manual_review",
        "reject_recommended",
      ],
    },
    recommendation_confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    coverage_match_confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    estimate_reasonableness_confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    evidence_consistency_confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    policy_coverage_summary: { type: "string" },
    damage_consistency_summary: { type: "string" },
    estimate_comparison_summary: { type: "string" },
    replaced_parts_summary: { type: "string" },
    surveyor_summary: { type: "string" },
    ai_estimated_cost_min: nullableNumberSchema(),
    ai_estimated_cost_max: nullableNumberSchema(),
    garage_estimated_cost: nullableNumberSchema(),
    insurer_approved_amount: nullableNumberSchema(),
    customer_payable_amount: nullableNumberSchema(),
    inflation_risk_level: {
      type: "string",
      enum: ["unknown", "low", "medium", "high"],
    },
    inflation_risk_reasons: stringArraySchema(30),
    coverage_exclusions_detected: stringArraySchema(30),
    uncovered_items: stringArraySchema(30),
    missing_evidence: stringArraySchema(30),
    clarification_questions: stringArraySchema(30),
    approval_conditions: stringArraySchema(30),
    rejection_risk_reasons: stringArraySchema(30),
    recommended_approved_amount_min: nullableNumberSchema(),
    recommended_approved_amount_max: nullableNumberSchema(),
    manual_review_required: { type: "boolean" },
    manual_review_reasons: stringArraySchema(30),
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
    findings: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "finding_code",
          "finding_type",
          "finding_severity",
          "title",
          "description",
          "related_vehicle_part",
          "related_document_type",
          "related_estimate_item",
          "expected_value",
          "observed_value",
          "variance_amount",
          "variance_percent",
          "confidence",
          "requires_clarification",
          "metadata",
        ],
        properties: {
          finding_code: { type: "string" },
          finding_type: { type: "string" },
          finding_severity: {
            type: "string",
            enum: ["info", "low", "medium", "high", "critical"],
          },
          title: { type: "string" },
          description: { type: "string" },
          related_vehicle_part: { type: "string" },
          related_document_type: { type: "string" },
          related_estimate_item: { type: "string" },
          expected_value: nullableNumberSchema(),
          observed_value: nullableNumberSchema(),
          variance_amount: nullableSignedNumberSchema(),
          variance_percent: nullableSignedNumberSchema(),
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          requires_clarification: { type: "boolean" },
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
        { error: "You must be signed in to analyse a survey review." },
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

    const body = (await request.json()) as AnalyseSurveyBody;

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

    const reviewResult = await getOrCreateSurveyReview(
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
      .from("insurance_survey_reviews")
      .update({ review_status: "analysing" })
      .eq("id", review.id);

    const sourceData = await loadSurveySourceData(
      adminClient as any,
      review
    );

    if (!sourceData.claim) {
      throw new Error("The linked insurance claim was not found.");
    }

    if (!sourceData.vehicle) {
      throw new Error("The linked vehicle was not found.");
    }

    const analysis = await analyseWithOpenAI({
      apiKey: environment.openAiApiKey,
      model: environment.surveyModel,
      review,
      sourceData,
    });

    const normalized = normalizeAnalysis(analysis, sourceData);

    await saveSurveyAnalysis({
      adminClient: adminClient as any,
      review,
      model: environment.surveyModel,
      analysis: normalized,
      sourceData,
    });

    return NextResponse.json({
      success: true,
      survey_review_id: review.id,
      survey_reference: review.survey_reference,
      review_status: normalized.review_status,
      recommendation: normalized.recommendation,
      recommendation_confidence:
        normalized.recommendation_confidence,
      manual_review_required:
        normalized.manual_review_required,
      analysis: normalized,
    });
  } catch (error) {
    console.error("AI Surveyor Assistant error:", error);

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
          .from("insurance_survey_reviews")
          .update({ review_status: "failed" })
          .eq("id", reviewId);
      }
    } catch (cleanupError) {
      console.error("Survey review cleanup failed:", cleanupError);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mira could not complete the survey analysis.",
      },
      { status: 500 }
    );
  }
}

async function getOrCreateSurveyReview(
  adminClient: any,
  userId: string,
  body: AnalyseSurveyBody
): Promise<
  | { review: SurveyReviewRow }
  | { error: string; status: number }
> {
  const requestedReviewId = positiveInteger(body.survey_review_id);

  if (requestedReviewId) {
    const { data, error } = await adminClient
      .from("insurance_survey_reviews")
      .select("*")
      .eq("id", requestedReviewId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message, status: 500 };
    }

    if (!data) {
      return { error: "Survey review was not found.", status: 404 };
    }

    if (data.user_id !== userId) {
      return {
        error: "You are not allowed to access this survey review.",
        status: 403,
      };
    }

    return { review: data as SurveyReviewRow };
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
    .from("insurance_survey_reviews")
    .insert({
      user_id: userId,
      claim_id: claimId,
      policy_id: positiveInteger(claim.policy_id),
      vehicle_id: positiveInteger(claim.vehicle_id),
      damage_assessment_id: damageAssessmentId,
      repair_job_id: repairJobId,
      garage_id: garageId,
      review_status: "draft",
      recommendation: "manual_review",
      manual_review_required: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      error: error?.message || "Unable to create survey review.",
      status: 500,
    };
  }

  return { review: data as SurveyReviewRow };
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

async function loadSurveySourceData(
  adminClient: any,
  review: SurveyReviewRow
) {
  const [
    claimResult,
    policyResult,
    vehicleResult,
    damageResult,
    damageFindingsResult,
    repairResult,
    checklistResult,
    claimDocumentsResult,
    claimTimelineResult,
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
      .from("insurance_survey_checklist")
      .select("*")
      .eq("survey_review_id", review.id)
      .order("created_at", { ascending: true }),

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
  ]);

  const error = [
    claimResult.error,
    policyResult.error,
    vehicleResult.error,
    damageResult.error,
    damageFindingsResult.error,
    repairResult.error,
    checklistResult.error,
    claimDocumentsResult.error,
    claimTimelineResult.error,
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
    repairJob: repairResult.data,
    checklist: checklistResult.data ?? [],
    claimDocuments: claimDocumentsResult.data ?? [],
    claimTimeline: claimTimelineResult.data ?? [],
  };
}

async function analyseWithOpenAI(args: {
  apiKey: string;
  model: string;
  review: SurveyReviewRow;
  sourceData: Awaited<ReturnType<typeof loadSurveySourceData>>;
}) {
  const prompt = buildSurveyPrompt(args.review, args.sourceData);

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
      max_output_tokens: 7000,
      text: {
        format: {
          type: "json_schema",
          name: "insurance_survey_analysis",
          strict: true,
          schema: SURVEY_SCHEMA,
        },
      },
    }),
  });

  const result = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        "The AI service could not complete the survey review."
    );
  }

  const outputText = extractOutputText(result);

  if (!outputText) {
    throw new Error("The AI service returned an empty survey review.");
  }

  try {
    return JSON.parse(outputText) as SurveyAnalysis;
  } catch {
    throw new Error("The AI service returned invalid survey JSON.");
  }
}

function buildSurveyPrompt(
  review: SurveyReviewRow,
  sourceData: Awaited<ReturnType<typeof loadSurveySourceData>>
) {
  const compactData = {
    survey_review: review,
    claim: sanitizeForPrompt(sourceData.claim),
    policy: sanitizeForPrompt(sourceData.policy),
    vehicle: sanitizeForPrompt(sourceData.vehicle),
    smart_damage_assessment: sanitizeForPrompt(
      sourceData.damageAssessment
    ),
    smart_damage_findings: sanitizeForPrompt(
      sourceData.damageFindings
    ),
    garage_repair_job: sanitizeForPrompt(sourceData.repairJob),
    survey_checklist: sanitizeForPrompt(sourceData.checklist),
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
  };

  return `
You are Mira AI acting as a cautious motor-insurance survey assistant
for India. You prepare a draft review for a licensed human surveyor or
authorized insurer. You do not make a binding claim decision.

Review the supplied policy, claim, AI visual-damage assessment, detected
parts, garage estimate, documents, checklist and timeline.

Core rules:

1. Never state that a claim is definitely approved, rejected, fraudulent,
   covered, excluded, roadworthy or a total loss.
2. Never invent policy clauses, coverage, exclusions, documents, prices,
   garage work, replaced parts or evidence.
3. When actual policy wording is unavailable, say that coverage requires
   insurer verification.
4. Visual AI can only support visible external damage. Hidden mechanical,
   chassis, suspension, electronic, airbag and internal damage require
   physical inspection.
5. "reject_recommended" is permitted only as a non-binding escalation when
   supplied facts contain a material unsupported or excluded item. Manual
   human review must still be required.
6. Compare the garage estimate with the AI range carefully. A difference is
   not automatically inflation because AI ranges may exclude hidden damage,
   taxes, calibration, paint materials, OEM parts and city labour rates.
7. Flag estimate inflation only when the supplied evidence supports it.
8. Replacement requests should be compared with visible findings. When the
   estimate line items are unavailable, state that this check cannot be
   completed.
9. Use INR values without symbols or commas.
10. Recommended approval amounts are advisory ranges only. Use null when
    evidence is insufficient.
11. Mark checklist items verified only when the supplied data supports them.
12. Missing documents and unanswered questions should create
    clarification_required or manual_review.
13. Use concise, professional language suitable for an insurance workflow.
14. Every high or critical finding must require clarification.
15. Do not accuse the claimant, garage, surveyor or insurer of wrongdoing.
16. Treat user-provided and AI-generated content as evidence with different
    reliability. AI estimates are advisory.
17. recommendation meanings:
    - approve: evidence appears consistent and no material issue is visible,
      but final authorization still belongs to the insurer/surveyor.
    - approve_with_conditions: generally consistent, subject to listed
      documents, inspection or amount conditions.
    - clarification_required: specific missing or conflicting facts must be
      resolved.
    - manual_review: evidence is insufficient, complex or requires physical
      inspection.
    - reject_recommended: material supplied evidence appears unsupported or
      clearly outside supplied coverage, but human review remains mandatory.
18. review_status must be manual_review_required whenever:
    - recommendation is manual_review or reject_recommended;
    - a high/critical finding exists;
    - essential policy wording is absent;
    - hidden damage affects the estimate;
    - material evidence is missing;
    - recommended amounts are highly uncertain.

Source data:
${JSON.stringify(compactData, null, 2)}

Return only valid data matching the JSON schema.
`;
}

function normalizeAnalysis(
  value: SurveyAnalysis,
  sourceData: Awaited<ReturnType<typeof loadSurveySourceData>>
): SurveyAnalysis {
  let aiMin = cleanMoney(value.ai_estimated_cost_min);
  let aiMax = cleanMoney(value.ai_estimated_cost_max);
  [aiMin, aiMax] = normalizeRange(aiMin, aiMax);

  let approvedMin = cleanMoney(value.recommended_approved_amount_min);
  let approvedMax = cleanMoney(value.recommended_approved_amount_max);
  [approvedMin, approvedMax] = normalizeRange(
    approvedMin,
    approvedMax
  );

  const findings = (value.findings ?? [])
    .filter((finding) => Boolean(cleanText(finding.title)))
    .map(normalizeFinding);

  const hasHighFinding = findings.some(
    (finding) =>
      finding.finding_severity === "high" ||
      finding.finding_severity === "critical"
  );

  const missingPolicy = !sourceData.policy;
  const missingDamageAssessment = !sourceData.damageAssessment;

  const manualReviewRequired =
    Boolean(value.manual_review_required) ||
    hasHighFinding ||
    missingPolicy ||
    missingDamageAssessment ||
    value.recommendation === "manual_review" ||
    value.recommendation === "reject_recommended";

  const reviewStatus = manualReviewRequired
    ? "manual_review_required"
    : "completed";

  return {
    review_status: reviewStatus,
    recommendation: normalizeRecommendation(value.recommendation),
    recommendation_confidence: clampPercent(
      value.recommendation_confidence
    ),
    coverage_match_confidence: clampPercent(
      value.coverage_match_confidence
    ),
    estimate_reasonableness_confidence: clampPercent(
      value.estimate_reasonableness_confidence
    ),
    evidence_consistency_confidence: clampPercent(
      value.evidence_consistency_confidence
    ),
    policy_coverage_summary: cleanText(value.policy_coverage_summary),
    damage_consistency_summary: cleanText(
      value.damage_consistency_summary
    ),
    estimate_comparison_summary: cleanText(
      value.estimate_comparison_summary
    ),
    replaced_parts_summary: cleanText(value.replaced_parts_summary),
    surveyor_summary: cleanText(value.surveyor_summary),
    ai_estimated_cost_min: aiMin,
    ai_estimated_cost_max: aiMax,
    garage_estimated_cost:
      cleanMoney(value.garage_estimated_cost) ??
      cleanMoney(sourceData.repairJob?.estimated_cost),
    insurer_approved_amount:
      cleanMoney(value.insurer_approved_amount) ??
      cleanMoney(sourceData.repairJob?.insurer_approved_amount),
    customer_payable_amount:
      cleanMoney(value.customer_payable_amount) ??
      cleanMoney(sourceData.repairJob?.customer_payable_amount),
    inflation_risk_level: normalizeInflationRisk(
      value.inflation_risk_level
    ),
    inflation_risk_reasons: cleanStringArray(
      value.inflation_risk_reasons,
      30
    ),
    coverage_exclusions_detected: cleanStringArray(
      value.coverage_exclusions_detected,
      30
    ),
    uncovered_items: cleanStringArray(value.uncovered_items, 30),
    missing_evidence: uniqueStrings([
      ...cleanStringArray(value.missing_evidence, 30),
      ...(missingPolicy ? ["Policy details are unavailable."] : []),
      ...(missingDamageAssessment
        ? ["Smart damage assessment is unavailable."]
        : []),
    ]).slice(0, 30),
    clarification_questions: cleanStringArray(
      value.clarification_questions,
      30
    ),
    approval_conditions: cleanStringArray(
      value.approval_conditions,
      30
    ),
    rejection_risk_reasons: cleanStringArray(
      value.rejection_risk_reasons,
      30
    ),
    recommended_approved_amount_min: approvedMin,
    recommended_approved_amount_max: approvedMax,
    manual_review_required: manualReviewRequired,
    manual_review_reasons: uniqueStrings([
      ...cleanStringArray(value.manual_review_reasons, 30),
      ...(hasHighFinding
        ? ["One or more high-severity findings require human review."]
        : []),
      ...(missingPolicy
        ? ["Policy coverage could not be verified from available data."]
        : []),
      ...(missingDamageAssessment
        ? ["Visible damage assessment is missing."]
        : []),
    ]).slice(0, 30),
    checklist_decisions: (value.checklist_decisions ?? [])
      .map(normalizeChecklistDecision)
      .slice(0, 30),
    findings,
    report_summary: cleanText(value.report_summary),
  };
}

function normalizeFinding(finding: SurveyFinding): SurveyFinding {
  const expected = cleanSignedMoney(finding.expected_value);
  const observed = cleanSignedMoney(finding.observed_value);

  const varianceAmount =
    cleanSignedMoney(finding.variance_amount) ??
    (expected !== null && observed !== null
      ? observed - expected
      : null);

  const variancePercent =
    cleanSignedMoney(finding.variance_percent) ??
    (expected !== null && observed !== null && expected !== 0
      ? ((observed - expected) / expected) * 100
      : null);

  return {
    finding_code:
      slugify(finding.finding_code) ||
      `finding_${crypto.randomUUID()}`,
    finding_type: cleanText(finding.finding_type) || "general",
    finding_severity: normalizeFindingSeverity(
      finding.finding_severity
    ),
    title: cleanText(finding.title),
    description: cleanText(finding.description),
    related_vehicle_part: cleanText(finding.related_vehicle_part),
    related_document_type: cleanText(
      finding.related_document_type
    ),
    related_estimate_item: cleanText(finding.related_estimate_item),
    expected_value: expected,
    observed_value: observed,
    variance_amount: varianceAmount,
    variance_percent:
      variancePercent === null
        ? null
        : clampNumber(variancePercent, -10000, 10000),
    confidence: clampPercent(finding.confidence),
    requires_clarification: Boolean(
      finding.requires_clarification ||
        finding.finding_severity === "high" ||
        finding.finding_severity === "critical"
    ),
    metadata:
      typeof finding.metadata === "object" &&
      finding.metadata !== null &&
      !Array.isArray(finding.metadata)
        ? finding.metadata
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

async function saveSurveyAnalysis(args: {
  adminClient: any;
  review: SurveyReviewRow;
  model: string;
  analysis: SurveyAnalysis;
  sourceData: Awaited<ReturnType<typeof loadSurveySourceData>>;
}) {
  const {
    adminClient,
    review,
    model,
    analysis,
    sourceData,
  } = args;

  const { error: reviewError } = await adminClient
    .from("insurance_survey_reviews")
    .update({
      review_status: analysis.review_status,
      recommendation: analysis.recommendation,
      recommendation_confidence:
        analysis.recommendation_confidence,
      coverage_match_confidence:
        analysis.coverage_match_confidence,
      estimate_reasonableness_confidence:
        analysis.estimate_reasonableness_confidence,
      evidence_consistency_confidence:
        analysis.evidence_consistency_confidence,
      policy_coverage_summary:
        analysis.policy_coverage_summary,
      damage_consistency_summary:
        analysis.damage_consistency_summary,
      estimate_comparison_summary:
        analysis.estimate_comparison_summary,
      replaced_parts_summary:
        analysis.replaced_parts_summary,
      surveyor_summary: analysis.surveyor_summary,
      ai_estimated_cost_min:
        analysis.ai_estimated_cost_min,
      ai_estimated_cost_max:
        analysis.ai_estimated_cost_max,
      garage_estimated_cost:
        analysis.garage_estimated_cost,
      insurer_approved_amount:
        analysis.insurer_approved_amount,
      customer_payable_amount:
        analysis.customer_payable_amount,
      inflation_risk_level:
        analysis.inflation_risk_level,
      inflation_risk_reasons:
        analysis.inflation_risk_reasons,
      coverage_exclusions_detected:
        analysis.coverage_exclusions_detected,
      uncovered_items: analysis.uncovered_items,
      missing_evidence: analysis.missing_evidence,
      clarification_questions:
        analysis.clarification_questions,
      approval_conditions:
        analysis.approval_conditions,
      rejection_risk_reasons:
        analysis.rejection_risk_reasons,
      recommended_approved_amount_min:
        analysis.recommended_approved_amount_min,
      recommended_approved_amount_max:
        analysis.recommended_approved_amount_max,
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
    .from("insurance_survey_findings")
    .delete()
    .eq("survey_review_id", review.id);

  if (analysis.findings.length) {
    const findingRows = analysis.findings.map((finding) => ({
      user_id: review.user_id,
      survey_review_id: review.id,
      finding_type: finding.finding_type,
      finding_severity: finding.finding_severity,
      title: finding.title,
      description: finding.description,
      related_vehicle_part:
        finding.related_vehicle_part || null,
      related_document_type:
        finding.related_document_type || null,
      related_estimate_item:
        finding.related_estimate_item || null,
      expected_value: finding.expected_value,
      observed_value: finding.observed_value,
      variance_amount: finding.variance_amount,
      variance_percent: finding.variance_percent,
      confidence: finding.confidence,
      requires_clarification:
        finding.requires_clarification,
      metadata: {
        finding_code: finding.finding_code,
        ...finding.metadata,
      },
    }));

    const { error } = await adminClient
      .from("insurance_survey_findings")
      .insert(findingRows);

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const decision of analysis.checklist_decisions) {
    if (!decision.item_key) continue;

    const { error } = await adminClient
      .from("insurance_survey_checklist")
      .update({
        finding_status: decision.finding_status,
        finding_notes: decision.finding_notes || null,
        is_completed: decision.is_completed,
        completed_at: decision.is_completed
          ? new Date().toISOString()
          : null,
      })
      .eq("survey_review_id", review.id)
      .eq("item_key", decision.item_key);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: currentReport } = await adminClient
    .from("insurance_survey_reports")
    .select("report_version")
    .eq("survey_review_id", review.id)
    .order("report_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reportVersion =
    Number(currentReport?.report_version ?? 0) + 1;

  const { error: reportError } = await adminClient
    .from("insurance_survey_reports")
    .insert({
      user_id: review.user_id,
      survey_review_id: review.id,
      report_version: reportVersion,
      report_status:
        analysis.manual_review_required
          ? "draft"
          : "generated",
      report_title: "AI-Assisted Survey Review",
      report_summary: analysis.report_summary,
      report_json: {
        survey_reference: review.survey_reference,
        source_ids: {
          claim_id: review.claim_id,
          policy_id: review.policy_id,
          vehicle_id: review.vehicle_id,
          damage_assessment_id:
            review.damage_assessment_id,
          repair_job_id: review.repair_job_id,
          garage_id: review.garage_id,
        },
        analysis,
      },
    });

  if (reportError) {
    throw new Error(reportError.message);
  }

  if (
    sourceData.claim &&
    analysis.recommended_approved_amount_max !== null
  ) {
    await adminClient
      .from("insurance_claims")
      .update({
        claim_stage: "surveyor_inspection",
      })
      .eq("id", review.claim_id);
  }
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
      openAiApiKey: string;
      surveyModel: string;
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
    surveyModel:
      process.env.OPENAI_SURVEY_MODEL ||
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

function cleanSignedMoney(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[₹,\s]/g, ""))
        : NaN;

  return Number.isFinite(numeric) ? numeric : null;
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
): SurveyAnalysis["recommendation"] {
  if (
    value === "approve" ||
    value === "approve_with_conditions" ||
    value === "clarification_required" ||
    value === "manual_review" ||
    value === "reject_recommended"
  ) {
    return value;
  }

  return "manual_review";
}

function normalizeInflationRisk(
  value: unknown
): SurveyAnalysis["inflation_risk_level"] {
  if (
    value === "low" ||
    value === "medium" ||
    value === "high"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeFindingSeverity(
  value: unknown
): SurveyFinding["finding_severity"] {
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

function stringArraySchema(maxItems: number) {
  return {
    type: "array",
    maxItems,
    items: { type: "string" },
  } as const;
}