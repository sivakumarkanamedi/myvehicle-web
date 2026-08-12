import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type AssessUnderwritingBody = {
  proposal_id?: number | null;
  quote_id?: number | null;
  policy_id?: number | null;
  vehicle_id?: number | null;

  applicant_name?: string | null;
  applicant_type?: string | null;

  requested_policy_type?: string | null;
  requested_idv?: number | null;
  requested_total_premium?: number | null;

  annual_usage_km?: number | null;
  ownership_age_months?: number | null;

  documents_complete?: boolean;
  kyc_status?: string | null;
  rc_validation_status?: string | null;
  licence_validation_status?: string | null;

  geographic_risk_score?: number | null;
  vehicle_risk_score?: number | null;
  driver_risk_score?: number | null;
  payment_risk_score?: number | null;

  previous_policy_number?: string | null;
  previous_insurer_name?: string | null;
  previous_policy_expiry_date?: string | null;

  force_inspection?: boolean;
  metadata?: Record<string, unknown>;
};

type VehicleRow = {
  id: number;
  user_id: string;
  registration_number?: string | null;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  fuel_type?: string | null;
  vehicle_type?: string | null;
  usage_type?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  vin?: string | null;
};

type ClaimRow = {
  id: number;
  claim_status?: string | null;
  claim_stage?: string | null;
  fraud_status?: string | null;
  fraud_risk_score?: number | null;
  incident_date?: string | null;
  approved_claim_amount?: number | null;
  settlement_amount?: number | null;
  created_at?: string | null;
};

