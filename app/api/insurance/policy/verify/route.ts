import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type VerifyPolicyBody = {
  policy_number?: string | null;
  verification_code?: string | null;
  vehicle_registration_number?: string | null;
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

  selected_addons: Array<Record<string, unknown>>;
  exclusions: Array<Record<string, unknown> | string>;

  grace_period_days: number;
  grace_period_end_date: string | null;

  cancellation_status: string;
  cancellation_effective_date: string | null;

  digital_signature_status: string;
  digital_signature_reference: string | null;
  signed_at: string | null;

  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};

type PolicyDocumentRow = {
  id: number;
  policy_id: number;

  document_type: string;
  document_number: string | null;
  document_status: string;

  document_title: string | null;
  storage_path: string | null;
  version_number: number;

  generated_at: string;
  signed_at: string | null;
  delivered_at: string | null;
};

type VerificationResult = {
  valid: boolean;
  verification_status:
    | "verified"
    | "expired"
    | "cancelled"
    | "suspended"
    | "not_yet_active"
    | "invalid";

  reasons: string[];
  warnings: string[];

  policy: {
    policy_number: string;
    policy_version: number;
    policy_status: string;
    issuance_status: string;
    policy_type: string;
    policy_category: string;
    insurer_name: string | null;

    insured_name_masked: string;

    vehicle_registration_number: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_variant: string | null;
    vehicle_year: number | null;
    vehicle_fuel_type: string | null;

    policy_start_date: string;
    policy_end_date: string;
    issued_at: string | null;

    idv: number | null;
    ncb_percent: number | null;

    digital_signature_status: string;
    signed_at: string | null;
  };

  verification: {
    checked_at: string;
    verification_reference: string;
    verification_code_matched: boolean;
    registration_number_matched: boolean | null;
    document_count: number;
    latest_document_status: string | null;
  };
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

    const body = (await request.json()) as VerifyPolicyBody;

    const policyNumber = normalizePolicyNumber(
      body.policy_number
    );

    const verificationCode = cleanText(
      body.verification_code,
      120
    ).toUpperCase();

    const registrationNumber = normalizeRegistrationNumber(
      body.vehicle_registration_number
    );

    if (!policyNumber) {
      return NextResponse.json(
        { error: "policy_number is required." },
        { status: 400 }
      );
    }

    if (!verificationCode) {
      return NextResponse.json(
        { error: "verification_code is required." },
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

    const policy = await loadPolicyByNumber(
      adminClient as any,
      policyNumber
    );

    if (!policy) {
      return NextResponse.json(
        {
          success: true,
          valid: false,
          verification_status: "invalid",
          reasons: [
            "No policy record matched the supplied policy number.",
          ],
          warnings: [],
          policy: null,
          verification: {
            checked_at: new Date().toISOString(),
            verification_reference:
              generateVerificationReference(),
            verification_code_matched: false,
            registration_number_matched: null,
            document_count: 0,
            latest_document_status: null,
          },
        },
        { status: 200 }
      );
    }

    const documents = await loadPolicyDocuments(
      adminClient as any,
      policy.id
    );

    const result = verifyPolicy({
      policy,
      documents,
      suppliedVerificationCode:
        verificationCode,
      suppliedRegistrationNumber:
        registrationNumber,
    });

    await writeVerificationAudit({
      adminClient: adminClient as any,
      policy,
      result,
      suppliedPolicyNumber: policyNumber,
      suppliedRegistrationNumber:
        registrationNumber,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Policy verification error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify policy.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const policyNumber = request.nextUrl.searchParams.get(
      "policy_number"
    );

    const verificationCode =
      request.nextUrl.searchParams.get(
        "verification_code"
      );

    const vehicleRegistrationNumber =
      request.nextUrl.searchParams.get(
        "vehicle_registration_number"
      );

    const forwardedRequest = new NextRequest(
      request.url,
      {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          policy_number: policyNumber,
          verification_code: verificationCode,
          vehicle_registration_number:
            vehicleRegistrationNumber,
        }),
      }
    );

    return POST(forwardedRequest);
  } catch (error) {
    console.error(
      "Policy verification GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify policy.",
      },
      { status: 500 }
    );
  }
}

