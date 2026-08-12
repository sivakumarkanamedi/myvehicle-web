"use client";

import {
  ArrowRight,
  Calculator,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type JobCard = {
  id: string;
  booking_id: string;
  workshop_id: string;
  job_card_number: string;
  status: string;
  customer_request: string | null;
};

type EstimateItem = {
  id: string;
  item_type: "service" | "part" | "labour" | "other";
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  requires_customer_approval: boolean;
};

type DraftItem = {
  item_type: "service" | "part" | "labour" | "other";
  item_name: string;
  description: string;
  quantity: string;
  unit_price: string;
  requires_customer_approval: boolean;
};

const EMPTY_ITEM: DraftItem = {
  item_type: "service",
  item_name: "",
  description: "",
  quantity: "1",
  unit_price: "",
  requires_customer_approval: false,
};

export default function EstimatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [draft, setDraft] = useState<DraftItem>(EMPTY_ITEM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadEstimate();
  }, [jobCardId]);

  async function loadEstimate() {
    setLoading(true);
    setMessage("");

    try {
      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, workshop_id, job_card_number, status, customer_request"
        )
        .eq("id", jobCardId)
        .single();

      if (cardError) throw cardError;
      setJobCard(card as JobCard);

      const { data: estimateItems, error: itemsError } = await supabase
        .from("service_estimate_items")
        .select(
          "id, item_type, item_name, description, quantity, unit_price, requires_customer_approval"
        )
        .eq("job_card_id", jobCardId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;
      setItems((estimateItems || []) as EstimateItem[]);
    } catch (error) {
      console.error("Estimate load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load estimate."
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

  const tax = useMemo(() => subtotal * 0.18, [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const hasApprovalItems = useMemo(
    () => items.some((item) => item.requires_customer_approval),
    [items]
  );

  async function addItem() {
    if (!jobCard) return;

    const quantity = Number(draft.quantity);
    const unitPrice = Number(draft.unit_price);

    if (!draft.item_name.trim()) {
      window.alert("Please enter the item/service name.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      window.alert("Please enter a valid quantity.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      window.alert("Please enter a valid price.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in.");

      const { error } = await supabase
        .from("service_estimate_items")
        .insert({
          job_card_id: jobCard.id,
          booking_id: jobCard.booking_id,
          item_type: draft.item_type,
          item_name: draft.item_name.trim(),
          description: draft.description.trim() || null,
          quantity,
          unit_price: unitPrice,
          requires_customer_approval:
            draft.requires_customer_approval,
          created_by: user.id,
        });

      if (error) throw error;

      setDraft(EMPTY_ITEM);
      await loadEstimate();
    } catch (error) {
      console.error("Add estimate item error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to add estimate item."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    const confirmed = window.confirm(
      "Remove this item from the estimate?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("service_estimate_items")
      .delete()
      .eq("id", id);

    if (error) {
      window.alert(error.message);
      return;
    }

    await loadEstimate();
  }

  async function continueEstimate() {
    if (!jobCard) return;

    if (items.length === 0) {
      window.alert("Add at least one estimate item.");
      return;
    }

    setSaving(true);

    try {
      const nextJobStatus = hasApprovalItems
        ? "approval_pending"
        : "approved";

      const nextBookingStatus = hasApprovalItems
        ? "approval_required"
        : "service_in_progress";

      const { error: cardError } = await supabase
        .from("service_job_cards")
        .update({ status: nextJobStatus })
        .eq("id", jobCard.id);

      if (cardError) throw cardError;

      const { error: bookingError } = await supabase
        .from("service_bookings")
        .update({ booking_status: nextBookingStatus })
        .eq("id", jobCard.booking_id);

      if (bookingError) throw bookingError;

      if (hasApprovalItems) {
        router.push(
          `/workshop/approval?jobCardId=${encodeURIComponent(
            jobCard.id
          )}`
        );
      } else {
        router.push(
          `/workshop/repair?jobCardId=${encodeURIComponent(
            jobCard.id
          )}`
        );
      }
    } catch (error) {
      console.error("Continue estimate error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to continue estimate."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">Loading estimate...</p>
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
            Service Estimate
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Build a transparent estimate with service, parts and labour
            before work begins.
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

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <Plus className="text-blue-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Add Estimate Item
                  </p>
                  <h2 className="text-xl font-black">
                    Service / Part / Labour
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <select
                  value={draft.item_type}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      item_type: event.target
                        .value as DraftItem["item_type"],
                    })
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                >
                  <option value="service">Service</option>
                  <option value="part">Part</option>
                  <option value="labour">Labour</option>
                  <option value="other">Other</option>
                </select>

                <input
                  value={draft.item_name}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      item_name: event.target.value,
                    })
                  }
                  placeholder="Item / service name"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <input
                  value={draft.quantity}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      quantity: event.target.value,
                    })
                  }
                  placeholder="Quantity"
                  inputMode="decimal"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <input
                  value={draft.unit_price}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      unit_price: event.target.value,
                    })
                  }
                  placeholder="Unit price ₹"
                  inputMode="decimal"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Description (optional)"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none md:col-span-2"
                />
              </div>

              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <input
                  type="checkbox"
                  checked={draft.requires_customer_approval}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      requires_customer_approval:
                        event.target.checked,
                    })
                  }
                />
                <span>
                  <span className="block text-sm font-black">
                    Customer approval required
                  </span>
                  <span className="mt-1 block text-xs text-amber-100/60">
                    Mark additional or unexpected work that requires
                    customer consent.
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={addItem}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black hover:bg-blue-500"
              >
                <Plus size={17} />
                Add to Estimate
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Estimate Breakdown
                  </p>
                  <h2 className="text-xl font-black">Items</h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                    No estimate items added yet.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black">
                            {item.item_name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                            {item.item_type}
                          </p>
                          {item.description ? (
                            <p className="mt-2 text-sm text-slate-400">
                              {item.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-black">
                              {item.quantity} × ₹
                              {Number(item.unit_price).toLocaleString(
                                "en-IN"
                              )}
                            </p>
                            <p className="mt-1 text-lg font-black">
                              ₹
                              {(
                                Number(item.quantity) *
                                Number(item.unit_price)
                              ).toLocaleString("en-IN")}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="grid h-10 w-10 place-items-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-200"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {item.requires_customer_approval ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200">
                          <ShieldCheck size={14} />
                          Customer Approval Required
                        </div>
                      ) : null}
                    </div>
                  ))
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
                value={`₹${tax.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}`}
              />
              <TotalCard
                label="Estimated Total"
                value={`₹${total.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}`}
                emphasized
              />
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                    Estimate Ready
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {hasApprovalItems
                      ? "Send estimate for customer approval"
                      : "No additional approval required"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={continueEstimate}
                  disabled={saving || items.length === 0}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {hasApprovalItems
                    ? "Send for Approval"
                    : "Start Service"}
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
      <p className="mt-2 text-lg font-black">{value}</p>
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
        <Calculator
          size={17}
          className={
            emphasized ? "text-blue-300" : "text-slate-500"
          }
        />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}