"use client";

import {
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type JobCard = {
  id: string;
  booking_id: string;
  job_card_number: string;
  customer_user_id: string;
  customer_request: string | null;
  status: string;
};

type ApprovalItem = {
  id: string;
  item_type: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  approval_status: "pending" | "approved" | "rejected" | "not_required";
  approval_note: string | null;
};

export default function CustomerApprovalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadApproval();
  }, [jobCardId]);

  async function loadApproval() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, job_card_number, customer_user_id, customer_request, status"
        )
        .eq("id", jobCardId)
        .eq("customer_user_id", user.id)
        .single();

      if (cardError) throw cardError;

      setJobCard(card as JobCard);

      const { data: approvalItems, error: itemsError } = await supabase
        .from("service_estimate_items")
        .select(
          "id, item_type, item_name, description, quantity, unit_price, approval_status, approval_note"
        )
        .eq("job_card_id", jobCardId)
        .eq("requires_customer_approval", true)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      setItems((approvalItems || []) as ApprovalItem[]);
    } catch (error) {
      console.error("Customer approval load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load approval request."
      );
    } finally {
      setLoading(false);
    }
  }

  const totalApprovalValue = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantity) * Number(item.unit_price),
        0
      ),
    [items]
  );

  const pendingCount = useMemo(
    () =>
      items.filter((item) => item.approval_status === "pending").length,
    [items]
  );

  const approvedCount = useMemo(
    () =>
      items.filter((item) => item.approval_status === "approved").length,
    [items]
  );

  const rejectedCount = useMemo(
    () =>
      items.filter((item) => item.approval_status === "rejected").length,
    [items]
  );

  async function decideItem(
    item: ApprovalItem,
    decision: "approved" | "rejected"
  ) {
    if (!jobCard) return;

    const confirmed = window.confirm(
      decision === "approved"
        ? `Approve "${item.item_name}"?`
        : `Reject "${item.item_name}"?`
    );

    if (!confirmed) return;

    setSavingItemId(item.id);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in.");

      const note =
        decision === "approved"
          ? "Approved by customer"
          : window.prompt(
              "Optional: tell the workshop why you are rejecting this work."
            ) || "Rejected by customer";

      const { error } = await supabase
        .from("service_estimate_items")
        .update({
          approval_status: decision,
          approval_note: note,
          approval_decided_at: new Date().toISOString(),
          approval_decided_by: user.id,
        })
        .eq("id", item.id);

      if (error) throw error;

      await loadApproval();
    } catch (error) {
      console.error("Customer approval decision error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save your decision."
      );
    } finally {
      setSavingItemId(null);
    }
  }

  async function finalizeDecisions() {
    if (!jobCard) return;

    if (pendingCount > 0) {
      window.alert("Please decide all pending approval items first.");
      return;
    }

    try {
      const hasApprovedWork = items.some(
        (item) => item.approval_status === "approved"
      );

      const nextJobStatus = hasApprovedWork
        ? "approved"
        : "estimate_prepared";

      const nextBookingStatus = hasApprovedWork
        ? "service_in_progress"
        : "inspection_started";

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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in.");

      const approvedItems = items.filter(
        (item) => item.approval_status === "approved"
      );

      const rejectedItems = items.filter(
        (item) => item.approval_status === "rejected"
      );

      const historyNote = hasApprovedWork
        ? `Customer approved ${approvedItems.length} additional item${
            approvedItems.length === 1 ? "" : "s"
          }${
            rejectedItems.length > 0
              ? ` and rejected ${rejectedItems.length}`
              : ""
          }.`
        : `Customer rejected all ${rejectedItems.length} additional item${
            rejectedItems.length === 1 ? "" : "s"
          }.`;

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: user.id,
          status: nextBookingStatus,
          note: historyNote,
          changed_by_type: "customer",
        });

      if (historyError) throw historyError;

      window.alert(
        hasApprovedWork
          ? "Your approval has been sent to the workshop."
          : "Your rejection has been sent to the workshop."
      );

      router.push(
        `/service-booking/track?bookingId=${encodeURIComponent(
          jobCard.booking_id
        )}`
      );
    } catch (error) {
      console.error("Finalize approval error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to finalize approval."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">Loading approval request...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Customer Approval
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Review Additional Work
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review each additional service item requested by the workshop.
            Nothing marked for approval will proceed without your decision.
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
              <InfoBox label="Pending" value={String(pendingCount)} />
              <InfoBox label="Approved" value={String(approvedCount)} />
              <InfoBox label="Rejected" value={String(rejectedCount)} />
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                    Approval Protection
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    You control additional work
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                    Approve only the work you want the workshop to perform.
                    Rejected items remain blocked.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Requested Additional Work
                  </p>
                  <h2 className="text-xl font-black">Approval Items</h2>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                    No approval-required items were found.
                  </div>
                ) : (
                  items.map((item) => {
                    const amount =
                      Number(item.quantity) * Number(item.unit_price);

                    const isPending = item.approval_status === "pending";

                    return (
                      <article
                        key={item.id}
                        className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"
                      >
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                              {item.item_type}
                            </p>

                            <h3 className="mt-1 text-xl font-black">
                              {item.item_name}
                            </h3>

                            {item.description ? (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                                {item.description}
                              </p>
                            ) : null}

                            <p className="mt-3 text-sm text-slate-500">
                              Quantity: {item.quantity}
                            </p>
                          </div>

                          <div className="lg:text-right">
                            <p className="text-2xl font-black">
                              ₹{amount.toLocaleString("en-IN")}
                            </p>

                            <StatusBadge status={item.approval_status} />
                          </div>
                        </div>

                        {item.approval_note ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                            {item.approval_note}
                          </div>
                        ) : null}

                        {isPending ? (
                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={savingItemId === item.id}
                              onClick={() =>
                                decideItem(item, "approved")
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
                            >
                              <CheckCircle2 size={17} />
                              Approve
                            </button>

                            <button
                              type="button"
                              disabled={savingItemId === item.id}
                              onClick={() =>
                                decideItem(item, "rejected")
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3.5 text-sm font-black text-rose-200 disabled:opacity-60"
                            >
                              <XCircle size={17} />
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5 shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                Total Additional Work
              </p>
              <p className="mt-2 text-3xl font-black">
                ₹{totalApprovalValue.toLocaleString("en-IN")}
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Decision Status
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {pendingCount > 0
                      ? `${pendingCount} decision${
                          pendingCount === 1 ? "" : "s"
                        } remaining`
                      : "All decisions completed"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={pendingCount > 0}
                  onClick={finalizeDecisions}
                  className={`rounded-2xl px-6 py-3.5 text-sm font-black ${
                    pendingCount === 0
                      ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                      : "cursor-not-allowed bg-white/10 text-slate-600"
                  }`}
                >
                  Submit Decisions
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: ApprovalItem["approval_status"];
}) {
  if (status === "approved") {
    return (
      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">
        <CheckCircle2 size={14} />
        Approved
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-black text-rose-200">
        <XCircle size={14} />
        Rejected
      </span>
    );
  }

  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200">
      <Clock3 size={14} />
      Pending
    </span>
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