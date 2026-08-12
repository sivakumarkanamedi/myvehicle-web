"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../supabase";

type Vehicle = {
  id: number;
  user_id?: string;
  vehicle_name?: string | null;
  brand?: string | null;
  model?: string | null;
  registration_number?: string | null;
  image_url?: string | null;
};

type ServiceEntry = {
  id: number;
  user_id: string;
  vehicle_id: number;
  service_type: string;
  workshop_name: string | null;
  service_date: string;
  odometer: number | null;
  total_cost: number | null;
  work_performed: string | null;
  parts_replaced: string | null;
  invoice_url: string | null;
  notes: string | null;
  next_service_date: string | null;
  next_service_odometer: number | null;
  created_at: string;
  updated_at: string | null;
};

type ServiceForm = {
  service_type: string;
  workshop_name: string;
  service_date: string;
  odometer: string;
  total_cost: string;
  work_performed: string;
  parts_replaced: string;
  notes: string;
  next_service_date: string;
  next_service_odometer: string;
};

type Notice = {
  type: "success" | "error" | "warning";
  message: string;
};

const initialForm: ServiceForm = {
  service_type: "General Service",
  workshop_name: "",
  service_date: new Date().toISOString().split("T")[0],
  odometer: "",
  total_cost: "",
  work_performed: "",
  parts_replaced: "",
  notes: "",
  next_service_date: "",
  next_service_odometer: "",
};

