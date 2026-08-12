"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type JobCard = {
  id: string;
  booking_id: string;
  job_card_number: string;
  status: string;
  customer_user_id: string;
  customer_request: string | null;
};

type ApprovalItem = {
  id: string;
  item_type: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  approval_status: "pending" | "approved" | "rejected" | "not_required";
};

export default function WorkshopApprovalPage() {
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
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
      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, job_card_number, status, customer_user_id, customer_request"
        )
        .eq("id", jobCardId)
        .single();

      if (cardError) throw cardError;
      setJobCard(card as JobCard);

      const { data: approvalItems, error: itemsError } = await supabase
        .from("service_estimate_items")
        .select(
          "id, item_type, item_name, description, quantity, unit_price, approval_status"
        )
        .eq("job_card_id", jobCardId)
        .eq("requires_customer_approval", true)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      setItems((approvalItems || []) as ApprovalItem[]);
    } catch (error) {
      console.error("Approval load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load customer approval request."
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

  const customerApprovalUrl =
    typeof window !== "undefined" && jobCard
      ? `${window.location.origin}/service-booking/approval?jobCardId=${encodeURIComponent(
          jobCard.id
        )}`
      : "";

  async function copyApprovalLink() {
    if (!customerApprovalUrl) return;

    await navigator.clipboard.writeText(customerApprovalUrl);
    window.alert("Customer approval link copied.");
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
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Workshop Operations
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Customer Approval
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Additional work is paused until the customer reviews and approves
            or rejects the requested items.
          </p>
        </header>

        {message ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-100">
            {message}
          </section>
        ) : null}

        {jobCard ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <InfoBox label="Job Card" value={jobCard.job_card_number} />
              <InfoBox
                label="Pending"
                value={String(pendingCount)}
              />
              <InfoBox
                label="Approved"
                value={String(approvedCount)}
              />
              <InfoBox
                label="Rejected"
                value={String(rejectedCount)}
              />
            </section>

            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
                  <ShieldAlert size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                    Approval Protection
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    Workshop cannot approve on behalf of the customer
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-amber-100/70">
                    The customer must approve or reject the additional work from
                    their own authenticated My Vehicle account.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Additional Work
                  </p>
                  <h2 className="text-xl font-black">
                    Approval Items
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                    No approval-required estimate items found.
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

                            {item.description ? (
                              <p className="mt-2 text-sm text-slate-400">
                                {item.description}
                              </p>
                            ) : null}
                          </div>

                          <div className="sm:text-right">
                            <p className="text-lg font-black">
                              ₹{amount.toLocaleString("en-IN")}
                            </p>

                            <StatusBadge status={item.approval_status} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5 shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                  Approval Amount
                </p>
                <p className="mt-2 text-3xl font-black">
                  ₹{totalApprovalValue.toLocaleString("en-IN")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Customer Approval Link
                </p>

                <p className="mt-2 break-all text-sm text-slate-300">
                  {customerApprovalUrl || "Generating link..."}
                </p>

                <button
                  type="button"
                  onClick={copyApprovalLink}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
                >
                  <Copy size={16} />
                  Copy Approval Link
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Approval Status
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {pendingCount > 0
                      ? `Waiting for ${pendingCount} customer decision${
                          pendingCount === 1 ? "" : "s"
                        }`
                      : "All customer decisions received"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadApproval}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
                >
                  <RefreshCw size={16} />
                  Refresh Approval Status
                </button>
              </div>
            </section>

            {pendingCount === 0 && approvedCount > 0 ? (
              <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                      Approval Received
                    </p>
                    <p className="mt-1 text-lg font-black">
                      Continue approved work
                    </p>
                  </div>

                  <Link
                    href={`/workshop/repair?jobCardId=${encodeURIComponent(
                      jobCard.id
                    )}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-sm font-black"
                  >
                    Continue to Service
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </section>
            ) : null}
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