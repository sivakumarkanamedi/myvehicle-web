export type SupportedDocumentType =
  | "Insurance"
  | "RC"
  | "Driving Licence"
  | "PUC"
  | "Unknown";

export type ExtractedDocumentData = Record<string, string>;

export type ScanResult = {
  documentType: SupportedDocumentType;
  extractedData: ExtractedDocumentData;
  confidence: number;
  warnings: string[];
  rawText?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type MiraOCRPayload = {
  documentType?: unknown;
  confidence?: unknown;
  warnings?: unknown;
  rawText?: unknown;
  extractedData?: unknown;
};

const OPENAI_RESPONSES_URL =
  "https://api.openai.com/v1/responses";

const OCR_MODEL =
  process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

const EXTRACTION_PROMPT = `
You are Mira AI, a careful Indian vehicle-document reader.

Read the supplied document and return JSON only.

Never invent, estimate or complete missing values.
Use an empty string when a value is absent or unreadable.
Do not mark a document verified merely because it looks official.

Identify exactly one documentType:
- Insurance
- RC
- Driving Licence
- PUC
- Unknown

Extract only the fields for the detected type.

Insurance fields:
- policyNumber
- company
- startDate
- expiryDate
- vehicleNumber

RC fields:
- owner
- registrationNumber
- fuel
- class
- model
- chassisNumber
- engineNumber

Driving Licence fields:
- dlNumber
- holderName
- dateOfBirth
- issueDate
- expiryDate

PUC fields:
- certificateNumber
- vehicleNumber
- emissionType
- expiryDate

Date rules:
- Return dates as YYYY-MM-DD when the date is clearly readable.
- Otherwise return the exact readable value.
- Never guess a missing year, month or day.

Confidence rules:
- Return a number from 0 to 100.
- Use a lower score for blur, glare, cropping, handwriting,
  conflicting fields, partial pages or unreadable text.

Warnings:
- Return an array of short warning strings.
- Mention blur, cropping, missing key fields, mismatch or uncertainty.
- Do not claim government, insurer or database verification.

rawText:
- Return the important readable text from the document.
- Do not include unnecessary repeated boilerplate.

Required JSON shape:
{
  "documentType": "Insurance | RC | Driving Licence | PUC | Unknown",
  "extractedData": {},
  "confidence": 0,
  "warnings": [],
  "rawText": ""
}
`.trim();

function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is missing from .env.local."
    );
  }

  return key;
}

function extensionFromUrl(fileUrl: string): string {
  try {
    const parsed = new URL(fileUrl);
    const pathname = decodeURIComponent(parsed.pathname);
    const lastPart = pathname.split("/").pop() || "";
    const extension = lastPart.split(".").pop() || "";

    return extension.toLowerCase();
  } catch {
    const cleanUrl = fileUrl.split("?")[0];
    const extension = cleanUrl.split(".").pop() || "";

    return extension.toLowerCase();
  }
}

function getInputContent(fileUrl: string) {
  const extension = extensionFromUrl(fileUrl);

  if (extension === "pdf") {
    return {
      type: "input_file" as const,
      file_url: fileUrl,
    };
  }

  if (SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return {
      type: "input_image" as const,
      image_url: fileUrl,
      detail: "high" as const,
    };
  }

  throw new Error(
    "Unsupported document format. Upload PDF, JPG, JPEG, PNG or WebP."
  );
}

function extractResponseText(response: OpenAIResponse): string {
  if (
    typeof response.output_text === "string" &&
    response.output_text.trim()
  ) {
    return response.output_text.trim();
  }

  const textParts =
    response.output
      ?.flatMap((item) => item.content ?? [])
      .filter(
        (content) =>
          content.type === "output_text" &&
          typeof content.text === "string"
      )
      .map((content) => content.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return textParts.join("\n").trim();
}

function removeCodeFences(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJSONResponse(value: string): MiraOCRPayload {
  const cleaned = removeCodeFences(value);

  try {
    return JSON.parse(cleaned) as MiraOCRPayload;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(
          cleaned.slice(start, end + 1)
        ) as MiraOCRPayload;
      } catch {
        // Continue to the trusted error below.
      }
    }

    throw new Error(
      "Mira received an unreadable OCR response."
    );
  }
}

