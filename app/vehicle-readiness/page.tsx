"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Vault,
  Wrench,
  XCircle,
} from "lucide-react";
import { supabase } from "../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  image_url: string | null;
};

type VehicleDocument = {
  id: number;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  expiry_date: string | null;
  verified: boolean | null;
  scan_status: string | null;
  created_at: string | null;
};

type ServiceEntry = {
  id: number;
  vehicle_id: number | null;
  service_date: string | null;
  service_type: string | null;
  workshop_name: string | null;
};

type TrustedPerson = {
  id: number;
  vehicle_id: number | null;
  status?: string | null;
  revoked_at?: string | null;
};

type CriterionState = "complete" | "attention" | "critical" | "missing";

type ReadinessCriterion = {
  key: string;
  title: string;
  description: string;
  weight: number;
  earned: number;
  state: CriterionState;
  value: string;
  actionLabel: string;
  actionPath: string;
  icon: typeof FileText;
};

const DOCUMENT_ALIASES = {
  rc: ["rc", "registration certificate", "vehicle registration"],
  insurance: ["insurance", "motor insurance", "vehicle insurance"],
  puc: [
    "puc",
    "pollution",
    "pollution certificate",
    "pollution under control",
    "emission certificate",
  ],
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesDocument(
  document: VehicleDocument,
  aliases: string[]
) {
  const searchable = normalize(
    `${document.document_type || ""} ${document.document_name || ""}`
  );

  return aliases.some((alias) => searchable.includes(normalize(alias)));
}

function latestMatchingDocument(
  documents: VehicleDocument[],
  aliases: string[]
) {
  return documents
    .filter((document) => matchesDocument(document, aliases))
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })[0];
}

