"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "../../../../supabase";

type DocumentRecord = {
  id: number;
  document_type: string | null;
  document_name: string | null;
  document_number: string | null;
  vehicle_id: number | null;
};

type ShareLink = {
  id: number;
  document_id: number;
  permission_level: "view" | "download";
  expires_at: string;
  revoked_at: string | null;
  scan_count: number;
  last_scanned_at: string | null;
  created_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SecureQrSharePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [duration, setDuration] = useState("30-minutes");
  const [permissionLevel, setPermissionLevel] = useState<"view" | "download">(
    "view"
  );
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
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
        router.replace("/login");
        return;
      }

      const [documentResult, linksResult] = await Promise.all([
        supabase
          .from("vehicle_documents")
          .select(
            "id, document_type, document_name, document_number, vehicle_id"
          )
          .eq("id", documentId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("document_secure_share_links")
          .select(
            "id, document_id, permission_level, expires_at, revoked_at, scan_count, last_scanned_at, created_at"
          )
          .eq("document_id", documentId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (documentResult.error || !documentResult.data) {
        throw new Error(
          documentResult.error?.message || "Document not found."
        );
      }

      if (linksResult.error) throw linksResult.error;

      setDocument(documentResult.data as DocumentRecord);
      setShareLinks((linksResult.data || []) as ShareLink[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load secure sharing."
      );
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeLinks = useMemo(
    () =>
      shareLinks.filter(
        (link) =>
          !link.revoked_at &&
          new Date(link.expires_at).getTime() > Date.now()
      ),
    [shareLinks]
  );

  async function createShareLink() {
    if (creating) return;

    setCreating(true);
    setError("");
    setCopied(false);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/documents/secure-share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentId,
          duration,
          permissionLevel,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        shareUrl?: string;
      };

      if (!response.ok || !result.shareUrl) {
        throw new Error(result.error || "Unable to create secure QR link.");
      }

      const qrImage = await QRCode.toDataURL(result.shareUrl, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      setShareUrl(result.shareUrl);
      setQrDataUrl(qrImage);
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create secure QR link."
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function revokeShareLink(linkId: number) {
    if (revokingId !== null) return;

    const confirmed = window.confirm(
      "Revoke this QR share link now?\n\nAnyone using the QR code will immediately lose access."
    );

    if (!confirmed) return;

    setRevokingId(linkId);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/documents/secure-share", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ shareLinkId: linkId }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Unable to revoke the share link.");
      }

      if (
        shareLinks.some((link) => link.id === linkId) &&
        shareUrl
      ) {
        setShareUrl("");
        setQrDataUrl("");
      }

      await loadData();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Unable to revoke the share link."
      );
    } finally {
      setRevokingId(null);
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
            "radial-gradient(circle at top, #172554 0%, #071426 40%, #020617 100%)",
          color: "white",
        }}
      >
        <Loader2 size={34} style={{ animation: "spin 1s linear infinite" }} />
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px 70px",
        background:
          "radial-gradient(circle at top, #172554 0%, #071426 38%, #020617 100%)",
        color: "#f8fafc",
      }}
    >
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        select {
          font: inherit;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div style={{ width: "min(1060px, 100%)", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push(`/documents/${documentId}`)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 12px",
            borderRadius: "11px",
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.62)",
            color: "#cbd5e1",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={17} />
          Document Details
        </button>

        <header style={{ marginTop: "22px" }}>
          <div
            style={{
              color: "#67e8f9",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Expiring QR Access
          </div>

          <h1
            style={{
              margin: "9px 0 7px",
              fontSize: "clamp(30px, 5vw, 46px)",
            }}
          >
            Secure QR Sharing
          </h1>

          <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.7 }}>
            {document?.document_type ||
              document?.document_name ||
              "Vehicle Document"}
            {document?.document_number
              ? ` · ${document.document_number}`
              : ""}
          </p>
        </header>

        {error && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(127,29,29,0.18)",
              border: "1px solid rgba(248,113,113,0.23)",
              color: "#fecaca",
              display: "flex",
              gap: "9px",
            }}
          >
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <section
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: "18px",
          }}
        >
          <div
            style={{
              padding: "22px",
              borderRadius: "21px",
              background: "rgba(15,23,42,0.86)",
              border: "1px solid rgba(148,163,184,0.14)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <QrCode size={22} color="#93c5fd" />
              <h2 style={{ margin: 0, fontSize: "19px" }}>
                Create New QR
              </h2>
            </div>

            <label style={{ display: "block", marginTop: "18px" }}>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  fontWeight: 850,
                }}
              >
                Access duration
              </span>
              <select
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 13px",
                  borderRadius: "11px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "#071426",
                  color: "white",
                }}
              >
                <option value="5-minutes">5 Minutes</option>
                <option value="30-minutes">30 Minutes</option>
                <option value="1-hour">1 Hour</option>
                <option value="24-hours">24 Hours</option>
              </select>
            </label>

            <label style={{ display: "block", marginTop: "14px" }}>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  fontWeight: 850,
                }}
              >
                Permission
              </span>
              <select
                value={permissionLevel}
                onChange={(event) =>
                  setPermissionLevel(
                    event.target.value === "download"
                      ? "download"
                      : "view"
                  )
                }
                style={{
                  width: "100%",
                  padding: "12px 13px",
                  borderRadius: "11px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "#071426",
                  color: "white",
                }}
              >
                <option value="view">View Only</option>
                <option value="download">View & Download</option>
              </select>
            </label>

            <button
              type="button"
              onClick={createShareLink}
              disabled={creating}
              style={{
                marginTop: "17px",
                width: "100%",
                padding: "13px 15px",
                borderRadius: "12px",
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 900,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {creating ? (
                <Loader2
                  size={18}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <QrCode size={18} />
              )}
              {creating ? "Creating Secure QR..." : "Generate Secure QR"}
            </button>

            <div
              style={{
                marginTop: "15px",
                padding: "12px",
                borderRadius: "13px",
                background: "rgba(8,47,73,0.19)",
                border: "1px solid rgba(103,232,249,0.15)",
                color: "#bae6fd",
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              <ShieldCheck
                size={16}
                style={{ verticalAlign: "middle", marginRight: "7px" }}
              />
              The QR stops working automatically after expiry and can be
              revoked earlier.
            </div>
          </div>

          <div
            style={{
              padding: "22px",
              borderRadius: "21px",
              background: "rgba(15,23,42,0.86)",
              border: "1px solid rgba(148,163,184,0.14)",
              minHeight: "390px",
              display: "grid",
              placeItems: "center",
            }}
          >
            {qrDataUrl && shareUrl ? (
              <div style={{ width: "100%", textAlign: "center" }}>
                <img
                  src={qrDataUrl}
                  alt="Secure document QR code"
                  width={300}
                  height={300}
                  style={{
                    width: "min(300px, 100%)",
                    height: "auto",
                    padding: "12px",
                    borderRadius: "18px",
                    background: "white",
                  }}
                />

                <div
                  style={{
                    marginTop: "14px",
                    padding: "11px",
                    borderRadius: "11px",
                    background: "rgba(2,6,23,0.44)",
                    color: "#94a3b8",
                    fontSize: "11px",
                    wordBreak: "break-all",
                  }}
                >
                  {shareUrl}
                </div>

                <div
                  style={{
                    marginTop: "11px",
                    display: "flex",
                    justifyContent: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={copyShareUrl}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(96,165,250,0.2)",
                      background: "rgba(37,99,235,0.12)",
                      color: "#bfdbfe",
                      fontWeight: 850,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      window.open(shareUrl, "_blank", "noopener,noreferrer")
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(167,139,250,0.2)",
                      background: "rgba(124,58,237,0.12)",
                      color: "#ddd6fe",
                      fontWeight: 850,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                    }}
                  >
                    <ExternalLink size={16} />
                    Test Link
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#64748b" }}>
                <QrCode size={54} />
                <h3 style={{ margin: "14px 0 7px", color: "#cbd5e1" }}>
                  No QR generated yet
                </h3>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  Choose access settings and generate a secure QR code.
                </p>
              </div>
            )}
          </div>
        </section>

        <section style={{ marginTop: "22px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "21px" }}>Share History</h2>
              <p
                style={{
                  margin: "5px 0 0",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                {activeLinks.length} active secure QR link
                {activeLinks.length === 1 ? "" : "s"}.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              style={{
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15,23,42,0.6)",
                color: "#cbd5e1",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div
            style={{
              marginTop: "13px",
              display: "grid",
              gap: "11px",
            }}
          >
            {shareLinks.length === 0 ? (
              <div
                style={{
                  padding: "28px",
                  borderRadius: "17px",
                  background: "rgba(15,23,42,0.76)",
                  border: "1px solid rgba(148,163,184,0.14)",
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                No QR share history yet.
              </div>
            ) : (
              shareLinks.map((link) => {
                const expired =
                  new Date(link.expires_at).getTime() <= Date.now();
                const active = !link.revoked_at && !expired;

                return (
                  <article
                    key={link.id}
                    style={{
                      padding: "16px",
                      borderRadius: "16px",
                      background: "rgba(15,23,42,0.8)",
                      border: active
                        ? "1px solid rgba(134,239,172,0.15)"
                        : "1px solid rgba(148,163,184,0.13)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "14px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "11px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          display: "grid",
                          placeItems: "center",
                          background: active
                            ? "rgba(22,163,74,0.13)"
                            : "rgba(71,85,105,0.18)",
                          color: active ? "#86efac" : "#94a3b8",
                        }}
                      >
                        <QrCode size={19} />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 900,
                          }}
                        >
                          {active
                            ? "Active QR"
                            : link.revoked_at
                              ? "Revoked QR"
                              : "Expired QR"}
                        </div>
                        <div
                          style={{
                            marginTop: "5px",
                            color: "#94a3b8",
                            fontSize: "11px",
                            lineHeight: 1.6,
                          }}
                        >
                          Expires: {formatDateTime(link.expires_at)}
                          <br />
                          Scans: {link.scan_count} · Last scan:{" "}
                          {formatDateTime(link.last_scanned_at)}
                        </div>
                      </div>
                    </div>

                    {active && (
                      <button
                        type="button"
                        onClick={() => revokeShareLink(link.id)}
                        disabled={revokingId !== null}
                        style={{
                          padding: "9px 11px",
                          borderRadius: "10px",
                          border: "1px solid rgba(248,113,113,0.2)",
                          background: "rgba(127,29,29,0.14)",
                          color: "#fca5a5",
                          fontWeight: 850,
                          cursor:
                            revokingId !== null ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                        }}
                      >
                        {revokingId === link.id ? (
                          <Loader2
                            size={16}
                            style={{ animation: "spin 1s linear infinite" }}
                          />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        Revoke
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}