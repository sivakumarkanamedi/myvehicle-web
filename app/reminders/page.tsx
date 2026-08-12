"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Bed,
} from "lucide-react";
import { supabase } from "../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  brand: string | null;
  model: string | null;
};

type VehicleDocument = {
  id: number;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  expiry_date: string | null;
  verified: boolean | null;
};

type ServiceEntry = {
  id: number;
  vehicle_id: number;
  service_date: string;
  service_type: string;
  workshop_name: string | null;
  next_service_date: string | null;
  next_service_km: number | null;
};

type ReminderRow = {
  id: number;
  user_id: string;
  vehicle_id: number | null;
  title: string;
  description: string | null;
  reminder_type:
    | "custom"
    | "insurance"
    | "puc"
    | "service"
    | "rc"
    | "driving_licence"
    | "fastag"
    | "challan";
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string;
  snoozed_until: string | null;
  completed_at: string | null;
  related_document_id: number | null;
  created_at: string;
};

type ReminderItem = {
  id: string;
  source: "automatic" | "custom";
  databaseId?: number;
  vehicleId: number | null;
  title: string;
  description: string;
  reminderType: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string;
  snoozedUntil: string | null;
  completedAt: string | null;
  actionPath?: string;
};

type FilterValue = "all" | "due" | "upcoming" | "snoozed" | "completed";

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function formatDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDaysUntil(value: string) {
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

  return Math.ceil((target - today) / 86_400_000);
}

function reminderStatus(item: ReminderItem) {
  if (item.completedAt) return "completed";

  if (
    item.snoozedUntil &&
    new Date(item.snoozedUntil).getTime() > Date.now()
  ) {
    return "snoozed";
  }

  const due = new Date(item.dueAt).getTime();
  if (due <= Date.now()) return "due";

  const days = getDaysUntil(item.dueAt);
  if (days <= 30) return "upcoming";

  return "future";
}

function reminderAppearance(item: ReminderItem) {
  const status = reminderStatus(item);

  if (status === "completed") {
    return {
      label: "Completed",
      color: "#86efac",
      background: "rgba(22,163,74,0.12)",
      border: "rgba(134,239,172,0.19)",
      icon: CheckCircle2,
    };
  }

  if (status === "snoozed") {
    return {
      label: "Snoozed",
      color: "#c4b5fd",
      background: "rgba(124,58,237,0.12)",
      border: "rgba(196,181,253,0.19)",
      icon: Bed
    };
  }

  if (status === "due") {
    return {
      label: "Due Now",
      color: "#fca5a5",
      background: "rgba(220,38,38,0.12)",
      border: "rgba(252,165,165,0.19)",
      icon: CircleAlert,
    };
  }

  if (status === "upcoming") {
    return {
      label: "Upcoming",
      color: "#fde68a",
      background: "rgba(202,138,4,0.12)",
      border: "rgba(253,230,138,0.19)",
      icon: Clock3,
    };
  }

  return {
    label: "Scheduled",
    color: "#93c5fd",
    background: "rgba(37,99,235,0.12)",
    border: "rgba(147,197,253,0.19)",
    icon: CalendarClock,
  };
}

function reminderIcon(type: string) {
  const normalized = normalize(type);

  if (normalized.includes("service")) return Wrench;
  if (
    normalized.includes("insurance") ||
    normalized.includes("puc") ||
    normalized.includes("rc") ||
    normalized.includes("licence") ||
    normalized.includes("license")
  ) {
    return FileText;
  }

  return Bell;
}

