import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type PolicyRow = {
  id: number;
  user_id: string;
  vehicle_id: number;

  policy_number: string;
  policy_version: number;

  policy_status: string;
  issuance_status: string;
  renewal_status: string;

  policy_type: string;
  policy_category: string;

  insurer_name: string | null;

  insured_name: string;
  insured_email: string | null;
  insured_phone: string | null;

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
  total_premium: number;
  net_premium: number;
  tax_amount: number;
  ncb_percent: number | null;

  grace_period_days: number;
  grace_period_end_date: string | null;

  cancellation_status: string;
  digital_signature_status: string;
  signed_at: string | null;

  created_at: string;
  updated_at: string;
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

type EndorsementRow = {
  id: number;
  policy_id: number;
  endorsement_reference: string | null;
  endorsement_type: string;
  endorsement_status: string;

  premium_difference: number;
  tax_difference: number;
  refund_amount: number;

  effective_date: string | null;
  approved_at: string | null;
  rejected_at: string | null;

  created_at: string;
};

type RenewalRow = {
  id: number;
  current_policy_id: number;
  renewed_policy_id: number | null;

  renewal_reference: string | null;
  renewal_status: string;

  renewal_due_date: string;
  grace_period_end_date: string | null;

  proposed_idv: number | null;
  proposed_total_premium: number | null;
  proposed_ncb_percent: number | null;

  retention_risk_score: number | null;
  renewal_probability: number | null;

  renewed_at: string | null;
  declined_at: string | null;

  created_at: string;
};

type PaymentPlanRow = {
  id: number;
  policy_id: number;

  payment_plan_type: string;
  installment_count: number;

  total_payable_amount: number;
  initial_payment_amount: number | null;
  financed_amount: number | null;

  interest_rate: number | null;
  processing_fee: number | null;
  total_interest_amount: number | null;

  plan_status: string;
  start_date: string | null;
  end_date: string | null;

  created_at: string;
  updated_at: string;
};

type InstallmentRow = {
  id: number;
  payment_plan_id: number;
  policy_id: number;

  installment_number: number;
  due_date: string;
  installment_amount: number;

  installment_status: string;

  payment_reference: string | null;
  paid_amount: number | null;
  paid_at: string | null;

  failure_reason: string | null;
  retry_count: number;

  created_at: string;
  updated_at: string;
};

type WalletPolicy = {
  policy: PolicyRow;

  health: {
    is_active: boolean;
    is_expired: boolean;
    is_expiring_soon: boolean;
    days_to_expiry: number;
    is_in_grace_period: boolean;
    documents_complete: boolean;
    signature_complete: boolean;
    payment_plan_active: boolean;
    pending_installments: number;
    overdue_installments: number;
    open_endorsements: number;
    renewal_due: boolean;
  };

  documents: PolicyDocumentRow[];
  endorsements: EndorsementRow[];
  renewals: RenewalRow[];
  payment_plans: Array<
    PaymentPlanRow & {
      installments: InstallmentRow[];
    }
  >;

  quick_actions: Array<{
    code: string;
    label: string;
    enabled: boolean;
    reason?: string;
  }>;
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
            "You must be signed in to view the policy wallet.",
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

    const policyId = positiveInteger(
      request.nextUrl.searchParams.get("policy_id")
    );

    const vehicleId = positiveInteger(
      request.nextUrl.searchParams.get("vehicle_id")
    );

    const includeInactive =
      request.nextUrl.searchParams.get(
        "include_inactive"
      ) === "true";

    const limit = clampInteger(
      request.nextUrl.searchParams.get("limit"),
      1,
      100,
      50
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

    const policies = await loadPolicies({
      adminClient: adminClient as any,
      userId: user.id,
      policyId,
      vehicleId,
      includeInactive,
      limit,
    });

    if (!policies.length) {
      return NextResponse.json({
        success: true,
        generated_at: new Date().toISOString(),
        total_policies: 0,
        wallet: [],
        summary: emptySummary(),
      });
    }

    const policyIds = policies.map(
      (policy) => policy.id
    );

    const [
      documents,
      endorsements,
      renewals,
      paymentPlans,
      installments,
    ] = await Promise.all([
      loadDocuments(
        adminClient as any,
        user.id,
        policyIds
      ),
      loadEndorsements(
        adminClient as any,
        user.id,
        policyIds
      ),
      loadRenewals(
        adminClient as any,
        user.id,
        policyIds
      ),
      loadPaymentPlans(
        adminClient as any,
        user.id,
        policyIds
      ),
      loadInstallments(
        adminClient as any,
        user.id,
        policyIds
      ),
    ]);

    const wallet = policies.map((policy) =>
      buildWalletPolicy({
        policy,
        documents: documents.filter(
          (document) =>
            document.policy_id === policy.id
        ),
        endorsements: endorsements.filter(
          (endorsement) =>
            endorsement.policy_id === policy.id
        ),
        renewals: renewals.filter(
          (renewal) =>
            renewal.current_policy_id === policy.id
        ),
        paymentPlans: paymentPlans.filter(
          (plan) => plan.policy_id === policy.id
        ),
        installments: installments.filter(
          (installment) =>
            installment.policy_id === policy.id
        ),
      })
    );

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      total_policies: wallet.length,
      summary: buildSummary(wallet),
      wallet,
    });
  } catch (error) {
    console.error("Policy wallet error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the policy wallet.",
      },
      { status: 500 }
    );
  }
}