const serviceTypes = [
  "General Service",
  "Periodic Service",
  "Oil Change",
  "Brake Service",
  "Battery Service",
  "Tyre Service",
  "Wheel Alignment",
  "Engine Repair",
  "AC Service",
  "Electrical Repair",
  "Accident Repair",
  "Denting & Painting",
  "Vehicle Inspection",
  "Other",
];

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${value}T00:00:00`);
  const difference = target.getTime() - today.getTime();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

export default function ServiceHistoryPage() {
  const params = useParams();
  const router = useRouter();

  const vehicleId = Number(params.id);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [form, setForm] = useState<ServiceForm>(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [showAddService, setShowAddService] = useState(false);
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(
    null
  );

  const [searchText, setSearchText] = useState("");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback(
    (type: Notice["type"], message: string) => {
      setNotice({ type, message });

      window.setTimeout(() => {
        setNotice(null);
      }, 4500);
    },
    []
  );

  const loadPageData = useCallback(async () => {
    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      showNotice("error", "Invalid vehicle ID.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const [vehicleResult, servicesResult] = await Promise.all([
        supabase
          .from("vehicles")
          .select("*")
          .eq("id", vehicleId)
          .eq("user_id", user.id)
          .single(),

        supabase
          .from("service_entries")
          .select("*")
          .eq("vehicle_id", vehicleId)
          .eq("user_id", user.id)
          .order("service_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (vehicleResult.error) {
        throw new Error(
          vehicleResult.error.message || "Unable to load vehicle details."
        );
      }

      if (servicesResult.error) {
        throw new Error(
          servicesResult.error.message || "Unable to load service history."
        );
      }

      setVehicle(vehicleResult.data as Vehicle);
      setServices((servicesResult.data || []) as ServiceEntry[]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while loading the page.";

      showNotice("error", message);
    } finally {
      setLoading(false);
    }
  }, [router, showNotice, vehicleId]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const lastService = useMemo(() => {
    if (services.length === 0) return null;

    return [...services].sort(
      (a, b) =>
        new Date(b.service_date).getTime() -
        new Date(a.service_date).getTime()
    )[0];
  }, [services]);

  const nextServiceDate = useMemo(() => {
    const entriesWithNextDate = services
      .filter((entry) => entry.next_service_date)
      .sort(
        (a, b) =>
          new Date(a.next_service_date as string).getTime() -
          new Date(b.next_service_date as string).getTime()
      );

    return entriesWithNextDate[0]?.next_service_date || null;
  }, [services]);

  const nextServiceOdometer = useMemo(() => {
    const readings = services
      .map((entry) => entry.next_service_odometer)
      .filter(
        (reading): reading is number =>
          typeof reading === "number" && reading > 0
      )
      .sort((a, b) => a - b);

    return readings[0] || null;
  }, [services]);

  const totalServiceCost = useMemo(
    () =>
      services.reduce(
        (total, entry) => total + Number(entry.total_cost || 0),
        0
      ),
    [services]
  );

  const currentYearCost = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return services
      .filter(
        (entry) => new Date(entry.service_date).getFullYear() === currentYear
      )
      .reduce(
        (total, entry) => total + Number(entry.total_cost || 0),
        0
      );
  }, [services]);

  const healthScore = useMemo(() => {
    if (services.length === 0) return 70;

    let score = 92;
    const dueDays = daysUntil(nextServiceDate);

    if (dueDays !== null && dueDays < 0) score -= 15;
    if (dueDays !== null && dueDays >= 0 && dueDays <= 15) score -= 5;

    const missingInvoiceCount = services.filter(
      (entry) => !entry.invoice_url
    ).length;

    score -= Math.min(missingInvoiceCount, 7);

    return Math.max(55, Math.min(score, 98));
  }, [nextServiceDate, services]);

  const filteredServices = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return services.filter((entry) => {
      const matchesFilter =
        serviceFilter === "All" || entry.service_type === serviceFilter;

      const searchableText = [
        entry.service_type,
        entry.workshop_name,
        entry.work_performed,
        entry.parts_replaced,
        entry.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [searchText, serviceFilter, services]);

  function updateForm(field: keyof ServiceForm, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
  }

  function validateForm() {
    if (!form.service_type.trim()) {
      return "Please select a service type.";
    }

    if (!form.service_date) {
      return "Please select the service date.";
    }

    const selectedDate = new Date(`${form.service_date}T00:00:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDate > today) {
      return "Service date cannot be in the future.";
    }

    if (form.odometer && Number(form.odometer) < 0) {
      return "Odometer reading cannot be negative.";
    }

    if (form.total_cost && Number(form.total_cost) < 0) {
      return "Service cost cannot be negative.";
    }

    if (
      form.next_service_date &&
      new Date(`${form.next_service_date}T00:00:00`) <= selectedDate
    ) {
      return "Next service date must be after the service date.";
    }

    if (
      form.next_service_odometer &&
      form.odometer &&
      Number(form.next_service_odometer) <= Number(form.odometer)
    ) {
      return "Next service odometer must be greater than the current reading.";
    }

    const highestPreviousOdometer = Math.max(
      0,
      ...services.map((entry) => Number(entry.odometer || 0))
    );

    if (
      form.odometer &&
      highestPreviousOdometer > 0 &&
      Number(form.odometer) < highestPreviousOdometer
    ) {
      return `The entered odometer is lower than the previous reading of ${highestPreviousOdometer.toLocaleString(
        "en-IN"
      )} km. Please verify it.`;
    }

    return null;
  }

  async function addServiceEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      showNotice("warning", validationError);
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const duplicateQuery = await supabase
        .from("service_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("vehicle_id", vehicleId)
        .eq("service_date", form.service_date)
        .eq("service_type", form.service_type)
        .limit(1);

      if (duplicateQuery.error) {
        throw new Error(duplicateQuery.error.message);
      }

      if ((duplicateQuery.data || []).length > 0) {
        const shouldContinue = window.confirm(
          "A similar service entry already exists for this date. Do you still want to save another entry?"
        );

        if (!shouldContinue) {
          setSaving(false);
          return;
        }
      }

      const payload = {
        user_id: user.id,
        vehicle_id: vehicleId,
        service_type: form.service_type.trim(),
        workshop_name: form.workshop_name.trim() || null,
        service_date: form.service_date,
        odometer: form.odometer ? Number(form.odometer) : null,
        total_cost: form.total_cost ? Number(form.total_cost) : 0,
        work_performed: form.work_performed.trim() || null,
        parts_replaced: form.parts_replaced.trim() || null,
        invoice_url: null,
        notes: form.notes.trim() || null,
        next_service_date: form.next_service_date || null,
        next_service_odometer: form.next_service_odometer
          ? Number(form.next_service_odometer)
          : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("service_entries")
        .insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      showNotice("success", "Service record saved successfully.");
      resetForm();
      setShowAddService(false);
      await loadPageData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save the service record.";

      showNotice("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteServiceEntry(serviceId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this service record? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeletingId(serviceId);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("service_entries")
        .delete()
        .eq("id", serviceId)
        .eq("vehicle_id", vehicleId)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setServices((previous) =>
        previous.filter((entry) => entry.id !== serviceId)
      );

      showNotice("success", "Service record deleted.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete the service record.";

      showNotice("error", message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
            <p className="mt-4 text-sm text-slate-400">
              Loading service history...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!vehicle) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-10">
            <div className="text-5xl">🚗</div>
            <h1 className="mt-5 text-2xl font-bold">Vehicle not found</h1>
            <p className="mt-3 text-slate-400">
              This vehicle may not exist or you may not have permission to view
              it.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
            >
              Return to My Garage
            </button>
          </div>
        </div>
      </main>
    );
  }

  const remainingDays = daysUntil(nextServiceDate);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {notice && (
        <div className="fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div
            className={`rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur ${
              notice.type === "success"
                ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100"
                : notice.type === "warning"
                ? "border-amber-500/30 bg-amber-950/95 text-amber-100"
                : "border-red-500/30 bg-red-950/95 text-red-100"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium">{notice.message}</p>

              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-lg leading-none opacity-70 hover:opacity-100"
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="border-b border-white/10 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <button
                type="button"
                onClick={() => router.push(`/vehicle/${vehicleId}`)}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-300 transition hover:text-white"
              >
                ← Back to vehicle
              </button>

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-3xl">
                  🔧
                </div>

                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-300">
                    Service & Maintenance
                  </p>

                  <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                    {vehicle.vehicle_name ||
                      [vehicle.brand, vehicle.model]
                        .filter(Boolean)
                        .join(" ") ||
                      "My Vehicle"}
                  </h1>

                  <p className="mt-1 text-sm text-slate-400">
                    {vehicle.registration_number ||
                      "Registration number not added"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "warning",
                    "Invoice scanning will be connected after Supabase Storage is configured."
                  )
                }
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
              >
                📷 Scan Invoice
              </button>

              <button
                type="button"
                onClick={() => setShowAddService(true)}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-blue-950 transition hover:bg-blue-500"
              >
                ＋ Add Service
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            icon="🩺"
            label="Vehicle Health"
            value={`${healthScore}/100`}
            helper={
              healthScore >= 85
                ? "Good condition"
                : "Maintenance attention needed"
            }
          />

          <SummaryCard
            icon="🗓️"
            label="Last Service"
            value={
              lastService ? formatDate(lastService.service_date) : "No record"
            }
            helper={lastService?.service_type || "Add your first service"}
          />

          <SummaryCard
            icon="⏳"
            label="Next Service"
            value={
              nextServiceDate
                ? formatDate(nextServiceDate)
                : "Not scheduled"
            }
            helper={
              remainingDays === null
                ? "Add a reminder"
                : remainingDays < 0
                ? `${Math.abs(remainingDays)} days overdue`
                : `${remainingDays} days remaining`
            }
            alert={remainingDays !== null && remainingDays < 0}
          />

          <SummaryCard
            icon="💰"
            label="Total Service Cost"
            value={formatCurrency(totalServiceCost)}
            helper={`${services.length} service record${
              services.length === 1 ? "" : "s"
            }`}
          />

          <SummaryCard
            icon="📊"
            label="This Year"
            value={formatCurrency(currentYearCost)}
            helper="Maintenance expenditure"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-blue-300">
                  Smart Maintenance
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Upcoming service information
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowAddService(true)}
                className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
              >
                Update schedule
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">Next service date</p>
                <p className="mt-2 text-xl font-bold">
                  {formatDate(nextServiceDate)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">
                  Next service odometer
                </p>
                <p className="mt-2 text-xl font-bold">
                  {nextServiceOdometer
                    ? `${nextServiceOdometer.toLocaleString("en-IN")} km`
                    : "Not available"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>

                <div>
                  <p className="font-semibold text-emerald-100">
                    Mira maintenance assistant
                  </p>
                  <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                    Mira will use service dates, odometer readings and repair
                    history to generate future reminders and maintenance
                    insights.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <p className="text-sm font-medium text-blue-300">Quick Actions</p>
            <h2 className="mt-1 text-xl font-bold">Service assistance</h2>

            <div className="mt-5 space-y-3">
              <QuickAction
                icon="🔍"
                title="Find Workshop"
                description="Nearby workshops and service centres"
                onClick={() =>
                  showNotice(
                    "warning",
                    "Workshop discovery will be connected in the next development stage."
                  )
                }
              />

              <QuickAction
                icon="📅"
                title="Book Service"
                description="Schedule workshop, pickup or doorstep service"
                onClick={() =>
                  showNotice(
                    "warning",
                    "Workshop booking will be connected in the next development stage."
                  )
                }
              />

              <QuickAction
                icon="🚨"
                title="Emergency Help"
                description="Towing, battery, tyre or fuel assistance"
                onClick={() =>
                  showNotice(
                    "warning",
                    "Roadside assistance integration is coming in the RSA module."
                  )
                }
              />

              <QuickAction
                icon="💬"
                title="Ask Mira"
                description="Explain a vehicle issue using text or voice"
                onClick={() =>
                  showNotice(
                    "warning",
                    "Ask Mira service diagnostics will be connected in the Mira module."
                  )
                }
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-medium text-blue-300">
                Digital Service Timeline
              </p>
              <h2 className="mt-1 text-2xl font-bold">Service history</h2>
              <p className="mt-2 text-sm text-slate-400">
                View repairs, workshop details, parts, costs and upcoming
                maintenance.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search workshop or repair..."
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 sm:w-64"
              />

              <select
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="All">All services</option>

                {serviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredServices.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-14 text-center">
              <div className="text-5xl">🧾</div>
              <h3 className="mt-5 text-xl font-bold">
                {services.length === 0
                  ? "No service records yet"
                  : "No matching service records"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                {services.length === 0
                  ? "Add the first service record to start building this vehicle’s verified maintenance history."
                  : "Try changing your search term or service filter."}
              </p>

              {services.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddService(true)}
                  className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500"
                >
                  Add First Service
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {filteredServices.map((service, index) => {
                const expanded = expandedServiceId === service.id;

                return (
                  <article
                    key={service.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 transition hover:border-blue-500/30"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedServiceId(expanded ? null : service.id)
                      }
                      className="w-full p-5 text-left"
                    >
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xl">
                            🔧
                          </div>

                          {index < filteredServices.length - 1 && (
                            <div className="mt-2 h-full min-h-8 w-px bg-white/10" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold">
                                  {service.service_type}
                                </h3>

                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                  Saved
                                </span>
                              </div>

                              <p className="mt-1 text-sm text-slate-400">
                                {service.workshop_name ||
                                  "Workshop not specified"}
                              </p>
                            </div>

                            <div className="sm:text-right">
                              <p className="font-bold text-blue-200">
                                {formatCurrency(service.total_cost)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(service.service_date)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                            <span className="rounded-lg bg-white/5 px-3 py-2">
                              🛣️{" "}
                              {service.odometer
                                ? `${Number(service.odometer).toLocaleString(
                                    "en-IN"
                                  )} km`
                                : "Odometer not added"}
                            </span>

                            <span className="rounded-lg bg-white/5 px-3 py-2">
                              🧩{" "}
                              {service.parts_replaced
                                ? "Parts recorded"
                                : "No parts recorded"}
                            </span>

                            <span className="rounded-lg bg-white/5 px-3 py-2">
                              🧾{" "}
                              {service.invoice_url
                                ? "Invoice attached"
                                : "Invoice pending"}
                            </span>
                          </div>

                          <p className="mt-4 text-sm font-medium text-blue-300">
                            {expanded ? "Hide details ↑" : "View details ↓"}
                          </p>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-white/10 px-5 py-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <DetailBlock
                            label="Work performed"
                            value={
                              service.work_performed ||
                              "No work details were added."
                            }
                          />

                          <DetailBlock
                            label="Parts replaced"
                            value={
                              service.parts_replaced ||
                              "No replaced parts were recorded."
                            }
                          />

                          <DetailBlock
                            label="Technician / workshop notes"
                            value={
                              service.notes || "No additional notes were added."
                            }
                          />

                          <DetailBlock
                            label="Next service"
                            value={[
                              service.next_service_date
                                ? formatDate(service.next_service_date)
                                : null,
                              service.next_service_odometer
                                ? `${Number(
                                    service.next_service_odometer
                                  ).toLocaleString("en-IN")} km`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" • ") || "Not scheduled"}
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              showNotice(
                                "warning",
                                "Invoice upload will be added after storage configuration."
                              )
                            }
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                          >
                            Upload Invoice
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === service.id}
                            onClick={() => deleteServiceEntry(service.id)}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === service.id
                              ? "Deleting..."
                              : "Delete Record"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showAddService && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur sm:px-7">
              <div>
                <p className="text-sm font-medium text-blue-300">
                  New Maintenance Record
                </p>
                <h2 className="mt-1 text-xl font-bold">Add service details</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowAddService(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-2xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={addServiceEntry} className="space-y-6 p-5 sm:p-7">
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-sm leading-6 text-blue-100/80">
                  Add the confirmed service information. Invoice scanning,
                  mechanic checklists and evidence verification will be
                  connected in the upcoming workshop-development stages.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Service type" required>
                  <select
                    value={form.service_type}
                    onChange={(event) =>
                      updateForm("service_type", event.target.value)
                    }
                    className="form-control"
                    required
                  >
                    {serviceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Service date" required>
                  <input
                    type="date"
                    value={form.service_date}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(event) =>
                      updateForm("service_date", event.target.value)
                    }
                    className="form-control"
                    required
                  />
                </FormField>

                <FormField label="Workshop / service centre">
                  <input
                    type="text"
                    value={form.workshop_name}
                    onChange={(event) =>
                      updateForm("workshop_name", event.target.value)
                    }
                    placeholder="Example: ABC Motors"
                    className="form-control"
                    maxLength={120}
                  />
                </FormField>

                <FormField label="Odometer reading">
                  <input
                    type="number"
                    value={form.odometer}
                    onChange={(event) =>
                      updateForm("odometer", event.target.value)
                    }
                    placeholder="Example: 25000"
                    min="0"
                    step="1"
                    className="form-control"
                  />
                </FormField>

                <FormField label="Total service cost">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      ₹
                    </span>

                    <input
                      type="number"
                      value={form.total_cost}
                      onChange={(event) =>
                        updateForm("total_cost", event.target.value)
                      }
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="form-control pl-9"
                    />
                  </div>
                </FormField>

                <FormField label="Next service date">
                  <input
                    type="date"
                    value={form.next_service_date}
                    min={form.service_date}
                    onChange={(event) =>
                      updateForm("next_service_date", event.target.value)
                    }
                    className="form-control"
                  />
                </FormField>

                <FormField label="Next service odometer">
                  <input
                    type="number"
                    value={form.next_service_odometer}
                    onChange={(event) =>
                      updateForm(
                        "next_service_odometer",
                        event.target.value
                      )
                    }
                    placeholder="Example: 35000"
                    min="0"
                    step="1"
                    className="form-control"
                  />
                </FormField>
              </div>

              <FormField label="Work performed">
                <textarea
                  value={form.work_performed}
                  onChange={(event) =>
                    updateForm("work_performed", event.target.value)
                  }
                  placeholder="Example: Engine oil changed, brakes inspected, air filter cleaned..."
                  rows={4}
                  className="form-control resize-none"
                  maxLength={1500}
                />
              </FormField>

              <FormField label="Parts replaced">
                <textarea
                  value={form.parts_replaced}
                  onChange={(event) =>
                    updateForm("parts_replaced", event.target.value)
                  }
                  placeholder="Example: Oil filter, brake pads, air filter..."
                  rows={3}
                  className="form-control resize-none"
                  maxLength={1000}
                />
              </FormField>

              <FormField label="Additional notes">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateForm("notes", event.target.value)
                  }
                  placeholder="Warranty details, workshop recommendations or other notes..."
                  rows={3}
                  className="form-control resize-none"
                  maxLength={1500}
                />
              </FormField>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowAddService(false);
                  }}
                  className="rounded-xl border border-white/10 px-5 py-3 font-semibold transition hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold shadow-lg shadow-blue-950 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving Service..." : "Save Service Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .form-control {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgb(2 6 23);
          padding: 0.75rem 1rem;
          color: white;
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .form-control::placeholder {
          color: rgb(100 116 139);
        }

        .form-control:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  alert = false,
}: {
  icon: string;
  label: string;
  value: string;
  helper: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg ${
        alert
          ? "border-red-500/30 bg-red-500/10"
          : "border-white/10 bg-slate-900/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold">{value}</p>
          <p
            className={`mt-2 text-xs ${
              alert ? "text-red-300" : "text-slate-500"
            }`}
          >
            {helper}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:border-blue-500/30 hover:bg-blue-500/5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
    </button>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value}
      </p>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </span>

      {children}
    </label>
  );
}