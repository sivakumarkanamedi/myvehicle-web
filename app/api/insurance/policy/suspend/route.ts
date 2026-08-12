import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type SuspendPolicyBody = {
  policy_id?: number;

  action?: "suspend" | "reinstate";

  suspension_type?:
    | "temporary"
    | "non_payment"
    | "fraud_review"
    | "document_issue"
    | "vehicle_not_in_use"
    | "regulatory_hold"
    | "other";

  suspension_reason?: string;
  effective_date?: string | null;
  expected_reinstatement_date?: string | null;

  premium_adjustment_amount?: number | null;
  premium_adjustment_reason?: string | null;

  approval_notes?: string | null;

  supporting_documents?: Array<{
    document_type: string;
    document_name?: string | null;
    storage_path?: string | null;
    metadata?: Record<string, unknown>;
  }>;

  metadata?: Record<string, unknown>;
};

type PolicyRow = {
  id: number;
  user_id: string;
  policy_number: string;
  insured_name: string;
  policy_version: number;

  policy_status: string;
  issuance_status: string;
  renewal_status: string;

  policy_start_date: string;
  policy_end_date: string;

  total_premium: number;
  net_premium: number;
  tax_amount: number;

  digital_signature_status: string;
  signed_at: string | null;

  cancellation_status: string;

  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};