async function loadPolicyByNumber(
  adminClient: any,
  policyNumber: string
) {
  const { data, error } = await adminClient
    .from("insurance_policy_records")
    .select("*")
    .eq("policy_number", policyNumber)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PolicyRow | null;
}

async function loadPolicyDocuments(
  adminClient: any,
  policyId: number
) {
  const { data, error } = await adminClient
    .from("insurance_policy_documents")
    .select(
      `
        id,
        policy_id,
        document_type,
        document_number,
        document_status,
        document_title,
        storage_path,
        version_number,
        generated_at,
        signed_at,
        delivered_at
      `
    )
    .eq("policy_id", policyId)
    .order("generated_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PolicyDocumentRow[];
}

function verifyPolicy(args: {
  policy: PolicyRow;
  documents: PolicyDocumentRow[];
  suppliedVerificationCode: string;
  suppliedRegistrationNumber: string | null;
}): VerificationResult {
  const checkedAt = new Date().toISOString();
  const today = new Date(
    `${checkedAt.slice(0, 10)}T00:00:00.000Z`
  );

  const startDate = new Date(
    `${args.policy.policy_start_date}T00:00:00.000Z`
  );

  const endDate = new Date(
    `${args.policy.policy_end_date}T23:59:59.999Z`
  );

  const expectedVerificationCode =
    extractVerificationCode(args.policy);

  const verificationCodeMatched =
    Boolean(expectedVerificationCode) &&
    safeEqual(
      args.suppliedVerificationCode,
      expectedVerificationCode
    );

  const expectedRegistrationNumber =
    normalizeRegistrationNumber(
      args.policy.vehicle_registration_number
    );

  const registrationNumberMatched =
    args.suppliedRegistrationNumber
      ? expectedRegistrationNumber ===
        args.suppliedRegistrationNumber
      : null;

  const reasons: string[] = [];
  const warnings: string[] = [];

  let verificationStatus:
    VerificationResult["verification_status"] =
      "verified";

  let valid = true;

  if (!verificationCodeMatched) {
    valid = false;
    verificationStatus = "invalid";

    reasons.push(
      "The verification code does not match the issued policy record."
    );
  }

  if (
    registrationNumberMatched === false
  ) {
    valid = false;
    verificationStatus = "invalid";

    reasons.push(
      "The supplied vehicle registration number does not match the policy."
    );
  }

  if (
    args.policy.issuance_status !== "issued"
  ) {
    valid = false;
    verificationStatus = "invalid";

    reasons.push(
      "The policy has not reached issued status."
    );
  }

  if (
    args.policy.policy_status === "cancelled" ||
    args.policy.cancellation_status ===
      "approved" ||
    args.policy.cancellation_status ===
      "completed"
  ) {
    valid = false;
    verificationStatus = "cancelled";

    reasons.push(
      "The policy has been cancelled."
    );
  } else if (
    args.policy.policy_status === "suspended"
  ) {
    valid = false;
    verificationStatus = "suspended";

    reasons.push(
      "The policy is currently suspended."
    );
  } else if (
    today.getTime() < startDate.getTime()
  ) {
    valid = false;
    verificationStatus = "not_yet_active";

    reasons.push(
      "The policy coverage period has not started."
    );
  } else if (
    today.getTime() > endDate.getTime()
  ) {
    valid = false;
    verificationStatus = "expired";

    reasons.push(
      "The policy coverage period has expired."
    );
  }

  if (
    args.policy.digital_signature_status !==
    "completed"
  ) {
    warnings.push(
      "The digital-signature process is not complete."
    );
  }

  if (!args.documents.length) {
    warnings.push(
      "No policy documents are linked to this policy."
    );
  }

  const latestDocument =
    args.documents[0] ?? null;

  if (
    latestDocument &&
    ![
      "generated",
      "signed",
      "delivered",
    ].includes(
      latestDocument.document_status
    )
  ) {
    warnings.push(
      "The latest policy document is not in a final document state."
    );
  }

  if (
    valid &&
    reasons.length === 0
  ) {
    reasons.push(
      "Policy number, verification code, issuance status and coverage dates were successfully verified."
    );
  }

  return {
    valid,
    verification_status:
      verificationStatus,

    reasons,
    warnings,

    policy: {
      policy_number:
        args.policy.policy_number,

      policy_version:
        args.policy.policy_version,

      policy_status:
        args.policy.policy_status,

      issuance_status:
        args.policy.issuance_status,

      policy_type:
        args.policy.policy_type,

      policy_category:
        args.policy.policy_category,

      insurer_name:
        args.policy.insurer_name,

      insured_name_masked:
        maskName(
          args.policy.insured_name
        ),

      vehicle_registration_number:
        args.policy
          .vehicle_registration_number,

      vehicle_make:
        args.policy.vehicle_make,

      vehicle_model:
        args.policy.vehicle_model,

      vehicle_variant:
        args.policy.vehicle_variant,

      vehicle_year:
        args.policy.vehicle_year,

      vehicle_fuel_type:
        args.policy.vehicle_fuel_type,

      policy_start_date:
        args.policy.policy_start_date,

      policy_end_date:
        args.policy.policy_end_date,

      issued_at:
        args.policy.issued_at,

      idv:
        args.policy.idv,

      ncb_percent:
        args.policy.ncb_percent,

      digital_signature_status:
        args.policy
          .digital_signature_status,

      signed_at:
        args.policy.signed_at,
    },

    verification: {
      checked_at: checkedAt,

      verification_reference:
        generateVerificationReference(),

      verification_code_matched:
        verificationCodeMatched,

      registration_number_matched:
        registrationNumberMatched,

      document_count:
        args.documents.length,

      latest_document_status:
        latestDocument
          ?.document_status ?? null,
    },
  };
}

function extractVerificationCode(
  policy: PolicyRow
) {
  const metadata =
    validObject(policy.metadata) ?? {};

  const verificationData =
    validObject(
      metadata.qr_verification_data
    );

  return cleanText(
    verificationData?.verification_code,
    120
  ).toUpperCase();
}

async function writeVerificationAudit(args: {
  adminClient: any;
  policy: PolicyRow;
  result: VerificationResult;
  suppliedPolicyNumber: string;
  suppliedRegistrationNumber: string | null;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_audit_log")
    .insert({
      user_id: args.policy.user_id,
      policy_id: args.policy.id,

      action_type:
        "policy_verification_checked",

      action_status:
        args.result.valid
          ? "verified"
          : args.result
              .verification_status,

      actor_type:
        "public_verification",

      actor_name:
        "Policy Verification Engine",

      actor_reference:
        args.result.verification
          .verification_reference,

      previous_values: {},

      new_values: {
        supplied_policy_number:
          args.suppliedPolicyNumber,

        supplied_registration_number:
          args.suppliedRegistrationNumber,

        verification_code_matched:
          args.result.verification
            .verification_code_matched,

        registration_number_matched:
          args.result.verification
            .registration_number_matched,

        verification_status:
          args.result
            .verification_status,

        valid:
          args.result.valid,
      },

      metadata: {
        reasons:
          args.result.reasons,

        warnings:
          args.result.warnings,

        checked_at:
          args.result.verification
            .checked_at,
      },
    });

  if (error) {
    console.error(
      "Unable to write policy verification audit:",
      error.message
    );
  }
}

function normalizePolicyNumber(
  value: unknown
) {
  return cleanText(value, 160)
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeRegistrationNumber(
  value: unknown
) {
  const normalized = cleanText(
    value,
    120
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized || null;
}

function maskName(
  value: string
) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "Unavailable";
  }

  return words
    .map((word) => {
      if (word.length <= 1) {
        return "*";
      }

      if (word.length === 2) {
        return `${word[0]}*`;
      }

      return (
        word[0] +
        "*".repeat(
          Math.max(
            1,
            word.length - 2
          )
        ) +
        word[word.length - 1]
      );
    })
    .join(" ");
}

function safeEqual(
  first: string,
  second: string
) {
  if (
    first.length !== second.length
  ) {
    return false;
  }

  let result = 0;

  for (
    let index = 0;
    index < first.length;
    index += 1
  ) {
    result |=
      first.charCodeAt(index) ^
      second.charCodeAt(index);
  }

  return result === 0;
}

function generateVerificationReference() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const randomPart =
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 10)
      .toUpperCase();

  return (
    `VERIFY-${datePart}-` +
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

function validObject(
  value: unknown
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<
        string,
        unknown
      >
    : null;
}