import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type IssuePolicyBody = {
  underwriting_case_id?: number | null;
  proposal_id?: number | null;
  quote_id?: number | null;
  vehicle_id?: number | null;
  policy_type?: string | null;
  policy_category?: string | null;
  insurer_name?: string | null;
  branch_code?: string | null;
  intermediary_code?: string | null;
  insured_name?: string | null;
  insured_email?: string | null;
  insured_phone?: string | null;
  insured_address?: Record<string, unknown>;
  policy_start_date?: string | null;
  policy_end_date?: string | null;
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
  issue_document?: boolean;
  mark_as_signed?: boolean;
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
  requested_policy_type: string | null;
  recommended_idv: number | null;
  recommended_total_premium: number | null;
  recommended_ncb_percent: number | null;
  recommended_deductible: number | null;
  applicant_name: string | null;
  vehicle_registration_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_variant: string | null;
  vehicle_year: number | null;
  vehicle_fuel_type: string | null;
  vehicle_usage_type: string | null;
};

type UnderwritingDecisionRow = {
  id: number;
  user_id: string;
  underwriting_case_id: number;
  decision_type: string;
  decision_status: string;
  approved_idv: number | null;
  approved_total_premium: number | null;
  approved_ncb_percent: number | null;
  approved_deductible: number | null;
  approved_addons: Array<Record<string, unknown>>;
  exclusions: Array<Record<string, unknown>>;
  decided_at: string;
};

type VehicleRow = {
  id: number;
  user_id: string;
  registration_number?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  fuel_type?: string | null;
  usage_type?: string | null;
};

type QuoteRow = {
  id: number;
  user_id: string;
  quote_reference?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  policy_type?: string | null;
  policy_category?: string | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  idv?: number | null;
  total_premium?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  ncb_percent?: number | null;
  ncb_discount_amount?: number | null;
  selected_addons?: Array<Record<string, unknown>>;
  coverage_summary?: Record<string, unknown>;
  exclusions_summary?: Array<Record<string, unknown> | string>;
};

type ProposalRow = {
  id: number;
  user_id: string;
  proposer_name?: string | null;
  proposer_email?: string | null;
  proposer_phone?: string | null;
  proposer_address?: Record<string, unknown>;
  policy_type?: string | null;
  policy_category?: string | null;
};

