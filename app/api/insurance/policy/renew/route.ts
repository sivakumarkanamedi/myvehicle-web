import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type RenewPolicyBody = {
  policy_id?: number;

  renewal_start_date?: string | null;
  renewal_end_date?: string | null;

  proposed_idv?: number | null;
  proposed_total_premium?: number | null;
  proposed_ncb_percent?: number | null;

  selected_addons?: Array<Record<string, unknown>>;
  coverage_changes?: Record<string, unknown>;

  renewal_mode?: "manual" | "auto";
  auto_renew?: boolean;

  grace_period_days?: number | null;

  payment_plan?: {
    payment_plan_type?: string;
    installment_count?: number | null;
    total_payable_amount?: number | null;
    initial_payment_amount?: number | null;
    financed_amount?: number | null;
    interest_rate?: number | null;
    processing_fee?: number | null;
    total_interest_amount?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    installments?: Array<{
      installment_number: number;
      due_date: string;
      installment_amount: number;
    }>;
  };

  metadata?: Record<string, unknown>;
};

type PolicyRow = {
  id: number;
  user_id: string;
  policy_number: string;
  policy_status: string;
  issuance_status: string;
  renewal_status: string;
  policy_version: number;

  proposal_id: number | null;
  quote_id: number | null;
  product_id: number | null;
  vehicle_id: number;

  policy_type: string;
  policy_category: string;

  insurer_name: string | null;
  branch_code: string | null;
  intermediary_code: string | null;

  insured_name: string;
  insured_email: string | null;
  insured_phone: string | null;
  insured_address: Record<string, unknown>;

  vehicle_registration_number: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  vin: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;
  vehicle_year: number | null;
  vehicle_fuel_type: string | null;
  vehicle_usage_type: string | null;

  policy_start_date: string;
  policy_end_date: string;

  idv: number | null;
  total_premium: number;
  net_premium: number;
  tax_amount: number;
  discount_amount: number;
  ncb_percent: number | null;
  ncb_discount_amount: number;

  compulsory_deductible: number | null;
  voluntary_deductible: number | null;

  coverage_details: Record<string, unknown>;
  selected_addons: Array<Record<string, unknown>>;
  exclusions: Array<Record<string, unknown> | string>;

  grace_period_days: number;
  grace_period_end_date: string | null;

  digital_signature_status: string;
  signed_at: string | null;

  metadata: Record<string, unknown>;
};

