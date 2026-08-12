import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type PremiumRatingBody = {
  underwriting_case_id?: number | null;
  quote_id?: number | null;
  proposal_id?: number | null;
  policy_id?: number | null;
  vehicle_id?: number | null;

  policy_type?: string | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;

  requested_idv?: number | null;
  requested_ncb_percent?: number | null;
  voluntary_deductible?: number | null;
  compulsory_deductible?: number | null;

  annual_usage_km?: number | null;
  geographic_zone?: string | null;
  vehicle_usage_type?: string | null;

  selected_addons?: Array<{
    code: string;
    name?: string | null;
    premium_amount?: number | null;
    rate_percent?: number | null;
    coverage_limit?: number | null;
    metadata?: Record<string, unknown>;
  }>;

  manual_loading_percent?: number | null;
  manual_discount_percent?: number | null;
  manual_adjustment_reason?: string | null;

  taxes_percent?: number | null;
  fees?: Array<{
    code: string;
    name?: string | null;
    amount: number;
  }>;

  metadata?: Record<string, unknown>;
};

type UnderwritingCaseRow = {
  id: number;
  user_id: string;
  policy_id: number | null;
  proposal_id: number | null;
  quote_id: number | null;
  vehicle_id: number | null;

  requested_policy_type: string | null;
  requested_idv: number | null;
  requested_total_premium: number | null;

  overall_risk_score: number | null;
  overall_risk_band: string | null;

  recommended_idv: number | null;
  recommended_base_premium: number | null;
  recommended_total_premium: number | null;
  recommended_ncb_percent: number | null;
  recommended_deductible: number | null;

  premium_loading_percent: number;
  premium_discount_percent: number;

  recommended_addons: Array<Record<string, unknown>>;
  coverage_restrictions: Array<Record<string, unknown>>;
  exclusions: Array<Record<string, unknown>>;

  underwriting_status: string;
  decision_status: string;
};

type VehicleRow = {
  id: number;
  user_id: string;
  registration_number?: string | null;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  fuel_type?: string | null;
  vehicle_type?: string | null;
  usage_type?: string | null;
  engine_capacity_cc?: number | null;
  ex_showroom_price?: number | null;
};

