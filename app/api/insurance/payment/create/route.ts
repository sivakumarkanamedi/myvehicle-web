import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type PaymentCreateBody = {
  settlement_review_id?: number;
  payment_type?:
    | "cashless_garage"
    | "customer_reimbursement"
    | "split_settlement"
    | "total_loss_settlement"
    | "salvage_adjusted_settlement"
    | "partial_payment"
    | "supplementary_payment";

  payment_mode?:
    | "undetermined"
    | "bank_transfer"
    | "upi"
    | "neft"
    | "rtgs"
    | "imps"
    | "gateway"
    | "cheque"
    | "internal_ledger";

  beneficiary_type?:
    | "customer"
    | "garage"
    | "lender"
    | "salvage_buyer"
    | "insurer"
    | "multiple";

  beneficiary_name?: string;
  beneficiary_reference?: string;

  gross_amount?: number | null;
  deduction_amount?: number | null;
  net_payable_amount?: number | null;

  bank_account_holder_name?: string;
  bank_account_number?: string;
  bank_ifsc_code?: string;
  bank_name?: string;
  bank_branch?: string;
  upi_id?: string;

  payment_reason?: string;
  scheduled_payment_date?: string | null;

  splits?: Array<{
    beneficiary_type:
      | "customer"
      | "garage"
      | "lender"
      | "salvage_buyer"
      | "insurer";
    beneficiary_name?: string;
    beneficiary_reference?: string;
    split_amount: number;
    split_percentage?: number | null;
    payment_mode?:
      | "undetermined"
      | "bank_transfer"
      | "upi"
      | "neft"
      | "rtgs"
      | "imps"
      | "gateway"
      | "cheque"
      | "internal_ledger";
  }>;
};

type SettlementReviewRow = {
  id: number;
  user_id: string;
  claim_id: number;
  policy_id: number | null;
  vehicle_id: number;
  repair_job_id: number | null;
  garage_id: number | null;
  settlement_reference: string | null;
  review_status: string;
  recommendation: string;
  settlement_mode: string;
  recommended_insurer_payable: number | null;
  recommended_customer_payable: number | null;
  final_insurer_approved_amount: number | null;
  final_customer_payable_amount: number | null;
  final_settlement_amount: number | null;
  manual_review_required: boolean;
  payment_status: string;
};

type PaymentInstructionRow = {
  id: number;
  user_id: string;
  claim_id: number;
  settlement_review_id: number;
  payment_reference: string | null;
  payment_type: string;
  payment_mode: string;
  payment_status: string;
  beneficiary_type: string;
  beneficiary_name: string | null;
  gross_amount: number;
  deduction_amount: number;
  net_payable_amount: number;
  duplicate_check_status: string;
  validation_status: string;
  approval_status: string;
};

