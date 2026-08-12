"use client";

import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Search,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type Technician = {
  id: string;
  workshop_id: string;
  technician_name: string;
  employee_id: string | null;
  phone: string | null;
  specialization: string | null;
  experience: number | null;
  status: string | null;
};

type BookingDetails = {
  booking_number: string;
  service_name: string;
  workshop_name: string;
  booking_date: string;
  booking_time: string;
  user_id: string;
};

type JobCard = {
  id: string;
  booking_id: string;
  workshop_id: string;
  job_card_number: string;
  status: string;
  customer_request: string | null;
  assigned_technician_id: string | null;
  assigned_at: string | null;

  service_bookings:
    | BookingDetails
    | BookingDetails[]
    | null;
};

function bookingDetails(jobCard: JobCard): BookingDetails | null {
  if (Array.isArray(jobCard.service_bookings)) {
    return jobCard.service_bookings[0] ?? null;
  }

  return jobCard.service_bookings;
}

function getSupabaseErrorMessage(error: any) {
  return [
    `Message: ${error?.message ?? "none"}`,
    `Code: ${error?.code ?? "none"}`,
    `Details: ${error?.details ?? "none"}`,
    `Hint: ${error?.hint ?? "none"}`,
  ].join("\n");
}

export default function TechnicianAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedJobCardId =
    searchParams.get("jobCardId") || "";

  const [jobCards, setJobCards] =
    useState<JobCard[]>([]);

  const [selectedJobCardId, setSelectedJobCardId] =
    useState(requestedJobCardId);

  const [technicians, setTechnicians] =
    useState<Technician[]>([]);

  const [
    selectedTechnicianId,
    setSelectedTechnicianId,
  ] = useState("");

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadJobCards();
  }, []);

  useEffect(() => {
    const selected = jobCards.find(
      (jobCard) =>
        jobCard.id === selectedJobCardId
    );

    if (!selected) {
      setTechnicians([]);
      return;
    }

    loadTechnicians(selected.workshop_id);
  }, [selectedJobCardId, jobCards]);

  async function loadJobCards() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("Please sign in.");
      }

      const { data, error } = await supabase
        .from("service_job_cards")
        .select(`
          id,
          booking_id,
          workshop_id,
          job_card_number,
          status,
          customer_request,
          assigned_technician_id,
          assigned_at,
          service_bookings (
            booking_number,
            service_name,
            workshop_name,
            booking_date,
            booking_time,
            user_id
          )
        `)
        .in("status", [
          "created",
          "inspection_started",
          "estimate_prepared",
          "approval_pending",
          "approved",
          "service_in_progress",
        ])
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      const rows = (data || []) as JobCard[];

      setJobCards(rows);

      if (requestedJobCardId) {
        setSelectedJobCardId(
          requestedJobCardId
        );
      } else if (rows.length > 0) {
        setSelectedJobCardId(rows[0].id);
      }
    } catch (error: any) {
      console.error(
        "Load job cards error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to load Digital Job Cards."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadTechnicians(
    workshopId: string
  ) {
    try {
      setMessage("");

      const { data, error } = await supabase
        .from("service_technicians")
        .select(
          "id, workshop_id, technician_name, employee_id, phone, specialization, experience, status"
        )
        .eq("workshop_id", workshopId)
        .eq("status", "available")
        .order("technician_name", {
          ascending: true,
        });

      if (error) throw error;

      setTechnicians(
        (data || []) as Technician[]
      );
    } catch (error: any) {
      console.error(
        "Load technicians error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to load technicians."
      );
    }
  }

  const selectedJobCard = useMemo(
    () =>
      jobCards.find(
        (jobCard) =>
          jobCard.id === selectedJobCardId
      ) || null,
    [jobCards, selectedJobCardId]
  );

  const visibleTechnicians = useMemo(() => {
    const normalized =
      query.trim().toLowerCase();

    return technicians.filter(
      (technician) => {
        if (!normalized) return true;

        return [
          technician.technician_name,
          technician.employee_id || "",
          technician.specialization || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      }
    );
  }, [technicians, query]);

  async function assignTechnician() {
    if (!selectedJobCard) {
      window.alert(
        "Please select a Digital Job Card."
      );
      return;
    }

    if (!selectedTechnicianId) {
      window.alert(
        "Please select a technician."
      );
      return;
    }

    const technician = technicians.find(
      (item) =>
        item.id === selectedTechnicianId
    );

    if (!technician) {
      window.alert(
        "Selected technician could not be found."
      );
      return;
    }

    if (
      technician.workshop_id !==
      selectedJobCard.workshop_id
    ) {
      window.alert(
        "This technician does not belong to the selected workshop."
      );
      return;
    }

    const booking =
      bookingDetails(selectedJobCard);

    if (!booking) {
      window.alert(
        "Booking details could not be found."
      );
      return;
    }

    if (!booking.user_id) {
      window.alert(
        "Customer user ID is missing from this booking."
      );
      return;
    }

    setAssigning(true);
    setMessage("");

    try {
      const assignedAt =
        new Date().toISOString();

      /*
       * STEP 1
       * Assign technician to Digital Job Card
       */
      const {
        error: jobCardError,
      } = await supabase
        .from("service_job_cards")
        .update({
          assigned_technician_id:
            technician.id,
          assigned_at: assignedAt,
          status: "inspection_started",
        })
        .eq("id", selectedJobCard.id);

      if (jobCardError) {
        console.error(
          "JOB CARD UPDATE ERROR:",
          jobCardError
        );

        throw new Error(
          `Job Card update failed.\n${getSupabaseErrorMessage(
            jobCardError
          )}`
        );
      }

      /*
       * STEP 2
       * Update customer booking status
       */
      const {
        error: bookingError,
      } = await supabase
        .from("service_bookings")
        .update({
          booking_status:
            "inspection_started",
        })
        .eq(
          "id",
          selectedJobCard.booking_id
        );

      if (bookingError) {
        console.error(
          "BOOKING UPDATE ERROR:",
          bookingError
        );

        throw new Error(
          `Booking update failed.\n${getSupabaseErrorMessage(
            bookingError
          )}`
        );
      }

      /*
       * STEP 3
       * Create booking status history.
       *
       * IMPORTANT:
       * user_id must be the CUSTOMER who owns
       * the service booking.
       *
       * It must NOT be the logged-in workshop
       * employee's user ID.
       */
      const {
        error: historyError,
      } = await supabase
        .from(
          "service_booking_status_history"
        )
        .insert({
          booking_id:
            selectedJobCard.booking_id,

          user_id: booking.user_id,

          status:
            "inspection_started",

          note: `${technician.technician_name} assigned. Technician inspection started.`,

          changed_by_type:
            "service_advisor",
        });

      if (historyError) {
        console.error(
          "STATUS HISTORY ERROR:",
          historyError
        );

        throw new Error(
          `Status history failed.\n${getSupabaseErrorMessage(
            historyError
          )}`
        );
      }

      /*
       * STEP 4
       * Technician becomes BUSY.
       */
      const {
        error: technicianError,
      } = await supabase
        .from("service_technicians")
        .update({
          status: "busy",
        })
        .eq("id", technician.id);

      if (technicianError) {
        console.error(
          "TECHNICIAN STATUS ERROR:",
          technicianError
        );

        throw new Error(
          `Technician status update failed.\n${getSupabaseErrorMessage(
            technicianError
          )}`
        );
      }

      /*
       * SUCCESS
       */
      window.alert(
        `${technician.technician_name} assigned successfully to ${selectedJobCard.job_card_number}.\n\nInspection Started.`
      );

      router.push(
        `/workshop/inspection?jobCardId=${encodeURIComponent(
          selectedJobCard.id
        )}`
      );
    } catch (error: any) {
      console.error(
        "FULL ASSIGN TECHNICIAN ERROR:",
        error
      );

      const text =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        "Unable to assign technician.";

      setMessage(text);

      window.alert(
        `Unable to assign technician.

${text}`
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-400">
            Loading Digital Job Cards...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">

          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
            Workshop Operations
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Technician Assignment
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Assign the right technician to the
            Digital Job Card before inspection
            begins.
          </p>

        </header>

        {message ? (
          <section className="whitespace-pre-wrap rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {message}
          </section>
        ) : null}

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-xl">

          <div className="flex items-start gap-4">

            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500">
              <Sparkles size={22} />
            </div>

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                Assignment Rule
              </p>

              <h2 className="mt-1 text-xl font-black">
                Technician must belong to the
                same workshop
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Only technicians registered
                against the selected Job
                Card&apos;s workshop are shown.
              </p>

            </div>

          </div>

        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">

          <label className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
            Digital Job Card
          </label>

          <select
            value={selectedJobCardId}
            onChange={(event) => {
              setSelectedJobCardId(
                event.target.value
              );

              setSelectedTechnicianId("");
            }}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm font-bold text-white outline-none"
          >

            {jobCards.length === 0 ? (
              <option value="">
                No active Job Cards
              </option>
            ) : null}

            {jobCards.map((jobCard) => {
              const booking =
                bookingDetails(jobCard);

              return (
                <option
                  key={jobCard.id}
                  value={jobCard.id}
                >
                  {jobCard.job_card_number}
                  {" — "}
                  {booking?.service_name ||
                    jobCard.customer_request ||
                    "Service"}
                </option>
              );
            })}

          </select>

          {selectedJobCard ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              <InfoBox
                label="Job Card"
                value={
                  selectedJobCard.job_card_number
                }
              />

              <InfoBox
                label="Booking"
                value={
                  bookingDetails(
                    selectedJobCard
                  )?.booking_number || "—"
                }
              />

              <InfoBox
                label="Service"
                value={
                  bookingDetails(
                    selectedJobCard
                  )?.service_name ||
                  selectedJobCard.customer_request ||
                  "—"
                }
              />

              <InfoBox
                label="Workshop"
                value={
                  bookingDetails(
                    selectedJobCard
                  )?.workshop_name ||
                  selectedJobCard.workshop_id
                }
              />

            </div>
          ) : null}

        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Available Team
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Choose Technician
              </h2>

            </div>

            <div className="relative w-full md:max-w-sm">

              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Search technician or skill"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none"
              />

            </div>

          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

            {visibleTechnicians.map(
              (technician) => {
                const active =
                  selectedTechnicianId ===
                  technician.id;

                return (
                  <button
                    key={technician.id}
                    type="button"
                    onClick={() =>
                      setSelectedTechnicianId(
                        technician.id
                      )
                    }
                    className={`rounded-3xl border p-5 text-left transition ${
                      active
                        ? "border-blue-400/40 bg-blue-500/15"
                        : "border-white/10 bg-slate-950/35 hover:bg-white/[0.05]"
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
                        <UserRound size={23} />
                      </div>

                      {active ? (
                        <CheckCircle2
                          size={21}
                          className="text-emerald-300"
                        />
                      ) : (
                        <BadgeCheck
                          size={20}
                          className="text-slate-600"
                        />
                      )}

                    </div>

                    <h3 className="mt-4 text-lg font-black">
                      {
                        technician.technician_name
                      }
                    </h3>

                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {technician.employee_id ||
                        "Employee"}
                    </p>

                    <div className="mt-4 space-y-2 text-sm text-slate-400">

                      <p className="flex items-center gap-2">
                        <Wrench size={15} />

                        {technician.specialization ||
                          "General Service"}
                      </p>

                      <p className="flex items-center gap-2">
                        <Clock3 size={15} />

                        {technician.experience ??
                          0}{" "}
                        years experience
                      </p>

                    </div>

                    <span
                      className={`mt-4 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        technician.status ===
                        "available"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {technician.status ||
                        "available"}
                    </span>

                  </button>
                );
              }
            )}

          </div>

          {visibleTechnicians.length ===
          0 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-6 text-center text-sm text-slate-500">
              No technicians found for this
              workshop.
            </div>
          ) : null}

        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Next Step
              </p>

              <p className="mt-1 text-lg font-black">

                {selectedTechnicianId
                  ? `${
                      technicians.find(
                        (technician) =>
                          technician.id ===
                          selectedTechnicianId
                      )?.technician_name
                    } selected`
                  : "Select a technician"}

              </p>

            </div>

            <button
              type="button"
              disabled={
                !selectedJobCardId ||
                !selectedTechnicianId ||
                assigning
              }
              onClick={assignTechnician}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black ${
                selectedJobCardId &&
                selectedTechnicianId &&
                !assigning
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                  : "cursor-not-allowed bg-white/10 text-slate-600"
              }`}
            >

              {assigning
                ? "Assigning..."
                : "Assign & Start Inspection"}

              {!assigning ? (
                <ArrowRight size={17} />
              ) : null}

            </button>

          </div>

        </section>

      </div>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">

      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-white">
        {value}
      </p>

    </div>
  );
}