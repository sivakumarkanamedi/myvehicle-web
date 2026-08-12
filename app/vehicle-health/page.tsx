"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

type VehicleRow = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  manufacturing_year: number | null;
  fuel_type: string | null;
  image_url: string | null;
};

type ServiceRow = {
  id: number;
  service_type: string | null;
  workshop_name: string | null;
  service_date: string | null;
  odometer: number | null;
  total_cost: number | null;
};

type DocumentRow = {
  id: number;
  document_type: string | null;
  document_name: string | null;
  expiry_date: string | null;
  scan_status: string | null;
};

type TimelineTone = "good" | "warning" | "danger" | "neutral";

type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  tone: TimelineTone;
  dateLabel?: string;
};

function normalize(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

function daysSince(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
}

function findDocument(
  documents: DocumentRow[],
  acceptedNames: string[]
) {
  const accepted = new Set(acceptedNames.map(normalize));

  return documents.find((document) => {
    const type = normalize(document.document_type);
    const name = normalize(document.document_name);

    return accepted.has(type) || accepted.has(name);
  });
}

function toneStyles(tone: TimelineTone) {
  if (tone === "good") {
    return {
      color: "#86efac",
      background: "rgba(134,239,172,0.08)",
      border: "rgba(134,239,172,0.22)",
      dot: "#22c55e",
    };
  }

  if (tone === "warning") {
    return {
      color: "#fde68a",
      background: "rgba(253,230,138,0.08)",
      border: "rgba(253,230,138,0.22)",
      dot: "#f59e0b",
    };
  }

  if (tone === "danger") {
    return {
      color: "#fca5a5",
      background: "rgba(252,165,165,0.08)",
      border: "rgba(252,165,165,0.22)",
      dot: "#ef4444",
    };
  }

  return {
    color: "#cbd5e1",
    background: "rgba(148,163,184,0.07)",
    border: "rgba(148,163,184,0.18)",
    dot: "#94a3b8",
  };
}

function AppIcon({
  kind,
  size = 22,
}: {
  kind: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (kind) {
    case "vehicle":
      return (
        <svg {...common}>
          <path d="m5 16 1.5-5h11L19 16" />
          <path d="M3 16h18v3H3zM7 19v2M17 19v2M7.5 13h9" />
        </svg>
      );

    case "timeline":
      return (
        <svg {...common}>
          <circle cx="7" cy="5" r="2" />
          <circle cx="7" cy="12" r="2" />
          <circle cx="7" cy="19" r="2" />
          <path d="M9 5h10M9 12h10M9 19h10" />
        </svg>
      );

    case "mira":
      return (
        <svg {...common}>
          <rect x="5" y="6" width="14" height="12" rx="3" />
          <path d="M9 11h.01M15 11h.01M9 15h6M12 3v3" />
        </svg>
      );

    case "prediction":
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
          <path d="m3 15 7-7 6 4 6-8" />
        </svg>
      );

    case "documents":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h5M10 12h5M10 16h5" />
        </svg>
      );

    case "service":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.1 5.1L4 17l3 3 5.6-5.6a4 4 0 0 0 5.1-5.1l-2.2 2.2-3-3 2.2-2.2Z" />
        </svg>
      );

    default:
      return null;
  }
}

