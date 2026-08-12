import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type ReviewReferralBody = {
  referral_id?: number;

  review_decision?:
    | "approve"
    | "approve_with_conditions"
    | "decline"
    | "request_more_information";

  review_notes?: string | null;

  approved_idv?: number | null;
  approved_total_premium?: number | null;
  approved_ncb_percent?: number | null;
  approved_deductible?: number | null;

  premium_loading_percent?: number | null;
  premium_discount_percent?: number | null;

  approved_addons?: Array<Record<string, unknown>>;
  coverage_restrictions?: Array<Record<string, unknown>>;
  exclusions?: Array<Record<string, unknown>>;

  assigned_to_name?: string | null;
  assigned_to_role?: string | null;

  human_override?: boolean;
  override_reason?: string | null;

  metadata?: Record<string, unknown>;
};

type ReferralRow = {
  id: number;
  user_id: string;
  underwriting_case_id: number;

  referral_reference: string | null;
  referral_type: string;
  referral_status: string;

  referral_reason: string;
  referral_priority: string;

  assigned_to_name: string | null;
  assigned_to_role: string | null;

  requested_at: string;
  reviewed_at: string | null;

  review_decision: string | null;
  review_notes: string | null;

  recommended_changes: Record<string, unknown>;
  approved_changes: Record<string, unknown>;

  created_at: string;
  updated_at: string;
};

type UnderwritingCaseRow = {
  id: number;
  user_id: string;

  policy_id: number | null;
  proposal_id: number | null;
  quote_id: number | null;
  vehicle_id: number | null;

  case_reference: string | null;

  underwriting_status: string;
  decision_status: string;
  referral_status: string;

  overall_risk_score: number | null;
  overall_risk_band: string | null;

  inspection_required: boolean;
  inspection_status: string;

  recommended_idv: number | null;
  recommended_base_premium: number | null;
  recommended_total_premium: number | null;
  recommended_ncb_percent: number | null;
  recommended_deductible: number | null;

  premium_loading_percent: number;
  premium_discount_percent: number;

  recommended_addons: Array<Record<string, unknown>>;
  coverage_restrictions: Array<Record<string, unknown>>;
  exclusions: Array<Record<string, unknown>>;

  ai_summary: string | null;
  ai_risk_reasons: string[];
  ai_recommendations: string[];

  decided_at: string | null;

  created_at: string;
  updated_at: string;
};

