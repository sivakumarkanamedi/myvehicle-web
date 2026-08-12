import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type CalculateNcbBody = {
  policy_id?: number | null;
  vehicle_id?: number | null;
  underwriting_case_id?: number | null;

  current_ncb_percent?: number | null;
  previous_policy_expiry_date?: string | null;

  claim_free_years?: number | null;
  claims_in_current_period?: number | null;

  transfer_requested?: boolean;
  transfer_from_policy_number?: string | null;
  transfer_certificate_number?: string | null;

  break_in_days?: number | null;

  insurer_override_percent?: number | null;
  override_reason?: string | null;

  metadata?: Record<string, unknown>;
};

type PolicyRow = {
  id: number;
  user_id: string;
  vehicle_id: number;

  policy_number: string;
  policy_status: string;

  policy_start_date: string;
  policy_end_date: string;

  ncb_percent: number | null;
  ncb_discount_amount: number;

  total_premium: number;
  net_premium: number;

  previous_policy_id: number | null;
  renewed_policy_id: number | null;

  insured_name: string;
};

type ClaimRow = {
  id: number;
  policy_id: number | null;
  vehicle_id: number | null;

  claim_status: string | null;
  incident_date: string | null;
  approved_claim_amount: number | null;
  settlement_amount: number | null;

  created_at: string;
};

type UnderwritingCaseRow = {
  id: number;
  user_id: string;

  policy_id: number | null;
  vehicle_id: number | null;

  recommended_ncb_percent: number | null;
  recommended_total_premium: number | null;

  overall_risk_score: number | null;
  overall_risk_band: string | null;
};

