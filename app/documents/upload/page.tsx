"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../supabase";

type VehicleRow = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
};

type UploadState =
  | "idle"
  | "uploading"
  | "scanning"
  | "reading"
  | "extracting"
  | "verifying"
  | "success"
  | "error";

type ScanStep = {
  key: Exclude<UploadState, "idle" | "success" | "error">;
  label: string;
  description: string;
};

const DOCUMENT_TYPES = [
  "Vehicle Insurance",
  "Registration Certificate",
  "PUC",
  "Driving Licence",
  "FASTag",
  "Service Record",
  "Vehicle Manual",
  "Other Document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SCAN_STEPS: ScanStep[] = [
  {
    key: "uploading",
    label: "Uploading securely",
    description: "Saving your document in the protected vehicle vault.",
  },
  {
    key: "scanning",
    label: "Scanning document",
    description: "Mira is checking the file structure and image quality.",
  },
  {
    key: "reading",
    label: "Reading text",
    description: "Mira is identifying readable text and document fields.",
  },
  {
    key: "extracting",
    label: "Extracting details",
    description: "Important vehicle and document information is being organised.",
  },
  {
    key: "verifying",
    label: "Verifying information",
    description: "Mira is checking confidence and possible quality issues.",
  },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      value.message,
      value.details,
      value.hint,
      value.code ? `Code: ${String(value.code)}` : undefined,
    ].filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );

    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  return "Something went wrong.";
}

function isTwoWheeler(vehicleType?: string | null) {
  const value = (vehicleType || "").toLowerCase();

  return [
    "bike",
    "motorbike",
    "motorcycle",
    "scooter",
    "moped",
    "two wheeler",
    "2 wheeler",
  ].some((type) => value.includes(type));
}

function UploadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export default function UploadDocumentPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [documentType, setDocumentType] = useState(
    "Vehicle Insurance"
  );
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [scanConfidence, setScanConfidence] = useState<number | null>(
    null
  );
  const [scanVerified, setScanVerified] = useState(false);

  useEffect(() => {
    async function loadVehicles() {
      try {
        setLoadingVehicles(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("vehicles")
          .select(
            "id, vehicle_name, vehicle_number, vehicle_type"
          )
          .eq("user_id", user.id)
          .order("id", { ascending: false });

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as VehicleRow[];

        setVehicles(rows);

        if (rows.length > 0) {
          setVehicleId(String(rows[0].id));
        }
      } catch (error) {
        setStatus("error");
        setMessage(getErrorMessage(error));
      } finally {
        setLoadingVehicles(false);
      }
    }

    void loadVehicles();
  }, [router]);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find(
        (vehicle) => String(vehicle.id) === vehicleId
      ) ?? null,
    [vehicles, vehicleId]
  );

  const availableDocumentTypes = useMemo(
    () =>
      DOCUMENT_TYPES.filter(
        (type) =>
          type !== "FASTag" ||
          !isTwoWheeler(selectedVehicle?.vehicle_type)
      ),
    [selectedVehicle]
  );

  useEffect(() => {
    if (
      documentType === "FASTag" &&
      isTwoWheeler(selectedVehicle?.vehicle_type)
    ) {
      setDocumentType("Vehicle Insurance");
    }
  }, [documentType, selectedVehicle]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0] ?? null;

    setMessage("");
    setStatus("idle");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setFile(null);
      setStatus("error");
      setMessage("Only PDF, JPG, PNG and WebP files are allowed.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setStatus("error");
      setMessage("The selected file must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setStatus("error");
      setMessage("The selected file is empty.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  }

  async function wait(milliseconds: number) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, milliseconds)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isBusy = [
      "uploading",
      "scanning",
      "reading",
      "extracting",
      "verifying",
    ].includes(status);

    if (isBusy) return;

    if (!vehicleId) {
      setStatus("error");
      setMessage("Please select a vehicle.");
      return;
    }

    if (!file) {
      setStatus("error");
      setMessage("Please select a document file.");
      return;
    }

    setScanConfidence(null);
    setScanVerified(false);
    setStatus("uploading");
    setMessage("Uploading securely...");

    let uploadedPath: string | null = null;
    let insertedDocumentId: number | null = null;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (sessionError || !session || !user) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();

      uploadedPath = `${user.id}/${vehicleId}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("vehicle-documents")
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: insertedDocument, error: insertError } =
        await supabase
          .from("vehicle_documents")
          .insert({
            user_id: user.id,
            vehicle_id: Number(vehicleId),
            document_type: documentType,
            document_name: file.name,
            document_number: documentNumber.trim() || null,
            issue_date: issueDate || null,
            expiry_date: expiryDate || null,
            file_path: uploadedPath,
            file_url: null,
            extracted_data: {},
            confidence: 0,
            verified: false,
            quality_issues: [],
            scan_status: "pending",
            scan_error: null,
            scanned_at: null,
          })
          .select("id")
          .single();

      if (insertError || !insertedDocument) {
        await supabase.storage
          .from("vehicle-documents")
          .remove([uploadedPath]);

        throw insertError ?? new Error("Document record was not created.");
      }

      insertedDocumentId = Number(insertedDocument.id);

      setStatus("scanning");
      setMessage("Mira is scanning the document...");
      await wait(400);

      setStatus("reading");
      setMessage("Mira is reading the document...");
      await wait(400);

      setStatus("extracting");
      setMessage("Mira is extracting important details...");

      const scanResponse = await fetch("/api/mira/scan-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentId: insertedDocumentId,
        }),
      });

      setStatus("verifying");
      setMessage("Mira is verifying the extracted information...");

      const scanPayload = (await scanResponse.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            message?: string;
            document?: {
              confidence?: number | null;
              verified?: boolean | null;
            };
          }
        | null;

      if (!scanResponse.ok || !scanPayload?.success) {
        throw new Error(
          scanPayload?.error ||
            "The document was uploaded, but Mira could not complete the scan."
        );
      }

      await wait(450);

      const confidence =
        typeof scanPayload.document?.confidence === "number"
          ? scanPayload.document.confidence
          : null;

      const verified = Boolean(
        scanPayload.document?.verified
      );

      setScanConfidence(confidence);
      setScanVerified(verified);
      setStatus("success");
      setMessage(
        scanPayload.message ||
          (verified
            ? "Document scanned and verified by Mira."
            : "Document scanned. Please review the extracted details.")
      );

      window.setTimeout(() => {
        router.push("/documents");
      }, 2200);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      if (insertedDocumentId) {
        await supabase
          .from("vehicle_documents")
          .update({
            scan_status: "failed",
            scan_error: errorMessage,
            verified: false,
            scanned_at: new Date().toISOString(),
          })
          .eq("id", insertedDocumentId);
      } else if (uploadedPath) {
        await supabase.storage
          .from("vehicle-documents")
          .remove([uploadedPath]);
      }

      setStatus("error");
      setMessage(errorMessage);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(8,145,178,0.12), transparent 34%), #07101f",
        color: "white",
        padding: "28px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/documents")}
          style={{
            border: "none",
            background: "transparent",
            color: "#94a3b8",
            cursor: "pointer",
            padding: 0,
            fontWeight: 800,
          }}
        >
          ← Back to Document Vault
        </button>

        <div
          style={{
            marginTop: "16px",
            color: "#67e8f9",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Mira AI Document Intelligence
        </div>

        <h1
          style={{
            margin: "7px 0 8px",
            fontSize: "clamp(30px, 5vw, 46px)",
            letterSpacing: "-0.04em",
          }}
        >
          Add Document
        </h1>

        <p
          style={{
            margin: 0,
            color: "#94a3b8",
            fontSize: "15px",
            lineHeight: 1.7,
          }}
        >
          Upload a verified vehicle or driver document. Mira will
          scan it and organise the available information.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: "24px",
            padding: "24px",
            borderRadius: "24px",
            background:
              "linear-gradient(145deg, rgba(23,32,51,0.98), rgba(13,23,40,0.98))",
            border: "1px solid #2a3b53",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 800 }}>
                Vehicle
              </span>

              <select
                value={vehicleId}
                onChange={(event) =>
                  setVehicleId(event.target.value)
                }
                disabled={loadingVehicles}
                required
                style={{
                  padding: "13px",
                  borderRadius: "12px",
                  border: "1px solid #334155",
                  background: "#0b1424",
                  color: "white",
                }}
              >
                {vehicles.length === 0 && (
                  <option value="">No vehicle available</option>
                )}

                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.vehicle_name ||
                      vehicle.vehicle_number ||
                      `Vehicle ${vehicle.id}`}
                    {vehicle.vehicle_number
                      ? ` — ${vehicle.vehicle_number}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 800 }}>
                Document Type
              </span>

              <select
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value)
                }
                style={{
                  padding: "13px",
                  borderRadius: "12px",
                  border: "1px solid #334155",
                  background: "#0b1424",
                  color: "white",
                }}
              >
                {availableDocumentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 800 }}>
                Document Number
              </span>

              <input
                value={documentNumber}
                onChange={(event) =>
                  setDocumentNumber(event.target.value)
                }
                placeholder="Optional"
                style={{
                  padding: "13px",
                  borderRadius: "12px",
                  border: "1px solid #334155",
                  background: "#0b1424",
                  color: "white",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 800 }}>
                Issue Date
              </span>

              <input
                type="date"
                value={issueDate}
                onChange={(event) =>
                  setIssueDate(event.target.value)
                }
                style={{
                  padding: "13px",
                  borderRadius: "12px",
                  border: "1px solid #334155",
                  background: "#0b1424",
                  color: "white",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 800 }}>
                Expiry Date
              </span>

              <input
                type="date"
                value={expiryDate}
                onChange={(event) =>
                  setExpiryDate(event.target.value)
                }
                style={{
                  padding: "13px",
                  borderRadius: "12px",
                  border: "1px solid #334155",
                  background: "#0b1424",
                  color: "white",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 800 }}>
                Document File
              </span>

              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                required
                style={{
                  padding: "11px",
                  borderRadius: "12px",
                  border: "1px dashed #475569",
                  background: "#0b1424",
                  color: "#cbd5e1",
                }}
              />
            </label>
          </div>

          {file && (
            <div
              style={{
                marginTop: "16px",
                padding: "13px",
                borderRadius: "13px",
                background: "rgba(103,232,249,0.07)",
                border: "1px solid rgba(103,232,249,0.18)",
                color: "#cbd5e1",
                fontSize: "13px",
              }}
            >
              Selected: <strong>{file.name}</strong>
            </div>
          )}

          {status !== "idle" && status !== "error" && (
            <div
              style={{
                marginTop: "18px",
                padding: "28px 20px",
                borderRadius: "18px",
                background:
                  status === "success"
                    ? "rgba(22,101,52,0.14)"
                    : "rgba(8,145,178,0.08)",
                border:
                  status === "success"
                    ? "1px solid rgba(134,239,172,0.22)"
                    : "1px solid rgba(103,232,249,0.2)",
                textAlign: "center",
              }}
            >
              {status === "success" ? (
                <>
                  <div
                    style={{
                      width: "58px",
                      height: "58px",
                      margin: "0 auto",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(34,197,94,0.18)",
                      border: "1px solid rgba(134,239,172,0.35)",
                      color: "#86efac",
                      fontSize: "28px",
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      color: "#ffffff",
                      fontSize: "22px",
                      fontWeight: 900,
                    }}
                  >
                    Document Added Successfully
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      color: scanVerified ? "#86efac" : "#fcd34d",
                      fontSize: "15px",
                      fontWeight: 850,
                    }}
                  >
                    {scanVerified
                      ? "Verified by Mira ✓"
                      : "Review Recommended"}
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: "58px",
                      height: "58px",
                      margin: "0 auto",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(37,99,235,0.16)",
                      border: "1px solid rgba(96,165,250,0.24)",
                      fontSize: "28px",
                    }}
                  >
                    🧠
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      color: "#ffffff",
                      fontSize: "21px",
                      fontWeight: 900,
                    }}
                  >
                    Mira is processing your document...
                  </div>

                  <div
                    style={{
                      marginTop: "9px",
                      color: "#94a3b8",
                      fontSize: "13px",
                      lineHeight: 1.7,
                    }}
                  >
                    Please wait a moment.
                  </div>

                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      margin: "20px auto 0",
                      borderRadius: "50%",
                      border: "4px solid rgba(148,163,184,0.18)",
                      borderTopColor: "#67e8f9",
                      animation: "miraSpin 0.9s linear infinite",
                    }}
                  />
                </>
              )}
            </div>
          )}

          {message && status === "error" && (
            <div
              style={{
                marginTop: "16px",
                padding: "13px",
                borderRadius: "13px",
                background: "rgba(252,165,165,0.08)",
                border: "1px solid rgba(252,165,165,0.22)",
                color: "#fca5a5",
                whiteSpace: "pre-line",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={
              [
                "uploading",
                "scanning",
                "reading",
                "extracting",
                "verifying",
                "success",
              ].includes(status) ||
              vehicles.length === 0
            }
            style={{
              width: "100%",
              marginTop: "20px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "14px",
              borderRadius: "14px",
              border: "none",
              background: "#2563eb",
              color: "white",
              cursor:
                [
                  "uploading",
                  "scanning",
                  "reading",
                  "extracting",
                  "verifying",
                  "success",
                ].includes(status) ||
                vehicles.length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity:
                [
                  "uploading",
                  "scanning",
                  "reading",
                  "extracting",
                  "verifying",
                  "success",
                ].includes(status) ||
                vehicles.length === 0
                  ? 0.65
                  : 1,
              fontWeight: 900,
            }}
          >
            <UploadIcon size={19} />
            {status === "idle" || status === "error"
              ? "Upload"
              : status === "uploading"
                ? "Uploading..."
                : status === "scanning"
                  ? "Mira is Scanning..."
                  : status === "reading"
                    ? "Reading..."
                    : status === "extracting"
                      ? "Extracting..."
                      : status === "verifying"
                        ? "Verifying..."
                        : "Completed ✓"}
          </button>

          <div
            style={{
              marginTop: "18px",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "16px",
              borderRadius: "14px",
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(96,165,250,0.18)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(37,99,235,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              🔒
            </div>

            <div>
              <div
                style={{
                  color: "#ffffff",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                Your documents are secure
              </div>

              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                Your documents are encrypted, securely stored, and processed by
                <strong style={{ color: "#67e8f9" }}> Mira AI</strong>.
                <br />
                We never share your information without your permission.
              </div>
            </div>
          </div>
        </form>
      </div>
    
      <style jsx>{`
        @keyframes miraSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
</main>
  );
}