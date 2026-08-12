import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type PolicyUpdateBody = {
  policy_id?: number;

  update_reason?: string;
  effective_date?: string | null;

  policy_type?: string;
  policy_category?: string;

  insurer_name?: string | null;
  branch_code?: string | null;
  intermediary_code?: string | null;

  insured_name?: string;
  insured_email?: string | null;
  insured_phone?: string | null;
  insured_address?: Record<string, unknown>;

  vehicle_registration_number?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  vin?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_variant?: string | null;
  vehicle_year?: number | null;
  vehicle_fuel_type?: string | null;
  vehicle_usage_type?: string | null;

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
    id?: number | null;
    action?: "upsert" | "delete";
    driver_type?: string;
    full_name?: string;
    date_of_birth?: string | null;
    licence_number?: string | null;
    licence_type?: string | null;
    licence_issue_date?: string | null;
    licence_expiry_date?: string | null;
    relationship_to_insured?: string | null;
    years_of_driving_experience?: number | null;
    is_primary_driver?: boolean;
    is_excluded_driver?: boolean;
    risk_attributes?: Record<string, unknown>;
  }>;

  nominees?: Array<{
    id?: number | null;
    action?: "upsert" | "delete";
    nominee_name?: string;
    relationship?: string | null;
    date_of_birth?: string | null;
    contact_number?: string | null;
    email?: string | null;
    address?: Record<string, unknown>;
    share_percent?: number | null;
    is_minor?: boolean;
    guardian_name?: string | null;
    guardian_relationship?: string | null;
    guardian_contact_number?: string | null;
  }>;

  beneficiaries?: Array<{
    id?: number | null;
    action?: "upsert" | "delete";
    beneficiary_type?: string;
    beneficiary_name?: string;
    beneficiary_reference?: string | null;
    relationship_to_policy?: string | null;
    share_percent?: number | null;
    bank_details?: Record<string, unknown>;
    contact_details?: Record<string, unknown>;
  }>;

  addons?: Array<{
    id?: number | null;
    action?: "upsert" | "delete";
    addon_id?: number | null;
    addon_code?: string;
    addon_name?: string;
    premium_amount?: number | null;
    coverage_limit?: number | null;
    addon_status?: string;
    effective_from?: string | null;
    effective_to?: string | null;
    terms_snapshot?: Record<string, unknown>;
  }>;

  metadata?: Record<string, unknown>;
};

type PolicyRow = {
  id: number;
  user_id: string;
  policy_number: string;
  policy_status: string;
  issuance_status: string;
  renewal_status: string;
  policy_version: number;
  policy_start_date: string;
  policy_end_date: string;
  digital_signature_status: string;
  signed_at: string | null;
  total_premium: number;
  updated_at: string;
  [key: string]: unknown;
};

type ChangeSet = {
  [key: string]: unknown;
};

export async function PATCH(request: NextRequest) {
  return handleUpdate(request);
}

export async function PUT(request: NextRequest) {
  return handleUpdate(request);
}