type RatingBreakup = {
  idv: number;
  base_rate_percent: number;
  own_damage_premium: number;
  third_party_premium: number;
  addon_premium: number;
  risk_loading_amount: number;
  manual_loading_amount: number;
  ncb_discount_amount: number;
  underwriting_discount_amount: number;
  manual_discount_amount: number;
  deductible_discount_amount: number;
  fee_amount: number;
  tax_amount: number;
  total_premium: number;
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
        { error: "You must be signed in to calculate premium." },
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

    const body = (await request.json()) as PremiumRatingBody;

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

    const underwritingCaseId = positiveInteger(
      body.underwriting_case_id
    );

    const underwritingCase = underwritingCaseId
      ? await loadOwnedUnderwritingCase(
          adminClient as any,
          underwritingCaseId,
          user.id
        )
      : null;

    if (underwritingCaseId && !underwritingCase) {
      return NextResponse.json(
        {
          error:
            "Underwriting case was not found or does not belong to you.",
        },
        { status: 404 }
      );
    }

    const vehicleId =
      positiveInteger(body.vehicle_id) ??
      positiveInteger(underwritingCase?.vehicle_id);

    if (!vehicleId) {
      return NextResponse.json(
        { error: "vehicle_id is required." },
        { status: 400 }
      );
    }

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

    const coverageStartDate =
      normalizeOptionalDate(body.coverage_start_date) ??
      new Date().toISOString().slice(0, 10);

    const coverageEndDate =
      normalizeOptionalDate(body.coverage_end_date) ??
      addYears(coverageStartDate, 1);

    if (
      new Date(coverageEndDate).getTime() <
      new Date(coverageStartDate).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "coverage_end_date cannot be before coverage_start_date.",
        },
        { status: 400 }
      );
    }

    const rating = calculatePremium({
      body,
      vehicle,
      underwritingCase,
    });

    const ratingReference = generateRatingReference();

    const recordPayload = {
      user_id: user.id,
      underwriting_case_id: underwritingCaseId,
      quote_id: positiveInteger(body.quote_id),
      proposal_id: positiveInteger(body.proposal_id),
      policy_id: positiveInteger(body.policy_id),
      vehicle_id: vehicleId,

      rating_reference: ratingReference,
      rating_status: "calculated",

      policy_type:
        cleanText(body.policy_type, 80) ||
        cleanText(
          underwritingCase?.requested_policy_type,
          80
        ) ||
        "comprehensive",

      coverage_start_date: coverageStartDate,
      coverage_end_date: coverageEndDate,

      idv: rating.idv,
      base_rate_percent: rating.base_rate_percent,

      own_damage_premium: rating.own_damage_premium,
      third_party_premium: rating.third_party_premium,
      addon_premium: rating.addon_premium,

      risk_loading_amount: rating.risk_loading_amount,
      manual_loading_amount: rating.manual_loading_amount,

      ncb_discount_amount: rating.ncb_discount_amount,
      underwriting_discount_amount:
        rating.underwriting_discount_amount,
      manual_discount_amount: rating.manual_discount_amount,
      deductible_discount_amount:
        rating.deductible_discount_amount,

      fee_amount: rating.fee_amount,
      tax_amount: rating.tax_amount,
      total_premium: rating.total_premium,

      ncb_percent:
        cleanPercentage(body.requested_ncb_percent) ??
        cleanPercentage(
          underwritingCase?.recommended_ncb_percent
        ) ??
        0,

      voluntary_deductible:
        cleanMoney(body.voluntary_deductible) ?? 0,

      compulsory_deductible:
        cleanMoney(body.compulsory_deductible) ??
        cleanMoney(
          underwritingCase?.recommended_deductible
        ) ??
        0,

      premium_loading_percent:
        effectiveLoadingPercent(
          underwritingCase,
          body
        ),

      premium_discount_percent:
        effectiveDiscountPercent(
          underwritingCase,
          body
        ),

      selected_addons:
        Array.isArray(body.selected_addons)
          ? body.selected_addons
          : [],

      fees:
        Array.isArray(body.fees)
          ? body.fees
          : [],

      calculation_breakup: rating,

      metadata: {
        vehicle_registration_number:
          vehicle.registration_number ?? null,
        vehicle_make: vehicle.make ?? null,
        vehicle_model: vehicle.model ?? null,
        vehicle_variant: vehicle.variant ?? null,
        vehicle_year: vehicle.year ?? null,
        vehicle_fuel_type: vehicle.fuel_type ?? null,
        geographic_zone:
          cleanNullableText(body.geographic_zone, 80),
        annual_usage_km:
          cleanNonNegativeNumber(body.annual_usage_km),
        manual_adjustment_reason:
          cleanNullableText(
            body.manual_adjustment_reason,
            2000
          ),
        source_metadata:
          validObject(body.metadata) ?? {},
      },

      calculated_at: new Date().toISOString(),
    };

    const ratingTableExists = await tableExists(
      adminClient as any,
      "insurance_premium_ratings"
    );

    let ratingRecordId: number | null = null;

    if (ratingTableExists) {
      const { data: ratingData, error: ratingError } =
        await adminClient
          .from("insurance_premium_ratings")
          .insert(recordPayload)
          .select("id")
          .single();

      if (ratingError || !ratingData) {
        throw new Error(
          ratingError?.message ||
            "Unable to store premium rating."
        );
      }

      ratingRecordId = Number(ratingData.id);
    }

    if (underwritingCase) {
      await adminClient
        .from("insurance_underwriting_cases")
        .update({
          recommended_idv: rating.idv,
          recommended_base_premium:
            rating.own_damage_premium +
            rating.third_party_premium,
          recommended_total_premium:
            rating.total_premium,
          updated_at: new Date().toISOString(),
        })
        .eq("id", underwritingCase.id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      rating_record_id: ratingRecordId,
      rating_reference: ratingReference,
      vehicle_id: vehicleId,
      underwriting_case_id:
        underwritingCase?.id ?? null,
      coverage_start_date: coverageStartDate,
      coverage_end_date: coverageEndDate,
      rating,
      message:
        ratingTableExists
          ? "Premium calculated and stored successfully."
          : "Premium calculated successfully. Create insurance_premium_ratings table to persist rating history.",
    });
  } catch (error) {
    console.error("Premium rating error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate premium.",
      },
      { status: 500 }
    );
  }
}

