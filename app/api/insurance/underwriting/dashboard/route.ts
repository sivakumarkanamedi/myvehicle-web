import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type UnderwritingCaseRow = {
  id: number;
  user_id: string;
  proposal_id: number | null;
  quote_id: number | null;
  policy_id: number | null;
  vehicle_id: number | null;

  case_reference: string | null;

  underwriting_status: string;
  decision_status: string;
  referral_status: string;

  applicant_name: string | null;
  applicant_type: string;

  vehicle_registration_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;
  vehicle_year: number | null;
  vehicle_fuel_type: string | null;
  vehicle_usage_type: string | null;

  requested_policy_type: string | null;
  requested_idv: number | null;
  requested_total_premium: number | null;

  claim_count: number;
  settled_claim_count: number;
  rejected_claim_count: number;
  fraud_alert_count: number;

  vehicle_age_years: number | null;

  geographic_risk_score: number | null;
  vehicle_risk_score: number | null;
  driver_risk_score: number | null;
  claims_risk_score: number | null;
  fraud_risk_score: number | null;
  payment_risk_score: number | null;

  overall_risk_score: number | null;
  overall_risk_band: string | null;

  inspection_required: boolean;
  inspection_status: string;

  documents_complete: boolean;
  kyc_status: string;
  rc_validation_status: string;
  licence_validation_status: string;

  recommended_idv: number | null;
  recommended_base_premium: number | null;
  recommended_total_premium: number | null;
  recommended_ncb_percent: number | null;
  recommended_deductible: number | null;

  premium_loading_percent: number;
  premium_discount_percent: number;

  ai_summary: string | null;
  ai_risk_reasons: string[];
  ai_recommendations: string[];
  ai_confidence: number | null;

  submitted_at: string | null;
  assessed_at: string | null;
  decided_at: string | null;

  created_at: string;
  updated_at: string;
};

type ReferralRow = {
  id: number;
  underwriting_case_id: number;

  referral_reference: string | null;
  referral_type: string;
  referral_status: string;
  referral_priority: string;

  assigned_to_name: string | null;
  assigned_to_role: string | null;

  requested_at: string;
  reviewed_at: string | null;

  review_decision: string | null;
};

type InspectionRow = {
  id: number;
  underwriting_case_id: number | null;

  inspection_reference: string | null;
  inspection_status: string;
  inspection_result: string | null;
  inspection_score: number | null;

  existing_damage_detected: boolean;

  scheduled_at: string | null;
  completed_at: string | null;

  created_at: string;
};

type DecisionRow = {
  id: number;
  underwriting_case_id: number;

  decision_reference: string | null;
  decision_type: string;
  decision_status: string;

  approved_idv: number | null;
  approved_total_premium: number | null;
  approved_ncb_percent: number | null;
  approved_deductible: number | null;

  human_override: boolean;

  decided_by_name: string | null;
  decided_by_role: string | null;

  decided_at: string;
};

type DashboardCase = {
  case: UnderwritingCaseRow;
  latest_referral: ReferralRow | null;
  latest_inspection: InspectionRow | null;
  latest_decision: DecisionRow | null;

  flags: {
    high_risk: boolean;
    fraud_attention: boolean;
    inspection_pending: boolean;
    referral_pending: boolean;
    documents_incomplete: boolean;
    decision_overdue: boolean;
  };
};

export async function GET(request: NextRequest) {
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
            "You must be signed in to view the underwriting dashboard.",
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

    const status =
      cleanText(
        request.nextUrl.searchParams.get("status"),
        80
      );

    const riskBand =
      cleanText(
        request.nextUrl.searchParams.get("risk_band"),
        80
      );

    const referralStatus =
      cleanText(
        request.nextUrl.searchParams.get("referral_status"),
        80
      );

    const inspectionStatus =
      cleanText(
        request.nextUrl.searchParams.get("inspection_status"),
        80
      );

    const search =
      cleanText(
        request.nextUrl.searchParams.get("search"),
        250
      );

    const dateFrom =
      normalizeOptionalDate(
        request.nextUrl.searchParams.get("date_from")
      );

    const dateTo =
      normalizeOptionalDate(
        request.nextUrl.searchParams.get("date_to")
      );

    const limit = clampInteger(
      request.nextUrl.searchParams.get("limit"),
      1,
      200,
      100
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

    const cases = await loadCases({
      adminClient: adminClient as any,
      userId: user.id,
      status,
      riskBand,
      search,
      dateFrom,
      dateTo,
      limit,
    });

    if (!cases.length) {
      return NextResponse.json({
        success: true,
        generated_at: new Date().toISOString(),
        summary: emptySummary(),
        cases: [],
      });
    }

    const caseIds = cases.map((item) => item.id);

    const [referrals, inspections, decisions] = await Promise.all([
      loadReferrals(
        adminClient as any,
        user.id,
        caseIds,
        referralStatus
      ),
      loadInspections(
        adminClient as any,
        user.id,
        caseIds,
        inspectionStatus
      ),
      loadDecisions(
        adminClient as any,
        user.id,
        caseIds
      ),
    ]);

    const dashboardCases = cases.map((item) =>
      buildDashboardCase({
        item,
        referrals,
        inspections,
        decisions,
      })
    );

    const filteredCases = dashboardCases.filter((item) => {
      if (
        referralStatus &&
        item.latest_referral?.referral_status !== referralStatus
      ) {
        return false;
      }

      if (
        inspectionStatus &&
        item.latest_inspection?.inspection_status !== inspectionStatus
      ) {
        return false;
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      summary: buildSummary(filteredCases),
      cases: filteredCases,
    });
  } catch (error) {
    console.error(
      "Underwriting dashboard error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load underwriting dashboard.",
      },
      { status: 500 }
    );
  }
}

