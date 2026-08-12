"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bell,
  CalendarClock,
  Car,
  ChevronDown,
  CircleHelp,
  FileText,
  Warehouse,
  History,
  Home,
  LogOut,
  MapPinned,
  Mic,
  Navigation,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { resolveVehicleImage } from "./lib/vehicleImageLibrary";

type Vehicle = {
  id: number;
  user_id?: string;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  image_url: string | null;
  generated_image_url: string | null;
  brand?: string | null;
  model?: string | null;
  colour?: string | null;
  created_at?: string | null;
};

type VehicleDocument = {
  id: number;
  document_type: string | null;
  document_name: string | null;
  expiry_date: string | null;
  verified?: boolean | null;
};

type ServiceEntry = {
  id: number;
  service_date: string | null;
  service_type: string | null;
  workshop_name: string | null;
};

type ChallanEntry = {
  id: number;
  amount: number | null;
  status: string | null;
};

type VehicleReminder = {
  id: number;
  title: string;
  due_at: string;
  completed_at: string | null;
};

type DashboardStatus = {
  documentCount: number;
  expiredDocuments: number;
  expiringDocuments: number;
  insuranceExpiry: string | null;
  latestService: ServiceEntry | null;
  activeReminders: number;
  nextReminder: VehicleReminder | null;
  pendingChallans: number;
  pendingChallanAmount: number;
};

type MenuItem = {
  label: string;
  href: string;
  icon: typeof Home;
  badge?: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const EMPTY_STATUS: DashboardStatus = {
  documentCount: 0,
  expiredDocuments: 0,
  expiringDocuments: 0,
  insuranceExpiry: null,
  latestService: null,
  activeReminders: 0,
  nextReminder: null,
  pendingChallans: 0,
  pendingChallanAmount: 0,
};

const quickActions = [
  {
    label: "Service Booking",
    description: "Book vehicle service",
    href: "/service-booking",
    icon: Wrench,
    accent: "from-amber-500/20 to-amber-500/5",
    iconClass: "bg-amber-400/15 text-amber-300",
  },
  {
    label: "Documents",
    description: "RC, insurance and PUC",
    href: "/documents",
    icon: FileText,
    accent: "from-cyan-500/20 to-cyan-500/5",
    iconClass: "bg-cyan-400/15 text-cyan-300",
  },
  {
    label: "Traffic Challans",
    description: "Check pending challans",
    href: "/challans",
    icon: ShieldCheck,
    accent: "from-violet-500/20 to-violet-500/5",
    iconClass: "bg-violet-400/15 text-violet-300",
  },
  {
    label: "SOS",
    description: "Emergency assistance",
    href: "/sos",
    icon: Zap,
    accent: "from-rose-500/20 to-rose-500/5",
    iconClass: "bg-rose-400/15 text-rose-300",
  },
];

const navigationShortcuts = [
  { label: "Home", href: "/navigation?destination=home", icon: Home },
  { label: "Office", href: "/navigation?destination=office", icon: Navigation },
  { label: "Saved", href: "/navigation/saved-places", icon: MapPinned },
  { label: "Recent", href: "/navigation/history", icon: History },
];

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();

  return Math.ceil(
    (new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime() -
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime()) /
      86_400_000
  );
}

