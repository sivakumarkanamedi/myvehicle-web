import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type TransferPolicyBody = {
  policy_id?: number;

  transfer_type?:
    | "vehicle_sale"
    | "ownership_change"
    | "legal_heir_transfer"
    | "company_transfer"
    | "other";

  transfer_effective_date?: string | null;
  transfer_reason?: string;

  buyer_name?: string;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_address?: Record<string, unknown>;

  buyer_pan?: string | null;
  buyer_gstin?: string | null;

  new_registration_number?: string | null;
  new_rc_owner_name?: string | null;
  rc_verification_status?:
    | "pending"
    | "verified"
    | "failed"
    | "manual_review";

  retain_ncb?: boolean;
  requested_ncb_percent?: number | null;

  proposed_idv?: number | null;
  proposed_total_premium?: number | null;
  premium_adjustment_amount?: number | null;

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
  insured_email: string | null;
  insured_phone: string | null;
  insured_address: Record<string, unknown> | null;

  vehicle_id: number;
  vehicle_registration_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;

  policy_status: string;
  issuance_status: string;
  renewal_status: string;
  policy_version: number;

  policy_start_date: string;
  policy_end_date: string;

  idv: number | null;
  total_premium: number;
  net_premium: number;
  tax_amount: number;
  discount_amount: number;
  ncb_percent: number | null;
  ncb_discount_amount: number;

  cancellation_status: string;
  digital_signature_status: string;
  signed_at: string | null;

  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};

