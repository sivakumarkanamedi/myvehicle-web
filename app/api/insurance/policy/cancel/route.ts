import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type CancelPolicyBody = {
  policy_id?: number;

  cancellation_reason?: string;
  cancellation_effective_date?: string | null;

  refund_method?: "bank_transfer" | "upi" | "cheque" | "internal_ledger";
  refund_account_holder_name?: string | null;
  refund_bank_account_number?: string | null;
  refund_ifsc_code?: string | null;
  refund_upi_id?: string | null;

  cancellation_type?:
    | "customer_request"
    | "insurer_initiated"
    | "non_payment"
    | "duplicate_policy"
    | "vehicle_sold"
    | "vehicle_total_loss"
    | "fraud"
    | "other";

  supporting_documents?: Array<{
    document_type: string;
    document_name?: string;
    storage_path?: string;
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
  discount_amount: number;
  ncb_discount_amount: number;

  cancellation_status: string;
  cancellation_effective_date: string | null;
  cancellation_reason: string | null;
  cancellation_refund_amount: number | null;

  payment_status?: string | null;
  created_at: string;
  updated_at: string;
};

type CancellationCalculation = {
  policy_days: number;
  used_days: number;
  unused_days: number;
  earned_premium: number;
  refundable_premium: number;
  cancellation_fee: number;
  final_refund_amount: number;
  calculation_notes: string[];
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
        { error: "You must be signed in to cancel a policy." },
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

    const body = (await request.json()) as CancelPolicyBody;
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

    const eligibilityError = validateCancellationEligibility(policy);

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError },
        { status: 409 }
      );
    }

    const cancellationReason =
      cleanText(body.cancellation_reason, 2000);

    if (!cancellationReason) {
      return NextResponse.json(
        { error: "cancellation_reason is required." },
        { status: 400 }
      );
    }

    const cancellationEffectiveDate =
      body.cancellation_effective_date
        ? normalizeRequiredDate(
            body.cancellation_effective_date,
            "cancellation_effective_date"
          )
        : new Date().toISOString().slice(0, 10);

    const dateError = validateCancellationDate(
      policy,
      cancellationEffectiveDate
    );

    if (dateError) {
      return NextResponse.json(
        { error: dateError },
        { status: 400 }
      );
    }

    const calculation = calculateCancellationRefund(
      policy,
      cancellationEffectiveDate
    );

    const cancellationType = normalizeCancellationType(
      body.cancellation_type
    );

    const endorsement = await createCancellationEndorsement({
      adminClient: adminClient as any,
      userId: user.id,
      policy,
      cancellationReason,
      cancellationEffectiveDate,
      cancellationType,
      calculation,
    });

    try {
      const { error: policyUpdateError } = await adminClient
        .from("insurance_policy_records")
        .update({
          cancellation_status: "requested",
          cancellation_effective_date:
            cancellationEffectiveDate,
          cancellation_reason: cancellationReason,
          cancellation_refund_amount:
            calculation.final_refund_amount,
          policy_status: "pending_approval",
          updated_at: new Date().toISOString(),
        })
        .eq("id", policy.id)
        .eq("user_id", user.id);

      if (policyUpdateError) {
        throw new Error(policyUpdateError.message);
      }

      await createCancellationApproval({
        adminClient: adminClient as any,
        userId: user.id,
        policyId: policy.id,
        endorsementId: endorsement.id,
        cancellationReason,
        cancellationType,
      });

      let refundRecordId: number | null = null;

      if (calculation.final_refund_amount > 0) {
        refundRecordId = await createCancellationRefund({
          adminClient: adminClient as any,
          userId: user.id,
          policy,
          body,
          calculation,
          cancellationReason,
        });
      }

      await createCancellationDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsement,
        calculation,
        cancellationReason,
        cancellationEffectiveDate,
      });

      await createSupportingDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        policyId: policy.id,
        documents: body.supporting_documents ?? [],
      });

      await writePolicyAudit({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsementId: endorsement.id,
        cancellationType,
        cancellationReason,
        cancellationEffectiveDate,
        calculation,
      });

      return NextResponse.json({
        success: true,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        cancellation_status: "requested",
        cancellation_type: cancellationType,
        cancellation_effective_date:
          cancellationEffectiveDate,
        endorsement_id: endorsement.id,
        endorsement_reference:
          endorsement.endorsement_reference,
        refund_record_id: refundRecordId,
        refund_calculation: calculation,
        message:
          "Policy cancellation request created and sent for authorized approval.",
      });
    } catch (linkedOperationError) {
      await rollbackCancellation({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsementId: endorsement.id,
      });

      throw linkedOperationError;
    }
  } catch (error) {
    console.error("Policy cancellation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel the policy.",
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

function validateCancellationEligibility(
  policy: PolicyRow
) {
  if (policy.policy_status === "cancelled") {
    return "Policy is already cancelled.";
  }

  if (policy.cancellation_status === "requested") {
    return "A cancellation request is already pending.";
  }

  if (
    policy.policy_status === "renewed"
  ) {
    return "Renewed policies cannot be cancelled through this policy record.";
  }

  return "";
}

function validateCancellationDate(
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
    return "Cancellation effective date cannot be before policy start date.";
  }

  if (effective > end) {
    return "Cancellation effective date cannot be after policy end date.";
  }

  return "";
}

function calculateCancellationRefund(
  policy: PolicyRow,
  effectiveDate: string
): CancellationCalculation {
  const start = new Date(
    `${policy.policy_start_date}T00:00:00.000Z`
  );

  const end = new Date(
    `${policy.policy_end_date}T00:00:00.000Z`
  );

  const effective = new Date(
    `${effectiveDate}T00:00:00.000Z`
  );

  const policyDays = Math.max(
    1,
    Math.floor(
      (end.getTime() - start.getTime()) / 86400000
    ) + 1
  );

  const usedDays = Math.min(
    policyDays,
    Math.max(
      0,
      Math.floor(
        (effective.getTime() - start.getTime()) / 86400000
      ) + 1
    )
  );

  const unusedDays = Math.max(0, policyDays - usedDays);

  const refundableBase =
    Math.max(
      0,
      numberOrZero(policy.net_premium) -
        numberOrZero(policy.discount_amount) -
        numberOrZero(policy.ncb_discount_amount)
    );

  const earnedPremium = roundMoney(
    refundableBase * (usedDays / policyDays)
  );

  const refundablePremium = roundMoney(
    refundableBase - earnedPremium
  );

  const cancellationFee = roundMoney(
    Math.min(
      refundablePremium,
      Math.max(0, refundableBase * 0.02)
    )
  );

  const finalRefundAmount = roundMoney(
    Math.max(
      0,
      refundablePremium - cancellationFee
    )
  );

  return {
    policy_days: policyDays,
    used_days: usedDays,
    unused_days: unusedDays,
    earned_premium: earnedPremium,
    refundable_premium: refundablePremium,
    cancellation_fee: cancellationFee,
    final_refund_amount: finalRefundAmount,
    calculation_notes: [
      "Refund uses a simple pro-rata estimate.",
      "Taxes, statutory charges and insurer-specific short-period scales are not automatically refunded.",
      "Authorized insurer review is required before final refund approval.",
    ],
  };
}

async function createCancellationEndorsement(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  cancellationReason: string;
  cancellationEffectiveDate: string;
  cancellationType: string;
  calculation: CancellationCalculation;
}) {
  const { data, error } = await args.adminClient
    .from("insurance_policy_endorsements")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      endorsement_type: "policy_cancellation",
      endorsement_status: "submitted",
      requested_changes: {
        cancellation_type: args.cancellationType,
        cancellation_reason: args.cancellationReason,
        cancellation_effective_date:
          args.cancellationEffectiveDate,
      },
      previous_values: {
        policy_status: args.policy.policy_status,
        cancellation_status:
          args.policy.cancellation_status,
        cancellation_effective_date:
          args.policy.cancellation_effective_date,
        cancellation_reason:
          args.policy.cancellation_reason,
        cancellation_refund_amount:
          args.policy.cancellation_refund_amount,
      },
      approved_values: {},
      premium_difference:
        -args.calculation.refundable_premium,
      tax_difference: 0,
      refund_amount:
        args.calculation.final_refund_amount,
      effective_date:
        args.cancellationEffectiveDate,
      requested_at: new Date().toISOString(),
      metadata: {
        refund_calculation: args.calculation,
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create cancellation endorsement."
    );
  }

  return data;
}