async function handleUpdate(request: NextRequest) {
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
        { error: "You must be signed in to update a policy." },
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

    const body = (await request.json()) as PolicyUpdateBody;
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

    const currentPolicy = await loadOwnedPolicy(
      adminClient as any,
      policyId,
      user.id
    );

    if (!currentPolicy) {
      return NextResponse.json(
        { error: "Policy was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const lockError = validatePolicyEditable(currentPolicy);

    if (lockError) {
      return NextResponse.json(
        { error: lockError },
        { status: 409 }
      );
    }

    const updateReason =
      cleanText(body.update_reason, 2000) ||
      "Policy details updated.";

    const effectiveDate = body.effective_date
      ? normalizeRequiredDate(
          body.effective_date,
          "effective_date"
        )
      : new Date().toISOString().slice(0, 10);

    const policyChanges = buildPolicyChanges(
      body,
      currentPolicy
    );

    const changedFields = Object.keys(policyChanges);

    if (
      changedFields.length === 0 &&
      !hasLinkedChanges(body)
    ) {
      return NextResponse.json(
        { error: "No policy changes were provided." },
        { status: 400 }
      );
    }

    const financialChange = hasFinancialChange(
      currentPolicy,
      policyChanges
    );

    const approvalRequired =
      financialChange ||
      hasMaterialChange(changedFields) ||
      hasLinkedChanges(body);

    const endorsement = await createEndorsement({
      adminClient: adminClient as any,
      userId: user.id,
      policy: currentPolicy,
      changes: policyChanges,
      updateReason,
      effectiveDate,
      approvalRequired,
    });

    try {
      if (Object.keys(policyChanges).length) {
        const { error: updateError } = await adminClient
          .from("insurance_policy_records")
          .update({
            ...policyChanges,
            policy_status: approvalRequired
              ? "pending_approval"
              : currentPolicy.policy_status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", policyId)
          .eq("user_id", user.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      await applyDriverChanges(
        adminClient as any,
        user.id,
        policyId,
        body.drivers ?? []
      );

      await applyNomineeChanges(
        adminClient as any,
        user.id,
        policyId,
        body.nominees ?? []
      );

      await applyBeneficiaryChanges(
        adminClient as any,
        user.id,
        policyId,
        body.beneficiaries ?? []
      );

      await applyAddonChanges(
        adminClient as any,
        user.id,
        policyId,
        body.addons ?? []
      );

      if (approvalRequired) {
        await createApprovalRequest({
          adminClient: adminClient as any,
          userId: user.id,
          policyId,
          endorsementId: endorsement.id,
          updateReason,
        });
      } else {
        await adminClient
          .from("insurance_policy_endorsements")
          .update({
            endorsement_status: "approved",
            approved_at: new Date().toISOString(),
            approved_values: policyChanges,
          })
          .eq("id", endorsement.id);
      }

      const refreshedPolicy = await loadOwnedPolicy(
        adminClient as any,
        policyId,
        user.id
      );

      if (!refreshedPolicy) {
        throw new Error(
          "Policy could not be reloaded after update."
        );
      }

      await updateEndorsementSummary(
        adminClient as any,
        refreshedPolicy,
        endorsement
      );

      return NextResponse.json({
        success: true,
        policy_id: refreshedPolicy.id,
        policy_number: refreshedPolicy.policy_number,
        policy_status: refreshedPolicy.policy_status,
        issuance_status: refreshedPolicy.issuance_status,
        renewal_status: refreshedPolicy.renewal_status,
        policy_version: refreshedPolicy.policy_version,
        endorsement_id: endorsement.id,
        endorsement_reference:
          endorsement.endorsement_reference,
        endorsement_status: approvalRequired
          ? "submitted"
          : "approved",
        approval_required: approvalRequired,
        changed_fields: changedFields,
        message: approvalRequired
          ? "Policy changes were saved and sent for approval."
          : "Policy updated successfully.",
      });
    } catch (updateFailure) {
      await rollbackPolicyUpdate({
        adminClient: adminClient as any,
        userId: user.id,
        currentPolicy,
        endorsementId: endorsement.id,
      });

      throw updateFailure;
    }
  } catch (error) {
    console.error("Policy update error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the policy.",
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

function validatePolicyEditable(
  policy: PolicyRow
) {
  if (
    ["cancelled", "expired", "renewed"].includes(
      policy.policy_status
    )
  ) {
    return (
      `Policy cannot be edited while status is ` +
      `${policy.policy_status}.`
    );
  }

  if (
    policy.digital_signature_status === "completed" &&
    policy.signed_at
  ) {
    return (
      "Digitally signed policies must be updated through an approved endorsement."
    );
  }

  return "";
}

function buildPolicyChanges(
  body: PolicyUpdateBody,
  currentPolicy: PolicyRow
) {
  const changes: ChangeSet = {};

  assignTextChange(
    changes,
    "policy_type",
    body.policy_type,
    currentPolicy.policy_type
  );

  assignTextChange(
    changes,
    "policy_category",
    body.policy_category,
    currentPolicy.policy_category
  );

  assignNullableTextChange(
    changes,
    "insurer_name",
    body.insurer_name,
    currentPolicy.insurer_name
  );

  assignNullableTextChange(
    changes,
    "branch_code",
    body.branch_code,
    currentPolicy.branch_code
  );

  assignNullableTextChange(
    changes,
    "intermediary_code",
    body.intermediary_code,
    currentPolicy.intermediary_code
  );

  assignTextChange(
    changes,
    "insured_name",
    body.insured_name,
    currentPolicy.insured_name
  );

  assignNullableTextChange(
    changes,
    "insured_email",
    body.insured_email,
    currentPolicy.insured_email
  );

  assignNullableTextChange(
    changes,
    "insured_phone",
    body.insured_phone,
    currentPolicy.insured_phone
  );

  if (body.insured_address !== undefined) {
    const value = validObject(body.insured_address) ?? {};

    if (
      JSON.stringify(value) !==
      JSON.stringify(currentPolicy.insured_address ?? {})
    ) {
      changes.insured_address = value;
    }
  }

  assignNullableTextChange(
    changes,
    "vehicle_registration_number",
    body.vehicle_registration_number,
    currentPolicy.vehicle_registration_number
  );

  assignNullableTextChange(
    changes,
    "chassis_number",
    body.chassis_number,
    currentPolicy.chassis_number
  );

  assignNullableTextChange(
    changes,
    "engine_number",
    body.engine_number,
    currentPolicy.engine_number
  );

  assignNullableTextChange(
    changes,
    "vin",
    body.vin,
    currentPolicy.vin
  );

  assignNullableTextChange(
    changes,
    "vehicle_make",
    body.vehicle_make,
    currentPolicy.vehicle_make
  );

  assignNullableTextChange(
    changes,
    "vehicle_model",
    body.vehicle_model,
    currentPolicy.vehicle_model
  );

  assignNullableTextChange(
    changes,
    "vehicle_variant",
    body.vehicle_variant,
    currentPolicy.vehicle_variant
  );

  if (body.vehicle_year !== undefined) {
    const value = cleanYear(body.vehicle_year);

    if (
      value !== cleanYear(currentPolicy.vehicle_year)
    ) {
      changes.vehicle_year = value;
    }
  }

  assignNullableTextChange(
    changes,
    "vehicle_fuel_type",
    body.vehicle_fuel_type,
    currentPolicy.vehicle_fuel_type
  );

  assignNullableTextChange(
    changes,
    "vehicle_usage_type",
    body.vehicle_usage_type,
    currentPolicy.vehicle_usage_type
  );

  if (body.policy_start_date !== undefined) {
    const value = normalizeRequiredDate(
      body.policy_start_date,
      "policy_start_date"
    );

    if (value !== currentPolicy.policy_start_date) {
      changes.policy_start_date = value;
    }
  }

  if (body.policy_end_date !== undefined) {
    const value = normalizeRequiredDate(
      body.policy_end_date,
      "policy_end_date"
    );

    if (value !== currentPolicy.policy_end_date) {
      changes.policy_end_date = value;
    }
  }

  const resultingStartDate =
    String(
      changes.policy_start_date ??
      currentPolicy.policy_start_date
    );

  const resultingEndDate =
    String(
      changes.policy_end_date ??
      currentPolicy.policy_end_date
    );

  if (
    new Date(resultingEndDate).getTime() <
    new Date(resultingStartDate).getTime()
  ) {
    throw new Error(
      "policy_end_date cannot be before policy_start_date."
    );
  }

  assignMoneyChange(
    changes,
    "idv",
    body.idv,
    currentPolicy.idv
  );

  assignMoneyChange(
    changes,
    "total_premium",
    body.total_premium,
    currentPolicy.total_premium
  );

  assignMoneyChange(
    changes,
    "net_premium",
    body.net_premium,
    currentPolicy.net_premium
  );

  assignMoneyChange(
    changes,
    "tax_amount",
    body.tax_amount,
    currentPolicy.tax_amount
  );

  assignMoneyChange(
    changes,
    "discount_amount",
    body.discount_amount,
    currentPolicy.discount_amount
  );

  assignPercentageChange(
    changes,
    "ncb_percent",
    body.ncb_percent,
    currentPolicy.ncb_percent
  );

  assignMoneyChange(
    changes,
    "ncb_discount_amount",
    body.ncb_discount_amount,
    currentPolicy.ncb_discount_amount
  );

  assignMoneyChange(
    changes,
    "compulsory_deductible",
    body.compulsory_deductible,
    currentPolicy.compulsory_deductible
  );

  assignMoneyChange(
    changes,
    "voluntary_deductible",
    body.voluntary_deductible,
    currentPolicy.voluntary_deductible
  );

  if (body.coverage_details !== undefined) {
    const value = validObject(body.coverage_details) ?? {};

    if (
      JSON.stringify(value) !==
      JSON.stringify(currentPolicy.coverage_details ?? {})
    ) {
      changes.coverage_details = value;
    }
  }

  if (body.selected_addons !== undefined) {
    const value = Array.isArray(body.selected_addons)
      ? body.selected_addons
      : [];

    if (
      JSON.stringify(value) !==
      JSON.stringify(currentPolicy.selected_addons ?? [])
    ) {
      changes.selected_addons = value;
    }
  }

  if (body.exclusions !== undefined) {
    const value = Array.isArray(body.exclusions)
      ? body.exclusions
      : [];

    if (
      JSON.stringify(value) !==
      JSON.stringify(currentPolicy.exclusions ?? [])
    ) {
      changes.exclusions = value;
    }
  }

  if (body.grace_period_days !== undefined) {
    const days = clampInteger(
      body.grace_period_days,
      0,
      365,
      0
    );

    if (
      days !== Number(currentPolicy.grace_period_days ?? 0)
    ) {
      changes.grace_period_days = days;
      changes.grace_period_end_date =
        days > 0
          ? addDays(resultingEndDate, days)
          : null;
    }
  }

  if (body.metadata !== undefined) {
    const value = validObject(body.metadata) ?? {};

    if (
      JSON.stringify(value) !==
      JSON.stringify(currentPolicy.metadata ?? {})
    ) {
      changes.metadata = value;
    }
  }

  return changes;
}

async function createEndorsement(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  changes: ChangeSet;
  updateReason: string;
  effectiveDate: string;
  approvalRequired: boolean;
}) {
  const premiumDifference =
    numberOrZero(args.changes.total_premium) -
    numberOrZero(args.policy.total_premium);

  const taxDifference =
    numberOrZero(args.changes.tax_amount) -
    numberOrZero(args.policy.tax_amount);

  const { data, error } = await args.adminClient
    .from("insurance_policy_endorsements")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      endorsement_type:
        args.approvalRequired
          ? "material_policy_change"
          : "administrative_update",
      endorsement_status:
        args.approvalRequired
          ? "submitted"
          : "approved",
      requested_changes: {
        reason: args.updateReason,
        changes: args.changes,
      },
      previous_values: pickFields(
        args.policy,
        Object.keys(args.changes)
      ),
      approved_values:
        args.approvalRequired ? {} : args.changes,
      premium_difference: premiumDifference,
      tax_difference: taxDifference,
      refund_amount:
        premiumDifference < 0
          ? Math.abs(premiumDifference)
          : 0,
      effective_date: args.effectiveDate,
      requested_at: new Date().toISOString(),
      approved_at:
        args.approvalRequired
          ? null
          : new Date().toISOString(),
      metadata: {
        changed_fields: Object.keys(args.changes),
        approval_required: args.approvalRequired,
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

async function applyDriverChanges(
  adminClient: any,
  userId: string,
  policyId: number,
  drivers: NonNullable<PolicyUpdateBody["drivers"]>
) {
  for (const driver of drivers) {
    const id = positiveInteger(driver.id);

    if (driver.action === "delete") {
      if (!id) {
        throw new Error(
          "Driver id is required for deletion."
        );
      }

      const { error } = await adminClient
        .from("insurance_policy_drivers")
        .delete()
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }

      continue;
    }

    const payload = {
      user_id: userId,
      policy_id: policyId,
      driver_type:
        cleanText(driver.driver_type, 80) || "named",
      full_name: cleanText(driver.full_name, 250),
      date_of_birth:
        normalizeOptionalDate(driver.date_of_birth),
      licence_number:
        cleanNullableText(driver.licence_number, 120),
      licence_type:
        cleanNullableText(driver.licence_type, 80),
      licence_issue_date:
        normalizeOptionalDate(driver.licence_issue_date),
      licence_expiry_date:
        normalizeOptionalDate(driver.licence_expiry_date),
      relationship_to_insured:
        cleanNullableText(
          driver.relationship_to_insured,
          120
        ),
      years_of_driving_experience:
        cleanNonNegativeNumber(
          driver.years_of_driving_experience
        ),
      is_primary_driver:
        Boolean(driver.is_primary_driver),
      is_excluded_driver:
        Boolean(driver.is_excluded_driver),
      risk_attributes:
        validObject(driver.risk_attributes) ?? {},
      validation_status: "pending",
    };

    if (!payload.full_name) {
      throw new Error(
        "Driver full_name is required."
      );
    }

    if (id) {
      const { error } = await adminClient
        .from("insurance_policy_drivers")
        .update(payload)
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await adminClient
        .from("insurance_policy_drivers")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }
    }
  }
}

async function applyNomineeChanges(
  adminClient: any,
  userId: string,
  policyId: number,
  nominees: NonNullable<PolicyUpdateBody["nominees"]>
) {
  for (const nominee of nominees) {
    const id = positiveInteger(nominee.id);

    if (nominee.action === "delete") {
      if (!id) {
        throw new Error(
          "Nominee id is required for deletion."
        );
      }

      const { error } = await adminClient
        .from("insurance_policy_nominees")
        .delete()
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }

      continue;
    }

    const payload = {
      user_id: userId,
      policy_id: policyId,
      nominee_name:
        cleanText(nominee.nominee_name, 250),
      relationship:
        cleanNullableText(nominee.relationship, 120),
      date_of_birth:
        normalizeOptionalDate(nominee.date_of_birth),
      contact_number:
        cleanNullableText(nominee.contact_number, 80),
      email:
        cleanNullableText(nominee.email, 250),
      address:
        validObject(nominee.address) ?? {},
      share_percent:
        cleanPercentage(nominee.share_percent),
      is_minor:
        Boolean(nominee.is_minor),
      guardian_name:
        cleanNullableText(nominee.guardian_name, 250),
      guardian_relationship:
        cleanNullableText(
          nominee.guardian_relationship,
          120
        ),
      guardian_contact_number:
        cleanNullableText(
          nominee.guardian_contact_number,
          80
        ),
      verification_status: "pending",
    };

    if (!payload.nominee_name) {
      throw new Error(
        "Nominee name is required."
      );
    }

    if (id) {
      const { error } = await adminClient
        .from("insurance_policy_nominees")
        .update(payload)
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await adminClient
        .from("insurance_policy_nominees")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  await validateNomineeShares(
    adminClient,
    policyId,
    userId
  );
}

async function applyBeneficiaryChanges(
  adminClient: any,
  userId: string,
  policyId: number,
  beneficiaries: NonNullable<
    PolicyUpdateBody["beneficiaries"]
  >
) {
  for (const beneficiary of beneficiaries) {
    const id = positiveInteger(beneficiary.id);

    if (beneficiary.action === "delete") {
      if (!id) {
        throw new Error(
          "Beneficiary id is required for deletion."
        );
      }

      const { error } = await adminClient
        .from("insurance_policy_beneficiaries")
        .delete()
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }

      continue;
    }

    const payload = {
      user_id: userId,
      policy_id: policyId,
      beneficiary_type:
        cleanText(
          beneficiary.beneficiary_type,
          80
        ),
      beneficiary_name:
        cleanText(
          beneficiary.beneficiary_name,
          250
        ),
      beneficiary_reference:
        cleanNullableText(
          beneficiary.beneficiary_reference,
          250
        ),
      relationship_to_policy:
        cleanNullableText(
          beneficiary.relationship_to_policy,
          120
        ),
      share_percent:
        cleanPercentage(beneficiary.share_percent),
      bank_details:
        validObject(beneficiary.bank_details) ?? {},
      contact_details:
        validObject(
          beneficiary.contact_details
        ) ?? {},
      verification_status: "pending",
    };

    if (
      !payload.beneficiary_type ||
      !payload.beneficiary_name
    ) {
      throw new Error(
        "Beneficiary type and name are required."
      );
    }

    if (id) {
      const { error } = await adminClient
        .from("insurance_policy_beneficiaries")
        .update(payload)
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await adminClient
        .from("insurance_policy_beneficiaries")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  await validateBeneficiaryShares(
    adminClient,
    policyId,
    userId
  );
}

async function applyAddonChanges(
  adminClient: any,
  userId: string,
  policyId: number,
  addons: NonNullable<PolicyUpdateBody["addons"]>
) {
  for (const addon of addons) {
    const id = positiveInteger(addon.id);

    if (addon.action === "delete") {
      if (!id) {
        throw new Error(
          "Add-on id is required for deletion."
        );
      }

      const { error } = await adminClient
        .from("insurance_policy_addons")
        .delete()
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }

      continue;
    }

    const payload = {
      user_id: userId,
      policy_id: policyId,
      addon_id:
        positiveInteger(addon.addon_id),
      addon_code:
        cleanText(addon.addon_code, 120),
      addon_name:
        cleanText(addon.addon_name, 250),
      premium_amount:
        cleanMoney(addon.premium_amount) ?? 0,
      coverage_limit:
        cleanMoney(addon.coverage_limit),
      addon_status:
        cleanText(addon.addon_status, 80) ||
        "active",
      effective_from:
        normalizeOptionalDate(addon.effective_from),
      effective_to:
        normalizeOptionalDate(addon.effective_to),
      terms_snapshot:
        validObject(addon.terms_snapshot) ?? {},
      metadata: {},
    };

    if (
      !payload.addon_code ||
      !payload.addon_name
    ) {
      throw new Error(
        "Add-on code and name are required."
      );
    }

    if (id) {
      const { error } = await adminClient
        .from("insurance_policy_addons")
        .update(payload)
        .eq("id", id)
        .eq("policy_id", policyId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await adminClient
        .from("insurance_policy_addons")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }
    }
  }
}

async function validateNomineeShares(
  adminClient: any,
  policyId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_policy_nominees")
    .select("share_percent")
    .eq("policy_id", policyId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const total = (data ?? []).reduce(
    (sum: number, row: any) =>
      sum + numberOrZero(row.share_percent),
    0
  );

  if (total > 100.001) {
    throw new Error(
      "Total nominee share percentage cannot exceed 100%."
    );
  }
}

async function validateBeneficiaryShares(
  adminClient: any,
  policyId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_policy_beneficiaries")
    .select("share_percent")
    .eq("policy_id", policyId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const total = (data ?? []).reduce(
    (sum: number, row: any) =>
      sum + numberOrZero(row.share_percent),
    0
  );

  if (total > 100.001) {
    throw new Error(
      "Total beneficiary share percentage cannot exceed 100%."
    );
  }
}

async function createApprovalRequest(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  endorsementId: number;
  updateReason: string;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: args.userId,
      policy_id: args.policyId,
      endorsement_id: args.endorsementId,
      approval_type: "policy_endorsement",
      approval_status: "pending",
      requested_by_role: "customer",
      requested_at: new Date().toISOString(),
      approval_notes: args.updateReason,
      metadata: {},
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function updateEndorsementSummary(
  adminClient: any,
  policy: PolicyRow,
  endorsement: any
) {
  const existing = Array.isArray(
    policy.endorsements_summary
  )
    ? policy.endorsements_summary
    : [];

  const nextSummary = [
    ...existing,
    {
      endorsement_id: endorsement.id,
      endorsement_reference:
        endorsement.endorsement_reference,
      endorsement_type:
        endorsement.endorsement_type,
      endorsement_status:
        endorsement.endorsement_status,
      effective_date:
        endorsement.effective_date,
    },
  ];

  const { error } = await adminClient
    .from("insurance_policy_records")
    .update({
      endorsements_summary: nextSummary,
    })
    .eq("id", policy.id)
    .eq("user_id", policy.user_id);

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackPolicyUpdate(args: {
  adminClient: any;
  userId: string;
  currentPolicy: PolicyRow;
  endorsementId: number;
}) {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...rollbackValues
  } = args.currentPolicy as PolicyRow & {
    created_at?: string;
    updated_at?: string;
  };

  const { error: rollbackError } = await args.adminClient
    .from("insurance_policy_records")
    .update({
      ...rollbackValues,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.currentPolicy.id)
    .eq("user_id", args.userId);

  if (rollbackError) {
    throw new Error(rollbackError.message);
  }

  const { error: endorsementError } = await args.adminClient
    .from("insurance_policy_endorsements")
    .update({
      endorsement_status: "cancelled",
      rejection_reason:
        "Update rolled back because a linked operation failed.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.endorsementId);

  if (endorsementError) {
    throw new Error(endorsementError.message);
  }
}

function hasLinkedChanges(
  body: PolicyUpdateBody
) {
  return Boolean(
    body.drivers?.length ||
    body.nominees?.length ||
    body.beneficiaries?.length ||
    body.addons?.length
  );
}

function hasFinancialChange(
  policy: PolicyRow,
  changes: ChangeSet
) {
  const fields = [
    "idv",
    "total_premium",
    "net_premium",
    "tax_amount",
    "discount_amount",
    "ncb_percent",
    "ncb_discount_amount",
    "compulsory_deductible",
    "voluntary_deductible",
  ];

  return fields.some(
    (field) =>
      field in changes &&
      numberOrZero(changes[field]) !==
      numberOrZero(policy[field])
  );
}

function hasMaterialChange(
  changedFields: string[]
) {
  const materialFields = new Set([
    "insured_name",
    "vehicle_registration_number",
    "chassis_number",
    "engine_number",
    "vin",
    "policy_start_date",
    "policy_end_date",
    "coverage_details",
    "selected_addons",
    "exclusions",
    "vehicle_usage_type",
  ]);

  return changedFields.some(
    (field) => materialFields.has(field)
  );
}

function assignTextChange(
  target: ChangeSet,
  key: string,
  input: unknown,
  current: unknown
) {
  if (input === undefined) return;

  const value = cleanText(input, 8000);

  if (value && value !== String(current ?? "")) {
    target[key] = value;
  }
}

function assignNullableTextChange(
  target: ChangeSet,
  key: string,
  input: unknown,
  current: unknown
) {
  if (input === undefined) return;

  const value = cleanNullableText(input, 8000);
  const currentValue =
    current === null || current === undefined
      ? null
      : String(current);

  if (value !== currentValue) {
    target[key] = value;
  }
}

function assignMoneyChange(
  target: ChangeSet,
  key: string,
  input: unknown,
  current: unknown
) {
  if (input === undefined) return;

  const value = cleanMoney(input);
  const currentValue = cleanMoney(current);

  if (value !== currentValue) {
    target[key] = value;
  }
}

function assignPercentageChange(
  target: ChangeSet,
  key: string,
  input: unknown,
  current: unknown
) {
  if (input === undefined) return;

  const value = cleanPercentage(input);
  const currentValue = cleanPercentage(current);

  if (value !== currentValue) {
    target[key] = value;
  }
}

function pickFields(
  source: Record<string, unknown>,
  keys: string[]
) {
  const result: Record<string, unknown> = {};

  for (const key of keys) {
    result[key] = source[key];
  }

  return result;
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
  if (!value) return null;

  const raw = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(
    `${raw}T00:00:00.000Z`
  );

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

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function numberOrZero(
  value: unknown
) {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}