async function loadOwnedUnderwritingCase(
  adminClient: any,
  underwritingCaseId: number,
  userId: string
) {
  const { data, error } = await adminClient
    .from("insurance_underwriting_cases")
    .select("*")
    .eq("id", underwritingCaseId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as UnderwritingCaseRow | null;
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

  return data as VehicleRow | null;
}

async function tableExists(
  adminClient: any,
  tableName: string
) {
  const { data, error } = await adminClient.rpc(
    "to_regclass",
    {
      name: `public.${tableName}`,
    }
  );

  if (!error && data) {
    return true;
  }

  const { error: probeError } = await adminClient
    .from(tableName)
    .select("id")
    .limit(1);

  return !probeError;
}

function calculatePremium(args: {
  body: PremiumRatingBody;
  vehicle: VehicleRow;
  underwritingCase: UnderwritingCaseRow | null;
}): RatingBreakup {
  const currentYear = new Date().getUTCFullYear();

  const vehicleAge =
    cleanYear(args.vehicle.year) === null
      ? 5
      : Math.max(
          0,
          currentYear -
            (cleanYear(args.vehicle.year) ?? currentYear)
        );

  const requestedIdv =
    cleanMoney(args.body.requested_idv) ??
    cleanMoney(
      args.underwritingCase?.recommended_idv
    ) ??
    cleanMoney(
      args.underwritingCase?.requested_idv
    ) ??
    cleanMoney(args.vehicle.ex_showroom_price) ??
    500000;

  const depreciationRate =
    vehicleAge <= 1
      ? 0.1
      : vehicleAge <= 2
        ? 0.15
        : vehicleAge <= 3
          ? 0.2
          : vehicleAge <= 4
            ? 0.3
            : vehicleAge <= 5
              ? 0.4
              : 0.5;

  const idv = roundMoney(
    Math.max(
      50000,
      requestedIdv * (1 - depreciationRate)
    )
  );

  const usageType =
    cleanText(
      args.body.vehicle_usage_type,
      80
    ) ||
    cleanText(args.vehicle.usage_type, 80) ||
    "private";

  const baseRatePercent =
    usageType.toLowerCase().includes("commercial")
      ? 3.5
      : vehicleAge > 10
        ? 3.2
        : vehicleAge > 5
          ? 2.8
          : 2.4;

  const ownDamagePremium = roundMoney(
    idv * (baseRatePercent / 100)
  );

  const thirdPartyPremium = roundMoney(
    calculateThirdPartyPremium(args.vehicle)
  );

  const addonPremium = roundMoney(
    calculateAddonPremium(
      args.body.selected_addons,
      idv
    )
  );

  const loadingPercent =
    effectiveLoadingPercent(
      args.underwritingCase,
      args.body
    );

  const discountPercent =
    effectiveDiscountPercent(
      args.underwritingCase,
      args.body
    );

  const riskLoadingAmount = roundMoney(
    (ownDamagePremium + thirdPartyPremium) *
      (
        (
          cleanPercentage(
            args.underwritingCase
              ?.premium_loading_percent
          ) ?? 0
        ) /
        100
      )
  );

  const manualLoadingAmount = roundMoney(
    (ownDamagePremium + thirdPartyPremium) *
      (
        (
          cleanPercentage(
            args.body.manual_loading_percent
          ) ?? 0
        ) /
        100
      )
  );

  const ncbPercent =
    cleanPercentage(
      args.body.requested_ncb_percent
    ) ??
    cleanPercentage(
      args.underwritingCase
        ?.recommended_ncb_percent
    ) ??
    0;

  const ncbDiscountAmount = roundMoney(
    ownDamagePremium *
      (ncbPercent / 100)
  );

  const underwritingDiscountAmount = roundMoney(
    ownDamagePremium *
      (
        (
          cleanPercentage(
            args.underwritingCase
              ?.premium_discount_percent
          ) ?? 0
        ) /
        100
      )
  );

  const manualDiscountAmount = roundMoney(
    ownDamagePremium *
      (
        (
          cleanPercentage(
            args.body.manual_discount_percent
          ) ?? 0
        ) /
        100
      )
  );

  const voluntaryDeductible =
    cleanMoney(args.body.voluntary_deductible) ?? 0;

  const deductibleDiscountAmount = roundMoney(
    Math.min(
      ownDamagePremium * 0.15,
      voluntaryDeductible * 0.1
    )
  );

  const feeAmount = roundMoney(
    (args.body.fees ?? []).reduce(
      (sum, fee) =>
        sum + (cleanMoney(fee.amount) ?? 0),
      0
    )
  );

  const premiumBeforeTax = Math.max(
    0,
    ownDamagePremium +
      thirdPartyPremium +
      addonPremium +
      riskLoadingAmount +
      manualLoadingAmount -
      ncbDiscountAmount -
      underwritingDiscountAmount -
      manualDiscountAmount -
      deductibleDiscountAmount +
      feeAmount
  );

  const taxPercent =
    cleanPercentage(args.body.taxes_percent) ??
    18;

  const taxAmount = roundMoney(
    premiumBeforeTax *
      (taxPercent / 100)
  );

  const totalPremium = roundMoney(
    premiumBeforeTax + taxAmount
  );

  return {
    idv,
    base_rate_percent: baseRatePercent,
    own_damage_premium: ownDamagePremium,
    third_party_premium: thirdPartyPremium,
    addon_premium: addonPremium,
    risk_loading_amount: riskLoadingAmount,
    manual_loading_amount: manualLoadingAmount,
    ncb_discount_amount: ncbDiscountAmount,
    underwriting_discount_amount:
      underwritingDiscountAmount,
    manual_discount_amount: manualDiscountAmount,
    deductible_discount_amount:
      deductibleDiscountAmount,
    fee_amount: feeAmount,
    tax_amount: taxAmount,
    total_premium: totalPremium,
  };
}

function calculateThirdPartyPremium(
  vehicle: VehicleRow
) {
  const vehicleType =
    cleanText(vehicle.vehicle_type, 80).toLowerCase();

  const fuelType =
    cleanText(vehicle.fuel_type, 80).toLowerCase();

  const engineCapacity =
    cleanNonNegativeNumber(
      vehicle.engine_capacity_cc
    ) ?? 1200;

  if (fuelType.includes("electric")) {
    return vehicleType.includes("two")
      ? 1200
      : 2200;
  }

  if (
    vehicleType.includes("two") ||
    vehicleType.includes("bike")
  ) {
    return engineCapacity <= 150
      ? 850
      : engineCapacity <= 350
        ? 1500
        : 2800;
  }

  return engineCapacity <= 1000
    ? 2100
    : engineCapacity <= 1500
      ? 3500
      : 7800;
}

function calculateAddonPremium(
  addons:
    | PremiumRatingBody["selected_addons"]
    | undefined,
  idv: number
) {
  if (!Array.isArray(addons)) {
    return 0;
  }

  return addons.reduce((sum, addon) => {
    const fixed =
      cleanMoney(addon.premium_amount);

    if (fixed !== null) {
      return sum + fixed;
    }

    const rate =
      cleanPercentage(addon.rate_percent) ?? 0;

    return sum + idv * (rate / 100);
  }, 0);
}

function effectiveLoadingPercent(
  underwritingCase: UnderwritingCaseRow | null,
  body: PremiumRatingBody
) {
  return round(
    (
      cleanPercentage(
        underwritingCase?.premium_loading_percent
      ) ?? 0
    ) +
      (
        cleanPercentage(
          body.manual_loading_percent
        ) ?? 0
      ),
    3
  );
}

function effectiveDiscountPercent(
  underwritingCase: UnderwritingCaseRow | null,
  body: PremiumRatingBody
) {
  return round(
    (
      cleanPercentage(
        underwritingCase?.premium_discount_percent
      ) ?? 0
    ) +
      (
        cleanPercentage(
          body.manual_discount_percent
        ) ?? 0
      ),
    3
  );
}

function generateRatingReference() {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

  return `RATE-${datePart}-${randomPart}`;
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

function normalizeOptionalDate(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

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

function addYears(
  dateString: string,
  years: number
) {
  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  date.setUTCFullYear(
    date.getUTCFullYear() + years
  );

  return date.toISOString().slice(0, 10);
}

function roundMoney(
  value: number
) {
  return Math.round(value * 100) / 100;
}

function round(
  value: number,
  decimals = 2
) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}