function automaticReminderFromDocument(
  document: VehicleDocument
): ReminderItem | null {
  if (!document.expiry_date) return null;

  const label =
    document.document_type ||
    document.document_name ||
    "Vehicle document";

  const normalized = normalize(label);
  let reminderType = "custom";
  let title = `${label} expiry reminder`;

  if (normalized.includes("insurance")) {
    reminderType = "insurance";
    title = "Insurance renewal";
  } else if (
    normalized.includes("puc") ||
    normalized.includes("pollution")
  ) {
    reminderType = "puc";
    title = "PUC renewal";
  } else if (
    normalized === "rc" ||
    normalized.includes("registration certificate")
  ) {
    reminderType = "rc";
    title = "RC validity reminder";
  } else if (
    normalized.includes("driving licence") ||
    normalized.includes("driving license") ||
    normalized === "dl"
  ) {
    reminderType = "driving_licence";
    title = "Driving Licence renewal";
  }

  const days = getDaysUntil(document.expiry_date);

  return {
    id: `document-${document.id}`,
    source: "automatic",
    vehicleId: document.vehicle_id,
    title,
    description:
      days < 0
        ? `${label} expired on ${formatDate(document.expiry_date)}.`
        : `${label} expires on ${formatDate(document.expiry_date)}.`,
    reminderType,
    priority:
      days < 0
        ? "urgent"
        : days <= 7
          ? "high"
          : days <= 30
            ? "medium"
            : "low",
    dueAt: document.expiry_date,
    snoozedUntil: null,
    completedAt: null,
    actionPath: `/documents/${document.id}`,
  };
}

function automaticReminderFromService(
  service: ServiceEntry
): ReminderItem | null {
  if (!service.next_service_date) return null;

  const days = getDaysUntil(service.next_service_date);
  const kmText =
    service.next_service_km !== null
      ? ` or at ${service.next_service_km.toLocaleString("en-IN")} km`
      : "";

  return {
    id: `service-${service.id}`,
    source: "automatic",
    vehicleId: service.vehicle_id,
    title: "Next service due",
    description:
      days < 0
        ? `Next service was due on ${formatDate(
            service.next_service_date
          )}${kmText}.`
        : `Next service is due on ${formatDate(
            service.next_service_date
          )}${kmText}.`,
    reminderType: "service",
    priority:
      days < 0
        ? "urgent"
        : days <= 7
          ? "high"
          : days <= 30
            ? "medium"
            : "low",
    dueAt: service.next_service_date,
    snoozedUntil: null,
    completedAt: null,
    actionPath: "/service-booking",
  };
}

