import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type CreatePolicyBody = {
  proposal_id?: number | null;
  quote_id?: number | null;
  product_id?: number | null;
  vehicle_id?: number;

  policy_number?: string;
  policy_type?: string;
  policy_category?: string;

  insurer_name?: string;
  branch_code?: string;
  intermediary_code?: string;

  insured_name?: string;
  insured_email?: string;
  insured_phone?: string;
  insured_address?: Record<string, unknown>;

  vehicle_registration_number?: string;
  chassis_number?: string;
  engine_number?: string;
  vin?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_variant?: string;
  vehicle_year?: number | null;
  vehicle_fuel_type?: string;
  vehicle_usage_type?: string;

  policy_start_date?: string;
  policy_end_date?: string;

  idv?: number | null;
  total_premium?: number | null;
  net_premium?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  ncb_percent?: number | null;
  ncb_discount_amount?: number | null;

  compulsory_deductible?: number | null;
  voluntary_deductible?: number | null;

  coverage_details?: Record<string, unknown>;
  selected_addons?: Array<Record<string, unknown>>;
  exclusions?: Array<Record<string, unknown> | string>;

  grace_period_days?: number | null;

  drivers?: Array<{
    driver_type?: string;
    full_name: string;
    date_of_birth?: string | null;
    licence_number?: string;
    licence_type?: string;
    licence_issue_date?: string | null;
    licence_expiry_date?: string | null;
    relationship_to_insured?: string;
    years_of_driving_experience?: number | null;
    is_primary_driver?: boolean;
    is_excluded_driver?: boolean;
    risk_attributes?: Record<string, unknown>;
  }>;

  nominees?: Array<{
    nominee_name: string;
    relationship?: string;
    date_of_birth?: string | null;
    contact_number?: string;
    email?: string;
    address?: Record<string, unknown>;
    share_percent?: number | null;
    is_minor?: boolean;
    guardian_name?: string;
    guardian_relationship?: string;
    guardian_contact_number?: string;
  }>;

  beneficiaries?: Array<{
    beneficiary_type: string;
    beneficiary_name: string;
    beneficiary_reference?: string;
    relationship_to_policy?: string;
    share_percent?: number | null;
    bank_details?: Record<string, unknown>;
    contact_details?: Record<string, unknown>;
  }>;

  addons?: Array<{
    addon_id?: number | null;
    addon_code: string;
    addon_name: string;
    premium_amount?: number | null;
    coverage_limit?: number | null;
    effective_from?: string | null;
    effective_to?: string | null;
    terms_snapshot?: Record<string, unknown>;
  }>;

  payment_plan?: {
    payment_plan_type?: string;
    installment_count?: number | null;
    total_payable_amount?: number | null;
    initial_payment_amount?: number | null;
    financed_amount?: number | null;
    interest_rate?: number | null;
    processing_fee?: number | null;
    total_interest_amount?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    installments?: Array<{
      installment_number: number;
      due_date: string;
      installment_amount: number;
    }>;
  };

  metadata?: Record<string, unknown>;
};

