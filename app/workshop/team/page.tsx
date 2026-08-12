"use client";

import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type Membership = {
  workshop_id: string;
  role: string;
  is_active: boolean;
};

type Technician = {
  id: string;
  workshop_id: string;
  technician_name: string;
  employee_id: string | null;
  phone: string | null;
  specialization: string | null;
  experience: number | null;
  status: string;
};

export default function WorkshopTeamPage() {
  const router = useRouter();

  const [membership, setMembership] = useState<Membership | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const loadTeam = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("workshop_members")
        .select("workshop_id, role, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!member) {
        setMembership(null);
        setTechnicians([]);
        setMessage("This account is not linked to an active workshop.");
        return;
      }

      setMembership(member as Membership);

      const { data, error } = await supabase
        .from("service_technicians")
        .select(
          "id, workshop_id, technician_name, employee_id, phone, specialization, experience, status"
        )
        .eq("workshop_id", member.workshop_id)
        .order("technician_name", { ascending: true });

      if (error) throw error;

      setTechnicians((data || []) as Technician[]);
    } catch (error) {
      console.error("Workshop team load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load workshop technicians."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadTeam();

    const channel = supabase
      .channel("workshop-team-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_technicians",
        },
        () => void loadTeam(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTeam]);

  const visibleTechnicians = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return technicians;

    return technicians.filter((technician) =>
      [
        technician.technician_name,
        technician.employee_id || "",
        technician.specialization || "",
        technician.status || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, technicians]);

  const counts = useMemo(() => {
    const available = technicians.filter(
      (technician) => technician.status === "available"
    ).length;

    const busy = technicians.filter(
      (technician) => technician.status === "busy"
    ).length;

    return {
      total: technicians.length,
      available,
      busy,
      other: Math.max(technicians.length - available - busy, 0),
    };
  }, [technicians]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
            <p className="mt-4 text-sm font-bold text-slate-400">
              Loading technician team...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => router.push("/workshop")}
                className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-300 hover:text-white"
              >
                <ArrowLeft size={16} />
                Workshop Dashboard
              </button>

              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                Workshop Team
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Technician Availability
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                See who is available now, who is working on a job, and each
                technician&apos;s primary specialization.
              </p>

              {membership ? (
                <p className="mt-3 text-xs font-bold text-slate-600">
                  Workshop ID: {membership.workshop_id}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void loadTeam(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </header>

        {message ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
            {message}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users size={20} />}
            label="Total Team"
            value={counts.total}
          />

          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Available"
            value={counts.available}
          />

          <StatCard
            icon={<BriefcaseBusiness size={20} />}
            label="Busy"
            value={counts.busy}
          />

          <StatCard
            icon={<Clock3 size={20} />}
            label="Other Status"
            value={counts.other}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search technician, employee ID or specialization"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </section>

        {visibleTechnicians.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
            <UserRound size={38} className="mx-auto text-slate-600" />
            <h2 className="mt-4 text-lg font-black">
              No technicians found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Technician records for this workshop will appear here.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleTechnicians.map((technician) => (
              <TechnicianCard
                key={technician.id}
                technician={technician}
              />
            ))}
          </section>
        )}

        <section className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                Service Operations
              </p>
              <p className="mt-1 text-lg font-black">
                Technician status updates automatically with service jobs
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-100/60">
                Assigned technician becomes Busy. After delivery is completed,
                the technician returns to Available.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/workshop/bookings")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500"
            >
              Open Bookings
              <Wrench size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function TechnicianCard({
  technician,
}: {
  technician: Technician;
}) {
  const available = technician.status === "available";
  const busy = technician.status === "busy";

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
          <UserRound size={22} />
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
            available
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : busy
              ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-white/[0.04] text-slate-400"
          }`}
        >
          {technician.status || "unknown"}
        </span>
      </div>

      <h2 className="mt-4 text-xl font-black">
        {technician.technician_name}
      </h2>

      <p className="mt-1 text-xs font-bold text-slate-500">
        {technician.employee_id || "Employee ID not added"}
      </p>

      <div className="mt-5 space-y-3">
        <InfoRow
          icon={<Wrench size={15} />}
          label="Specialization"
          value={technician.specialization || "General Service"}
        />

        <InfoRow
          icon={<BadgeCheck size={15} />}
          label="Experience"
          value={`${technician.experience ?? 0} year${
            Number(technician.experience ?? 0) === 1 ? "" : "s"
          }`}
        />

        {technician.phone ? (
          <InfoRow
            icon={<UserRound size={15} />}
            label="Phone"
            value={technician.phone}
          />
        ) : null}
      </div>
    </article>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>

      <span className="text-right text-xs font-black text-slate-200">
        {value}
      </span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
          {icon}
        </div>

        <span className="text-3xl font-black">{value}</span>
      </div>

      <p className="mt-4 text-sm font-black">{label}</p>
    </div>
  );
}