type UnderwritingRule = {
  id: number;
  rule_code: string;
  rule_name: string;
  rule_description: string | null;
  rule_category: string;
  rule_status: string;
  priority: number;
  condition_expression: Record<string, unknown>;
  action_expression: Record<string, unknown>;
  risk_score_adjustment: number;
  premium_loading_percent: number;
  premium_discount_percent: number;
  referral_required: boolean;
  inspection_required: boolean;
  decline_required: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

type RuleResult = {
  rule_id: number;
  rule_code: string;
  rule_name: string;
  matched: boolean;
  result_status: string;
  risk_score_adjustment: number;
  premium_loading_percent: number;
  premium_discount_percent: number;
  referral_required: boolean;
  inspection_required: boolean;
  decline_required: boolean;
  result_explanation: string;
  result_payload: Record<string, unknown>;
};

type RiskFactor = {
  factor_code: string;
  factor_name: string;
  factor_category: string;
  observed_value: string;
  numeric_value: number | null;
  risk_weight: number;
  risk_score: number;
  risk_level: string;
  source_type: string;
  source_reference: string | null;
  explanation: string;
  recommended_action: string | null;
  metadata: Record<string, unknown>;
};

type Assessment = {
  geographic_risk_score: number;
  vehicle_risk_score: number;
  driver_risk_score: number;
  claims_risk_score: number;
  fraud_risk_score: number;
  payment_risk_score: number;

  overall_risk_score: number;
  overall_risk_band: string;

  vehicle_age_years: number | null;
  claim_count: number;
  settled_claim_count: number;
  rejected_claim_count: number;
  fraud_alert_count: number;

  inspection_required: boolean;
  referral_required: boolean;
  decline_required: boolean;

  recommended_idv: number | null;
  recommended_base_premium: number;
  recommended_total_premium: number;
  recommended_ncb_percent: number;
  recommended_deductible: number;

  premium_loading_percent: number;
  premium_discount_percent: number;

  ai_summary: string;
  ai_risk_reasons: string[];
  ai_recommendations: string[];
  ai_confidence: number;

  risk_factors: RiskFactor[];
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
        { error: "You must be signed in to assess underwriting." },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

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

    const body = (await request.json()) as AssessUnderwritingBody;

    const vehicleId = positiveInteger(body.vehicle_id);
    const proposalId = positiveInteger(body.proposal_id);
    const quoteId = positiveInteger(body.quote_id);
    const policyId = positiveInteger(body.policy_id);

    if (!vehicleId && !proposalId && !quoteId && !policyId) {
      return NextResponse.json(
        {
          error:
            "Provide at least one of vehicle_id, proposal_id, quote_id or policy_id.",
        },
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

    const proposal = proposalId
      ? await loadOwnedRecord(
          adminClient as any,
          "insurance_policy_proposals",
          proposalId,
          user.id
        )
      : null;

    const quote = quoteId
      ? await loadOwnedRecord(
          adminClient as any,
          "insurance_quotes",
          quoteId,
          user.id
        )
      : null;

    const policy = policyId
      ? await loadOwnedRecord(
          adminClient as any,
          "insurance_policy_records",
          policyId,
          user.id
        )
      : null;

    const resolvedVehicleId =
      vehicleId ??
      positiveInteger(proposal?.vehicle_id) ??
      positiveInteger(quote?.vehicle_id) ??
      positiveInteger(policy?.vehicle_id);

    if (!resolvedVehicleId) {
      return NextResponse.json(
        { error: "Unable to resolve vehicle_id for underwriting." },
        { status: 400 }
      );
    }

    const vehicle = await loadOwnedVehicle(
      adminClient as any,
      resolvedVehicleId,
      user.id
    );

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const claims = await loadVehicleClaims(
      adminClient as any,
      resolvedVehicleId,
      user.id,
      policyId
    );

    const rules = await loadActiveRules(adminClient as any);

    const source = buildSourceContext({
      body,
      proposal,
      quote,
      policy,
      vehicle,
      claims,
    });

    const ruleResults = evaluateRules(rules, source);

    const assessment = buildAssessment({
      body,
      source,
      vehicle,
      claims,
      ruleResults,
    });

    const caseStatus =
      assessment.decline_required
        ? "declined"
        : assessment.inspection_required
          ? "inspection_pending"
          : assessment.referral_required
            ? "referred"
            : "approved";

    const decisionStatus =
      assessment.decline_required
        ? "declined"
        : assessment.referral_required
          ? "recommended"
          : "approved";

    const referralStatus =
      assessment.referral_required
        ? "pending"
        : "not_referred";

    const { data: caseData, error: caseError } = await adminClient
      .from("insurance_underwriting_cases")
      .insert({
        user_id: user.id,
        proposal_id: proposalId,
        quote_id: quoteId,
        policy_id: policyId,
        vehicle_id: resolvedVehicleId,

        underwriting_status: caseStatus,
        decision_status: decisionStatus,
        referral_status: referralStatus,

        applicant_name:
          cleanNullableText(body.applicant_name, 250) ??
          cleanNullableText(proposal?.proposer_name, 250) ??
          cleanNullableText(quote?.customer_name, 250) ??
          cleanNullableText(policy?.insured_name, 250),

        applicant_type:
          cleanText(body.applicant_type, 80) ||
          cleanText(proposal?.proposer_type, 80) ||
          "individual",

        vehicle_registration_number:
          cleanNullableText(vehicle.registration_number, 120) ??
          cleanNullableText(proposal?.vehicle_registration_number, 120) ??
          cleanNullableText(quote?.vehicle_registration_number, 120) ??
          cleanNullableText(policy?.vehicle_registration_number, 120),

        vehicle_make:
          cleanNullableText(vehicle.make, 120) ??
          cleanNullableText(quote?.vehicle_make, 120) ??
          cleanNullableText(policy?.vehicle_make, 120),

        vehicle_model:
          cleanNullableText(vehicle.model, 120) ??
          cleanNullableText(quote?.vehicle_model, 120) ??
          cleanNullableText(policy?.vehicle_model, 120),

        vehicle_variant:
          cleanNullableText(vehicle.variant, 120) ??
          cleanNullableText(quote?.vehicle_variant, 120) ??
          cleanNullableText(policy?.vehicle_variant, 120),

        vehicle_year:
          cleanYear(vehicle.year) ??
          cleanYear(quote?.vehicle_year) ??
          cleanYear(policy?.vehicle_year),

        vehicle_fuel_type:
          cleanNullableText(vehicle.fuel_type, 80) ??
          cleanNullableText(quote?.vehicle_fuel_type, 80) ??
          cleanNullableText(policy?.vehicle_fuel_type, 80),

        vehicle_usage_type:
          cleanNullableText(vehicle.usage_type, 80) ??
          cleanNullableText(policy?.vehicle_usage_type, 80),

        requested_policy_type:
          cleanNullableText(body.requested_policy_type, 80) ??
          cleanNullableText(proposal?.policy_type, 80) ??
          cleanNullableText(quote?.policy_type, 80) ??
          cleanNullableText(policy?.policy_type, 80),

        requested_idv:
          cleanMoney(body.requested_idv) ??
          cleanMoney(quote?.idv) ??
          cleanMoney(policy?.idv),

        requested_total_premium:
          cleanMoney(body.requested_total_premium) ??
          cleanMoney(quote?.total_premium) ??
          cleanMoney(policy?.total_premium),

        previous_policy_number:
          cleanNullableText(body.previous_policy_number, 120) ??
          cleanNullableText(proposal?.previous_policy_number, 120),

        previous_insurer_name:
          cleanNullableText(body.previous_insurer_name, 250) ??
          cleanNullableText(proposal?.previous_insurer_name, 250),

        previous_policy_expiry_date:
          normalizeOptionalDate(body.previous_policy_expiry_date) ??
          normalizeOptionalDate(proposal?.previous_policy_expiry_date),

        claim_count: assessment.claim_count,
        settled_claim_count: assessment.settled_claim_count,
        rejected_claim_count: assessment.rejected_claim_count,
        fraud_alert_count: assessment.fraud_alert_count,

        vehicle_age_years: assessment.vehicle_age_years,
        ownership_age_months: cleanNonNegativeInteger(
          body.ownership_age_months
        ),
        annual_usage_km: cleanNonNegativeNumber(body.annual_usage_km),

        geographic_risk_score: assessment.geographic_risk_score,
        vehicle_risk_score: assessment.vehicle_risk_score,
        driver_risk_score: assessment.driver_risk_score,
        claims_risk_score: assessment.claims_risk_score,
        fraud_risk_score: assessment.fraud_risk_score,
        payment_risk_score: assessment.payment_risk_score,

        overall_risk_score: assessment.overall_risk_score,
        overall_risk_band: assessment.overall_risk_band,

        inspection_required: assessment.inspection_required,
        inspection_status: assessment.inspection_required
          ? "pending"
          : "not_required",

        documents_complete: Boolean(body.documents_complete),
        kyc_status: cleanText(body.kyc_status, 80) || "pending",
        rc_validation_status:
          cleanText(body.rc_validation_status, 80) || "pending",
        licence_validation_status:
          cleanText(body.licence_validation_status, 80) || "pending",

        recommended_idv: assessment.recommended_idv,
        recommended_base_premium: assessment.recommended_base_premium,
        recommended_total_premium: assessment.recommended_total_premium,
        recommended_ncb_percent: assessment.recommended_ncb_percent,
        recommended_deductible: assessment.recommended_deductible,

        premium_loading_percent: assessment.premium_loading_percent,
        premium_discount_percent: assessment.premium_discount_percent,

        recommended_addons: buildRecommendedAddons(
          assessment,
          vehicle
        ),
        coverage_restrictions: buildCoverageRestrictions(
          assessment,
          vehicle
        ),
        exclusions: buildExclusions(assessment),

        ai_summary: assessment.ai_summary,
        ai_risk_reasons: assessment.ai_risk_reasons,
        ai_recommendations: assessment.ai_recommendations,
        ai_confidence: assessment.ai_confidence,
        ai_model: "rules-plus-risk-v1",
        ai_raw_response: {
          source,
          rule_results: ruleResults,
          metadata: validObject(body.metadata) ?? {},
        },

        submitted_at: new Date().toISOString(),
        assessed_at: new Date().toISOString(),
        decided_at:
          assessment.referral_required ||
          assessment.inspection_required
            ? null
            : new Date().toISOString(),
      })
      .select("*")
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        {
          error:
            caseError?.message ||
            "Unable to create underwriting case.",
        },
        { status: 500 }
      );
    }

    try {
      await Promise.all([
        createRiskFactors(
          adminClient as any,
          user.id,
          caseData.id,
          assessment.risk_factors
        ),
        createRuleResults(
          adminClient as any,
          user.id,
          caseData.id,
          ruleResults
        ),
      ]);

      let inspectionId: number | null = null;
      let referralId: number | null = null;
      let decisionId: number | null = null;

      if (assessment.inspection_required) {
        inspectionId = await createInspection({
          adminClient: adminClient as any,
          userId: user.id,
          underwritingCaseId: caseData.id,
          policyId,
          vehicleId: resolvedVehicleId,
        });
      }

      if (assessment.referral_required) {
        referralId = await createReferral({
          adminClient: adminClient as any,
          userId: user.id,
          underwritingCaseId: caseData.id,
          assessment,
        });
      } else {
        decisionId = await createDecision({
          adminClient: adminClient as any,
          userId: user.id,
          underwritingCaseId: caseData.id,
          assessment,
        });
      }

      await writeUnderwritingAudit({
        adminClient: adminClient as any,
        userId: user.id,
        underwritingCaseId: caseData.id,
        referralId,
        decisionId,
        assessment,
      });

      return NextResponse.json({
        success: true,
        underwriting_case_id: caseData.id,
        case_reference: caseData.case_reference,
        underwriting_status: caseStatus,
        decision_status: decisionStatus,
        referral_status: referralStatus,

        overall_risk_score: assessment.overall_risk_score,
        overall_risk_band: assessment.overall_risk_band,

        inspection_required: assessment.inspection_required,
        inspection_id: inspectionId,

        referral_required: assessment.referral_required,
        referral_id: referralId,

        decline_required: assessment.decline_required,
        decision_id: decisionId,

        recommended_idv: assessment.recommended_idv,
        recommended_base_premium:
          assessment.recommended_base_premium,
        recommended_total_premium:
          assessment.recommended_total_premium,
        recommended_ncb_percent:
          assessment.recommended_ncb_percent,
        recommended_deductible:
          assessment.recommended_deductible,

        premium_loading_percent:
          assessment.premium_loading_percent,
        premium_discount_percent:
          assessment.premium_discount_percent,

        ai_summary: assessment.ai_summary,
        ai_risk_reasons: assessment.ai_risk_reasons,
        ai_recommendations:
          assessment.ai_recommendations,
        ai_confidence: assessment.ai_confidence,

        rule_results: ruleResults,
        message:
          assessment.decline_required
            ? "Underwriting assessment recommends decline."
            : assessment.referral_required
              ? "Underwriting assessment requires manual review."
              : assessment.inspection_required
                ? "Underwriting assessment requires vehicle inspection."
                : "Underwriting assessment approved.",
      });
    } catch (linkedError) {
      await adminClient
        .from("insurance_underwriting_cases")
        .delete()
        .eq("id", caseData.id)
        .eq("user_id", user.id);

      throw linkedError;
    }
  } catch (error) {
    console.error("Underwriting assessment error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to assess underwriting.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedRecord(
  adminClient: any,
  table: string,
  recordId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from(table)
    .select("*")
    .eq("id", recordId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadOwnedVehicle(
  adminClient: any,
  vehicleId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as VehicleRow | null;
}

async function loadVehicleClaims(
  adminClient: any,
  vehicleId: number,
  userId: string,
  policyId: number | null
) {
  let query = adminClient
    .from("insurance_claims")
    .select("*")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId);

  if (policyId) {
    query = query.eq("policy_id", policyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClaimRow[];
}

async function loadActiveRules(
  adminClient: any
) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await adminClient
    .from("insurance_underwriting_rules")
    .select("*")
    .eq("rule_status", "active")
    .or(`effective_from.is.null,effective_from.lte.${today}`)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("priority", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UnderwritingRule[];
}

function buildSourceContext(args: {
  body: AssessUnderwritingBody;
  proposal: any;
  quote: any;
  policy: any;
  vehicle: VehicleRow;
  claims: ClaimRow[];
}) {
  const currentYear = new Date().getUTCFullYear();

  const vehicleYear =
    cleanYear(args.vehicle.year) ??
    cleanYear(args.quote?.vehicle_year) ??
    cleanYear(args.policy?.vehicle_year);

  const vehicleAgeYears =
    vehicleYear === null
      ? null
      : Math.max(0, currentYear - vehicleYear);

  const settledClaimCount = args.claims.filter((claim) =>
    ["settled", "completed", "paid"].includes(
      cleanText(claim.claim_status, 80).toLowerCase()
    )
  ).length;

  const rejectedClaimCount = args.claims.filter((claim) =>
    ["rejected", "declined"].includes(
      cleanText(claim.claim_status, 80).toLowerCase()
    )
  ).length;

  const fraudAlertCount = args.claims.filter((claim) => {
    const fraudStatus = cleanText(
      claim.fraud_status,
      80
    ).toLowerCase();

    return (
      ["alert", "suspected", "confirmed", "review"].includes(
        fraudStatus
      ) ||
      numberOrZero(claim.fraud_risk_score) >= 60
    );
  }).length;

  return {
    vehicle_age_years: vehicleAgeYears,
    claim_count: args.claims.length,
    settled_claim_count: settledClaimCount,
    rejected_claim_count: rejectedClaimCount,
    fraud_alert_count: fraudAlertCount,
    documents_complete: Boolean(args.body.documents_complete),
    kyc_status:
      cleanText(args.body.kyc_status, 80) || "pending",
    rc_validation_status:
      cleanText(args.body.rc_validation_status, 80) || "pending",
    licence_validation_status:
      cleanText(args.body.licence_validation_status, 80) || "pending",
    annual_usage_km:
      cleanNonNegativeNumber(args.body.annual_usage_km),
    requested_idv:
      cleanMoney(args.body.requested_idv) ??
      cleanMoney(args.quote?.idv) ??
      cleanMoney(args.policy?.idv),
    requested_total_premium:
      cleanMoney(args.body.requested_total_premium) ??
      cleanMoney(args.quote?.total_premium) ??
      cleanMoney(args.policy?.total_premium),
    force_inspection: Boolean(args.body.force_inspection),
  };
}

function evaluateRules(
  rules: UnderwritingRule[],
  source: Record<string, unknown>
): RuleResult[] {
  return rules.map((rule) => {
    const matched = evaluateConditionObject(
      rule.condition_expression,
      source
    );

    return {
      rule_id: rule.id,
      rule_code: rule.rule_code,
      rule_name: rule.rule_name,
      matched,
      result_status: matched ? "matched" : "not_matched",
      risk_score_adjustment: matched
        ? numberOrZero(rule.risk_score_adjustment)
        : 0,
      premium_loading_percent: matched
        ? numberOrZero(rule.premium_loading_percent)
        : 0,
      premium_discount_percent: matched
        ? numberOrZero(rule.premium_discount_percent)
        : 0,
      referral_required: matched && Boolean(rule.referral_required),
      inspection_required: matched && Boolean(rule.inspection_required),
      decline_required: matched && Boolean(rule.decline_required),
      result_explanation: matched
        ? rule.rule_description || `${rule.rule_name} matched.`
        : `${rule.rule_name} did not match.`,
      result_payload: {
        condition_expression: rule.condition_expression,
        action_expression: rule.action_expression,
      },
    };
  });
}

function evaluateConditionObject(
  expression: Record<string, unknown>,
  source: Record<string, unknown>
) {
  for (const [field, conditionValue] of Object.entries(expression ?? {})) {
    const sourceValue = source[field];

    if (
      typeof conditionValue !== "object" ||
      conditionValue === null ||
      Array.isArray(conditionValue)
    ) {
      if (sourceValue !== conditionValue) {
        return false;
      }

      continue;
    }

    const condition = conditionValue as Record<string, unknown>;

    for (const [operator, expected] of Object.entries(condition)) {
      if (!compareValue(sourceValue, operator, expected)) {
        return false;
      }
    }
  }

  return true;
}

function compareValue(
  actual: unknown,
  operator: string,
  expected: unknown
) {
  switch (operator) {
    case "eq":
      return actual === expected;

    case "neq":
      return actual !== expected;

    case "gt":
      return numberOrZero(actual) > numberOrZero(expected);

    case "gte":
      return numberOrZero(actual) >= numberOrZero(expected);

    case "lt":
      return numberOrZero(actual) < numberOrZero(expected);

    case "lte":
      return numberOrZero(actual) <= numberOrZero(expected);

    case "in":
      return Array.isArray(expected)
        ? expected.includes(actual)
        : false;

    default:
      return false;
  }
}

function buildAssessment(args: {
  body: AssessUnderwritingBody;
  source: Record<string, unknown>;
  vehicle: VehicleRow;
  claims: ClaimRow[];
  ruleResults: RuleResult[];
}): Assessment {
  const vehicleAgeYears =
    typeof args.source.vehicle_age_years === "number"
      ? args.source.vehicle_age_years
      : null;

  const claimCount = numberOrZero(args.source.claim_count);
  const settledClaimCount = numberOrZero(
    args.source.settled_claim_count
  );
  const rejectedClaimCount = numberOrZero(
    args.source.rejected_claim_count
  );
  const fraudAlertCount = numberOrZero(
    args.source.fraud_alert_count
  );

  const geographicRiskScore = clampScore(
    args.body.geographic_risk_score,
    25
  );

  const vehicleRiskScore = clampScore(
    args.body.vehicle_risk_score,
    vehicleAgeYears === null
      ? 35
      : Math.min(100, 15 + vehicleAgeYears * 5)
  );

  const driverRiskScore = clampScore(
    args.body.driver_risk_score,
    30
  );

  const claimsRiskScore = clampScore(
    null,
    Math.min(
      100,
      claimCount * 15 +
        rejectedClaimCount * 10
    )
  );

  const fraudRiskScore = clampScore(
    null,
    Math.min(
      100,
      fraudAlertCount * 40
    )
  );

  const paymentRiskScore = clampScore(
    args.body.payment_risk_score,
    20
  );

  const ruleRiskAdjustment = args.ruleResults.reduce(
    (sum, result) =>
      sum + result.risk_score_adjustment,
    0
  );

  const weightedBase =
    geographicRiskScore * 0.1 +
    vehicleRiskScore * 0.25 +
    driverRiskScore * 0.15 +
    claimsRiskScore * 0.25 +
    fraudRiskScore * 0.2 +
    paymentRiskScore * 0.05;

  const overallRiskScore = clampScore(
    null,
    weightedBase + ruleRiskAdjustment
  );

  const overallRiskBand =
    overallRiskScore >= 90
      ? "decline"
      : overallRiskScore >= 75
        ? "very_high"
        : overallRiskScore >= 60
          ? "high"
          : overallRiskScore >= 40
            ? "medium"
            : overallRiskScore >= 20
              ? "low"
              : "very_low";

  const ruleLoading = args.ruleResults.reduce(
    (sum, result) =>
      sum + result.premium_loading_percent,
    0
  );

  const ruleDiscount = args.ruleResults.reduce(
    (sum, result) =>
      sum + result.premium_discount_percent,
    0
  );

  const premiumLoadingPercent = round(
    Math.min(
      100,
      ruleLoading +
        Math.max(0, overallRiskScore - 40) * 0.4
    ),
    3
  );

  const premiumDiscountPercent = round(
    Math.min(
      30,
      ruleDiscount +
        (overallRiskScore < 25 ? 5 : 0)
    ),
    3
  );

  const requestedIdv = cleanMoney(
    args.source.requested_idv
  );

  const depreciationRate =
    vehicleAgeYears === null
      ? 0.1
      : vehicleAgeYears <= 1
        ? 0.1
        : vehicleAgeYears <= 2
          ? 0.15
          : vehicleAgeYears <= 3
            ? 0.2
            : vehicleAgeYears <= 4
              ? 0.3
              : vehicleAgeYears <= 5
                ? 0.4
                : 0.5;

  const recommendedIdv =
    requestedIdv === null
      ? null
      : roundMoney(
          requestedIdv * (1 - depreciationRate)
        );

  const requestedPremium =
    cleanMoney(
      args.source.requested_total_premium
    ) ?? 0;

  const recommendedBasePremium = roundMoney(
    requestedPremium > 0
      ? requestedPremium
      : Math.max(
          1000,
          numberOrZero(recommendedIdv) * 0.025
        )
  );

  const recommendedTotalPremium = roundMoney(
    recommendedBasePremium *
      (1 + premiumLoadingPercent / 100) *
      (1 - premiumDiscountPercent / 100)
  );

  const recommendedNcbPercent =
    claimCount === 0
      ? 20
      : Math.max(
          0,
          20 - claimCount * 10
        );

  const recommendedDeductible = roundMoney(
    overallRiskScore >= 75
      ? 10000
      : overallRiskScore >= 60
        ? 7500
        : overallRiskScore >= 40
          ? 5000
          : 2500
  );

  const inspectionRequired =
    Boolean(args.source.force_inspection) ||
    vehicleAgeYears !== null &&
      vehicleAgeYears > 10 ||
    fraudAlertCount > 0 ||
    args.ruleResults.some(
      (result) =>
        result.inspection_required
    );

  const declineRequired =
    overallRiskBand === "decline" ||
    args.ruleResults.some(
      (result) =>
        result.decline_required
    );

  const referralRequired =
    !declineRequired &&
    (
      overallRiskScore >= 60 ||
      inspectionRequired ||
      args.ruleResults.some(
        (result) =>
          result.referral_required
      )
    );

  const riskFactors = buildRiskFactors({
    vehicleAgeYears,
    claimCount,
    settledClaimCount,
    rejectedClaimCount,
    fraudAlertCount,
    geographicRiskScore,
    vehicleRiskScore,
    driverRiskScore,
    claimsRiskScore,
    fraudRiskScore,
    paymentRiskScore,
    overallRiskScore,
  });

  const aiRiskReasons = riskFactors
    .filter((factor) => factor.risk_score >= 40)
    .map((factor) => factor.explanation);

  if (!Boolean(args.body.documents_complete)) {
    aiRiskReasons.push(
      "Required underwriting documents are incomplete."
    );
  }

  const aiRecommendations: string[] = [];

  if (inspectionRequired) {
    aiRecommendations.push(
      "Complete vehicle inspection before final underwriting approval."
    );
  }

  if (fraudAlertCount > 0) {
    aiRecommendations.push(
      "Refer the case to fraud review before issuance."
    );
  }

  if (overallRiskScore >= 60) {
    aiRecommendations.push(
      "Apply premium loading and require senior underwriter review."
    );
  }

  if (claimCount === 0) {
    aiRecommendations.push(
      "Consider a no-claim discount subject to policy and insurer rules."
    );
  }

  if (!aiRecommendations.length) {
    aiRecommendations.push(
      "Proceed with standard underwriting verification."
    );
  }

  const aiSummary =
    `Overall underwriting risk is ${overallRiskBand.replace(/_/g, " ")} ` +
    `with a score of ${overallRiskScore}/100. ` +
    `${claimCount} historical claim(s) and ${fraudAlertCount} fraud alert(s) were considered.`;

  return {
    geographic_risk_score: geographicRiskScore,
    vehicle_risk_score: vehicleRiskScore,
    driver_risk_score: driverRiskScore,
    claims_risk_score: claimsRiskScore,
    fraud_risk_score: fraudRiskScore,
    payment_risk_score: paymentRiskScore,

    overall_risk_score: overallRiskScore,
    overall_risk_band: overallRiskBand,

    vehicle_age_years: vehicleAgeYears,
    claim_count: claimCount,
    settled_claim_count: settledClaimCount,
    rejected_claim_count: rejectedClaimCount,
    fraud_alert_count: fraudAlertCount,

    inspection_required: inspectionRequired,
    referral_required: referralRequired,
    decline_required: declineRequired,

    recommended_idv: recommendedIdv,
    recommended_base_premium:
      recommendedBasePremium,
    recommended_total_premium:
      recommendedTotalPremium,
    recommended_ncb_percent:
      recommendedNcbPercent,
    recommended_deductible:
      recommendedDeductible,

    premium_loading_percent:
      premiumLoadingPercent,
    premium_discount_percent:
      premiumDiscountPercent,

    ai_summary: aiSummary,
    ai_risk_reasons: aiRiskReasons,
    ai_recommendations:
      aiRecommendations,
    ai_confidence: clampScore(
      null,
      75 +
        Math.min(20, claimCount * 2) -
        (vehicleAgeYears === null ? 10 : 0)
    ),

    risk_factors: riskFactors,
  };
}

function buildRiskFactors(args: {
  vehicleAgeYears: number | null;
  claimCount: number;
  settledClaimCount: number;
  rejectedClaimCount: number;
  fraudAlertCount: number;
  geographicRiskScore: number;
  vehicleRiskScore: number;
  driverRiskScore: number;
  claimsRiskScore: number;
  fraudRiskScore: number;
  paymentRiskScore: number;
  overallRiskScore: number;
}): RiskFactor[] {
  return [
    createRiskFactor(
      "vehicle_age",
      "Vehicle Age",
      "vehicle",
      args.vehicleAgeYears === null
        ? "unknown"
        : `${args.vehicleAgeYears} years`,
      args.vehicleAgeYears,
      args.vehicleRiskScore,
      args.vehicleAgeYears !== null &&
        args.vehicleAgeYears > 10
        ? "Older vehicle requires inspection."
        : "Vehicle age is within standard range.",
      args.vehicleAgeYears !== null &&
        args.vehicleAgeYears > 10
        ? "Schedule pre-policy inspection."
        : null
    ),
    createRiskFactor(
      "claims_history",
      "Claims History",
      "claims",
      `${args.claimCount} claims`,
      args.claimCount,
      args.claimsRiskScore,
      `${args.claimCount} historical claims, ${args.settledClaimCount} settled and ${args.rejectedClaimCount} rejected.`,
      args.claimCount >= 3
        ? "Refer to senior underwriter."
        : null
    ),
    createRiskFactor(
      "fraud_alerts",
      "Fraud Alerts",
      "fraud",
      `${args.fraudAlertCount} alerts`,
      args.fraudAlertCount,
      args.fraudRiskScore,
      `${args.fraudAlertCount} fraud alert(s) were detected.`,
      args.fraudAlertCount > 0
        ? "Refer to fraud review."
        : null
    ),
    createRiskFactor(
      "geographic_risk",
      "Geographic Risk",
      "geographic",
      String(args.geographicRiskScore),
      args.geographicRiskScore,
      args.geographicRiskScore,
      "Geographic exposure was included in the underwriting score.",
      null
    ),
    createRiskFactor(
      "driver_risk",
      "Driver Risk",
      "driver",
      String(args.driverRiskScore),
      args.driverRiskScore,
      args.driverRiskScore,
      "Driver risk was included in the underwriting score.",
      null
    ),
    createRiskFactor(
      "payment_risk",
      "Payment Risk",
      "payment",
      String(args.paymentRiskScore),
      args.paymentRiskScore,
      args.paymentRiskScore,
      "Payment risk was included in the underwriting score.",
      null
    ),
    createRiskFactor(
      "overall_risk",
      "Overall Risk",
      "overall",
      String(args.overallRiskScore),
      args.overallRiskScore,
      args.overallRiskScore,
      `Overall risk score is ${args.overallRiskScore}/100.`,
      args.overallRiskScore >= 60
        ? "Require manual underwriting review."
        : null
    ),
  ];
}

function createRiskFactor(
  code: string,
  name: string,
  category: string,
  observedValue: string,
  numericValue: number | null,
  riskScore: number,
  explanation: string,
  recommendedAction: string | null
): RiskFactor {
  return {
    factor_code: code,
    factor_name: name,
    factor_category: category,
    observed_value: observedValue,
    numeric_value: numericValue,
    risk_weight: 1,
    risk_score: riskScore,
    risk_level:
      riskScore >= 75
        ? "very_high"
        : riskScore >= 60
          ? "high"
          : riskScore >= 40
            ? "medium"
            : "low",
    source_type: "system_assessment",
    source_reference: null,
    explanation,
    recommended_action:
      recommendedAction,
    metadata: {},
  };
}

async function createRiskFactors(
  adminClient: any,
  userId: string,
  underwritingCaseId: number,
  factors: RiskFactor[]
) {
  const rows = factors.map((factor) => ({
    user_id: userId,
    underwriting_case_id: underwritingCaseId,
    ...factor,
  }));

  const { error } = await adminClient
    .from("insurance_underwriting_risk_factors")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createRuleResults(
  adminClient: any,
  userId: string,
  underwritingCaseId: number,
  results: RuleResult[]
) {
  if (!results.length) {
    return;
  }

  const rows = results.map((result) => ({
    user_id: userId,
    underwriting_case_id: underwritingCaseId,
    rule_id: result.rule_id,
    rule_code: result.rule_code,
    rule_name: result.rule_name,
    result_status: result.result_status,
    matched: result.matched,
    risk_score_adjustment:
      result.risk_score_adjustment,
    premium_loading_percent:
      result.premium_loading_percent,
    premium_discount_percent:
      result.premium_discount_percent,
    referral_required:
      result.referral_required,
    inspection_required:
      result.inspection_required,
    decline_required:
      result.decline_required,
    result_explanation:
      result.result_explanation,
    result_payload:
      result.result_payload,
  }));

  const { error } = await adminClient
    .from("insurance_underwriting_rule_results")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createInspection(args: {
  adminClient: any;
  userId: string;
  underwritingCaseId: number;
  policyId: number | null;
  vehicleId: number;
}) {
  const { data, error } = await args.adminClient
    .from("insurance_vehicle_inspections")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCaseId,
      policy_id: args.policyId,
      vehicle_id: args.vehicleId,
      inspection_type: "pre_policy",
      inspection_status: "scheduled",
      inspection_mode: "self_inspection",
      scheduled_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Unable to create vehicle inspection."
    );
  }

  return Number(data.id);
}

async function createReferral(args: {
  adminClient: any;
  userId: string;
  underwritingCaseId: number;
  assessment: Assessment;
}) {
  const priority =
    args.assessment.overall_risk_score >= 75
      ? "high"
      : "medium";

  const { data, error } = await args.adminClient
    .from("insurance_underwriting_referrals")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCaseId,
      referral_type:
        args.assessment.fraud_alert_count > 0
          ? "fraud_review"
          : args.assessment.inspection_required
            ? "inspection_review"
            : "manual_underwriting",
      referral_status: "pending",
      referral_reason:
        args.assessment.ai_risk_reasons.join(" "),
      referral_priority: priority,
      requested_at:
        new Date().toISOString(),
      recommended_changes: {
        recommended_idv:
          args.assessment.recommended_idv,
        recommended_total_premium:
          args.assessment
            .recommended_total_premium,
        recommended_ncb_percent:
          args.assessment
            .recommended_ncb_percent,
        recommended_deductible:
          args.assessment
            .recommended_deductible,
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Unable to create underwriting referral."
    );
  }

  return Number(data.id);
}

async function createDecision(args: {
  adminClient: any;
  userId: string;
  underwritingCaseId: number;
  assessment: Assessment;
}) {
  const decisionType =
    args.assessment.decline_required
      ? "decline"
      : args.assessment.overall_risk_score >= 40
        ? "approve_with_conditions"
        : "approve";

  const { data, error } = await args.adminClient
    .from("insurance_underwriting_decisions")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCaseId,
      decision_type: decisionType,
      decision_status: "final",

      approved_idv:
        args.assessment.recommended_idv,
      approved_base_premium:
        args.assessment
          .recommended_base_premium,
      approved_total_premium:
        args.assessment
          .recommended_total_premium,
      approved_ncb_percent:
        args.assessment
          .recommended_ncb_percent,
      approved_deductible:
        args.assessment
          .recommended_deductible,

      premium_loading_percent:
        args.assessment
          .premium_loading_percent,
      premium_discount_percent:
        args.assessment
          .premium_discount_percent,

      approved_addons: [],
      coverage_restrictions:
        buildCoverageRestrictions(
          args.assessment,
          null
        ),
      exclusions:
        buildExclusions(
          args.assessment
        ),

      decision_reason:
        args.assessment.ai_summary,
      decision_notes:
        args.assessment
          .ai_recommendations.join(" "),

      decided_by_name:
        "Mira Underwriting Engine",
      decided_by_role:
        "system_recommendation",

      ai_recommendation_used: true,
      human_override: false,
      decided_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Unable to create underwriting decision."
    );
  }

  return Number(data.id);
}

async function writeUnderwritingAudit(args: {
  adminClient: any;
  userId: string;
  underwritingCaseId: number;
  referralId: number | null;
  decisionId: number | null;
  assessment: Assessment;
}) {
  const { error } = await args.adminClient
    .from("insurance_underwriting_audit_log")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCaseId,
      referral_id: args.referralId,
      decision_id: args.decisionId,
      action_type:
        "underwriting_assessment_completed",
      action_status:
        args.assessment.decline_required
          ? "declined"
          : args.assessment.referral_required
            ? "referred"
            : "approved",
      actor_type: "system",
      actor_name:
        "Mira Underwriting Engine",
      previous_values: {},
      new_values: {
        overall_risk_score:
          args.assessment
            .overall_risk_score,
        overall_risk_band:
          args.assessment
            .overall_risk_band,
        recommended_total_premium:
          args.assessment
            .recommended_total_premium,
        inspection_required:
          args.assessment
            .inspection_required,
        referral_required:
          args.assessment
            .referral_required,
        decline_required:
          args.assessment
            .decline_required,
      },
      metadata: {
        ai_summary:
          args.assessment.ai_summary,
        ai_risk_reasons:
          args.assessment
            .ai_risk_reasons,
        ai_recommendations:
          args.assessment
            .ai_recommendations,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

function buildRecommendedAddons(
  assessment: Assessment,
  vehicle: VehicleRow | null
) {
  const addons: Array<Record<string, unknown>> = [];

  if (
    assessment.vehicle_age_years !== null &&
    assessment.vehicle_age_years <= 5
  ) {
    addons.push({
      code: "zero_depreciation",
      reason:
        "Vehicle age may qualify for zero-depreciation cover.",
    });
  }

  if (
    cleanText(vehicle?.fuel_type, 80)
      .toLowerCase()
      .includes("electric")
  ) {
    addons.push({
      code: "ev_battery_cover",
      reason:
        "Electric vehicle battery protection is recommended.",
    });
  }

  addons.push({
    code: "roadside_assistance",
    reason:
      "Roadside assistance is recommended for continuity of support.",
  });

  return addons;
}

function buildCoverageRestrictions(
  assessment: Assessment,
  vehicle: VehicleRow | null
) {
  const restrictions: Array<Record<string, unknown>> = [];

  if (assessment.inspection_required) {
    restrictions.push({
      code: "inspection_pending",
      description:
        "Own-damage coverage remains subject to successful inspection.",
    });
  }

  if (
    assessment.vehicle_age_years !== null &&
    assessment.vehicle_age_years > 10
  ) {
    restrictions.push({
      code: "older_vehicle_review",
      description:
        "Certain add-ons may require manual approval for older vehicles.",
    });
  }

  if (
    vehicle &&
    cleanText(vehicle.usage_type, 80)
      .toLowerCase()
      .includes("commercial")
  ) {
    restrictions.push({
      code: "commercial_usage",
      description:
        "Commercial-use rating and coverage conditions apply.",
    });
  }

  return restrictions;
}

function buildExclusions(
  assessment: Assessment
) {
  const exclusions: Array<Record<string, unknown>> = [];

  if (assessment.fraud_alert_count > 0) {
    exclusions.push({
      code: "fraud_review_pending",
      description:
        "Coverage is not final until fraud review is completed.",
    });
  }

  return exclusions;
}

function clampScore(
  value: unknown,
  fallback: number
) {
  const numeric = Number(value);

  const resolved =
    Number.isFinite(numeric)
      ? numeric
      : fallback;

  return Math.round(
    Math.min(100, Math.max(0, resolved))
  );
}

function readEnvironment():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      serviceRoleKey: string;
    }
  | { error: string } {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const numeric = Number(value);

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
  const cleaned = cleanText(value, limit);
  return cleaned || null;
}

function cleanMoney(
  value: unknown
): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[₹,\s]/g, ""))
        : NaN;

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanNonNegativeNumber(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanNonNegativeInteger(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isInteger(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanYear(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isInteger(numeric) &&
    numeric >= 1900 &&
    numeric <= 2200
    ? numeric
    : null;
}

function numberOrZero(
  value: unknown
) {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function roundMoney(
  value: number
) {
  return Math.round(value * 100) / 100;
}

function round(
  value: number,
  decimals = 2
) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

function normalizeOptionalDate(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(
    `${raw}T00:00:00.000Z`
  );

  return Number.isNaN(date.getTime())
    ? null
    : raw;
}