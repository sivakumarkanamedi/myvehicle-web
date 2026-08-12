"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Pencil,
  Save,
  X,
  Share2,
  Check,
  History,
  UploadCloud,
  Eye,
  FilePenLine,
  ScanLine,
  QrCode,
} from "lucide-react";
import { supabase } from "../../../supabase";

type DocumentRecord = {
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
  extracted_data: Record<string, unknown> | null;
  confidence: number | null;
  verified: boolean | null;
  quality_issues: string[] | null;
  scan_status: string | null;
  scan_error: string | null;
  scanned_at: string | null;
  created_at: string | null;
};

type DocumentActivity = {
  id: number;
  action_type: string;
  action_label: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type VehicleRecord = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
};

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not detected";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item) => formatValue(item)).join(", ")
      : "Not detected";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeConfidence(value: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = value <= 1 ? value * 100 : value;

  return Math.round(Math.min(100, Math.max(0, normalized)));
}

export default function DocumentDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingFile, setOpeningFile] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareComplete, setShareComplete] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState<DocumentActivity[]>([]);
  const [rescanning, setRescanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDocumentNumber, setEditDocumentNumber] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [error, setError] = useState("");

  const documentId = Number(params?.id);

  const loadDocumentActivities = useCallback(
    async (documentId: number) => {
      setActivityLoading(true);

      try {
        const { data, error: activityError } = await supabase
          .from("document_activity_logs")
          .select("id, action_type, action_label, details, created_at")
          .eq("document_id", documentId)
          .order("created_at", { ascending: false })
          .limit(30);

        if (activityError) throw activityError;

        setActivities((data || []) as DocumentActivity[]);
      } catch {
        setActivities([]);
      } finally {
        setActivityLoading(false);
      }
    },
    []
  );

  async function logDocumentActivity(
    documentId: number,
    actionType: string,
    actionLabel: string,
    details?: Record<string, unknown>
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase.from("document_activity_logs").insert({
        user_id: user.id,
        document_id: documentId,
        action_type: actionType,
        action_label: actionLabel,
        details: details || {},
      });

      await loadDocumentActivities(documentId);
    } catch {
      // Audit logging must never block the user's main action.
    }
  }

  const loadDocument = useCallback(async () => {
    if (!Number.isInteger(documentId) || documentId <= 0) {
      setError("Invalid document ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data, error: documentError } = await supabase
        .from("vehicle_documents")
        .select(
          "id, user_id, vehicle_id, document_type, document_name, document_number, issue_date, expiry_date, file_path, file_url, extracted_data, confidence, verified, quality_issues, scan_status, scan_error, scanned_at, created_at"
        )
        .eq("id", documentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (documentError) {
        throw new Error(documentError.message);
      }

      if (!data) {
        throw new Error(
          "Document not found or you do not have permission to view it."
        );
      }

      const record = data as DocumentRecord;
      setDocument(record);
      await loadDocumentActivities(record.id);
      setEditDocumentNumber(record.document_number ?? "");
      setEditIssueDate(record.issue_date ?? "");
      setEditExpiryDate(record.expiry_date ?? "");

      if (record.vehicle_id) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from("vehicles")
          .select("id, vehicle_name, vehicle_number")
          .eq("id", record.vehicle_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!vehicleError && vehicleData) {
          setVehicle(vehicleData as VehicleRecord);
        }
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load document details."
      );
    } finally {
      setLoading(false);
    }
  }, [documentId, router, loadDocumentActivities]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const extractedEntries = useMemo(() => {
    if (!document?.extracted_data) return [];

    return Object.entries(document.extracted_data).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        String(value).trim().length > 0
    );
  }, [document]);

  const confidence = normalizeConfidence(document?.confidence ?? null);
  const issues = document?.quality_issues ?? [];

  async function openDocumentFile() {
    if (!document) return;

    setOpeningFile(true);
    setError("");

    try {
      if (document.file_path) {
        const { data, error: signedUrlError } = await supabase.storage
          .from("vehicle-documents")
          .createSignedUrl(document.file_path, 300);

        if (signedUrlError || !data?.signedUrl) {
          throw new Error(
            signedUrlError?.message ||
              "Unable to create a secure document link."
          );
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        await logDocumentActivity(
          document.id,
          "opened",
          "Document opened securely"
        );
        return;
      }

      if (document.file_url) {
        window.open(document.file_url, "_blank", "noopener,noreferrer");
        await logDocumentActivity(
          document.id,
          "opened",
          "Document opened"
        );
        return;
      }

      throw new Error("No document file is available.");
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open document."
      );
    } finally {
      setOpeningFile(false);
    }
  }

  async function shareDocumentSecurely() {
    if (!document || sharing) return;

    setSharing(true);
    setShareComplete(false);
    setError("");

    try {
      let secureUrl = document.file_url;

      if (document.file_path) {
        const { data, error: signedUrlError } = await supabase.storage
          .from("vehicle-documents")
          .createSignedUrl(document.file_path, 600);

        if (signedUrlError || !data?.signedUrl) {
          throw new Error(
            signedUrlError?.message ||
              "Unable to create a secure sharing link."
          );
        }

        secureUrl = data.signedUrl;
      }

      if (!secureUrl) {
        throw new Error("No document file is available to share.");
      }

      const documentTitle =
        document.document_name ||
        document.document_type ||
        "Vehicle Document";

      const shareText =
        `${documentTitle}\n\n` +
        "Secure link generated by My Vehicle. " +
        "This link expires automatically in 10 minutes.";

      if (navigator.share) {
        try {
          await navigator.share({
            title: documentTitle,
            text: shareText,
            url: secureUrl,
          });

          await logDocumentActivity(
            document.id,
            "shared",
            "Secure document link shared",
            { expires_in_minutes: 10 }
          );
          setShareComplete(true);
          window.setTimeout(() => setShareComplete(false), 2500);
          return;
        } catch (shareError) {
          if (
            shareError instanceof DOMException &&
            shareError.name === "AbortError"
          ) {
            return;
          }
        }
      }

      await navigator.clipboard.writeText(
        `${shareText}\n\n${secureUrl}`
      );

      await logDocumentActivity(
        document.id,
        "shared",
        "Secure document link copied",
        { expires_in_minutes: 10 }
      );
      setShareComplete(true);
      window.setTimeout(() => setShareComplete(false), 2500);
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Unable to share this document securely."
      );
    } finally {
      setSharing(false);
    }
  }

  async function rescanDocument() {
    if (!document) return;

    setRescanning(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/mira/scan-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentId: document.id,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error || "Mira could not rescan this document."
        );
      }

      await logDocumentActivity(
        document.id,
        "rescanned",
        "Document rescanned by Mira"
      );
      await loadDocument();
    } catch (rescanError) {
      setError(
        rescanError instanceof Error
          ? rescanError.message
          : "Mira could not rescan this document."
      );
    } finally {
      setRescanning(false);
    }
  }

  async function deleteDocument() {
    if (!document || deleting) return;

    const confirmed = window.confirm(
      "Delete this document permanently?\n\nThis will remove both the document file and its saved details."
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      await logDocumentActivity(
        document.id,
        "deleted",
        "Document deleted permanently",
        {
          document_type: document.document_type,
          document_number: document.document_number,
        }
      );

      if (document.file_path) {
        const { error: storageError } = await supabase.storage
          .from("vehicle-documents")
          .remove([document.file_path]);

        if (storageError) {
          throw new Error(
            `Unable to delete the stored file: ${storageError.message}`
          );
        }
      }

      const { error: deleteError } = await supabase
        .from("vehicle_documents")
        .delete()
        .eq("id", document.id)
        .eq("user_id", user.id);

      if (deleteError) {
        throw new Error(
          `Unable to delete the document record: ${deleteError.message}`
        );
      }

      router.replace("/documents");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this document."
      );
      setDeleting(false);
    }
  }

  function startEditing() {
    if (!document) return;

    setEditDocumentNumber(document.document_number ?? "");
    setEditIssueDate(document.issue_date ?? "");
    setEditExpiryDate(document.expiry_date ?? "");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!document || saving) return;

    setEditDocumentNumber(document.document_number ?? "");
    setEditIssueDate(document.issue_date ?? "");
    setEditExpiryDate(document.expiry_date ?? "");
    setError("");
    setEditing(false);
  }

  async function saveDocumentCorrections() {
    if (!document || saving) return;

    if (
      editIssueDate &&
      editExpiryDate &&
      new Date(editExpiryDate).getTime() <
        new Date(editIssueDate).getTime()
    ) {
      setError("Expiry date cannot be earlier than the issue date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: updatedDocument, error: updateError } = await supabase
        .from("vehicle_documents")
        .update({
          document_number: editDocumentNumber.trim() || null,
          issue_date: editIssueDate || null,
          expiry_date: editExpiryDate || null,
        })
        .eq("id", document.id)
        .eq("user_id", user.id)
        .select(
          "id, user_id, vehicle_id, document_type, document_name, document_number, issue_date, expiry_date, file_path, file_url, extracted_data, confidence, verified, quality_issues, scan_status, scan_error, scanned_at, created_at"
        )
        .single();

      if (updateError || !updatedDocument) {
        throw new Error(
          updateError?.message || "Unable to save document corrections."
        );
      }

      setDocument(updatedDocument as DocumentRecord);
      await logDocumentActivity(
        document.id,
        "edited",
        "Document details updated",
        {
          document_number_changed:
            document.document_number !==
            (updatedDocument as DocumentRecord).document_number,
          issue_date_changed:
            document.issue_date !==
            (updatedDocument as DocumentRecord).issue_date,
          expiry_date_changed:
            document.expiry_date !==
            (updatedDocument as DocumentRecord).expiry_date,
        }
      );
      setEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save document corrections."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top, #10233f 0%, #07111f 45%, #030712 100%)",
          color: "white",
        }}
      >
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: "14px",
          }}
        >
          <Loader2
            size={34}
            style={{ animation: "spin 1s linear infinite" }}
          />
          <div style={{ color: "#cbd5e1", fontWeight: 700 }}>
            Loading document details...
          </div>
          <style jsx>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </main>
    );
  }

  if (error && !document) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "32px 20px",
          background:
            "radial-gradient(circle at top, #10233f 0%, #07111f 45%, #030712 100%)",
          color: "white",
        }}
      >
        <div
          style={{
            width: "min(680px, 100%)",
            margin: "80px auto",
            padding: "28px",
            borderRadius: "22px",
            background: "rgba(15,23,42,0.88)",
            border: "1px solid rgba(248,113,113,0.25)",
            textAlign: "center",
          }}
        >
          <AlertTriangle size={38} color="#fca5a5" />
          <h1 style={{ marginTop: "15px" }}>Unable to open document</h1>
          <p style={{ color: "#fca5a5", lineHeight: 1.7 }}>{error}</p>
          <button
            type="button"
            onClick={() => router.push("/documents")}
            style={{
              marginTop: "12px",
              padding: "12px 18px",
              borderRadius: "12px",
              border: "none",
              background: "#2563eb",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back to Document Vault
          </button>
        </div>
      </main>
    );
  }

  if (!document) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px 60px",
        background:
          "radial-gradient(circle at top, #10233f 0%, #07111f 45%, #030712 100%)",
        color: "white",
      }}
    >
      <div style={{ width: "min(1120px, 100%)", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/documents")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 13px",
            borderRadius: "12px",
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.72)",
            color: "#cbd5e1",
            fontWeight: 750,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={17} />
          Document Vault
        </button>

        <section
          style={{
            marginTop: "20px",
            padding: "26px",
            borderRadius: "24px",
            background:
              "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(8,20,38,0.92))",
            border: "1px solid rgba(103,232,249,0.15)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "17px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "17px",
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(37,99,235,0.17)",
                  border: "1px solid rgba(96,165,250,0.22)",
                }}
              >
                <FileText size={27} color="#7dd3fc" />
              </div>

              <div>
                <div
                  style={{
                    color: "#67e8f9",
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Mira Document Intelligence
                </div>

                <h1
                  style={{
                    margin: "7px 0 5px",
                    fontSize: "clamp(26px, 4vw, 38px)",
                  }}
                >
                  {document.document_type || "Vehicle Document"}
                </h1>

                <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                  {vehicle
                    ? `${vehicle.vehicle_name || "Vehicle"} · ${
                        vehicle.vehicle_number || "Number unavailable"
                      }`
                    : "Vehicle details unavailable"}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={startEditing}
                disabled={editing || saving || deleting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 15px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "rgba(15,23,42,0.7)",
                  color: "#e2e8f0",
                  fontWeight: 850,
                  cursor:
                    editing || saving || deleting
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    editing || saving || deleting ? 0.65 : 1,
                }}
              >
                <Pencil size={17} />
                Edit Details
              </button>

              <button
                type="button"
                onClick={rescanDocument}
                disabled={rescanning}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 15px",
                  borderRadius: "12px",
                  border: "1px solid rgba(103,232,249,0.22)",
                  background: "rgba(8,145,178,0.1)",
                  color: "#a5f3fc",
                  fontWeight: 800,
                  cursor: rescanning ? "not-allowed" : "pointer",
                  opacity: rescanning ? 0.65 : 1,
                }}
              >
                {rescanning ? (
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <RefreshCw size={17} />
                )}
                {rescanning ? "Mira is Scanning..." : "Scan Again"}
              </button>

              <button
                type="button"
                onClick={openDocumentFile}
                disabled={openingFile}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 15px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 850,
                  cursor: openingFile ? "not-allowed" : "pointer",
                  opacity: openingFile ? 0.65 : 1,
                }}
              >
                {openingFile ? (
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <ExternalLink size={17} />
                )}
                Open Document
              </button>

              <button
                type="button"
                onClick={shareDocumentSecurely}
                disabled={sharing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 15px",
                  borderRadius: "12px",
                  border: "1px solid rgba(167,139,250,0.24)",
                  background: shareComplete
                    ? "rgba(22,163,74,0.16)"
                    : "rgba(109,40,217,0.14)",
                  color: shareComplete ? "#86efac" : "#ddd6fe",
                  fontWeight: 850,
                  cursor: sharing ? "not-allowed" : "pointer",
                  opacity: sharing ? 0.65 : 1,
                }}
              >
                {sharing ? (
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : shareComplete ? (
                  <Check size={17} />
                ) : (
                  <Share2 size={17} />
                )}
                {sharing
                  ? "Preparing..."
                  : shareComplete
                    ? "Shared Securely"
                    : "Share Securely"}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/documents/${document.id}/share`)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "11px 14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(167,139,250,0.22)",
                  background: "rgba(124,58,237,0.12)",
                  color: "#ddd6fe",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                <QrCode size={17} />
                QR Secure Share
              </button>

              <button
                type="button"
                onClick={deleteDocument}
                disabled={deleting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 15px",
                  borderRadius: "12px",
                  border: "1px solid rgba(248,113,113,0.24)",
                  background: "rgba(127,29,29,0.16)",
                  color: "#fca5a5",
                  fontWeight: 850,
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.65 : 1,
                }}
              >
                {deleting ? (
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Trash2 size={17} />
                )}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: "18px",
                padding: "13px 15px",
                borderRadius: "13px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}
        </section>

        {editing && (
          <section
            style={{
              marginTop: "18px",
              padding: "24px",
              borderRadius: "22px",
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(96,165,250,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "21px" }}>
                  Review Document Details
                </h2>
                <p
                  style={{
                    margin: "7px 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Correct any information that Mira could not read accurately.
                </p>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                aria-label="Cancel editing"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "11px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(2,6,23,0.42)",
                  color: "#cbd5e1",
                  display: "grid",
                  placeItems: "center",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              <label style={{ display: "grid", gap: "8px" }}>
                <span
                  style={{
                    color: "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: 850,
                  }}
                >
                  Document Number
                </span>
                <input
                  value={editDocumentNumber}
                  onChange={(event) =>
                    setEditDocumentNumber(event.target.value)
                  }
                  placeholder="Enter document number"
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    background: "#0b1424",
                    color: "white",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: "8px" }}>
                <span
                  style={{
                    color: "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: 850,
                  }}
                >
                  Issue Date
                </span>
                <input
                  type="date"
                  value={editIssueDate}
                  onChange={(event) =>
                    setEditIssueDate(event.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    background: "#0b1424",
                    color: "white",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: "8px" }}>
                <span
                  style={{
                    color: "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: 850,
                  }}
                >
                  Expiry Date
                </span>
                <input
                  type="date"
                  value={editExpiryDate}
                  onChange={(event) =>
                    setEditExpiryDate(event.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    background: "#0b1424",
                    color: "white",
                    outline: "none",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: "18px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                style={{
                  padding: "11px 16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "transparent",
                  color: "#cbd5e1",
                  fontWeight: 850,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveDocumentCorrections}
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 16px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.65 : 1,
                }}
              >
                {saving ? (
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Save size={17} />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>
        )}

        <section
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <article
            style={{
              padding: "19px",
              borderRadius: "18px",
              background: document.verified
                ? "rgba(22,101,52,0.16)"
                : "rgba(120,53,15,0.16)",
              border: document.verified
                ? "1px solid rgba(134,239,172,0.22)"
                : "1px solid rgba(253,224,71,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: document.verified ? "#86efac" : "#fde68a",
                fontWeight: 900,
              }}
            >
              {document.verified ? (
                <ShieldCheck size={21} />
              ) : (
                <AlertTriangle size={21} />
              )}
              {document.verified
                ? "Verified by Mira"
                : "Review Recommended"}
            </div>
            <div
              style={{
                marginTop: "9px",
                color: "#94a3b8",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              {document.verified
                ? "Mira found strong, consistent document information."
                : "Please review the extracted information before relying on it."}
            </div>
          </article>

          <article
            style={{
              padding: "19px",
              borderRadius: "18px",
              background: "rgba(8,145,178,0.1)",
              border: "1px solid rgba(103,232,249,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                color: "#67e8f9",
                fontWeight: 900,
              }}
            >
              <Sparkles size={20} />
              Mira Confidence
            </div>
            <div
              style={{
                marginTop: "8px",
                fontSize: "31px",
                fontWeight: 950,
              }}
            >
              {confidence}%
            </div>
            <div
              style={{
                marginTop: "9px",
                height: "7px",
                borderRadius: "999px",
                background: "rgba(148,163,184,0.15)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${confidence}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #2563eb, #22d3ee)",
                }}
              />
            </div>
          </article>

          <article
            style={{
              padding: "19px",
              borderRadius: "18px",
              background: "rgba(15,23,42,0.76)",
              border: "1px solid rgba(148,163,184,0.16)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                color: "#cbd5e1",
                fontWeight: 900,
              }}
            >
              <CalendarDays size={20} />
              Last Scanned
            </div>
            <div
              style={{
                marginTop: "9px",
                color: "white",
                fontWeight: 800,
                lineHeight: 1.6,
              }}
            >
              {formatDateTime(document.scanned_at)}
            </div>
          </article>
        </section>

        <section
          style={{
            marginTop: "18px",
            padding: "24px",
            borderRadius: "22px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.14)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <History size={20} color="#c4b5fd" />
              <div>
                <h2 style={{ margin: 0, fontSize: "19px" }}>
                  Document History
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  Secure activity history for this document.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadDocumentActivities(document.id)}
              disabled={activityLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 12px",
                borderRadius: "11px",
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(2,6,23,0.4)",
                color: "#cbd5e1",
                fontWeight: 850,
                cursor: activityLoading ? "not-allowed" : "pointer",
                opacity: activityLoading ? 0.65 : 1,
              }}
            >
              {activityLoading ? (
                <Loader2
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh
            </button>
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "10px",
            }}
          >
            {activityLoading && activities.length === 0 ? (
              <div
                style={{
                  padding: "18px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Loading document history...
              </div>
            ) : activities.length === 0 ? (
              <div
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  background: "rgba(2,6,23,0.42)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                No activity recorded yet. New actions will appear here.
              </div>
            ) : (
              activities.map((activity) => {
                const ActivityIcon =
                  activity.action_type === "opened"
                    ? Eye
                    : activity.action_type === "edited"
                      ? FilePenLine
                      : activity.action_type === "rescanned"
                        ? ScanLine
                        : activity.action_type === "shared"
                          ? Share2
                          : activity.action_type === "uploaded"
                            ? UploadCloud
                            : History;

                return (
                  <div
                    key={activity.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "14px",
                      borderRadius: "14px",
                      background: "rgba(2,6,23,0.42)",
                      border: "1px solid rgba(148,163,184,0.11)",
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "12px",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        background: "rgba(124,58,237,0.13)",
                        color: "#c4b5fd",
                      }}
                    >
                      <ActivityIcon size={17} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: "#e2e8f0",
                          fontSize: "13px",
                          fontWeight: 850,
                        }}
                      >
                        {activity.action_label}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#64748b",
                          fontSize: "11px",
                        }}
                      >
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(activity.created_at))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.75fr)",
            gap: "18px",
          }}
        >
          <article
            style={{
              padding: "24px",
              borderRadius: "22px",
              background: "rgba(15,23,42,0.82)",
              border: "1px solid rgba(148,163,184,0.16)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "21px" }}>
              Extracted Details
            </h2>
            <p
              style={{
                margin: "7px 0 0",
                color: "#94a3b8",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              Information detected from your uploaded document by Mira AI.
            </p>

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "12px",
              }}
            >
              {extractedEntries.length > 0 ? (
                extractedEntries.map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      padding: "15px",
                      borderRadius: "14px",
                      background: "rgba(2,6,23,0.42)",
                      border: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "11px",
                        fontWeight: 850,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {formatLabel(key)}
                    </div>
                    <div
                      style={{
                        marginTop: "7px",
                        color: "white",
                        fontWeight: 780,
                        overflowWrap: "anywhere",
                        lineHeight: 1.5,
                      }}
                    >
                      {formatValue(value)}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "24px",
                    borderRadius: "15px",
                    background: "rgba(2,6,23,0.36)",
                    border: "1px dashed rgba(148,163,184,0.2)",
                    color: "#94a3b8",
                    textAlign: "center",
                    lineHeight: 1.7,
                  }}
                >
                  Mira has not extracted any details yet. Select
                  <strong style={{ color: "white" }}> Scan Again</strong>{" "}
                  to process the document.
                </div>
              )}
            </div>
          </article>

          <aside style={{ display: "grid", gap: "18px" }}>
            <article
              style={{
                padding: "22px",
                borderRadius: "22px",
                background: "rgba(15,23,42,0.82)",
                border: "1px solid rgba(148,163,184,0.16)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "19px" }}>
                Document Summary
              </h2>

              <div
                style={{
                  marginTop: "17px",
                  display: "grid",
                  gap: "14px",
                }}
              >
                {[
                  ["Document Number", document.document_number],
                  ["Issue Date", formatDate(document.issue_date)],
                  ["Expiry Date", formatDate(document.expiry_date)],
                  ["File Name", document.document_name],
                  ["Scan Status", formatLabel(document.scan_status || "Not scanned")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "11px",
                        fontWeight: 850,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        color: "#e2e8f0",
                        fontWeight: 750,
                        overflowWrap: "anywhere",
                        lineHeight: 1.5,
                      }}
                    >
                      {value || "Not available"}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article
              style={{
                padding: "22px",
                borderRadius: "22px",
                background:
                  issues.length > 0
                    ? "rgba(120,53,15,0.14)"
                    : "rgba(22,101,52,0.12)",
                border:
                  issues.length > 0
                    ? "1px solid rgba(253,224,71,0.18)"
                    : "1px solid rgba(134,239,172,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  color: issues.length > 0 ? "#fde68a" : "#86efac",
                  fontWeight: 900,
                }}
              >
                {issues.length > 0 ? (
                  <AlertTriangle size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                Quality Check
              </div>

              {issues.length > 0 ? (
                <div
                  style={{
                    marginTop: "13px",
                    display: "grid",
                    gap: "9px",
                  }}
                >
                  {issues.map((issue, index) => (
                    <div
                      key={`${issue}-${index}`}
                      style={{
                        color: "#fef3c7",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      • {issue}
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    margin: "11px 0 0",
                    color: "#bbf7d0",
                    fontSize: "13px",
                    lineHeight: 1.7,
                  }}
                >
                  Mira did not identify any document quality issues.
                </p>
              )}

              {document.scan_error && (
                <div
                  style={{
                    marginTop: "13px",
                    padding: "11px",
                    borderRadius: "11px",
                    background: "rgba(248,113,113,0.08)",
                    color: "#fca5a5",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {document.scan_error}
                </div>
              )}
            </article>
          </aside>
        </section>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 840px) {
          section:nth-of-type(4) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}