export default function ReminderCenterPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [customReminders, setCustomReminders] = useState<ReminderRow[]>([]);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    reminderType: "custom",
    priority: "medium",
    dueDate: "",
    dueTime: "09:00",
  });

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

        const { data: vehicleData, error: vehicleError } = await supabase
          .from("vehicles")
          .select(
            "id, vehicle_name, vehicle_number, brand, model"
          )
          .eq("user_id", user.id)
          .order("id", { ascending: false });

        if (vehicleError) throw vehicleError;

        const availableVehicles = (vehicleData || []) as Vehicle[];
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
          setCustomReminders([]);
          return;
        }

        const [documentResult, serviceResult, reminderResult] =
          await Promise.all([
            supabase
              .from("vehicle_documents")
              .select(
                "id, vehicle_id, document_type, document_name, expiry_date, verified"
              )
              .eq("user_id", user.id)
              .eq("vehicle_id", activeVehicleId),

            supabase
              .from("service_entries")
              .select(
                "id, vehicle_id, service_date, service_type, workshop_name, next_service_date, next_service_km"
              )
              .eq("user_id", user.id)
              .eq("vehicle_id", activeVehicleId)
              .not("next_service_date", "is", null)
              .order("service_date", { ascending: false }),

            supabase
              .from("vehicle_reminders")
              .select(
                "id, user_id, vehicle_id, title, description, reminder_type, priority, due_at, snoozed_until, completed_at, related_document_id, created_at"
              )
              .eq("user_id", user.id)
              .eq("vehicle_id", activeVehicleId)
              .order("due_at", { ascending: true }),
          ]);

        if (documentResult.error) throw documentResult.error;
        if (serviceResult.error) throw serviceResult.error;
        if (reminderResult.error) throw reminderResult.error;

        setDocuments(
          (documentResult.data || []) as VehicleDocument[]
        );

        setServiceEntries(
          (serviceResult.data || []) as ServiceEntry[]
        );

        setCustomReminders(
          (reminderResult.data || []) as ReminderRow[]
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load reminders."
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

  const reminders = useMemo<ReminderItem[]>(() => {
    const documentAutomatic = documents
      .map(automaticReminderFromDocument)
      .filter((item): item is ReminderItem => Boolean(item));

    const serviceAutomatic = serviceEntries
      .map(automaticReminderFromService)
      .filter((item): item is ReminderItem => Boolean(item));

    const custom = customReminders.map<ReminderItem>((reminder) => ({
      id: `custom-${reminder.id}`,
      source: "custom",
      databaseId: reminder.id,
      vehicleId: reminder.vehicle_id,
      title: reminder.title,
      description:
        reminder.description || "Custom vehicle reminder.",
      reminderType: reminder.reminder_type,
      priority: reminder.priority,
      dueAt: reminder.due_at,
      snoozedUntil: reminder.snoozed_until,
      completedAt: reminder.completed_at,
    }));

    return [...documentAutomatic, ...serviceAutomatic, ...custom].sort(
      (a, b) => {
        if (a.completedAt && !b.completedAt) return 1;
        if (!a.completedAt && b.completedAt) return -1;

        return (
          new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        );
      }
    );
  }, [customReminders, documents, serviceEntries]);

  const visibleReminders = useMemo(() => {
    const query = normalize(search);

    return reminders.filter((item) => {
      const status = reminderStatus(item);

      const statusMatches =
        filter === "all" ||
        (filter === "due" && status === "due") ||
        (filter === "upcoming" &&
          (status === "upcoming" || status === "future")) ||
        (filter === "snoozed" && status === "snoozed") ||
        (filter === "completed" && status === "completed");

      const searchMatches =
        !query ||
        normalize(
          `${item.title} ${item.description} ${item.reminderType}`
        ).includes(query);

      return statusMatches && searchMatches;
    });
  }, [filter, reminders, search]);

  const summary = useMemo(() => {
    return {
      due: reminders.filter(
        (item) => reminderStatus(item) === "due"
      ).length,
      upcoming: reminders.filter(
        (item) =>
          reminderStatus(item) === "upcoming" ||
          reminderStatus(item) === "future"
      ).length,
      snoozed: reminders.filter(
        (item) => reminderStatus(item) === "snoozed"
      ).length,
      completed: reminders.filter(
        (item) => reminderStatus(item) === "completed"
      ).length,
    };
  }, [reminders]);

  async function createReminder() {
    if (!selectedVehicleId || saving) return;

    if (!form.title.trim() || !form.dueDate) {
      setError("Reminder title and due date are required.");
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
        throw new Error("Your session has expired.");
      }

      const dueAt = new Date(
        `${form.dueDate}T${form.dueTime || "09:00"}`
      );

      if (Number.isNaN(dueAt.getTime())) {
        throw new Error("Please enter a valid reminder date and time.");
      }

      const { error: insertError } = await supabase
        .from("vehicle_reminders")
        .insert({
          user_id: user.id,
          vehicle_id: selectedVehicleId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          reminder_type: form.reminderType,
          priority: form.priority,
          due_at: dueAt.toISOString(),
        });

      if (insertError) throw insertError;

      setForm({
        title: "",
        description: "",
        reminderType: "custom",
        priority: "medium",
        dueDate: "",
        dueTime: "09:00",
      });
      setShowCreateModal(false);
      await loadData(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create reminder."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateReminder(
    reminderId: number,
    changes: Record<string, unknown>
  ) {
    if (workingId !== null) return;

    setWorkingId(reminderId);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("vehicle_reminders")
        .update(changes)
        .eq("id", reminderId);

      if (updateError) throw updateError;
      await loadData(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update reminder."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteReminder(reminderId: number) {
    const confirmed = window.confirm(
      "Delete this reminder permanently?"
    );

    if (!confirmed || workingId !== null) return;

    setWorkingId(reminderId);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("vehicle_reminders")
        .delete()
        .eq("id", reminderId);

      if (deleteError) throw deleteError;
      await loadData(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete reminder."
      );
    } finally {
      setWorkingId(null);
    }
  }

  function snoozeUntil(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }

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
            Mira is organising your reminders...
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
        input,
        select,
        textarea {
          font: inherit;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .reminder-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .reminder-toolbar {
            grid-template-columns: 1fr !important;
          }

          .reminder-card-actions {
            width: 100%;
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

          <div
            style={{
              display: "flex",
              gap: "9px",
              flexWrap: "wrap",
            }}
          >
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

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "11px",
                border: 0,
                background: "#2563eb",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              <Plus size={17} />
              Add Reminder
            </button>
          </div>
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
            Proactive Mira Alerts
          </div>

          <h1
            style={{
              margin: "8px 0 7px",
              fontSize: "clamp(31px, 5vw, 48px)",
              letterSpacing: "-0.035em",
            }}
          >
            Smart Reminder Center
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: "760px",
              color: "#94a3b8",
              lineHeight: 1.7,
            }}
          >
            Automatic service-due and document-expiry alerts, plus personal
            vehicle tasks in one organised place.
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
            <Bell size={44} color="#64748b" />
            <h2 style={{ margin: "15px 0 7px" }}>
              Add your first vehicle
            </h2>
            <p style={{ margin: "0 0 18px", color: "#94a3b8" }}>
              Reminders will begin after a vehicle is added.
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
              className="reminder-summary-grid"
              style={{
                marginTop: "16px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <SummaryCard
                icon={CircleAlert}
                label="Due Now"
                value={summary.due}
              />
              <SummaryCard
                icon={Clock3}
                label="Upcoming"
                value={summary.upcoming}
              />
              <SummaryCard
                icon={Bed}
                label="Snoozed"
                value={summary.snoozed}
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Completed"
                value={summary.completed}
              />
            </section>

            <section
              className="reminder-toolbar"
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "1fr 220px",
                gap: "12px",
              }}
            >
              <label style={{ position: "relative" }}>
                <Search
                  size={17}
                  style={{
                    position: "absolute",
                    left: "13px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reminders..."
                  style={{
                    width: "100%",
                    padding: "12px 13px 12px 42px",
                    borderRadius: "12px",
                    border: "1px solid rgba(148,163,184,0.16)",
                    background: "rgba(15,23,42,0.78)",
                    color: "white",
                    outline: "none",
                  }}
                />
              </label>

              <div style={{ position: "relative" }}>
                <Filter
                  size={16}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                    pointerEvents: "none",
                  }}
                />
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as FilterValue)
                  }
                  style={{
                    width: "100%",
                    appearance: "none",
                    padding: "12px 38px 12px 38px",
                    borderRadius: "12px",
                    border: "1px solid rgba(148,163,184,0.16)",
                    background: "rgba(15,23,42,0.78)",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Reminders</option>
                  <option value="due">Due Now</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="snoozed">Snoozed</option>
                  <option value="completed">Completed</option>
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
              style={{
                marginTop: "19px",
                display: "grid",
                gap: "12px",
              }}
            >
              {visibleReminders.length === 0 ? (
                <div
                  style={{
                    padding: "38px 22px",
                    borderRadius: "20px",
                    background: "rgba(15,23,42,0.82)",
                    border: "1px solid rgba(148,163,184,0.14)",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  <Bell size={39} />
                  <h3
                    style={{
                      margin: "13px 0 7px",
                      color: "#cbd5e1",
                    }}
                  >
                    No matching reminders
                  </h3>
                  <p style={{ margin: 0 }}>
                    Add a custom reminder, set the next service date in
                    Service History, or upload documents with expiry dates.
                  </p>
                </div>
              ) : (
                visibleReminders.map((item) => {
                  const appearance = reminderAppearance(item);
                  const StatusIcon = appearance.icon;
                  const TypeIcon = reminderIcon(item.reminderType);
                  const status = reminderStatus(item);

                  return (
                    <article
                      key={item.id}
                      style={{
                        padding: "18px",
                        borderRadius: "18px",
                        background: "rgba(15,23,42,0.82)",
                        border: `1px solid ${appearance.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "13px",
                          minWidth: 0,
                          flex: "1 1 430px",
                        }}
                      >
                        <div
                          style={{
                            width: "46px",
                            height: "46px",
                            borderRadius: "14px",
                            display: "grid",
                            placeItems: "center",
                            background: appearance.background,
                            color: appearance.color,
                            flexShrink: 0,
                          }}
                        >
                          <TypeIcon size={21} />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "16px",
                              }}
                            >
                              {item.title}
                            </h3>

                            <span
                              style={{
                                padding: "5px 8px",
                                borderRadius: "999px",
                                background: appearance.background,
                                color: appearance.color,
                                fontSize: "9px",
                                fontWeight: 950,
                              }}
                            >
                              {appearance.label}
                            </span>

                            {item.source === "automatic" && (
                              <span
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "999px",
                                  background: "rgba(8,145,178,0.12)",
                                  color: "#67e8f9",
                                  fontSize: "9px",
                                  fontWeight: 950,
                                }}
                              >
                                AUTO
                              </span>
                            )}
                          </div>

                          <p
                            style={{
                              margin: "7px 0 0",
                              color: "#94a3b8",
                              fontSize: "12px",
                              lineHeight: 1.6,
                            }}
                          >
                            {item.description}
                          </p>

                          <div
                            style={{
                              marginTop: "9px",
                              display: "flex",
                              gap: "12px",
                              flexWrap: "wrap",
                              color: "#64748b",
                              fontSize: "11px",
                              fontWeight: 850,
                            }}
                          >
                            <span>
                              Due: {formatDateTime(item.dueAt)}
                            </span>

                            {item.snoozedUntil &&
                              status === "snoozed" && (
                                <span>
                                  Snoozed until{" "}
                                  {formatDateTime(item.snoozedUntil)}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="reminder-card-actions"
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        {item.actionPath && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(item.actionPath!)
                            }
                            style={{
                              padding: "9px 11px",
                              borderRadius: "10px",
                              border:
                                "1px solid rgba(96,165,250,0.2)",
                              background: "rgba(37,99,235,0.12)",
                              color: "#bfdbfe",
                              fontWeight: 850,
                              cursor: "pointer",
                            }}
                          >
                            Open
                          </button>
                        )}

                        {item.source === "custom" &&
                          item.databaseId &&
                          !item.completedAt && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateReminder(item.databaseId!, {
                                    snoozed_until:
                                      snoozeUntil(24),
                                  })
                                }
                                disabled={workingId !== null}
                                style={{
                                  padding: "9px 11px",
                                  borderRadius: "10px",
                                  border:
                                    "1px solid rgba(196,181,253,0.2)",
                                  background:
                                    "rgba(124,58,237,0.12)",
                                  color: "#ddd6fe",
                                  fontWeight: 850,
                                  cursor:
                                    workingId !== null
                                      ? "not-allowed"
                                      : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Bed size={15} />
                                Snooze 1 Day
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateReminder(item.databaseId!, {
                                    completed_at:
                                      new Date().toISOString(),
                                    snoozed_until: null,
                                  })
                                }
                                disabled={workingId !== null}
                                style={{
                                  padding: "9px 11px",
                                  borderRadius: "10px",
                                  border:
                                    "1px solid rgba(134,239,172,0.2)",
                                  background: "rgba(22,163,74,0.12)",
                                  color: "#bbf7d0",
                                  fontWeight: 850,
                                  cursor:
                                    workingId !== null
                                      ? "not-allowed"
                                      : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Check size={15} />
                                Complete
                              </button>
                            </>
                          )}

                        {item.source === "custom" &&
                          item.databaseId &&
                          item.completedAt && (
                            <button
                              type="button"
                              onClick={() =>
                                updateReminder(item.databaseId!, {
                                  completed_at: null,
                                })
                              }
                              disabled={workingId !== null}
                              style={{
                                padding: "9px 11px",
                                borderRadius: "10px",
                                border:
                                  "1px solid rgba(147,197,253,0.2)",
                                background: "rgba(37,99,235,0.12)",
                                color: "#bfdbfe",
                                fontWeight: 850,
                                cursor:
                                  workingId !== null
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              Restore
                            </button>
                          )}

                        {item.source === "custom" &&
                          item.databaseId && (
                            <button
                              type="button"
                              onClick={() =>
                                deleteReminder(item.databaseId!)
                              }
                              disabled={workingId !== null}
                              style={{
                                padding: "9px 10px",
                                borderRadius: "10px",
                                border:
                                  "1px solid rgba(248,113,113,0.2)",
                                background: "rgba(127,29,29,0.13)",
                                color: "#fca5a5",
                                cursor:
                                  workingId !== null
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                              aria-label="Delete reminder"
                            >
                              {workingId === item.databaseId ? (
                                <Loader2
                                  size={16}
                                  style={{
                                    animation:
                                      "spin 1s linear infinite",
                                  }}
                                />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          )}
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <section
              style={{
                marginTop: "18px",
                padding: "17px",
                borderRadius: "18px",
                background:
                  "linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.84))",
                border: "1px solid rgba(167,139,250,0.18)",
                display: "flex",
                gap: "11px",
                alignItems: "flex-start",
              }}
            >
              <Sparkles size={20} color="#c4b5fd" />
              <div>
                <div style={{ fontWeight: 950 }}>
                  Mira Recommendation
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    color: "#cbd5e1",
                    fontSize: "12px",
                    lineHeight: 1.65,
                  }}
                >
                  {summary.due > 0
                    ? `You have ${summary.due} reminder${
                        summary.due === 1 ? "" : "s"
                      } requiring attention now.`
                    : summary.upcoming > 0
                      ? `You have ${summary.upcoming} upcoming reminder${
                          summary.upcoming === 1 ? "" : "s"
                        }. Everything due today is complete.`
                      : "No immediate action is required. Your recorded reminders are up to date."}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {showCreateModal && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreateModal(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            padding: "20px",
            background: "rgba(2,6,23,0.78)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <section
            style={{
              width: "min(560px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "22px",
              borderRadius: "22px",
              background:
                "linear-gradient(145deg, #0f172a, #071426)",
              border: "1px solid rgba(148,163,184,0.17)",
              boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>
                  Add Custom Reminder
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  Create a personal task for this vehicle.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "11px",
                  border: "1px solid rgba(148,163,184,0.16)",
                  background: "rgba(15,23,42,0.8)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
              <Field label="Reminder title">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Example: Replace wiper blades"
                  style={inputStyle}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Optional notes"
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                />
              </Field>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                <Field label="Reminder type">
                  <select
                    value={form.reminderType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reminderType: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="custom">Custom</option>
                    <option value="service">Service</option>
                    <option value="insurance">Insurance</option>
                    <option value="puc">PUC</option>
                    <option value="rc">RC</option>
                    <option value="driving_licence">
                      Driving Licence
                    </option>
                    <option value="fastag">FASTag</option>
                    <option value="challan">Challan</option>
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                <Field label="Due date">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Due time">
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueTime: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={createReminder}
                disabled={saving}
                style={{
                  marginTop: "4px",
                  width: "100%",
                  padding: "13px 15px",
                  border: 0,
                  borderRadius: "12px",
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 950,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {saving ? (
                  <Loader2
                    size={18}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Bell size={18} />
                )}
                {saving ? "Saving Reminder..." : "Create Reminder"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.17)",
  background: "#071426",
  color: "white",
  outline: "none",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span
        style={{
          display: "block",
          marginBottom: "7px",
          color: "#cbd5e1",
          fontSize: "12px",
          fontWeight: 850,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bell;
  label: string;
  value: number;
}) {
  return (
    <article
      style={{
        padding: "16px",
        borderRadius: "16px",
        background: "rgba(15,23,42,0.82)",
        border: "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <Icon size={19} color="#93c5fd" />
      <div
        style={{
          marginTop: "12px",
          color: "#94a3b8",
          fontSize: "11px",
          fontWeight: 850,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "5px",
          fontSize: "26px",
          fontWeight: 950,
        }}
      >
        {value}
      </div>
    </article>
  );
}