type TransferAssessment = {
  fraud_risk_score: number;
  manual_review_required: boolean;
  premium_adjustment_amount: number;
  proposed_total_premium: number;
  proposed_ncb_percent: number;
  validation_warnings: string[];
  validation_errors: string[];
  recommendation: string;
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
        { error: "You must be signed in to transfer a policy." },
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

    const body = (await request.json()) as TransferPolicyBody;

    const policyId = positiveInteger(body.policy_id);

    if (!policyId) {
      return NextResponse.json(
        { error: "policy_id is required." },
        { status: 400 }
      );
    }

    const buyerName = cleanText(body.buyer_name, 250);

    if (!buyerName) {
      return NextResponse.json(
        { error: "buyer_name is required." },
        { status: 400 }
      );
    }

    const transferReason = cleanText(
      body.transfer_reason,
      2000
    );

    if (!transferReason) {
      return NextResponse.json(
        { error: "transfer_reason is required." },
        { status: 400 }
      );
    }

    const transferEffectiveDate =
      body.transfer_effective_date
        ? normalizeRequiredDate(
            body.transfer_effective_date,
            "transfer_effective_date"
          )
        : new Date().toISOString().slice(0, 10);

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
      validateTransferEligibility(
        policy,
        transferEffectiveDate
      );

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError },
        { status: 409 }
      );
    }

    const assessment = assessTransfer(
      policy,
      body,
      buyerName
    );

    if (assessment.validation_errors.length) {
      return NextResponse.json(
        {
          error:
            "Policy transfer validation failed.",
          validation_errors:
            assessment.validation_errors,
          validation_warnings:
            assessment.validation_warnings,
        },
        { status: 400 }
      );
    }

    const transferType = normalizeTransferType(
      body.transfer_type
    );

    const endorsement =
      await createTransferEndorsement({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        body,
        buyerName,
        transferType,
        transferReason,
        transferEffectiveDate,
        assessment,
      });

    try {
      const existingMetadata =
        validObject(policy.metadata) ?? {};

      const transferMetadata = {
        ...existingMetadata,
        pending_transfer: {
          transfer_type: transferType,
          transfer_reason: transferReason,
          transfer_effective_date:
            transferEffectiveDate,
          buyer_name: buyerName,
          buyer_email:
            cleanNullableText(
              body.buyer_email,
              250
            ),
          buyer_phone:
            cleanNullableText(
              body.buyer_phone,
              80
            ),
          rc_verification_status:
            normalizeRcStatus(
              body.rc_verification_status
            ),
          fraud_risk_score:
            assessment.fraud_risk_score,
          manual_review_required:
            assessment.manual_review_required,
          endorsement_id:
            endorsement.id,
          endorsement_reference:
            endorsement.endorsement_reference,
          requested_at:
            new Date().toISOString(),
        },
      };

      const { error: policyUpdateError } =
        await adminClient
          .from("insurance_policy_records")
          .update({
            policy_status: "pending_approval",
            metadata: transferMetadata,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", policy.id)
          .eq("user_id", user.id);

      if (policyUpdateError) {
        throw new Error(
          policyUpdateError.message
        );
      }

      await createTransferApproval({
        adminClient: adminClient as any,
        userId: user.id,
        policyId: policy.id,
        endorsementId: endorsement.id,
        transferType,
        transferReason,
        assessment,
      });

      await createTransferDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsement,
        buyerName,
        transferType,
        transferEffectiveDate,
        assessment,
      });

      await createSupportingDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        policyId: policy.id,
        documents:
          body.supporting_documents ?? [],
      });

      await writeTransferAudit({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsementId: endorsement.id,
        transferType,
        transferReason,
        transferEffectiveDate,
        buyerName,
        assessment,
      });

      return NextResponse.json({
        success: true,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        transfer_status: "pending_approval",
        transfer_type: transferType,
        transfer_effective_date:
          transferEffectiveDate,
        buyer_name: buyerName,
        endorsement_id: endorsement.id,
        endorsement_reference:
          endorsement.endorsement_reference,
        fraud_risk_score:
          assessment.fraud_risk_score,
        manual_review_required:
          assessment.manual_review_required,
        proposed_total_premium:
          assessment.proposed_total_premium,
        proposed_ncb_percent:
          assessment.proposed_ncb_percent,
        premium_adjustment_amount:
          assessment.premium_adjustment_amount,
        validation_warnings:
          assessment.validation_warnings,
        recommendation:
          assessment.recommendation,
        message:
          "Policy transfer request created and sent for authorized approval.",
      });
    } catch (linkedOperationError) {
      await rollbackTransfer({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsementId: endorsement.id,
      });

      throw linkedOperationError;
    }
  } catch (error) {
    console.error("Policy transfer error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to transfer the policy.",
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

function validateTransferEligibility(
  policy: PolicyRow,
  transferEffectiveDate: string
) {
  if (
    ["cancelled", "expired", "renewed"].includes(
      policy.policy_status
    )
  ) {
    return (
      `Policy cannot be transferred while status is ` +
      `${policy.policy_status}.`
    );
  }

  if (
    policy.cancellation_status === "requested"
  ) {
    return (
      "Policy transfer is blocked while cancellation is pending."
    );
  }

  const start = new Date(
    `${policy.policy_start_date}T00:00:00.000Z`
  ).getTime();

  const end = new Date(
    `${policy.policy_end_date}T00:00:00.000Z`
  ).getTime();

  const transferDate = new Date(
    `${transferEffectiveDate}T00:00:00.000Z`
  ).getTime();

  if (transferDate < start) {
    return (
      "Transfer effective date cannot be before policy start date."
    );
  }

  if (transferDate > end) {
    return (
      "Transfer effective date cannot be after policy end date."
    );
  }

  return "";
}

function assessTransfer(
  policy: PolicyRow,
  body: TransferPolicyBody,
  buyerName: string
): TransferAssessment {
  const warnings: string[] = [];
  const errors: string[] = [];

  let fraudRiskScore = 10;

  const rcStatus = normalizeRcStatus(
    body.rc_verification_status
  );

  if (rcStatus === "failed") {
    errors.push(
      "RC verification failed. Transfer cannot proceed."
    );

    fraudRiskScore += 50;
  }

  if (rcStatus === "manual_review") {
    warnings.push(
      "RC details require manual verification."
    );

    fraudRiskScore += 25;
  }

  if (rcStatus === "pending") {
    warnings.push(
      "RC verification is still pending."
    );

    fraudRiskScore += 15;
  }

  const newRcOwner = cleanText(
    body.new_rc_owner_name,
    250
  );

  if (
    newRcOwner &&
    normalizeName(newRcOwner) !==
      normalizeName(buyerName)
  ) {
    warnings.push(
      "Buyer name does not exactly match the proposed RC owner name."
    );

    fraudRiskScore += 20;
  }

  const buyerEmail = cleanText(
    body.buyer_email,
    250
  );

  const buyerPhone = cleanText(
    body.buyer_phone,
    80
  );

  if (!buyerEmail && !buyerPhone) {
    warnings.push(
      "Buyer email or phone should be provided for verification."
    );

    fraudRiskScore += 10;
  }

  if (
    normalizeName(buyerName) ===
    normalizeName(policy.insured_name)
  ) {
    warnings.push(
      "Buyer name matches the current insured name."
    );

    fraudRiskScore += 5;
  }

  const currentNcb =
    cleanPercentage(policy.ncb_percent) ?? 0;

  const requestedNcb =
    cleanPercentage(
      body.requested_ncb_percent
    );

  const retainNcb = Boolean(body.retain_ncb);

  let proposedNcbPercent = 0;

  if (retainNcb) {
    proposedNcbPercent =
      requestedNcb ?? currentNcb;

    warnings.push(
      "NCB retention must be verified against insurer rules."
    );
  } else {
    proposedNcbPercent =
      requestedNcb ?? 0;
  }

  const currentPremium =
    numberOrZero(policy.total_premium);

  const manualAdjustment =
    cleanSignedMoney(
      body.premium_adjustment_amount
    );

  const proposedPremium =
    cleanMoney(
      body.proposed_total_premium
    ) ??
    roundMoney(
      currentPremium +
      (retainNcb ? 0 : currentPremium * 0.1)
    );

  const premiumAdjustmentAmount =
    manualAdjustment ??
    roundMoney(
      proposedPremium - currentPremium
    );

  const manualReviewRequired =
    fraudRiskScore >= 40 ||
    rcStatus !== "verified" ||
    retainNcb;

  const recommendation =
    errors.length
      ? "reject_transfer"
      : manualReviewRequired
        ? "manual_review"
        : "approve_after_document_verification";

  return {
    fraud_risk_score:
      Math.min(100, fraudRiskScore),
    manual_review_required:
      manualReviewRequired,
    premium_adjustment_amount:
      premiumAdjustmentAmount,
    proposed_total_premium:
      proposedPremium,
    proposed_ncb_percent:
      proposedNcbPercent,
    validation_warnings: warnings,
    validation_errors: errors,
    recommendation,
  };
}

async function createTransferEndorsement(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  body: TransferPolicyBody;
  buyerName: string;
  transferType: string;
  transferReason: string;
  transferEffectiveDate: string;
  assessment: TransferAssessment;
}) {
  const { data, error } =
    await args.adminClient
      .from("insurance_policy_endorsements")
      .insert({
        user_id: args.userId,
        policy_id: args.policy.id,
        endorsement_type:
          "policy_ownership_transfer",
        endorsement_status:
          "submitted",

        requested_changes: {
          transfer_type:
            args.transferType,
          transfer_reason:
            args.transferReason,
          transfer_effective_date:
            args.transferEffectiveDate,

          buyer_name:
            args.buyerName,
          buyer_email:
            cleanNullableText(
              args.body.buyer_email,
              250
            ),
          buyer_phone:
            cleanNullableText(
              args.body.buyer_phone,
              80
            ),
          buyer_address:
            validObject(
              args.body.buyer_address
            ) ?? {},

          buyer_pan:
            cleanNullableText(
              args.body.buyer_pan,
              50
            ),
          buyer_gstin:
            cleanNullableText(
              args.body.buyer_gstin,
              50
            ),

          new_registration_number:
            cleanNullableText(
              args.body.new_registration_number,
              120
            ),

          new_rc_owner_name:
            cleanNullableText(
              args.body.new_rc_owner_name,
              250
            ),

          rc_verification_status:
            normalizeRcStatus(
              args.body.rc_verification_status
            ),

          retain_ncb:
            Boolean(args.body.retain_ncb),

          proposed_ncb_percent:
            args.assessment.proposed_ncb_percent,

          proposed_idv:
            cleanMoney(
              args.body.proposed_idv
            ) ?? args.policy.idv,

          proposed_total_premium:
            args.assessment.proposed_total_premium,

          premium_adjustment_amount:
            args.assessment.premium_adjustment_amount,
        },

        previous_values: {
          insured_name:
            args.policy.insured_name,
          insured_email:
            args.policy.insured_email,
          insured_phone:
            args.policy.insured_phone,
          insured_address:
            args.policy.insured_address,
          vehicle_registration_number:
            args.policy.vehicle_registration_number,
          total_premium:
            args.policy.total_premium,
          ncb_percent:
            args.policy.ncb_percent,
        },

        approved_values: {},

        premium_difference:
          args.assessment.premium_adjustment_amount,
        tax_difference: 0,
        refund_amount:
          args.assessment
            .premium_adjustment_amount < 0
            ? Math.abs(
                args.assessment
                  .premium_adjustment_amount
              )
            : 0,

        effective_date:
          args.transferEffectiveDate,
        requested_at:
          new Date().toISOString(),

        metadata: {
          fraud_risk_score:
            args.assessment.fraud_risk_score,
          manual_review_required:
            args.assessment
              .manual_review_required,
          validation_warnings:
            args.assessment
              .validation_warnings,
          recommendation:
            args.assessment.recommendation,
          source_metadata:
            validObject(args.body.metadata) ?? {},
        },
      })
      .select("*")
      .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create transfer endorsement."
    );
  }

  return data;
}