export async function POST(request: NextRequest) {
  try {
    const environment = readEnvironment();

    if ("error" in environment) {
      return NextResponse.json(
        { error: environment.error },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to create a payment." },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    const authClient = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
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

    const body = (await request.json()) as PaymentCreateBody;

    const settlementReviewId = positiveInteger(
      body.settlement_review_id
    );

    if (!settlementReviewId) {
      return NextResponse.json(
        { error: "settlement_review_id is required." },
        { status: 400 }
      );
    }

    const adminClient = createClient(
      environment.supabaseUrl,
      environment.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const settlement = await loadSettlementReview(
      adminClient as any,
      settlementReviewId
    );

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement review was not found." },
        { status: 404 }
      );
    }

    if (settlement.user_id !== user.id) {
      return NextResponse.json(
        { error: "You are not allowed to create this payment." },
        { status: 403 }
      );
    }

    const eligibilityError =
      validateSettlementEligibility(settlement);

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError },
        { status: 400 }
      );
    }

    const claim = await loadClaim(
      adminClient as any,
      settlement.claim_id
    );

    if (!claim) {
      return NextResponse.json(
        { error: "Linked insurance claim was not found." },
        { status: 404 }
      );
    }

    const repairJob = settlement.repair_job_id
      ? await loadRepairJob(
          adminClient as any,
          settlement.repair_job_id
        )
      : null;

    const paymentType = normalizePaymentType(
      body.payment_type ??
        inferPaymentType(settlement, repairJob)
    );

    const beneficiaryType = normalizeBeneficiaryType(
      body.beneficiary_type ??
        inferBeneficiaryType(paymentType)
    );

    const paymentMode = normalizePaymentMode(
      body.payment_mode ?? "undetermined"
    );

    const amounts = calculateAmounts(
      body,
      settlement,
      paymentType
    );

    const beneficiary = resolveBeneficiary({
      body,
      beneficiaryType,
      claim,
      repairJob,
    });

    const scheduledDate = normalizeDate(
      body.scheduled_payment_date
    );

    const bankAccountNumber = cleanText(
      body.bank_account_number,
      120
    );

    const upiId = cleanText(body.upi_id, 200);

    const { data: paymentData, error: paymentError } =
      await adminClient
        .from("insurance_payment_instructions")
        .insert({
          user_id: user.id,
          claim_id: settlement.claim_id,
          policy_id: settlement.policy_id,
          vehicle_id: settlement.vehicle_id,
          settlement_review_id: settlement.id,
          repair_job_id: settlement.repair_job_id,
          garage_id: settlement.garage_id,

          payment_type: paymentType,
          payment_mode: paymentMode,
          payment_status: "draft",

          beneficiary_type: beneficiaryType,
          beneficiary_name: beneficiary.name,
          beneficiary_reference: beneficiary.reference,

          gross_amount: amounts.grossAmount,
          deduction_amount: amounts.deductionAmount,
          net_payable_amount: amounts.netPayableAmount,
          currency_code: "INR",

          bank_account_holder_name: cleanNullableText(
            body.bank_account_holder_name,
            200
          ),
          bank_account_number_masked:
            maskBankAccount(bankAccountNumber),
          bank_account_number_encrypted:
            bankAccountNumber || null,
          bank_ifsc_code: normalizeIfsc(
            body.bank_ifsc_code
          ),
          bank_name: cleanNullableText(
            body.bank_name,
            200
          ),
          bank_branch: cleanNullableText(
            body.bank_branch,
            200
          ),

          upi_id_masked: maskUpi(upiId),
          upi_id_encrypted: upiId || null,

          payment_reason:
            cleanNullableText(body.payment_reason, 2000) ??
            defaultPaymentReason(paymentType),

          scheduled_payment_date: scheduledDate,

          duplicate_check_status: "not_checked",
          validation_status: "pending",
          approval_status: "pending",

          metadata: {
            settlement_reference:
              settlement.settlement_reference,
            source_recommendation:
              settlement.recommendation,
            source_settlement_mode:
              settlement.settlement_mode,
          },
        })
        .select("*")
        .single();

    if (paymentError || !paymentData) {
      return NextResponse.json(
        {
          error:
            paymentError?.message ||
            "Unable to create payment instruction.",
        },
        { status: 500 }
      );
    }

    const payment = paymentData as PaymentInstructionRow;

    try {
      await createPaymentSplits({
        adminClient: adminClient as any,
        userId: user.id,
        paymentInstructionId: payment.id,
        paymentType,
        beneficiaryType,
        beneficiary,
        netPayableAmount: amounts.netPayableAmount,
        splits: body.splits ?? [],
        defaultPaymentMode: paymentMode,
      });

      const duplicateResult = await adminClient.rpc(
        "check_duplicate_payment",
        {
          target_payment_instruction_id: payment.id,
        }
      );

      if (duplicateResult.error) {
        throw new Error(duplicateResult.error.message);
      }

      const validationResult = await adminClient.rpc(
        "validate_payment_instruction",
        {
          target_payment_instruction_id: payment.id,
        }
      );

      if (validationResult.error) {
        throw new Error(validationResult.error.message);
      }

      await createPaymentDocuments({
        adminClient: adminClient as any,
        userId: user.id,
        paymentInstructionId: payment.id,
        payment,
        settlement,
        claim,
        amounts,
      });

      const refreshedPayment = await loadPaymentInstruction(
        adminClient as any,
        payment.id
      );

      if (!refreshedPayment) {
        throw new Error(
          "Payment instruction could not be reloaded."
        );
      }

      await adminClient
        .from("insurance_settlement_reviews")
        .update({
          payment_status:
            refreshedPayment.validation_status === "passed"
              ? "approval_pending"
              : "not_started",
          review_status:
            refreshedPayment.validation_status === "passed"
              ? "payment_pending"
              : settlement.review_status,
        })
        .eq("id", settlement.id);

      return NextResponse.json({
        success: true,
        payment_instruction_id: refreshedPayment.id,
        payment_reference:
          refreshedPayment.payment_reference,
        payment_status:
          refreshedPayment.payment_status,
        payment_type:
          refreshedPayment.payment_type,
        beneficiary_type:
          refreshedPayment.beneficiary_type,
        beneficiary_name:
          refreshedPayment.beneficiary_name,
        gross_amount:
          refreshedPayment.gross_amount,
        deduction_amount:
          refreshedPayment.deduction_amount,
        net_payable_amount:
          refreshedPayment.net_payable_amount,
        duplicate_check_status:
          refreshedPayment.duplicate_check_status,
        validation_status:
          refreshedPayment.validation_status,
        approval_status:
          refreshedPayment.approval_status,
        message:
          refreshedPayment.validation_status === "passed"
            ? "Payment instruction is ready for authorized approval."
            : refreshedPayment.validation_status ===
                "manual_review_required"
              ? "Payment instruction requires manual review."
              : "Payment instruction requires correction.",
      });
    } catch (processingError) {
      await adminClient
        .from("insurance_payment_instructions")
        .update({
          payment_status: "validation_failed",
          validation_status: "failed",
          validation_errors: [
            processingError instanceof Error
              ? processingError.message
              : "Payment preparation failed.",
          ],
        })
        .eq("id", payment.id);

      throw processingError;
    }
  } catch (error) {
    console.error("Payment creation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create payment instruction.",
      },
      { status: 500 }
    );
  }
}