async function loadCases(args: {
  adminClient: any;
  userId: string;
  status: string;
  riskBand: string;
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  limit: number;
}) {
  let query = args.adminClient
    .from("insurance_underwriting_cases")
    .select("*")
    .eq("user_id", args.userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(args.limit);

  if (args.status) {
    query = query.eq(
      "underwriting_status",
      args.status
    );
  }

  if (args.riskBand) {
    query = query.eq(
      "overall_risk_band",
      args.riskBand
    );
  }

  if (args.dateFrom) {
    query = query.gte(
      "created_at",
      `${args.dateFrom}T00:00:00.000Z`
    );
  }

  if (args.dateTo) {
    query = query.lte(
      "created_at",
      `${args.dateTo}T23:59:59.999Z`
    );
  }

  if (args.search) {
    const safeSearch =
      args.search.replace(/[%_,]/g, "");

    query = query.or(
      [
        `case_reference.ilike.%${safeSearch}%`,
        `applicant_name.ilike.%${safeSearch}%`,
        `vehicle_registration_number.ilike.%${safeSearch}%`,
        `vehicle_make.ilike.%${safeSearch}%`,
        `vehicle_model.ilike.%${safeSearch}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UnderwritingCaseRow[];
}

async function loadReferrals(
  adminClient: any,
  userId: string,
  caseIds: number[],
  referralStatus: string
) {
  let query = adminClient
    .from("insurance_underwriting_referrals")
    .select(
      `
        id,
        underwriting_case_id,
        referral_reference,
        referral_type,
        referral_status,
        referral_priority,
        assigned_to_name,
        assigned_to_role,
        requested_at,
        reviewed_at,
        review_decision
      `
    )
    .eq("user_id", userId)
    .in("underwriting_case_id", caseIds)
    .order("requested_at", {
      ascending: false,
    });

  if (referralStatus) {
    query = query.eq(
      "referral_status",
      referralStatus
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ReferralRow[];
}

async function loadInspections(
  adminClient: any,
  userId: string,
  caseIds: number[],
  inspectionStatus: string
) {
  let query = adminClient
    .from("insurance_vehicle_inspections")
    .select(
      `
        id,
        underwriting_case_id,
        inspection_reference,
        inspection_status,
        inspection_result,
        inspection_score,
        existing_damage_detected,
        scheduled_at,
        completed_at,
        created_at
      `
    )
    .eq("user_id", userId)
    .in("underwriting_case_id", caseIds)
    .order("created_at", {
      ascending: false,
    });

  if (inspectionStatus) {
    query = query.eq(
      "inspection_status",
      inspectionStatus
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as InspectionRow[];
}

async function loadDecisions(
  adminClient: any,
  userId: string,
  caseIds: number[]
) {
  const { data, error } = await adminClient
    .from("insurance_underwriting_decisions")
    .select(
      `
        id,
        underwriting_case_id,
        decision_reference,
        decision_type,
        decision_status,
        approved_idv,
        approved_total_premium,
        approved_ncb_percent,
        approved_deductible,
        human_override,
        decided_by_name,
        decided_by_role,
        decided_at
      `
    )
    .eq("user_id", userId)
    .in("underwriting_case_id", caseIds)
    .order("decided_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DecisionRow[];
}

function buildDashboardCase(args: {
  item: UnderwritingCaseRow;
  referrals: ReferralRow[];
  inspections: InspectionRow[];
  decisions: DecisionRow[];
}): DashboardCase {
  const latestReferral =
    args.referrals.find(
      (referral) =>
        referral.underwriting_case_id ===
        args.item.id
    ) ?? null;

  const latestInspection =
    args.inspections.find(
      (inspection) =>
        inspection.underwriting_case_id ===
        args.item.id
    ) ?? null;

  const latestDecision =
    args.decisions.find(
      (decision) =>
        decision.underwriting_case_id ===
        args.item.id
    ) ?? null;

  const decisionOverdue =
    !latestDecision &&
    ![
      "approved",
      "approved_with_conditions",
      "declined",
      "cancelled",
    ].includes(
      args.item.underwriting_status
    ) &&
    hoursSince(
      args.item.assessed_at ??
      args.item.created_at
    ) >= 24;

  return {
    case: args.item,
    latest_referral:
      latestReferral,
    latest_inspection:
      latestInspection,
    latest_decision:
      latestDecision,

    flags: {
      high_risk:
        numberOrZero(
          args.item.overall_risk_score
        ) >= 60,

      fraud_attention:
        args.item.fraud_alert_count > 0 ||
        numberOrZero(
          args.item.fraud_risk_score
        ) >= 60,

      inspection_pending:
        args.item.inspection_required &&
        ![
          "approved",
          "completed",
        ].includes(
          args.item.inspection_status
        ),

      referral_pending:
        Boolean(
          latestReferral &&
          [
            "pending",
            "assigned",
            "reviewing",
          ].includes(
            latestReferral.referral_status
          )
        ),

      documents_incomplete:
        !args.item.documents_complete,

      decision_overdue:
        decisionOverdue,
    },
  };
}

function buildSummary(
  items: DashboardCase[]
) {
  const riskScores = items
    .map((item) =>
      numberOrNull(
        item.case.overall_risk_score
      )
    )
    .filter(
      (value): value is number =>
        value !== null
    );

  const premiums = items
    .map((item) =>
      numberOrZero(
        item.case
          .recommended_total_premium
      )
    );

  return {
    total_cases:
      items.length,

    pending_cases:
      items.filter((item) =>
        [
          "pending",
          "assessing",
          "inspection_pending",
          "referred",
        ].includes(
          item.case.underwriting_status
        )
      ).length,

    approved_cases:
      items.filter((item) =>
        [
          "approved",
          "approved_with_conditions",
        ].includes(
          item.case.underwriting_status
        )
      ).length,

    declined_cases:
      items.filter(
        (item) =>
          item.case.underwriting_status ===
          "declined"
      ).length,

    high_risk_cases:
      items.filter(
        (item) =>
          item.flags.high_risk
      ).length,

    fraud_attention_cases:
      items.filter(
        (item) =>
          item.flags.fraud_attention
      ).length,

    inspection_pending:
      items.filter(
        (item) =>
          item.flags.inspection_pending
      ).length,

    referral_pending:
      items.filter(
        (item) =>
          item.flags.referral_pending
      ).length,

    documents_incomplete:
      items.filter(
        (item) =>
          item.flags.documents_incomplete
      ).length,

    decision_overdue:
      items.filter(
        (item) =>
          item.flags.decision_overdue
      ).length,

    average_risk_score:
      riskScores.length
        ? round(
            riskScores.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / riskScores.length,
            2
          )
        : 0,

    total_recommended_premium:
      roundMoney(
        premiums.reduce(
          (sum, value) =>
            sum + value,
          0
        )
      ),

    approval_rate:
      items.length
        ? round(
            (
              items.filter((item) =>
                [
                  "approved",
                  "approved_with_conditions",
                ].includes(
                  item.case
                    .underwriting_status
                )
              ).length /
              items.length
            ) * 100,
            2
          )
        : 0,

    decline_rate:
      items.length
        ? round(
            (
              items.filter(
                (item) =>
                  item.case
                    .underwriting_status ===
                  "declined"
              ).length /
              items.length
            ) * 100,
            2
          )
        : 0,
  };
}

function emptySummary() {
  return {
    total_cases: 0,
    pending_cases: 0,
    approved_cases: 0,
    declined_cases: 0,
    high_risk_cases: 0,
    fraud_attention_cases: 0,
    inspection_pending: 0,
    referral_pending: 0,
    documents_incomplete: 0,
    decision_overdue: 0,
    average_risk_score: 0,
    total_recommended_premium: 0,
    approval_rate: 0,
    decline_rate: 0,
  };
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

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric =
    Number(value);

  if (!Number.isInteger(numeric)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      numeric
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

function normalizeOptionalDate(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(raw)
  ) {
    return null;
  }

  const date = new Date(
    `${raw}T00:00:00.000Z`
  );

  return Number.isNaN(date.getTime())
    ? null
    : raw;
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

function numberOrNull(
  value: unknown
) {
  const numeric =
    Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : null;
}

function roundMoney(
  value: number
) {
  return Math.round(
    value * 100
  ) / 100;
}

function round(
  value: number,
  decimals = 2
) {
  const factor =
    10 ** decimals;

  return Math.round(
    value * factor
  ) / factor;
}

function hoursSince(
  value: string
) {
  const timestamp =
    new Date(value).getTime();

  if (
    Number.isNaN(timestamp)
  ) {
    return 0;
  }

  return (
    Date.now() - timestamp
  ) / 3600000;
}