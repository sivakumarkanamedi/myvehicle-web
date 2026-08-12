import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  buildMiraProactiveGreeting,
  generateMiraProactiveInsights,
  type MiraProactiveContext,
} from "../../../../lib/mira/miraProactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VehicleRow = {
  id: number;
  created_at: string | null;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  image_url: string | null;
  brand: string | null;
  model: string | null;
  manufacturing_year: number | null;
  fuel_type: string | null;
  odometer: number | null;
  color: string | null;
};

type DocumentRow = {
  id: number;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  expiry_date: string | null;
  scan_status: string | null;
};

type ServiceRow = {
  id: number;
  vehicle_id: number | null;
  service_type: string | null;
  workshop_name: string | null;
  service_date: string | null;
  odometer: number | null;
  total_cost: number | null;
};

function normalise(value?: string | null): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function getLatestExpiry(
  documents: DocumentRow[],
  acceptedTypes: string[]
): string | null {
  const accepted = new Set(acceptedTypes.map(normalise));

  const dates = documents
    .filter((document) => {
      const type = normalise(document.document_type);
      const name = normalise(document.document_name);
      return accepted.has(type) || accepted.has(name);
    })
    .map((document) => document.expiry_date)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !Number.isNaN(new Date(value).getTime()))
    .sort(
      (first, second) =>
        new Date(second).getTime() - new Date(first).getTime()
    );

  return dates[0] ?? null;
}

function hasDocument(
  documents: DocumentRow[],
  acceptedTypes: string[]
): boolean {
  const accepted = new Set(acceptedTypes.map(normalise));

  return documents.some((document) => {
    const type = normalise(document.document_type);
    const name = normalise(document.document_name);

    return accepted.has(type) || accepted.has(name);
  });
}

function isTwoWheeler(vehicleType?: string | null): boolean {
  const type = normalise(vehicleType);

  return [
    "twowheeler",
    "2wheeler",
    "bike",
    "motorbike",
    "motorcycle",
    "scooter",
    "moped",
  ].includes(type);
}