async function loadSettlementReview(
  adminClient: any,
  settlementReviewId: number
) {
  const { data, error } = await adminClient
    .from("insurance_settlement_reviews")
    .select("*")
    .eq("id", settlementReviewId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SettlementReviewRow | null;
}

async function loadClaim(
  adminClient: any,
  claimId: number
) {
  const { data, error } = await adminClient
    .from("insurance_claims")
    .select("*")
    .eq("id", claimId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadRepairJob(
  adminClient: any,
  repairJobId: number
) {
  const { data, error } = await adminClient
    .from("garage_repair_jobs")
    .select(
      `
        *,
        cashless_garages (
          id,
          name,
          phone,
          city,
          state,
          is_cashless,
          is_verified
        )
      `
    )
    .eq("id", repairJobId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadPaymentInstruction(
  adminClient: any,
  paymentInstructionId: number
) {
  const { data, error } = await adminClient
    .from("insurance_payment_instructions")
    .select("*")
    .eq("id", paymentInstructionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PaymentInstructionRow | null;
}

function validateSettlementEligibility(
  settlement: SettlementReviewRow
) {
  const allowedStatuses = new Set<string>([
    "completed",
    "human_reviewed",
    "approved",
    "payment_pending",
  ]);

  if (!allowedStatuses.has(settlement.review_status)) {
    return (
      "The settlement review must be completed or approved " +
      "before payment creation."
    );
  }

  if (settlement.manual_review_required) {
    return (
      "The settlement still requires authorized human review " +
      "before payment creation."
    );
  }

  if (
    settlement.recommendation ===
    "settlement_not_recommended"
  ) {
    return (
      "The settlement review does not currently recommend payment."
    );
  }

  if (settlement.payment_status === "paid") {
    return "This settlement is already marked as paid.";
  }

  return "";
}

function inferPaymentType(
  settlement: SettlementReviewRow,
  repairJob: any
): PaymentCreateBody["payment_type"] {
  if (
    settlement.settlement_mode === "total_loss"
  ) {
    return "total_loss_settlement";
  }

  if (
    settlement.settlement_mode ===
    "salvage_adjusted"
  ) {
    return "salvage_adjusted_settlement";
  }

  if (
    settlement.settlement_mode === "cashless" ||
    repairJob?.cashless_garages?.is_cashless
  ) {
    return "cashless_garage";
  }

  if (settlement.settlement_mode === "mixed") {
    return "split_settlement";
  }

  return "customer_reimbursement";
}

function inferBeneficiaryType(
  paymentType: PaymentCreateBody["payment_type"]
): PaymentCreateBody["beneficiary_type"] {
  if (paymentType === "cashless_garage") {
    return "garage";
  }

  if (paymentType === "split_settlement") {
    return "multiple";
  }

  return "customer";
}

function normalizePaymentType(
  value: unknown
): NonNullable<PaymentCreateBody["payment_type"]> {
  if (
    value === "cashless_garage" ||
    value === "customer_reimbursement" ||
    value === "split_settlement" ||
    value === "total_loss_settlement" ||
    value === "salvage_adjusted_settlement" ||
    value === "partial_payment" ||
    value === "supplementary_payment"
  ) {
    return value;
  }

  return "customer_reimbursement";
}

function normalizeBeneficiaryType(
  value: unknown
): NonNullable<PaymentCreateBody["beneficiary_type"]> {
  if (
    value === "customer" ||
    value === "garage" ||
    value === "lender" ||
    value === "salvage_buyer" ||
    value === "insurer" ||
    value === "multiple"
  ) {
    return value;
  }

  return "customer";
}

function normalizeSplitBeneficiaryType(
  value: unknown
):
  | "customer"
  | "garage"
  | "lender"
  | "salvage_buyer"
  | "insurer" {
  if (
    value === "garage" ||
    value === "lender" ||
    value === "salvage_buyer" ||
    value === "insurer"
  ) {
    return value;
  }

  return "customer";
}

function normalizePaymentMode(
  value: unknown
): NonNullable<PaymentCreateBody["payment_mode"]> {
  if (
    value === "bank_transfer" ||
    value === "upi" ||
    value === "neft" ||
    value === "rtgs" ||
    value === "imps" ||
    value === "gateway" ||
    value === "cheque" ||
    value === "internal_ledger"
  ) {
    return value;
  }

  return "undetermined";
}

function calculateAmounts(
  body: PaymentCreateBody,
  settlement: SettlementReviewRow,
  paymentType: NonNullable<
    PaymentCreateBody["payment_type"]
  >
) {
  const recommendedInsurerPayable = cleanMoney(
    settlement.final_insurer_approved_amount ??
      settlement.final_settlement_amount ??
      settlement.recommended_insurer_payable
  );

  const recommendedCustomerPayable = cleanMoney(
    settlement.final_customer_payable_amount ??
      settlement.recommended_customer_payable
  );

  const bodyNet = cleanMoney(body.net_payable_amount);
  const bodyGross = cleanMoney(body.gross_amount);
  const bodyDeduction = cleanMoney(
    body.deduction_amount
  );

  let netPayableAmount =
    bodyNet ?? recommendedInsurerPayable;

  if (paymentType === "partial_payment") {
    if (bodyNet === null) {
      throw new Error(
        "net_payable_amount is required for a partial payment."
      );
    }

    if (
      recommendedInsurerPayable !== null &&
      bodyNet > recommendedInsurerPayable
    ) {
      throw new Error(
        "Partial payment cannot exceed the approved insurer payable amount."
      );
    }

    netPayableAmount = bodyNet;
  }

  if (netPayableAmount === null) {
    throw new Error(
      "No approved insurer-payable amount is available."
    );
  }

  const deductionAmount =
    bodyDeduction ?? recommendedCustomerPayable ?? 0;

  const grossAmount =
    bodyGross ?? netPayableAmount + deductionAmount;

  if (grossAmount <= 0) {
    throw new Error(
      "Gross payment amount must be greater than zero."
    );
  }

  if (deductionAmount < 0) {
    throw new Error(
      "Deduction amount cannot be negative."
    );
  }

  if (netPayableAmount < 0) {
    throw new Error(
      "Net payable amount cannot be negative."
    );
  }

  if (netPayableAmount > grossAmount) {
    throw new Error(
      "Net payable amount cannot exceed gross amount."
    );
  }

  return {
    grossAmount,
    deductionAmount,
    netPayableAmount,
  };
}

function resolveBeneficiary(args: {
  body: PaymentCreateBody;
  beneficiaryType: NonNullable<
    PaymentCreateBody["beneficiary_type"]
  >;
  claim: any;
  repairJob: any;
}) {
  const providedName = cleanText(
    args.body.beneficiary_name,
    250
  );

  const providedReference = cleanText(
    args.body.beneficiary_reference,
    250
  );

  if (args.beneficiaryType === "garage") {
    const garageName =
      providedName ||
      cleanText(
        args.repairJob?.cashless_garages?.name,
        250
      );

    if (!garageName) {
      throw new Error(
        "Garage beneficiary name is required."
      );
    }

    return {
      name: garageName,
      reference:
        providedReference ||
        String(
          args.repairJob?.cashless_garages?.id ??
            args.repairJob?.garage_id ??
            ""
        ) ||
        null,
    };
  }

  if (args.beneficiaryType === "multiple") {
    return {
      name: providedName || "Multiple beneficiaries",
      reference: providedReference || null,
    };
  }

  const customerName =
    providedName ||
    cleanText(args.claim?.claimant_name, 250) ||
    cleanText(args.claim?.customer_name, 250) ||
    cleanText(args.claim?.insured_name, 250);

  if (!customerName) {
    throw new Error(
      "Customer beneficiary name is required."
    );
  }

  return {
    name: customerName,
    reference:
      providedReference ||
      cleanText(args.claim?.claim_reference, 250) ||
      String(args.claim?.id ?? ""),
  };
}

async function createPaymentSplits(args: {
  adminClient: any;
  userId: string;
  paymentInstructionId: number;
  paymentType: NonNullable<
    PaymentCreateBody["payment_type"]
  >;
  beneficiaryType: NonNullable<
    PaymentCreateBody["beneficiary_type"]
  >;
  beneficiary: {
    name: string;
    reference: string | null;
  };
  netPayableAmount: number;
  splits: NonNullable<PaymentCreateBody["splits"]>;
  defaultPaymentMode: NonNullable<
    PaymentCreateBody["payment_mode"]
  >;
}) {
  const splitRows: Array<Record<string, unknown>> = [];

  if (
    args.paymentType === "split_settlement" ||
    args.beneficiaryType === "multiple"
  ) {
    if (!args.splits.length) {
      throw new Error(
        "At least one split is required for a split settlement."
      );
    }

    let totalSplitAmount = 0;

    for (
      let index = 0;
      index < args.splits.length;
      index += 1
    ) {
      const split = args.splits[index];
      const splitAmount = cleanMoney(
        split.split_amount
      );

      if (
        splitAmount === null ||
        splitAmount <= 0
      ) {
        throw new Error(
          `Split ${index + 1} must have a positive amount.`
        );
      }

      totalSplitAmount += splitAmount;

      splitRows.push({
        user_id: args.userId,
        payment_instruction_id:
          args.paymentInstructionId,
        split_reference:
          `SPLIT-${args.paymentInstructionId}-${index + 1}`,
        split_sequence: index + 1,
        beneficiary_type:
          normalizeSplitBeneficiaryType(
            split.beneficiary_type
          ),
        beneficiary_name:
          cleanNullableText(
            split.beneficiary_name,
            250
          ),
        beneficiary_reference:
          cleanNullableText(
            split.beneficiary_reference,
            250
          ),
        split_amount: splitAmount,
        split_percentage:
          cleanPercentage(
            split.split_percentage
          ) ??
          (args.netPayableAmount > 0
            ? (splitAmount /
                args.netPayableAmount) *
              100
            : null),
        payment_mode:
          normalizePaymentMode(
            split.payment_mode ??
              args.defaultPaymentMode
          ),
        payment_status: "draft",
      });
    }

    const difference = Math.abs(
      totalSplitAmount - args.netPayableAmount
    );

    if (difference > 0.01) {
      throw new Error(
        "Split amounts must equal the net payable amount."
      );
    }
  } else {
    splitRows.push({
      user_id: args.userId,
      payment_instruction_id:
        args.paymentInstructionId,
      split_reference:
        `SPLIT-${args.paymentInstructionId}-1`,
      split_sequence: 1,
      beneficiary_type:
        normalizeSplitBeneficiaryType(
          args.beneficiaryType
        ),
      beneficiary_name: args.beneficiary.name,
      beneficiary_reference:
        args.beneficiary.reference,
      split_amount: args.netPayableAmount,
      split_percentage: 100,
      payment_mode: args.defaultPaymentMode,
      payment_status: "draft",
    });
  }

  const { error } = await args.adminClient
    .from("insurance_payment_splits")
    .insert(splitRows);

  if (error) {
    throw new Error(error.message);
  }
}

async function createPaymentDocuments(args: {
  adminClient: any;
  userId: string;
  paymentInstructionId: number;
  payment: PaymentInstructionRow;
  settlement: SettlementReviewRow;
  claim: any;
  amounts: {
    grossAmount: number;
    deductionAmount: number;
    netPayableAmount: number;
  };
}) {
  const baseMetadata = {
    claim_id: args.settlement.claim_id,
    settlement_review_id: args.settlement.id,
    settlement_reference:
      args.settlement.settlement_reference,
    payment_type: args.payment.payment_type,
    beneficiary_type:
      args.payment.beneficiary_type,
    gross_amount: args.amounts.grossAmount,
    deduction_amount:
      args.amounts.deductionAmount,
    net_payable_amount:
      args.amounts.netPayableAmount,
  };

  const documents = [
    {
      document_type: "payment_advice",
      document_number:
        `ADV-${args.paymentInstructionId}`,
      document_title: "Payment Advice",
      document_summary:
        "Payment advice prepared for authorized approval.",
    },
    {
      document_type: "payment_voucher",
      document_number:
        `VCH-${args.paymentInstructionId}`,
      document_title: "Payment Voucher",
      document_summary:
        "Payment voucher prepared for finance processing.",
    },
    {
      document_type: "settlement_letter",
      document_number:
        `STL-${args.paymentInstructionId}`,
      document_title: "Settlement Letter",
      document_summary:
        `Settlement letter prepared for claim ${
          args.claim?.claim_reference ??
          args.settlement.claim_id
        }.`,
    },
  ].map((document) => ({
    user_id: args.userId,
    payment_instruction_id:
      args.paymentInstructionId,
    document_type: document.document_type,
    document_number: document.document_number,
    document_status: "generated",
    document_title: document.document_title,
    document_summary: document.document_summary,
    metadata: baseMetadata,
  }));

  const { error } = await args.adminClient
    .from("insurance_payment_documents")
    .insert(documents);

  if (error) {
    throw new Error(error.message);
  }
}

function defaultPaymentReason(
  paymentType: NonNullable<
    PaymentCreateBody["payment_type"]
  >
) {
  const reasons: Record<string, string> = {
    cashless_garage:
      "Cashless claim settlement payable to the assigned garage.",
    customer_reimbursement:
      "Approved claim reimbursement payable to the customer.",
    split_settlement:
      "Approved claim settlement split across multiple beneficiaries.",
    total_loss_settlement:
      "Approved total-loss settlement payment.",
    salvage_adjusted_settlement:
      "Approved settlement after authorized salvage adjustment.",
    partial_payment:
      "Authorized partial claim settlement payment.",
    supplementary_payment:
      "Authorized supplementary claim settlement payment.",
  };

  return reasons[paymentType];
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

function cleanMoney(value: unknown): number | null {
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

function normalizeIfsc(value: unknown) {
  const normalized = cleanText(value, 20)
    .toUpperCase()
    .replace(/\s+/g, "");

  return normalized || null;
}

function normalizeDate(value: unknown) {
  if (!value) return null;

  const raw = String(value);
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "scheduled_payment_date is invalid."
    );
  }

  return date.toISOString().slice(0, 10);
}

function maskBankAccount(
  accountNumber: string
) {
  if (!accountNumber) return null;

  const compact = accountNumber.replace(/\s+/g, "");

  if (compact.length <= 4) {
    return compact;
  }

  return `${"*".repeat(
    Math.max(0, compact.length - 4)
  )}${compact.slice(-4)}`;
}

function maskUpi(upiId: string) {
  if (!upiId) return null;

  const [name, handle] = upiId.split("@");

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