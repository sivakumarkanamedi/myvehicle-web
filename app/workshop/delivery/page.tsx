"use client";

import {
  CheckCircle2,
  FileCheck2,
  KeyRound,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../supabase";

type JobCard = {
  id: string;
  booking_id: string;
  job_card_number: string;
  customer_request: string | null;
  status: string;
  keys_received: number | null;
  helmet_received: boolean | null;
  accessories_received: string | null;
  assigned_technician_id: string | null;
};

type Booking = {
  id: string;
  booking_number: string;
  service_mode: "drive-in" | "pickup-drop";
  workshop_name: string;
  booking_status: string;
  user_id: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  total_amount: number;
  payment_status: string;
};

export default function DeliveryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [deliveredTo, setDeliveredTo] = useState("Owner");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [keysReturned, setKeysReturned] = useState("1");
  const [helmetReturned, setHelmetReturned] = useState(false);
  const [accessoriesReturned, setAccessoriesReturned] = useState("");
  const [customerConfirmed, setCustomerConfirmed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadDelivery();
  }, [jobCardId]);

  async function loadDelivery() {
    setLoading(true);
    setMessage("");

    try {
      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, job_card_number, customer_request, status, keys_received, helmet_received, accessories_received, assigned_technician_id"
        )
        .eq("id", jobCardId)
        .single();

      if (cardError) throw cardError;

      setJobCard(card as JobCard);
      setKeysReturned(String(card.keys_received ?? 1));
      setHelmetReturned(card.helmet_received ?? false);
      setAccessoriesReturned(card.accessories_received || "");

      const { data: bookingData, error: bookingError } = await supabase
        .from("service_bookings")
        .select(
          "id, booking_number, service_mode, workshop_name, booking_status, user_id"
        )
        .eq("id", card.booking_id)
        .single();

      if (bookingError) throw bookingError;

      setBooking(bookingData as Booking);

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("service_invoices")
        .select("id, invoice_number, total_amount, payment_status")
        .eq("job_card_id", jobCardId)
        .maybeSingle();

      if (invoiceError) throw invoiceError;

      setInvoice((invoiceData || null) as Invoice | null);
    } catch (error) {
      console.error("Delivery load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load delivery handover."
      );
    } finally {
      setLoading(false);
    }
  }

  async function completeDelivery() {
    if (!jobCard || !booking) return;

    if (!customerConfirmed) {
      window.alert(
        "Please confirm that the customer has received the vehicle and handover items."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in.");

      const { data: existing, error: existingError } = await supabase
        .from("service_delivery_records")
        .select("id")
        .eq("job_card_id", jobCard.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const payload = {
        job_card_id: jobCard.id,
        booking_id: jobCard.booking_id,
        invoice_id: invoice?.id || null,
        handover_mode: booking.service_mode,
        delivered_to: deliveredTo.trim() || "Owner",
        delivery_notes: deliveryNotes.trim() || null,
        keys_returned: Number(keysReturned) || 1,
        helmet_returned: helmetReturned,
        accessories_returned: accessoriesReturned.trim() || null,
        customer_confirmed: true,
        delivered_at: new Date().toISOString(),
        completed_by: user.id,
      };

      if (existing) {
        const { error } = await supabase
          .from("service_delivery_records")
          .update(payload)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_delivery_records")
          .insert(payload);

        if (error) throw error;
      }

      const { error: cardError } = await supabase
        .from("service_job_cards")
        .update({ status: "closed" })
        .eq("id", jobCard.id);

      if (cardError) throw cardError;

      const { error: bookingError } = await supabase
        .from("service_bookings")
        .update({ booking_status: "completed" })
        .eq("id", jobCard.booking_id);

      if (bookingError) throw bookingError;

      if (jobCard.assigned_technician_id) {
        const { error: technicianError } = await supabase
          .from("service_technicians")
          .update({ status: "available" })
          .eq("id", jobCard.assigned_technician_id);

        if (technicianError) {
          throw new Error(
            `Technician release failed.\nMessage: ${technicianError.message ?? "none"}\nCode: ${technicianError.code ?? "none"}\nDetails: ${technicianError.details ?? "none"}\nHint: ${technicianError.hint ?? "none"}`
          );
        }
      }

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: booking.user_id,
          status: "completed",
          note: "Vehicle delivered and service completed",
          changed_by_type: "service_advisor",
        });

      if (historyError) {
        throw new Error(
          `Completion history failed.\nMessage: ${historyError.message ?? "none"}\nCode: ${historyError.code ?? "none"}\nDetails: ${historyError.details ?? "none"}\nHint: ${historyError.hint ?? "none"}`
        );
      }

      window.alert(
        "Vehicle delivered. Service completed successfully. Technician is available for the next job."
      );

      router.push(
        `/workshop/bookings`
      );
    } catch (error: any) {
      console.error("FULL COMPLETE DELIVERY ERROR:", error);

      const text =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        "Unable to complete delivery.";

      setMessage(text);
      window.alert(`Unable to complete delivery.\n\n${text}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">Loading delivery handover...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            Final Stage
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Vehicle Delivery & Handover
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Complete the final handover, confirm returned items and close the
            service booking.
          </p>
        </header>

        {message ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {message}
          </section>
        ) : null}

        {jobCard && booking ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <InfoBox label="Job Card" value={jobCard.job_card_number} />
              <InfoBox label="Booking" value={booking.booking_number} />
              <InfoBox
                label="Service Mode"
                value={
                  booking.service_mode === "pickup-drop"
                    ? "Pickup & Drop"
                    : "Drive-in"
                }
              />
              <InfoBox
                label="Payment"
                value={
                  invoice
                    ? invoice.payment_status.replaceAll("_", " ")
                    : "Invoice not found"
                }
              />
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                    Final Handover Control
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Confirm vehicle and accessories before closing
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                    Confirm the handover once. My Vehicle will close the service
                    and save it to service history automatically.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <Truck className="text-blue-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Delivery Details
                  </p>

                  <h2 className="text-xl font-black">
                    Customer Handover
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <input
                  value={deliveredTo}
                  onChange={(event) => setDeliveredTo(event.target.value)}
                  placeholder="Delivered to / received by"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <select
                  value={keysReturned}
                  onChange={(event) => setKeysReturned(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                >
                  <option value="1">1 key returned</option>
                  <option value="2">2 keys returned</option>
                </select>

                <input
                  value={accessoriesReturned}
                  onChange={(event) =>
                    setAccessoriesReturned(event.target.value)
                  }
                  placeholder="Accessories returned"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <input
                    type="checkbox"
                    checked={helmetReturned}
                    onChange={(event) =>
                      setHelmetReturned(event.target.checked)
                    }
                  />

                  <span className="text-sm font-bold">
                    Helmet returned
                  </span>
                </label>

                <textarea
                  value={deliveryNotes}
                  onChange={(event) =>
                    setDeliveryNotes(event.target.value)
                  }
                  rows={4}
                  placeholder="Final delivery / handover notes"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none md:col-span-2"
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                icon={<KeyRound size={20} />}
                label="Keys"
                value={`${keysReturned} returned`}
              />

              <SummaryCard
                icon={<PackageCheck size={20} />}
                label="Accessories"
                value={accessoriesReturned || "None recorded"}
              />

              <SummaryCard
                icon={<FileCheck2 size={20} />}
                label="Invoice"
                value={
                  invoice
                    ? `${invoice.invoice_number} • ₹${Number(
                        invoice.total_amount
                      ).toLocaleString("en-IN")}`
                    : "Not available"
                }
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={customerConfirmed}
                  onChange={(event) =>
                    setCustomerConfirmed(event.target.checked)
                  }
                  className="mt-1"
                />

                <span>
                  <span className="block text-sm font-black">
                    Customer has received the vehicle and handover items
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Confirm vehicle, keys, helmet/accessories and final invoice
                    have been handed over.
                  </span>
                </span>
              </label>
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                    Complete Service
                  </p>

                  <p className="mt-1 text-lg font-black">
                    Close Job Card & Booking
                  </p>
                </div>

                <button
                  type="button"
                  onClick={completeDelivery}
                  disabled={!customerConfirmed || saving}
                  className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black ${
                    customerConfirmed && !saving
                      ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white"
                      : "cursor-not-allowed bg-white/10 text-slate-600"
                  }`}
                >
                  <CheckCircle2 size={18} />
                  {saving
                    ? "Completing..."
                    : "Complete Delivery"}
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
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
        {icon}
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}