type PolicyActionResult = {
  action: "suspend" | "reinstate";
  policy_status: string;
  endorsement_status: string;
  approval_required: boolean;
  effective_date: string;
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
            "You must be signed in to suspend or reinstate a policy.",
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

    const body = (await request.json()) as SuspendPolicyBody;

    const policyId = positiveInteger(body.policy_id);
    const action =
      body.action === "reinstate" ? "reinstate" : "suspend";

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
        {
          error:
            "Policy was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const eligibilityError =
      validateActionEligibility(policy, action);

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError },
        { status: 409 }
      );
    }

    const effectiveDate = body.effective_date
      ? normalizeRequiredDate(
          body.effective_date,
          "effective_date"
        )
      : new Date().toISOString().slice(0, 10);

    const dateError = validateEffectiveDate(
      policy,
      effectiveDate
    );

    if (dateError) {
      return NextResponse.json(
        { error: dateError },
        { status: 400 }
      );
    }

    const suspensionReason =
      action === "suspend"
        ? cleanText(body.suspension_reason, 2000)
        : cleanText(
            body.suspension_reason,
            2000
          ) || "Policy reinstatement requested.";

    if (action === "suspend" && !suspensionReason) {
      return NextResponse.json(
        {
          error:
            "suspension_reason is required when suspending a policy.",
        },
        { status: 400 }
      );
    }

    const suspensionType =
      normalizeSuspensionType(body.suspension_type);

    const expectedReinstatementDate =
      normalizeOptionalDate(
        body.expected_reinstatement_date
      );

    if (
      expectedReinstatementDate &&
      new Date(expectedReinstatementDate).getTime() <
        new Date(effectiveDate).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "expected_reinstatement_date cannot be before effective_date.",
        },
        { status: 400 }
      );
    }

    const premiumAdjustmentAmount =
      cleanSignedMoney(body.premium_adjustment_amount) ?? 0;

    const approvalRequired =
      action === "suspend" ||
      premiumAdjustmentAmount !== 0 ||
      ["fraud_review", "regulatory_hold"].includes(
        suspensionType
      );

    const endorsement = await createPolicyEndorsement({
      adminClient: adminClient as any,
      userId: user.id,
      policy,
      action,
      suspensionType,
      suspensionReason,
      effectiveDate,
      expectedReinstatementDate,
      premiumAdjustmentAmount,
      premiumAdjustmentReason:
        cleanNullableText(
          body.premium_adjustment_reason,
          2000
        ),
      approvalRequired,
      metadata: validObject(body.metadata) ?? {},
    });

    const previousMetadata =
      validObject(policy.metadata) ?? {};

    const nextMetadata = {
      ...previousMetadata,
      suspension: {
        action,
        suspension_type: suspensionType,
        suspension_reason: suspensionReason,
        effective_date: effectiveDate,
        expected_reinstatement_date:
          expectedReinstatementDate,
        premium_adjustment_amount:
          premiumAdjustmentAmount,
        endorsement_id: endorsement.id,
        endorsement_reference:
          endorsement.endorsement_reference,
        requested_at: new Date().toISOString(),
      },
    };

    const result = buildActionResult({
      action,
      approvalRequired,
      effectiveDate,
    });

    try {
      const { error: policyUpdateError } =
        await adminClient
          .from("insurance_policy_records")
          .update({
            policy_status: result.policy_status,
            metadata: nextMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", policy.id)
          .eq("user_id", user.id);

      if (policyUpdateError) {
        throw new Error(policyUpdateError.message);
      }

      if (approvalRequired) {
        await createApprovalRequest({
          adminClient: adminClient as any,
          userId: user.id,
          policyId: policy.id,
          endorsementId: endorsement.id,
          action,
          suspensionReason,
          approvalNotes: cleanNullableText(
            body.approval_notes,
            2000
          ),
        });
      } else {
        await adminClient
          .from("insurance_policy_endorsements")
          .update({
            endorsement_status: "approved",
            approved_at: new Date().toISOString(),
            approved_values: {
              policy_status: result.policy_status,
            },
          })
          .eq("id", endorsement.id);
      }

      await createActionDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        action,
        effectiveDate,
        suspensionReason,
        endorsement,
      });

      await createSupportingDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        policyId: policy.id,
        documents: body.supporting_documents ?? [],
      });

      await writeAuditLog({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        action,
        effectiveDate,
        suspensionType,
        suspensionReason,
        premiumAdjustmentAmount,
        endorsementId: endorsement.id,
        approvalRequired,
      });

      return NextResponse.json({
        success: true,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        action,
        policy_status: result.policy_status,
        approval_required: result.approval_required,
        endorsement_id: endorsement.id,
        endorsement_reference:
          endorsement.endorsement_reference,
        endorsement_status:
          result.endorsement_status,
        effective_date: result.effective_date,
        expected_reinstatement_date:
          expectedReinstatementDate,
        premium_adjustment_amount:
          premiumAdjustmentAmount,
        message:
          action === "suspend"
            ? "Policy suspension request created successfully."
            : "Policy reinstatement request created successfully.",
      });
    } catch (linkedOperationError) {
      await rollbackPolicyAction({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsementId: endorsement.id,
      });

      throw linkedOperationError;
    }
  } catch (error) {
    console.error(
      "Policy suspension/reinstatement error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process the policy action.",
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

function validateActionEligibility(
  policy: PolicyRow,
  action: "suspend" | "reinstate"
) {
  if (policy.policy_status === "cancelled") {
    return "Cancelled policies cannot be suspended or reinstated.";
  }

  if (policy.policy_status === "expired") {
    return "Expired policies cannot be suspended or reinstated.";
  }

  if (policy.policy_status === "renewed") {
    return "Renewed policy records cannot be changed through this action.";
  }

  if (policy.cancellation_status === "requested") {
    return (
      "Policy action is blocked while a cancellation request is pending."
    );
  }

  if (
    action === "suspend" &&
    policy.policy_status === "suspended"
  ) {
    return "Policy is already suspended.";
  }

  if (
    action === "reinstate" &&
    policy.policy_status !== "suspended"
  ) {
    return "Only suspended policies can be reinstated.";
  }

  return "";
}

function validateEffectiveDate(
  policy: PolicyRow,
  effectiveDate: string
) {
  const start = new Date(
    `${policy.policy_start_date}T00:00:00.000Z`
  ).getTime();

  const end = new Date(
    `${policy.policy_end_date}T00:00:00.000Z`
  ).getTime();

  const effective = new Date(
    `${effectiveDate}T00:00:00.000Z`
  ).getTime();

  if (effective < start) {
    return "Effective date cannot be before policy start date.";
  }

  if (effective > end) {
    return "Effective date cannot be after policy end date.";
  }

  return "";
}

async function createPolicyEndorsement(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  action: "suspend" | "reinstate";
  suspensionType: string;
  suspensionReason: string;
  effectiveDate: string;
  expectedReinstatementDate: string | null;
  premiumAdjustmentAmount: number;
  premiumAdjustmentReason: string | null;
  approvalRequired: boolean;
  metadata: Record<string, unknown>;
}) {
  const endorsementStatus =
    args.approvalRequired ? "submitted" : "approved";

  const requestedPolicyStatus =
    args.action === "suspend"
      ? "suspended"
      : "active";

  const { data, error } = await args.adminClient
    .from("insurance_policy_endorsements")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      endorsement_type:
        args.action === "suspend"
          ? "policy_suspension"
          : "policy_reinstatement",
      endorsement_status: endorsementStatus,

      requested_changes: {
        action: args.action,
        policy_status: requestedPolicyStatus,
        suspension_type: args.suspensionType,
        suspension_reason: args.suspensionReason,
        effective_date: args.effectiveDate,
        expected_reinstatement_date:
          args.expectedReinstatementDate,
        premium_adjustment_amount:
          args.premiumAdjustmentAmount,
        premium_adjustment_reason:
          args.premiumAdjustmentReason,
      },

      previous_values: {
        policy_status: args.policy.policy_status,
        metadata: args.policy.metadata ?? {},
      },

      approved_values:
        args.approvalRequired
          ? {}
          : {
              policy_status: requestedPolicyStatus,
            },

      premium_difference:
        args.premiumAdjustmentAmount,
      tax_difference: 0,
      refund_amount:
        args.premiumAdjustmentAmount < 0
          ? Math.abs(args.premiumAdjustmentAmount)
          : 0,

      effective_date: args.effectiveDate,
      requested_at: new Date().toISOString(),
      approved_at:
        args.approvalRequired
          ? null
          : new Date().toISOString(),

      metadata: {
        ...args.metadata,
        approval_required:
          args.approvalRequired,
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create policy endorsement."
    );
  }

  return data;
}