type PolicyRow = {
  id: number;
  user_id: string;
  vehicle_id: number;
  policy_number: string;
  policy_status: string;
  issuance_status: string;
  policy_start_date: string;
  policy_end_date: string;
  issued_at: string | null;
  idv: number | null;
  total_premium: number;
  net_premium: number;
  tax_amount: number;
  ncb_percent: number | null;
  selected_addons: Array<Record<string, unknown>>;
  digital_signature_status: string;
  signed_at: string | null;
  metadata: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const env = readEnvironment();
    if ("error" in env) {
      return NextResponse.json({ error: env.error }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to issue a policy." },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();
    const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    const body = (await request.json()) as IssuePolicyBody;
    const underwritingCaseId = positiveInteger(body.underwriting_case_id);

    if (!underwritingCaseId) {
      return NextResponse.json(
        { error: "underwriting_case_id is required." },
        { status: 400 }
      );
    }

    const adminClient = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const underwritingCase = await loadOwnedUnderwritingCase(
      adminClient as any,
      underwritingCaseId,
      user.id
    );

    if (!underwritingCase) {
      return NextResponse.json(
        { error: "Underwriting case was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const eligibilityError = validateIssuanceEligibility(underwritingCase);
    if (eligibilityError) {
      return NextResponse.json({ error: eligibilityError }, { status: 409 });
    }

    const decision = await loadLatestDecision(
      adminClient as any,
      underwritingCase.id,
      user.id
    );

    if (!decision || !["approve", "approve_with_conditions"].includes(decision.decision_type)) {
      return NextResponse.json(
        { error: "An approved underwriting decision is required before policy issuance." },
        { status: 409 }
      );
    }

    const existingPolicy = await loadExistingPolicyForCase(
      adminClient as any,
      underwritingCase.id,
      user.id
    );

    if (existingPolicy) {
      return NextResponse.json(
        {
          error: "A policy has already been issued for this underwriting case.",
          policy_id: existingPolicy.id,
          policy_number: existingPolicy.policy_number,
        },
        { status: 409 }
      );
    }

    const proposalId =
      positiveInteger(body.proposal_id) ??
      positiveInteger(underwritingCase.proposal_id);

    const quoteId =
      positiveInteger(body.quote_id) ??
      positiveInteger(underwritingCase.quote_id);

    const vehicleId =
      positiveInteger(body.vehicle_id) ??
      positiveInteger(underwritingCase.vehicle_id);

    if (!vehicleId) {
      return NextResponse.json(
        { error: "vehicle_id could not be resolved." },
        { status: 400 }
      );
    }

    const [vehicle, proposal, quote] = await Promise.all([
      loadOwnedVehicle(adminClient as any, vehicleId, user.id),
      proposalId
        ? loadOwnedProposal(adminClient as any, proposalId, user.id)
        : Promise.resolve(null),
      quoteId
        ? loadOwnedQuote(adminClient as any, quoteId, user.id)
        : Promise.resolve(null),
    ]);

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle was not found or does not belong to you." },
        { status: 404 }
      );
    }

    const policyStartDate =
      normalizeOptionalDate(body.policy_start_date) ??
      normalizeOptionalDate(quote?.coverage_start_date) ??
      new Date().toISOString().slice(0, 10);

    const policyEndDate =
      normalizeOptionalDate(body.policy_end_date) ??
      normalizeOptionalDate(quote?.coverage_end_date) ??
      addYears(policyStartDate, 1);

    if (new Date(policyEndDate).getTime() < new Date(policyStartDate).getTime()) {
      return NextResponse.json(
        { error: "policy_end_date cannot be before policy_start_date." },
        { status: 400 }
      );
    }

    const policyNumber = generatePolicyNumber();
    const issuedAt = new Date().toISOString();
    const gracePeriodDays = clampInteger(body.grace_period_days, 0, 365, 0);

    const idv =
      cleanMoney(body.idv) ??
      cleanMoney(decision.approved_idv) ??
      cleanMoney(underwritingCase.recommended_idv) ??
      cleanMoney(quote?.idv);

    const totalPremium =
      cleanMoney(body.total_premium) ??
      cleanMoney(decision.approved_total_premium) ??
      cleanMoney(underwritingCase.recommended_total_premium) ??
      cleanMoney(quote?.total_premium) ??
      0;

    const taxAmount =
      cleanMoney(body.tax_amount) ??
      cleanMoney(quote?.tax_amount) ??
      roundMoney(totalPremium * 0.18);

    const discountAmount =
      cleanMoney(body.discount_amount) ??
      cleanMoney(quote?.discount_amount) ??
      0;

    const ncbPercent =
      cleanPercentage(body.ncb_percent) ??
      cleanPercentage(decision.approved_ncb_percent) ??
      cleanPercentage(underwritingCase.recommended_ncb_percent) ??
      cleanPercentage(quote?.ncb_percent) ??
      0;

    const ncbDiscountAmount =
      cleanMoney(body.ncb_discount_amount) ??
      cleanMoney(quote?.ncb_discount_amount) ??
      roundMoney(totalPremium * (ncbPercent / 100));

    const netPremium =
      cleanMoney(body.net_premium) ??
      roundMoney(
        Math.max(
          0,
          totalPremium - discountAmount - ncbDiscountAmount + taxAmount
        )
      );

    const insuredName =
      cleanText(body.insured_name, 250) ||
      cleanText(proposal?.proposer_name, 250) ||
      cleanText(quote?.customer_name, 250) ||
      cleanText(underwritingCase.applicant_name, 250);

    if (!insuredName) {
      return NextResponse.json(
        { error: "insured_name could not be resolved." },
        { status: 400 }
      );
    }

    const policyPayload = {
      user_id: user.id,
      proposal_id: proposalId,
      quote_id: quoteId,
      product_id: null,
      vehicle_id: vehicleId,
      policy_number: policyNumber,
      policy_version: 1,
      policy_status: "active",
      issuance_status: "issued",
      renewal_status: "not_due",
      policy_type:
        cleanText(body.policy_type, 80) ||
        cleanText(underwritingCase.requested_policy_type, 80) ||
        cleanText(quote?.policy_type, 80) ||
        cleanText(proposal?.policy_type, 80) ||
        "comprehensive",
      policy_category:
        cleanText(body.policy_category, 80) ||
        cleanText(quote?.policy_category, 80) ||
        cleanText(proposal?.policy_category, 80) ||
        "motor",
      insurer_name: cleanNullableText(body.insurer_name, 250),
      branch_code: cleanNullableText(body.branch_code, 120),
      intermediary_code: cleanNullableText(body.intermediary_code, 120),
      insured_name: insuredName,
      insured_email:
        cleanNullableText(body.insured_email, 250) ??
        cleanNullableText(proposal?.proposer_email, 250) ??
        cleanNullableText(quote?.customer_email, 250),
      insured_phone:
        cleanNullableText(body.insured_phone, 80) ??
        cleanNullableText(proposal?.proposer_phone, 80) ??
        cleanNullableText(quote?.customer_phone, 80),
      insured_address:
        validObject(body.insured_address) ??
        validObject(proposal?.proposer_address) ??
        {},
      vehicle_registration_number:
        cleanNullableText(vehicle.registration_number, 120) ??
        cleanNullableText(underwritingCase.vehicle_registration_number, 120),
      chassis_number: cleanNullableText(vehicle.chassis_number, 120),
      engine_number: cleanNullableText(vehicle.engine_number, 120),
      vin: cleanNullableText(vehicle.vin, 120),
      vehicle_make:
        cleanNullableText(vehicle.make, 120) ??
        cleanNullableText(underwritingCase.vehicle_make, 120),
      vehicle_model:
        cleanNullableText(vehicle.model, 120) ??
        cleanNullableText(underwritingCase.vehicle_model, 120),
      vehicle_variant:
        cleanNullableText(vehicle.variant, 120) ??
        cleanNullableText(underwritingCase.vehicle_variant, 120),
      vehicle_year:
        cleanYear(vehicle.year) ??
        cleanYear(underwritingCase.vehicle_year),
      vehicle_fuel_type:
        cleanNullableText(vehicle.fuel_type, 80) ??
        cleanNullableText(underwritingCase.vehicle_fuel_type, 80),
      vehicle_usage_type:
        cleanNullableText(vehicle.usage_type, 80) ??
        cleanNullableText(underwritingCase.vehicle_usage_type, 80),
      policy_start_date: policyStartDate,
      policy_end_date: policyEndDate,
      issued_at: issuedAt,
      idv,
      total_premium: totalPremium,
      net_premium: netPremium,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      ncb_percent: ncbPercent,
      ncb_discount_amount: ncbDiscountAmount,
      compulsory_deductible:
        cleanMoney(body.compulsory_deductible) ??
        cleanMoney(decision.approved_deductible) ??
        cleanMoney(underwritingCase.recommended_deductible),
      voluntary_deductible: cleanMoney(body.voluntary_deductible),
      coverage_details:
        validObject(body.coverage_details) ??
        validObject(quote?.coverage_summary) ??
        {},
      selected_addons:
        Array.isArray(body.selected_addons)
          ? body.selected_addons
          : Array.isArray(decision.approved_addons)
            ? decision.approved_addons
            : Array.isArray(quote?.selected_addons)
              ? quote.selected_addons
              : [],
      exclusions:
        Array.isArray(body.exclusions)
          ? body.exclusions
          : Array.isArray(decision.exclusions)
            ? decision.exclusions
            : Array.isArray(quote?.exclusions_summary)
              ? quote.exclusions_summary
              : [],
      endorsements_summary: [],
      grace_period_days: gracePeriodDays,
      grace_period_end_date:
        gracePeriodDays > 0
          ? addDays(policyEndDate, gracePeriodDays)
          : null,
      cancellation_status: "not_requested",
      digital_signature_status: body.mark_as_signed ? "completed" : "not_started",
      digital_signature_reference: body.mark_as_signed
        ? `${policyNumber}-SIGN`
        : null,
      signed_at: body.mark_as_signed ? issuedAt : null,
      customer_portal_access: true,
      partner_portal_access: false,
      metadata: {
        underwriting_case_id: underwritingCase.id,
        underwriting_case_reference: underwritingCase.case_reference,
        underwriting_decision_id: decision.id,
        underwriting_decision_type: decision.decision_type,
        quote_reference: quote?.quote_reference ?? null,
        qr_verification_data: {
          policy_number: policyNumber,
          issued_at: issuedAt,
          verification_code: generateVerificationCode(),
        },
        source_metadata: validObject(body.metadata) ?? {},
      },
    };

    const { data: policyData, error: policyError } = await adminClient
      .from("insurance_policy_records")
      .insert(policyPayload)
      .select("*")
      .single();

    if (policyError || !policyData) {
      return NextResponse.json(
        { error: policyError?.message || "Unable to issue policy." },
        { status: 500 }
      );
    }

    const issuedPolicy = policyData as PolicyRow;

    try {
      const { error: underwritingUpdateError } = await adminClient
        .from("insurance_underwriting_cases")
        .update({
          policy_id: issuedPolicy.id,
          underwriting_status: "approved",
          decision_status: "approved",
          decided_at: issuedAt,
          updated_at: issuedAt,
        })
        .eq("id", underwritingCase.id)
        .eq("user_id", user.id);

      if (underwritingUpdateError) {
        throw new Error(underwritingUpdateError.message);
      }

      if (quoteId) {
        await adminClient
          .from("insurance_quotes")
          .update({ quote_status: "converted" })
          .eq("id", quoteId)
          .eq("user_id", user.id);
      }

      if (proposalId) {
        await adminClient
          .from("insurance_policy_proposals")
          .update({
            proposal_status: "policy_issued",
            policy_id: issuedPolicy.id,
            updated_at: issuedAt,
          })
          .eq("id", proposalId)
          .eq("user_id", user.id);
      }

      let documentId: number | null = null;
      if (body.issue_document !== false) {
        documentId = await createPolicyDocument({
          adminClient: adminClient as any,
          userId: user.id,
          policy: issuedPolicy,
        });
      }

      await createPolicyApproval({
        adminClient: adminClient as any,
        userId: user.id,
        policy: issuedPolicy,
        underwritingCase,
        decision,
      });

      await writePolicyAudit({
        adminClient: adminClient as any,
        userId: user.id,
        policy: issuedPolicy,
        underwritingCase,
        decision,
        documentId,
      });

      return NextResponse.json({
        success: true,
        policy_id: issuedPolicy.id,
        policy_number: issuedPolicy.policy_number,
        policy_status: issuedPolicy.policy_status,
        issuance_status: issuedPolicy.issuance_status,
        policy_start_date: issuedPolicy.policy_start_date,
        policy_end_date: issuedPolicy.policy_end_date,
        issued_at: issuedPolicy.issued_at,
        document_id: documentId,
        idv: issuedPolicy.idv,
        total_premium: issuedPolicy.total_premium,
        net_premium: issuedPolicy.net_premium,
        tax_amount: issuedPolicy.tax_amount,
        ncb_percent: issuedPolicy.ncb_percent,
        selected_addons: issuedPolicy.selected_addons,
        metadata: issuedPolicy.metadata,
        message: "Policy issued successfully.",
      });
    } catch (linkedOperationError) {
      await rollbackIssuedPolicy({
        adminClient: adminClient as any,
        userId: user.id,
        policyId: issuedPolicy.id,
        underwritingCaseId: underwritingCase.id,
      });
      throw linkedOperationError;
    }
  } catch (error) {
    console.error("Policy issuance error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to issue policy.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedUnderwritingCase(adminClient: any, id: number, userId: string) {
  const { data, error } = await adminClient
    .from("insurance_underwriting_cases")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as UnderwritingCaseRow | null;
}

async function loadLatestDecision(adminClient: any, caseId: number, userId: string) {
  const { data, error } = await adminClient
    .from("insurance_underwriting_decisions")
    .select("*")
    .eq("underwriting_case_id", caseId)
    .eq("user_id", userId)
    .eq("decision_status", "final")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as UnderwritingDecisionRow | null;
}

async function loadExistingPolicyForCase(adminClient: any, caseId: number, userId: string) {
  const { data, error } = await adminClient
    .from("insurance_policy_records")
    .select("*")
    .eq("user_id", userId)
    .contains("metadata", { underwriting_case_id: caseId })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PolicyRow | null;
}

async function loadOwnedVehicle(adminClient: any, id: number, userId: string) {
  const { data, error } = await adminClient
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as VehicleRow | null;
}

async function loadOwnedProposal(adminClient: any, id: number, userId: string) {
  const { data, error } = await adminClient
    .from("insurance_policy_proposals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProposalRow | null;
}

async function loadOwnedQuote(adminClient: any, id: number, userId: string) {
  const { data, error } = await adminClient
    .from("insurance_quotes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as QuoteRow | null;
}

function validateIssuanceEligibility(underwritingCase: UnderwritingCaseRow) {
  if (!["approved", "approved_with_conditions"].includes(underwritingCase.underwriting_status)) {
    return "Policy can only be issued after underwriting approval.";
  }
  if (!["approved", "approved_with_conditions"].includes(underwritingCase.decision_status)) {
    return "Underwriting decision must be approved before issuance.";
  }
  return "";
}

async function createPolicyDocument(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
}) {
  const documentNumber = `${args.policy.policy_number}-SCHEDULE-V1`;
  const { data, error } = await args.adminClient
    .from("insurance_policy_documents")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      document_type: "policy_schedule",
      document_number: documentNumber,
      document_status:
        args.policy.digital_signature_status === "completed"
          ? "signed"
          : "generated",
      document_title: "Motor Insurance Policy Schedule",
      document_summary: `Policy schedule for ${args.policy.policy_number}.`,
      storage_path:
        `insurance-policies/${args.userId}/` +
        `${sanitizeFilePart(args.policy.policy_number)}/policy-schedule-v1.pdf`,
      version_number: 1,
      generated_at: new Date().toISOString(),
      signed_at: args.policy.signed_at,
      metadata: {
        policy_number: args.policy.policy_number,
        issued_at: args.policy.issued_at,
        idv: args.policy.idv,
        total_premium: args.policy.total_premium,
        net_premium: args.policy.net_premium,
        tax_amount: args.policy.tax_amount,
        ncb_percent: args.policy.ncb_percent,
        policy_start_date: args.policy.policy_start_date,
        policy_end_date: args.policy.policy_end_date,
        verification: args.policy.metadata?.qr_verification_data ?? null,
      },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Unable to create policy document.");
  }
  return Number(data.id);
}

async function createPolicyApproval(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  underwritingCase: UnderwritingCaseRow;
  decision: UnderwritingDecisionRow;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_approvals")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      approval_type: "policy_issuance",
      approval_status: "approved",
      requested_by_role: "underwriting_engine",
      requested_at: new Date().toISOString(),
      approved_by_name: "Policy Issuance Engine",
      approved_by_role: "system",
      approved_at: new Date().toISOString(),
      approval_notes: "Policy issued after approved underwriting decision.",
      metadata: {
        underwriting_case_id: args.underwritingCase.id,
        underwriting_decision_id: args.decision.id,
        decision_type: args.decision.decision_type,
      },
    });
  if (error) throw new Error(error.message);
}

async function writePolicyAudit(args: {
  adminClient: any;
  userId: string;
  policy: PolicyRow;
  underwritingCase: UnderwritingCaseRow;
  decision: UnderwritingDecisionRow;
  documentId: number | null;
}) {
  const { error } = await args.adminClient
    .from("insurance_policy_audit_log")
    .insert({
      user_id: args.userId,
      policy_id: args.policy.id,
      action_type: "policy_issued",
      action_status: "issued",
      actor_type: "system",
      actor_name: "Policy Issuance Engine",
      actor_reference: args.underwritingCase.case_reference,
      previous_values: {},
      new_values: {
        policy_number: args.policy.policy_number,
        policy_status: args.policy.policy_status,
        issuance_status: args.policy.issuance_status,
        policy_start_date: args.policy.policy_start_date,
        policy_end_date: args.policy.policy_end_date,
        idv: args.policy.idv,
        total_premium: args.policy.total_premium,
        ncb_percent: args.policy.ncb_percent,
      },
      metadata: {
        underwriting_case_id: args.underwritingCase.id,
        underwriting_decision_id: args.decision.id,
        document_id: args.documentId,
      },
    });
  if (error) throw new Error(error.message);
}

async function rollbackIssuedPolicy(args: {
  adminClient: any;
  userId: string;
  policyId: number;
  underwritingCaseId: number;
}) {
  await args.adminClient
    .from("insurance_policy_records")
    .delete()
    .eq("id", args.policyId)
    .eq("user_id", args.userId);

  await args.adminClient
    .from("insurance_underwriting_cases")
    .update({ policy_id: null, updated_at: new Date().toISOString() })
    .eq("id", args.underwritingCaseId)
    .eq("user_id", args.userId);
}

function generatePolicyNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `MV-POL-${datePart}-${randomPart}`;
}

function generateVerificationCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function readEnvironment():
  | { supabaseUrl: string; supabaseAnonKey: string; serviceRoleKey: string }
  | { error: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      error:
        "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required.",
    };
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

function positiveInteger(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function cleanText(value: unknown, limit = 8000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanNullableText(value: unknown, limit = 8000) {
  const cleaned = cleanText(value, limit);
  return cleaned || null;
}

function cleanMoney(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[₹,\s]/g, ""))
        : NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function cleanPercentage(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, numeric));
}

function cleanYear(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1900 && numeric <= 2200
    ? numeric
    : null;
}

function validObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeOptionalDate(value: unknown) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : raw;
}

function addYears(dateString: string, years: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}