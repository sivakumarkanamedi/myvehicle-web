"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Car,
  ChevronDown,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { supabase } from "../../supabase";

type Vehicle = {
  id: number;
  user_id: string;
  vehicle_name: string | null;
  vehicle_number: string | null;
  brand: string | null;
  model: string | null;
  created_at: string | null;
  purchase_date?: string | null;
};

type DocumentRow = {
  id: number;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  created_at: string | null;
  expiry_date: string | null;
};

type ServiceRow = {
  id: number;
  vehicle_id: number | null;
  service_date: string | null;
  service_type: string | null;
  workshop_name: string | null;
  created_at?: string | null;
};

type TimelineCategory =
  | "vehicle"
  | "service"
  | "insurance"
  | "puc"
  | "rc"
  | "workshop";

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: TimelineCategory;
  icon: typeof Car;
  actionPath?: string;
};

function validDate(
  value: string | null | undefined
) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function formatDay(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function relativeLabel(value: string) {
  const date = new Date(value);
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();

  const difference = Math.round(
    (today - target) /
      86_400_000
  );

  if (difference === 0) {
    return "Today";
  }

  if (difference === 1) {
    return "Yesterday";
  }

  if (
    difference > 1 &&
    difference < 7
  ) {
    return `${difference} days ago`;
  }

  return formatDay(value);
}

function normalise(
  value: string | null | undefined
) {
  return (value || "")
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function categoryAppearance(
  category: TimelineCategory
) {
  if (category === "vehicle") {
    return {
      color: "#93c5fd",
      background:
        "rgba(37,99,235,0.14)",
      border:
        "rgba(147,197,253,0.18)",
      label: "Vehicle",
    };
  }

  if (
    category === "service" ||
    category === "workshop"
  ) {
    return {
      color: "#fde68a",
      background:
        "rgba(202,138,4,0.12)",
      border:
        "rgba(253,230,138,0.18)",
      label:
        category === "service"
          ? "Service"
          : "Workshop",
    };
  }

  if (
    category === "insurance"
  ) {
    return {
      color: "#86efac",
      background:
        "rgba(22,163,74,0.12)",
      border:
        "rgba(134,239,172,0.18)",
      label: "Insurance",
    };
  }

  if (category === "puc") {
    return {
      color: "#67e8f9",
      background:
        "rgba(8,145,178,0.13)",
      border:
        "rgba(103,232,249,0.18)",
      label: "PUC",
    };
  }

  return {
    color: "#c4b5fd",
    background:
      "rgba(124,58,237,0.13)",
    border:
      "rgba(196,181,253,0.18)",
    label: "RC",
  };
}

function classifyDocument(
  document: DocumentRow
):
  | "insurance"
  | "puc"
  | "rc"
  | null {
  const value = normalise(
    `${document.document_type || ""} ${
      document.document_name || ""
    }`
  );

  if (
    value.includes("insurance")
  ) {
    return "insurance";
  }

  if (
    value.includes("puc") ||
    value.includes("pollution")
  ) {
    return "puc";
  }

  if (
    value === "rc" ||
    value.includes(
      "registration certificate"
    ) ||
    value.includes(
      "vehicle registration"
    )
  ) {
    return "rc";
  }

  return null;
}

export default function VehicleTimelinePage() {
  const router = useRouter();

  const [
    vehicles,
    setVehicles,
  ] = useState<Vehicle[]>([]);

  const [
    selectedVehicleId,
    setSelectedVehicleId,
  ] = useState<number | null>(
    null
  );

  const [
    documents,
    setDocuments,
  ] = useState<DocumentRow[]>([]);

  const [
    services,
    setServices,
  ] = useState<ServiceRow[]>([]);

  const [search, setSearch] =
    useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState<
    "all" | TimelineCategory
  >("all");

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const loadTimeline =
    useCallback(
      async (
        showRefresh = false
      ) => {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const {
            data: { user },
            error:
              userError,
          } =
            await supabase.auth.getUser();

          if (
            userError ||
            !user
          ) {
            router.replace(
              "/login"
            );
            return;
          }

          const {
            data:
              vehicleData,
            error:
              vehicleError,
          } = await supabase
            .from("vehicles")
            .select(
              "id, user_id, vehicle_name, vehicle_number, brand, model, created_at, purchase_date"
            )
            .eq(
              "user_id",
              user.id
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            );

          if (vehicleError) {
            throw vehicleError;
          }

          const availableVehicles =
            (vehicleData ||
              []) as Vehicle[];

          setVehicles(
            availableVehicles
          );

          const activeVehicleId =
            selectedVehicleId &&
            availableVehicles.some(
              (vehicle) =>
                vehicle.id ===
                selectedVehicleId
            )
              ? selectedVehicleId
              : availableVehicles[0]
                  ?.id || null;

          setSelectedVehicleId(
            activeVehicleId
          );

          if (!activeVehicleId) {
            setDocuments([]);
            setServices([]);
            return;
          }

          const [
            documentResult,
            serviceResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "vehicle_documents"
                )
                .select(
                  "id, vehicle_id, document_type, document_name, created_at, expiry_date"
                )
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "vehicle_id",
                  activeVehicleId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  "service_entries"
                )
                .select(
                  "id, vehicle_id, service_date, service_type, workshop_name, created_at"
                )
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "vehicle_id",
                  activeVehicleId
                )
                .order(
                  "service_date",
                  {
                    ascending:
                      false,
                  }
                ),
            ]);

          if (
            documentResult.error
          ) {
            throw documentResult.error;
          }

          if (
            serviceResult.error
          ) {
            throw serviceResult.error;
          }

          setDocuments(
            (documentResult.data ||
              []) as DocumentRow[]
          );

          setServices(
            (serviceResult.data ||
              []) as ServiceRow[]
          );
        } catch (
          caughtError
        ) {
          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load vehicle timeline."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        router,
        selectedVehicleId,
      ]
    );

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const selectedVehicle =
    useMemo(
      () =>
        vehicles.find(
          (vehicle) =>
            vehicle.id ===
            selectedVehicleId
        ) || null,
      [
        selectedVehicleId,
        vehicles,
      ]
    );

  const timelineItems =
    useMemo<TimelineItem[]>(
      () => {
        if (!selectedVehicle) {
          return [];
        }

        const items: TimelineItem[] =
          [];

        const vehicleCreatedAt =
          validDate(
            selectedVehicle.created_at
          );

        if (vehicleCreatedAt) {
          items.push({
            id: `vehicle-${selectedVehicle.id}`,
            title:
              "Vehicle added",
            description: `${
              selectedVehicle.vehicle_number ||
              selectedVehicle.vehicle_name ||
              "This vehicle"
            } was added to My Vehicle.`,
            date: vehicleCreatedAt.toISOString(),
            category:
              "vehicle",
            icon: Car,
            actionPath: `/vehicle/${selectedVehicle.id}`,
          });
        }

        for (const service of services) {
          const serviceDate =
            validDate(
              service.service_date
            ) ||
            validDate(
              service.created_at
            );

          if (!serviceDate) {
            continue;
          }

          const hasWorkshop =
            Boolean(
              service.workshop_name
            );

          items.push({
            id: `service-${service.id}`,
            title:
              service.service_type ||
              (hasWorkshop
                ? "Workshop visit"
                : "Service completed"),
            description:
              hasWorkshop
                ? `Service was recorded at ${service.workshop_name}.`
                : "A service entry was added to the vehicle history.",
            date: serviceDate.toISOString(),
            category:
              hasWorkshop
                ? "workshop"
                : "service",
            icon: Wrench,
            actionPath:
              "/service-history",
          });
        }

        for (const document of documents) {
          const documentType =
            classifyDocument(
              document
            );

          if (!documentType) {
            continue;
          }

          const createdAt =
            validDate(
              document.created_at
            );

          if (!createdAt) {
            continue;
          }

          const title =
            documentType ===
            "insurance"
              ? "Insurance updated"
              : documentType ===
                  "puc"
                ? "PUC updated"
                : "RC updated";

          const label =
            document.document_name ||
            document.document_type ||
            title;

          items.push({
            id: `document-${document.id}`,
            title,
            description: `${label} was added to Document Wallet.`,
            date: createdAt.toISOString(),
            category:
              documentType,
            icon: FileText,
            actionPath: `/documents/${document.id}`,
          });
        }

        return items.sort(
          (first, second) =>
            new Date(
              second.date
            ).getTime() -
            new Date(
              first.date
            ).getTime()
        );
      },
      [
        documents,
        selectedVehicle,
        services,
      ]
    );

  const visibleItems =
    useMemo(() => {
      const query =
        normalise(search);

      return timelineItems.filter(
        (item) => {
          const categoryMatches =
            categoryFilter ===
              "all" ||
            item.category ===
              categoryFilter;

          const searchMatches =
            !query ||
            normalise(
              `${item.title} ${item.description} ${item.category}`
            ).includes(query);

          return (
            categoryMatches &&
            searchMatches
          );
        }
      );
    }, [
      categoryFilter,
      search,
      timelineItems,
    ]);

  const groupedItems =
    useMemo(() => {
      const groups = new Map<
        string,
        TimelineItem[]
      >();

      for (const item of visibleItems) {
        const key =
          relativeLabel(
            item.date
          );

        const current =
          groups.get(key) ||
          [];

        current.push(item);
        groups.set(
          key,
          current
        );
      }

      return Array.from(
        groups.entries()
      );
    }, [visibleItems]);

  const summary = useMemo(
    () => ({
      total:
        timelineItems.length,
      services:
        timelineItems.filter(
          (item) =>
            item.category ===
              "service" ||
            item.category ===
              "workshop"
        ).length,
      insurance:
        timelineItems.filter(
          (item) =>
            item.category ===
            "insurance"
        ).length,
      compliance:
        timelineItems.filter(
          (item) =>
            item.category ===
              "puc" ||
            item.category ===
              "rc"
        ).length,
    }),
    [timelineItems]
  );

  if (loading) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          display: "grid",
          placeItems:
            "center",
          background:
            "radial-gradient(circle at top, #172554 0%, #071426 42%, #020617 100%)",
          color: "white",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <Loader2
            size={38}
            style={{
              animation:
                "spin 1s linear infinite",
            }}
          />

          <p
            style={{
              color:
                "#94a3b8",
            }}
          >
            Mira is building your vehicle timeline...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding:
          "28px 18px 72px",
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
        input,
        select {
          font: inherit;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .timeline-summary-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            ) !important;
          }

          .timeline-toolbar {
            grid-template-columns: 1fr !important;
          }

          .timeline-line {
            left: 20px !important;
          }

          .timeline-item {
            grid-template-columns: 42px 1fr !important;
          }
        }
      `}</style>

      <div
        style={{
          width:
            "min(1120px, 100%)",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: "8px",
              padding:
                "9px 12px",
              borderRadius:
                "11px",
              border:
                "1px solid rgba(148,163,184,0.18)",
              background:
                "rgba(15,23,42,0.62)",
              color:
                "#cbd5e1",
              cursor:
                "pointer",
            }}
          >
            <ArrowLeft
              size={17}
            />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() =>
              void loadTimeline(
                true
              )
            }
            disabled={
              refreshing
            }
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: "8px",
              padding:
                "9px 12px",
              borderRadius:
                "11px",
              border:
                "1px solid rgba(96,165,250,0.2)",
              background:
                "rgba(37,99,235,0.12)",
              color:
                "#bfdbfe",
              fontWeight: 850,
              cursor:
                refreshing
                  ? "not-allowed"
                  : "pointer",
              opacity:
                refreshing
                  ? 0.7
                  : 1,
            }}
          >
            <RefreshCw
              size={16}
              style={
                refreshing
                  ? {
                      animation:
                        "spin 1s linear infinite",
                    }
                  : undefined
              }
            />
            Refresh
          </button>
        </div>

        <header
          style={{
            marginTop:
              "24px",
          }}
        >
          <div
            style={{
              color:
                "#67e8f9",
              fontSize:
                "12px",
              fontWeight: 950,
              letterSpacing:
                "0.14em",
              textTransform:
                "uppercase",
            }}
          >
            Digital Vehicle Diary
          </div>

          <h1
            style={{
              margin:
                "8px 0 7px",
              fontSize:
                "clamp(31px, 5vw, 48px)",
              letterSpacing:
                "-0.035em",
            }}
          >
            Vehicle Timeline
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth:
                "760px",
              color:
                "#94a3b8",
              lineHeight: 1.7,
            }}
          >
            Important vehicle, service, workshop, insurance, PUC and RC events organised in one chronological history.
          </p>
        </header>

        {error && (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px 16px",
              borderRadius:
                "14px",
              background:
                "rgba(127,29,29,0.18)",
              border:
                "1px solid rgba(248,113,113,0.23)",
              color:
                "#fecaca",
              display:
                "flex",
              gap: "9px",
            }}
          >
            <AlertTriangle
              size={18}
            />
            {error}
          </div>
        )}

        {vehicles.length ===
        0 ? (
          <section
            style={{
              marginTop:
                "24px",
              padding:
                "38px 24px",
              borderRadius:
                "22px",
              background:
                "rgba(15,23,42,0.86)",
              border:
                "1px solid rgba(148,163,184,0.14)",
              textAlign:
                "center",
            }}
          >
            <Car
              size={44}
              color="#64748b"
            />

            <h2
              style={{
                margin:
                  "15px 0 7px",
              }}
            >
              No vehicle available
            </h2>

            <p
              style={{
                margin:
                  "0 0 18px",
                color:
                  "#94a3b8",
              }}
            >
              Add a vehicle to begin building its digital timeline.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/add-vehicle"
                )
              }
              style={{
                padding:
                  "12px 16px",
                border: 0,
                borderRadius:
                  "12px",
                background:
                  "#2563eb",
                color:
                  "white",
                fontWeight: 900,
                cursor:
                  "pointer",
              }}
            >
              Add Vehicle
            </button>
          </section>
        ) : (
          <>
            <section
              style={{
                marginTop:
                  "22px",
                padding:
                  "16px",
                borderRadius:
                  "17px",
                background:
                  "rgba(15,23,42,0.82)",
                border:
                  "1px solid rgba(148,163,184,0.14)",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: "14px",
                flexWrap:
                  "wrap",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width:
                      "47px",
                    height:
                      "47px",
                    borderRadius:
                      "14px",
                    display:
                      "grid",
                    placeItems:
                      "center",
                    background:
                      "rgba(37,99,235,0.14)",
                    color:
                      "#93c5fd",
                  }}
                >
                  <Car
                    size={23}
                  />
                </div>

                <div>
                  <div
                    style={{
                      fontWeight:
                        950,
                    }}
                  >
                    {selectedVehicle?.vehicle_name ||
                      [
                        selectedVehicle?.brand,
                        selectedVehicle?.model,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          " "
                        ) ||
                      "My Vehicle"}
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      color:
                        "#94a3b8",
                      fontSize:
                        "12px",
                    }}
                  >
                    {selectedVehicle?.vehicle_number ||
                      "Number not added"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <select
                  value={
                    selectedVehicleId ||
                    ""
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedVehicleId(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  style={{
                    minWidth:
                      "220px",
                    appearance:
                      "none",
                    padding:
                      "11px 38px 11px 13px",
                    borderRadius:
                      "11px",
                    border:
                      "1px solid rgba(148,163,184,0.18)",
                    background:
                      "#071426",
                    color:
                      "white",
                    cursor:
                      "pointer",
                  }}
                >
                  {vehicles.map(
                    (
                      vehicle
                    ) => (
                      <option
                        key={
                          vehicle.id
                        }
                        value={
                          vehicle.id
                        }
                      >
                        {vehicle.vehicle_number ||
                          vehicle.vehicle_name ||
                          `Vehicle ${vehicle.id}`}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                  style={{
                    position:
                      "absolute",
                    right:
                      "12px",
                    top: "50%",
                    transform:
                      "translateY(-50%)",
                    pointerEvents:
                      "none",
                    color:
                      "#94a3b8",
                  }}
                />
              </div>
            </section>

            <section
              className="timeline-summary-grid"
              style={{
                marginTop:
                  "16px",
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <SummaryCard
                icon={History}
                label="Total Events"
                value={
                  summary.total
                }
              />

              <SummaryCard
                icon={Wrench}
                label="Services"
                value={
                  summary.services
                }
              />

              <SummaryCard
                icon={FileText}
                label="Insurance"
                value={
                  summary.insurance
                }
              />

              <SummaryCard
                icon={FileText}
                label="PUC & RC"
                value={
                  summary.compliance
                }
              />
            </section>

            <section
              className="timeline-toolbar"
              style={{
                marginTop:
                  "18px",
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 220px",
                gap: "12px",
              }}
            >
              <label
                style={{
                  position:
                    "relative",
                }}
              >
                <Search
                  size={17}
                  style={{
                    position:
                      "absolute",
                    left: "13px",
                    top: "50%",
                    transform:
                      "translateY(-50%)",
                    color:
                      "#64748b",
                  }}
                />

                <input
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Search timeline..."
                  style={{
                    width:
                      "100%",
                    padding:
                      "12px 13px 12px 42px",
                    borderRadius:
                      "12px",
                    border:
                      "1px solid rgba(148,163,184,0.16)",
                    background:
                      "rgba(15,23,42,0.78)",
                    color:
                      "white",
                    outline:
                      "none",
                  }}
                />
              </label>

              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <select
                  value={
                    categoryFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setCategoryFilter(
                      event
                        .target
                        .value as
                        | "all"
                        | TimelineCategory
                    )
                  }
                  style={{
                    width:
                      "100%",
                    appearance:
                      "none",
                    padding:
                      "12px 38px 12px 13px",
                    borderRadius:
                      "12px",
                    border:
                      "1px solid rgba(148,163,184,0.16)",
                    background:
                      "rgba(15,23,42,0.78)",
                    color:
                      "white",
                    cursor:
                      "pointer",
                  }}
                >
                  <option value="all">
                    All Events
                  </option>

                  <option value="vehicle">
                    Vehicle
                  </option>

                  <option value="service">
                    Service
                  </option>

                  <option value="workshop">
                    Workshop
                  </option>

                  <option value="insurance">
                    Insurance
                  </option>

                  <option value="puc">
                    PUC
                  </option>

                  <option value="rc">
                    RC
                  </option>
                </select>

                <ChevronDown
                  size={16}
                  style={{
                    position:
                      "absolute",
                    right:
                      "12px",
                    top: "50%",
                    transform:
                      "translateY(-50%)",
                    pointerEvents:
                      "none",
                    color:
                      "#94a3b8",
                  }}
                />
              </div>
            </section>

            <section
              style={{
                marginTop:
                  "19px",
                padding:
                  "22px",
                borderRadius:
                  "22px",
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.94), rgba(7,20,38,0.94))",
                border:
                  "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "10px",
                }}
              >
                <CalendarDays
                  size={21}
                  color="#93c5fd"
                />

                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize:
                        "20px",
                    }}
                  >
                    Complete History
                  </h2>

                  <p
                    style={{
                      margin:
                        "4px 0 0",
                      color:
                        "#94a3b8",
                      fontSize:
                        "12px",
                    }}
                  >
                    {visibleItems.length} matching event
                    {visibleItems.length ===
                    1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>

              {groupedItems.length ===
              0 ? (
                <div
                  style={{
                    marginTop:
                      "18px",
                    padding:
                      "34px 20px",
                    borderRadius:
                      "17px",
                    background:
                      "rgba(2,6,23,0.38)",
                    textAlign:
                      "center",
                    color:
                      "#94a3b8",
                  }}
                >
                  <History
                    size={38}
                  />

                  <h3
                    style={{
                      margin:
                        "13px 0 6px",
                      color:
                        "#cbd5e1",
                    }}
                  >
                    No matching timeline events
                  </h3>

                  <p
                    style={{
                      margin: 0,
                    }}
                  >
                    Add service records or update Insurance, PUC or RC to build this vehicle&apos;s history.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    marginTop:
                      "21px",
                    position:
                      "relative",
                  }}
                >
                  <div
                    className="timeline-line"
                    style={{
                      position:
                        "absolute",
                      left:
                        "25px",
                      top: "14px",
                      bottom:
                        "14px",
                      width: "2px",
                      background:
                        "linear-gradient(to bottom, rgba(96,165,250,0.35), rgba(148,163,184,0.05))",
                    }}
                  />

                  {groupedItems.map(
                    ([
                      groupLabel,
                      groupItems,
                    ]) => (
                      <div
                        key={
                          groupLabel
                        }
                        style={{
                          position:
                            "relative",
                          marginBottom:
                            "24px",
                        }}
                      >
                        <div
                          style={{
                            marginLeft:
                              "59px",
                            marginBottom:
                              "10px",
                            color:
                              "#93c5fd",
                            fontSize:
                              "12px",
                            fontWeight:
                              950,
                            letterSpacing:
                              "0.05em",
                          }}
                        >
                          {groupLabel}
                        </div>

                        <div
                          style={{
                            display:
                              "grid",
                            gap: "10px",
                          }}
                        >
                          {groupItems.map(
                            (
                              item
                            ) => {
                              const appearance =
                                categoryAppearance(
                                  item.category
                                );

                              const Icon =
                                item.icon;

                              return (
                                <article
                                  className="timeline-item"
                                  key={
                                    item.id
                                  }
                                  style={{
                                    position:
                                      "relative",
                                    display:
                                      "grid",
                                    gridTemplateColumns:
                                      "52px 1fr",
                                    gap: "12px",
                                    alignItems:
                                      "start",
                                  }}
                                >
                                  <div
                                    style={{
                                      zIndex:
                                        1,
                                      width:
                                        "52px",
                                      height:
                                        "52px",
                                      borderRadius:
                                        "16px",
                                      display:
                                        "grid",
                                      placeItems:
                                        "center",
                                      background:
                                        appearance.background,
                                      border: `1px solid ${appearance.border}`,
                                      color:
                                        appearance.color,
                                      boxShadow:
                                        "0 0 0 5px rgba(7,20,38,0.96)",
                                    }}
                                  >
                                    <Icon
                                      size={
                                        21
                                      }
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      item.actionPath &&
                                      router.push(
                                        item.actionPath
                                      )
                                    }
                                    disabled={
                                      !item.actionPath
                                    }
                                    style={{
                                      width:
                                        "100%",
                                      padding:
                                        "15px 16px",
                                      borderRadius:
                                        "16px",
                                      border: `1px solid ${appearance.border}`,
                                      background:
                                        "rgba(15,23,42,0.76)",
                                      color:
                                        "white",
                                      cursor:
                                        item.actionPath
                                          ? "pointer"
                                          : "default",
                                      textAlign:
                                        "left",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        justifyContent:
                                          "space-between",
                                        alignItems:
                                          "flex-start",
                                        gap: "12px",
                                        flexWrap:
                                          "wrap",
                                      }}
                                    >
                                      <div>
                                        <div
                                          style={{
                                            fontSize:
                                              "14px",
                                            fontWeight:
                                              950,
                                          }}
                                        >
                                          {
                                            item.title
                                          }
                                        </div>

                                        <div
                                          style={{
                                            marginTop:
                                              "6px",
                                            color:
                                              "#94a3b8",
                                            fontSize:
                                              "12px",
                                            lineHeight:
                                              1.6,
                                          }}
                                        >
                                          {
                                            item.description
                                          }
                                        </div>
                                      </div>

                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          alignItems:
                                            "center",
                                          gap: "7px",
                                          flexShrink:
                                            0,
                                        }}
                                      >
                                        <span
                                          style={{
                                            padding:
                                              "5px 8px",
                                            borderRadius:
                                              "999px",
                                            background:
                                              appearance.background,
                                            color:
                                              appearance.color,
                                            fontSize:
                                              "9px",
                                            fontWeight:
                                              950,
                                          }}
                                        >
                                          {
                                            appearance.label
                                          }
                                        </span>

                                        <span
                                          style={{
                                            color:
                                              "#64748b",
                                            fontSize:
                                              "10px",
                                            fontWeight:
                                              850,
                                          }}
                                        >
                                          {formatTime(
                                            item.date
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                </article>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof History;
  label: string;
  value: number;
}) {
  return (
    <article
      style={{
        padding: "16px",
        borderRadius:
          "16px",
        background:
          "rgba(15,23,42,0.82)",
        border:
          "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <Icon
        size={19}
        color="#93c5fd"
      />

      <div
        style={{
          marginTop:
            "12px",
          color:
            "#94a3b8",
          fontSize:
            "11px",
          fontWeight: 850,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          fontSize:
            "26px",
          fontWeight: 950,
        }}
      >
        {value}
      </div>
    </article>
  );
}