import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type GeneratePolicyDocumentBody = {
  policy_id?: number;

  document_type?:
    | "policy_schedule"
    | "policy_certificate"
    | "renewal_notice"
    | "endorsement_schedule"
    | "premium_receipt"
    | "cancellation_notice"
    | "suspension_notice"
    | "reinstatement_notice"
    | "transfer_schedule"
    | "custom";

  endorsement_id?: number | null;

  document_title?: string | null;
  document_summary?: string | null;

  regenerate?: boolean;
  mark_as_signed?: boolean;
  mark_as_delivered?: boolean;

  storage_path?: string | null;

  metadata?: Record<string, unknown>;
};

type PolicyRow = {
  id: number;
  user_id: string;
  policy_number: string;
  policy_version: number;

  policy_status: string;
  issuance_status: string;
  renewal_status: string;

  policy_type: string;
  policy_category: string;

  insurer_name: string | null;
  branch_code: string | null;
  intermediary_code: string | null;

  insured_name: string;
  insured_email: string | null;
  insured_phone: string | null;
  insured_address: Record<string, unknown> | null;

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
  issued_at: string | null;

  idv: number | null;
  total_premium: number;
  net_premium: number;
  tax_amount: number;
  discount_amount: number;
  ncb_percent: number | null;
  ncb_discount_amount: number;

  compulsory_deductible: number | null;
  voluntary_deductible: number | null;

  coverage_details: Record<string, unknown> | null;
  selected_addons: Array<Record<string, unknown>> | null;
  exclusions: Array<Record<string, unknown> | string> | null;
  endorsements_summary: Array<Record<string, unknown>> | null;

  grace_period_days: number;
  grace_period_end_date: string | null;

  cancellation_status: string;
  cancellation_effective_date: string | null;
  cancellation_reason: string | null;
  cancellation_refund_amount: number | null;

  digital_signature_status: string;
  digital_signature_reference: string | null;
  signed_at: string | null;

  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
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
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown> | null;
};

