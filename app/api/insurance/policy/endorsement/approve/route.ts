import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type ApproveEndorsementBody = {
  endorsement_id?: number;
  decision?: "approve" | "reject";
  approval_notes?: string | null;
  rejection_reason?: string | null;

  approved_values?: Record<string, unknown>;
  approved_by_name?: string | null;
  approved_by_role?: string | null;

  issue_document?: boolean;
  notify_customer?: boolean;

  metadata?: Record<string, unknown>;
};

type EndorsementRow = {
  id: number;
  user_id: string;
  policy_id: number;
  endorsement_reference: string | null;
  endorsement_type: string;
  endorsement_status: string;

  requested_changes: Record<string, unknown>;
  previous_values: Record<string, unknown>;
  approved_values: Record<string, unknown>;

  premium_difference: number;
  tax_difference: number;
  refund_amount: number;

  effective_date: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;

  approved_by_name: string | null;
  approved_by_role: string | null;

  document_path: string | null;
  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};

type PolicyRow = {
  id: number;
  user_id: string;
  policy_number: string;
  policy_status: string;
  issuance_status: string;
  renewal_status: string;
  policy_version: number;

  insured_name: string;
  insured_email: string | null;
  insured_phone: string | null;
  insured_address: Record<string, unknown> | null;

  vehicle_registration_number: string | null;

  total_premium: number;
  net_premium: number;
  tax_amount: number;
  discount_amount: number;
  ncb_percent: number | null;
  ncb_discount_amount: number;

  cancellation_status: string;
  cancellation_effective_date: string | null;
  cancellation_reason: string | null;
  cancellation_refund_amount: number | null;

  metadata: Record<string, unknown> | null;
  endorsements_summary: Array<Record<string, unknown>> | null;

  created_at: string;
  updated_at: string;

  [key: string]: unknown;
};

