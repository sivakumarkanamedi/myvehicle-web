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
  CircleDollarSign,
  FileText,
  Gauge,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  brand: string | null;
  model: string | null;
};

type ServiceEntry = {
  id: number;
  user_id: string;
  vehicle_id: number;
  service_date: string;
  odometer_km: number | null;
  workshop_name: string | null;
  service_type: string;
  category: string;
  cost: number;
  invoice_path: string | null;
  notes: string | null;
  next_service_date: string | null;
  next_service_km: number | null;
  created_at: string;
};

type WorkshopCompletedService = {
  id: string;
  booking_number: string;
  service_name: string;
  workshop_name: string;
  booking_date: string;
  booking_time: string;
  service_mode: "drive-in" | "pickup-drop";
  vehicle_id: number | null;
  booking_status: string;
  job_card_number: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  payment_status: string | null;
  delivered_at: string | null;
};

type ServiceForm = {
  serviceDate: string;
  odometerKm: string;
  workshopName: string;
  serviceType: string;
  category: string;
  cost: string;
  notes: string;
  nextServiceDate: string;
  nextServiceKm: string;
};

const CATEGORY_OPTIONS = [
  ["general_service", "General Service"],
  ["engine_oil", "Engine Oil"],
  ["oil_filter", "Oil Filter"],
  ["air_filter", "Air Filter"],
  ["fuel_filter", "Fuel Filter"],
  ["ac_service", "AC Service"],
  ["coolant", "Coolant"],
  ["brake_pads", "Brake Pads"],
  ["brake_oil", "Brake Oil"],
  ["clutch", "Clutch"],
  ["tyres", "Tyres"],
  ["wheel_alignment", "Wheel Alignment"],
  ["wheel_balancing", "Wheel Balancing"],
  ["suspension", "Suspension"],
  ["battery", "Battery Replacement"],
  ["spark_plugs", "Spark Plugs"],
  ["timing_belt", "Timing Belt"],
  ["transmission_oil", "Transmission Oil"],
  ["body_work", "Body Work"],
  ["custom", "Custom"],
] as const;

