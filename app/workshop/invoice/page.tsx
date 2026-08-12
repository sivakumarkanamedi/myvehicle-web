"use client";

import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Receipt,
  Save,
  WalletCards,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type JobCard = {
  id: string;
  booking_id: string;
  job_card_number: string;
  customer_request: string | null;
  status: string;
};

type EstimateItem = {
  id: string;
  item_name: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  requires_customer_approval: boolean;
  approval_status: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
};

function createInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = String(Date.now()).slice(-6);

  return `INV-${y}${m}${d}-${suffix}`;
}

export default function InvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [paymentReference, setPaymentReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadInvoice();
  }, [jobCardId]);

  async function loadInvoice() {
    setLoading(true);
    setMessage("");

    try {
      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, job_card_number, customer_request, status"
        )
        .eq("id", jobCardId)
        .single();

      if (cardError) throw cardError;
      setJobCard(card as JobCard);

      const { data: estimateItems, error: itemsError } = await supabase
        .from("service_estimate_items")
        .select(
          "id, item_name, item_type, quantity, unit_price, requires_customer_approval, approval_status"
        )
        .eq("job_card_id", jobCardId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      const billableItems = (estimateItems || []).filter((item) => {
        if (!item.requires_customer_approval) return true;
        return item.approval_status === "approved";
      });

      setItems(billableItems as EstimateItem[]);

      const { data: existingInvoice, error: invoiceError } = await supabase
        .from("service_invoices")
        .select(
          "id, invoice_number, subtotal, tax_amount, total_amount, payment_status, payment_method, payment_reference"
        )
        .eq("job_card_id", jobCardId)
        .maybeSingle();

      if (invoiceError) throw invoiceError;

      if (existingInvoice) {
        setInvoice(existingInvoice as Invoice);
        setPaymentMethod(existingInvoice.payment_method || "upi");
        setPaymentReference(existingInvoice.payment_reference || "");
      }
    } catch (error) {
      console.error("Invoice load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load invoice."
      );
    } finally {
      setLoading(false);
    }
  }

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantity) * Number(item.unit_price),
        0
      ),
    [items]
  );

  const taxAmount = useMemo(() => subtotal * 0.18, [subtotal]);
  const totalAmount = useMemo(
    () => subtotal + taxAmount,
    [subtotal, taxAmount]
  );

  async function createOrUpdateInvoice() {
    if (!jobCard) return;

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in.");

      if (invoice) {
        const { error } = await supabase
          .from("service_invoices")
          .update({
            subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
          })
          .eq("id", invoice.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("service_invoices")
          .insert({
            job_card_id: jobCard.id,
            booking_id: jobCard.booking_id,
            invoice_number: createInvoiceNumber(),
            subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_status: "pending",
            created_by: user.id,
          })
          .select(
            "id, invoice_number, subtotal, tax_amount, total_amount, payment_status, payment_method, payment_reference"
          )
          .single();

        if (error) throw error;

        setInvoice(data as Invoice);
      }

      window.alert("Invoice saved successfully.");
      await loadInvoice();
    } catch (error) {
      console.error("Save invoice error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!jobCard) return;

    if (!invoice) {
      window.alert("Please save the invoice first.");
      return;
    }

    const confirmed = window.confirm(
      `Mark invoice ${invoice.invoice_number} as paid?`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("service_invoices")
        .update({
          payment_status: "paid",
          payment_method: paymentMethod,
          payment_reference: paymentReference.trim() || null,
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (error) throw error;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in.");

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: user.id,
          status: "payment_completed",
          note: `Payment completed for invoice ${invoice.invoice_number} via ${paymentMethod.replaceAll(
            "_",
            " "
          )}.`,
          changed_by_type: "workshop",
        });

      if (historyError) throw historyError;

      window.alert("Payment recorded successfully.");
      await loadInvoice();
    } catch (error) {
      console.error("Payment update error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  async function continueToDelivery() {
    if (!jobCard) return;

    const paymentStatus = invoice?.payment_status || "pending";

    if (paymentStatus !== "paid") {
      const confirmed = window.confirm(
        "Payment is still pending. Continue to Delivery anyway?"
      );

      if (!confirmed) return;
    }

    router.push(
      `/workshop/delivery?jobCardId=${encodeURIComponent(jobCard.id)}`
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">Loading invoice...</p>
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
            Invoice & Payment
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Generate the final invoice from billable service items, record
            payment, and move the vehicle to delivery handover.
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
                label="Invoice"
                value={invoice?.invoice_number || "Not created"}
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <Receipt className="text-blue-300" />

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Final Bill
                  </p>

                  <h2 className="text-xl font-black">
                    Invoice Items
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                    No billable service items found.
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
                              {Number(item.unit_price).toLocaleString(
                                "en-IN"
                              )}
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

            <section className="grid gap-4 md:grid-cols-3">
              <TotalCard
                label="Subtotal"
                value={`₹${subtotal.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}`}
              />

              <TotalCard
                label="GST (18%)"
                value={`₹${taxAmount.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}`}
              />

              <TotalCard
                label="Total"
                value={`₹${totalAmount.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}`}
                emphasized
              />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Invoice Status
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {invoice
                      ? invoice.payment_status.replaceAll("_", " ")
                      : "Invoice not created"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={createOrUpdateInvoice}
                  disabled={saving || items.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black disabled:opacity-50"
                >
                  <Save size={17} />
                  {invoice ? "Update Invoice" : "Create Invoice"}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <CreditCard className="text-emerald-300" />

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                    Payment
                  </p>

                  <h2 className="text-xl font-black">
                    Record Customer Payment
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>

                <input
                  value={paymentReference}
                  onChange={(event) =>
                    setPaymentReference(event.target.value)
                  }
                  placeholder="Payment reference / transaction ID"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />
              </div>

              <button
                type="button"
                onClick={markPaid}
                disabled={
                  saving ||
                  !invoice ||
                  invoice.payment_status === "paid"
                }
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={17} />
                {invoice?.payment_status === "paid"
                  ? "Payment Completed"
                  : "Mark as Paid"}
              </button>
            </section>

            <section className="rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                    Next Stage
                  </p>

                  <p className="mt-1 text-lg font-black">
                    Vehicle Delivery & Handover
                  </p>
                </div>

                <button
                  type="button"
                  onClick={continueToDelivery}
                  disabled={!invoice || saving}
                  className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black ${
                    invoice
                      ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                      : "cursor-not-allowed bg-white/10 text-slate-600"
                  }`}
                >
                  Continue to Delivery
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

function TotalCard({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-xl ${
        emphasized
          ? "border-blue-400/30 bg-blue-500/15"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-2">
        <WalletCards
          size={17}
          className={
            emphasized ? "text-blue-300" : "text-slate-500"
          }
        />

        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
      </div>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}