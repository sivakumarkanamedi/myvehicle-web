"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Save,
  UserRound,
  Wrench,
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
  assigned_technician_id: string | null;
};

type Technician = {
  id: string;
  technician_name: string;
  specialization: string | null;
};

type EstimateItem = {
  id: string;
  item_type: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  requires_customer_approval: boolean;
  approval_status: string;
};

export default function RepairPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadRepair();
  }, [jobCardId]);

  async function loadRepair() {
    setLoading(true);
    setMessage("");

    try {
      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, job_card_number, status, customer_request, technician_notes, assigned_technician_id"
        )
        .eq("id", jobCardId)
        .single();

      if (cardError) throw cardError;

      setJobCard(card as JobCard);
      setNotes(card.technician_notes || "");

      if (card.assigned_technician_id) {
        const { data: tech, error: techError } = await supabase
          .from("service_technicians")
          .select("id, technician_name, specialization")
          .eq("id", card.assigned_technician_id)
          .single();

        if (techError) throw techError;
        setTechnician(tech as Technician);
      }

      const { data: estimateItems, error: itemsError } = await supabase
        .from("service_estimate_items")
        .select(
          "id, item_type, item_name, quantity, unit_price, requires_customer_approval, approval_status"
        )
        .eq("job_card_id", jobCardId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      const allowedItems = (estimateItems || []).filter((item) => {
        if (!item.requires_customer_approval) return true;
        return item.approval_status === "approved";
      });

      setItems(allowedItems as EstimateItem[]);

      if (card.status !== "service_in_progress") {
        const { error: cardStatusError } = await supabase
          .from("service_job_cards")
          .update({ status: "service_in_progress" })
          .eq("id", card.id);

        if (cardStatusError) throw cardStatusError;

        const { error: bookingStatusError } = await supabase
          .from("service_bookings")
          .update({ booking_status: "service_in_progress" })
          .eq("id", card.booking_id);

        if (bookingStatusError) throw bookingStatusError;

        setJobCard({
          ...(card as JobCard),
          status: "service_in_progress",
        });
      }
    } catch (error) {
      console.error("Repair load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load service work."
      );
    } finally {
      setLoading(false);
    }
  }

  const approvedTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantity) * Number(item.unit_price),
        0
      ),
    [items]
  );

  async function saveNotes() {
    if (!jobCard) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("service_job_cards")
        .update({
          technician_notes: notes.trim() || null,
        })
        .eq("id", jobCard.id);

      if (error) throw error;

      window.alert("Service progress saved.");
    } catch (error) {
      console.error("Save service notes error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save service progress."
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendToQualityCheck() {
    if (!jobCard) return;

    const confirmed = window.confirm(
      "Confirm service work is complete and send this vehicle to Quality Check?"
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
          `Booking owner lookup failed.\nMessage: ${ownerError.message ?? "none"}\nCode: ${ownerError.code ?? "none"}\nDetails: ${ownerError.details ?? "none"}`
        );
      }

      if (!bookingOwner?.user_id) {
        throw new Error("Customer user ID is missing from this booking.");
      }

      const { error: cardError } = await supabase
        .from("service_job_cards")
        .update({
          status: "quality_check",
          technician_notes: notes.trim() || null,
        })
        .eq("id", jobCard.id);

      if (cardError) {
        throw new Error(
          `Job Card Quality Check update failed.\nMessage: ${cardError.message ?? "none"}\nCode: ${cardError.code ?? "none"}\nDetails: ${cardError.details ?? "none"}\nHint: ${cardError.hint ?? "none"}`
        );
      }

      const { error: bookingError } = await supabase
        .from("service_bookings")
        .update({ booking_status: "quality_check" })
        .eq("id", jobCard.booking_id);

      if (bookingError) {
        throw new Error(
          `Booking Quality Check update failed.\nMessage: ${bookingError.message ?? "none"}\nCode: ${bookingError.code ?? "none"}\nDetails: ${bookingError.details ?? "none"}\nHint: ${bookingError.hint ?? "none"}`
        );
      }

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: bookingOwner.user_id,
          status: "quality_check",
          note: "Service work completed and vehicle sent to Quality Check.",
          changed_by_type: "service_advisor",
        });

      if (historyError) {
        throw new Error(
          `Quality Check history failed.\nMessage: ${historyError.message ?? "none"}\nCode: ${historyError.code ?? "none"}\nDetails: ${historyError.details ?? "none"}\nHint: ${historyError.hint ?? "none"}`
        );
      }

      router.push(
        `/workshop/quality-check?jobCardId=${encodeURIComponent(
          jobCard.id
        )}`
      );
    } catch (error: any) {
      console.error("FULL QUALITY CHECK TRANSITION ERROR:", error);

      const text =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        "Unable to send vehicle to Quality Check.";

      setMessage(text);

      window.alert(
        `Unable to send vehicle to Quality Check.\n\n${text}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">Loading service work...</p>
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
            Service In Progress
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Perform only the booked and customer-approved work, record progress,
            and send the vehicle to Quality Check when complete.
          </p>
        </header>

        {message ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {message}
          </section>
        ) : null}

        {jobCard ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <InfoBox label="Job Card" value={jobCard.job_card_number} />
              <InfoBox
                label="Customer Request"
                value={jobCard.customer_request || "—"}
              />
              <InfoBox
                label="Technician"
                value={technician?.technician_name || "Not assigned"}
              />
              <InfoBox
                label="Status"
                value={jobCard.status.replaceAll("_", " ")}
              />
            </section>

            <section className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-300">
                  <Wrench size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
                    Work Control
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    Approved work only
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-blue-100/70">
                    Rejected or still-pending additional work is excluded from
                    this service list automatically.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Approved Work
                  </p>
                  <h2 className="text-xl font-black">
                    Service Items
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                    No approved estimate items found.
                  </div>
                ) : (
                  items.map((item) => {
                    const amount =
                      Number(item.quantity) * Number(item.unit_price);

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-black">{item.item_name}</p>
                            <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                              {item.item_type}
                            </p>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-sm text-slate-400">
                              {item.quantity} × ₹
                              {Number(item.unit_price).toLocaleString("en-IN")}
                            </p>
                            <p className="mt-1 text-lg font-black">
                              ₹{amount.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <UserRound className="text-blue-300" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Assigned Technician
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {technician?.technician_name || "Not assigned"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {technician?.specialization || "General Service"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                  Approved Work Value
                </p>
                <p className="mt-2 text-3xl font-black">
                  ₹{approvedTotal.toLocaleString("en-IN")}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Service Progress
                  </p>
                  <h2 className="text-xl font-black">
                    Technician Notes
                  </h2>
                </div>
              </div>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={6}
                placeholder="Example: Engine oil replaced, brake adjusted, chain cleaned and lubricated..."
                className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none"
              />

              <button
                type="button"
                onClick={saveNotes}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
              >
                <Save size={17} />
                Save Progress
              </button>
            </section>

            <section className="rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <Clock3 className="mt-1 text-violet-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                    Next Stage
                  </p>
                  <p className="mt-1 text-lg font-black">
                    Quality Check
                  </p>
                  <p className="mt-2 text-sm leading-6 text-violet-100/70">
                    Once the approved service work is complete, send the vehicle
                    for final quality inspection before invoicing and delivery.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={sendToQualityCheck}
                disabled={saving}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-sm font-black disabled:opacity-50"
              >
                Service Complete – Quality Check
                <ArrowRight size={17} />
              </button>
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
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}