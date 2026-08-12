"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

type SharedDocumentResponse = {
  document: {
    id: number;
    documentType: string;
    documentNumber: string | null;
    verified: boolean;
    expiryDate: string | null;
  };
  permissionLevel: "view" | "download";
  expiresAt: string;
  secureFileUrl: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SharedDocumentPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SharedDocumentResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSharedDocument() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/documents/secure-share?token=${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          }
        );

        const data = (await response.json()) as
          | SharedDocumentResponse
          | { error?: string };

        if (!response.ok || !("document" in data)) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to open this secure document."
          );
        }

        setResult(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to open this secure document."
        );
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadSharedDocument();
    }
  }, [token]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px",
        background:
          "radial-gradient(circle at top, #172554 0%, #071426 42%, #020617 100%)",
        color: "#f8fafc",
        display: "grid",
        placeItems: "center",
      }}
    >
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <section
        style={{
          width: "min(560px, 100%)",
          padding: "24px",
          borderRadius: "24px",
          background:
            "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(7,20,38,0.96))",
          border: "1px solid rgba(148,163,184,0.16)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.42)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              background: "rgba(37,99,235,0.16)",
              color: "#93c5fd",
            }}
          >
            <ShieldCheck size={23} />
          </div>

          <div>
            <div style={{ fontSize: "18px", fontWeight: 950 }}>
              My Vehicle
            </div>
            <div
              style={{
                marginTop: "2px",
                color: "#67e8f9",
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing: "0.13em",
              }}
            >
              SECURE DOCUMENT ACCESS
            </div>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              minHeight: "330px",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <div>
              <Loader2
                size={38}
                style={{ animation: "spin 1s linear infinite" }}
              />
              <p style={{ color: "#94a3b8" }}>
                Mira is validating this secure link...
              </p>
            </div>
          </div>
        ) : error ? (
          <div
            style={{
              marginTop: "24px",
              padding: "25px",
              borderRadius: "18px",
              background: "rgba(127,29,29,0.16)",
              border: "1px solid rgba(248,113,113,0.2)",
              textAlign: "center",
            }}
          >
            <AlertTriangle size={34} color="#fca5a5" />
            <h1 style={{ margin: "14px 0 8px", fontSize: "23px" }}>
              Access Unavailable
            </h1>
            <p
              style={{
                margin: 0,
                color: "#fecaca",
                lineHeight: 1.65,
              }}
            >
              {error}
            </p>
          </div>
        ) : result ? (
          <>
            <div
              style={{
                marginTop: "24px",
                padding: "18px",
                borderRadius: "18px",
                background: "rgba(22,101,52,0.14)",
                border: "1px solid rgba(134,239,172,0.18)",
                display: "flex",
                alignItems: "center",
                gap: "11px",
              }}
            >
              <CheckCircle2 size={22} color="#86efac" />
              <div>
                <div style={{ color: "#bbf7d0", fontWeight: 900 }}>
                  Secure link verified
                </div>
                <div
                  style={{
                    marginTop: "3px",
                    color: "#86efac",
                    fontSize: "11px",
                  }}
                >
                  Valid until {formatDateTime(result.expiresAt)}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "16px",
                padding: "21px",
                borderRadius: "19px",
                background: "rgba(2,6,23,0.42)",
                border: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              <FileText size={30} color="#93c5fd" />

              <h1
                style={{
                  margin: "13px 0 7px",
                  fontSize: "27px",
                }}
              >
                {result.document.documentType}
              </h1>

              <p style={{ margin: 0, color: "#94a3b8" }}>
                {result.document.documentNumber || "Document number protected"}
              </p>

              <div
                style={{
                  marginTop: "18px",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "10px",
                }}
              >
                <Info
                  icon={ShieldCheck}
                  label="Verification"
                  value={
                    result.document.verified
                      ? "Verified by Mira"
                      : "Stored Document"
                  }
                />
                <Info
                  icon={CalendarClock}
                  label="Document Expiry"
                  value={formatDate(result.document.expiryDate)}
                />
              </div>

              {result.secureFileUrl ? (
                <a
                  href={result.secureFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={
                    result.permissionLevel === "download"
                      ? result.document.documentType
                      : undefined
                  }
                  style={{
                    marginTop: "18px",
                    width: "100%",
                    padding: "13px 15px",
                    borderRadius: "12px",
                    background: "#2563eb",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 900,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <ExternalLink size={18} />
                  {result.permissionLevel === "download"
                    ? "Open / Download Document"
                    : "Open Document"}
                </a>
              ) : (
                <div
                  style={{
                    marginTop: "18px",
                    padding: "13px",
                    borderRadius: "12px",
                    background: "rgba(120,53,15,0.15)",
                    color: "#fde68a",
                    textAlign: "center",
                  }}
                >
                  The stored document file is unavailable.
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "15px",
                color: "#64748b",
                fontSize: "11px",
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              <LockKeyhole
                size={14}
                style={{ verticalAlign: "middle", marginRight: "6px" }}
              />
              Access is temporary, monitored and controlled by the document
              owner.
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "12px",
        background: "rgba(15,23,42,0.68)",
      }}
    >
      <Icon size={15} color="#64748b" />
      <div
        style={{
          marginTop: "7px",
          color: "#64748b",
          fontSize: "10px",
          fontWeight: 850,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "4px",
          color: "#e2e8f0",
          fontSize: "12px",
          fontWeight: 850,
        }}
      >
        {value}
      </div>
    </div>
  );
}