async function createTransferApproval(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  endorsementId: number;
  transferType: string;
  transferReason: string;
  assessment: TransferAssessment;
}) {
  const { error } =
    await args.adminClient
      .from("insurance_policy_approvals")
      .insert({
        user_id: args.userId,
        policy_id: args.policyId,
        endorsement_id:
          args.endorsementId,
        approval_type:
          "policy_ownership_transfer",
        approval_status: "pending",
        requested_by_role: "customer",
        requested_at:
          new Date().toISOString(),
        approval_notes:
          args.transferReason,
        metadata: {
          transfer_type:
            args.transferType,
          fraud_risk_score:
            args.assessment.fraud_risk_score,
          manual_review_required:
            args.assessment
              .manual_review_required,
          recommendation:
            args.assessment.recommendation,
        },
      });

  if (error) {
    throw new Error(error.message);
  }
}

async function createTransferDocuments(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: any;
  buyerName: string;
  transferType: string;
  transferEffectiveDate: string;
  assessment: TransferAssessment;
}) {
  const documents = [
    {
      document_type:
        "policy_transfer_request",
      document_number:
        `${args.policy.policy_number}-TRANSFER`,
      document_title:
        "Policy Transfer Request",
      document_summary:
        "Ownership transfer request generated for approval.",
    },
    {
      document_type:
        "policy_transfer_assessment",
      document_number:
        `${args.policy.policy_number}-TRANSFER-ASSESSMENT`,
      document_title:
        "Policy Transfer Assessment",
      document_summary:
        "Transfer risk and premium assessment generated.",
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
      Math.max(
        1,
        Number(args.policy.policy_version ?? 1)
      ),
    metadata: {
      endorsement_id:
        args.endorsement.id,
      endorsement_reference:
        args.endorsement.endorsement_reference,
      buyer_name:
        args.buyerName,
      transfer_type:
        args.transferType,
      transfer_effective_date:
        args.transferEffectiveDate,
      assessment:
        args.assessment,
    },
  }));

  const { error } =
    await args.adminClient
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
    TransferPolicyBody["supporting_documents"]
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
        cleanText(
          document.document_type,
          120
        ) ||
        "policy_transfer_supporting_document",
      document_number:
        `TRANSFER-SUPPORT-${args.policyId}-${index + 1}`,
      document_status: "uploaded",
      document_title:
        cleanNullableText(
          document.document_name,
          250
        ),
      document_summary:
        "Supporting document submitted with policy transfer request.",
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

  const { error } =
    await args.adminClient
      .from("insurance_policy_documents")
      .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function writeTransferAudit(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsementId: number;
  transferType: string;
  transferReason: string;
  transferEffectiveDate: string;
  buyerName: string;
  assessment: TransferAssessment;
}) {
  const { error } =
    await args.adminClient
      .from("insurance_policy_audit_log")
      .insert({
        user_id: args.userId,
        policy_id: args.policy.id,
        endorsement_id:
          args.endorsementId,
        action_type:
          "policy_transfer_requested",
        action_status:
          "pending",
        actor_type:
          "authenticated_user",
        actor_reference:
          args.userId,

        previous_values: {
          insured_name:
            args.policy.insured_name,
          policy_status:
            args.policy.policy_status,
          vehicle_registration_number:
            args.policy
              .vehicle_registration_number,
        },

        new_values: {
          buyer_name:
            args.buyerName,
          transfer_type:
            args.transferType,
          transfer_reason:
            args.transferReason,
          transfer_effective_date:
            args.transferEffectiveDate,
          policy_status:
            "pending_approval",
          proposed_total_premium:
            args.assessment
              .proposed_total_premium,
          proposed_ncb_percent:
            args.assessment
              .proposed_ncb_percent,
        },

        metadata: {
          assessment:
            args.assessment,
        },
      });

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackTransfer(args: {
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
      endorsement_status:
        "cancelled",
      rejection_reason:
        "Policy transfer rolled back because a linked operation failed.",
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", args.endorsementId);
}

function normalizeTransferType(
  value: unknown
) {
  const allowed = new Set([
    "vehicle_sale",
    "ownership_change",
    "legal_heir_transfer",
    "company_transfer",
    "other",
  ]);

  const normalized =
    cleanText(value, 80) ||
    "ownership_change";

  return allowed.has(normalized)
    ? normalized
    : "other";
}

function normalizeRcStatus(
  value: unknown
) {
  const allowed = new Set([
    "pending",
    "verified",
    "failed",
    "manual_review",
  ]);

  const normalized =
    cleanText(value, 80) ||
    "pending";

  return allowed.has(normalized)
    ? normalized
    : "pending";
}

function normalizeName(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
    ? roundMoney(numeric)
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
  return Math.round(value * 100) / 100;
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