type RenewalCalculation = {
  vehicle_age: number | null;
  claims_count: number;
  settled_claims_count: number;
  high_risk_claims_count: number;

  recommended_idv: number | null;
  recommended_ncb_percent: number;
  recommended_total_premium: number;
  recommended_net_premium: number;
  recommended_tax_amount: number;
  recommended_discount_amount: number;

  retention_risk_score: number;
  renewal_probability: number;

  ai_reasons: string[];
  ai_recommended_actions: string[];
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
        { error: "You must be signed in to renew a policy." },
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

    const body = (await request.json()) as RenewPolicyBody;
    const policyId = positiveInteger(body.policy_id);

    if (!policyId) {
      return NextResponse.json(
        { error: "policy_id is required." },
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

    const policy = await loadOwnedPolicy(
      adminClient as any,
      policyId,
      user.id
    );

    if (!policy) {
      return NextResponse.json(
        { error: "Policy was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const eligibilityError = validateRenewalEligibility(policy);

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError },
        { status: 409 }
      );
    }

    const claims = await loadPolicyClaims(
      adminClient as any,
      policy
    );

    const calculation = calculateRenewal(
      policy,
      claims,
      body
    );

    const renewalStartDate =
      body.renewal_start_date
        ? normalizeRequiredDate(
            body.renewal_start_date,
            "renewal_start_date"
          )
        : addDays(policy.policy_end_date, 1);

    const renewalEndDate =
      body.renewal_end_date
        ? normalizeRequiredDate(
            body.renewal_end_date,
            "renewal_end_date"
          )
        : addYears(renewalStartDate, 1);

    if (
      new Date(renewalEndDate).getTime() <
      new Date(renewalStartDate).getTime()
    ) {
      return NextResponse.json(
        { error: "renewal_end_date cannot be before renewal_start_date." },
        { status: 400 }
      );
    }

    const gracePeriodDays = clampInteger(
      body.grace_period_days,
      0,
      365,
      policy.grace_period_days ?? 0
    );

    const renewalQuote = await createRenewalQuote({
      adminClient: adminClient as any,
      userId: user.id,
      policy,
      body,
      calculation,
      renewalStartDate,
      renewalEndDate,
    });

    const renewalRecord = await createRenewalRecord({
      adminClient: adminClient as any,
      userId: user.id,
      policy,
      renewalQuoteId: renewalQuote.id,
      calculation,
      renewalStartDate,
      gracePeriodDays,
      body,
    });

    const autoRenew = Boolean(body.auto_renew);
    let renewedPolicy: PolicyRow | null = null;

    try {
      if (autoRenew) {
        renewedPolicy = await createRenewedPolicy({
          adminClient: adminClient as any,
          userId: user.id,
          currentPolicy: policy,
          renewalQuote,
          calculation,
          renewalStartDate,
          renewalEndDate,
          gracePeriodDays,
          body,
        });

        await adminClient
          .from("insurance_policy_renewals")
          .update({
            renewed_policy_id: renewedPolicy.id,
            renewal_status: "payment_pending",
          })
          .eq("id", renewalRecord.id);

        await adminClient
          .from("insurance_policy_records")
          .update({
            renewed_policy_id: renewedPolicy.id,
            renewal_status: "renewed",
          })
          .eq("id", policy.id)
          .eq("user_id", user.id);

        if (body.payment_plan) {
          await createPaymentPlan(
            adminClient as any,
            user.id,
            renewedPolicy.id,
            body.payment_plan
          );
        }

        await createRenewalDocuments(
          adminClient as any,
          user.id,
          renewedPolicy
        );

        await createRenewalApproval(
          adminClient as any,
          user.id,
          renewedPolicy.id,
          renewalRecord.id
        );
      } else {
        await adminClient
          .from("insurance_policy_records")
          .update({
            renewal_status: "quote_generated",
          })
          .eq("id", policy.id)
          .eq("user_id", user.id);
      }

      return NextResponse.json({
        success: true,
        renewal_id: renewalRecord.id,
        renewal_reference: renewalRecord.renewal_reference,
        renewal_status: autoRenew
          ? "payment_pending"
          : "quote_generated",
        renewal_quote_id: renewalQuote.id,
        renewal_quote_reference:
          renewalQuote.quote_reference,
        renewed_policy_id: renewedPolicy?.id ?? null,
        renewed_policy_number:
          renewedPolicy?.policy_number ?? null,
        renewal_start_date: renewalStartDate,
        renewal_end_date: renewalEndDate,
        recommended_idv: calculation.recommended_idv,
        recommended_ncb_percent:
          calculation.recommended_ncb_percent,
        recommended_total_premium:
          calculation.recommended_total_premium,
        retention_risk_score:
          calculation.retention_risk_score,
        renewal_probability:
          calculation.renewal_probability,
        ai_reasons: calculation.ai_reasons,
        ai_recommended_actions:
          calculation.ai_recommended_actions,
        message: autoRenew
          ? "Renewed policy created and sent for approval/payment."
          : "Renewal quote generated successfully.",
      });
    } catch (renewalFailure) {
      await rollbackRenewal({
        adminClient: adminClient as any,
        userId: user.id,
        renewalId: renewalRecord.id,
        renewalQuoteId: renewalQuote.id,
        renewedPolicyId: renewedPolicy?.id ?? null,
        originalPolicyId: policy.id,
      });

      throw renewalFailure;
    }
  } catch (error) {
    console.error("Policy renewal error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to renew the policy.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedPolicy(
  adminClient: any,
  policyId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_policy_records")
    .select("*")
    .eq("id", policyId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PolicyRow | null;
}

async function loadPolicyClaims(
  adminClient: any,
  policy: PolicyRow
) {
  const { data, error } = await adminClient
    .from("insurance_claims")
    .select(
      `
        id,
        claim_status,
        claim_stage,
        incident_date,
        estimated_repair_cost,
        approved_claim_amount,
        settlement_amount,
        created_at
      `
    )
    .eq("policy_id", policy.id)
    .eq("user_id", policy.user_id);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function validateRenewalEligibility(
  policy: PolicyRow
) {
  if (policy.policy_status === "cancelled") {
    return "Cancelled policies cannot be renewed.";
  }

  if (policy.renewal_status === "renewed") {
    return "This policy is already marked as renewed.";
  }

  if (policy.issuance_status !== "issued" &&
      policy.policy_status !== "active" &&
      policy.policy_status !== "expired" &&
      policy.policy_status !== "grace_period") {
    return "Only issued, active, expired or grace-period policies can be renewed.";
  }

  return "";
}

function calculateRenewal(
  policy: PolicyRow,
  claims: any[],
  body: RenewPolicyBody
): RenewalCalculation {
  const currentYear = new Date().getUTCFullYear();
  const vehicleAge =
    policy.vehicle_year
      ? Math.max(0, currentYear - policy.vehicle_year)
      : null;

  const settledClaimsCount = claims.filter((claim) =>
    ["settled", "completed", "paid"].includes(
      String(claim.claim_status ?? "").toLowerCase()
    )
  ).length;

  const highRiskClaimsCount = claims.filter((claim) =>
    ["fraud_review", "manual_review", "investigation"].includes(
      String(claim.claim_stage ?? "").toLowerCase()
    )
  ).length;

  const baseIdv = cleanMoney(body.proposed_idv) ?? policy.idv;

  const depreciationRate = vehicleAge === null
    ? 0.1
    : vehicleAge <= 1
      ? 0.1
      : vehicleAge <= 2
        ? 0.15
        : vehicleAge <= 3
          ? 0.2
          : vehicleAge <= 4
            ? 0.3
            : vehicleAge <= 5
              ? 0.4
              : 0.5;

  const recommendedIdv =
    baseIdv === null
      ? null
      : roundMoney(
          Math.max(0, baseIdv * (1 - depreciationRate))
        );

  const previousNcb = cleanPercentage(policy.ncb_percent) ?? 0;

  const recommendedNcbPercent =
    cleanPercentage(body.proposed_ncb_percent) ??
    (claims.length === 0
      ? Math.min(50, previousNcb + 5)
      : Math.max(0, previousNcb - 10));

  const claimsImpactMultiplier =
    1 + Math.min(0.5, claims.length * 0.08);

  const ageImpactMultiplier =
    vehicleAge === null
      ? 1
      : vehicleAge > 10
        ? 1.2
        : vehicleAge > 5
          ? 1.1
          : 1;

  const highRiskMultiplier =
    highRiskClaimsCount > 0
      ? 1 + Math.min(0.3, highRiskClaimsCount * 0.1)
      : 1;

  const ncbMultiplier =
    Math.max(0.5, 1 - recommendedNcbPercent / 100);

  const basePremium =
    cleanMoney(body.proposed_total_premium) ??
    cleanMoney(policy.total_premium) ??
    0;

  const recommendedTotalPremium = roundMoney(
    basePremium *
      claimsImpactMultiplier *
      ageImpactMultiplier *
      highRiskMultiplier *
      ncbMultiplier
  );

  const recommendedTaxAmount = roundMoney(
    recommendedTotalPremium * 0.18
  );

  const recommendedDiscountAmount = roundMoney(
    recommendedTotalPremium *
      (recommendedNcbPercent / 100)
  );

  const recommendedNetPremium = roundMoney(
    Math.max(
      0,
      recommendedTotalPremium +
        recommendedTaxAmount -
        recommendedDiscountAmount
    )
  );

  const retentionRiskScore = clampInteger(
    Math.round(
      claims.length * 10 +
      highRiskClaimsCount * 20 +
      (vehicleAge ?? 0) * 2
    ),
    0,
    100,
    0
  );

  const renewalProbability = clampInteger(
    100 - retentionRiskScore,
    0,
    100,
    50
  );

  const aiReasons = [
    `Vehicle age considered: ${
      vehicleAge === null ? "unknown" : `${vehicleAge} years`
    }.`,
    `Claims found in policy period: ${claims.length}.`,
    `Settled claims: ${settledClaimsCount}.`,
    `High-risk claims: ${highRiskClaimsCount}.`,
    `Recommended NCB: ${recommendedNcbPercent}%.`,
  ];

  const aiRecommendedActions: string[] = [];

  if (claims.length === 0) {
    aiRecommendedActions.push(
      "Offer a no-claim renewal benefit to improve retention."
    );
  }

  if (highRiskClaimsCount > 0) {
    aiRecommendedActions.push(
      "Require authorized underwriting review before renewal approval."
    );
  }

  if ((vehicleAge ?? 0) > 10) {
    aiRecommendedActions.push(
      "Consider inspection before confirming own-damage coverage."
    );
  }

  if (renewalProbability < 50) {
    aiRecommendedActions.push(
      "Trigger a retention call and personalized renewal offer."
    );
  }

  if (!aiRecommendedActions.length) {
    aiRecommendedActions.push(
      "Proceed with standard renewal verification and payment collection."
    );
  }

  return {
    vehicle_age: vehicleAge,
    claims_count: claims.length,
    settled_claims_count: settledClaimsCount,
    high_risk_claims_count: highRiskClaimsCount,

    recommended_idv: recommendedIdv,
    recommended_ncb_percent:
      recommendedNcbPercent,
    recommended_total_premium:
      recommendedTotalPremium,
    recommended_net_premium:
      recommendedNetPremium,
    recommended_tax_amount:
      recommendedTaxAmount,
    recommended_discount_amount:
      recommendedDiscountAmount,

    retention_risk_score: retentionRiskScore,
    renewal_probability: renewalProbability,

    ai_reasons: aiReasons,
    ai_recommended_actions:
      aiRecommendedActions,
  };
}

async function createRenewalQuote(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  body: RenewPolicyBody;
  calculation: RenewalCalculation;
  renewalStartDate: string;
  renewalEndDate: string;
}) {
  const { data, error } = await args.adminClient
    .from("insurance_quotes")
    .insert({
      user_id: args.userId,
      vehicle_id: args.policy.vehicle_id,
      quote_status: "calculated",

      product_code: null,
      product_name: "Policy Renewal",

      customer_name: args.policy.insured_name,
      customer_email: args.policy.insured_email,
      customer_phone: args.policy.insured_phone,

      vehicle_registration_number:
        args.policy.vehicle_registration_number,
      vehicle_make: args.policy.vehicle_make,
      vehicle_model: args.policy.vehicle_model,
      vehicle_variant: args.policy.vehicle_variant,
      vehicle_fuel_type:
        args.policy.vehicle_fuel_type,
      vehicle_year: args.policy.vehicle_year,
      vehicle_type: args.policy.policy_category,

      policy_type: args.policy.policy_type,
      coverage_start_date: args.renewalStartDate,
      coverage_end_date: args.renewalEndDate,

      idv: args.calculation.recommended_idv,
      own_damage_premium:
        args.calculation.recommended_total_premium,
      third_party_premium: 0,
      addon_premium: 0,
      tax_amount:
        args.calculation.recommended_tax_amount,
      discount_amount:
        args.calculation.recommended_discount_amount,
      ncb_discount_amount:
        args.calculation.recommended_discount_amount,
      total_premium:
        args.calculation.recommended_net_premium,

      ncb_percent:
        args.calculation.recommended_ncb_percent,
      voluntary_deductible:
        args.policy.voluntary_deductible,
      compulsory_deductible:
        args.policy.compulsory_deductible,

      selected_addons:
        Array.isArray(args.body.selected_addons)
          ? args.body.selected_addons
          : args.policy.selected_addons ?? [],

      coverage_summary:
        validObject(args.body.coverage_changes) ??
        args.policy.coverage_details ??
        {},

      exclusions_summary:
        args.policy.exclusions ?? [],

      premium_breakup: {
        recommended_total_premium:
          args.calculation.recommended_total_premium,
        tax_amount:
          args.calculation.recommended_tax_amount,
        discount_amount:
          args.calculation.recommended_discount_amount,
        net_premium:
          args.calculation.recommended_net_premium,
      },

      ai_recommendation_summary:
        "Renewal recommendation generated from vehicle age, policy claims history and NCB.",

      ai_coverage_gaps: [],
      ai_recommended_addons: [],
      valid_until: addDays(
        args.renewalStartDate,
        -1
      ),

      metadata: {
        renewal_of_policy_id: args.policy.id,
        renewal_of_policy_number:
          args.policy.policy_number,
        retention_risk_score:
          args.calculation.retention_risk_score,
        renewal_probability:
          args.calculation.renewal_probability,
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Unable to create renewal quote."
    );
  }

  return data;
}

async function createRenewalRecord(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  renewalQuoteId: number;
  calculation: RenewalCalculation;
  renewalStartDate: string;
  gracePeriodDays: number;
  body: RenewPolicyBody;
}) {
  const { data, error } = await args.adminClient
    .from("insurance_policy_renewals")
    .insert({
      user_id: args.userId,
      current_policy_id: args.policy.id,
      renewal_quote_id: args.renewalQuoteId,
      renewal_status: "quote_generated",
      renewal_due_date: args.renewalStartDate,
      grace_period_end_date:
        args.gracePeriodDays > 0
          ? addDays(
              args.renewalStartDate,
              args.gracePeriodDays
            )
          : null,

      proposed_idv:
        args.calculation.recommended_idv,
      proposed_total_premium:
        args.calculation.recommended_net_premium,
      proposed_ncb_percent:
        args.calculation.recommended_ncb_percent,

      renewal_recommendation:
        args.body.auto_renew
          ? "auto_renew_with_approval"
          : "renewal_quote_generated",

      retention_risk_score:
        args.calculation.retention_risk_score,
      renewal_probability:
        args.calculation.renewal_probability,

      ai_reasons:
        args.calculation.ai_reasons,
      ai_recommended_actions:
        args.calculation.ai_recommended_actions,

      reminder_count: 0,
      next_reminder_at:
        addDaysTimestamp(
          args.renewalStartDate,
          -7
        ),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Unable to create policy renewal record."
    );
  }

  return data;
}

async function createRenewedPolicy(args: {
  adminClient: any;
  userId: string;
  currentPolicy: PolicyRow;
  renewalQuote: any;
  calculation: RenewalCalculation;
  renewalStartDate: string;
  renewalEndDate: string;
  gracePeriodDays: number;
  body: RenewPolicyBody;
}) {
  const policyNumber = generatePolicyNumber();

  const { data, error } = await args.adminClient
    .from("insurance_policy_records")
    .insert({
      user_id: args.userId,
      proposal_id: null,
      quote_id: args.renewalQuote.id,
      product_id: args.currentPolicy.product_id,
      vehicle_id: args.currentPolicy.vehicle_id,

      policy_number: policyNumber,
      policy_status: "pending_approval",
      issuance_status: "pending",
      renewal_status: "not_due",

      policy_type:
        args.currentPolicy.policy_type,
      policy_category:
        args.currentPolicy.policy_category,

      insurer_name:
        args.currentPolicy.insurer_name,
      branch_code:
        args.currentPolicy.branch_code,
      intermediary_code:
        args.currentPolicy.intermediary_code,

      insured_name:
        args.currentPolicy.insured_name,
      insured_email:
        args.currentPolicy.insured_email,
      insured_phone:
        args.currentPolicy.insured_phone,
      insured_address:
        args.currentPolicy.insured_address ?? {},

      vehicle_registration_number:
        args.currentPolicy.vehicle_registration_number,
      chassis_number:
        args.currentPolicy.chassis_number,
      engine_number:
        args.currentPolicy.engine_number,
      vin:
        args.currentPolicy.vin,
      vehicle_make:
        args.currentPolicy.vehicle_make,
      vehicle_model:
        args.currentPolicy.vehicle_model,
      vehicle_variant:
        args.currentPolicy.vehicle_variant,
      vehicle_year:
        args.currentPolicy.vehicle_year,
      vehicle_fuel_type:
        args.currentPolicy.vehicle_fuel_type,
      vehicle_usage_type:
        args.currentPolicy.vehicle_usage_type,

      policy_start_date:
        args.renewalStartDate,
      policy_end_date:
        args.renewalEndDate,

      idv:
        args.calculation.recommended_idv,
      total_premium:
        args.calculation.recommended_net_premium,
      net_premium:
        args.calculation.recommended_total_premium,
      tax_amount:
        args.calculation.recommended_tax_amount,
      discount_amount:
        args.calculation.recommended_discount_amount,
      ncb_percent:
        args.calculation.recommended_ncb_percent,
      ncb_discount_amount:
        args.calculation.recommended_discount_amount,

      compulsory_deductible:
        args.currentPolicy.compulsory_deductible,
      voluntary_deductible:
        args.currentPolicy.voluntary_deductible,

      coverage_details:
        validObject(args.body.coverage_changes) ??
        args.currentPolicy.coverage_details ??
        {},

      selected_addons:
        Array.isArray(args.body.selected_addons)
          ? args.body.selected_addons
          : args.currentPolicy.selected_addons ?? [],

      exclusions:
        args.currentPolicy.exclusions ?? [],

      endorsements_summary: [],

      grace_period_days:
        args.gracePeriodDays,
      grace_period_end_date:
        args.gracePeriodDays > 0
          ? addDays(
              args.renewalEndDate,
              args.gracePeriodDays
            )
          : null,

      previous_policy_id:
        args.currentPolicy.id,

      cancellation_status:
        "not_requested",

      digital_signature_status:
        "not_started",

      customer_portal_access: true,
      partner_portal_access:
        false,

      metadata: {
        ...(args.currentPolicy.metadata ?? {}),
        renewal_of_policy_id:
          args.currentPolicy.id,
        renewal_of_policy_number:
          args.currentPolicy.policy_number,
        renewal_quote_id:
          args.renewalQuote.id,
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Unable to create renewed policy."
    );
  }

  return data as PolicyRow;
}

async function createPaymentPlan(
  adminClient: any,
  userId: string,
  policyId: number,
  paymentPlan: NonNullable<
    RenewPolicyBody["payment_plan"]
  >
) {
  const installmentCount = clampInteger(
    paymentPlan.installment_count,
    1,
    60,
    1
  );

  const totalPayableAmount =
    cleanMoney(paymentPlan.total_payable_amount);

  if (totalPayableAmount === null) {
    throw new Error(
      "payment_plan.total_payable_amount is required."
    );
  }

  const { data: plan, error: planError } =
    await adminClient
      .from("insurance_policy_payment_plans")
      .insert({
        user_id: userId,
        policy_id: policyId,
        payment_plan_type:
          cleanText(
            paymentPlan.payment_plan_type,
            80
          ) || "full_payment",
        installment_count:
          installmentCount,
        total_payable_amount:
          totalPayableAmount,
        initial_payment_amount:
          cleanMoney(
            paymentPlan.initial_payment_amount
          ),
        financed_amount:
          cleanMoney(
            paymentPlan.financed_amount
          ),
        interest_rate:
          cleanNonNegativeNumber(
            paymentPlan.interest_rate
          ),
        processing_fee:
          cleanMoney(
            paymentPlan.processing_fee
          ),
        total_interest_amount:
          cleanMoney(
            paymentPlan.total_interest_amount
          ),
        plan_status: "active",
        start_date:
          normalizeOptionalDate(
            paymentPlan.start_date
          ),
        end_date:
          normalizeOptionalDate(
            paymentPlan.end_date
          ),
      })
      .select("*")
      .single();

  if (planError || !plan) {
    throw new Error(
      planError?.message ||
      "Unable to create renewal payment plan."
    );
  }

  const installments =
    paymentPlan.installments ?? [];

  if (!installments.length) return;

  const installmentTotal =
    installments.reduce(
      (sum, installment) =>
        sum +
        (cleanMoney(
          installment.installment_amount
        ) ?? 0),
      0
    );

  if (
    Math.abs(
      installmentTotal -
      totalPayableAmount
    ) > 0.01
  ) {
    throw new Error(
      "Installment amounts must equal total_payable_amount."
    );
  }

  const rows = installments.map(
    (installment) => ({
      user_id: userId,
      payment_plan_id: plan.id,
      policy_id: policyId,
      installment_number:
        positiveInteger(
          installment.installment_number
        ),
      due_date:
        normalizeRequiredDate(
          installment.due_date,
          "installment.due_date"
        ),
      installment_amount:
        cleanMoney(
          installment.installment_amount
        ),
      installment_status: "pending",
      retry_count: 0,
    })
  );

  const { error } = await adminClient
    .from("insurance_policy_installments")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createRenewalDocuments(
  adminClient: any,
  userId: string,
  policy: PolicyRow
) {
  const documents = [
    {
      document_type:
        "renewal_policy_schedule",
      document_number:
        policy.policy_number,
      document_title:
        "Renewal Policy Schedule",
      document_summary:
        "Renewal policy schedule generated for approval.",
    },
    {
      document_type:
        "renewal_notice",
      document_number:
        `${policy.policy_number}-NOTICE`,
      document_title:
        "Renewal Notice",
      document_summary:
        "Renewal notice generated for the customer.",
    },
    {
      document_type:
        "premium_receipt",
      document_number:
        `${policy.policy_number}-PREMIUM`,
      document_title:
        "Renewal Premium Receipt",
      document_summary:
        "Premium receipt placeholder pending payment completion.",
    },
  ].map((document) => ({
    user_id: userId,
    policy_id: policy.id,
    document_type:
      document.document_type,
    document_number:
      document.document_number,
    document_status: "generated",
    document_title:
      document.document_title,
    document_summary:
      document.document_summary,
    version_number:
      policy.policy_version,
    metadata: {
      policy_number:
        policy.policy_number,
      policy_status:
        policy.policy_status,
      renewal: true,
    },
  }));

  const { error } = await adminClient
    .from("insurance_policy_documents")
    .insert(documents);

  if (error) {
    throw new Error(error.message);
  }
}

async function createRenewalApproval(
  adminClient: any,
  userId: string,
  policyId: number,
  renewalId: number
) {
  const { error } = await adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: userId,
      policy_id: policyId,
      approval_type: "policy_renewal",
      approval_status: "pending",
      requested_by_role: "customer",
      requested_at:
        new Date().toISOString(),
      approval_notes:
        "Renewal requires authorized insurer approval.",
      metadata: {
        renewal_id: renewalId,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackRenewal(args: {
  adminClient: any;
  userId: string;
  renewalId: number;
  renewalQuoteId: number;
  renewedPolicyId: number | null;
  originalPolicyId: number;
}) {
  if (args.renewedPolicyId) {
    await args.adminClient
      .from("insurance_policy_records")
      .delete()
      .eq("id", args.renewedPolicyId)
      .eq("user_id", args.userId);
  }

  await args.adminClient
    .from("insurance_policy_renewals")
    .update({
      renewal_status: "due",
      decline_reason:
        "Renewal creation rolled back because a linked operation failed.",
    })
    .eq("id", args.renewalId)
    .eq("user_id", args.userId);

  await args.adminClient
    .from("insurance_quotes")
    .update({
      quote_status: "cancelled",
    })
    .eq("id", args.renewalQuoteId)
    .eq("user_id", args.userId);

  await args.adminClient
    .from("insurance_policy_records")
    .update({
      renewal_status: "due",
      renewed_policy_id: null,
    })
    .eq("id", args.originalPolicyId)
    .eq("user_id", args.userId);
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

function generatePolicyNumber() {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 10)
      .toUpperCase();

  return `MV-RN-${datePart}-${randomPart}`;
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

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.round(numeric)
    )
  );
}

function cleanText(
  value: unknown,
  limit = 8000
) {
  return typeof value === "string"
    ? value.trim().slice(0, limit)
    : "";
}

function cleanMoney(
  value: unknown
): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(
            value.replace(/[₹,\s]/g, "")
          )
        : NaN;

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanPercentage(
  value: unknown
): number | null {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(
    100,
    Math.max(0, numeric)
  );
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

function validObject(
  value: unknown
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeRequiredDate(
  value: unknown,
  fieldName: string
) {
  const normalized =
    normalizeOptionalDate(value);

  if (!normalized) {
    throw new Error(
      `${fieldName} is invalid.`
    );
  }

  return normalized;
}

function normalizeOptionalDate(
  value: unknown
) {
  if (!value) return null;

  const raw =
    String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(
    `${raw}T00:00:00.000Z`
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return raw;
}

function addDays(
  dateString: string,
  days: number
) {
  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function addYears(
  dateString: string,
  years: number
) {
  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  date.setUTCFullYear(
    date.getUTCFullYear() + years
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function addDaysTimestamp(
  dateString: string,
  days: number
) {
  return new Date(
    `${addDays(dateString, days)}T08:00:00.000Z`
  ).toISOString();
}

function roundMoney(
  value: number
) {
  return Math.round(value * 100) / 100;
}