type PolicyRecord = {
  id: number;
  user_id: string;
  policy_number: string;
  policy_status: string;
  issuance_status: string;
  renewal_status: string;
  policy_version: number;
  policy_start_date: string;
  policy_end_date: string;
  total_premium: number;
  vehicle_id: number;
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
        { error: "You must be signed in to create a policy." },
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

    const body = (await request.json()) as CreatePolicyBody;

    const validationError = validateBody(body);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
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

    const vehicleId = positiveInteger(body.vehicle_id)!;

    const vehicle = await loadOwnedVehicle(
      adminClient as any,
      vehicleId,
      user.id
    );

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const proposal = body.proposal_id
      ? await loadOwnedRecord(
          adminClient as any,
          "insurance_policy_proposals",
          positiveInteger(body.proposal_id),
          user.id
        )
      : null;

    if (body.proposal_id && !proposal) {
      return NextResponse.json(
        { error: "Proposal was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const quote = body.quote_id
      ? await loadOwnedRecord(
          adminClient as any,
          "insurance_quotes",
          positiveInteger(body.quote_id),
          user.id
        )
      : null;

    if (body.quote_id && !quote) {
      return NextResponse.json(
        { error: "Quote was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const startDate = normalizeRequiredDate(
      body.policy_start_date,
      "policy_start_date"
    );

    const endDate = normalizeRequiredDate(
      body.policy_end_date,
      "policy_end_date"
    );

    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      return NextResponse.json(
        { error: "policy_end_date cannot be before policy_start_date." },
        { status: 400 }
      );
    }

    const policyNumber =
      cleanText(body.policy_number, 120) ||
      generatePolicyNumber();

    const gracePeriodDays = clampInteger(
      body.grace_period_days,
      0,
      365,
      0
    );

    const gracePeriodEndDate =
      gracePeriodDays > 0
        ? addDays(endDate, gracePeriodDays)
        : null;

    const insuredName =
      cleanText(body.insured_name, 250) ||
      cleanText(proposal?.proposer_name, 250);

    if (!insuredName) {
      return NextResponse.json(
        { error: "insured_name is required." },
        { status: 400 }
      );
    }

    const policyPayload = {
      user_id: user.id,
      proposal_id: positiveInteger(body.proposal_id),
      quote_id: positiveInteger(body.quote_id),
      product_id: positiveInteger(body.product_id),
      vehicle_id: vehicleId,

      policy_number: policyNumber,
      policy_status: "pending_approval",
      issuance_status: "pending",
      renewal_status: "not_due",

      policy_type:
        cleanText(body.policy_type, 80) ||
        cleanText(proposal?.policy_type, 80) ||
        "comprehensive",

      policy_category:
        cleanText(body.policy_category, 80) ||
        "private_car",

      insurer_name: cleanNullableText(body.insurer_name, 250),
      branch_code: cleanNullableText(body.branch_code, 120),
      intermediary_code: cleanNullableText(
        body.intermediary_code,
        120
      ),

      insured_name: insuredName,
      insured_email:
        cleanNullableText(body.insured_email, 250) ??
        cleanNullableText(proposal?.proposer_email, 250),

      insured_phone:
        cleanNullableText(body.insured_phone, 80) ??
        cleanNullableText(proposal?.proposer_phone, 80),

      insured_address:
        validObject(body.insured_address) ??
        validObject(proposal?.proposer_address) ??
        {},

      vehicle_registration_number:
        cleanNullableText(body.vehicle_registration_number, 120) ??
        cleanNullableText(vehicle.registration_number, 120),

      chassis_number:
        cleanNullableText(body.chassis_number, 120) ??
        cleanNullableText(vehicle.chassis_number, 120),

      engine_number:
        cleanNullableText(body.engine_number, 120) ??
        cleanNullableText(vehicle.engine_number, 120),

      vin:
        cleanNullableText(body.vin, 120) ??
        cleanNullableText(vehicle.vin, 120),

      vehicle_make:
        cleanNullableText(body.vehicle_make, 120) ??
        cleanNullableText(vehicle.make, 120),

      vehicle_model:
        cleanNullableText(body.vehicle_model, 120) ??
        cleanNullableText(vehicle.model, 120),

      vehicle_variant:
        cleanNullableText(body.vehicle_variant, 120) ??
        cleanNullableText(vehicle.variant, 120),

      vehicle_year:
        cleanYear(body.vehicle_year) ??
        cleanYear(vehicle.year),

      vehicle_fuel_type:
        cleanNullableText(body.vehicle_fuel_type, 80) ??
        cleanNullableText(vehicle.fuel_type, 80),

      vehicle_usage_type:
        cleanNullableText(body.vehicle_usage_type, 80),

      policy_start_date: startDate,
      policy_end_date: endDate,

      idv: cleanMoney(body.idv),
      total_premium: cleanMoney(body.total_premium) ?? 0,
      net_premium:
        cleanMoney(body.net_premium) ??
        cleanMoney(body.total_premium) ??
        0,

      tax_amount: cleanMoney(body.tax_amount) ?? 0,
      discount_amount: cleanMoney(body.discount_amount) ?? 0,
      ncb_percent: cleanPercentage(body.ncb_percent),
      ncb_discount_amount:
        cleanMoney(body.ncb_discount_amount) ?? 0,

      compulsory_deductible:
        cleanMoney(body.compulsory_deductible),

      voluntary_deductible:
        cleanMoney(body.voluntary_deductible),

      coverage_details:
        validObject(body.coverage_details) ?? {},

      selected_addons:
        Array.isArray(body.selected_addons)
          ? body.selected_addons
          : [],

      exclusions:
        Array.isArray(body.exclusions)
          ? body.exclusions
          : [],

      endorsements_summary: [],

      grace_period_days: gracePeriodDays,
      grace_period_end_date: gracePeriodEndDate,

      cancellation_status: "not_requested",
      digital_signature_status: "not_started",

      metadata: validObject(body.metadata) ?? {},
    };

    const { data: policyData, error: policyError } =
      await adminClient
        .from("insurance_policy_records")
        .insert(policyPayload)
        .select("*")
        .single();

    if (policyError || !policyData) {
      return NextResponse.json(
        {
          error:
            policyError?.message ||
            "Unable to create the insurance policy.",
        },
        { status: 500 }
      );
    }

    const policy = policyData as PolicyRecord;

    try {
      await Promise.all([
        createDrivers(
          adminClient as any,
          user.id,
          policy.id,
          body.drivers ?? []
        ),
        createNominees(
          adminClient as any,
          user.id,
          policy.id,
          body.nominees ?? []
        ),
        createBeneficiaries(
          adminClient as any,
          user.id,
          policy.id,
          body.beneficiaries ?? []
        ),
        createAddons(
          adminClient as any,
          user.id,
          policy.id,
          body.addons ?? []
        ),
      ]);

      if (body.payment_plan) {
        await createPaymentPlan(
          adminClient as any,
          user.id,
          policy.id,
          body.payment_plan
        );
      }

      await createInitialDocuments(
        adminClient as any,
        user.id,
        policy
      );

      await createApprovalRequest(
        adminClient as any,
        user.id,
        policy.id,
        body.proposal_id
      );

      if (body.quote_id) {
        await adminClient
          .from("insurance_quotes")
          .update({
            quote_status: "converted",
            converted_to_policy_id: policy.id,
            converted_to_proposal_id:
              positiveInteger(body.proposal_id),
          })
          .eq("id", body.quote_id)
          .eq("user_id", user.id);
      }

      if (body.proposal_id) {
        await adminClient
          .from("insurance_policy_proposals")
          .update({
            proposal_status: "issued",
            approved_at: new Date().toISOString(),
          })
          .eq("id", body.proposal_id)
          .eq("user_id", user.id);
      }

      return NextResponse.json({
        success: true,
        policy_id: policy.id,
        policy_number: policy.policy_number,
        policy_status: policy.policy_status,
        issuance_status: policy.issuance_status,
        renewal_status: policy.renewal_status,
        policy_version: policy.policy_version,
        policy_start_date: policy.policy_start_date,
        policy_end_date: policy.policy_end_date,
        total_premium: policy.total_premium,
        message:
          "Policy created successfully and sent for approval.",
      });
    } catch (linkedDataError) {
      await adminClient
        .from("insurance_policy_records")
        .delete()
        .eq("id", policy.id)
        .eq("user_id", user.id);

      throw linkedDataError;
    }
  } catch (error) {
    console.error("Policy creation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the policy.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedVehicle(
  adminClient: any,
  vehicleId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadOwnedRecord(
  adminClient: any,
  table: string,
  recordId: number | null,
  userId: string
) {
  if (!recordId) return null;

  const { data, error } = await adminClient
    .from(table)
    .select("*")
    .eq("id", recordId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function createDrivers(
  adminClient: any,
  userId: string,
  policyId: number,
  drivers: NonNullable<CreatePolicyBody["drivers"]>
) {
  if (!drivers.length) return;

  const rows = drivers.map((driver) => ({
    user_id: userId,
    policy_id: policyId,
    driver_type:
      cleanText(driver.driver_type, 80) || "named",
    full_name: cleanText(driver.full_name, 250),
    date_of_birth: normalizeOptionalDate(
      driver.date_of_birth
    ),
    licence_number: cleanNullableText(
      driver.licence_number,
      120
    ),
    licence_type: cleanNullableText(
      driver.licence_type,
      80
    ),
    licence_issue_date: normalizeOptionalDate(
      driver.licence_issue_date
    ),
    licence_expiry_date: normalizeOptionalDate(
      driver.licence_expiry_date
    ),
    relationship_to_insured: cleanNullableText(
      driver.relationship_to_insured,
      120
    ),
    years_of_driving_experience:
      cleanNonNegativeNumber(
        driver.years_of_driving_experience
      ),
    is_primary_driver: Boolean(driver.is_primary_driver),
    is_excluded_driver: Boolean(driver.is_excluded_driver),
    risk_attributes:
      validObject(driver.risk_attributes) ?? {},
    validation_status: "pending",
  }));

  const { error } = await adminClient
    .from("insurance_policy_drivers")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createNominees(
  adminClient: any,
  userId: string,
  policyId: number,
  nominees: NonNullable<CreatePolicyBody["nominees"]>
) {
  if (!nominees.length) return;

  const totalShare = nominees.reduce(
    (sum, nominee) =>
      sum + (cleanPercentage(nominee.share_percent) ?? 0),
    0
  );

  if (totalShare > 100.001) {
    throw new Error(
      "Nominee share percentage cannot exceed 100%."
    );
  }

  const rows = nominees.map((nominee) => ({
    user_id: userId,
    policy_id: policyId,
    nominee_name: cleanText(
      nominee.nominee_name,
      250
    ),
    relationship: cleanNullableText(
      nominee.relationship,
      120
    ),
    date_of_birth: normalizeOptionalDate(
      nominee.date_of_birth
    ),
    contact_number: cleanNullableText(
      nominee.contact_number,
      80
    ),
    email: cleanNullableText(nominee.email, 250),
    address: validObject(nominee.address) ?? {},
    share_percent: cleanPercentage(
      nominee.share_percent
    ),
    is_minor: Boolean(nominee.is_minor),
    guardian_name: cleanNullableText(
      nominee.guardian_name,
      250
    ),
    guardian_relationship: cleanNullableText(
      nominee.guardian_relationship,
      120
    ),
    guardian_contact_number: cleanNullableText(
      nominee.guardian_contact_number,
      80
    ),
    verification_status: "pending",
  }));

  const { error } = await adminClient
    .from("insurance_policy_nominees")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createBeneficiaries(
  adminClient: any,
  userId: string,
  policyId: number,
  beneficiaries: NonNullable<
    CreatePolicyBody["beneficiaries"]
  >
) {
  if (!beneficiaries.length) return;

  const totalShare = beneficiaries.reduce(
    (sum, beneficiary) =>
      sum +
      (cleanPercentage(
        beneficiary.share_percent
      ) ?? 0),
    0
  );

  if (totalShare > 100.001) {
    throw new Error(
      "Beneficiary share percentage cannot exceed 100%."
    );
  }

  const rows = beneficiaries.map((beneficiary) => ({
    user_id: userId,
    policy_id: policyId,
    beneficiary_type:
      cleanText(
        beneficiary.beneficiary_type,
        80
      ) || "customer",
    beneficiary_name: cleanText(
      beneficiary.beneficiary_name,
      250
    ),
    beneficiary_reference: cleanNullableText(
      beneficiary.beneficiary_reference,
      250
    ),
    relationship_to_policy: cleanNullableText(
      beneficiary.relationship_to_policy,
      120
    ),
    share_percent: cleanPercentage(
      beneficiary.share_percent
    ),
    bank_details:
      validObject(beneficiary.bank_details) ?? {},
    contact_details:
      validObject(beneficiary.contact_details) ?? {},
    verification_status: "pending",
  }));

  const { error } = await adminClient
    .from("insurance_policy_beneficiaries")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createAddons(
  adminClient: any,
  userId: string,
  policyId: number,
  addons: NonNullable<CreatePolicyBody["addons"]>
) {
  if (!addons.length) return;

  const rows = addons.map((addon) => ({
    user_id: userId,
    policy_id: policyId,
    addon_id: positiveInteger(addon.addon_id),
    addon_code:
      cleanText(addon.addon_code, 120),
    addon_name:
      cleanText(addon.addon_name, 250),
    premium_amount:
      cleanMoney(addon.premium_amount) ?? 0,
    coverage_limit:
      cleanMoney(addon.coverage_limit),
    addon_status: "active",
    effective_from:
      normalizeOptionalDate(addon.effective_from),
    effective_to:
      normalizeOptionalDate(addon.effective_to),
    terms_snapshot:
      validObject(addon.terms_snapshot) ?? {},
    metadata: {},
  }));

  const { error } = await adminClient
    .from("insurance_policy_addons")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createPaymentPlan(
  adminClient: any,
  userId: string,
  policyId: number,
  paymentPlan: NonNullable<
    CreatePolicyBody["payment_plan"]
  >
) {
  const installmentCount = clampInteger(
    paymentPlan.installment_count,
    1,
    60,
    1
  );

  const totalPayableAmount =
    cleanMoney(paymentPlan.total_payable_amount);

  if (totalPayableAmount === null) {
    throw new Error(
      "payment_plan.total_payable_amount is required."
    );
  }

  const { data: plan, error: planError } =
    await adminClient
      .from("insurance_policy_payment_plans")
      .insert({
        user_id: userId,
        policy_id: policyId,
        payment_plan_type:
          cleanText(
            paymentPlan.payment_plan_type,
            80
          ) || "full_payment",
        installment_count: installmentCount,
        total_payable_amount: totalPayableAmount,
        initial_payment_amount:
          cleanMoney(
            paymentPlan.initial_payment_amount
          ),
        financed_amount:
          cleanMoney(paymentPlan.financed_amount),
        interest_rate:
          cleanNonNegativeNumber(
            paymentPlan.interest_rate
          ),
        processing_fee:
          cleanMoney(paymentPlan.processing_fee),
        total_interest_amount:
          cleanMoney(
            paymentPlan.total_interest_amount
          ),
        plan_status: "active",
        start_date:
          normalizeOptionalDate(paymentPlan.start_date),
        end_date:
          normalizeOptionalDate(paymentPlan.end_date),
      })
      .select("*")
      .single();

  if (planError || !plan) {
    throw new Error(
      planError?.message ||
        "Unable to create payment plan."
    );
  }

  const installments = paymentPlan.installments ?? [];

  if (!installments.length) return;

  const installmentTotal = installments.reduce(
    (sum, installment) =>
      sum +
      (cleanMoney(
        installment.installment_amount
      ) ?? 0),
    0
  );

  if (
    Math.abs(installmentTotal - totalPayableAmount) >
    0.01
  ) {
    throw new Error(
      "Installment amounts must equal total_payable_amount."
    );
  }

  const rows = installments.map((installment) => ({
    user_id: userId,
    payment_plan_id: plan.id,
    policy_id: policyId,
    installment_number:
      positiveInteger(
        installment.installment_number
      ),
    due_date: normalizeRequiredDate(
      installment.due_date,
      "installment.due_date"
    ),
    installment_amount:
      cleanMoney(
        installment.installment_amount
      ),
    installment_status: "pending",
    retry_count: 0,
  }));

  const { error } = await adminClient
    .from("insurance_policy_installments")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createInitialDocuments(
  adminClient: any,
  userId: string,
  policy: PolicyRecord
) {
  const documents = [
    {
      document_type: "policy_schedule",
      document_number: policy.policy_number,
      document_title: "Policy Schedule",
      document_summary:
        "Initial policy schedule generated for approval.",
    },
    {
      document_type: "policy_wording",
      document_number: `${policy.policy_number}-WORDING`,
      document_title: "Policy Wording",
      document_summary:
        "Policy wording document placeholder.",
    },
    {
      document_type: "premium_receipt",
      document_number: `${policy.policy_number}-PREMIUM`,
      document_title: "Premium Receipt",
      document_summary:
        "Premium receipt placeholder pending payment completion.",
    },
  ].map((document) => ({
    user_id: userId,
    policy_id: policy.id,
    document_type: document.document_type,
    document_number: document.document_number,
    document_status: "generated",
    document_title: document.document_title,
    document_summary: document.document_summary,
    version_number: policy.policy_version,
    metadata: {
      policy_number: policy.policy_number,
      policy_status: policy.policy_status,
    },
  }));

  const { error } = await adminClient
    .from("insurance_policy_documents")
    .insert(documents);

  if (error) {
    throw new Error(error.message);
  }
}

async function createApprovalRequest(
  adminClient: any,
  userId: string,
  policyId: number,
  proposalId: number | null | undefined
) {
  const { error } = await adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: userId,
      policy_id: policyId,
      proposal_id: positiveInteger(proposalId),
      approval_type: "policy_issuance",
      approval_status: "pending",
      requested_by_role: "customer",
      requested_at: new Date().toISOString(),
      approval_notes:
        "Policy issuance requires authorized insurer approval.",
      metadata: {},
    });

  if (error) {
    throw new Error(error.message);
  }
}

function validateBody(body: CreatePolicyBody) {
  if (!positiveInteger(body.vehicle_id)) {
    return "vehicle_id is required.";
  }

  if (!body.policy_start_date) {
    return "policy_start_date is required.";
  }

  if (!body.policy_end_date) {
    return "policy_end_date is required.";
  }

  if (
    body.drivers?.some(
      (driver) => !cleanText(driver.full_name, 250)
    )
  ) {
    return "Every driver must have a full_name.";
  }

  if (
    body.nominees?.some(
      (nominee) =>
        !cleanText(nominee.nominee_name, 250)
    )
  ) {
    return "Every nominee must have a nominee_name.";
  }

  if (
    body.beneficiaries?.some(
      (beneficiary) =>
        !cleanText(
          beneficiary.beneficiary_type,
          80
        ) ||
        !cleanText(
          beneficiary.beneficiary_name,
          250
        )
    )
  ) {
    return (
      "Every beneficiary must have beneficiary_type " +
      "and beneficiary_name."
    );
  }

  if (
    body.addons?.some(
      (addon) =>
        !cleanText(addon.addon_code, 120) ||
        !cleanText(addon.addon_name, 250)
    )
  ) {
    return "Every add-on must have addon_code and addon_name.";
  }

  return "";
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

function generatePolicyNumber() {
  const date = new Date();
  const datePart = date
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase();

  return `MV-POL-${datePart}-${randomPart}`;
}

function positiveInteger(value: unknown) {
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

function cleanMoney(
  value: unknown
): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[₹,\s]/g, ""))
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

function cleanNonNegativeNumber(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isFinite(numeric) &&
    numeric >= 0
    ? numeric
    : null;
}

function cleanYear(
  value: unknown
): number | null {
  const numeric = Number(value);

  return Number.isInteger(numeric) &&
    numeric >= 1900 &&
    numeric <= 2200
    ? numeric
    : null;
}

function validObject(
  value: unknown
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeRequiredDate(
  value: unknown,
  fieldName: string
) {
  const normalized = normalizeOptionalDate(value);

  if (!normalized) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return normalized;
}

function normalizeOptionalDate(
  value: unknown
) {
  if (!value) return null;

  const raw = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return raw;
}

function addDays(
  dateString: string,
  days: number
) {
  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}