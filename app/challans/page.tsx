"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeIndianRupee,
  Car,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  brand?: string | null;
  model?: string | null;
};

type ChallanRow = {
  id: number | string;
  vehicle_id?: number | null;
  challan_number?: string | null;
  notice_number?: string | null;
  violation?: string | null;
  violation_type?: string | null;
  offence?: string | null;
  description?: string | null;
  location?: string | null;
  challan_date?: string | null;
  violation_date?: string | null;
  created_at?: string | null;
  amount?: number | string | null;
  fine_amount?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_url?: string | null;
  official_payment_url?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not available";

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

function normalizeStatus(value: string | null | undefined) {
  const status = (value || "pending").toLowerCase().replaceAll("_", " ");

  if (
    status.includes("paid") ||
    status.includes("closed") ||
    status.includes("settled") ||
    status.includes("resolved")
  ) {
    return "paid";
  }

  return "pending";
}

function challanAmount(challan: ChallanRow) {
  const value = challan.amount ?? challan.fine_amount ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function challanTitle(challan: ChallanRow) {
  return (
    challan.violation ||
    challan.violation_type ||
    challan.offence ||
    challan.description ||
    "Traffic Challan"
  );
}

function challanNumber(challan: ChallanRow) {
  return challan.challan_number || challan.notice_number || `#${challan.id}`;
}

function challanDate(challan: ChallanRow) {
  return (
    challan.challan_date ||
    challan.violation_date ||
    challan.created_at ||
    null
  );
}

export default function ChallansPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [challans, setChallans] = useState<ChallanRow[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [challansLoading, setChallansLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("Please sign in to check challans.");
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("id, vehicle_name, vehicle_number, brand, model")
        .eq("user_id", user.id)
        .order("id", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as Vehicle[];
      setVehicles(rows);

      const savedVehicleId = Number(
        window.localStorage.getItem("myvehicle.activeVehicleId")
      );

      const nextVehicleId =
        rows.find((vehicle) => vehicle.id === savedVehicleId)?.id ||
        rows[0]?.id ||
        null;

      setSelectedVehicleId(nextVehicleId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load vehicles."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChallans = useCallback(async () => {
    if (!selectedVehicleId) {
      setChallans([]);
      return;
    }

    setChallansLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("Please sign in to check challans.");
        return;
      }

      const { data, error } = await supabase
        .from("challans")
        .select("*")
        .eq("user_id", user.id)
        .eq("vehicle_id", selectedVehicleId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setChallans((data || []) as ChallanRow[]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load traffic challans."
      );
      setChallans([]);
    } finally {
      setChallansLoading(false);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    if (selectedVehicleId) {
      window.localStorage.setItem(
        "myvehicle.activeVehicleId",
        String(selectedVehicleId)
      );
      void loadChallans();
    }
  }, [selectedVehicleId, loadChallans]);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [selectedVehicleId, vehicles]
  );

  const pendingChallans = useMemo(
    () =>
      challans.filter(
        (challan) =>
          normalizeStatus(challan.payment_status || challan.status) === "pending"
      ),
    [challans]
  );

  const paidChallans = useMemo(
    () =>
      challans.filter(
        (challan) =>
          normalizeStatus(challan.payment_status || challan.status) === "paid"
      ),
    [challans]
  );

  const pendingAmount = useMemo(
    () =>
      pendingChallans.reduce(
        (total, challan) => total + challanAmount(challan),
        0
      ),
    [pendingChallans]
  );

  const visibleChallans = useMemo(() => {
    const query = search.trim().toLowerCase();

    return challans.filter((challan) => {
      const status = normalizeStatus(
        challan.payment_status || challan.status
      );

      if (filter !== "all" && status !== filter) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        challanTitle(challan),
        challanNumber(challan),
        challan.location || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [challans, filter, search]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-28 rounded-3xl bg-white/5" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-3xl bg-white/5" />
            <div className="h-28 rounded-3xl bg-white/5" />
            <div className="h-28 rounded-3xl bg-white/5" />
          </div>
          <div className="h-80 rounded-3xl bg-white/5" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                <ShieldCheck size={27} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                  My Vehicle
                </p>
                <h1 className="mt-1 text-3xl font-black">Traffic Challans</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  View pending and paid challans for your selected vehicle in one
                  simple place.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadChallans()}
              disabled={challansLoading || !selectedVehicleId}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={challansLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </section>

        {errorMessage ? (
          <section className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {errorMessage}
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Active Vehicle
              </p>
              <h2 className="mt-1 text-xl font-black">
                {selectedVehicle?.vehicle_name ||
                  [selectedVehicle?.brand, selectedVehicle?.model]
                    .filter(Boolean)
                    .join(" ") ||
                  "Select Vehicle"}
              </h2>
              <p className="mt-1 text-sm font-bold text-blue-300">
                {selectedVehicle?.vehicle_number || "Registration not available"}
              </p>
            </div>

            <div className="w-full md:max-w-sm">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Vehicle
              </label>
              <select
                value={selectedVehicleId || ""}
                onChange={(event) =>
                  setSelectedVehicleId(Number(event.target.value))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3.5 text-sm font-bold text-white outline-none"
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_number ||
                      vehicle.vehicle_name ||
                      `Vehicle ${vehicle.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<AlertTriangle size={22} />}
            label="Pending"
            value={String(pendingChallans.length)}
            helper="Needs attention"
            tone="warning"
          />
          <SummaryCard
            icon={<BadgeIndianRupee size={22} />}
            label="Pending Amount"
            value={formatCurrency(pendingAmount)}
            helper="Recorded fine total"
            tone={pendingAmount > 0 ? "danger" : "success"}
          />
          <SummaryCard
            icon={<CheckCircle2 size={22} />}
            label="Paid"
            value={String(paidChallans.length)}
            helper="Completed challans"
            tone="success"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Challan Records
              </p>
              <h2 className="mt-1 text-xl font-black">
                Pending & Paid Challans
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search challan"
                  className="w-full min-w-64 rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-400/40"
                />
              </div>

              <div className="flex rounded-2xl border border-white/10 bg-slate-950/60 p-1">
                {(["all", "pending", "paid"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-xl px-4 py-2.5 text-xs font-black capitalize transition ${
                      filter === item
                        ? "bg-blue-500 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {challansLoading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
                Checking challans...
              </div>
            ) : visibleChallans.length === 0 ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 size={27} />
                </div>
                <h3 className="mt-4 text-lg font-black">
                  {filter === "pending"
                    ? "No pending challans"
                    : "No challans found"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {filter === "pending"
                    ? "There are no pending challans recorded for this vehicle."
                    : "No matching challan records are available."}
                </p>
              </div>
            ) : (
              visibleChallans.map((challan) => {
                const status = normalizeStatus(
                  challan.payment_status || challan.status
                );
                const amount = challanAmount(challan);
                const paymentUrl =
                  challan.official_payment_url || challan.payment_url || null;

                return (
                  <article
                    key={String(challan.id)}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-white/20"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                              status === "paid"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                            }`}
                          >
                            {status}
                          </span>

                          <span className="text-xs font-bold text-slate-500">
                            {challanNumber(challan)}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-white">
                          {challanTitle(challan)}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                          <span>{formatDate(challanDate(challan))}</span>
                          {challan.location ? (
                            <span>{challan.location}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            Fine Amount
                          </p>
                          <p className="mt-1 text-xl font-black">
                            {formatCurrency(amount)}
                          </p>
                        </div>

                        {status === "pending" && paymentUrl ? (
                          <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3 text-sm font-black text-white"
                          >
                            Pay
                          </a>
                        ) : status === "paid" ? (
                          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                            <CheckCircle2 size={21} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-blue-400/20 bg-blue-400/5 p-5">
          <div className="flex items-start gap-3">
            <FileText size={20} className="mt-0.5 shrink-0 text-blue-300" />
            <div>
              <h3 className="font-black">Official challan verification</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                This screen displays challan records available in My Vehicle.
                For payment or legal confirmation, use the official payment link
                when one is available.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-center">
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "warning" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-400/20 bg-rose-400/5 text-rose-300"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-400/5 text-amber-300"
        : "border-emerald-400/20 bg-emerald-400/5 text-emerald-300";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black/15">
          {icon}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
        </div>
      </div>

      <p className="mt-3 text-xs opacity-75">{helper}</p>
    </div>
  );
}