function getDaysUntil(dateValue: string | null) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return "Not recorded";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildLegalDocumentCriterion({
  key,
  title,
  weight,
  document,
  expiryRequired,
}: {
  key: string;
  title: string;
  weight: number;
  document?: VehicleDocument;
  expiryRequired: boolean;
}): ReadinessCriterion {
  if (!document) {
    return {
      key,
      title,
      description: `${title} is not available in your secure vault.`,
      weight,
      earned: 0,
      state: "missing",
      value: "Not added",
      actionLabel: `Add ${title}`,
      actionPath: "/documents/upload",
      icon: FileText,
    };
  }

  if (!expiryRequired && !document.expiry_date) {
    return {
      key,
      title,
      description: `${title} is safely stored in your document vault.`,
      weight,
      earned: weight,
      state: "complete",
      value: document.verified ? "Available · Mira verified" : "Available",
      actionLabel: "Open Vault",
      actionPath: "/documents",
      icon: FileCheck2,
    };
  }

  const days = getDaysUntil(document.expiry_date);

  if (days === null) {
    return {
      key,
      title,
      description: `${title} is available, but its expiry date is not recorded.`,
      weight,
      earned: Math.round(weight * 0.5),
      state: "attention",
      value: "Expiry date required",
      actionLabel: "Update Document",
      actionPath: `/documents/${document.id}`,
      icon: CalendarClock,
    };
  }

  if (days < 0) {
    return {
      key,
      title,
      description: `${title} expired on ${formatDate(document.expiry_date)}.`,
      weight,
      earned: 0,
      state: "critical",
      value: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`,
      actionLabel: `Renew ${title}`,
      actionPath: `/documents/${document.id}`,
      icon: XCircle,
    };
  }

  if (days <= 30) {
    return {
      key,
      title,
      description: `${title} will expire on ${formatDate(
        document.expiry_date
      )}.`,
      weight,
      earned: Math.round(weight * 0.7),
      state: "attention",
      value: `${days} day${days === 1 ? "" : "s"} remaining`,
      actionLabel: `Renew ${title}`,
      actionPath: `/documents/${document.id}`,
      icon: Clock3,
    };
  }

  return {
    key,
    title,
    description: `${title} is valid until ${formatDate(
      document.expiry_date
    )}.`,
    weight,
    earned: weight,
    state: "complete",
    value: `${days} days remaining`,
    actionLabel: "View Document",
    actionPath: `/documents/${document.id}`,
    icon: CheckCircle2,
  };
}

function stateAppearance(state: CriterionState) {
  if (state === "complete") {
    return {
      label: "Ready",
      color: "#86efac",
      background: "rgba(22,163,74,0.12)",
      border: "rgba(134,239,172,0.19)",
    };
  }

  if (state === "attention") {
    return {
      label: "Attention",
      color: "#fde68a",
      background: "rgba(202,138,4,0.12)",
      border: "rgba(253,230,138,0.19)",
    };
  }

  if (state === "critical") {
    return {
      label: "Action Required",
      color: "#fca5a5",
      background: "rgba(220,38,38,0.12)",
      border: "rgba(252,165,165,0.19)",
    };
  }

  return {
    label: "Missing",
    color: "#cbd5e1",
    background: "rgba(71,85,105,0.16)",
    border: "rgba(203,213,225,0.16)",
  };
}

export default function VehicleReadinessPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [trustedPeople, setTrustedPeople] = useState<TrustedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

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

        const { data: vehicleRows, error: vehicleError } = await supabase
          .from("vehicles")
          .select(
            "id, vehicle_name, vehicle_number, vehicle_type, brand, model, image_url"
          )
          .eq("user_id", user.id)
          .order("id", { ascending: false });

        if (vehicleError) throw vehicleError;

        const availableVehicles = (vehicleRows || []) as Vehicle[];
        setVehicles(availableVehicles);

        const activeVehicleId =
          selectedVehicleId &&
          availableVehicles.some(
            (vehicle) => vehicle.id === selectedVehicleId
          )
            ? selectedVehicleId
            : availableVehicles[0]?.id || null;

        setSelectedVehicleId(activeVehicleId);

        if (!activeVehicleId) {
          setDocuments([]);
          setServiceEntries([]);
          setTrustedPeople([]);
          return;
        }

        const [documentResult, serviceResult, trustedResult] =
          await Promise.all([
            supabase
              .from("vehicle_documents")
              .select(
                "id, vehicle_id, document_type, document_name, expiry_date, verified, scan_status, created_at"
              )
              .eq("user_id", user.id)
              .eq("vehicle_id", activeVehicleId)
              .order("created_at", { ascending: false }),

            supabase
              .from("service_entries")
              .select(
                "id, vehicle_id, service_date, service_type, workshop_name"
              )
              .eq("user_id", user.id)
              .eq("vehicle_id", activeVehicleId)
              .order("service_date", { ascending: false })
              .limit(20),

            supabase
              .from("trusted_people")
              .select("id, vehicle_id, status, revoked_at")
              .eq("user_id", user.id)
              .eq("vehicle_id", activeVehicleId),
          ]);

        if (documentResult.error) throw documentResult.error;

        setDocuments(
          (documentResult.data || []) as VehicleDocument[]
        );

        // Service and trusted-access data are optional readiness items.
        // If either table is not installed yet, the page still works.
        setServiceEntries(
          serviceResult.error
            ? []
            : ((serviceResult.data || []) as ServiceEntry[])
        );

        setTrustedPeople(
          trustedResult.error
            ? []
            : ((trustedResult.data || []) as TrustedPerson[])
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to calculate vehicle readiness."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, selectedVehicleId]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [selectedVehicleId, vehicles]
  );

  const criteria = useMemo<ReadinessCriterion[]>(() => {
    const rc = latestMatchingDocument(documents, DOCUMENT_ALIASES.rc);
    const insurance = latestMatchingDocument(
      documents,
      DOCUMENT_ALIASES.insurance
    );
    const puc = latestMatchingDocument(documents, DOCUMENT_ALIASES.puc);

    const latestService = serviceEntries[0];
    const activeTrustedPeople = trustedPeople.filter(
      (person) =>
        !person.revoked_at &&
        (!person.status ||
          normalize(person.status) === "active" ||
          normalize(person.status) === "approved")
    );

    const result: ReadinessCriterion[] = [
      buildLegalDocumentCriterion({
        key: "rc",
        title: "RC",
        weight: 25,
        document: rc,
        expiryRequired: false,
      }),
      buildLegalDocumentCriterion({
        key: "insurance",
        title: "Insurance",
        weight: 25,
        document: insurance,
        expiryRequired: true,
      }),
      buildLegalDocumentCriterion({
        key: "puc",
        title: "PUC",
        weight: 20,
        document: puc,
        expiryRequired: true,
      }),
    ];

    result.push(
      latestService
        ? {
            key: "service",
            title: "Service History",
            description: `Latest service record: ${
              latestService.service_type || "Vehicle service"
            }${
              latestService.workshop_name
                ? ` at ${latestService.workshop_name}`
                : ""
            }.`,
            weight: 15,
            earned: 15,
            state: "complete",
            value: formatDate(latestService.service_date),
            actionLabel: "View Service History",
            actionPath: "/service-history",
            icon: Wrench,
          }
        : {
            key: "service",
            title: "Service History",
            description:
              "No service record is available. Add records to keep maintenance history organised.",
            weight: 15,
            earned: 0,
            state: "missing",
            value: "No record added",
            actionLabel: "Add Service Record",
            actionPath: "/service-history",
            icon: History,
          }
    );

    result.push(
      documents.length > 0
        ? {
            key: "vault",
            title: "Secure Document Backup",
            description: `${documents.length} vehicle document${
              documents.length === 1 ? " is" : "s are"
            } securely stored in your vault.`,
            weight: 10,
            earned: 10,
            state: "complete",
            value: `${documents.length} document${
              documents.length === 1 ? "" : "s"
            } backed up`,
            actionLabel: "Open Document Vault",
            actionPath: "/documents",
            icon: Vault,
          }
        : {
            key: "vault",
            title: "Secure Document Backup",
            description:
              "Your important vehicle documents have not been backed up yet.",
            weight: 10,
            earned: 0,
            state: "missing",
            value: "No backup",
            actionLabel: "Upload Documents",
            actionPath: "/documents/upload",
            icon: Vault,
          }
    );

    result.push(
      activeTrustedPeople.length > 0
        ? {
            key: "trusted",
            title: "Trusted Access",
            description: `${activeTrustedPeople.length} trusted person${
              activeTrustedPeople.length === 1 ? " has" : "s have"
            } active access for this vehicle.`,
            weight: 5,
            earned: 5,
            state: "complete",
            value: `${activeTrustedPeople.length} active`,
            actionLabel: "Manage Trusted People",
            actionPath: "/documents/trusted-people",
            icon: UserRoundCheck,
          }
        : {
            key: "trusted",
            title: "Trusted Access",
            description:
              "No trusted person has been configured for this vehicle.",
            weight: 5,
            earned: 0,
            state: "missing",
            value: "Not configured",
            actionLabel: "Add Trusted Person",
            actionPath: "/documents/trusted-people",
            icon: UserRoundCheck,
          }
    );

    return result;
  }, [documents, serviceEntries, trustedPeople]);

  const score = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          100,
          criteria.reduce(
            (total, criterion) => total + criterion.earned,
            0
          )
        )
      ),
    [criteria]
  );

  const readiness = useMemo(() => {
    const hasCritical = criteria.some(
      (criterion) => criterion.state === "critical"
    );

    if (hasCritical || score < 60) {
      return {
        title: "Action Required",
        description:
          "One or more important readiness items require immediate action.",
        color: "#fca5a5",
        background: "rgba(220,38,38,0.12)",
        border: "rgba(252,165,165,0.22)",
        icon: CircleAlert,
      };
    }

    if (score < 85) {
      return {
        title: "Attention Needed",
        description:
          "Your vehicle is partly ready. Complete the highlighted items.",
        color: "#fde68a",
        background: "rgba(202,138,4,0.12)",
        border: "rgba(253,230,138,0.22)",
        icon: AlertTriangle,
      };
    }

    return {
      title: "Ready to Drive",
      description:
        "Your available legal and practical readiness records are in good order.",
      color: "#86efac",
      background: "rgba(22,163,74,0.12)",
      border: "rgba(134,239,172,0.22)",
      icon: CheckCircle2,
    };
  }, [criteria, score]);

  const recommendations = useMemo(
    () =>
      criteria
        .filter((criterion) => criterion.state !== "complete")
        .sort((a, b) => {
          const order: Record<CriterionState, number> = {
            critical: 0,
            attention: 1,
            missing: 2,
            complete: 3,
          };
          return order[a.state] - order[b.state];
        }),
    [criteria]
  );

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top, #172554 0%, #071426 42%, #020617 100%)",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Loader2
            size={38}
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p style={{ color: "#94a3b8" }}>
            Mira is checking vehicle readiness...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px 72px",
        background:
          "radial-gradient(circle at top, #172554 0%, #071426 39%, #020617 100%)",
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

        @media (max-width: 720px) {
          .readiness-score-layout {
            grid-template-columns: 1fr !important;
          }

          .readiness-score-ring {
            margin: 0 auto;
          }

          .readiness-card-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ width: "min(1120px, 100%)", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/")}
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
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 12px",
              borderRadius: "11px",
              border: "1px solid rgba(96,165,250,0.2)",
              background: "rgba(37,99,235,0.12)",
              color: "#bfdbfe",
              fontWeight: 850,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw
              size={16}
              style={
                refreshing
                  ? { animation: "spin 1s linear infinite" }
                  : undefined
              }
            />
            Refresh
          </button>
        </div>

        <header style={{ marginTop: "24px" }}>
          <div
            style={{
              color: "#67e8f9",
              fontSize: "12px",
              fontWeight: 950,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Powered by Mira
          </div>

          <h1
            style={{
              margin: "8px 0 7px",
              fontSize: "clamp(31px, 5vw, 48px)",
              letterSpacing: "-0.035em",
            }}
          >
            Vehicle Readiness Score
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: "720px",
              color: "#94a3b8",
              lineHeight: 1.7,
            }}
          >
            A transparent score based only on documents, records and
            safety-access information available in My Vehicle.
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

        {vehicles.length === 0 ? (
          <section
            style={{
              marginTop: "24px",
              padding: "38px 24px",
              borderRadius: "22px",
              background: "rgba(15,23,42,0.86)",
              border: "1px solid rgba(148,163,184,0.14)",
              textAlign: "center",
            }}
          >
            <Car size={44} color="#64748b" />
            <h2 style={{ margin: "15px 0 7px" }}>Add your first vehicle</h2>
            <p style={{ margin: "0 0 18px", color: "#94a3b8" }}>
              Vehicle Readiness will begin after a vehicle is added.
            </p>
            <button
              type="button"
              onClick={() => router.push("/add-vehicle")}
              style={{
                padding: "12px 16px",
                border: 0,
                borderRadius: "12px",
                background: "#2563eb",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Add Vehicle
            </button>
          </section>
        ) : (
          <>
            <section
              style={{
                marginTop: "22px",
                padding: "16px",
                borderRadius: "17px",
                background: "rgba(15,23,42,0.82)",
                border: "1px solid rgba(148,163,184,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "47px",
                    height: "47px",
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(37,99,235,0.14)",
                    color: "#93c5fd",
                  }}
                >
                  <Car size={23} />
                </div>

                <div>
                  <div style={{ fontWeight: 950 }}>
                    {selectedVehicle?.vehicle_name ||
                      [selectedVehicle?.brand, selectedVehicle?.model]
                        .filter(Boolean)
                        .join(" ") ||
                      "My Vehicle"}
                  </div>
                  <div
                    style={{
                      marginTop: "3px",
                      color: "#94a3b8",
                      fontSize: "12px",
                    }}
                  >
                    {selectedVehicle?.vehicle_number || "Number not added"}
                  </div>
                </div>
              </div>

              <div style={{ position: "relative" }}>
                <select
                  value={selectedVehicleId || ""}
                  onChange={(event) =>
                    setSelectedVehicleId(Number(event.target.value))
                  }
                  style={{
                    minWidth: "220px",
                    appearance: "none",
                    padding: "11px 38px 11px 13px",
                    borderRadius: "11px",
                    border: "1px solid rgba(148,163,184,0.18)",
                    background: "#071426",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_number ||
                        vehicle.vehicle_name ||
                        `Vehicle ${vehicle.id}`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#94a3b8",
                  }}
                />
              </div>
            </section>

            <section
              className="readiness-score-layout"
              style={{
                marginTop: "18px",
                padding: "24px",
                borderRadius: "23px",
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(7,20,38,0.94))",
                border: `1px solid ${readiness.border}`,
                display: "grid",
                gridTemplateColumns: "230px 1fr",
                gap: "28px",
                alignItems: "center",
              }}
            >
              <div
                className="readiness-score-ring"
                style={{
                  width: "205px",
                  height: "205px",
                  borderRadius: "50%",
                  padding: "12px",
                  background: `conic-gradient(${readiness.color} ${
                    score * 3.6
                  }deg, rgba(51,65,85,0.48) 0deg)`,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "#071426",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    boxShadow: "inset 0 0 30px rgba(0,0,0,0.3)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "55px",
                        lineHeight: 1,
                        fontWeight: 950,
                        letterSpacing: "-0.06em",
                      }}
                    >
                      {score}
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        color: "#94a3b8",
                        fontSize: "12px",
                        fontWeight: 850,
                      }}
                    >
                      OUT OF 100
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 10px",
                    borderRadius: "999px",
                    background: readiness.background,
                    border: `1px solid ${readiness.border}`,
                    color: readiness.color,
                    fontSize: "12px",
                    fontWeight: 950,
                  }}
                >
                  <readiness.icon size={16} />
                  {readiness.title}
                </div>

                <h2
                  style={{
                    margin: "15px 0 8px",
                    fontSize: "clamp(25px, 4vw, 35px)",
                  }}
                >
                  {readiness.title}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#94a3b8",
                    lineHeight: 1.7,
                  }}
                >
                  {readiness.description}
                </p>

                <div
                  style={{
                    marginTop: "18px",
                    padding: "13px 14px",
                    borderRadius: "14px",
                    background: "rgba(8,47,73,0.2)",
                    border: "1px solid rgba(103,232,249,0.14)",
                    color: "#bae6fd",
                    fontSize: "12px",
                    lineHeight: 1.65,
                  }}
                >
                  <ShieldCheck
                    size={16}
                    style={{
                      verticalAlign: "middle",
                      marginRight: "7px",
                    }}
                  />
                  This is a readiness score—not a mechanical health
                  diagnosis. My Vehicle does not estimate engine, battery,
                  tyre or brake condition without verified telemetry.
                </div>
              </div>
            </section>

            <section style={{ marginTop: "23px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>
                  Readiness Checklist
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Every point in the score is shown clearly below.
                </p>
              </div>

              <div
                className="readiness-card-grid"
                style={{
                  marginTop: "14px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "13px",
                }}
              >
                {criteria.map((criterion) => {
                  const appearance = stateAppearance(criterion.state);
                  const Icon = criterion.icon;

                  return (
                    <article
                      key={criterion.key}
                      style={{
                        padding: "18px",
                        borderRadius: "18px",
                        background: "rgba(15,23,42,0.82)",
                        border: `1px solid ${appearance.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "11px",
                          }}
                        >
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "13px",
                              display: "grid",
                              placeItems: "center",
                              background: appearance.background,
                              color: appearance.color,
                            }}
                          >
                            <Icon size={20} />
                          </div>

                          <div>
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "16px",
                              }}
                            >
                              {criterion.title}
                            </h3>
                            <div
                              style={{
                                marginTop: "4px",
                                color: "#64748b",
                                fontSize: "11px",
                                fontWeight: 850,
                              }}
                            >
                              {criterion.earned}/{criterion.weight} points
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: "6px 8px",
                            borderRadius: "999px",
                            background: appearance.background,
                            color: appearance.color,
                            fontSize: "10px",
                            fontWeight: 950,
                          }}
                        >
                          {appearance.label}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "15px",
                          color: appearance.color,
                          fontSize: "13px",
                          fontWeight: 900,
                        }}
                      >
                        {criterion.value}
                      </div>

                      <p
                        style={{
                          margin: "7px 0 0",
                          minHeight: "42px",
                          color: "#94a3b8",
                          fontSize: "12px",
                          lineHeight: 1.65,
                        }}
                      >
                        {criterion.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => router.push(criterion.actionPath)}
                        style={{
                          marginTop: "13px",
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          color: "#93c5fd",
                          fontSize: "12px",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {criterion.actionLabel} →
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section
              style={{
                marginTop: "22px",
                padding: "21px",
                borderRadius: "20px",
                background:
                  "linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.84))",
                border: "1px solid rgba(167,139,250,0.18)",
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
                    width: "42px",
                    height: "42px",
                    borderRadius: "13px",
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(124,58,237,0.14)",
                    color: "#c4b5fd",
                  }}
                >
                  <Sparkles size={20} />
                </div>

                <div>
                  <h2 style={{ margin: 0, fontSize: "19px" }}>
                    Mira Recommendations
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#94a3b8",
                      fontSize: "12px",
                    }}
                  >
                    Recommendations are generated from your recorded data.
                  </p>
                </div>
              </div>

              <div
                style={{
                  marginTop: "15px",
                  display: "grid",
                  gap: "9px",
                }}
              >
                {recommendations.length === 0 ? (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "13px",
                      background: "rgba(22,163,74,0.1)",
                      border: "1px solid rgba(134,239,172,0.15)",
                      color: "#bbf7d0",
                      display: "flex",
                      gap: "9px",
                      alignItems: "center",
                    }}
                  >
                    <CheckCircle2 size={18} />
                    All recorded readiness items are complete.
                  </div>
                ) : (
                  recommendations.map((item) => {
                    const appearance = stateAppearance(item.state);

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => router.push(item.actionPath)}
                        style={{
                          width: "100%",
                          padding: "13px 14px",
                          borderRadius: "13px",
                          border: `1px solid ${appearance.border}`,
                          background: appearance.background,
                          color: "#e2e8f0",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "9px",
                            lineHeight: 1.5,
                          }}
                        >
                          {item.state === "critical" ? (
                            <CircleAlert
                              size={17}
                              color={appearance.color}
                            />
                          ) : item.state === "attention" ? (
                            <Clock3
                              size={17}
                              color={appearance.color}
                            />
                          ) : (
                            <FileText
                              size={17}
                              color={appearance.color}
                            />
                          )}
                          {item.description}
                        </span>

                        <span
                          style={{
                            flexShrink: 0,
                            color: appearance.color,
                            fontSize: "11px",
                            fontWeight: 950,
                          }}
                        >
                          {item.actionLabel} →
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}