function normalize(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function HomePage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] =
    useState<number | null>(null);
  const [status, setStatus] =
    useState<DashboardStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [destination, setDestination] = useState("");
  const [profileName, setProfileName] = useState("Siva");

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "";

      if (metadataName.trim()) {
        setProfileName(metadataName.trim().split(" ")[0]);
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, user_id, vehicle_name, vehicle_number, vehicle_type, image_url, generated_image_url, brand, model, colour, created_at"
        )
        .eq("user_id", user.id)
        .order("id", { ascending: false });

      if (error) throw error;

      const availableVehicles = (data || []) as Vehicle[];
      setVehicles(availableVehicles);

      setSelectedVehicleId((current) => {
        if (
          current &&
          availableVehicles.some((vehicle) => vehicle.id === current)
        ) {
          return current;
        }

        const savedVehicleId = Number(
          window.localStorage.getItem("myvehicle.activeVehicleId")
        );

        if (
          savedVehicleId &&
          availableVehicles.some(
            (vehicle) => vehicle.id === savedVehicleId
          )
        ) {
          return savedVehicleId;
        }

        return availableVehicles[0]?.id || null;
      });
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load your vehicles."
      );
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    if (selectedVehicleId) {
      window.localStorage.setItem(
        "myvehicle.activeVehicleId",
        String(selectedVehicleId)
      );
    }
  }, [selectedVehicleId]);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [selectedVehicleId, vehicles]
  );

  const loadSelectedVehicleStatus = useCallback(async () => {
    if (!selectedVehicleId) {
      setStatus(EMPTY_STATUS);
      return;
    }

    setStatusLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [
        documentResult,
        serviceResult,
        reminderResult,
        challanResult,
      ] = await Promise.all([
          supabase
            .from("vehicle_documents")
            .select(
              "id, document_type, document_name, expiry_date, verified"
            )
            .eq("user_id", user.id)
            .eq("vehicle_id", selectedVehicleId),

          supabase
            .from("service_entries")
            .select(
              "id, service_date, service_type, workshop_name"
            )
            .eq("user_id", user.id)
            .eq("vehicle_id", selectedVehicleId)
            .order("service_date", { ascending: false })
            .limit(1),

          supabase
            .from("vehicle_reminders")
            .select("id, title, due_at, completed_at")
            .eq("user_id", user.id)
            .eq("vehicle_id", selectedVehicleId)
            .is("completed_at", null)
            .order("due_at", { ascending: true }),

          supabase
            .from("challans")
            .select("id, amount, status")
            .eq("user_id", user.id)
            .eq("vehicle_id", selectedVehicleId)
            .eq("status", "pending"),
        ]);

      const documents = documentResult.error
        ? []
        : ((documentResult.data || []) as VehicleDocument[]);

      const services = serviceResult.error
        ? []
        : ((serviceResult.data || []) as ServiceEntry[]);

      const reminders = reminderResult.error
        ? []
        : ((reminderResult.data || []) as VehicleReminder[]);

      const pendingChallans = challanResult.error
        ? []
        : ((challanResult.data || []) as ChallanEntry[]);

      const expiryDocuments = documents
        .filter((document) => document.expiry_date)
        .sort(
          (first, second) =>
            new Date(first.expiry_date || "").getTime() -
            new Date(second.expiry_date || "").getTime()
        );

      const expiredDocuments = expiryDocuments.filter((document) => {
        const days = daysUntil(document.expiry_date);
        return days !== null && days < 0;
      }).length;

      const expiringDocuments = expiryDocuments.filter((document) => {
        const days = daysUntil(document.expiry_date);
        return days !== null && days >= 0 && days <= 30;
      }).length;

      const insuranceDocument =
        expiryDocuments.find((document) =>
          normalize(
            `${document.document_type || ""} ${document.document_name || ""}`
          ).includes("insurance")
        ) || null;

      setStatus({
        documentCount: documents.length,
        expiredDocuments,
        expiringDocuments,
        insuranceExpiry: insuranceDocument?.expiry_date || null,
        latestService: services[0] || null,
        activeReminders: reminders.length,
        nextReminder: reminders[0] || null,
        pendingChallans: pendingChallans.length,
        pendingChallanAmount: pendingChallans.reduce(
          (total, challan) => total + Number(challan.amount || 0),
          0
        ),
      });
    } catch {
      setStatus(EMPTY_STATUS);
    } finally {
      setStatusLoading(false);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    void loadSelectedVehicleStatus();
  }, [loadSelectedVehicleStatus]);

  const vehicleStatus = useMemo(() => {
    if (status.expiredDocuments > 0) {
      return {
        label: "Immediate Action",
        description: "One or more documents have expired.",
        className:
          "border-rose-400/30 bg-rose-400/10 text-rose-200",
        dotClass: "bg-rose-400",
      };
    }

    if (
      status.expiringDocuments > 0 ||
      status.activeReminders > 0 ||
      status.pendingChallans > 0
    ) {
      return {
        label: "Attention Needed",
        description:
          "A renewal, reminder or traffic challan needs attention.",
        className:
          "border-amber-400/30 bg-amber-400/10 text-amber-200",
        dotClass: "bg-amber-400",
      };
    }

    return {
      label: "Excellent",
      description:
        "No urgent document or reminder action is shown.",
      className:
        "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      dotClass: "bg-emerald-400",
    };
  }, [status]);

  const vehicleReadiness = useMemo(() => {
    const checks = [
      {
        label: "Documents",
        ready:
          status.expiredDocuments === 0 &&
          status.expiringDocuments === 0 &&
          status.documentCount > 0,
        detail:
          status.expiredDocuments > 0
            ? `${status.expiredDocuments} expired`
            : status.expiringDocuments > 0
              ? `${status.expiringDocuments} due soon`
              : status.documentCount > 0
                ? "Valid"
                : "Not added",
        href: "/documents",
      },
      {
        label: "Insurance",
        ready:
          Boolean(status.insuranceExpiry) &&
          (daysUntil(status.insuranceExpiry) ?? -1) > 30,
        detail: status.insuranceExpiry
          ? formatDate(status.insuranceExpiry)
          : "Not added",
        href: "/documents",
      },
      {
        label: "Service",
        ready:
          Boolean(status.latestService) &&
          status.activeReminders === 0,
        detail: status.activeReminders
          ? `${status.activeReminders} reminder${
              status.activeReminders === 1 ? "" : "s"
            }`
          : status.latestService
            ? "Up to date"
            : "History not added",
        href: "/service-history",
      },
      {
        label: "Traffic Challans",
        ready: status.pendingChallans === 0,
        detail:
          status.pendingChallans > 0
            ? `${status.pendingChallans} pending • ₹${status.pendingChallanAmount.toLocaleString(
                "en-IN"
              )}`
            : "No pending challans",
        href: "/challans",
      },
    ];

    const attentionCount = checks.filter((check) => !check.ready).length;

    return {
      checks,
      attentionCount,
      ready: attentionCount === 0,
    };
  }, [status]);

  const todaySummary = useMemo(() => {
    const items: string[] = [];

    if (status.expiredDocuments > 0) {
      items.push(
        `${status.expiredDocuments} document ${
          status.expiredDocuments === 1 ? "has" : "have"
        } expired.`
      );
    } else if (status.expiringDocuments > 0) {
      items.push(
        `${status.expiringDocuments} document ${
          status.expiringDocuments === 1 ? "expires" : "expire"
        } within 30 days.`
      );
    } else if (status.documentCount > 0) {
      items.push(
        `${status.documentCount} document ${
          status.documentCount === 1 ? "record is" : "records are"
        } available.`
      );
    } else {
      items.push("Add RC, insurance and PUC to Document Wallet.");
    }

    if (status.nextReminder) {
      items.push(
        `${status.nextReminder.title} is due on ${formatDate(
          status.nextReminder.due_at
        )}.`
      );
    } else {
      items.push("No active reminder is currently shown.");
    }

    if (status.latestService) {
      items.push(
        `Last service record: ${
          status.latestService.service_type || "Service"
        } on ${formatDate(status.latestService.service_date)}.`
      );
    } else {
      items.push("No service history has been recorded yet.");
    }

    if (status.pendingChallans > 0) {
      items.push(
        `${status.pendingChallans} traffic challan${
          status.pendingChallans === 1 ? " is" : "s are"
        } pending with a recorded total of ₹${status.pendingChallanAmount.toLocaleString(
          "en-IN"
        )}.`
      );
    } else {
      items.push("No pending traffic challans are recorded.");
    }

    return items;
  }, [status]);

  const menuGroups = useMemo<MenuGroup[]>(
    () => [
      {
        title: "My Garage",
        items: [
          { label: "Add Vehicle", href: "/add-vehicle", icon: Plus },
          {
            label: "Documents",
            href: "/documents",
            icon: FileText,
            badge:
              status.expiredDocuments > 0
                ? `${status.expiredDocuments} expired`
                : status.expiringDocuments > 0
                  ? `${status.expiringDocuments} due`
                  : undefined,
          },
          {
            label: "Reminders",
            href: "/reminders",
            icon: CalendarClock,
            badge:
              status.activeReminders > 0
                ? String(status.activeReminders)
                : undefined,
          },
          {
            label: "Vehicle Timeline",
            href: "/vehicle-timeline",
            icon: History,
          },
        ],
      },
      {
        title: "Navigation",
        items: [
          { label: "Start Journey", href: "/navigation", icon: Navigation },
          {
            label: "Saved Places",
            href: "/navigation/saved-places",
            icon: MapPinned,
          },
          {
            label: "Trip Planner",
            href: "/navigation/trip-planner",
            icon: Search,
          },
          {
            label: "Navigation Insights",
            href: "/navigation/insights",
            icon: Sparkles,
          },
          {
            label: "Emergency Navigation",
            href: "/navigation/emergency",
            icon: ShieldCheck,
          },
        ],
      },
      {
        title: "Services",
        items: [
          {
            label: "Workshops",
            href: "/workshops",
            icon: Wrench,
          },
          {
            label: "Service Booking",
            href: "/workshops/book",
            icon: CalendarClock,
          },
          {
            label: "Service History",
            href: "/service-history",
            icon: History,
          },
          {
            label: "Marketplace",
            href: "/marketplace",
            icon: Warehouse,
          },
        ],
      },
      {
        title: "Mira AI",
        items: [
          { label: "Ask Mira", href: "/mira", icon: Sparkles },
          { label: "SOS", href: "/sos", icon: Zap },
        ],
      },
      {
        title: "Account",
        items: [
          { label: "Profile", href: "/profile", icon: User },
          { label: "Settings", href: "/settings", icon: Settings },
          { label: "Help & Support", href: "/help", icon: CircleHelp },
        ],
      },
    ],
    [status]
  );

  function startDestinationSearch() {
    const value = destination.trim();

    router.push(
      value
        ? `/navigation?destination=${encodeURIComponent(value)}`
        : "/navigation"
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-16 rounded-3xl bg-white/5" />
          <div className="h-32 rounded-3xl bg-white/5" />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="h-72 rounded-3xl bg-white/5" />
            <div className="h-72 rounded-3xl bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] pb-28 text-white lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-400">
                {getGreeting()}, {profileName} 👋
              </p>

              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
                  <Car size={15} />
                </div>

                <h1 className="truncate text-lg font-black tracking-tight">
                  My Vehicle
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/reminders"
              className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200"
            >
              <Bell size={19} />

              {status.activeReminders > 0 ? (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-slate-950" />
              ) : null}
            </Link>

            <Link
              href="/profile"
              className="grid h-11 w-11 place-items-center rounded-full border border-blue-400/30 bg-blue-500/15 text-sm font-black text-blue-200"
            >
              {profileName.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {errorMessage ? (
          <section className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {errorMessage}
            <button
              type="button"
              onClick={() => void loadVehicles()}
              className="ml-3 font-bold underline"
            >
              Retry
            </button>
          </section>
        ) : null}

        {vehicles.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.04] px-6 py-16 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-blue-500/10 text-blue-300">
              <Car size={38} />
            </div>

            <h2 className="mt-5 text-2xl font-black">
              Add your first vehicle
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Add a vehicle to unlock documents, reminders, services
              and Mira assistance.
            </p>

            <Link
              href="/add-vehicle"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-bold"
            >
              <Plus size={18} />
              Add Vehicle
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Active Vehicle
                </span>

                <div className="relative">
                  <select
                    value={selectedVehicleId || ""}
                    onChange={(event) =>
                      setSelectedVehicleId(Number(event.target.value))
                    }
                    className="w-full appearance-none rounded-2xl border border-blue-400/20 bg-slate-950/70 px-4 py-4 pr-12 text-sm font-bold text-white outline-none"
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
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </label>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  startDestinationSearch();
                }}
                className="flex items-center gap-3"
              >
                <div className="relative flex-1">
                  <Search
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="Where do you want to go?"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-4 pl-12 pr-4 text-sm outline-none transition focus:border-blue-400/50"
                  />
                </div>

                <Link
                  href="/mira"
                  className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 p-4"
                  aria-label="Voice navigation"
                >
                  <Mic size={20} />
                </Link>
              </form>

              <div className="mt-4 grid grid-cols-4 gap-3">
                {navigationShortcuts.map((shortcut) => {
                  const Icon = shortcut.icon;

                  return (
                    <Link
                      key={shortcut.label}
                      href={shortcut.href}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 px-2 py-3 text-center transition hover:border-blue-400/30"
                    >
                      <Icon size={17} className="mx-auto text-blue-300" />
                      <span className="mt-2 block text-[11px] font-semibold text-slate-300">
                        {shortcut.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
              <article className="overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-950/80 via-slate-900 to-slate-950 shadow-2xl">
                <div className="relative h-44 bg-slate-900">
                  {selectedVehicle ? (
                    <img
                      src={resolveVehicleImage({
                        brand: selectedVehicle.brand,
                        model: selectedVehicle.model,
                        colour: selectedVehicle.colour,
                        vehicleType: selectedVehicle.vehicle_type,
                        vehicleNumber: selectedVehicle.vehicle_number,
                        generatedImageUrl:
                          selectedVehicle.generated_image_url,
                      })}
                      alt={
                        [selectedVehicle.brand, selectedVehicle.model]
                          .filter(Boolean)
                          .join(" ") || "Vehicle"
                      }
                      className="h-full w-full object-contain p-4"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <Car size={72} className="text-blue-300" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                  <div className="absolute left-5 top-5">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${vehicleStatus.className}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${vehicleStatus.dotClass}`}
                      />
                      {vehicleStatus.label}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
                    My Active Vehicle
                  </p>

                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black">
                        {selectedVehicle?.vehicle_name ||
                          [selectedVehicle?.brand, selectedVehicle?.model]
                            .filter(Boolean)
                            .join(" ") ||
                          "My Vehicle"}
                      </h2>

                      <p className="mt-1 font-bold text-blue-300">
                        {selectedVehicle?.vehicle_number ||
                          "Registration number not added"}
                      </p>
                    </div>

                    <Link
                      href={
                        selectedVehicle
                          ? `/vehicle/${selectedVehicle.id}`
                          : "/vehicle"
                      }
                      className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-center text-sm font-bold text-blue-200"
                    >
                      View Garage
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <VehicleDetail
                      label="Insurance"
                      value={
                        status.insuranceExpiry
                          ? formatDate(status.insuranceExpiry)
                          : "Open Documents"
                      }
                      href="/documents"
                    />

                    <VehicleDetail
                      label="Documents"
                      value={
                        status.expiredDocuments > 0
                          ? `${status.expiredDocuments} expired`
                          : status.expiringDocuments > 0
                            ? `${status.expiringDocuments} due soon`
                            : status.documentCount > 0
                              ? "Available"
                              : "Add documents"
                      }
                      href="/documents"
                    />

                    <VehicleDetail
                      label="Service"
                      value={
                        status.latestService
                          ? `Last: ${formatDate(
                              status.latestService.service_date
                            )}`
                          : "No history"
                      }
                      href="/service-history"
                    />
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Today
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      At a Glance
                    </h2>
                  </div>

                  {statusLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
                  ) : (
                    <Sparkles size={20} className="text-violet-300" />
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <GlanceRow
                    label="Documents"
                    value={
                      status.expiredDocuments > 0
                        ? "Action required"
                        : status.expiringDocuments > 0
                          ? "Renewal due"
                          : status.documentCount > 0
                            ? "Available"
                            : "Not added"
                    }
                    href="/documents"
                    tone={
                      status.expiredDocuments > 0
                        ? "danger"
                        : status.expiringDocuments > 0
                          ? "warning"
                          : "success"
                    }
                  />

                  <GlanceRow
                    label="Service"
                    value={
                      status.latestService
                        ? formatDate(status.latestService.service_date)
                        : "Add history"
                    }
                    href="/service-history"
                  />

                  <GlanceRow
                    label="Reminders"
                    value={
                      status.activeReminders > 0
                        ? `${status.activeReminders} active`
                        : "No active reminders"
                    }
                    href="/reminders"
                    tone={
                      status.activeReminders > 0 ? "warning" : "success"
                    }
                  />


                  <GlanceRow
                    label="Traffic Challans"
                    value={
                      status.pendingChallans > 0
                        ? `${status.pendingChallans} pending`
                        : "No pending"
                    }
                    href="/challans"
                    tone={
                      status.pendingChallans > 0 ? "danger" : "success"
                    }
                  />

                  <GlanceRow
                    label="Workshops"
                    value="Find nearby"
                    href="/workshops"
                  />
                </div>
              </article>
            </section>

            <section>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Essentials
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Quick Actions
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className={`rounded-3xl border border-white/10 bg-gradient-to-br ${action.accent} p-4 transition hover:-translate-y-0.5 hover:border-white/20`}
                    >
                      <div
                        className={`grid h-11 w-11 place-items-center rounded-2xl ${action.iconClass}`}
                      >
                        <Icon size={20} />
                      </div>

                      <h3 className="mt-4 text-sm font-black">
                        {action.label}
                      </h3>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {action.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
            <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-r from-violet-950/60 via-slate-900 to-slate-950 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                    <Sparkles size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
                        Mira AI
                      </p>

                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black ${vehicleStatus.className}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${vehicleStatus.dotClass}`}
                        />
                        {vehicleStatus.label}
                      </span>
                    </div>

                    <h2 className="mt-1 text-lg font-black">
                      Today&apos;s Vehicle Summary
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {vehicleStatus.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Link
                    href="/mira"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black"
                  >
                    <Sparkles size={16} />
                    Ask Mira
                  </Link>

                  <Link
                    href="/mira"
                    className="grid h-11 w-11 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-200"
                    aria-label="Talk to Mira"
                  >
                    <Mic size={18} />
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {todaySummary.slice(0, 2).map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
                    <p className="text-xs leading-5 text-slate-300">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`overflow-hidden rounded-3xl border p-5 shadow-2xl sm:p-6 ${
                vehicleReadiness.ready
                  ? "border-emerald-400/20 bg-gradient-to-br from-emerald-950/65 via-slate-900 to-slate-950"
                  : "border-amber-400/20 bg-gradient-to-br from-amber-950/55 via-slate-900 to-slate-950"
              }`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
                      vehicleReadiness.ready
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    <ShieldCheck size={26} />
                  </div>

                  <div>
                    <p
                      className={`text-xs font-black uppercase tracking-[0.18em] ${
                        vehicleReadiness.ready
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }`}
                    >
                      Vehicle Readiness
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      {vehicleReadiness.ready
                        ? "Vehicle Ready"
                        : "Attention Required"}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {vehicleReadiness.ready
                        ? "Your essential vehicle records are ready for the road."
                        : `${vehicleReadiness.attentionCount} item${
                            vehicleReadiness.attentionCount === 1 ? "" : "s"
                          } need attention before your next journey.`}
                    </p>
                  </div>
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${
                    vehicleReadiness.ready
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {vehicleReadiness.ready
                    ? "Ready"
                    : `${vehicleReadiness.attentionCount} actions`}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {vehicleReadiness.checks.map((check) => (
                  <Link
                    key={check.label}
                    href={check.href}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-200">
                        {check.label}
                      </p>

                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-sm font-black ${
                          check.ready
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-amber-400/15 text-amber-300"
                        }`}
                      >
                        {check.ready ? "✓" : "!"}
                      </span>
                    </div>

                    <p
                      className={`mt-3 text-xs font-bold ${
                        check.ready
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }`}
                    >
                      {check.detail}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <Link
              href="/navigation"
              className="group block overflow-hidden rounded-3xl border border-blue-300/20 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 shadow-[0_18px_60px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100/75">
                    Mira Navigation
                  </p>
                  <h2 className="mt-2 text-3xl font-black">
                    Start Journey
                  </h2>
                  <p className="mt-2 text-sm text-blue-100/80">
                    Navigate with traffic, alerts and proactive Mira guidance.
                  </p>
                </div>

                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 transition group-hover:scale-105">
                  <Navigation size={30} />
                </div>
              </div>
            </Link>

            {/* ASK MIRA — BOTTOM CENTER */}
            <Link
              href="/mira"
              className="group flex w-full items-center gap-4 rounded-[28px] border border-violet-400/50 bg-gradient-to-r from-blue-950/90 via-slate-950 to-violet-950/90 px-5 py-4 shadow-[0_0_30px_rgba(124,58,237,0.25)] transition-all duration-300 hover:border-violet-300 hover:shadow-[0_0_45px_rgba(124,58,237,0.40)]"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_0_20px_rgba(124,58,237,0.40)]">
                <Sparkles size={22} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black sm:text-lg">Ask Mira</h2>
                <p className="mt-0.5 truncate text-xs text-slate-400 sm:text-sm">
                  Get answers, recommendations and vehicle insights
                </p>
              </div>

              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-violet-400/50 bg-violet-500/10 text-violet-200 transition group-hover:bg-violet-500/20">
                <Mic size={21} />
              </div>
            </Link>

          </>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 items-end">
          <BottomNavItem label="Home" href="/" icon={Home} active />
          <BottomNavItem label="Journey" href="/navigation" icon={Navigation} />

          <Link
            href="/mira"
            aria-label="Open Mira"
            className="relative -top-4 mx-auto grid h-16 w-16 place-items-center rounded-full border-4 border-slate-950 bg-gradient-to-br from-blue-500 to-violet-500 shadow-[0_12px_35px_rgba(59,130,246,0.45)]"
          >
            <Sparkles size={26} />
          </Link>

          <BottomNavItem label="Documents" href="/documents" icon={FileText} />
          <BottomNavItem label="Profile" href="/profile" icon={User} />
        </div>
      </nav>

    </main>
  );
}

function VehicleDetail(props: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-blue-400/30"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
        {props.label}
      </p>
      <p className="mt-2 text-sm font-black text-slate-200">
        {props.value}
      </p>
    </Link>
  );
}

function GlanceRow(props: {
  label: string;
  value: string;
  href: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    props.tone === "success"
      ? "text-emerald-300"
      : props.tone === "warning"
        ? "text-amber-300"
        : props.tone === "danger"
          ? "text-rose-300"
          : "text-blue-300";

  return (
    <Link
      href={props.href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 transition hover:border-white/20"
    >
      <span className="text-sm text-slate-400">{props.label}</span>
      <span className={`text-xs font-black ${toneClass}`}>
        {props.value}
      </span>
    </Link>
  );
}

function BottomNavItem(props: {
  label: string;
  href: string;
  icon: typeof Home;
  active?: boolean;
}) {
  const Icon = props.icon;

  return (
    <Link
      href={props.href}
      className={`flex flex-col items-center gap-1 py-2 text-[10px] font-bold ${
        props.active ? "text-blue-300" : "text-slate-500"
      }`}
    >
      <Icon size={19} />
      {props.label}
    </Link>
  );
}