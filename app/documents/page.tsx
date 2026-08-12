"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  BellRing,
  Clock3,
  X,
  Sparkles,
  CheckSquare2,
  Square,
  Share2,
  Download,
  Trash2,
  XCircle,
  UsersRound,
} from "lucide-react";
import { supabase } from "../../supabase";

type VehicleDocument = {
  id: number;
  user_id: string;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  document_number: string | null;
  file_path: string | null;
  file_url: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  confidence: number | null;
  verified: boolean | null;
  scan_status: string | null;
  scanned_at: string | null;
  created_at: string | null;
};

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
};

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

function getDaysUntil(value: string | null): number | null {
  if (!value) return null;

  const expiry = new Date(value);
  const today = new Date();

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getExpiryStatus(expiryDate: string | null) {
  const days = getDaysUntil(expiryDate);

  if (days === null) {
    return {
      label: "Expiry not available",
      tone: "neutral" as const,
    };
  }

  if (days < 0) {
    return {
      label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`,
      tone: "danger" as const,
    };
  }

  if (days === 0) {
    return {
      label: "Expires today",
      tone: "danger" as const,
    };
  }

  if (days <= 30) {
    return {
      label: `Expires in ${days} day${days === 1 ? "" : "s"}`,
      tone: "warning" as const,
    };
  }

  return {
    label: `Valid until ${formatDate(expiryDate)}`,
    tone: "success" as const,
  };
}

function getUrgencyScore(expiryDate: string | null): number {
  const days = getDaysUntil(expiryDate);

  if (days === null) return 100000;
  if (days < 0) return -10000 + days;
  return days;
}

type RenewalAction = {
  title: string;
  buttonLabel: string;
  description: string;
};

function getRenewalAction(documentType: string | null): RenewalAction {
  const type = (documentType || "").toLowerCase();

  if (type.includes("insurance")) {
    return {
      title: "Insurance Renewal",
      buttonLabel: "Renew Now",
      description:
        "Compare renewal options and continue with a trusted insurance partner.",
    };
  }

  if (type.includes("puc") || type.includes("pollution")) {
    return {
      title: "PUC Renewal",
      buttonLabel: "Find PUC Center",
      description:
        "Find a nearby authorized pollution testing center and renew your certificate.",
    };
  }

  if (type.includes("fastag")) {
    return {
      title: "FASTag Assistance",
      buttonLabel: "Recharge FASTag",
      description:
        "Recharge or manage your FASTag through a supported banking partner.",
    };
  }

  if (
    type.includes("driving") ||
    type.includes("licence") ||
    type.includes("license") ||
    type === "dl"
  ) {
    return {
      title: "Driving Licence Renewal",
      buttonLabel: "Know Renewal Process",
      description:
        "Review the required documents and renewal process for your driving licence.",
    };
  }

  if (
    type.includes("registration") ||
    type.includes("rc") ||
    type.includes("fitness")
  ) {
    return {
      title: "Vehicle Document Renewal",
      buttonLabel: "View Renewal Steps",
      description:
        "Review renewal requirements and prepare the required vehicle documents.",
    };
  }

  return {
    title: "Document Renewal",
    buttonLabel: "Get Renewal Help",
    description:
      "Mira will help you understand the next steps for renewing this document.",
  };
}

function getReminderStorageKey(documentId: number): string {
  return `my-vehicle-document-reminder-${documentId}`;
}

function getConfidence(value: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = value <= 1 ? value * 100 : value;

  return Math.round(Math.min(100, Math.max(0, normalized)));
}

export default function DocumentsPage() {
  const router = useRouter();

  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [vehicles, setVehicles] = useState<Record<number, Vehicle>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [renewalDocument, setRenewalDocument] =
    useState<VehicleDocument | null>(null);
  const [snoozedDocumentIds, setSnoozedDocumentIds] = useState<number[]>([]);
  const [renewalMessage, setRenewalMessage] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [bulkWorking, setBulkWorking] = useState<
    "share" | "download" | "delete" | null
  >(null);
  const [bulkMessage, setBulkMessage] = useState("");

  const loadDocuments = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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

      const { data: documentData, error: documentError } = await supabase
        .from("vehicle_documents")
        .select(
          "id, user_id, vehicle_id, document_type, document_name, document_number, file_path, file_url, issue_date, expiry_date, confidence, verified, scan_status, scanned_at, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (documentError) {
        throw new Error(documentError.message);
      }

      const rows = (documentData ?? []) as VehicleDocument[];
      setDocuments(rows);

      const vehicleIds = Array.from(
        new Set(
          rows
            .map((item) => item.vehicle_id)
            .filter((value): value is number => typeof value === "number")
        )
      );

      if (vehicleIds.length > 0) {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from("vehicles")
          .select("id, vehicle_name, vehicle_number")
          .eq("user_id", user.id)
          .in("id", vehicleIds);

        if (vehicleError) {
          throw new Error(vehicleError.message);
        }

        const vehicleMap = Object.fromEntries(
          ((vehicleData ?? []) as Vehicle[]).map((vehicle) => [
            vehicle.id,
            vehicle,
          ])
        );

        setVehicles(vehicleMap);
      } else {
        setVehicles({});
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your documents."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const activeSnoozes = documents
      .filter((document) => {
        const storedValue = window.localStorage.getItem(
          getReminderStorageKey(document.id)
        );

        if (!storedValue) return false;

        const snoozedUntil = new Date(storedValue);

        if (
          Number.isNaN(snoozedUntil.getTime()) ||
          snoozedUntil.getTime() <= Date.now()
        ) {
          window.localStorage.removeItem(
            getReminderStorageKey(document.id)
          );
          return false;
        }

        return true;
      })
      .map((document) => document.id);

    setSnoozedDocumentIds(activeSnoozes);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const matchingDocuments = normalizedSearch
      ? documents.filter((document) => {
          const vehicle = document.vehicle_id
            ? vehicles[document.vehicle_id]
            : null;

          return [
            document.document_type,
            document.document_name,
            document.document_number,
            vehicle?.vehicle_name,
            vehicle?.vehicle_number,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(normalizedSearch)
            );
        })
      : documents;

    return [...matchingDocuments].sort(
      (first, second) =>
        getUrgencyScore(first.expiry_date) -
        getUrgencyScore(second.expiry_date)
    );
  }, [documents, search, vehicles]);

  const verifiedCount = documents.filter(
    (document) => document.verified
  ).length;

  const expiringSoonCount = documents.filter((document) => {
    const days = getDaysUntil(document.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const expiredCount = documents.filter((document) => {
    const days = getDaysUntil(document.expiry_date);
    return days !== null && days < 0;
  }).length;

  const selectedDocuments = useMemo(
    () =>
      documents.filter((document) =>
        selectedDocumentIds.includes(document.id)
      ),
    [documents, selectedDocumentIds]
  );

  const allVisibleSelected =
    filteredDocuments.length > 0 &&
    filteredDocuments.every((document) =>
      selectedDocumentIds.includes(document.id)
    );

  const renewalDocuments = useMemo(() => {
    return [...documents]
      .filter((document) => {
        const days = getDaysUntil(document.expiry_date);

        return (
          days !== null &&
          days <= 30 &&
          !snoozedDocumentIds.includes(document.id)
        );
      })
      .sort(
        (first, second) =>
          getUrgencyScore(first.expiry_date) -
          getUrgencyScore(second.expiry_date)
      )
      .slice(0, 3);
  }, [documents, snoozedDocumentIds]);

  const attentionDocument = useMemo(() => {
    return [...documents]
      .filter((document) => {
        const days = getDaysUntil(document.expiry_date);
        return days !== null && days <= 30;
      })
      .sort(
        (first, second) =>
          getUrgencyScore(first.expiry_date) -
          getUrgencyScore(second.expiry_date)
      )[0];
  }, [documents]);

  const attentionVehicle =
    attentionDocument?.vehicle_id
      ? vehicles[attentionDocument.vehicle_id]
      : null;

  const attentionDays = attentionDocument
    ? getDaysUntil(attentionDocument.expiry_date)
    : null;

  const attentionTitle =
    attentionDays === null
      ? ""
      : attentionDays < 0
        ? `${attentionDocument?.document_type || "Document"} has expired`
        : attentionDays === 0
          ? `${attentionDocument?.document_type || "Document"} expires today`
          : `${attentionDocument?.document_type || "Document"} expires in ${attentionDays} day${
              attentionDays === 1 ? "" : "s"
            }`;

  const attentionMessage =
    attentionDays !== null && attentionDays < 0
      ? "This document needs immediate attention. Update or renew it to keep your records current."
      : "Mira found a document that needs your attention soon.";

  function openRenewalCenter(document: VehicleDocument) {
    setRenewalMessage("");
    setRenewalDocument(document);
  }

  function closeRenewalCenter() {
    setRenewalMessage("");
    setRenewalDocument(null);
  }

  function snoozeRenewalReminder(document: VehicleDocument) {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 7);

    window.localStorage.setItem(
      getReminderStorageKey(document.id),
      snoozedUntil.toISOString()
    );

    setSnoozedDocumentIds((current) =>
      Array.from(new Set([...current, document.id]))
    );

    if (renewalDocument?.id === document.id) {
      setRenewalMessage("Reminder snoozed for 7 days.");
      window.setTimeout(() => closeRenewalCenter(), 1100);
    }
  }

  function continueRenewal(document: VehicleDocument) {
    const action = getRenewalAction(document.document_type);

    setRenewalMessage(
      `${action.title} partner integration is coming soon. Mira has saved this document as requiring attention.`
    );
  }

  function enterSelectionMode() {
    setBulkMessage("");
    setSelectionMode(true);
  }

  function cancelSelectionMode() {
    if (bulkWorking) return;

    setSelectionMode(false);
    setSelectedDocumentIds([]);
    setBulkMessage("");
  }

  function toggleDocumentSelection(documentId: number) {
    setBulkMessage("");
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  }

  function toggleSelectAllVisible() {
    setBulkMessage("");

    if (allVisibleSelected) {
      const visibleIds = new Set(
        filteredDocuments.map((document) => document.id)
      );

      setSelectedDocumentIds((current) =>
        current.filter((id) => !visibleIds.has(id))
      );
      return;
    }

    setSelectedDocumentIds((current) =>
      Array.from(
        new Set([
          ...current,
          ...filteredDocuments.map((document) => document.id),
        ])
      )
    );
  }

  async function getSecureDocumentUrl(
    document: VehicleDocument,
    expiresInSeconds = 600
  ): Promise<string> {
    if (document.file_path) {
      const { data, error: signedUrlError } = await supabase.storage
        .from("vehicle-documents")
        .createSignedUrl(document.file_path, expiresInSeconds);

      if (signedUrlError || !data?.signedUrl) {
        throw new Error(
          signedUrlError?.message ||
            `Unable to prepare ${document.document_type || "document"}.`
        );
      }

      return data.signedUrl;
    }

    if (document.file_url) {
      return document.file_url;
    }

    throw new Error(
      `${document.document_type || "Document"} has no stored file.`
    );
  }

  async function bulkShareDocuments() {
    if (selectedDocuments.length === 0 || bulkWorking) return;

    setBulkWorking("share");
    setBulkMessage("");
    setError("");

    try {
      const secureLinks = await Promise.all(
        selectedDocuments.map(async (document) => {
          const url = await getSecureDocumentUrl(document, 600);
          const vehicle = document.vehicle_id
            ? vehicles[document.vehicle_id]
            : null;

          return [
            document.document_type || "Vehicle Document",
            vehicle?.vehicle_number
              ? `Vehicle: ${vehicle.vehicle_number}`
              : null,
            url,
          ]
            .filter(Boolean)
            .join("\n");
        })
      );

      const shareText =
        `My Vehicle — ${selectedDocuments.length} secure document${
          selectedDocuments.length === 1 ? "" : "s"
        }\n\n` +
        secureLinks.join("\n\n--------------------\n\n") +
        "\n\nThese secure links expire automatically in 10 minutes.";

      if (
        selectedDocuments.length === 1 &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({
            title:
              selectedDocuments[0].document_type || "Vehicle Document",
            text: shareText,
          });

          setBulkMessage("Document shared securely.");
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

      await navigator.clipboard.writeText(shareText);
      setBulkMessage(
        `${selectedDocuments.length} secure document link${
          selectedDocuments.length === 1 ? "" : "s"
        } copied. Links expire in 10 minutes.`
      );
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Unable to share the selected documents."
      );
    } finally {
      setBulkWorking(null);
    }
  }

  async function bulkDownloadDocuments() {
    if (selectedDocuments.length === 0 || bulkWorking) return;

    setBulkWorking("download");
    setBulkMessage("");
    setError("");

    try {
      for (const [index, document] of selectedDocuments.entries()) {
        const url = await getSecureDocumentUrl(document, 300);
        const anchor = window.document.createElement("a");

        const safeName = (
          document.document_type ||
          document.document_name ||
          `vehicle-document-${document.id}`
        )
          .replace(/[^a-zA-Z0-9-_ ]/g, "")
          .trim()
          .replace(/\s+/g, "-");

        anchor.href = url;
        anchor.download = safeName || `vehicle-document-${document.id}`;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        window.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        if (index < selectedDocuments.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }

      setBulkMessage(
        `${selectedDocuments.length} document${
          selectedDocuments.length === 1 ? "" : "s"
        } prepared for download.`
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download the selected documents."
      );
    } finally {
      setBulkWorking(null);
    }
  }

  async function bulkDeleteDocuments() {
    if (selectedDocuments.length === 0 || bulkWorking) return;

    const confirmed = window.confirm(
      `Delete ${selectedDocuments.length} selected document${
        selectedDocuments.length === 1 ? "" : "s"
      } permanently?\n\nThis removes both the stored files and database records. This action cannot be undone.`
    );

    if (!confirmed) return;

    setBulkWorking("delete");
    setBulkMessage("");
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const storagePaths = selectedDocuments
        .map((document) => document.file_path)
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("vehicle-documents")
          .remove(storagePaths);

        if (storageError) {
          throw new Error(
            `Unable to delete stored files: ${storageError.message}`
          );
        }
      }

      const selectedIds = selectedDocuments.map((document) => document.id);

      const { error: deleteError } = await supabase
        .from("vehicle_documents")
        .delete()
        .eq("user_id", user.id)
        .in("id", selectedIds);

      if (deleteError) {
        throw new Error(
          `Unable to delete document records: ${deleteError.message}`
        );
      }

      setDocuments((current) =>
        current.filter((document) => !selectedIds.includes(document.id))
      );
      setSelectedDocumentIds([]);
      setSelectionMode(false);
      setBulkMessage(
        `${selectedIds.length} document${
          selectedIds.length === 1 ? "" : "s"
        } deleted successfully.`
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the selected documents."
      );
    } finally {
      setBulkWorking(null);
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
            Loading Document Vault...
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

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "34px 22px 70px",
        background:
          "radial-gradient(circle at top, #10233f 0%, #07111f 45%, #030712 100%)",
        color: "white",
      }}
    >
      <div style={{ width: "min(1180px, 100%)", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
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
                margin: "9px 0 7px",
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1.08,
              }}
            >
              Document Vault
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: "680px",
                color: "#94a3b8",
                lineHeight: 1.7,
              }}
            >
              Keep your vehicle and driver documents securely organised in one
              place.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              paddingRight: "170px",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/documents/trusted-people")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "9px",
                padding: "13px 16px",
                borderRadius: "14px",
                border: "1px solid rgba(167,139,250,0.24)",
                background: "rgba(124,58,237,0.12)",
                color: "#ddd6fe",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              <UsersRound size={19} />
              Trusted Access
            </button>

            <button
              type="button"
              onClick={() => router.push("/documents/upload")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "9px",
                padding: "13px 18px",
                borderRadius: "14px",
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 12px 28px rgba(37,99,235,0.25)",
              }}
            >
              <Plus size={19} />
              Add Document
            </button>
          </div>
        </header>

        {attentionDocument && attentionDays !== null && (
          <section
            style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius: "20px",
              background:
                attentionDays < 0
                  ? "linear-gradient(135deg, rgba(127,29,29,0.3), rgba(69,10,10,0.2))"
                  : attentionDays <= 7
                    ? "linear-gradient(135deg, rgba(120,53,15,0.28), rgba(69,26,3,0.18))"
                    : "linear-gradient(135deg, rgba(30,64,175,0.2), rgba(8,47,73,0.18))",
              border:
                attentionDays < 0
                  ? "1px solid rgba(248,113,113,0.25)"
                  : attentionDays <= 7
                    ? "1px solid rgba(253,224,71,0.22)"
                    : "1px solid rgba(103,232,249,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "14px",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  background:
                    attentionDays < 0
                      ? "rgba(239,68,68,0.16)"
                      : attentionDays <= 7
                        ? "rgba(245,158,11,0.16)"
                        : "rgba(37,99,235,0.16)",
                  color:
                    attentionDays < 0
                      ? "#fca5a5"
                      : attentionDays <= 7
                        ? "#fde68a"
                        : "#a5f3fc",
                }}
              >
                <AlertTriangle size={23} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#67e8f9",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Mira Alert
                </div>

                <h2
                  style={{
                    margin: "6px 0 4px",
                    fontSize: "19px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {attentionTitle}
                </h2>

                <div
                  style={{
                    color: "#cbd5e1",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {attentionVehicle
                    ? `${attentionVehicle.vehicle_name || "Vehicle"} · ${
                        attentionVehicle.vehicle_number || "Number unavailable"
                      }`
                    : "Vehicle details unavailable"}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {attentionMessage}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(`/documents/${attentionDocument.id}`)
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 15px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              View Document
              <ChevronRight size={17} />
            </button>
          </section>
        )}

        {renewalDocuments.length > 0 && (
          <section
            style={{
              marginTop: "24px",
              padding: "22px",
              borderRadius: "22px",
              background:
                "linear-gradient(135deg, rgba(30,41,59,0.96), rgba(15,23,42,0.96))",
              border: "1px solid rgba(167,139,250,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    color: "#c4b5fd",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  <Sparkles size={14} />
                  Mira Renewal Center
                </div>

                <h2 style={{ margin: "8px 0 5px", fontSize: "22px" }}>
                  Documents requiring attention
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Renew expired or expiring documents before they interrupt
                  your journey.
                </p>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 12px",
                  borderRadius: "999px",
                  background: "rgba(124,58,237,0.14)",
                  color: "#ddd6fe",
                  fontSize: "12px",
                  fontWeight: 850,
                }}
              >
                <BellRing size={15} />
                {renewalDocuments.length} action
                {renewalDocuments.length === 1 ? "" : "s"}
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "13px",
              }}
            >
              {renewalDocuments.map((document) => {
                const days = getDaysUntil(document.expiry_date);
                const action = getRenewalAction(document.document_type);
                const vehicle = document.vehicle_id
                  ? vehicles[document.vehicle_id]
                  : null;

                const statusLabel =
                  days === null
                    ? "Expiry unavailable"
                    : days < 0
                      ? `Expired ${Math.abs(days)} day${
                          Math.abs(days) === 1 ? "" : "s"
                        } ago`
                      : days === 0
                        ? "Expires today"
                        : `Expires in ${days} day${
                            days === 1 ? "" : "s"
                          }`;

                return (
                  <article
                    key={`renewal-${document.id}`}
                    style={{
                      padding: "17px",
                      borderRadius: "17px",
                      background: "rgba(2,6,23,0.45)",
                      border:
                        days !== null && days < 0
                          ? "1px solid rgba(248,113,113,0.24)"
                          : "1px solid rgba(251,191,36,0.2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: "#f8fafc",
                            fontWeight: 900,
                            fontSize: "15px",
                          }}
                        >
                          {document.document_type || "Vehicle Document"}
                        </div>

                        <div
                          style={{
                            marginTop: "5px",
                            color: "#94a3b8",
                            fontSize: "12px",
                          }}
                        >
                          {vehicle?.vehicle_name || "Vehicle"} ·{" "}
                          {vehicle?.vehicle_number || "Number unavailable"}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: "6px 8px",
                          borderRadius: "999px",
                          background:
                            days !== null && days < 0
                              ? "rgba(239,68,68,0.14)"
                              : "rgba(245,158,11,0.14)",
                          color:
                            days !== null && days < 0
                              ? "#fca5a5"
                              : "#fde68a",
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: "13px 0 0",
                        color: "#cbd5e1",
                        fontSize: "12px",
                        lineHeight: 1.6,
                      }}
                    >
                      {action.description}
                    </p>

                    <div
                      style={{
                        marginTop: "15px",
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openRenewalCenter(document)}
                        style={{
                          flex: "1 1 130px",
                          padding: "10px 12px",
                          borderRadius: "11px",
                          border: "none",
                          background: "#7c3aed",
                          color: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {action.buttonLabel}
                      </button>

                      <button
                        type="button"
                        onClick={() => snoozeRenewalReminder(document)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "10px 12px",
                          borderRadius: "11px",
                          border: "1px solid rgba(148,163,184,0.2)",
                          background: "transparent",
                          color: "#cbd5e1",
                          fontWeight: 850,
                          cursor: "pointer",
                        }}
                      >
                        <Clock3 size={15} />
                        Snooze
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "13px",
          }}
        >
          {[
            {
              label: "Total Documents",
              value: documents.length,
              icon: <FileText size={20} />,
              color: "#bfdbfe",
            },
            {
              label: "Verified by Mira",
              value: verifiedCount,
              icon: <ShieldCheck size={20} />,
              color: "#86efac",
            },
            {
              label: "Expiring Soon",
              value: expiringSoonCount,
              icon: <CalendarDays size={20} />,
              color: "#fde68a",
            },
            {
              label: "Expired",
              value: expiredCount,
              icon: <AlertTriangle size={20} />,
              color: "#fca5a5",
            },
          ].map((item) => (
            <article
              key={item.label}
              style={{
                padding: "17px",
                borderRadius: "17px",
                background: "rgba(15,23,42,0.78)",
                border: "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  color: item.color,
                  fontWeight: 850,
                  fontSize: "13px",
                }}
              >
                {item.icon}
                {item.label}
              </div>
              <div
                style={{
                  marginTop: "9px",
                  fontSize: "29px",
                  fontWeight: 950,
                }}
              >
                {item.value}
              </div>
            </article>
          ))}
        </section>

        <section
          style={{
            marginTop: "18px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 320px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "0 14px",
              borderRadius: "14px",
              background: "rgba(15,23,42,0.8)",
              border: "1px solid rgba(148,163,184,0.16)",
            }}
          >
            <Search size={18} color="#64748b" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents, vehicles or numbers"
              style={{
                width: "100%",
                padding: "13px 0",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "white",
                fontSize: "14px",
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => void loadDocuments(true)}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 15px",
              borderRadius: "13px",
              border: "1px solid rgba(103,232,249,0.18)",
              background: "rgba(8,145,178,0.08)",
              color: "#a5f3fc",
              fontWeight: 850,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.65 : 1,
            }}
          >
            <RefreshCw
              size={17}
              style={{
                animation: refreshing ? "spin 1s linear infinite" : "none",
              }}
            />
            Refresh
          </button>
        </section>

        <section
          style={{
            marginTop: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "20px" }}>Your Documents</h2>
            <p
              style={{
                margin: "5px 0 0",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              {selectionMode
                ? `${selectedDocumentIds.length} of ${filteredDocuments.length} visible documents selected`
                : "Open a document or select multiple documents for bulk actions."}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "9px",
              flexWrap: "wrap",
            }}
          >
            {selectionMode ? (
              <>
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  disabled={filteredDocuments.length === 0 || Boolean(bulkWorking)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "10px 13px",
                    borderRadius: "12px",
                    border: "1px solid rgba(96,165,250,0.22)",
                    background: "rgba(37,99,235,0.1)",
                    color: "#bfdbfe",
                    fontWeight: 850,
                    cursor:
                      filteredDocuments.length === 0 || bulkWorking
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      filteredDocuments.length === 0 || bulkWorking
                        ? 0.6
                        : 1,
                  }}
                >
                  {allVisibleSelected ? (
                    <CheckSquare2 size={17} />
                  ) : (
                    <Square size={17} />
                  )}
                  {allVisibleSelected ? "Clear Visible" : "Select All"}
                </button>

                <button
                  type="button"
                  onClick={cancelSelectionMode}
                  disabled={Boolean(bulkWorking)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "10px 13px",
                    borderRadius: "12px",
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontWeight: 850,
                    cursor: bulkWorking ? "not-allowed" : "pointer",
                    opacity: bulkWorking ? 0.6 : 1,
                  }}
                >
                  <XCircle size={17} />
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enterSelectionMode}
                disabled={filteredDocuments.length === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "10px 13px",
                  borderRadius: "12px",
                  border: "1px solid rgba(167,139,250,0.22)",
                  background: "rgba(124,58,237,0.11)",
                  color: "#ddd6fe",
                  fontWeight: 850,
                  cursor:
                    filteredDocuments.length === 0
                      ? "not-allowed"
                      : "pointer",
                  opacity: filteredDocuments.length === 0 ? 0.6 : 1,
                }}
              >
                <CheckSquare2 size={17} />
                Select Documents
              </button>
            )}
          </div>
        </section>

        {bulkMessage && (
          <div
            style={{
              marginTop: "14px",
              padding: "13px 15px",
              borderRadius: "13px",
              background: "rgba(34,197,94,0.09)",
              border: "1px solid rgba(134,239,172,0.2)",
              color: "#bbf7d0",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            {bulkMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <section
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
            gap: "16px",
          }}
        >
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((document) => {
              const vehicle = document.vehicle_id
                ? vehicles[document.vehicle_id]
                : null;

              const expiry = getExpiryStatus(document.expiry_date);
              const confidence = getConfidence(document.confidence);

              const expiryColors = {
                success: {
                  background: "rgba(34,197,94,0.11)",
                  border: "1px solid rgba(134,239,172,0.2)",
                  color: "#86efac",
                },
                warning: {
                  background: "rgba(245,158,11,0.11)",
                  border: "1px solid rgba(253,224,71,0.2)",
                  color: "#fde68a",
                },
                danger: {
                  background: "rgba(239,68,68,0.11)",
                  border: "1px solid rgba(252,165,165,0.2)",
                  color: "#fca5a5",
                },
                neutral: {
                  background: "rgba(148,163,184,0.08)",
                  border: "1px solid rgba(148,163,184,0.16)",
                  color: "#cbd5e1",
                },
              }[expiry.tone];

              return (
                <article
                  key={document.id}
                  onClick={() => {
                    if (selectionMode) {
                      toggleDocumentSelection(document.id);
                    }
                  }}
                  style={{
                    position: "relative",
                    padding: "21px",
                    borderRadius: "21px",
                    background:
                      "linear-gradient(145deg, rgba(15,23,42,0.94), rgba(8,20,38,0.9))",
                    border: selectedDocumentIds.includes(document.id)
                      ? "1px solid rgba(96,165,250,0.68)"
                      : "1px solid rgba(148,163,184,0.15)",
                    boxShadow: selectedDocumentIds.includes(document.id)
                      ? "0 0 0 3px rgba(37,99,235,0.13), 0 18px 45px rgba(0,0,0,0.2)"
                      : "0 18px 45px rgba(0,0,0,0.2)",
                    cursor: selectionMode ? "pointer" : "default",
                  }}
                >
                  {selectionMode && (
                    <button
                      type="button"
                      aria-label={
                        selectedDocumentIds.includes(document.id)
                          ? "Deselect document"
                          : "Select document"
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDocumentSelection(document.id);
                      }}
                      style={{
                        position: "absolute",
                        top: "13px",
                        right: "13px",
                        zIndex: 3,
                        width: "38px",
                        height: "38px",
                        borderRadius: "12px",
                        border: selectedDocumentIds.includes(document.id)
                          ? "1px solid rgba(96,165,250,0.55)"
                          : "1px solid rgba(148,163,184,0.22)",
                        background: selectedDocumentIds.includes(document.id)
                          ? "rgba(37,99,235,0.24)"
                          : "rgba(2,6,23,0.78)",
                        color: selectedDocumentIds.includes(document.id)
                          ? "#bfdbfe"
                          : "#94a3b8",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      {selectedDocumentIds.includes(document.id) ? (
                        <CheckSquare2 size={20} />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "13px",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "46px",
                          height: "46px",
                          borderRadius: "14px",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          background: "rgba(37,99,235,0.16)",
                          border: "1px solid rgba(96,165,250,0.2)",
                        }}
                      >
                        <FileText size={22} color="#7dd3fc" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "18px",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {document.document_type || "Vehicle Document"}
                        </h2>

                        <div
                          style={{
                            marginTop: "5px",
                            color: "#94a3b8",
                            fontSize: "13px",
                            lineHeight: 1.5,
                          }}
                        >
                          {vehicle
                            ? `${vehicle.vehicle_name || "Vehicle"} · ${
                                vehicle.vehicle_number || "Number unavailable"
                              }`
                            : "Vehicle not available"}
                        </div>
                      </div>
                    </div>

                    <div
                      title={
                        document.verified
                          ? "Verified by Mira"
                          : "Review recommended"
                      }
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        marginRight: selectionMode ? "43px" : 0,
                        background: document.verified
                          ? "rgba(34,197,94,0.14)"
                          : "rgba(245,158,11,0.12)",
                        color: document.verified ? "#86efac" : "#fde68a",
                      }}
                    >
                      {document.verified ? (
                        <CheckCircle2 size={19} />
                      ) : (
                        <AlertTriangle size={18} />
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "18px",
                      display: "grid",
                      gap: "11px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "11px",
                          fontWeight: 850,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Document Number
                      </div>
                      <div
                        style={{
                          marginTop: "5px",
                          color: "#e2e8f0",
                          fontWeight: 760,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {document.document_number || "Not available"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: "11px",
                            fontWeight: 850,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Mira Status
                        </div>
                        <div
                          style={{
                            marginTop: "5px",
                            color: document.verified
                              ? "#86efac"
                              : "#fde68a",
                            fontWeight: 800,
                            fontSize: "13px",
                          }}
                        >
                          {document.verified
                            ? "Verified by Mira"
                            : "Review Recommended"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: "11px",
                            fontWeight: 850,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Confidence
                        </div>
                        <div
                          style={{
                            marginTop: "5px",
                            color: "#e2e8f0",
                            fontWeight: 800,
                          }}
                        >
                          {confidence}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "17px",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      background: expiryColors.background,
                      border: expiryColors.border,
                      color: expiryColors.color,
                      fontSize: "13px",
                      fontWeight: 800,
                    }}
                  >
                    {expiry.label}
                  </div>

                  <button
                    type="button"
                    disabled={selectionMode}
                    onClick={(event) => {
                      event.stopPropagation();

                      if (!selectionMode) {
                        router.push(`/documents/${document.id}`);
                      }
                    }}
                    style={{
                      width: "100%",
                      marginTop: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "13px",
                      border: "1px solid rgba(96,165,250,0.2)",
                      background: "rgba(37,99,235,0.1)",
                      color: "#bfdbfe",
                      fontWeight: 850,
                      cursor: selectionMode ? "not-allowed" : "pointer",
                      opacity: selectionMode ? 0.55 : 1,
                    }}
                  >
                    {selectionMode ? "Select Card" : "View Details"}
                    <ChevronRight size={18} />
                  </button>
                </article>
              );
            })
          ) : (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "48px 22px",
                borderRadius: "22px",
                background: "rgba(15,23,42,0.75)",
                border: "1px dashed rgba(148,163,184,0.2)",
                textAlign: "center",
              }}
            >
              <FileText size={38} color="#64748b" />

              <h2 style={{ margin: "15px 0 7px" }}>
                {documents.length === 0
                  ? "No documents added yet"
                  : "No matching documents"}
              </h2>

              <p
                style={{
                  margin: "0 auto",
                  maxWidth: "460px",
                  color: "#94a3b8",
                  lineHeight: 1.7,
                }}
              >
                {documents.length === 0
                  ? "Add your first RC, insurance, driving licence, PUC, or other vehicle document."
                  : "Try changing your search text."}
              </p>

              {documents.length === 0 && (
                <button
                  type="button"
                  onClick={() => router.push("/documents/upload")}
                  style={{
                    marginTop: "18px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    borderRadius: "13px",
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={18} />
                  Add Document
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {selectionMode && selectedDocumentIds.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "22px",
            zIndex: 90,
            width: "calc(100% - 32px)",
            maxWidth: "760px",
            transform: "translateX(-50%)",
            padding: "13px",
            borderRadius: "18px",
            background: "rgba(15,23,42,0.96)",
            border: "1px solid rgba(96,165,250,0.28)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.48)",
            backdropFilter: "blur(14px)",
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
              color: "#f8fafc",
              fontWeight: 900,
            }}
          >
            <CheckSquare2 size={20} color="#7dd3fc" />
            {selectedDocumentIds.length} document
            {selectedDocumentIds.length === 1 ? "" : "s"} selected
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={bulkShareDocuments}
              disabled={Boolean(bulkWorking)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 13px",
                borderRadius: "11px",
                border: "1px solid rgba(167,139,250,0.22)",
                background: "rgba(124,58,237,0.13)",
                color: "#ddd6fe",
                fontWeight: 850,
                cursor: bulkWorking ? "not-allowed" : "pointer",
                opacity: bulkWorking ? 0.62 : 1,
              }}
            >
              {bulkWorking === "share" ? (
                <Loader2
                  size={17}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Share2 size={17} />
              )}
              Share
            </button>

            <button
              type="button"
              onClick={bulkDownloadDocuments}
              disabled={Boolean(bulkWorking)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 13px",
                borderRadius: "11px",
                border: "1px solid rgba(96,165,250,0.22)",
                background: "rgba(37,99,235,0.12)",
                color: "#bfdbfe",
                fontWeight: 850,
                cursor: bulkWorking ? "not-allowed" : "pointer",
                opacity: bulkWorking ? 0.62 : 1,
              }}
            >
              {bulkWorking === "download" ? (
                <Loader2
                  size={17}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Download size={17} />
              )}
              Download
            </button>

            <button
              type="button"
              onClick={bulkDeleteDocuments}
              disabled={Boolean(bulkWorking)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 13px",
                borderRadius: "11px",
                border: "1px solid rgba(248,113,113,0.22)",
                background: "rgba(127,29,29,0.15)",
                color: "#fca5a5",
                fontWeight: 850,
                cursor: bulkWorking ? "not-allowed" : "pointer",
                opacity: bulkWorking ? 0.62 : 1,
              }}
            >
              {bulkWorking === "delete" ? (
                <Loader2
                  size={17}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Trash2 size={17} />
              )}
              Delete
            </button>

            <button
              type="button"
              onClick={cancelSelectionMode}
              disabled={Boolean(bulkWorking)}
              aria-label="Cancel selection"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "11px",
                border: "1px solid rgba(148,163,184,0.2)",
                background: "transparent",
                color: "#cbd5e1",
                display: "grid",
                placeItems: "center",
                cursor: bulkWorking ? "not-allowed" : "pointer",
                opacity: bulkWorking ? 0.62 : 1,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {renewalDocument && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeRenewalCenter}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background: "rgba(2,6,23,0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              borderRadius: "22px",
              background: "linear-gradient(145deg, #111827, #0f172a)",
              border: "1px solid rgba(167,139,250,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "15px",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#c4b5fd",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Mira Renewal Assistance
                </div>

                <h2 style={{ margin: "8px 0 5px", fontSize: "23px" }}>
                  {getRenewalAction(renewalDocument.document_type).title}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {getRenewalAction(renewalDocument.document_type).description}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRenewalCenter}
                aria-label="Close renewal center"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "11px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(2,6,23,0.42)",
                  color: "#cbd5e1",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                marginTop: "18px",
                padding: "15px",
                borderRadius: "15px",
                background: "rgba(2,6,23,0.5)",
                border: "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <div style={{ color: "#f8fafc", fontWeight: 900 }}>
                {renewalDocument.document_type || "Vehicle Document"}
              </div>

              <div
                style={{
                  marginTop: "6px",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}
              >
                Expiry date: {formatDate(renewalDocument.expiry_date)}
              </div>
            </div>

            {renewalMessage && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px 13px",
                  borderRadius: "12px",
                  background: "rgba(37,99,235,0.13)",
                  border: "1px solid rgba(96,165,250,0.2)",
                  color: "#bfdbfe",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                {renewalMessage}
              </div>
            )}

            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => continueRenewal(renewalDocument)}
                style={{
                  flex: "1 1 190px",
                  padding: "12px 15px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#7c3aed",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {getRenewalAction(renewalDocument.document_type).buttonLabel}
              </button>

              <button
                type="button"
                onClick={() => snoozeRenewalReminder(renewalDocument)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "12px 15px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "transparent",
                  color: "#cbd5e1",
                  fontWeight: 850,
                  cursor: "pointer",
                }}
              >
                <Clock3 size={16} />
                Remind in 7 days
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}