type ApprovalRow = {
  id: number;
  user_id: string;
  policy_id: number | null;
  proposal_id: number | null;
  endorsement_id: number | null;

  approval_type: string;
  approval_status: string;

  requested_by_name: string | null;
  requested_by_role: string | null;
  requested_at: string;

  approved_by_name: string | null;
  approved_by_role: string | null;
  approved_at: string | null;

  rejected_at: string | null;
  rejection_reason: string | null;

  approval_notes: string | null;
  metadata: Record<string, unknown> | null;

  created_at: string;
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
            "You must be signed in to approve or reject an endorsement.",
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

    const body = (await request.json()) as ApproveEndorsementBody;

    const endorsementId = positiveInteger(
      body.endorsement_id
    );

    const decision =
      body.decision === "reject"
        ? "reject"
        : "approve";

    if (!endorsementId) {
      return NextResponse.json(
        { error: "endorsement_id is required." },
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

    const endorsement = await loadOwnedEndorsement(
      adminClient as any,
      endorsementId,
      user.id
    );

    if (!endorsement) {
      return NextResponse.json(
        {
          error:
            "Endorsement was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const policy = await loadOwnedPolicy(
      adminClient as any,
      endorsement.policy_id,
      user.id
    );

    if (!policy) {
      return NextResponse.json(
        {
          error:
            "The policy linked to this endorsement was not found.",
        },
        { status: 404 }
      );
    }

    const pendingApproval = await loadPendingApproval(
      adminClient as any,
      endorsement.id,
      user.id
    );

    const stateError = validateDecisionState(
      endorsement,
      pendingApproval,
      decision,
      body
    );

    if (stateError) {
      return NextResponse.json(
        { error: stateError },
        { status: 409 }
      );
    }

    const reviewerName =
      cleanText(body.approved_by_name, 250) ||
      user.email ||
      "Authorized User";

    const reviewerRole =
      cleanText(body.approved_by_role, 120) ||
      "authorized_reviewer";

    const approvedValues =
      decision === "approve"
        ? resolveApprovedValues(
            endorsement,
            body.approved_values
          )
        : {};

    const approvalNotes =
      cleanNullableText(
        body.approval_notes,
        2000
      );

    const rejectionReason =
      decision === "reject"
        ? cleanText(
            body.rejection_reason,
            2000
          )
        : "";

    if (
      decision === "reject" &&
      !rejectionReason
    ) {
      return NextResponse.json(
        {
          error:
            "rejection_reason is required when rejecting an endorsement.",
        },
        { status: 400 }
      );
    }

    const snapshot = {
      policy: structuredCloneSafe(policy),
      endorsement: structuredCloneSafe(endorsement),
      approval: pendingApproval
        ? structuredCloneSafe(pendingApproval)
        : null,
    };

    try {
      let result:
        | {
            decision: "approve";
            policy_status: string;
            endorsement_status: string;
          }
        | {
            decision: "reject";
            policy_status: string;
            endorsement_status: string;
          };

      if (decision === "approve") {
        result = await approveEndorsement({
          adminClient: adminClient as any,
          userId: user.id,
          policy,
          endorsement,
          approval: pendingApproval,
          approvedValues,
          reviewerName,
          reviewerRole,
          approvalNotes,
          issueDocument:
            body.issue_document !== false,
          notifyCustomer:
            body.notify_customer !== false,
          metadata:
            validObject(body.metadata) ?? {},
        });
      } else {
        result = await rejectEndorsement({
          adminClient: adminClient as any,
          userId: user.id,
          policy,
          endorsement,
          approval: pendingApproval,
          reviewerName,
          reviewerRole,
          rejectionReason,
          approvalNotes,
          issueDocument:
            body.issue_document !== false,
          notifyCustomer:
            body.notify_customer !== false,
          metadata:
            validObject(body.metadata) ?? {},
        });
      }

      return NextResponse.json({
        success: true,
        endorsement_id: endorsement.id,
        endorsement_reference:
          endorsement.endorsement_reference,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        decision: result.decision,
        endorsement_status:
          result.endorsement_status,
        policy_status:
          result.policy_status,
        approval_id:
          pendingApproval?.id ?? null,
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        message:
          decision === "approve"
            ? "Endorsement approved and applied successfully."
            : "Endorsement rejected successfully.",
      });
    } catch (operationError) {
      await rollbackDecision({
        adminClient: adminClient as any,
        userId: user.id,
        snapshot,
      });

      throw operationError;
    }
  } catch (error) {
    console.error(
      "Endorsement approval error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process endorsement decision.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedEndorsement(
  adminClient: any,
  endorsementId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_policy_endorsements")
    .select("*")
    .eq("id", endorsementId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as EndorsementRow | null;
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

async function loadPendingApproval(
  adminClient: any,
  endorsementId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_policy_approvals")
    .select("*")
    .eq("endorsement_id", endorsementId)
    .eq("user_id", userId)
    .eq("approval_status", "pending")
    .order("requested_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ApprovalRow | null;
}

function validateDecisionState(
  endorsement: EndorsementRow,
  approval: ApprovalRow | null,
  decision: "approve" | "reject",
  body: ApproveEndorsementBody
) {
  if (
    [
      "approved",
      "issued",
      "rejected",
      "cancelled",
    ].includes(endorsement.endorsement_status)
  ) {
    return (
      `Endorsement cannot be processed while status is ` +
      `${endorsement.endorsement_status}.`
    );
  }

  if (!approval) {
    return (
      "No pending approval request was found for this endorsement."
    );
  }

  if (
    decision === "approve" &&
    body.approved_values !== undefined &&
    !validObject(body.approved_values)
  ) {
    return "approved_values must be a JSON object.";
  }

  return "";
}

function resolveApprovedValues(
  endorsement: EndorsementRow,
  overrideValues:
    | Record<string, unknown>
    | undefined
) {
  const override =
    validObject(overrideValues);

  if (override) {
    return override;
  }

  const requestedChanges =
    validObject(
      endorsement.requested_changes
    ) ?? {};

  const nestedChanges =
    validObject(
      requestedChanges.changes
    );

  return nestedChanges ??
    requestedChanges;
}

async function approveEndorsement(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow;
  approval: ApprovalRow | null;
  approvedValues: Record<string, unknown>;
  reviewerName: string;
  reviewerRole: string;
  approvalNotes: string | null;
  issueDocument: boolean;
  notifyCustomer: boolean;
  metadata: Record<string, unknown>;
}) {
  const safePolicyChanges =
    buildSafePolicyUpdate(
      args.policy,
      args.endorsement,
      args.approvedValues
    );

  const targetPolicyStatus =
    resolveApprovedPolicyStatus(
      args.policy,
      args.endorsement,
      safePolicyChanges
    );

  const updatedMetadata = {
    ...(validObject(args.policy.metadata) ?? {}),
    last_endorsement: {
      endorsement_id:
        args.endorsement.id,
      endorsement_reference:
        args.endorsement.endorsement_reference,
      endorsement_type:
        args.endorsement.endorsement_type,
      approved_at:
        new Date().toISOString(),
      approved_by:
        args.reviewerName,
      approved_by_role:
        args.reviewerRole,
    },
  };

  const { error: policyError } =
    await args.adminClient
      .from("insurance_policy_records")
      .update({
        ...safePolicyChanges,
        policy_status:
          targetPolicyStatus,
        metadata:
          updatedMetadata,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", args.policy.id)
      .eq("user_id", args.userId);

  if (policyError) {
    throw new Error(policyError.message);
  }

  const { error: endorsementError } =
    await args.adminClient
      .from("insurance_policy_endorsements")
      .update({
        endorsement_status: "approved",
        approved_values:
          safePolicyChanges,
        approved_by_name:
          args.reviewerName,
        approved_by_role:
          args.reviewerRole,
        approved_at:
          new Date().toISOString(),
        rejection_reason: null,
        metadata: {
          ...(validObject(
            args.endorsement.metadata
          ) ?? {}),
          ...args.metadata,
          approval_notes:
            args.approvalNotes,
        },
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", args.endorsement.id)
      .eq("user_id", args.userId);

  if (endorsementError) {
    throw new Error(
      endorsementError.message
    );
  }

  if (args.approval) {
    const { error: approvalError } =
      await args.adminClient
        .from("insurance_policy_approvals")
        .update({
          approval_status: "approved",
          approved_by_name:
            args.reviewerName,
          approved_by_role:
            args.reviewerRole,
          approved_at:
            new Date().toISOString(),
          approval_notes:
            args.approvalNotes,
          rejected_at: null,
          rejection_reason: null,
        })
        .eq("id", args.approval.id)
        .eq("user_id", args.userId);

    if (approvalError) {
      throw new Error(
        approvalError.message
      );
    }
  }

  await appendEndorsementSummary({
    adminClient: args.adminClient,
    userId: args.userId,
    policy: args.policy,
    endorsement: args.endorsement,
    status: "approved",
  });

  if (args.issueDocument) {
    await createDecisionDocument({
      adminClient: args.adminClient,
      userId: args.userId,
      policy: args.policy,
      endorsement: args.endorsement,
      decision: "approved",
      reviewerName:
        args.reviewerName,
      reviewerRole:
        args.reviewerRole,
      notes:
        args.approvalNotes,
    });
  }

  await writeDecisionAudit({
    adminClient: args.adminClient,
    userId: args.userId,
    policy: args.policy,
    endorsement: args.endorsement,
    decision: "approved",
    reviewerName:
      args.reviewerName,
    reviewerRole:
      args.reviewerRole,
    notes:
      args.approvalNotes,
    approvedValues:
      safePolicyChanges,
  });

  if (args.notifyCustomer) {
    await queueNotification({
      adminClient: args.adminClient,
      userId: args.userId,
      policy: args.policy,
      endorsement: args.endorsement,
      decision: "approved",
    });
  }

  return {
    decision: "approve" as const,
    policy_status:
      targetPolicyStatus,
    endorsement_status:
      "approved",
  };
}

async function rejectEndorsement(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow;
  approval: ApprovalRow | null;
  reviewerName: string;
  reviewerRole: string;
  rejectionReason: string;
  approvalNotes: string | null;
  issueDocument: boolean;
  notifyCustomer: boolean;
  metadata: Record<string, unknown>;
}) {
  const restoredPolicyStatus =
    resolveRejectedPolicyStatus(
      args.policy,
      args.endorsement
    );

  const restoredValues =
    filterRestorableValues(
      args.endorsement.previous_values
    );

  const { error: policyError } =
    await args.adminClient
      .from("insurance_policy_records")
      .update({
        ...restoredValues,
        policy_status:
          restoredPolicyStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", args.policy.id)
      .eq("user_id", args.userId);

  if (policyError) {
    throw new Error(policyError.message);
  }

  const { error: endorsementError } =
    await args.adminClient
      .from("insurance_policy_endorsements")
      .update({
        endorsement_status: "rejected",
        approved_values: {},
        approved_by_name:
          args.reviewerName,
        approved_by_role:
          args.reviewerRole,
        approved_at: null,
        rejected_at:
          new Date().toISOString(),
        rejection_reason:
          args.rejectionReason,
        metadata: {
          ...(validObject(
            args.endorsement.metadata
          ) ?? {}),
          ...args.metadata,
          approval_notes:
            args.approvalNotes,
        },
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", args.endorsement.id)
      .eq("user_id", args.userId);

  if (endorsementError) {
    throw new Error(
      endorsementError.message
    );
  }

  if (args.approval) {
    const { error: approvalError } =
      await args.adminClient
        .from("insurance_policy_approvals")
        .update({
          approval_status: "rejected",
          approved_by_name:
            args.reviewerName,
          approved_by_role:
            args.reviewerRole,
          approved_at: null,
          rejected_at:
            new Date().toISOString(),
          rejection_reason:
            args.rejectionReason,
          approval_notes:
            args.approvalNotes,
        })
        .eq("id", args.approval.id)
        .eq("user_id", args.userId);

    if (approvalError) {
      throw new Error(
        approvalError.message
      );
    }
  }

  await appendEndorsementSummary({
    adminClient: args.adminClient,
    userId: args.userId,
    policy: args.policy,
    endorsement: args.endorsement,
    status: "rejected",
  });

  if (args.issueDocument) {
    await createDecisionDocument({
      adminClient: args.adminClient,
      userId: args.userId,
      policy: args.policy,
      endorsement: args.endorsement,
      decision: "rejected",
      reviewerName:
        args.reviewerName,
      reviewerRole:
        args.reviewerRole,
      notes:
        args.rejectionReason,
    });
  }

  await writeDecisionAudit({
    adminClient: args.adminClient,
    userId: args.userId,
    policy: args.policy,
    endorsement: args.endorsement,
    decision: "rejected",
    reviewerName:
      args.reviewerName,
    reviewerRole:
      args.reviewerRole,
    notes:
      args.rejectionReason,
    approvedValues: {},
  });

  if (args.notifyCustomer) {
    await queueNotification({
      adminClient: args.adminClient,
      userId: args.userId,
      policy: args.policy,
      endorsement: args.endorsement,
      decision: "rejected",
    });
  }

  return {
    decision: "reject" as const,
    policy_status:
      restoredPolicyStatus,
    endorsement_status:
      "rejected",
  };
}

function buildSafePolicyUpdate(
  policy: PolicyRow,
  endorsement: EndorsementRow,
  approvedValues:
    Record<string, unknown>
) {
  const allowedFields = new Set([
    "policy_type",
    "policy_category",
    "insurer_name",
    "branch_code",
    "intermediary_code",

    "insured_name",
    "insured_email",
    "insured_phone",
    "insured_address",

    "vehicle_registration_number",
    "chassis_number",
    "engine_number",
    "vin",
    "vehicle_make",
    "vehicle_model",
    "vehicle_variant",
    "vehicle_year",
    "vehicle_fuel_type",
    "vehicle_usage_type",

    "policy_start_date",
    "policy_end_date",

    "idv",
    "total_premium",
    "net_premium",
    "tax_amount",
    "discount_amount",
    "ncb_percent",
    "ncb_discount_amount",

    "compulsory_deductible",
    "voluntary_deductible",

    "coverage_details",
    "selected_addons",
    "exclusions",

    "grace_period_days",
    "grace_period_end_date",

    "cancellation_status",
    "cancellation_effective_date",
    "cancellation_reason",
    "cancellation_refund_amount",

    "renewal_status",
    "issuance_status",
  ]);

  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    approvedValues
  )) {
    if (allowedFields.has(key)) {
      safe[key] = value;
    }
  }

  const endorsementType =
    endorsement.endorsement_type;

  if (
    endorsementType ===
    "policy_ownership_transfer"
  ) {
    const requested =
      validObject(
        endorsement.requested_changes
      ) ?? {};

    const buyerName =
      cleanText(
        requested.buyer_name,
        250
      );

    if (buyerName) {
      safe.insured_name = buyerName;
    }

    safe.insured_email =
      cleanNullableText(
        requested.buyer_email,
        250
      );

    safe.insured_phone =
      cleanNullableText(
        requested.buyer_phone,
        80
      );

    safe.insured_address =
      validObject(
        requested.buyer_address
      ) ?? {};

    const newRegistrationNumber =
      cleanNullableText(
        requested.new_registration_number,
        120
      );

    if (newRegistrationNumber) {
      safe.vehicle_registration_number =
        newRegistrationNumber;
    }

    if (
      requested.proposed_total_premium !==
      undefined
    ) {
      safe.total_premium =
        numberOrZero(
          requested.proposed_total_premium
        );
    }

    if (
      requested.proposed_ncb_percent !==
      undefined
    ) {
      safe.ncb_percent =
        cleanPercentage(
          requested.proposed_ncb_percent
        );
    }
  }

  if (
    endorsementType ===
    "policy_cancellation"
  ) {
    safe.cancellation_status =
      "approved";
    safe.policy_status =
      "cancelled";
  }

  if (
    endorsementType ===
    "policy_suspension"
  ) {
    safe.policy_status =
      "suspended";
  }

  if (
    endorsementType ===
    "policy_reinstatement"
  ) {
    safe.policy_status =
      "active";
  }

  if (
    safe.policy_start_date &&
    safe.policy_end_date &&
    new Date(
      String(safe.policy_end_date)
    ).getTime() <
      new Date(
        String(safe.policy_start_date)
      ).getTime()
  ) {
    throw new Error(
      "Approved policy dates are invalid."
    );
  }

  return safe;
}

function resolveApprovedPolicyStatus(
  policy: PolicyRow,
  endorsement: EndorsementRow,
  changes: Record<string, unknown>
) {
  if (
    typeof changes.policy_status ===
    "string"
  ) {
    return changes.policy_status;
  }

  switch (
    endorsement.endorsement_type
  ) {
    case "policy_cancellation":
      return "cancelled";

    case "policy_suspension":
      return "suspended";

    case "policy_reinstatement":
      return "active";

    case "policy_ownership_transfer":
      return "active";

    default:
      return policy.policy_status ===
        "pending_approval"
        ? "active"
        : policy.policy_status;
  }
}

function resolveRejectedPolicyStatus(
  policy: PolicyRow,
  endorsement: EndorsementRow
) {
  const previousStatus =
    cleanText(
      endorsement.previous_values
        ?.policy_status,
      80
    );

  if (previousStatus) {
    return previousStatus;
  }

  if (
    endorsement.endorsement_type ===
    "policy_reinstatement"
  ) {
    return "suspended";
  }

  return policy.policy_status ===
    "pending_approval"
    ? "active"
    : policy.policy_status;
}

function filterRestorableValues(
  values: Record<string, unknown>
) {
  const allowed = new Set([
    "policy_status",
    "insured_name",
    "insured_email",
    "insured_phone",
    "insured_address",
    "vehicle_registration_number",
    "total_premium",
    "ncb_percent",
    "cancellation_status",
    "cancellation_effective_date",
    "cancellation_reason",
    "cancellation_refund_amount",
    "metadata",
  ]);

  const result:
    Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    values ?? {}
  )) {
    if (allowed.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

async function appendEndorsementSummary(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow;
  status: "approved" | "rejected";
}) {
  const current =
    Array.isArray(
      args.policy.endorsements_summary
    )
      ? args.policy.endorsements_summary
      : [];

  const filtered = current.filter(
    (item) =>
      Number(
        item.endorsement_id ?? -1
      ) !== args.endorsement.id
  );

  const next = [
    ...filtered,
    {
      endorsement_id:
        args.endorsement.id,
      endorsement_reference:
        args.endorsement
          .endorsement_reference,
      endorsement_type:
        args.endorsement
          .endorsement_type,
      endorsement_status:
        args.status,
      effective_date:
        args.endorsement
          .effective_date,
      updated_at:
        new Date().toISOString(),
    },
  ];

  const { error } =
    await args.adminClient
      .from("insurance_policy_records")
      .update({
        endorsements_summary: next,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", args.policy.id)
      .eq("user_id", args.userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function createDecisionDocument(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow;
  decision: "approved" | "rejected";
  reviewerName: string;
  reviewerRole: string;
  notes: string | null;
}) {
  const documentType =
    args.decision === "approved"
      ? "endorsement_approval"
      : "endorsement_rejection";

  const suffix =
    args.decision === "approved"
      ? "APPROVED"
      : "REJECTED";

  const { error } =
    await args.adminClient
      .from("insurance_policy_documents")
      .insert({
        user_id: args.userId,
        policy_id: args.policy.id,
        document_type:
          documentType,
        document_number:
          `${args.policy.policy_number}-${suffix}-${args.endorsement.id}`,
        document_status:
          "generated",
        document_title:
          args.decision === "approved"
            ? "Endorsement Approval"
            : "Endorsement Rejection",
        document_summary:
          args.decision === "approved"
            ? "Approved endorsement document generated."
            : "Rejected endorsement notice generated.",
        version_number:
          Math.max(
            1,
            Number(
              args.policy.policy_version ??
              1
            )
          ),
        metadata: {
          endorsement_id:
            args.endorsement.id,
          endorsement_reference:
            args.endorsement
              .endorsement_reference,
          endorsement_type:
            args.endorsement
              .endorsement_type,
          decision:
            args.decision,
          reviewer_name:
            args.reviewerName,
          reviewer_role:
            args.reviewerRole,
          notes:
            args.notes,
        },
      });

  if (error) {
    throw new Error(error.message);
  }
}

async function writeDecisionAudit(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow;
  decision: "approved" | "rejected";
  reviewerName: string;
  reviewerRole: string;
  notes: string | null;
  approvedValues: Record<string, unknown>;
}) {
  const { error } =
    await args.adminClient
      .from("insurance_policy_audit_log")
      .insert({
        user_id: args.userId,
        policy_id: args.policy.id,
        endorsement_id:
          args.endorsement.id,
        action_type:
          args.decision === "approved"
            ? "endorsement_approved"
            : "endorsement_rejected",
        action_status:
          args.decision,
        actor_type:
          "authorized_reviewer",
        actor_name:
          args.reviewerName,
        actor_reference:
          args.reviewerRole,
        previous_values:
          args.endorsement
            .previous_values ?? {},
        new_values:
          args.approvedValues,
        metadata: {
          endorsement_reference:
            args.endorsement
              .endorsement_reference,
          endorsement_type:
            args.endorsement
              .endorsement_type,
          notes:
            args.notes,
        },
      });

  if (error) {
    throw new Error(error.message);
  }
}

async function queueNotification(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow;
  decision: "approved" | "rejected";
}) {
  const { error } =
    await args.adminClient
      .from("insurance_policy_audit_log")
      .insert({
        user_id: args.userId,
        policy_id: args.policy.id,
        endorsement_id:
          args.endorsement.id,
        action_type:
          "endorsement_notification_queued",
        action_status:
          args.decision,
        actor_type: "system",
        actor_name:
          "Policy Notification Engine",
        metadata: {
          channels: [
            "push",
            "email",
            "sms",
          ],
          insured_name:
            args.policy.insured_name,
          insured_email:
            args.policy.insured_email,
          insured_phone:
            args.policy.insured_phone,
          endorsement_reference:
            args.endorsement
              .endorsement_reference,
          decision:
            args.decision,
        },
      });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackDecision(args: {
  adminClient: any;
  userId: string;
  snapshot: {
    policy: PolicyRow;
    endorsement: EndorsementRow;
    approval: ApprovalRow | null;
  };
}) {
  const {
    id: _policyId,
    created_at:
      _policyCreatedAt,
    updated_at:
      _policyUpdatedAt,
    ...policyValues
  } = args.snapshot.policy;

  await args.adminClient
    .from("insurance_policy_records")
    .update({
      ...policyValues,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      args.snapshot.policy.id
    )
    .eq("user_id", args.userId);

  const {
    id: _endorsementId,
    created_at:
      _endorsementCreatedAt,
    updated_at:
      _endorsementUpdatedAt,
    ...endorsementValues
  } = args.snapshot.endorsement;

  await args.adminClient
    .from("insurance_policy_endorsements")
    .update({
      ...endorsementValues,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      args.snapshot.endorsement.id
    )
    .eq("user_id", args.userId);

  if (args.snapshot.approval) {
    const {
      id: _approvalId,
      created_at:
        _approvalCreatedAt,
      ...approvalValues
    } = args.snapshot.approval;

    await args.adminClient
      .from("insurance_policy_approvals")
      .update(approvalValues)
      .eq(
        "id",
        args.snapshot.approval.id
      )
      .eq("user_id", args.userId);
  }
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

function cleanNullableText(
  value: unknown,
  limit = 8000
) {
  const cleaned =
    cleanText(value, limit);

  return cleaned || null;
}

function cleanPercentage(
  value: unknown
): number | null {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(numeric)
  ) {
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

function validObject(
  value: unknown
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}