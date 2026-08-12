import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type UnderwritingDecisionBody = {
  underwriting_case_id?: number;

  decision_type?:
    | "approve"
    | "approve_with_conditions"
    | "refer"
    | "decline";

  approved_idv?: number | null;
  approved_base_premium?: number | null;
  approved_total_premium?: number | null;
  approved_ncb_percent?: number | null;
  approved_deductible?: number | null;

  premium_loading_percent?: number | null;
  premium_discount_percent?: number | null;

  approved_addons?: Array<Record<string, unknown>>;
  coverage_restrictions?: Array<Record<string, unknown>>;
  exclusions?: Array<Record<string, unknown>>;

  decision_reason?: string;
  decision_notes?: string | null;

  decided_by_name?: string | null;
  decided_by_role?: string | null;

  use_ai_recommendation?: boolean;
  human_override?: boolean;
  override_reason?: string | null;

  referral_id?: number | null;
  referral_notes?: string | null;

  issue_policy_approval?: boolean;
  metadata?: Record<string, unknown>;
};

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

  requested_idv: number | null;
  requested_total_premium: number | null;

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
  ai_confidence: number | null;

  submitted_at: string | null;
  assessed_at: string | null;
  decided_at: string | null;

  created_at: string;
  updated_at: string;
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

type InspectionRow = {
  id: number;
  user_id: string;
  underwriting_case_id: number | null;
  inspection_reference: string | null;
  inspection_status: string;
  inspection_result: string | null;
  inspection_score: number | null;
  existing_damage_detected: boolean;
  completed_at: string | null;
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
            "You must be signed in to make an underwriting decision.",
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

    const body = (await request.json()) as UnderwritingDecisionBody;

    const underwritingCaseId = positiveInteger(
      body.underwriting_case_id
    );

    if (!underwritingCaseId) {
      return NextResponse.json(
        { error: "underwriting_case_id is required." },
        { status: 400 }
      );
    }

    const decisionType = normalizeDecisionType(
      body.decision_type
    );

    const decisionReason = cleanText(
      body.decision_reason,
      2000
    );

    if (!decisionReason) {
      return NextResponse.json(
        { error: "decision_reason is required." },
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

    const underwritingCase = await loadOwnedCase(
      adminClient as any,
      underwritingCaseId,
      user.id
    );

    if (!underwritingCase) {
      return NextResponse.json(
        {
          error:
            "Underwriting case was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const existingDecisionError =
      validateDecisionEligibility(
        underwritingCase,
        decisionType
      );

    if (existingDecisionError) {
      return NextResponse.json(
        { error: existingDecisionError },
        { status: 409 }
      );
    }

    const inspection = await loadLatestInspection(
      adminClient as any,
      underwritingCase.id,
      user.id
    );

    const inspectionError = validateInspectionRequirement(
      underwritingCase,
      inspection,
      decisionType
    );

    if (inspectionError) {
      return NextResponse.json(
        { error: inspectionError },
        { status: 409 }
      );
    }

    const referral = await resolveReferral({
      adminClient: adminClient as any,
      userId: user.id,
      underwritingCase,
      referralId: positiveInteger(body.referral_id),
    });

    const reviewerName =
      cleanText(body.decided_by_name, 250) ||
      user.email ||
      "Authorized Underwriter";

    const reviewerRole =
      cleanText(body.decided_by_role, 120) ||
      "underwriter";

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

    const decisionValues = resolveDecisionValues({
      underwritingCase,
      body,
      decisionType,
    });

    const snapshot = structuredCloneSafe(
      underwritingCase
    );

    let decisionId: number | null = null;

    try {
      const { data: decisionData, error: decisionError } =
        await adminClient
          .from("insurance_underwriting_decisions")
          .insert({
            user_id: user.id,
            underwriting_case_id:
              underwritingCase.id,

            decision_type: decisionType,
            decision_status:
              decisionType === "refer"
                ? "provisional"
                : "final",

            approved_idv:
              decisionValues.approved_idv,
            approved_base_premium:
              decisionValues.approved_base_premium,
            approved_total_premium:
              decisionValues.approved_total_premium,
            approved_ncb_percent:
              decisionValues.approved_ncb_percent,
            approved_deductible:
              decisionValues.approved_deductible,

            premium_loading_percent:
              decisionValues.premium_loading_percent,
            premium_discount_percent:
              decisionValues.premium_discount_percent,

            approved_addons:
              decisionValues.approved_addons,
            coverage_restrictions:
              decisionValues.coverage_restrictions,
            exclusions:
              decisionValues.exclusions,

            decision_reason: decisionReason,
            decision_notes:
              cleanNullableText(
                body.decision_notes,
                4000
              ),

            decided_by_name: reviewerName,
            decided_by_role: reviewerRole,

            ai_recommendation_used:
              body.use_ai_recommendation !== false,
            human_override: humanOverride,
            override_reason:
              humanOverride
                ? overrideReason
                : null,

            decided_at:
              new Date().toISOString(),
          })
          .select("*")
          .single();

      if (decisionError || !decisionData) {
        throw new Error(
          decisionError?.message ||
            "Unable to create underwriting decision."
        );
      }

      decisionId = Number(decisionData.id);

      const caseStatuses = resolveCaseStatuses(
        decisionType
      );

      const { error: caseUpdateError } = await adminClient
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
          recommended_base_premium:
            decisionValues.approved_base_premium,
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
            decisionType === "refer"
              ? null
              : new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", underwritingCase.id)
        .eq("user_id", user.id);

      if (caseUpdateError) {
        throw new Error(caseUpdateError.message);
      }

      if (referral) {
        await updateReferral({
          adminClient: adminClient as any,
          userId: user.id,
          referral,
          decisionType,
          reviewerName,
          reviewerRole,
          reviewNotes:
            cleanNullableText(
              body.referral_notes,
              4000
            ) ??
            cleanNullableText(
              body.decision_notes,
              4000
            ),
          approvedChanges: decisionValues,
        });
      } else if (decisionType === "refer") {
        await createReferral({
          adminClient: adminClient as any,
          userId: user.id,
          underwritingCase,
          decisionReason,
          reviewerName,
          reviewerRole,
          decisionValues,
        });
      }

      if (
        body.issue_policy_approval !== false &&
        underwritingCase.policy_id &&
        ["approve", "approve_with_conditions"].includes(
          decisionType
        )
      ) {
        await createPolicyApproval({
          adminClient: adminClient as any,
          userId: user.id,
          policyId:
            underwritingCase.policy_id,
          underwritingCaseId:
            underwritingCase.id,
          decisionId,
          reviewerName,
          reviewerRole,
          decisionType,
          decisionReason,
        });
      }

      await writeUnderwritingAudit({
        adminClient: adminClient as any,
        userId: user.id,
        underwritingCase,
        decisionId,
        referralId: referral?.id ?? null,
        decisionType,
        reviewerName,
        reviewerRole,
        decisionReason,
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
        underwriting_case_id:
          underwritingCase.id,
        case_reference:
          underwritingCase.case_reference,
        decision_id: decisionId,
        decision_type: decisionType,
        underwriting_status:
          caseStatuses.underwriting_status,
        decision_status:
          caseStatuses.decision_status,
        referral_status:
          caseStatuses.referral_status,
        approved_values: decisionValues,
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        human_override: humanOverride,
        message:
          decisionType === "approve"
            ? "Underwriting case approved successfully."
            : decisionType === "approve_with_conditions"
              ? "Underwriting case approved with conditions."
              : decisionType === "refer"
                ? "Underwriting case referred for further review."
                : "Underwriting case declined.",
      });
    } catch (operationError) {
      await rollbackDecision({
        adminClient: adminClient as any,
        userId: user.id,
        underwritingCaseSnapshot: snapshot,
        decisionId,
      });

      throw operationError;
    }
  } catch (error) {
    console.error(
      "Underwriting decision error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process underwriting decision.",
      },
      { status: 500 }
    );
  }
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

async function loadLatestInspection(
  adminClient: any,
  underwritingCaseId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_vehicle_inspections")
    .select("*")
    .eq(
      "underwriting_case_id",
      underwritingCaseId
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as InspectionRow | null;
}

async function resolveReferral(args: {
  adminClient: any;
  userId: string;
  underwritingCase: UnderwritingCaseRow;
  referralId: number | null;
}) {
  let query = args.adminClient
    .from("insurance_underwriting_referrals")
    .select("*")
    .eq(
      "underwriting_case_id",
      args.underwritingCase.id
    )
    .eq("user_id", args.userId);

  if (args.referralId) {
    query = query.eq("id", args.referralId);
  } else {
    query = query
      .in("referral_status", [
        "pending",
        "assigned",
        "reviewing",
      ])
      .order("requested_at", {
        ascending: false,
      });
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ReferralRow | null;
}

function validateDecisionEligibility(
  underwritingCase: UnderwritingCaseRow,
  decisionType: string
) {
  if (
    [
      "approved",
      "approved_with_conditions",
      "declined",
      "cancelled",
    ].includes(
      underwritingCase.underwriting_status
    )
  ) {
    return (
      `Underwriting case cannot be processed while status is ` +
      `${underwritingCase.underwriting_status}.`
    );
  }

  if (
    decisionType === "approve" &&
    underwritingCase.overall_risk_band ===
      "decline"
  ) {
    return (
      "A decline-risk case cannot be approved without using human_override."
    );
  }

  return "";
}

function validateInspectionRequirement(
  underwritingCase: UnderwritingCaseRow,
  inspection: InspectionRow | null,
  decisionType: string
) {
  if (
    !underwritingCase.inspection_required ||
    ![
      "approve",
      "approve_with_conditions",
    ].includes(decisionType)
  ) {
    return "";
  }

  if (!inspection) {
    return (
      "Vehicle inspection is required before approval."
    );
  }

  if (
    ![
      "completed",
      "approved",
    ].includes(
      inspection.inspection_status
    )
  ) {
    return (
      "Vehicle inspection must be completed before approval."
    );
  }

  if (
    inspection.inspection_result === "rejected"
  ) {
    return (
      "Vehicle inspection result is rejected."
    );
  }

  return "";
}

function resolveDecisionValues(args: {
  underwritingCase: UnderwritingCaseRow;
  body: UnderwritingDecisionBody;
  decisionType: string;
}) {
  const approvedIdv =
    cleanMoney(args.body.approved_idv) ??
    cleanMoney(
      args.underwritingCase.recommended_idv
    ) ??
    cleanMoney(
      args.underwritingCase.requested_idv
    );

  const approvedBasePremium =
    cleanMoney(
      args.body.approved_base_premium
    ) ??
    cleanMoney(
      args.underwritingCase
        .recommended_base_premium
    ) ??
    cleanMoney(
      args.underwritingCase
        .requested_total_premium
    ) ??
    0;

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

  const approvedTotalPremium =
    cleanMoney(
      args.body.approved_total_premium
    ) ??
    cleanMoney(
      args.underwritingCase
        .recommended_total_premium
    ) ??
    roundMoney(
      approvedBasePremium *
        (1 + premiumLoadingPercent / 100) *
        (1 - premiumDiscountPercent / 100)
    );

  const approvedNcbPercent =
    cleanPercentage(
      args.body.approved_ncb_percent
    ) ??
    cleanPercentage(
      args.underwritingCase
        .recommended_ncb_percent
    ) ??
    0;

  const approvedDeductible =
    cleanMoney(
      args.body.approved_deductible
    ) ??
    cleanMoney(
      args.underwritingCase
        .recommended_deductible
    ) ??
    0;

  return {
    approved_idv:
      args.decisionType === "decline"
        ? null
        : approvedIdv,

    approved_base_premium:
      args.decisionType === "decline"
        ? null
        : approvedBasePremium,

    approved_total_premium:
      args.decisionType === "decline"
        ? null
        : approvedTotalPremium,

    approved_ncb_percent:
      args.decisionType === "decline"
        ? null
        : approvedNcbPercent,

    approved_deductible:
      args.decisionType === "decline"
        ? null
        : approvedDeductible,

    premium_loading_percent:
      args.decisionType === "decline"
        ? 0
        : premiumLoadingPercent,

    premium_discount_percent:
      args.decisionType === "decline"
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
        : args.underwritingCase.exclusions ?? [],
  };
}

function resolveCaseStatuses(
  decisionType: string
) {
  switch (decisionType) {
    case "approve":
      return {
        underwriting_status: "approved",
        decision_status: "approved",
        referral_status: "approved",
      };

    case "approve_with_conditions":
      return {
        underwriting_status:
          "approved_with_conditions",
        decision_status:
          "approved_with_conditions",
        referral_status:
          "approved_with_conditions",
      };

    case "decline":
      return {
        underwriting_status: "declined",
        decision_status: "declined",
        referral_status: "declined",
      };

    default:
      return {
        underwriting_status: "referred",
        decision_status: "recommended",
        referral_status: "pending",
      };
  }
}

async function updateReferral(args: {
  adminClient: any;
  userId: string;
  referral: ReferralRow;
  decisionType: string;
  reviewerName: string;
  reviewerRole: string;
  reviewNotes: string | null;
  approvedChanges: Record<string, unknown>;
}) {
  const referralStatus =
    args.decisionType === "approve"
      ? "approved"
      : args.decisionType ===
          "approve_with_conditions"
        ? "approved_with_conditions"
        : args.decisionType === "decline"
          ? "declined"
          : "reviewing";

  const { error } = await args.adminClient
    .from("insurance_underwriting_referrals")
    .update({
      referral_status: referralStatus,
      assigned_to_name:
        args.reviewerName,
      assigned_to_role:
        args.reviewerRole,
      reviewed_at:
        args.decisionType === "refer"
          ? null
          : new Date().toISOString(),
      review_decision:
        args.decisionType,
      review_notes:
        args.reviewNotes,
      approved_changes:
        args.approvedChanges,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.referral.id)
    .eq("user_id", args.userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function createReferral(args: {
  adminClient: any;
  userId: string;
  underwritingCase: UnderwritingCaseRow;
  decisionReason: string;
  reviewerName: string;
  reviewerRole: string;
  decisionValues: Record<string, unknown>;
}) {
  const { error } = await args.adminClient
    .from("insurance_underwriting_referrals")
    .insert({
      user_id: args.userId,
      underwriting_case_id:
        args.underwritingCase.id,
      referral_type:
        "manual_underwriting",
      referral_status: "pending",
      referral_reason:
        args.decisionReason,
      referral_priority:
        numberOrZero(
          args.underwritingCase
            .overall_risk_score
        ) >= 75
          ? "high"
          : "medium",
      assigned_to_name:
        args.reviewerName,
      assigned_to_role:
        args.reviewerRole,
      requested_at:
        new Date().toISOString(),
      recommended_changes:
        args.decisionValues,
      approved_changes: {},
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function createPolicyApproval(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  underwritingCaseId: number;
  decisionId: number;
  reviewerName: string;
  reviewerRole: string;
  decisionType: string;
  decisionReason: string;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: args.userId,
      policy_id: args.policyId,
      approval_type:
        "underwriting_approval",
      approval_status:
        args.decisionType ===
          "approve_with_conditions"
          ? "approved_with_conditions"
          : "approved",
      requested_by_role:
        "underwriting_engine",
      requested_at:
        new Date().toISOString(),
      approved_by_name:
        args.reviewerName,
      approved_by_role:
        args.reviewerRole,
      approved_at:
        new Date().toISOString(),
      approval_notes:
        args.decisionReason,
      metadata: {
        underwriting_case_id:
          args.underwritingCaseId,
        underwriting_decision_id:
          args.decisionId,
        decision_type:
          args.decisionType,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeUnderwritingAudit(args: {
  adminClient: any;
  userId: string;
  underwritingCase: UnderwritingCaseRow;
  decisionId: number;
  referralId: number | null;
  decisionType: string;
  reviewerName: string;
  reviewerRole: string;
  decisionReason: string;
  decisionValues: Record<string, unknown>;
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
        args.referralId,
      decision_id:
        args.decisionId,
      action_type:
        "underwriting_decision_recorded",
      action_status:
        args.decisionType,
      actor_type:
        "authorized_underwriter",
      actor_name:
        args.reviewerName,
      actor_reference:
        args.reviewerRole,

      previous_values: {
        underwriting_status:
          args.underwritingCase
            .underwriting_status,
        decision_status:
          args.underwritingCase
            .decision_status,
        referral_status:
          args.underwritingCase
            .referral_status,
      },

      new_values: {
        decision_type:
          args.decisionType,
        approved_values:
          args.decisionValues,
        decision_reason:
          args.decisionReason,
        human_override:
          args.humanOverride,
        override_reason:
          args.overrideReason,
      },

      metadata: args.metadata,
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackDecision(args: {
  adminClient: any;
  userId: string;
  underwritingCaseSnapshot:
    UnderwritingCaseRow;
  decisionId: number | null;
}) {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...caseValues
  } = args.underwritingCaseSnapshot;

  await args.adminClient
    .from("insurance_underwriting_cases")
    .update({
      ...caseValues,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      args.underwritingCaseSnapshot.id
    )
    .eq("user_id", args.userId);

  if (args.decisionId) {
    await args.adminClient
      .from("insurance_underwriting_decisions")
      .delete()
      .eq("id", args.decisionId)
      .eq("user_id", args.userId);
  }
}

function normalizeDecisionType(
  value: unknown
) {
  const allowed = new Set([
    "approve",
    "approve_with_conditions",
    "refer",
    "decline",
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
  const cleaned =
    cleanText(value, limit);

  return cleaned || null;
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

function numberOrZero(
  value: unknown
) {
  const numeric =
    Number(value ?? 0);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function roundMoney(
  value: number
) {
  return Math.round(
    value * 100
  ) / 100;
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