export default function VehicleHealthPage() {
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [latestService, setLatestService] =
    useState<ServiceRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: vehicleData, error: vehicleError } =
          await supabase
            .from("vehicles")
            .select(
              "id, vehicle_name, vehicle_number, vehicle_type, brand, model, manufacturing_year, fuel_type, image_url"
            )
            .eq("user_id", user.id)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (vehicleError) {
          throw vehicleError;
        }

        setVehicle(vehicleData ?? null);

        if (!vehicleData) {
          setLatestService(null);
          setDocuments([]);
          return;
        }

        const [
          { data: serviceData, error: serviceError },
          { data: documentData, error: documentError },
        ] = await Promise.all([
          supabase
            .from("service_entries")
            .select(
              "id, service_type, workshop_name, service_date, odometer, total_cost"
            )
            .eq("user_id", user.id)
            .eq("vehicle_id", vehicleData.id)
            .order("service_date", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("vehicle_documents")
            .select(
              "id, document_type, document_name, expiry_date, scan_status"
            )
            .eq("user_id", user.id)
            .eq("vehicle_id", vehicleData.id)
            .order("created_at", { ascending: false }),
        ]);

        if (serviceError) {
          throw serviceError;
        }

        if (documentError) {
          throw documentError;
        }

        setLatestService(serviceData ?? null);
        setDocuments(documentData ?? []);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load maintenance timeline."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router]);

  const insurance = useMemo(
    () =>
      findDocument(documents, [
        "insurance",
        "vehicle insurance",
        "motor insurance",
      ]),
    [documents]
  );

  const puc = useMemo(
    () =>
      findDocument(documents, [
        "puc",
        "pollution certificate",
        "pollution under control",
      ]),
    [documents]
  );

  const rc = useMemo(
    () =>
      findDocument(documents, [
        "rc",
        "registration certificate",
        "vehicle registration",
      ]),
    [documents]
  );

  const dl = useMemo(
    () =>
      findDocument(documents, [
        "dl",
        "driving licence",
        "driving license",
        "driver licence",
        "driver license",
      ]),
    [documents]
  );

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    if (vehicle) {
      items.push({
        id: "vehicle-added",
        title: "Vehicle profile available",
        detail:
          vehicle.vehicle_number ||
          "Registration number is not recorded.",
        tone: "good",
        dateLabel: "Today",
      });
    }

    const addDocumentItem = (
      id: string,
      title: string,
      document?: DocumentRow
    ) => {
      if (!document) {
        items.push({
          id,
          title,
          detail: "Document is missing.",
          tone: "warning",
          dateLabel: "Action needed",
        });
        return;
      }

      const remaining = daysUntil(document.expiry_date);

      if (remaining === null) {
        items.push({
          id,
          title,
          detail: "Available, but expiry date is not recorded.",
          tone: "neutral",
          dateLabel: "Review",
        });
        return;
      }

      if (remaining < 0) {
        items.push({
          id,
          title,
          detail: `Expired ${Math.abs(remaining)} day${
            Math.abs(remaining) === 1 ? "" : "s"
          } ago.`,
          tone: "danger",
          dateLabel: formatDate(document.expiry_date),
        });
        return;
      }

      if (remaining <= 30) {
        items.push({
          id,
          title,
          detail: `${remaining} day${
            remaining === 1 ? "" : "s"
          } remaining.`,
          tone: "warning",
          dateLabel: formatDate(document.expiry_date),
        });
        return;
      }

      items.push({
        id,
        title,
        detail: `Valid for ${remaining} more days.`,
        tone: "good",
        dateLabel: formatDate(document.expiry_date),
      });
    };

    addDocumentItem("insurance", "Insurance", insurance);
    addDocumentItem("puc", "PUC", puc);
    addDocumentItem("rc", "Registration Certificate", rc);
    addDocumentItem("dl", "Driving Licence", dl);

    if (latestService?.service_date) {
      const serviceAge = daysSince(latestService.service_date);

      items.push({
        id: "service",
        title: "Latest service",
        detail:
          serviceAge === null
            ? "Service date could not be verified."
            : `Recorded ${serviceAge} day${
                serviceAge === 1 ? "" : "s"
              } ago${
                latestService.workshop_name
                  ? ` at ${latestService.workshop_name}`
                  : ""
              }.`,
        tone:
          serviceAge === null
            ? "neutral"
            : serviceAge <= 180
              ? "good"
              : serviceAge <= 365
                ? "warning"
                : "danger",
        dateLabel: formatDate(latestService.service_date),
      });
    } else {
      items.push({
        id: "service",
        title: "Service history",
        detail: "No verified service record is available.",
        tone: "warning",
        dateLabel: "Action needed",
      });
    }

    items.push({
      id: "fastag",
      title: "FASTag",
      detail:
        normalize(vehicle?.vehicle_type).includes("bike") ||
        normalize(vehicle?.vehicle_type).includes("scooter") ||
        normalize(vehicle?.vehicle_type).includes("motorcycle")
          ? "Not applicable for this two-wheeler."
          : "FASTag account is not linked.",
      tone: "neutral",
      dateLabel: "Optional",
    });

    return items;
  }, [vehicle, insurance, puc, rc, dl, latestService]);

  const predictions = useMemo(() => {
    const serviceAge = daysSince(latestService?.service_date);

    return [
      {
        title: "Next Service",
        value:
          serviceAge === null
            ? "Not enough data"
            : serviceAge <= 150
              ? "Based on your service interval"
              : "Inspection recommended",
        detail:
          serviceAge === null
            ? "Add a verified service record."
            : "Prediction uses only your latest recorded service date.",
        available: serviceAge !== null,
      },
    ];
  }, [latestService]);

  const missingActions = useMemo(() => {
    const actions: string[] = [];

    if (!latestService) {
      actions.push("Add your latest service record or invoice.");
    }

    if (!insurance) {
      actions.push("Upload your insurance document.");
    }

    if (!puc) {
      actions.push("Upload your PUC certificate.");
    }

    if (!rc) {
      actions.push("Upload your Registration Certificate.");
    }

    if (!dl) {
      actions.push("Upload your Driving Licence.");
    }

    return actions.slice(0, 5);
  }, [latestService, insurance, puc, rc, dl]);

  const vehicleName =
    vehicle?.vehicle_name ||
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "My Vehicle";

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#07101f",
          color: "white",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 16px",
              borderRadius: "999px",
              border: "4px solid #1e293b",
              borderTopColor: "#67e8f9",
              animation: "spin 0.8s linear infinite",
            }}
          />

          <div style={{ color: "#cbd5e1", fontWeight: 800 }}>
            Mira is preparing your maintenance timeline…
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
        background:
          "radial-gradient(circle at top left, rgba(8,145,178,0.12), transparent 34%), #07101f",
        color: "white",
        padding: "28px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => router.push("/mira")}
              style={{
                border: "none",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 0,
                fontWeight: 800,
              }}
            >
              ← Back to Mira
            </button>

            <div
              style={{
                marginTop: "14px",
                color: "#67e8f9",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Mira AI Maintenance Intelligence
            </div>

            <h1
              style={{
                margin: "6px 0 0",
                fontSize: "clamp(30px, 5vw, 48px)",
                letterSpacing: "-0.04em",
              }}
            >
              Maintenance Timeline
            </h1>
          </div>

          <button
            type="button"
            onClick={() => router.push("/mira")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              padding: "12px 17px",
              borderRadius: "14px",
              border: "1px solid #334155",
              background: "#172033",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            <AppIcon kind="mira" size={19} />
            Ask Mira
          </button>
        </header>

        {error && (
          <div
            style={{
              marginBottom: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid rgba(252,165,165,0.25)",
              background: "rgba(127,29,29,0.18)",
              color: "#fecaca",
            }}
          >
            {error}
          </div>
        )}

        {!vehicle ? (
          <section
            style={{
              padding: "36px",
              borderRadius: "24px",
              background: "#101a2d",
              border: "1px solid #27364d",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "62px",
                height: "62px",
                margin: "0 auto 16px",
                borderRadius: "18px",
                display: "grid",
                placeItems: "center",
                color: "#67e8f9",
                background: "rgba(103,232,249,0.08)",
                border: "1px solid rgba(103,232,249,0.18)",
              }}
            >
              <AppIcon kind="vehicle" size={30} />
            </div>

            <h2>No vehicle added</h2>

            <p style={{ color: "#94a3b8" }}>
              Add a vehicle before building its maintenance timeline.
            </p>

            <button
              type="button"
              onClick={() => router.push("/add-vehicle")}
              style={{
                marginTop: "10px",
                padding: "13px 18px",
                borderRadius: "13px",
                border: "none",
                background: "#2563eb",
                color: "white",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Add Vehicle
            </button>
          </section>
        ) : (
          <>
            <section
              style={{
                padding: "24px",
                borderRadius: "24px",
                background:
                  "linear-gradient(145deg, rgba(23,32,51,0.98), rgba(13,23,40,0.98))",
                border: "1px solid #2a3b53",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                {vehicle.image_url ? (
                  <img
                    src={vehicle.image_url}
                    alt={vehicleName}
                    style={{
                      width: "96px",
                      height: "76px",
                      objectFit: "cover",
                      borderRadius: "17px",
                      border: "1px solid #334155",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "96px",
                      height: "76px",
                      borderRadius: "17px",
                      display: "grid",
                      placeItems: "center",
                      color: "#67e8f9",
                      background: "rgba(103,232,249,0.08)",
                      border: "1px solid rgba(103,232,249,0.18)",
                    }}
                  >
                    <AppIcon kind="vehicle" size={34} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: "210px" }}>
                  <div
                    style={{
                      color: "#67e8f9",
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Active Vehicle
                  </div>

                  <h2
                    style={{
                      margin: "6px 0 4px",
                      fontSize: "29px",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {vehicleName}
                  </h2>

                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {vehicle.vehicle_number ||
                      "Registration not added"}
                    {vehicle.vehicle_type
                      ? ` • ${vehicle.vehicle_type}`
                      : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/vehicle")}
                  style={{
                    padding: "11px 15px",
                    borderRadius: "12px",
                    border: "1px solid #41516a",
                    background: "#1b293e",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  View Vehicle →
                </button>
              </div>
            </section>

            <section
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.35fr) minmax(300px, 0.65fr)",
                gap: "18px",
              }}
            >
              <div
                style={{
                  padding: "23px",
                  borderRadius: "24px",
                  background: "#101a2d",
                  border: "1px solid #27364d",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#67e8f9",
                    fontWeight: 900,
                  }}
                >
                  <AppIcon kind="timeline" size={22} />
                  Verified Timeline
                </div>

                <div style={{ marginTop: "20px" }}>
                  {timelineItems.map((item, index) => {
                    const theme = toneStyles(item.tone);

                    return (
                      <div
                        key={item.id}
                        style={{
                          position: "relative",
                          display: "grid",
                          gridTemplateColumns: "22px 1fr",
                          gap: "14px",
                          paddingBottom:
                            index === timelineItems.length - 1
                              ? 0
                              : "20px",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              width: "11px",
                              height: "11px",
                              marginTop: "6px",
                              borderRadius: "999px",
                              background: theme.dot,
                              boxShadow: `0 0 0 4px ${theme.background}`,
                              zIndex: 1,
                            }}
                          />

                          {index !== timelineItems.length - 1 && (
                            <span
                              style={{
                                position: "absolute",
                                top: "19px",
                                bottom: "-7px",
                                width: "1px",
                                background: "#334155",
                              }}
                            />
                          )}
                        </div>

                        <article
                          style={{
                            padding: "15px 16px",
                            borderRadius: "16px",
                            background: theme.background,
                            border: `1px solid ${theme.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "15px",
                                fontWeight: 900,
                              }}
                            >
                              {item.title}
                            </div>

                            <div
                              style={{
                                color: theme.color,
                                fontSize: "11px",
                                fontWeight: 900,
                              }}
                            >
                              {item.dateLabel}
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: "6px",
                              color: "#cbd5e1",
                              fontSize: "13px",
                              lineHeight: 1.55,
                            }}
                          >
                            {item.detail}
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  padding: "23px",
                  borderRadius: "24px",
                  background:
                    "linear-gradient(145deg, rgba(8,47,73,0.88), rgba(15,23,42,0.98))",
                  border: "1px solid rgba(103,232,249,0.2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#67e8f9",
                    fontWeight: 900,
                  }}
                >
                  <AppIcon kind="mira" size={22} />
                  Mira Recommendation
                </div>

                <p
                  style={{
                    margin: "15px 0 0",
                    color: "#dbeafe",
                    fontSize: "14px",
                    lineHeight: 1.75,
                  }}
                >
                  I will only use verified records for maintenance
                  guidance. Complete the actions below to improve future
                  reminders and predictions.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    marginTop: "17px",
                  }}
                >
                  {missingActions.map((action, index) => (
                    <div
                      key={action}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr",
                        gap: "10px",
                        alignItems: "start",
                        padding: "12px",
                        borderRadius: "14px",
                        background: "rgba(15,23,42,0.7)",
                        border: "1px solid #2a4058",
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "9px",
                          display: "grid",
                          placeItems: "center",
                          color: "#67e8f9",
                          background: "rgba(103,232,249,0.08)",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {index + 1}
                      </div>

                      <div
                        style={{
                          color: "#cbd5e1",
                          fontSize: "13px",
                          lineHeight: 1.55,
                        }}
                      >
                        {action}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/documents")}
                  style={{
                    width: "100%",
                    marginTop: "17px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "9px",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    background: "#1b293e",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  <AppIcon kind="documents" size={18} />
                  Open Document Vault
                </button>
              </div>
            </section>

            <section
              style={{
                marginTop: "18px",
                padding: "23px",
                borderRadius: "24px",
                background: "#101a2d",
                border: "1px solid #27364d",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "end",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#67e8f9",
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    <AppIcon kind="prediction" size={18} />
                    Service Planning
                  </div>

                  <h2 style={{ margin: "7px 0 0" }}>
                    Verified service planning only
                  </h2>
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Uses only verified service dates and recorded maintenance history.
                </div>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "12px",
                }}
              >
                {predictions.map((prediction) => (
                  <article
                    key={prediction.title}
                    style={{
                      minHeight: "148px",
                      padding: "17px",
                      borderRadius: "18px",
                      background:
                        "linear-gradient(145deg, #0c1526, #101b2f)",
                      border: prediction.available
                        ? "1px solid rgba(103,232,249,0.25)"
                        : "1px solid #27364d",
                    }}
                  >
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        fontWeight: 800,
                      }}
                    >
                      {prediction.title}
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        fontSize: "19px",
                        fontWeight: 900,
                        color: prediction.available
                          ? "#e0f2fe"
                          : "#cbd5e1",
                      }}
                    >
                      {prediction.value}
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        color: "#7f91aa",
                        fontSize: "12px",
                        lineHeight: 1.55,
                      }}
                    >
                      {prediction.detail}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}