function normalizeDocumentType(
  value: unknown
): SupportedDocumentType {
  if (typeof value !== "string") {
    return "Unknown";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    normalized === "insurance" ||
    normalized.includes("vehicle insurance") ||
    normalized.includes("motor insurance")
  ) {
    return "Insurance";
  }

  if (
    normalized === "rc" ||
    normalized.includes("registration certificate")
  ) {
    return "RC";
  }

  if (
    normalized === "dl" ||
    normalized.includes("driving licence") ||
    normalized.includes("driving license")
  ) {
    return "Driving Licence";
  }

  if (
    normalized === "puc" ||
    normalized.includes("pollution")
  ) {
    return "PUC";
  }

  return "Unknown";
}

function normalizeConfidence(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace("%", "").trim())
        : 0;

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const percentage = parsed <= 1 ? parsed * 100 : parsed;

  return Math.round(
    Math.min(100, Math.max(0, percentage)) * 100
  ) / 100;
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim().length > 0
    )
    .map((item) => item.trim())
    .slice(0, 10);
}

function normalizeExtractedData(
  value: unknown
): ExtractedDocumentData {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result: ExtractedDocumentData = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (
      typeof rawValue === "string" &&
      rawValue.trim().length > 0
    ) {
      result[key] = rawValue.trim();
      continue;
    }

    if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      result[key] = String(rawValue);
    }
  }

  return result;
}

function requiredKeyForType(
  documentType: SupportedDocumentType
): string | null {
  switch (documentType) {
    case "Insurance":
      return "policyNumber";

    case "RC":
      return "registrationNumber";

    case "Driving Licence":
      return "dlNumber";

    case "PUC":
      return "certificateNumber";

    default:
      return null;
  }
}

function createTrustWarnings(
  documentType: SupportedDocumentType,
  extractedData: ExtractedDocumentData,
  existingWarnings: string[]
): string[] {
  const warnings = [...existingWarnings];

  if (documentType === "Unknown") {
    warnings.push(
      "Mira could not confidently identify the document type."
    );
  }

  const requiredKey = requiredKeyForType(documentType);

  if (requiredKey && !extractedData[requiredKey]) {
    warnings.push(
      `The key field ${requiredKey} was not clearly detected.`
    );
  }

  if (Object.keys(extractedData).length === 0) {
    warnings.push(
      "No supported fields were clearly readable."
    );
  }

  return Array.from(new Set(warnings)).slice(0, 10);
}

export async function scanDocument(
  fileUrl: string
): Promise<ScanResult> {
  if (!fileUrl.trim()) {
    throw new Error("Document URL is missing.");
  }

  const apiKey = requireOpenAIKey();
  const fileInput = getInputContent(fileUrl);

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      temperature: 0,
      max_output_tokens: 2500,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: EXTRACTION_PROMPT,
            },
            fileInput,
          ],
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const responseBody =
    (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(
      responseBody.error?.message ||
        `OpenAI OCR request failed with status ${response.status}.`
    );
  }

  const responseText = extractResponseText(responseBody);

  if (!responseText) {
    throw new Error(
      "OpenAI returned no readable OCR result."
    );
  }

  const parsed = parseJSONResponse(responseText);
  const documentType = normalizeDocumentType(
    parsed.documentType
  );
  const extractedData = normalizeExtractedData(
    parsed.extractedData
  );
  const confidence = normalizeConfidence(parsed.confidence);
  const warnings = createTrustWarnings(
    documentType,
    extractedData,
    normalizeWarnings(parsed.warnings)
  );
  const rawText =
    typeof parsed.rawText === "string"
      ? parsed.rawText.trim()
      : "";

  return {
    documentType,
    extractedData,
    confidence,
    warnings,
    rawText,
  };
}

export function parseDocumentText(
  rawText: string
): ScanResult {
  const normalizedText = rawText.trim();

  return {
    documentType: "Unknown",
    extractedData: {},
    confidence: 0,
    warnings: normalizedText
      ? [
          "Direct text parsing is not used for verification. Run scanDocument with the uploaded file.",
        ]
      : ["No readable document text was supplied."],
    rawText: normalizedText,
  };
}