type DecisionValues = {
  approved_idv: number | null;
  approved_total_premium: number | null;
  approved_ncb_percent: number | null;
  approved_deductible: number | null;
  premium_loading_percent: number;
  premium_discount_percent: number;
  approved_addons: Array<Record<string, unknown>>;
  coverage_restrictions: Array<Record<string, unknown>>;
  exclusions: Array<Record<string, unknown>>;
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
            "You must be signed in to review an underwriting referral.",
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

    const body = (await request.json()) as ReviewReferralBody;

    const referralId = positiveInteger(body.referral_id);

    if (!referralId) {
      return NextResponse.json(
        { error: "referral_id is required." },
        { status: 400 }
      );
    }

    const reviewDecision = normalizeReviewDecision(
      body.review_decision
    );

    const reviewNotes = cleanText(
      body.review_notes,
      4000
    );

    if (!reviewNotes) {
      return NextResponse.json(
        { error: "review_notes is required." },
        { status: 400 }
      );
    }

    const reviewerName =
      cleanText(body.assigned_to_name, 250) ||
      user.email ||
      "Authorized Underwriter";

    const reviewerRole =
      cleanText(body.assigned_to_role, 120) ||
      "senior_underwriter";

    const humanOverride = Boolean(body.human_override);

    const overrideReason = humanOverride
      ? cleanText(body.override_reason, 2000)
      : "";

    if (humanOverride && !overrideReason) {
      return NextResponse.json(
        {
          error:
            "override_reason is required when human_override is true.",
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

    const referral = await loadOwnedReferral(
      adminClient as any,
      referralId,
      user.id
    );

    if (!referral) {
      return NextResponse.json(
        {
          error:
            "Referral was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const referralStateError = validateReferralState(
      referral
    );

    if (referralStateError) {
      return NextResponse.json(
        { error: referralStateError },
        { status: 409 }
      );
    }

    const underwritingCase = await loadOwnedCase(
      adminClient as any,
      referral.underwriting_case_id,
      user.id
    );

    if (!underwritingCase) {
      return NextResponse.json(
        {
          error:
            "Underwriting case linked to this referral was not found.",
        },
        { status: 404 }
      );
    }

    const decisionValues = resolveDecisionValues({
      underwritingCase,
      referral,
      body,
      reviewDecision,
    });

    const caseStatuses = resolveCaseStatuses(
      reviewDecision
    );

    const referralSnapshot =
      structuredCloneSafe(referral);

    const caseSnapshot =
      structuredCloneSafe(underwritingCase);

    let decisionId: number | null = null;

    try {
      const { error: referralUpdateError } =
        await adminClient
          .from("insurance_underwriting_referrals")
          .update({
            referral_status:
              caseStatuses.referral_status,

            assigned_to_name:
              reviewerName,

            assigned_to_role:
              reviewerRole,

            reviewed_at:
              reviewDecision ===
              "request_more_information"
                ? null
                : new Date().toISOString(),

            review_decision:
              reviewDecision,

            review_notes:
              reviewNotes,

            approved_changes:
              reviewDecision ===
              "request_more_information"
                ? {}
                : decisionValues,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", referral.id)
          .eq("user_id", user.id);

      if (referralUpdateError) {
        throw new Error(
          referralUpdateError.message
        );
      }

      const { error: caseUpdateError } =
        await adminClient
          .from("insurance_underwriting_cases")
          .update({
            underwriting_status:
              caseStatuses.underwriting_status,

            decision_status:
              caseStatuses.decision_status,

            referral_status:
              caseStatuses.referral_status,

            recommended_idv:
              decisionValues.approved_idv,

            recommended_total_premium:
              decisionValues.approved_total_premium,

            recommended_ncb_percent:
              decisionValues.approved_ncb_percent,

            recommended_deductible:
              decisionValues.approved_deductible,

            premium_loading_percent:
              decisionValues.premium_loading_percent,

            premium_discount_percent:
              decisionValues.premium_discount_percent,

            recommended_addons:
              decisionValues.approved_addons,

            coverage_restrictions:
              decisionValues.coverage_restrictions,

            exclusions:
              decisionValues.exclusions,

            decided_at:
              reviewDecision ===
              "request_more_information"
                ? null
                : new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", underwritingCase.id)
          .eq("user_id", user.id);

      if (caseUpdateError) {
        throw new Error(
          caseUpdateError.message
        );
      }

      if (
        reviewDecision !==
        "request_more_information"
      ) {
        const { data: decisionData, error: decisionError } =
          await adminClient
            .from("insurance_underwriting_decisions")
            .insert({
              user_id: user.id,
              underwriting_case_id:
                underwritingCase.id,

              decision_type:
                reviewDecision ===
                "approve_with_conditions"
                  ? "approve_with_conditions"
                  : reviewDecision === "decline"
                    ? "decline"
                    : "approve",

              decision_status: "final",

              approved_idv:
                decisionValues.approved_idv,

              approved_base_premium:
                underwritingCase
                  .recommended_base_premium,

              approved_total_premium:
                decisionValues
                  .approved_total_premium,

              approved_ncb_percent:
                decisionValues
                  .approved_ncb_percent,

              approved_deductible:
                decisionValues
                  .approved_deductible,

              premium_loading_percent:
                decisionValues
                  .premium_loading_percent,

              premium_discount_percent:
                decisionValues
                  .premium_discount_percent,

              approved_addons:
                decisionValues
                  .approved_addons,

              coverage_restrictions:
                decisionValues
                  .coverage_restrictions,

              exclusions:
                decisionValues.exclusions,

              decision_reason:
                referral.referral_reason,

              decision_notes:
                reviewNotes,

              decided_by_name:
                reviewerName,

              decided_by_role:
                reviewerRole,

              ai_recommendation_used: true,

              human_override:
                humanOverride,

              override_reason:
                humanOverride
                  ? overrideReason
                  : null,

              decided_at:
                new Date().toISOString(),
            })
            .select("id")
            .single();

        if (decisionError || !decisionData) {
          throw new Error(
            decisionError?.message ||
              "Unable to create underwriting decision."
          );
        }

        decisionId = Number(
          decisionData.id
        );
      }

      if (
        underwritingCase.policy_id &&
        [
          "approve",
          "approve_with_conditions",
        ].includes(reviewDecision)
      ) {
        await createPolicyApproval({
          adminClient: adminClient as any,
          userId: user.id,
          policyId:
            underwritingCase.policy_id,
          underwritingCaseId:
            underwritingCase.id,
          referralId:
            referral.id,
          decisionId,
          reviewDecision,
          reviewerName,
          reviewerRole,
          reviewNotes,
        });
      }

      await writeReferralAudit({
        adminClient: adminClient as any,
        userId: user.id,
        underwritingCase,
        referral,
        decisionId,
        reviewDecision,
        reviewerName,
        reviewerRole,
        reviewNotes,
        decisionValues,
        humanOverride,
        overrideReason:
          humanOverride
            ? overrideReason
            : null,
        metadata:
          validObject(body.metadata) ?? {},
      });

      return NextResponse.json({
        success: true,

        referral_id: referral.id,
        referral_reference:
          referral.referral_reference,

        underwriting_case_id:
          underwritingCase.id,

        case_reference:
          underwritingCase.case_reference,

        review_decision:
          reviewDecision,

        referral_status:
          caseStatuses.referral_status,

        underwriting_status:
          caseStatuses.underwriting_status,

        decision_status:
          caseStatuses.decision_status,

        decision_id:
          decisionId,

        approved_values:
          decisionValues,

        reviewer_name:
          reviewerName,

        reviewer_role:
          reviewerRole,

        human_override:
          humanOverride,

        message:
          reviewDecision === "approve"
            ? "Underwriting referral approved successfully."
            : reviewDecision ===
                "approve_with_conditions"
              ? "Underwriting referral approved with conditions."
              : reviewDecision ===
                  "decline"
                ? "Underwriting referral declined."
                : "More information requested for underwriting referral.",
      });
    } catch (operationError) {
      await rollbackReferralReview({
        adminClient: adminClient as any,
        userId: user.id,
        referralSnapshot,
        caseSnapshot,
        decisionId,
      });

      throw operationError;
    }
  } catch (error) {
    console.error(
      "Underwriting referral review error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to review underwriting referral.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedReferral(
  adminClient: any,
  referralId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_underwriting_referrals")
    .select("*")
    .eq("id", referralId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ReferralRow | null;
}

async function loadOwnedCase(
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

function validateReferralState(
  referral: ReferralRow
) {
  if (
    [
      "approved",
      "approved_with_conditions",
      "declined",
      "cancelled",
    ].includes(referral.referral_status)
  ) {
    return (
      `Referral cannot be reviewed while status is ` +
      `${referral.referral_status}.`
    );
  }

  return "";
}

function resolveDecisionValues(args: {
  underwritingCase: UnderwritingCaseRow;
  referral: ReferralRow;
  body: ReviewReferralBody;
  reviewDecision: string;
}): DecisionValues {
  const recommended =
    validObject(
      args.referral.recommended_changes
    ) ?? {};

  const approvedIdv =
    cleanMoney(args.body.approved_idv) ??
    cleanMoney(recommended.approved_idv) ??
    cleanMoney(recommended.recommended_idv) ??
    cleanMoney(
      args.underwritingCase
        .recommended_idv
    );

  const approvedTotalPremium =
    cleanMoney(
      args.body.approved_total_premium
    ) ??
    cleanMoney(
      recommended.approved_total_premium
    ) ??
    cleanMoney(
      recommended.recommended_total_premium
    ) ??
    cleanMoney(
      args.underwritingCase
        .recommended_total_premium
    );

  const approvedNcbPercent =
    cleanPercentage(
      args.body.approved_ncb_percent
    ) ??
    cleanPercentage(
      recommended.approved_ncb_percent
    ) ??
    cleanPercentage(
      recommended.recommended_ncb_percent
    ) ??
    cleanPercentage(
      args.underwritingCase
        .recommended_ncb_percent
    );

  const approvedDeductible =
    cleanMoney(
      args.body.approved_deductible
    ) ??
    cleanMoney(
      recommended.approved_deductible
    ) ??
    cleanMoney(
      recommended.recommended_deductible
    ) ??
    cleanMoney(
      args.underwritingCase
        .recommended_deductible
    );

  const premiumLoadingPercent =
    cleanPercentage(
      args.body.premium_loading_percent
    ) ??
    cleanPercentage(
      args.underwritingCase
        .premium_loading_percent
    ) ??
    0;

  const premiumDiscountPercent =
    cleanPercentage(
      args.body.premium_discount_percent
    ) ??
    cleanPercentage(
      args.underwritingCase
        .premium_discount_percent
    ) ??
    0;

  const isDeclined =
    args.reviewDecision === "decline";

  return {
    approved_idv:
      isDeclined ? null : approvedIdv,

    approved_total_premium:
      isDeclined
        ? null
        : approvedTotalPremium,

    approved_ncb_percent:
      isDeclined
        ? null
        : approvedNcbPercent,

    approved_deductible:
      isDeclined
        ? null
        : approvedDeductible,

    premium_loading_percent:
      isDeclined
        ? 0
        : premiumLoadingPercent,

    premium_discount_percent:
      isDeclined
        ? 0
        : premiumDiscountPercent,

    approved_addons:
      Array.isArray(
        args.body.approved_addons
      )
        ? args.body.approved_addons
        : args.underwritingCase
            .recommended_addons ?? [],

    coverage_restrictions:
      Array.isArray(
        args.body.coverage_restrictions
      )
        ? args.body.coverage_restrictions
        : args.underwritingCase
            .coverage_restrictions ?? [],

    exclusions:
      Array.isArray(args.body.exclusions)
        ? args.body.exclusions
        : args.underwritingCase
            .exclusions ?? [],
  };
}

function resolveCaseStatuses(
  reviewDecision: string
) {
  switch (reviewDecision) {
    case "approve":
      return {
        referral_status: "approved",
        underwriting_status: "approved",
        decision_status: "approved",
      };

    case "approve_with_conditions":
      return {
        referral_status:
          "approved_with_conditions",
        underwriting_status:
          "approved_with_conditions",
        decision_status:
          "approved_with_conditions",
      };

    case "decline":
      return {
        referral_status: "declined",
        underwriting_status: "declined",
        decision_status: "declined",
      };

    default:
      return {
        referral_status: "reviewing",
        underwriting_status: "referred",
        decision_status: "recommended",
      };
  }
}

async function createPolicyApproval(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  underwritingCaseId: number;
  referralId: number;
  decisionId: number | null;
  reviewDecision: string;
  reviewerName: string;
  reviewerRole: string;
  reviewNotes: string;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: args.userId,
      policy_id: args.policyId,

      approval_type:
        "underwriting_referral_approval",

      approval_status:
        args.reviewDecision ===
        "approve_with_conditions"
          ? "approved_with_conditions"
          : "approved",

      requested_by_role:
        "underwriting_referral",

      requested_at:
        new Date().toISOString(),

      approved_by_name:
        args.reviewerName,

      approved_by_role:
        args.reviewerRole,

      approved_at:
        new Date().toISOString(),

      approval_notes:
        args.reviewNotes,

      metadata: {
        underwriting_case_id:
          args.underwritingCaseId,

        referral_id:
          args.referralId,

        underwriting_decision_id:
          args.decisionId,

        review_decision:
          args.reviewDecision,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeReferralAudit(args: {
  adminClient: any;
  userId: string;
  underwritingCase: UnderwritingCaseRow;
  referral: ReferralRow;
  decisionId: number | null;
  reviewDecision: string;
  reviewerName: string;
  reviewerRole: string;
  reviewNotes: string;
  decisionValues: DecisionValues;
  humanOverride: boolean;
  overrideReason: string | null;
  metadata: Record<string, unknown>;
}) {
  const { error } = await args.adminClient
    .from("insurance_underwriting_audit_log")
    .insert({
      user_id: args.userId,

      underwriting_case_id:
        args.underwritingCase.id,

      referral_id:
        args.referral.id,

      decision_id:
        args.decisionId,

      action_type:
        "underwriting_referral_reviewed",

      action_status:
        args.reviewDecision,

      actor_type:
        "authorized_underwriter",

      actor_name:
        args.reviewerName,

      actor_reference:
        args.reviewerRole,

      previous_values: {
        referral_status:
          args.referral.referral_status,

        underwriting_status:
          args.underwritingCase
            .underwriting_status,

        decision_status:
          args.underwritingCase
            .decision_status,
      },

      new_values: {
        review_decision:
          args.reviewDecision,

        review_notes:
          args.reviewNotes,

        approved_values:
          args.decisionValues,

        human_override:
          args.humanOverride,

        override_reason:
          args.overrideReason,
      },

      metadata:
        args.metadata,
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackReferralReview(args: {
  adminClient: any;
  userId: string;
  referralSnapshot: ReferralRow;
  caseSnapshot: UnderwritingCaseRow;
  decisionId: number | null;
}) {
  const {
    id: _referralId,
    created_at: _referralCreatedAt,
    updated_at: _referralUpdatedAt,
    ...referralValues
  } = args.referralSnapshot;

  await args.adminClient
    .from("insurance_underwriting_referrals")
    .update({
      ...referralValues,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.referralSnapshot.id)
    .eq("user_id", args.userId);

  const {
    id: _caseId,
    created_at: _caseCreatedAt,
    updated_at: _caseUpdatedAt,
    ...caseValues
  } = args.caseSnapshot;

  await args.adminClient
    .from("insurance_underwriting_cases")
    .update({
      ...caseValues,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.caseSnapshot.id)
    .eq("user_id", args.userId);

  if (args.decisionId) {
    await args.adminClient
      .from("insurance_underwriting_decisions")
      .delete()
      .eq("id", args.decisionId)
      .eq("user_id", args.userId);
  }
}

function normalizeReviewDecision(
  value: unknown
) {
  const allowed = new Set([
    "approve",
    "approve_with_conditions",
    "decline",
    "request_more_information",
  ]);

  const normalized =
    cleanText(value, 80) ||
    "approve";

  return allowed.has(normalized)
    ? normalized
    : "approve";
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
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(
    100,
    Math.max(0, numeric)
  );
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