function getDaysUntil(dateValue?: string | null): number | null {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  return Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your login session is invalid or expired." },
        { status: 401 }
      );
    }

    const { data: vehicleRows, error: vehicleError } = await supabase
      .from("vehicles")
      .select(
        "id, created_at, vehicle_name, vehicle_number, vehicle_type, image_url, brand, model, manufacturing_year, fuel_type, odometer, color"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (vehicleError) {
      throw new Error(`Vehicle data could not be loaded: ${vehicleError.message}`);
    }

    const selectedVehicle =
      (vehicleRows?.[0] as VehicleRow | undefined) ?? null;

    let documents: DocumentRow[] = [];
    let latestService: ServiceRow | null = null;

    if (selectedVehicle) {
      const [
        { data: documentRows, error: documentError },
        { data: serviceRows, error: serviceError },
      ] = await Promise.all([
        supabase
          .from("vehicle_documents")
          .select(
            "id, vehicle_id, document_type, document_name, expiry_date, scan_status"
          )
          .eq("user_id", user.id)
          .eq("vehicle_id", selectedVehicle.id),
        supabase
          .from("service_entries")
          .select(
            "id, vehicle_id, service_type, workshop_name, service_date, odometer, total_cost"
          )
          .eq("user_id", user.id)
          .eq("vehicle_id", selectedVehicle.id)
          .order("service_date", { ascending: false })
          .limit(1),
      ]);

      if (documentError) {
        throw new Error(
          `Document data could not be loaded: ${documentError.message}`
        );
      }

      if (serviceError) {
        throw new Error(
          `Service data could not be loaded: ${serviceError.message}`
        );
      }

      documents = (documentRows as DocumentRow[] | null) ?? [];
      latestService =
        (serviceRows?.[0] as ServiceRow | undefined) ?? null;
    }

    const insuranceExpiryDate = getLatestExpiry(documents, [
      "insurance",
      "vehicle insurance",
      "motor insurance",
    ]);

    const pucExpiryDate = getLatestExpiry(documents, [
      "puc",
      "pollution certificate",
      "pollution under control",
    ]);

    const rcExpiryDate = getLatestExpiry(documents, [
      "rc",
      "registration certificate",
      "vehicle registration",
    ]);

    const drivingLicenceExpiryDate = getLatestExpiry(documents, [
      "dl",
      "driving licence",
      "driving license",
      "driver licence",
      "driver license",
    ]);

    const insurancePresent = hasDocument(documents, [
      "insurance",
      "vehicle insurance",
      "motor insurance",
    ]);

    const pucPresent = hasDocument(documents, [
      "puc",
      "pollution certificate",
      "pollution under control",
    ]);

    const rcPresent = hasDocument(documents, [
      "rc",
      "registration certificate",
      "vehicle registration",
    ]);

    const drivingLicencePresent = hasDocument(documents, [
      "dl",
      "driving licence",
      "driving license",
      "driver licence",
      "driver license",
    ]);

    const reviewStatuses = new Set([
      "pending",
      "pendingaiprovider",
      "failed",
      "needsreview",
    ]);

    const needsReviewCount = documents.filter((document) =>
      reviewStatuses.has(normalise(document.scan_status))
    ).length;

    const verifiedStatuses = new Set([
      "verified",
      "completed",
      "approved",
      "success",
    ]);

    const verifiedCount = documents.filter((document) =>
      verifiedStatuses.has(normalise(document.scan_status))
    ).length;

    const expiredCount = documents.filter((document) => {
      const days = getDaysUntil(document.expiry_date);
      return days !== null && days < 0;
    }).length;

    const expiringSoonCount = documents.filter((document) => {
      const days = getDaysUntil(document.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    const metadataName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;

    const context: MiraProactiveContext = {
      userName:
        metadataName ||
        user.email?.split("@")[0] ||
        "My Vehicle User",

      notificationsEnabled:
        user.user_metadata?.notifications_enabled !== false,

      selectedVehicle: selectedVehicle
        ? {
            id: selectedVehicle.id,
            make: selectedVehicle.brand || selectedVehicle.vehicle_name,
            model: selectedVehicle.model,
            registrationNumber: selectedVehicle.vehicle_number,
          }
        : null,

      documents: selectedVehicle
        ? {
            insuranceExpiryDate,
            pucExpiryDate,
            rcExpiryDate,
            expiredCount,
            expiringSoonCount,
            needsReviewCount,
          }
        : null,

      // The present service_entries table records completed services.
      // Future service reminders remain disabled until verified due fields exist.
      service: null,

      // Vehicle health remains disabled until verified diagnostic data exists.
      vehicleHealth: null,

      location: {
        permissionGranted: false,
      },
    };

    const insights = generateMiraProactiveInsights(context);
    const greeting = buildMiraProactiveGreeting(context, insights);

    return NextResponse.json(
      {
        greeting,
        insights,
        generatedAt: new Date().toISOString(),
        hasSelectedVehicle: Boolean(selectedVehicle),
        dashboard: {
          vehicle: selectedVehicle
            ? {
                id: selectedVehicle.id,
                displayName:
                  [selectedVehicle.brand, selectedVehicle.model]
                    .filter(Boolean)
                    .join(" ") ||
                  selectedVehicle.vehicle_name ||
                  "My Vehicle",
                vehicleName: selectedVehicle.vehicle_name,
                registrationNumber: selectedVehicle.vehicle_number,
                vehicleType: selectedVehicle.vehicle_type,
                imageUrl: selectedVehicle.image_url,
                brand: selectedVehicle.brand,
                model: selectedVehicle.model,
                manufacturingYear: selectedVehicle.manufacturing_year,
                fuelType: selectedVehicle.fuel_type,
                odometer: selectedVehicle.odometer,
                color: selectedVehicle.color,
              }
            : null,
          documents: {
            total: documents.length,
            verifiedCount,
            expiredCount,
            expiringSoonCount,
            needsReviewCount,
            insurancePresent,
            pucPresent,
            rcPresent,
            drivingLicencePresent,
            insuranceExpiryDate,
            pucExpiryDate,
            rcExpiryDate,
            drivingLicenceExpiryDate,
          },
          fastag: selectedVehicle
            ? {
                eligible: !isTwoWheeler(selectedVehicle.vehicle_type),
                balance: null,
              }
            : null,
          latestService: latestService
            ? {
                serviceType: latestService.service_type,
                workshopName: latestService.workshop_name,
                serviceDate: latestService.service_date,
                odometer: latestService.odometer,
                totalCost: latestService.total_cost,
              }
            : null,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Mira proactive route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mira proactive updates could not be loaded.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}