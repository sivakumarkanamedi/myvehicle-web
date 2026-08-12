"use client";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RotateCcw,
  Save,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type JobCard = {
  id: string;
  booking_id: string;
  job_card_number: string;
  status: string;
  customer_request: string | null;
  technician_notes: string | null;
};

type ChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
};

const INITIAL_QC: ChecklistItem[] = [
  { id: "service-work", label: "Approved service work verified", passed: false },
  { id: "brakes", label: "Brake operation checked", passed: false },
  { id: "tyres", label: "Tyres and wheel condition checked", passed: false },
  { id: "lights", label: "Lights and indicators checked", passed: false },
  { id: "leaks", label: "No visible oil / fluid leakage", passed: false },
  { id: "road-test", label: "Road test / functional check completed", passed: false },
  { id: "cleanliness", label: "Vehicle cleanliness checked", passed: false },
  { id: "handover", label: "Vehicle ready for customer handover", passed: false },
];

export default function QualityCheckPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [checklist, setChecklist] = useState(INITIAL_QC);
  const [qcNotes, setQcNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadQualityCheck();
  }, [jobCardId]);

  async function loadQualityCheck() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, job_card_number, status, customer_request, technician_notes"
        )
        .eq("id", jobCardId)
        .single();

      if (error) throw error;

      setJobCard(data as JobCard);

      if (data.status !== "quality_check") {
        const { error: updateError } = await supabase
          .from("service_job_cards")
          .update({ status: "quality_check" })
          .eq("id", data.id);

        if (updateError) throw updateError;

        const { error: bookingError } = await supabase
          .from("service_bookings")
          .update({ booking_status: "quality_check" })
          .eq("id", data.booking_id);

        if (bookingError) throw bookingError;

        setJobCard({
          ...(data as JobCard),
          status: "quality_check",
        });
      }
    } catch (error) {
      console.error("Quality check load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Quality Check."
      );
    } finally {
      setLoading(false);
    }
  }

  const passedCount = useMemo(
    () => checklist.filter((item) => item.passed).length,
    [checklist]
  );

  const allPassed = passedCount === checklist.length;

  function toggleItem(id: string) {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, passed: !item.passed }
          : item
      )
    );
  }

  async function saveQcNotes() {
    if (!jobCard) return;

    setSaving(true);

    try {
      const combinedNotes = [
        jobCard.technician_notes || "",
        qcNotes.trim()
          ? `QC Notes: ${qcNotes.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase
        .from("service_job_cards")
        .update({
          technician_notes: combinedNotes || null,
        })
        .eq("id", jobCard.id);

      if (error) throw error;

      window.alert("Quality Check notes saved.");
    } catch (error) {
      console.error("Save QC notes error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save Quality Check notes."
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendBackToService() {
    if (!jobCard) return;

    const confirmed = window.confirm(
      "Send the vehicle back to Service In Progress for rework?"
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const { data: bookingOwner, error: ownerError } = await supabase
        .from("service_bookings")
        .select("user_id")
        .eq("id", jobCard.booking_id)
        .single();

      if (ownerError) {
        throw new Error(
          `Booking owner lookup failed.\nMessage: ${ownerError.message ?? "none"}\nCode: ${ownerError.code ?? "none"}\nDetails: ${ownerError.details ?? "none"}\nHint: ${ownerError.hint ?? "none"}`
        );
      }

      if (!bookingOwner?.user_id) {
        throw new Error("Customer user ID is missing from this booking.");
      }

      const { error: cardError } = await supabase
        .from("service_job_cards")
        .update({ status: "service_in_progress" })
        .eq("id", jobCard.id);

      if (cardError) {
        throw new Error(
          `Job Card return-to-service update failed.\nMessage: ${cardError.message ?? "none"}\nCode: ${cardError.code ?? "none"}\nDetails: ${cardError.details ?? "none"}\nHint: ${cardError.hint ?? "none"}`
        );
      }

      const { error: bookingError } = await supabase
        .from("service_bookings")
        .update({ booking_status: "service_in_progress" })
        .eq("id", jobCard.booking_id);

      if (bookingError) {
        throw new Error(
          `Booking return-to-service update failed.\nMessage: ${bookingError.message ?? "none"}\nCode: ${bookingError.code ?? "none"}\nDetails: ${bookingError.details ?? "none"}\nHint: ${bookingError.hint ?? "none"}`
        );
      }

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: bookingOwner.user_id,
          status: "service_in_progress",
          note: "Quality Check requested rework. Vehicle returned to Service In Progress.",
          changed_by_type: "service_advisor",
        });

      if (historyError) {
        throw new Error(
          `Return-to-service history failed.\nMessage: ${historyError.message ?? "none"}\nCode: ${historyError.code ?? "none"}\nDetails: ${historyError.details ?? "none"}\nHint: ${historyError.hint ?? "none"}`
        );
      }

      router.push(
        `/workshop/repair?jobCardId=${encodeURIComponent(
          jobCard.id
        )}`
      );
    } catch (error: any) {
      console.error("FULL RETURN TO SERVICE ERROR:", error);

      const text =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        "Unable to return vehicle to service.";

      setMessage(text);

      window.alert(
        `Unable to return vehicle to service.\n\n${text}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveQc() {
    if (!jobCard) return;

    if (!allPassed) {
      window.alert(
        "Complete all Quality Check items before marking the vehicle ready."
      );
      return;
    }

    const confirmed = window.confirm(
      "Confirm Quality Check is complete and vehicle is ready for invoicing?"
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const { data: bookingOwner, error: ownerError } = await supabase
        .from("service_bookings")
        .select("user_id")
        .eq("id", jobCard.booking_id)
        .single();

      if (ownerError) {
        throw new Error(
          `Booking owner lookup failed.\nMessage: ${ownerError.message ?? "none"}\nCode: ${ownerError.code ?? "none"}\nDetails: ${ownerError.details ?? "none"}\nHint: ${ownerError.hint ?? "none"}`
        );
      }

      if (!bookingOwner?.user_id) {
        throw new Error("Customer user ID is missing from this booking.");
      }

      const { error: cardError } = await supabase
        .from("service_job_cards")
        .update({
          status: "completed",
        })
        .eq("id", jobCard.id);

      if (cardError) {
        throw new Error(
          `Job Card QC completion failed.\nMessage: ${cardError.message ?? "none"}\nCode: ${cardError.code ?? "none"}\nDetails: ${cardError.details ?? "none"}\nHint: ${cardError.hint ?? "none"}`
        );
      }

      const { error: bookingError } = await supabase
        .from("service_bookings")
        .update({ booking_status: "ready_for_delivery" })
        .eq("id", jobCard.booking_id);

      if (bookingError) {
        throw new Error(
          `Booking ready-for-delivery update failed.\nMessage: ${bookingError.message ?? "none"}\nCode: ${bookingError.code ?? "none"}\nDetails: ${bookingError.details ?? "none"}\nHint: ${bookingError.hint ?? "none"}`
        );
      }

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: bookingOwner.user_id,
          status: "ready_for_delivery",
          note: "Quality Check completed successfully. Vehicle is ready for invoicing and delivery.",
          changed_by_type: "service_advisor",
        });

      if (historyError) {
        throw new Error(
          `Quality Check completion history failed.\nMessage: ${historyError.message ?? "none"}\nCode: ${historyError.code ?? "none"}\nDetails: ${historyError.details ?? "none"}\nHint: ${historyError.hint ?? "none"}`
        );
      }

      router.push(
        `/workshop/invoice?jobCardId=${encodeURIComponent(
          jobCard.id
        )}`
      );
    } catch (error: any) {
      console.error("FULL COMPLETE QC ERROR:", error);

      const text =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        "Unable to complete Quality Check.";

      setMessage(text);

      window.alert(
        `Unable to complete Quality Check.\n\n${text}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">
          Loading Quality Check...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            Workshop Operations
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Quality Check
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Perform the final inspection before invoicing and
            vehicle delivery.
          </p>
        </header>

        {message ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {message}
          </section>
        ) : null}

        {jobCard ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <InfoBox
                label="Job Card"
                value={jobCard.job_card_number}
              />
              <InfoBox
                label="Customer Request"
                value={jobCard.customer_request || "—"}
              />
              <InfoBox
                label="Status"
                value={jobCard.status.replaceAll("_", " ")}
              />
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                    Final Gate
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    Vehicle cannot move to invoicing until QC is passed
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                    If any item fails, send the vehicle back for rework.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Final QC Checklist
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {passedCount}/{checklist.length} Passed
                  </h2>
                </div>

                <ClipboardCheck className="text-emerald-300" />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      item.passed
                        ? "border-emerald-400/30 bg-emerald-500/15"
                        : "border-white/10 bg-slate-950/35"
                    }`}
                  >
                    {item.passed ? (
                      <CheckCircle2
                        size={20}
                        className="text-emerald-300"
                      />
                    ) : (
                      <XCircle
                        size={20}
                        className="text-slate-600"
                      />
                    )}

                    <span className="text-sm font-bold">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-300" />

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Quality Check Notes
                  </p>
                  <h2 className="text-xl font-black">
                    Final Inspector Notes
                  </h2>
                </div>
              </div>

              <textarea
                value={qcNotes}
                onChange={(event) =>
                  setQcNotes(event.target.value)
                }
                rows={5}
                placeholder="Example: Road test completed. Brakes normal. No leakage observed. Vehicle ready for delivery."
                className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none"
              />

              <button
                type="button"
                onClick={saveQcNotes}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
              >
                <Save size={17} />
                Save QC Notes
              </button>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={sendBackToService}
                disabled={saving}
                className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-left shadow-xl transition hover:bg-amber-400/15"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
                    <RotateCcw size={20} />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">
                      QC Failed
                    </p>
                    <p className="mt-1 text-lg font-black">
                      Send Back for Rework
                    </p>
                    <p className="mt-2 text-sm text-amber-100/60">
                      Return the vehicle to Service In Progress.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={approveQc}
                disabled={!allPassed || saving}
                className={`rounded-3xl border p-5 text-left shadow-xl transition ${
                  allPassed
                    ? "border-emerald-400/30 bg-emerald-500/15"
                    : "cursor-not-allowed border-white/10 bg-white/[0.03] opacity-50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-2xl ${
                      allPassed
                        ? "bg-emerald-500 text-white"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    <CheckCircle2 size={20} />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                      QC Passed
                    </p>
                    <p className="mt-1 text-lg font-black">
                      Ready for Invoice
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Complete final QC and continue to invoicing.
                    </p>
                  </div>
                </div>
              </button>
            </section>

            <section className="rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                    Next Stage
                  </p>
                  <p className="mt-1 text-lg font-black">
                    Invoice & Delivery
                  </p>
                </div>

                <button
                  type="button"
                  onClick={approveQc}
                  disabled={!allPassed || saving}
                  className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black ${
                    allPassed
                      ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                      : "cursor-not-allowed bg-white/10 text-slate-600"
                  }`}
                >
                  Complete QC & Continue
                  <ArrowRight size={17} />
                </button>
              </div>
            </section>
          </>
        ) : null}
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">
        {value}
      </p>
    </div>
  );
}