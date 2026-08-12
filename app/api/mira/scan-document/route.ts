import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scanDocument,
  type ScanResult,
} from "../../../../lib/mira/documentScanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "vehicle-documents";

type ScanRequestBody = {
  documentId?: number | string;
};

type VehicleDocumentRow = {
  id: number;
  user_id: string;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_path: string | null;
  file_url: string | null;
};

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createAdminClient() {
  const supabaseUrl = requireEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_URL"
  );

  const serviceRoleKey = requireEnvironmentVariable(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token?.trim()
  ) {
    return null;
  }

  return token.trim();
}

function normalize(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function getExtractedValue(
  extractedData: Record<string, string>,
  possibleKeys: string[]
): string | null {
  const entries = Object.entries(extractedData);

  for (const possibleKey of possibleKeys) {
    const normalizedPossibleKey = normalize(possibleKey);

    const match = entries.find(
      ([key]) => normalize(key) === normalizedPossibleKey
    );

    if (
      match &&
      typeof match[1] === "string" &&
      match[1].trim()
    ) {
      return match[1].trim();
    }
  }

  return null;
}

function parseDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  const isoDateMatch = trimmedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (isoDateMatch) {
    return trimmedValue;
  }

  const indianDateMatch = trimmedValue.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
  );

  if (indianDateMatch) {
    const [, day, month, year] = indianDateMatch;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}`;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function determineDocumentNumber(
  result: ScanResult
): string | null {
  const type = normalize(result.documentType);

  if (type.includes("insurance")) {
    return getExtractedValue(result.extractedData, [
      "policyNumber",
      "policy_number",
      "policy number",
    ]);
  }

  if (
    type === "rc" ||
    type.includes("registration certificate")
  ) {
    return getExtractedValue(result.extractedData, [
      "registrationNumber",
      "registration_number",
      "registration number",
      "vehicleNumber",
      "vehicle_number",
      "vehicle number",
    ]);
  }

  if (
    type === "dl" ||
    type.includes("driving licence") ||
    type.includes("driving license")
  ) {
    return getExtractedValue(result.extractedData, [
      "dlNumber",
      "dl_number",
      "dl number",
      "licenceNumber",
      "licenseNumber",
      "licence number",
      "license number",
    ]);
  }

  if (
    type === "puc" ||
    type.includes("pollution")
  ) {
    return getExtractedValue(result.extractedData, [
      "certificateNumber",
      "certificate_number",
      "certificate number",
    ]);
  }

  return getExtractedValue(result.extractedData, [
    "documentNumber",
    "document_number",
    "document number",
  ]);
}

function determineIssueDate(
  result: ScanResult
): string | null {
  return parseDate(
    getExtractedValue(result.extractedData, [
      "issueDate",
      "issue_date",
      "issue date",
      "startDate",
      "start_date",
      "start date",
      "validFrom",
      "valid_from",
      "valid from",
    ])
  );
}

function determineExpiryDate(
  result: ScanResult
): string | null {
  return parseDate(
    getExtractedValue(result.extractedData, [
      "expiryDate",
      "expiry_date",
      "expiry date",
      "validUntil",
      "valid_until",
      "valid until",
      "validTo",
      "valid_to",
      "valid to",
    ])
  );
}

function sanitizeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  const normalized =
    confidence <= 1 ? confidence * 100 : confidence;

  return (
    Math.round(
      Math.min(100, Math.max(0, normalized)) * 100
    ) / 100
  );
}

function sanitizeWarnings(warnings: string[]): string[] {
  return Array.from(
    new Set(
      warnings
        .filter(
          (warning) =>
            typeof warning === "string" &&
            warning.trim().length > 0
        )
        .map((warning) => warning.trim())
    )
  ).slice(0, 10);
}

export async function POST(request: NextRequest) {
  let documentId: number | null = null;
  let authenticatedUserId: string | null = null;

  try {
    const adminSupabase = createAdminClient();
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication token is missing.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authenticationError,
    } = await adminSupabase.auth.getUser(token);

    if (authenticationError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Your session is invalid or has expired.",
        },
        { status: 401 }
      );
    }

    authenticatedUserId = user.id;

    let body: ScanRequestBody;

    try {
      body = (await request.json()) as ScanRequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "The request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    documentId = Number(body.documentId);

    if (
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid documentId is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: documentData,
      error: documentError,
    } = await adminSupabase
      .from("vehicle_documents")
      .select(
        "id, user_id, vehicle_id, document_type, document_name, document_number, issue_date, expiry_date, file_path, file_url"
      )
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (documentError) {
      throw new Error(
        `Unable to load document: ${documentError.message}`
      );
    }

    if (!documentData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document was not found or does not belong to this user.",
        },
        { status: 404 }
      );
    }

    const document =
      documentData as VehicleDocumentRow;

    if (!document.file_path && !document.file_url) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The document does not contain a file path or file URL.",
        },
        { status: 400 }
      );
    }

    const { error: scanningStatusError } =
      await adminSupabase
        .from("vehicle_documents")
        .update({
          scan_status: "scanning",
          scan_error: null,
          verified: false,
        })
        .eq("id", document.id)
        .eq("user_id", user.id);

    if (scanningStatusError) {
      throw new Error(
        `Unable to start scanning: ${scanningStatusError.message}`
      );
    }

    let scannerFileUrl = document.file_url;

    if (document.file_path) {
      const {
        data: downloadedFile,
        error: downloadError,
      } = await adminSupabase.storage
        .from(STORAGE_BUCKET)
        .download(document.file_path);

      if (downloadError || !downloadedFile) {
        throw new Error(
          downloadError?.message ||
            "Unable to download the document from storage."
        );
      }

      if (downloadedFile.size === 0) {
        throw new Error(
          "The uploaded document is empty."
        );
      }

      const {
        data: signedUrlData,
        error: signedUrlError,
      } = await adminSupabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(document.file_path, 600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(
          signedUrlError?.message ||
            "Unable to create a secure document URL."
        );
      }

      scannerFileUrl = signedUrlData.signedUrl;
    }

    if (!scannerFileUrl) {
      throw new Error(
        "Unable to prepare the document for scanning."
      );
    }

    const scanResult = await scanDocument(scannerFileUrl);

    const confidence = sanitizeConfidence(
      scanResult.confidence
    );

    const warnings = sanitizeWarnings(
      scanResult.warnings ?? []
    );

    const detectedDocumentType =
      scanResult.documentType &&
      normalize(scanResult.documentType) !== "unknown"
        ? scanResult.documentType.trim()
        : document.document_type;

    const extractedDocumentNumber =
      determineDocumentNumber(scanResult);

    const extractedIssueDate =
      determineIssueDate(scanResult);

    const extractedExpiryDate =
      determineExpiryDate(scanResult);

    const hasExtractedData =
      Object.keys(scanResult.extractedData ?? {}).length > 0;

    const verified =
      confidence >= 85 &&
      hasExtractedData &&
      warnings.length === 0;

    const finalScanStatus = verified
      ? "verified"
      : hasExtractedData
        ? "review"
        : "completed";

    const updatePayload = {
      document_type: detectedDocumentType,
      document_number:
        extractedDocumentNumber ||
        document.document_number ||
        null,
      issue_date:
        extractedIssueDate ||
        document.issue_date ||
        null,
      expiry_date:
        extractedExpiryDate ||
        document.expiry_date ||
        null,
      extracted_data: scanResult.extractedData ?? {},
      confidence,
      verified,
      quality_issues: warnings,
      scan_status: finalScanStatus,
      scanned_at: new Date().toISOString(),
      scan_error: null,
    };

    const {
      data: updatedDocument,
      error: updateError,
    } = await adminSupabase
      .from("vehicle_documents")
      .update(updatePayload)
      .eq("id", document.id)
      .eq("user_id", user.id)
      .select(
        "id, vehicle_id, document_type, document_name, document_number, issue_date, expiry_date, extracted_data, confidence, verified, quality_issues, scan_status, scanned_at"
      )
      .single();

    if (updateError) {
      throw new Error(
        `Unable to save scan results: ${updateError.message}`
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: verified
          ? "Document scanned and verified by Mira."
          : "Document scanned. Please review the extracted details.",
        document: updatedDocument,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Mira could not scan the document.";

    console.error("Mira document scan failed:", error);

    if (documentId && authenticatedUserId) {
      try {
        const adminSupabase = createAdminClient();

        await adminSupabase
          .from("vehicle_documents")
          .update({
            scan_status: "failed",
            scan_error: errorMessage,
            verified: false,
            scanned_at: new Date().toISOString(),
          })
          .eq("id", documentId)
          .eq("user_id", authenticatedUserId);
      } catch (statusUpdateError) {
        console.error(
          "Unable to save failed scan status:",
          statusUpdateError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}