async function loadPolicies(args: {
  adminClient: any;
  userId: string;
  policyId: number | null;
  vehicleId: number | null;
  includeInactive: boolean;
  limit: number;
}) {
  let query = args.adminClient
    .from("insurance_policy_records")
    .select("*")
    .eq("user_id", args.userId)
    .order("policy_end_date", {
      ascending: false,
    })
    .limit(args.limit);

  if (args.policyId) {
    query = query.eq("id", args.policyId);
  }

  if (args.vehicleId) {
    query = query.eq(
      "vehicle_id",
      args.vehicleId
    );
  }

  if (!args.includeInactive) {
    query = query.in(
      "policy_status",
      [
        "active",
        "pending_approval",
        "grace_period",
        "suspended",
      ]
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PolicyRow[];
}

async function loadDocuments(
  adminClient: any,
  userId: string,
  policyIds: number[]
) {
  const { data, error } = await adminClient
    .from("insurance_policy_documents")
    .select("*")
    .eq("user_id", userId)
    .in("policy_id", policyIds)
    .order("generated_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PolicyDocumentRow[];
}

async function loadEndorsements(
  adminClient: any,
  userId: string,
  policyIds: number[]
) {
  const { data, error } = await adminClient
    .from("insurance_policy_endorsements")
    .select(
      `
        id,
        policy_id,
        endorsement_reference,
        endorsement_type,
        endorsement_status,
        premium_difference,
        tax_difference,
        refund_amount,
        effective_date,
        approved_at,
        rejected_at,
        created_at
      `
    )
    .eq("user_id", userId)
    .in("policy_id", policyIds)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EndorsementRow[];
}

async function loadRenewals(
  adminClient: any,
  userId: string,
  policyIds: number[]
) {
  const { data, error } = await adminClient
    .from("insurance_policy_renewals")
    .select("*")
    .eq("user_id", userId)
    .in("current_policy_id", policyIds)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RenewalRow[];
}

async function loadPaymentPlans(
  adminClient: any,
  userId: string,
  policyIds: number[]
) {
  const { data, error } = await adminClient
    .from("insurance_policy_payment_plans")
    .select("*")
    .eq("user_id", userId)
    .in("policy_id", policyIds)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PaymentPlanRow[];
}

async function loadInstallments(
  adminClient: any,
  userId: string,
  policyIds: number[]
) {
  const { data, error } = await adminClient
    .from("insurance_policy_installments")
    .select("*")
    .eq("user_id", userId)
    .in("policy_id", policyIds)
    .order("due_date", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as InstallmentRow[];
}

function buildWalletPolicy(args: {
  policy: PolicyRow;
  documents: PolicyDocumentRow[];
  endorsements: EndorsementRow[];
  renewals: RenewalRow[];
  paymentPlans: PaymentPlanRow[];
  installments: InstallmentRow[];
}): WalletPolicy {
  const today = startOfUtcDay(new Date());

  const endDate = startOfUtcDay(
    new Date(
      `${args.policy.policy_end_date}T00:00:00.000Z`
    )
  );

  const daysToExpiry = Math.ceil(
    (endDate.getTime() - today.getTime()) /
      86400000
  );

  const isExpired = daysToExpiry < 0;
  const isExpiringSoon =
    daysToExpiry >= 0 &&
    daysToExpiry <= 30;

  const isInGracePeriod =
    args.policy.policy_status ===
      "grace_period" ||
    Boolean(
      args.policy.grace_period_end_date &&
      new Date(
        `${args.policy.grace_period_end_date}T00:00:00.000Z`
      ).getTime() >= today.getTime() &&
      isExpired
    );

  const requiredDocumentTypes = new Set([
    "policy_schedule",
    "policy_certificate",
    "premium_receipt",
  ]);

  const availableDocumentTypes = new Set(
    args.documents
      .filter((document) =>
        [
          "generated",
          "signed",
          "delivered",
        ].includes(document.document_status)
      )
      .map((document) => document.document_type)
  );

  const documentsComplete =
    Array.from(requiredDocumentTypes).every(
      (documentType) =>
        availableDocumentTypes.has(
          documentType
        )
    );

  const pendingInstallments =
    args.installments.filter((installment) =>
      ["pending", "due"].includes(
        installment.installment_status
      )
    ).length;

  const overdueInstallments =
    args.installments.filter(
      (installment) =>
        installment.installment_status ===
          "overdue" ||
        (
          installment.installment_status ===
            "pending" &&
          new Date(
            `${installment.due_date}T00:00:00.000Z`
          ).getTime() < today.getTime()
        )
    ).length;

  const openEndorsements =
    args.endorsements.filter(
      (endorsement) =>
        ![
          "approved",
          "issued",
          "rejected",
          "cancelled",
        ].includes(
          endorsement.endorsement_status
        )
    ).length;

  const latestRenewal =
    args.renewals[0] ?? null;

  const renewalDue =
    isExpiringSoon ||
    isExpired ||
    Boolean(
      latestRenewal &&
      [
        "due",
        "reminder_sent",
        "quote_generated",
        "payment_pending",
      ].includes(
        latestRenewal.renewal_status
      )
    );

  const enrichedPaymentPlans =
    args.paymentPlans.map((plan) => ({
      ...plan,
      installments:
        args.installments.filter(
          (installment) =>
            installment.payment_plan_id ===
            plan.id
        ),
    }));

  const health = {
    is_active:
      args.policy.policy_status === "active",
    is_expired: isExpired,
    is_expiring_soon: isExpiringSoon,
    days_to_expiry: daysToExpiry,
    is_in_grace_period: isInGracePeriod,
    documents_complete: documentsComplete,
    signature_complete:
      args.policy.digital_signature_status ===
      "completed",
    payment_plan_active:
      enrichedPaymentPlans.some(
        (plan) =>
          plan.plan_status === "active"
      ),
    pending_installments:
      pendingInstallments,
    overdue_installments:
      overdueInstallments,
    open_endorsements:
      openEndorsements,
    renewal_due:
      renewalDue,
  };

  return {
    policy: args.policy,
    health,
    documents: args.documents,
    endorsements: args.endorsements,
    renewals: args.renewals,
    payment_plans:
      enrichedPaymentPlans,
    quick_actions:
      buildQuickActions(
        args.policy,
        health
      ),
  };
}

function buildQuickActions(
  policy: PolicyRow,
  health: WalletPolicy["health"]
) {
  return [
    {
      code: "view_documents",
      label: "View Documents",
      enabled: true,
    },
    {
      code: "download_policy",
      label: "Download Policy",
      enabled:
        health.documents_complete,
      reason:
        health.documents_complete
          ? undefined
          : "Required policy documents are not complete.",
    },
    {
      code: "renew_policy",
      label: "Renew Policy",
      enabled:
        health.renewal_due &&
        policy.policy_status !==
          "cancelled",
      reason:
        health.renewal_due
          ? undefined
          : "Policy renewal is not due yet.",
    },
    {
      code: "update_policy",
      label: "Update Policy",
      enabled:
        ![
          "cancelled",
          "expired",
          "renewed",
        ].includes(
          policy.policy_status
        ),
      reason:
        [
          "cancelled",
          "expired",
          "renewed",
        ].includes(
          policy.policy_status
        )
          ? "This policy cannot be updated."
          : undefined,
    },
    {
      code: "request_endorsement",
      label: "Request Endorsement",
      enabled:
        policy.policy_status ===
          "active" ||
        policy.policy_status ===
          "suspended",
    },
    {
      code: "cancel_policy",
      label: "Cancel Policy",
      enabled:
        ![
          "cancelled",
          "expired",
          "renewed",
        ].includes(
          policy.policy_status
        ) &&
        policy.cancellation_status !==
          "requested",
    },
    {
      code: "pay_installment",
      label: "Pay Installment",
      enabled:
        health.pending_installments > 0,
      reason:
        health.pending_installments > 0
          ? undefined
          : "No pending installments.",
    },
    {
      code: "sign_policy",
      label: "Sign Policy",
      enabled:
        !health.signature_complete,
      reason:
        health.signature_complete
          ? "Policy is already signed."
          : undefined,
    },
  ];
}

function buildSummary(
  wallet: WalletPolicy[]
) {
  return {
    active_policies:
      wallet.filter(
        (item) =>
          item.policy.policy_status ===
          "active"
      ).length,

    expiring_soon:
      wallet.filter(
        (item) =>
          item.health.is_expiring_soon
      ).length,

    expired_policies:
      wallet.filter(
        (item) =>
          item.health.is_expired
      ).length,

    grace_period_policies:
      wallet.filter(
        (item) =>
          item.health.is_in_grace_period
      ).length,

    renewal_due:
      wallet.filter(
        (item) =>
          item.health.renewal_due
      ).length,

    pending_endorsements:
      wallet.reduce(
        (sum, item) =>
          sum +
          item.health.open_endorsements,
        0
      ),

    pending_installments:
      wallet.reduce(
        (sum, item) =>
          sum +
          item.health.pending_installments,
        0
      ),

    overdue_installments:
      wallet.reduce(
        (sum, item) =>
          sum +
          item.health.overdue_installments,
        0
      ),

    unsigned_policies:
      wallet.filter(
        (item) =>
          !item.health.signature_complete
      ).length,

    incomplete_documents:
      wallet.filter(
        (item) =>
          !item.health.documents_complete
      ).length,

    total_idv:
      roundMoney(
        wallet.reduce(
          (sum, item) =>
            sum +
            numberOrZero(
              item.policy.idv
            ),
          0
        )
      ),

    total_premium:
      roundMoney(
        wallet.reduce(
          (sum, item) =>
            sum +
            numberOrZero(
              item.policy.total_premium
            ),
          0
        )
      ),
  };
}

function emptySummary() {
  return {
    active_policies: 0,
    expiring_soon: 0,
    expired_policies: 0,
    grace_period_policies: 0,
    renewal_due: 0,
    pending_endorsements: 0,
    pending_installments: 0,
    overdue_installments: 0,
    unsigned_policies: 0,
    incomplete_documents: 0,
    total_idv: 0,
    total_premium: 0,
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

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, numeric)
  );
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

function startOfUtcDay(
  date: Date
) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}