type PolicyDocumentRow = {
  id: number;
  user_id: string;
  policy_id: number;
  document_type: string;
  document_number: string | null;
  document_status: string;
  document_title: string | null;
  document_summary: string | null;
  storage_path: string | null;
  version_number: number;
  generated_at: string;
  signed_at: string | null;
  delivered_at: string | null;
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
            "You must be signed in to generate a policy document.",
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

    const body = (await request.json()) as GeneratePolicyDocumentBody;

    const policyId = positiveInteger(body.policy_id);

    if (!policyId) {
      return NextResponse.json(
        { error: "policy_id is required." },
        { status: 400 }
      );
    }

    const documentType = normalizeDocumentType(
      body.document_type
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

    const eligibilityError = validateDocumentEligibility(
      policy,
      documentType
    );

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError },
        { status: 409 }
      );
    }

    const endorsement = body.endorsement_id
      ? await loadOwnedEndorsement(
          adminClient as any,
          positiveInteger(body.endorsement_id),
          policy.id,
          user.id
        )
      : null;

    if (body.endorsement_id && !endorsement) {
      return NextResponse.json(
        {
          error:
            "Endorsement was not found or does not belong to this policy.",
        },
        { status: 404 }
      );
    }

    const documentVersion = await resolveDocumentVersion({
      adminClient: adminClient as any,
      userId: user.id,
      policyId: policy.id,
      documentType,
      regenerate: Boolean(body.regenerate),
    });

    const documentNumber = buildDocumentNumber(
      policy,
      documentType,
      documentVersion,
      endorsement
    );

    const title =
      cleanText(body.document_title, 250) ||
      defaultDocumentTitle(documentType);

    const summary =
      cleanText(body.document_summary, 2000) ||
      defaultDocumentSummary(
        documentType,
        policy,
        endorsement
      );

    const generatedAt = new Date().toISOString();

    const documentPayload = buildDocumentPayload({
      policy,
      endorsement,
      documentType,
      documentNumber,
      documentVersion,
      title,
      summary,
      generatedAt,
      metadata: validObject(body.metadata) ?? {},
    });

    const storagePath =
      cleanNullableText(body.storage_path, 2000) ??
      buildSuggestedStoragePath(
        policy,
        documentType,
        documentVersion
      );

    const documentStatus =
      body.mark_as_signed
        ? "signed"
        : body.mark_as_delivered
          ? "delivered"
          : "generated";

    const { data: documentData, error: documentError } =
      await adminClient
        .from("insurance_policy_documents")
        .insert({
          user_id: user.id,
          policy_id: policy.id,
          document_type: documentType,
          document_number: documentNumber,
          document_status: documentStatus,
          document_title: title,
          document_summary: summary,
          storage_path: storagePath,
          version_number: documentVersion,
          generated_at: generatedAt,
          signed_at:
            body.mark_as_signed
              ? generatedAt
              : null,
          delivered_at:
            body.mark_as_delivered
              ? generatedAt
              : null,
          metadata: documentPayload,
        })
        .select("*")
        .single();

    if (documentError || !documentData) {
      return NextResponse.json(
        {
          error:
            documentError?.message ||
            "Unable to create policy document record.",
        },
        { status: 500 }
      );
    }

    const document = documentData as PolicyDocumentRow;

    try {
      if (body.mark_as_signed) {
        await updatePolicySignatureStatus({
          adminClient: adminClient as any,
          userId: user.id,
          policy,
          document,
        });
      }

      await writeDocumentAudit({
        adminClient: adminClient as any,
        userId: user.id,
        policy,
        endorsement,
        document,
        documentPayload,
      });

      return NextResponse.json({
        success: true,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        document_id: document.id,
        document_type: document.document_type,
        document_number: document.document_number,
        document_status: document.document_status,
        document_title: document.document_title,
        document_summary: document.document_summary,
        storage_path: document.storage_path,
        version_number: document.version_number,
        generated_at: document.generated_at,
        signed_at: document.signed_at,
        delivered_at: document.delivered_at,
        document_payload: documentPayload,
        message:
          "Policy document generated successfully.",
      });
    } catch (linkedOperationError) {
      await adminClient
        .from("insurance_policy_documents")
        .delete()
        .eq("id", document.id)
        .eq("user_id", user.id);

      throw linkedOperationError;
    }
  } catch (error) {
    console.error("Policy document generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the policy document.",
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

async function loadOwnedEndorsement(
  adminClient: any,
  endorsementId: number | null,
  policyId: number,
  userId: string
) {
  if (!endorsementId) {
    return null;
  }

  const { data, error } = await adminClient
    .from("insurance_policy_endorsements")
    .select("*")
    .eq("id", endorsementId)
    .eq("policy_id", policyId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as EndorsementRow | null;
}

function validateDocumentEligibility(
  policy: PolicyRow,
  documentType: string
) {
  if (
    documentType === "policy_certificate" &&
    policy.issuance_status !== "issued"
  ) {
    return (
      "Policy certificate can only be generated after policy issuance."
    );
  }

  if (
    documentType === "cancellation_notice" &&
    ![
      "requested",
      "approved",
      "completed",
    ].includes(policy.cancellation_status)
  ) {
    return (
      "Cancellation notice requires a cancellation request or approval."
    );
  }

  if (
    documentType === "suspension_notice" &&
    ![
      "suspended",
      "pending_approval",
    ].includes(policy.policy_status)
  ) {
    return (
      "Suspension notice requires a suspended or pending-approval policy."
    );
  }

  if (
    documentType === "reinstatement_notice" &&
    policy.policy_status !== "active"
  ) {
    return (
      "Reinstatement notice requires an active policy."
    );
  }

  return "";
}

async function resolveDocumentVersion(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  documentType: string;
  regenerate: boolean;
}) {
  const { data, error } = await args.adminClient
    .from("insurance_policy_documents")
    .select("version_number")
    .eq("policy_id", args.policyId)
    .eq("user_id", args.userId)
    .eq("document_type", args.documentType)
    .order("version_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return 1;
  }

  if (!args.regenerate) {
    throw new Error(
      "A document of this type already exists. Set regenerate=true to create a new version."
    );
  }

  return Number(data.version_number ?? 0) + 1;
}

function buildDocumentNumber(
  policy: PolicyRow,
  documentType: string,
  version: number,
  endorsement: EndorsementRow | null
) {
  const suffixMap: Record<string, string> = {
    policy_schedule: "SCHEDULE",
    policy_certificate: "CERT",
    renewal_notice: "RENEWAL",
    endorsement_schedule: "ENDORSEMENT",
    premium_receipt: "RECEIPT",
    cancellation_notice: "CANCEL",
    suspension_notice: "SUSPEND",
    reinstatement_notice: "REINSTATE",
    transfer_schedule: "TRANSFER",
    custom: "CUSTOM",
  };

  const suffix =
    suffixMap[documentType] ?? "DOCUMENT";

  const endorsementPart =
    endorsement?.id
      ? `-EN${endorsement.id}`
      : "";

  return (
    `${policy.policy_number}-${suffix}` +
    `${endorsementPart}-V${version}`
  );
}

function buildSuggestedStoragePath(
  policy: PolicyRow,
  documentType: string,
  version: number
) {
  const safePolicyNumber =
    policy.policy_number
      .replace(/[^a-zA-Z0-9_-]/g, "_");

  return (
    `insurance-policies/${policy.user_id}/` +
    `${safePolicyNumber}/${documentType}-v${version}.pdf`
  );
}

function buildDocumentPayload(args: {
  policy: PolicyRow;
  endorsement: EndorsementRow | null;
  documentType: string;
  documentNumber: string;
  documentVersion: number;
  title: string;
  summary: string;
  generatedAt: string;
  metadata: Record<string, unknown>;
}) {
  return {
    document: {
      document_type: args.documentType,
      document_number: args.documentNumber,
      document_version: args.documentVersion,
      document_title: args.title,
      document_summary: args.summary,
      generated_at: args.generatedAt,
    },

    insurer: {
      insurer_name: args.policy.insurer_name,
      branch_code: args.policy.branch_code,
      intermediary_code:
        args.policy.intermediary_code,
    },

    insured: {
      insured_name: args.policy.insured_name,
      insured_email: args.policy.insured_email,
      insured_phone: args.policy.insured_phone,
      insured_address:
        args.policy.insured_address ?? {},
    },

    policy: {
      policy_id: args.policy.id,
      policy_number:
        args.policy.policy_number,
      policy_version:
        args.policy.policy_version,
      policy_status:
        args.policy.policy_status,
      issuance_status:
        args.policy.issuance_status,
      renewal_status:
        args.policy.renewal_status,
      policy_type:
        args.policy.policy_type,
      policy_category:
        args.policy.policy_category,
      policy_start_date:
        args.policy.policy_start_date,
      policy_end_date:
        args.policy.policy_end_date,
      issued_at:
        args.policy.issued_at,
      grace_period_days:
        args.policy.grace_period_days,
      grace_period_end_date:
        args.policy.grace_period_end_date,
    },

    vehicle: {
      registration_number:
        args.policy.vehicle_registration_number,
      chassis_number:
        args.policy.chassis_number,
      engine_number:
        args.policy.engine_number,
      vin:
        args.policy.vin,
      make:
        args.policy.vehicle_make,
      model:
        args.policy.vehicle_model,
      variant:
        args.policy.vehicle_variant,
      year:
        args.policy.vehicle_year,
      fuel_type:
        args.policy.vehicle_fuel_type,
      usage_type:
        args.policy.vehicle_usage_type,
    },

    premium: {
      idv:
        args.policy.idv,
      total_premium:
        args.policy.total_premium,
      net_premium:
        args.policy.net_premium,
      tax_amount:
        args.policy.tax_amount,
      discount_amount:
        args.policy.discount_amount,
      ncb_percent:
        args.policy.ncb_percent,
      ncb_discount_amount:
        args.policy.ncb_discount_amount,
      compulsory_deductible:
        args.policy.compulsory_deductible,
      voluntary_deductible:
        args.policy.voluntary_deductible,
    },

    coverage: {
      coverage_details:
        args.policy.coverage_details ?? {},
      selected_addons:
        args.policy.selected_addons ?? [],
      exclusions:
        args.policy.exclusions ?? [],
    },

    cancellation: {
      cancellation_status:
        args.policy.cancellation_status,
      cancellation_effective_date:
        args.policy.cancellation_effective_date,
      cancellation_reason:
        args.policy.cancellation_reason,
      cancellation_refund_amount:
        args.policy.cancellation_refund_amount,
    },

    signature: {
      digital_signature_status:
        args.policy.digital_signature_status,
      digital_signature_reference:
        args.policy.digital_signature_reference,
      signed_at:
        args.policy.signed_at,
    },

    endorsement: args.endorsement
      ? {
          endorsement_id:
            args.endorsement.id,
          endorsement_reference:
            args.endorsement
              .endorsement_reference,
          endorsement_type:
            args.endorsement.endorsement_type,
          endorsement_status:
            args.endorsement.endorsement_status,
          effective_date:
            args.endorsement.effective_date,
          approved_at:
            args.endorsement.approved_at,
          approved_values:
            args.endorsement.approved_values ?? {},
          premium_difference:
            args.endorsement.premium_difference,
          tax_difference:
            args.endorsement.tax_difference,
          refund_amount:
            args.endorsement.refund_amount,
        }
      : null,

    metadata: args.metadata,
  };
}

async function updatePolicySignatureStatus(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  document: PolicyDocumentRow;
}) {
  const signedAt = new Date().toISOString();

  const { error } = await args.adminClient
    .from("insurance_policy_records")
    .update({
      digital_signature_status: "completed",
      digital_signature_reference:
        args.document.document_number,
      signed_at: signedAt,
      updated_at: signedAt,
    })
    .eq("id", args.policy.id)
    .eq("user_id", args.userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function writeDocumentAudit(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  endorsement: EndorsementRow | null;
  document: PolicyDocumentRow;
  documentPayload: Record<string, unknown>;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_audit_log")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      endorsement_id:
        args.endorsement?.id ?? null,
      action_type:
        "policy_document_generated",
      action_status:
        args.document.document_status,
      actor_type:
        "authenticated_user",
      actor_reference:
        args.userId,
      previous_values: {},
      new_values: {
        document_id:
          args.document.id,
        document_type:
          args.document.document_type,
        document_number:
          args.document.document_number,
        document_status:
          args.document.document_status,
        version_number:
          args.document.version_number,
        storage_path:
          args.document.storage_path,
      },
      metadata: {
        document_payload:
          args.documentPayload,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeDocumentType(
  value: unknown
) {
  const allowed = new Set([
    "policy_schedule",
    "policy_certificate",
    "renewal_notice",
    "endorsement_schedule",
    "premium_receipt",
    "cancellation_notice",
    "suspension_notice",
    "reinstatement_notice",
    "transfer_schedule",
    "custom",
  ]);

  const normalized =
    cleanText(value, 120) ||
    "policy_schedule";

  return allowed.has(normalized)
    ? normalized
    : "custom";
}

function defaultDocumentTitle(
  documentType: string
) {
  const titles: Record<string, string> = {
    policy_schedule: "Policy Schedule",
    policy_certificate: "Policy Certificate",
    renewal_notice: "Policy Renewal Notice",
    endorsement_schedule: "Endorsement Schedule",
    premium_receipt: "Premium Receipt",
    cancellation_notice: "Policy Cancellation Notice",
    suspension_notice: "Policy Suspension Notice",
    reinstatement_notice: "Policy Reinstatement Notice",
    transfer_schedule: "Policy Transfer Schedule",
    custom: "Policy Document",
  };

  return titles[documentType] ?? "Policy Document";
}

function defaultDocumentSummary(
  documentType: string,
  policy: PolicyRow,
  endorsement: EndorsementRow | null
) {
  const base =
    `${defaultDocumentTitle(documentType)} for ` +
    `policy ${policy.policy_number}.`;

  if (!endorsement) {
    return base;
  }

  return (
    `${base} Linked to endorsement ` +
    `${endorsement.endorsement_reference ?? endorsement.id}.`
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

function validObject(
  value: unknown
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}