type NcbCalculation = {
  eligible: boolean;

  current_ncb_percent: number;
  recommended_ncb_percent: number;
  applied_ncb_percent: number;

  claim_free_years: number;
  claims_in_current_period: number;
  break_in_days: number;

  transfer_requested: boolean;
  transfer_eligible: boolean;

  ncb_discount_amount: number;

  eligibility_status:
    | "eligible"
    | "reduced"
    | "reset"
    | "manual_review"
    | "not_eligible";

  reasons: string[];
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
            "You must be signed in to calculate NCB.",
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
        {
          error:
            "Your session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as CalculateNcbBody;

    const policyId =
      positiveInteger(body.policy_id);

    const underwritingCaseId =
      positiveInteger(
        body.underwriting_case_id
      );

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

    const policy = policyId
      ? await loadOwnedPolicy(
          adminClient as any,
          policyId,
          user.id
        )
      : null;

    if (policyId && !policy) {
      return NextResponse.json(
        {
          error:
            "Policy was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const underwritingCase =
      underwritingCaseId
        ? await loadOwnedUnderwritingCase(
            adminClient as any,
            underwritingCaseId,
            user.id
          )
        : null;

    if (
      underwritingCaseId &&
      !underwritingCase
    ) {
      return NextResponse.json(
        {
          error:
            "Underwriting case was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const vehicleId =
      positiveInteger(body.vehicle_id) ??
      positiveInteger(policy?.vehicle_id) ??
      positiveInteger(
        underwritingCase?.vehicle_id
      );

    if (!vehicleId) {
      return NextResponse.json(
        {
          error:
            "vehicle_id could not be resolved.",
        },
        { status: 400 }
      );
    }

    const claims =
      await loadRelevantClaims(
        adminClient as any,
        user.id,
        vehicleId,
        policy
      );

    const calculation =
      calculateNcb({
        body,
        policy,
        underwritingCase,
        claims,
      });

    const ncbReference =
      generateNcbReference();

    const historyTableExists =
      await hasTable(
        adminClient as any,
        "insurance_ncb_history"
      );

    let ncbHistoryId: number | null = null;

    if (historyTableExists) {
      const { data, error } =
        await adminClient
          .from("insurance_ncb_history")
          .insert({
            user_id: user.id,
            policy_id:
              policy?.id ?? null,
            vehicle_id:
              vehicleId,
            underwriting_case_id:
              underwritingCase?.id ?? null,

            ncb_reference:
              ncbReference,

            current_ncb_percent:
              calculation.current_ncb_percent,

            recommended_ncb_percent:
              calculation.recommended_ncb_percent,

            applied_ncb_percent:
              calculation.applied_ncb_percent,

            claim_free_years:
              calculation.claim_free_years,

            claims_in_current_period:
              calculation.claims_in_current_period,

            break_in_days:
              calculation.break_in_days,

            transfer_requested:
              calculation.transfer_requested,

            transfer_eligible:
              calculation.transfer_eligible,

            eligibility_status:
              calculation.eligibility_status,

            ncb_discount_amount:
              calculation.ncb_discount_amount,

            reasons:
              calculation.reasons,

            warnings:
              calculation.warnings,

            recommendations:
              calculation.recommendations,

            transfer_from_policy_number:
              cleanNullableText(
                body.transfer_from_policy_number,
                120
              ),

            transfer_certificate_number:
              cleanNullableText(
                body.transfer_certificate_number,
                120
              ),

            override_percent:
              cleanPercentage(
                body.insurer_override_percent
              ),

            override_reason:
              cleanNullableText(
                body.override_reason,
                2000
              ),

            metadata:
              validObject(body.metadata) ?? {},

            calculated_at:
              new Date().toISOString(),
          })
          .select("id")
          .single();

      if (error || !data) {
        throw new Error(
          error?.message ||
            "Unable to save NCB history."
        );
      }

      ncbHistoryId =
        Number(data.id);
    }

    if (policy) {
      const { error } =
        await adminClient
          .from("insurance_policy_records")
          .update({
            ncb_percent:
              calculation.applied_ncb_percent,

            ncb_discount_amount:
              calculation.ncb_discount_amount,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", policy.id)
          .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    if (underwritingCase) {
      const { error } =
        await adminClient
          .from("insurance_underwriting_cases")
          .update({
            recommended_ncb_percent:
              calculation
                .applied_ncb_percent,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            underwritingCase.id
          )
          .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json({
      success: true,

      ncb_history_id:
        ncbHistoryId,

      ncb_reference:
        ncbReference,

      policy_id:
        policy?.id ?? null,

      underwriting_case_id:
        underwritingCase?.id ?? null,

      vehicle_id:
        vehicleId,

      calculation,

      message:
        historyTableExists
          ? "NCB calculated and saved successfully."
          : "NCB calculated successfully. Create insurance_ncb_history to persist records.",
    });
  } catch (error) {
    console.error(
      "NCB calculation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate NCB.",
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
  const { data, error } =
    await adminClient
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

async function loadOwnedUnderwritingCase(
  adminClient: any,
  underwritingCaseId: number,
  userId: string
) {
  const { data, error } =
    await adminClient
      .from("insurance_underwriting_cases")
      .select("*")
      .eq("id", underwritingCaseId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | UnderwritingCaseRow
    | null;
}

async function loadRelevantClaims(
  adminClient: any,
  userId: string,
  vehicleId: number,
  policy: PolicyRow | null
) {
  let query =
    adminClient
      .from("insurance_claims")
      .select(
        `
          id,
          policy_id,
          vehicle_id,
          claim_status,
          incident_date,
          approved_claim_amount,
          settlement_amount,
          created_at
        `
      )
      .eq("user_id", userId)
      .eq("vehicle_id", vehicleId);

  if (policy) {
    query = query.gte(
      "incident_date",
      policy.policy_start_date
    );
  }

  const { data, error } =
    await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClaimRow[];
}

function calculateNcb(args: {
  body: CalculateNcbBody;
  policy: PolicyRow | null;
  underwritingCase:
    | UnderwritingCaseRow
    | null;
  claims: ClaimRow[];
}): NcbCalculation {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const currentNcbPercent =
    cleanPercentage(
      args.body.current_ncb_percent
    ) ??
    cleanPercentage(
      args.policy?.ncb_percent
    ) ??
    cleanPercentage(
      args.underwritingCase
        ?.recommended_ncb_percent
    ) ??
    0;

  const explicitClaimCount =
    cleanNonNegativeInteger(
      args.body.claims_in_current_period
    );

  const claimsInCurrentPeriod =
    explicitClaimCount ??
    args.claims.filter((claim) =>
      isClaimAffectingNcb(claim)
    ).length;

  const explicitClaimFreeYears =
    cleanNonNegativeInteger(
      args.body.claim_free_years
    );

  const claimFreeYears =
    explicitClaimFreeYears ??
    inferClaimFreeYears(
      currentNcbPercent
    );

  const breakInDays =
    cleanNonNegativeInteger(
      args.body.break_in_days
    ) ??
    calculateBreakInDays(
      args.body
        .previous_policy_expiry_date ??
      args.policy?.policy_end_date ??
      null
    );

  const transferRequested =
    Boolean(
      args.body.transfer_requested
    );

  const transferEligible =
    transferRequested
      ? (
          Boolean(
            cleanText(
              args.body
                .transfer_certificate_number,
              120
            )
          ) &&
          breakInDays <= 90
        )
      : false;

  let recommendedNcbPercent =
    currentNcbPercent;

  let eligibilityStatus:
    NcbCalculation["eligibility_status"] =
      "eligible";

  if (claimsInCurrentPeriod > 0) {
    recommendedNcbPercent = 0;
    eligibilityStatus = "reset";

    reasons.push(
      `${claimsInCurrentPeriod} claim(s) affecting NCB were found in the current period.`
    );

    recommendations.push(
      "Reset NCB to 0% unless an authorised insurer confirms an exception."
    );
  } else if (breakInDays > 90) {
    recommendedNcbPercent = 0;
    eligibilityStatus =
      "not_eligible";

    reasons.push(
      `Policy break of ${breakInDays} days exceeds the standard continuity window.`
    );

    warnings.push(
      "NCB continuity may require insurer-specific manual validation."
    );
  } else {
    recommendedNcbPercent =
      nextNcbSlab(
        currentNcbPercent,
        claimFreeYears
      );

    reasons.push(
      "No NCB-affecting claims were found for the current period."
    );

    reasons.push(
      `Claim-free history considered: ${claimFreeYears} year(s).`
    );
  }

  if (transferRequested) {
    if (transferEligible) {
      reasons.push(
        "NCB transfer request has a transfer certificate and is within the continuity period."
      );
    } else {
      eligibilityStatus =
        "manual_review";

      warnings.push(
        "NCB transfer requires certificate and continuity validation."
      );

      recommendations.push(
        "Send the transfer request for manual insurer review."
      );
    }
  }

  const overridePercent =
    cleanPercentage(
      args.body.insurer_override_percent
    );

  if (
    overridePercent !== null
  ) {
    if (
      !cleanText(
        args.body.override_reason,
        2000
      )
    ) {
      warnings.push(
        "An insurer override was supplied without an override reason."
      );
    }

    recommendedNcbPercent =
      overridePercent;

    eligibilityStatus =
      "manual_review";

    reasons.push(
      `Insurer override applied at ${overridePercent}%.`
    );
  }

  const appliedNcbPercent =
    Math.min(
      50,
      Math.max(
        0,
        recommendedNcbPercent
      )
    );

  const premiumBase =
    cleanMoney(
      args.policy?.net_premium
    ) ??
    cleanMoney(
      args.underwritingCase
        ?.recommended_total_premium
    ) ??
    0;

  const ncbDiscountAmount =
    roundMoney(
      premiumBase *
        (
          appliedNcbPercent /
          100
        )
    );

  if (!recommendations.length) {
    recommendations.push(
      "Apply the recommended NCB after insurer verification."
    );
  }

  return {
    eligible:
      eligibilityStatus ===
        "eligible",

    current_ncb_percent:
      currentNcbPercent,

    recommended_ncb_percent:
      recommendedNcbPercent,

    applied_ncb_percent:
      appliedNcbPercent,

    claim_free_years:
      claimFreeYears,

    claims_in_current_period:
      claimsInCurrentPeriod,

    break_in_days:
      breakInDays,

    transfer_requested:
      transferRequested,

    transfer_eligible:
      transferEligible,

    ncb_discount_amount:
      ncbDiscountAmount,

    eligibility_status:
      eligibilityStatus,

    reasons,
    warnings,
    recommendations,
  };
}

function isClaimAffectingNcb(
  claim: ClaimRow
) {
  const status =
    cleanText(
      claim.claim_status,
      80
    ).toLowerCase();

  return [
    "approved",
    "settled",
    "paid",
    "completed",
  ].includes(status);
}

function inferClaimFreeYears(
  currentNcbPercent: number
) {
  if (currentNcbPercent >= 50) {
    return 5;
  }

  if (currentNcbPercent >= 45) {
    return 4;
  }

  if (currentNcbPercent >= 35) {
    return 3;
  }

  if (currentNcbPercent >= 25) {
    return 2;
  }

  if (currentNcbPercent >= 20) {
    return 1;
  }

  return 0;
}

function nextNcbSlab(
  currentNcbPercent: number,
  claimFreeYears: number
) {
  if (claimFreeYears >= 5) {
    return 50;
  }

  if (currentNcbPercent >= 45) {
    return 50;
  }

  if (currentNcbPercent >= 35) {
    return 45;
  }

  if (currentNcbPercent >= 25) {
    return 35;
  }

  if (currentNcbPercent >= 20) {
    return 25;
  }

  return 20;
}

function calculateBreakInDays(
  previousExpiryDate:
    | string
    | null
) {
  const expiry =
    normalizeOptionalDate(
      previousExpiryDate
    );

  if (!expiry) {
    return 0;
  }

  const expiryDate =
    new Date(
      `${expiry}T00:00:00.000Z`
    );

  const today =
    new Date();

  const difference =
    Math.floor(
      (
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate()
        ) -
        expiryDate.getTime()
      ) /
      86400000
    );

  return Math.max(
    0,
    difference
  );
}

async function hasTable(
  adminClient: any,
  tableName: string
) {
  const { error } =
    await adminClient
      .from(tableName)
      .select("*")
      .limit(1);

  return !error;
}

function generateNcbReference() {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

  return (
    `NCB-${datePart}-` +
    randomPart
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
    ? value
        .trim()
        .slice(0, limit)
    : "";
}

function cleanNullableText(
  value: unknown,
  limit = 8000
) {
  const cleaned =
    cleanText(
      value,
      limit
    );

  return cleaned || null;
}

function cleanMoney(
  value: unknown
): number | null {
  const numeric =
    typeof value ===
    "number"
      ? value
      : typeof value ===
          "string"
        ? Number(
            value.replace(
              /[₹,\s]/g,
              ""
            )
          )
        : NaN;

  return Number.isFinite(
    numeric
  ) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanPercentage(
  value: unknown
): number | null {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numeric
    )
  );
}

function cleanNonNegativeInteger(
  value: unknown
): number | null {
  const numeric =
    Number(value);

  return Number.isInteger(
    numeric
  ) &&
    numeric >= 0
    ? numeric
    : null;
}

function normalizeOptionalDate(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      raw
    )
  ) {
    return null;
  }

  const date =
    new Date(
      `${raw}T00:00:00.000Z`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : raw;
}

function validObject(
  value: unknown
): Record<
  string,
  unknown
> | null {
  return typeof value ===
    "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<
        string,
        unknown
      >
    : null;
}

function roundMoney(
  value: number
) {
  return (
    Math.round(
      value * 100
    ) / 100
  );
}