function emptyForm(): ServiceForm {
  return {
    serviceDate: new Date().toISOString().slice(0, 10),
    odometerKm: "",
    workshopName: "",
    serviceType: "",
    category: "general_service",
    cost: "",
    notes: "",
    nextServiceDate: "",
    nextServiceKm: "",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function categoryLabel(value: string) {
  return (
    CATEGORY_OPTIONS.find(([key]) => key === value)?.[1] ||
    value.replaceAll("_", " ")
  );
}

export default function ServiceHistoryPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [workshopServices, setWorkshopServices] = useState<
    WorkshopCompletedService[]
  >([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ServiceEntry | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm());

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
          .select("id, vehicle_name, vehicle_number, brand, model")
          .eq("user_id", user.id)
          .order("id", { ascending: false });

        if (vehicleError) throw vehicleError;

        const availableVehicles = (vehicleData || []) as Vehicle[];
        setVehicles(availableVehicles);

        const activeVehicleId =
          selectedVehicleId &&
          availableVehicles.some((vehicle) => vehicle.id === selectedVehicleId)
            ? selectedVehicleId
            : availableVehicles[0]?.id || null;

        setSelectedVehicleId(activeVehicleId);

        if (!activeVehicleId) {
          setEntries([]);
          return;
        }

        const { data: serviceData, error: serviceError } = await supabase
          .from("service_entries")
          .select(
            "id, user_id, vehicle_id, service_date, odometer_km, workshop_name, service_type, category, cost, invoice_path, notes, next_service_date, next_service_km, created_at"
          )
          .eq("user_id", user.id)
          .eq("vehicle_id", activeVehicleId)
          .order("service_date", { ascending: false });

        if (serviceError) throw serviceError;

        setEntries((serviceData || []) as ServiceEntry[]);

        // Automatically load services completed through the new
        // My Vehicle Service Booking + Workshop workflow.
        const { data: completedBookings, error: completedBookingsError } =
          await supabase
            .from("service_bookings")
            .select(
              "id, booking_number, service_name, workshop_name, booking_date, booking_time, service_mode, vehicle_id, booking_status"
            )
            .eq("user_id", user.id)
            .eq("booking_status", "completed")
            .order("booking_date", { ascending: false });

        if (completedBookingsError) throw completedBookingsError;

        const bookingRows = completedBookings || [];
        const bookingIds = bookingRows.map((booking) => booking.id);

        if (bookingIds.length === 0) {
          setWorkshopServices([]);
        } else {
          const [
            { data: jobCards, error: jobCardsError },
            { data: bookingInvoices, error: bookingInvoicesError },
            { data: deliveries, error: deliveriesError },
          ] = await Promise.all([
            supabase
              .from("service_job_cards")
              .select("booking_id, job_card_number")
              .in("booking_id", bookingIds),

            supabase
              .from("service_invoices")
              .select(
                "id, booking_id, invoice_number, total_amount, payment_status, created_at"
              )
              .in("booking_id", bookingIds)
              .order("created_at", { ascending: false }),

            supabase
              .from("service_delivery_records")
              .select("booking_id, invoice_id, delivered_at")
              .in("booking_id", bookingIds),
          ]);

          if (jobCardsError) throw jobCardsError;
          if (bookingInvoicesError) throw bookingInvoicesError;
          if (deliveriesError) throw deliveriesError;

          const deliveryRows = deliveries || [];
          const deliveryInvoiceIds = deliveryRows
            .map((item) => item.invoice_id)
            .filter((id): id is string => Boolean(id));

          let deliveryInvoices: any[] = [];

          if (deliveryInvoiceIds.length > 0) {
            const { data, error } = await supabase
              .from("service_invoices")
              .select(
                "id, booking_id, invoice_number, total_amount, payment_status, created_at"
              )
              .in("id", deliveryInvoiceIds)
              .order("created_at", { ascending: false });

            if (error) throw error;
            deliveryInvoices = data || [];
          }

          const allInvoices = [
            ...(bookingInvoices || []),
            ...deliveryInvoices,
          ];

          const jobCardMap = new Map(
            (jobCards || []).map((item) => [item.booking_id, item])
          );

          const deliveryMap = new Map(
            deliveryRows.map((item) => [item.booking_id, item])
          );

          // Keep the newest invoice for each booking.
          const invoiceByBooking = new Map<string, any>();
          const invoiceById = new Map<string, any>();

          for (const invoice of allInvoices) {
            if (invoice.id && !invoiceById.has(invoice.id)) {
              invoiceById.set(invoice.id, invoice);
            }

            if (
              invoice.booking_id &&
              !invoiceByBooking.has(invoice.booking_id)
            ) {
              invoiceByBooking.set(invoice.booking_id, invoice);
            }
          }

          setWorkshopServices(
            bookingRows.map((booking) => {
              const jobCard = jobCardMap.get(booking.id);
              const delivery = deliveryMap.get(booking.id);

              // First use the invoice linked directly to delivery.
              // If an older record has no delivery invoice link, fall back
              // to the latest invoice carrying the booking_id.
              const invoice =
                (delivery?.invoice_id
                  ? invoiceById.get(delivery.invoice_id)
                  : null) ||
                invoiceByBooking.get(booking.id) ||
                null;

              return {
                ...booking,
                job_card_number: jobCard?.job_card_number || null,
                invoice_id: invoice?.id || delivery?.invoice_id || null,
                invoice_number: invoice?.invoice_number || null,
                total_amount:
                  invoice?.total_amount !== undefined &&
                  invoice?.total_amount !== null
                    ? Number(invoice.total_amount)
                    : null,
                payment_status: invoice?.payment_status || null,
                delivered_at: delivery?.delivered_at || null,
              } as WorkshopCompletedService;
            })
          );
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load service history."
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
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [selectedVehicleId, vehicles]
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => new Date(entry.service_date).getFullYear()))
      ).sort((a, b) => b - a),
    [entries]
  );

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesSearch =
        !query ||
        `${entry.service_type} ${entry.workshop_name || ""} ${entry.notes || ""} ${categoryLabel(
          entry.category
        )}`
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === "all" || entry.category === categoryFilter;

      const matchesYear =
        yearFilter === "all" ||
        String(new Date(entry.service_date).getFullYear()) === yearFilter;

      return matchesSearch && matchesCategory && matchesYear;
    });
  }, [categoryFilter, entries, search, yearFilter]);

  const visibleWorkshopServices = useMemo(() => {
    return workshopServices.filter(
      (service) =>
        service.vehicle_id === null ||
        service.vehicle_id === selectedVehicleId
    );
  }, [selectedVehicleId, workshopServices]);

  const workshopServiceSpend = useMemo(
    () =>
      visibleWorkshopServices.reduce(
        (sum, service) => sum + Number(service.total_amount || 0),
        0
      ),
    [visibleWorkshopServices]
  );

  const analytics = useMemo(() => {
    const totalCost = entries.reduce(
      (sum, entry) => sum + Number(entry.cost || 0),
      0
    );

    const highestExpense =
      entries.length > 0
        ? Math.max(...entries.map((entry) => Number(entry.cost || 0)))
        : 0;

    const latestService = entries[0] || null;

    const nextDates = entries
      .map((entry) => entry.next_service_date)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const nextServiceDate =
      nextDates.find((date) => date.getTime() >= Date.now()) || null;

    const averageCost = entries.length > 0 ? totalCost / entries.length : 0;

    const categoryCounts = new Map<string, number>();
    for (const entry of entries) {
      categoryCounts.set(
        entry.category,
        (categoryCounts.get(entry.category) || 0) + 1
      );
    }

    const mostFrequentCategory =
      Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null;

    return {
      totalCost,
      highestExpense,
      latestService,
      nextServiceDate,
      averageCost,
      mostFrequentCategory,
    };
  }, [entries]);

  function openCreateModal() {
    setEditingEntry(null);
    setInvoiceFile(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEditModal(entry: ServiceEntry) {
    setEditingEntry(entry);
    setInvoiceFile(null);
    setForm({
      serviceDate: entry.service_date,
      odometerKm: entry.odometer_km?.toString() || "",
      workshopName: entry.workshop_name || "",
      serviceType: entry.service_type,
      category: entry.category,
      cost: entry.cost?.toString() || "",
      notes: entry.notes || "",
      nextServiceDate: entry.next_service_date || "",
      nextServiceKm: entry.next_service_km?.toString() || "",
    });
    setShowModal(true);
  }

  async function uploadInvoice(
    userId: string,
    vehicleId: number,
    entryId?: number
  ) {
    if (!invoiceFile) return editingEntry?.invoice_path || null;

    const extension = invoiceFile.name.split(".").pop() || "file";
    const fileName = `${Date.now()}-${entryId || "new"}.${extension}`;
    const filePath = `${userId}/${vehicleId}/service-invoices/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("vehicle-documents")
      .upload(filePath, invoiceFile, {
        upsert: false,
      });

    if (uploadError) throw uploadError;

    return filePath;
  }

  async function saveEntry() {
    if (!selectedVehicleId || saving) return;

    if (!form.serviceDate || !form.serviceType.trim()) {
      setError("Service date and service type are required.");
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

      const invoicePath = await uploadInvoice(
        user.id,
        selectedVehicleId,
        editingEntry?.id
      );

      const payload = {
        user_id: user.id,
        vehicle_id: selectedVehicleId,
        service_date: form.serviceDate,
        odometer_km: form.odometerKm
          ? Number(form.odometerKm)
          : null,
        workshop_name: form.workshopName.trim() || null,
        service_type: form.serviceType.trim(),
        category: form.category,
        cost: form.cost ? Number(form.cost) : 0,
        invoice_path: invoicePath,
        notes: form.notes.trim() || null,
        next_service_date: form.nextServiceDate || null,
        next_service_km: form.nextServiceKm
          ? Number(form.nextServiceKm)
          : null,
      };

      if (editingEntry) {
        const { error: updateError } = await supabase
          .from("service_entries")
          .update(payload)
          .eq("id", editingEntry.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("service_entries")
          .insert(payload);

        if (insertError) throw insertError;
      }

      setShowModal(false);
      setEditingEntry(null);
      setInvoiceFile(null);
      setForm(emptyForm());
      await loadData(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save service record."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: ServiceEntry) {
    const confirmed = window.confirm(
      "Delete this service record permanently?"
    );

    if (!confirmed || workingId !== null) return;

    setWorkingId(entry.id);
    setError("");

    try {
      if (entry.invoice_path) {
        await supabase.storage
          .from("vehicle-documents")
          .remove([entry.invoice_path]);
      }

      const { error: deleteError } = await supabase
        .from("service_entries")
        .delete()
        .eq("id", entry.id);

      if (deleteError) throw deleteError;

      await loadData(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete service record."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function openInvoice(path: string) {
    try {
      const { data, error: signedError } = await supabase.storage
        .from("vehicle-documents")
        .createSignedUrl(path, 300);

      if (signedError || !data?.signedUrl) {
        throw new Error(
          signedError?.message || "Unable to open invoice."
        );
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to open invoice."
      );
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
            Mira is loading service history...
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
          .service-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .service-toolbar {
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
            style={secondaryButtonStyle}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              style={secondaryButtonStyle}
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
        </div>

        <header style={{ marginTop: "24px" }}>
          <div style={eyebrowStyle}>Maintenance Records</div>

          <h1 style={pageTitleStyle}>Service History</h1>

          <p style={pageDescriptionStyle}>
            Complete maintenance records, workshop invoices, service costs
            and future service reminders for every vehicle.
          </p>
        </header>

        {error && (
          <div style={errorStyle}>
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {vehicles.length === 0 ? (
          <section style={emptyStateStyle}>
            <Car size={44} color="#64748b" />
            <h2 style={{ margin: "15px 0 7px" }}>Add your first vehicle</h2>
            <p style={{ margin: "0 0 18px", color: "#94a3b8" }}>
              Service history will begin after a vehicle is added.
            </p>
            <button
              type="button"
              onClick={() => router.push("/add-vehicle")}
              style={primaryButtonStyle}
            >
              Add Vehicle
            </button>
          </section>
        ) : (
          <>
            <section style={vehicleSelectorStyle}>
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

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={openCreateModal}
                  style={primaryButtonStyle}
                >
                  <Plus size={17} />
                  Add Service
                </button>

                <div style={{ position: "relative" }}>
                  <select
                    value={selectedVehicleId || ""}
                    onChange={(event) =>
                      setSelectedVehicleId(Number(event.target.value))
                    }
                    style={selectStyle}
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
                    style={selectArrowStyle}
                  />
                </div>
              </div>
            </section>

            <section
              className="service-summary-grid"
              style={{
                marginTop: "16px",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <SummaryCard
                icon={CalendarClock}
                label="Last Service"
                value={
                  analytics.latestService
                    ? formatDate(analytics.latestService.service_date)
                    : "No record"
                }
              />
              <SummaryCard
                icon={Wrench}
                label="Total Services"
                value={String(entries.length)}
              />
              <SummaryCard
                icon={IndianRupee}
                label="Total Spent"
                value={formatCurrency(analytics.totalCost)}
              />
              <SummaryCard
                icon={CalendarClock}
                label="Next Service"
                value={
                  analytics.nextServiceDate
                    ? formatDate(analytics.nextServiceDate.toISOString())
                    : "Not set"
                }
              />
            </section>

            <section
              style={{
                marginTop: "18px",
                padding: "18px",
                borderRadius: "20px",
                background:
                  "linear-gradient(145deg, rgba(30,41,59,0.82), rgba(15,23,42,0.86))",
                border: "1px solid rgba(96,165,250,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "14px",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ ...eyebrowStyle, color: "#93c5fd" }}>
                    My Vehicle Workshop Services
                  </div>
                  <h2
                    style={{
                      margin: "7px 0 5px",
                      fontSize: "20px",
                    }}
                  >
                    Automatically Completed Services
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: "#94a3b8",
                      fontSize: "12px",
                      lineHeight: 1.6,
                    }}
                  >
                    Services completed through Service Booking are added here
                    automatically with Job Card, invoice and delivery details.
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 13px",
                    borderRadius: "12px",
                    background: "rgba(37,99,235,0.12)",
                    border: "1px solid rgba(147,197,253,0.18)",
                    color: "#bfdbfe",
                    fontSize: "12px",
                    fontWeight: 900,
                  }}
                >
                  {visibleWorkshopServices.length} completed ·{" "}
                  {formatCurrency(workshopServiceSpend)}
                </div>
              </div>

              <div
                style={{
                  marginTop: "14px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                {visibleWorkshopServices.length === 0 ? (
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      background: "rgba(2,6,23,0.3)",
                      border: "1px solid rgba(148,163,184,0.12)",
                      color: "#64748b",
                      fontSize: "12px",
                    }}
                  >
                    No completed Service Booking records yet.
                  </div>
                ) : (
                  visibleWorkshopServices.map((service) => (
                    <article
                      key={service.id}
                      style={{
                        padding: "15px",
                        borderRadius: "16px",
                        background: "rgba(2,6,23,0.3)",
                        border: "1px solid rgba(148,163,184,0.12)",
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
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <CheckCircle2 size={17} color="#6ee7b7" />
                            <strong>{service.service_name}</strong>

                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "999px",
                                background: "rgba(16,185,129,0.12)",
                                color: "#a7f3d0",
                                fontSize: "9px",
                                fontWeight: 950,
                              }}
                            >
                              COMPLETED
                            </span>

                            {service.vehicle_id === null && (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  background: "rgba(245,158,11,0.12)",
                                  color: "#fde68a",
                                  fontSize: "9px",
                                  fontWeight: 950,
                                }}
                              >
                                VEHICLE LINK PENDING
                              </span>
                            )}
                          </div>

                          <p
                            style={{
                              margin: "7px 0 0",
                              color: "#94a3b8",
                              fontSize: "12px",
                            }}
                          >
                            {service.workshop_name} ·{" "}
                            {formatDate(service.booking_date)}
                          </p>

                          <div
                            style={{
                              marginTop: "10px",
                              display: "flex",
                              gap: "12px",
                              flexWrap: "wrap",
                              color: "#cbd5e1",
                              fontSize: "11px",
                            }}
                          >
                            <span>Booking: {service.booking_number}</span>
                            <span>
                              Job Card: {service.job_card_number || "—"}
                            </span>
                            <span>
                              Invoice: {service.invoice_number || "—"}
                            </span>
                            <span>
                              Delivery:{" "}
                              {service.delivered_at
                                ? formatDate(service.delivered_at)
                                : "—"}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              color: "#f8fafc",
                              fontSize: "18px",
                              fontWeight: 950,
                            }}
                          >
                            {service.total_amount !== null
                              ? formatCurrency(service.total_amount)
                              : service.invoice_number
                                ? "Amount not recorded"
                                : "No invoice"}
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              color: "#94a3b8",
                              fontSize: "10px",
                              textTransform: "capitalize",
                            }}
                          >
                            {service.invoice_number
                              ? `Payment: ${
                                  service.payment_status?.replaceAll("_", " ") ||
                                  "not recorded"
                                }`
                              : "Invoice not created for this service"}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section
              className="service-toolbar"
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "1fr 210px 160px",
                gap: "12px",
              }}
            >
              <label style={{ position: "relative" }}>
                <Search
                  size={17}
                  style={searchIconStyle}
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search service records..."
                  style={searchInputStyle}
                />
              </label>

              <div style={{ position: "relative" }}>
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                  style={filterSelectStyle}
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} style={selectArrowStyle} />
              </div>

              <div style={{ position: "relative" }}>
                <select
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">All Years</option>
                  {years.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} style={selectArrowStyle} />
              </div>
            </section>

            <section
              style={{
                marginTop: "19px",
                display: "grid",
                gap: "12px",
              }}
            >
              {visibleEntries.length === 0 ? (
                <div style={emptyStateStyle}>
                  <Wrench size={39} color="#64748b" />
                  <h3
                    style={{
                      margin: "13px 0 7px",
                      color: "#cbd5e1",
                    }}
                  >
                    No service records found
                  </h3>
                  <p style={{ margin: 0, color: "#94a3b8" }}>
                    Add your first service record to begin the maintenance
                    history.
                  </p>
                </div>
              ) : (
                visibleEntries.map((entry) => (
                  <article key={entry.id} style={serviceCardStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "13px",
                        minWidth: 0,
                        flex: "1 1 540px",
                      }}
                    >
                      <div style={serviceIconStyle}>
                        <Wrench size={21} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <h3 style={{ margin: 0, fontSize: "17px" }}>
                            {entry.service_type}
                          </h3>

                          <span style={categoryPillStyle}>
                            {categoryLabel(entry.category)}
                          </span>
                        </div>

                        <p style={serviceDescriptionStyle}>
                          {entry.workshop_name || "Workshop not recorded"} ·{" "}
                          {formatDate(entry.service_date)}
                        </p>

                        <div style={serviceMetaStyle}>
                          <span>
                            <IndianRupee size={14} />
                            {formatCurrency(Number(entry.cost || 0))}
                          </span>

                          {entry.odometer_km !== null && (
                            <span>
                              <Gauge size={14} />
                              {entry.odometer_km.toLocaleString("en-IN")} km
                            </span>
                          )}

                          {entry.next_service_date && (
                            <span>
                              <CalendarClock size={14} />
                              Next: {formatDate(entry.next_service_date)}
                            </span>
                          )}

                          {entry.next_service_km !== null && (
                            <span>
                              <Gauge size={14} />
                              Next at{" "}
                              {entry.next_service_km.toLocaleString("en-IN")} km
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <p style={notesStyle}>{entry.notes}</p>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {entry.invoice_path && (
                        <button
                          type="button"
                          onClick={() => openInvoice(entry.invoice_path!)}
                          style={smallButtonStyle}
                        >
                          <FileText size={15} />
                          Invoice
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        style={smallButtonStyle}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteEntry(entry)}
                        disabled={workingId !== null}
                        style={dangerButtonStyle}
                      >
                        {workingId === entry.id ? (
                          <Loader2
                            size={15}
                            style={{ animation: "spin 1s linear infinite" }}
                          />
                        ) : (
                          <Trash2 size={15} />
                        )}
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section style={miraInsightStyle}>
              <Sparkles size={20} color="#c4b5fd" />
              <div>
                <div style={{ fontWeight: 950 }}>Mira Service Insights</div>
                <div style={miraTextStyle}>
                  {entries.length === 0
                    ? "Add service records to generate maintenance insights."
                    : `You have recorded ${entries.length} service${
                        entries.length === 1 ? "" : "s"
                      } with total spending of ${formatCurrency(
                        analytics.totalCost
                      )}. Average cost per service is ${formatCurrency(
                        analytics.averageCost
                      )}${
                        analytics.mostFrequentCategory
                          ? `. Most frequent category: ${categoryLabel(
                              analytics.mostFrequentCategory
                            )}.`
                          : "."
                      }`}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {showModal && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowModal(false);
            }
          }}
          style={modalOverlayStyle}
        >
          <section style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>
                  {editingEntry ? "Edit Service Record" : "Add Service Record"}
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  Save complete maintenance details for this vehicle.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={closeButtonStyle}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
              <div style={twoColumnStyle}>
                <Field label="Service date">
                  <input
                    type="date"
                    value={form.serviceDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        serviceDate: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Odometer (km)">
                  <input
                    type="number"
                    min="0"
                    value={form.odometerKm}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        odometerKm: event.target.value,
                      }))
                    }
                    placeholder="45000"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Service type">
                <input
                  value={form.serviceType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceType: event.target.value,
                    }))
                  }
                  placeholder="Example: Full Service"
                  style={inputStyle}
                />
              </Field>

              <div style={twoColumnStyle}>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    {CATEGORY_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Cost">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cost: event.target.value,
                      }))
                    }
                    placeholder="8500"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Workshop name">
                <input
                  value={form.workshopName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      workshopName: event.target.value,
                    }))
                  }
                  placeholder="Workshop or authorised service centre"
                  style={inputStyle}
                />
              </Field>

              <div style={twoColumnStyle}>
                <Field label="Next service date">
                  <input
                    type="date"
                    value={form.nextServiceDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nextServiceDate: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Next service at km">
                  <input
                    type="number"
                    min="0"
                    value={form.nextServiceKm}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nextServiceKm: event.target.value,
                      }))
                    }
                    placeholder="50000"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Parts replaced, observations, warranty information..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </Field>

              <Field label="Invoice or bill">
                <label style={uploadBoxStyle}>
                  <Upload size={20} />
                  <span>
                    {invoiceFile
                      ? invoiceFile.name
                      : editingEntry?.invoice_path
                        ? "Replace existing invoice"
                        : "Choose PDF or image"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) =>
                      setInvoiceFile(event.target.files?.[0] || null)
                    }
                    style={{ display: "none" }}
                  />
                </label>
              </Field>

              <button
                type="button"
                onClick={saveEntry}
                disabled={saving}
                style={{
                  ...primaryButtonStyle,
                  width: "100%",
                  justifyContent: "center",
                  marginTop: "4px",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <Loader2
                    size={18}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {saving
                  ? "Saving Service Record..."
                  : editingEntry
                    ? "Update Service Record"
                    : "Save Service Record"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 12px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.62)",
  color: "#cbd5e1",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
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
};

const eyebrowStyle: React.CSSProperties = {
  color: "#67e8f9",
  fontSize: "12px",
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const pageTitleStyle: React.CSSProperties = {
  margin: "8px 0 7px",
  fontSize: "clamp(31px, 5vw, 48px)",
  letterSpacing: "-0.035em",
};

const pageDescriptionStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: "760px",
  color: "#94a3b8",
  lineHeight: 1.7,
};

const errorStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "14px 16px",
  borderRadius: "14px",
  background: "rgba(127,29,29,0.18)",
  border: "1px solid rgba(248,113,113,0.23)",
  color: "#fecaca",
  display: "flex",
  gap: "9px",
};

const emptyStateStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "38px 24px",
  borderRadius: "22px",
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(148,163,184,0.14)",
  textAlign: "center",
};

const vehicleSelectorStyle: React.CSSProperties = {
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
};

const selectStyle: React.CSSProperties = {
  minWidth: "220px",
  appearance: "none",
  padding: "11px 38px 11px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "#071426",
  color: "white",
  cursor: "pointer",
};

const filterSelectStyle: React.CSSProperties = {
  width: "100%",
  appearance: "none",
  padding: "12px 38px 12px 13px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.78)",
  color: "white",
  cursor: "pointer",
};

const selectArrowStyle: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "#94a3b8",
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: "13px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px 12px 42px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.78)",
  color: "white",
  outline: "none",
};

const serviceCardStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "18px",
  background: "rgba(15,23,42,0.82)",
  border: "1px solid rgba(148,163,184,0.14)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
};

const serviceIconStyle: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(202,138,4,0.12)",
  color: "#fde68a",
  flexShrink: 0,
};

const categoryPillStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: "999px",
  background: "rgba(37,99,235,0.12)",
  color: "#93c5fd",
  fontSize: "9px",
  fontWeight: 950,
};

const serviceDescriptionStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
};

const serviceMetaStyle: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  gap: "13px",
  flexWrap: "wrap",
  color: "#cbd5e1",
  fontSize: "11px",
};

const notesStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.6,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "10px",
  border: "1px solid rgba(147,197,253,0.2)",
  background: "rgba(37,99,235,0.12)",
  color: "#bfdbfe",
  fontWeight: 850,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "10px",
  border: "1px solid rgba(248,113,113,0.2)",
  background: "rgba(127,29,29,0.13)",
  color: "#fca5a5",
  fontWeight: 850,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const miraInsightStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "17px",
  borderRadius: "18px",
  background:
    "linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.84))",
  border: "1px solid rgba(167,139,250,0.18)",
  display: "flex",
  gap: "11px",
  alignItems: "flex-start",
};

const miraTextStyle: React.CSSProperties = {
  marginTop: "5px",
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.65,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  padding: "20px",
  background: "rgba(2,6,23,0.78)",
  backdropFilter: "blur(8px)",
  display: "grid",
  placeItems: "center",
};

const modalCardStyle: React.CSSProperties = {
  width: "min(680px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "22px",
  borderRadius: "22px",
  background: "linear-gradient(145deg, #0f172a, #071426)",
  border: "1px solid rgba(148,163,184,0.17)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const closeButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.8)",
  color: "#cbd5e1",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.17)",
  background: "#071426",
  color: "white",
  outline: "none",
};

const uploadBoxStyle: React.CSSProperties = {
  minHeight: "82px",
  padding: "16px",
  borderRadius: "13px",
  border: "1px dashed rgba(147,197,253,0.3)",
  background: "rgba(37,99,235,0.08)",
  color: "#bfdbfe",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  textAlign: "center",
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
  icon: typeof Wrench;
  label: string;
  value: string;
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
          fontSize: "21px",
          fontWeight: 950,
        }}
      >
        {value}
      </div>
    </article>
  );
}