async function createApprovalRequest(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  endorsementId: number;
  action: "suspend" | "reinstate";
  suspensionReason: string;
  approvalNotes: string | null;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: args.userId,
      policy_id: args.policyId,
      endorsement_id: args.endorsementId,
      approval_type:
        args.action === "suspend"
          ? "policy_suspension"
          : "policy_reinstatement",
      approval_status: "pending",
      requested_by_role: "customer",
      requested_at: new Date().toISOString(),
      approval_notes:
        args.approvalNotes ??
        args.suspensionReason,
      metadata: {
        action: args.action,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function createActionDocuments(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  action: "suspend" | "reinstate";
  effectiveDate: string;
  suspensionReason: string;
  endorsement: any;
}) {
  const title =
    args.action === "suspend"
      ? "Policy Suspension Notice"
      : "Policy Reinstatement Notice";

  const documentType =
    args.action === "suspend"
      ? "policy_suspension_notice"
      : "policy_reinstatement_notice";

  const suffix =
    args.action === "suspend"
      ? "SUSPEND"
      : "REINSTATE";

  const { error } = await args.adminClient
    .from("insurance_policy_documents")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      document_type: documentType,
      document_number:
        `${args.policy.policy_number}-${suffix}`,
      document_status: "generated",
      document_title: title,
      document_summary:
        `${title} generated for authorized review.`,
      version_number:
        Math.max(
          1,
          Number(args.policy.policy_version ?? 1)
        ),
      metadata: {
        endorsement_id:
          args.endorsement.id,
        endorsement_reference:
          args.endorsement.endorsement_reference,
        effective_date:
          args.effectiveDate,
        reason:
          args.suspensionReason,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function createSupportingDocuments(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  documents: NonNullable<
    SuspendPolicyBody["supporting_documents"]
  >;
}) {
  if (!args.documents.length) {
    return;
  }

  const rows = args.documents.map(
    (document, index) => ({
      user_id: args.userId,
      policy_id: args.policyId,
      document_type:
        cleanText(document.document_type, 120) ||
        "policy_action_supporting_document",
      document_number:
        `POLICY-ACTION-${args.policyId}-${index + 1}`,
      document_status: "uploaded",
      document_title:
        cleanNullableText(
          document.document_name,
          250
        ),
      document_summary:
        "Supporting document submitted with policy action.",
      storage_path:
        cleanNullableText(
          document.storage_path,
          2000
        ),
      version_number: 1,
      metadata:
        validObject(document.metadata) ?? {},
    })
  );

  const { error } = await args.adminClient
    .from("insurance_policy_documents")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function writeAuditLog(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  action: "suspend" | "reinstate";
  effectiveDate: string;
  suspensionType: string;
  suspensionReason: string;
  premiumAdjustmentAmount: number;
  endorsementId: number;
  approvalRequired: boolean;
}) {
  const targetStatus =
    args.action === "suspend"
      ? "suspended"
      : "active";

  const { error } = await args.adminClient
    .from("insurance_policy_audit_log")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      endorsement_id: args.endorsementId,
      action_type:
        args.action === "suspend"
          ? "policy_suspension_requested"
          : "policy_reinstatement_requested",
      action_status:
        args.approvalRequired
          ? "pending"
          : "approved",
      actor_type: "authenticated_user",
      actor_reference: args.userId,
      previous_values: {
        policy_status:
          args.policy.policy_status,
      },
      new_values: {
        policy_status: targetStatus,
        suspension_type:
          args.suspensionType,
        suspension_reason:
          args.suspensionReason,
        effective_date:
          args.effectiveDate,
        premium_adjustment_amount:
          args.premiumAdjustmentAmount,
      },
      metadata: {
        approval_required:
          args.approvalRequired,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackPolicyAction(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsementId: number;
}) {
  await args.adminClient
    .from("insurance_policy_records")
    .update({
      policy_status:
        args.policy.policy_status,
      metadata:
        args.policy.metadata ?? {},
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.policy.id)
    .eq("user_id", args.userId);

  await args.adminClient
    .from("insurance_policy_endorsements")
    .update({
      endorsement_status: "cancelled",
      rejection_reason:
        "Policy action rolled back because a linked operation failed.",
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.endorsementId);
}

function buildActionResult(args: {
  action: "suspend" | "reinstate";
  approvalRequired: boolean;
  effectiveDate: string;
}): PolicyActionResult {
  return {
    action: args.action,
    policy_status:
      args.approvalRequired
        ? "pending_approval"
        : args.action === "suspend"
          ? "suspended"
          : "active",
    endorsement_status:
      args.approvalRequired
        ? "submitted"
        : "approved",
    approval_required:
      args.approvalRequired,
    effective_date:
      args.effectiveDate,
  };
}

function normalizeSuspensionType(
  value: unknown
) {
  const allowed = new Set([
    "temporary",
    "non_payment",
    "fraud_review",
    "document_issue",
    "vehicle_not_in_use",
    "regulatory_hold",
    "other",
  ]);

  const normalized =
    cleanText(value, 80) || "temporary";

  return allowed.has(normalized)
    ? normalized
    : "other";
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

function cleanSignedMoney(
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

  return Number.isFinite(numeric)
    ? Math.round(numeric * 100) / 100
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
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

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