async function createCancellationApproval(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  endorsementId: number;
  cancellationReason: string;
  cancellationType: string;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: args.userId,
      policy_id: args.policyId,
      endorsement_id: args.endorsementId,
      approval_type: "policy_cancellation",
      approval_status: "pending",
      requested_by_role: "customer",
      requested_at: new Date().toISOString(),
      approval_notes: args.cancellationReason,
      metadata: {
        cancellation_type: args.cancellationType,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function createCancellationRefund(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  body: CancelPolicyBody;
  calculation: CancellationCalculation;
  cancellationReason: string;
}) {
  const refundMethod = normalizeRefundMethod(
    args.body.refund_method
  );

  const { data, error } = await args.adminClient
    .from("insurance_payment_refunds")
    .insert({
      user_id: args.userId,
      payment_instruction_id: null,
      refund_reason:
        `Policy cancellation: ${args.cancellationReason}`,
      refund_amount:
        args.calculation.final_refund_amount,
      refund_status: "approval_pending",
      requested_by_name:
        args.policy.insured_name ?? "Policyholder",
      requested_by_role: "customer",
      requested_at: new Date().toISOString(),
      metadata: {
        source_type: "policy_cancellation",
        policy_id: args.policy.id,
        policy_number: args.policy.policy_number,
        refund_method: refundMethod,
        account_holder_name:
          cleanNullableText(
            args.body.refund_account_holder_name,
            250
          ),
        bank_account_number_masked:
          maskBankAccount(
            cleanText(
              args.body.refund_bank_account_number,
              120
            )
          ),
        bank_account_number:
          cleanNullableText(
            args.body.refund_bank_account_number,
            120
          ),
        ifsc_code:
          normalizeIfsc(
            args.body.refund_ifsc_code
          ),
        upi_id_masked:
          maskUpi(
            cleanText(
              args.body.refund_upi_id,
              200
            )
          ),
        upi_id:
          cleanNullableText(
            args.body.refund_upi_id,
            200
          ),
        refund_calculation:
          args.calculation,
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create cancellation refund record."
    );
  }

  return Number(data.id);
}

async function createCancellationDocuments(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: any;
  calculation: CancellationCalculation;
  cancellationReason: string;
  cancellationEffectiveDate: string;
}) {
  const documents = [
    {
      document_type:
        "policy_cancellation_request",
      document_number:
        `${args.policy.policy_number}-CANCEL`,
      document_title:
        "Policy Cancellation Request",
      document_summary:
        "Policy cancellation request generated for approval.",
    },
    {
      document_type:
        "cancellation_refund_advice",
      document_number:
        `${args.policy.policy_number}-REFUND`,
      document_title:
        "Cancellation Refund Advice",
      document_summary:
        "Estimated refund advice generated for authorized review.",
    },
  ].map((document) => ({
    user_id: args.userId,
    policy_id: args.policy.id,
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
      Math.max(1, Number(args.policy.policy_version ?? 1)),
    metadata: {
      endorsement_id: args.endorsement.id,
      endorsement_reference:
        args.endorsement.endorsement_reference,
      cancellation_reason:
        args.cancellationReason,
      cancellation_effective_date:
        args.cancellationEffectiveDate,
      refund_calculation:
        args.calculation,
    },
  }));

  const { error } = await args.adminClient
    .from("insurance_policy_documents")
    .insert(documents);

  if (error) {
    throw new Error(error.message);
  }
}

async function createSupportingDocuments(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  documents: NonNullable<
    CancelPolicyBody["supporting_documents"]
  >;
}) {
  if (!args.documents.length) return;

  const rows = args.documents.map((document, index) => ({
    user_id: args.userId,
    policy_id: args.policyId,
    document_type:
      cleanText(document.document_type, 120) ||
      "cancellation_supporting_document",
    document_number:
      `CANCEL-SUPPORT-${args.policyId}-${index + 1}`,
    document_status: "uploaded",
    document_title:
      cleanNullableText(document.document_name, 250),
    document_summary:
      "Supporting document submitted with policy cancellation request.",
    storage_path:
      cleanNullableText(document.storage_path, 2000),
    version_number: 1,
    metadata:
      validObject(document.metadata) ?? {},
  }));

  const { error } = await args.adminClient
    .from("insurance_policy_documents")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function writePolicyAudit(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsementId: number;
  cancellationType: string;
  cancellationReason: string;
  cancellationEffectiveDate: string;
  calculation: CancellationCalculation;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_audit_log")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      endorsement_id: args.endorsementId,
      action_type:
        "policy_cancellation_requested",
      action_status: "pending",
      actor_type: "authenticated_user",
      actor_reference: args.userId,
      previous_values: {
        policy_status:
          args.policy.policy_status,
        cancellation_status:
          args.policy.cancellation_status,
      },
      new_values: {
        policy_status:
          "pending_approval",
        cancellation_status:
          "requested",
        cancellation_type:
          args.cancellationType,
        cancellation_reason:
          args.cancellationReason,
        cancellation_effective_date:
          args.cancellationEffectiveDate,
        cancellation_refund_amount:
          args.calculation.final_refund_amount,
      },
      metadata: {
        refund_calculation:
          args.calculation,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackCancellation(args: {
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
      cancellation_status:
        args.policy.cancellation_status,
      cancellation_effective_date:
        args.policy.cancellation_effective_date,
      cancellation_reason:
        args.policy.cancellation_reason,
      cancellation_refund_amount:
        args.policy.cancellation_refund_amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.policy.id)
    .eq("user_id", args.userId);

  await args.adminClient
    .from("insurance_policy_endorsements")
    .update({
      endorsement_status: "cancelled",
      rejection_reason:
        "Cancellation request rolled back because a linked operation failed.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.endorsementId);
}

function normalizeCancellationType(
  value: unknown
) {
  const allowed = new Set([
    "customer_request",
    "insurer_initiated",
    "non_payment",
    "duplicate_policy",
    "vehicle_sold",
    "vehicle_total_loss",
    "fraud",
    "other",
  ]);

  const normalized =
    cleanText(value, 80) ||
    "customer_request";

  return allowed.has(normalized)
    ? normalized
    : "other";
}

function normalizeRefundMethod(
  value: unknown
) {
  const allowed = new Set([
    "bank_transfer",
    "upi",
    "cheque",
    "internal_ledger",
  ]);

  const normalized =
    cleanText(value, 80) ||
    "bank_transfer";

  return allowed.has(normalized)
    ? normalized
    : "bank_transfer";
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

  return Number.isNaN(date.getTime())
    ? null
    : raw;
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

function normalizeIfsc(
  value: unknown
) {
  const normalized =
    cleanText(value, 20)
      .toUpperCase()
      .replace(/\s+/g, "");

  return normalized || null;
}

function maskBankAccount(
  accountNumber: string
) {
  if (!accountNumber) return null;

  const compact =
    accountNumber.replace(/\s+/g, "");

  if (compact.length <= 4) {
    return compact;
  }

  return `${"*".repeat(
    Math.max(0, compact.length - 4)
  )}${compact.slice(-4)}`;
}

function maskUpi(
  upiId: string
) {
  if (!upiId) return null;

  const [name, handle] =
    upiId.split("@");

  if (!handle) {
    return "***";
  }

  const maskedName =
    name.length <= 2
      ? `${name.charAt(0) || "*"}*`
      : `${name.slice(0, 2)}${"*".repeat(
          Math.max(1, name.length - 2)
        )}`;

  return `${maskedName}@${handle}`;
}