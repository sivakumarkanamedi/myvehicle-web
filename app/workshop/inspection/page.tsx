"use client";

import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Save,
  ShieldAlert,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type Severity = "normal" | "attention" | "urgent";
type ApprovalStatus = "not_required" | "pending";

type JobCard = {
  id: string;
  booking_id: string;
  workshop_id: string;
  job_card_number: string;
  status: string;
  customer_request: string | null;
  service_instructions: string | null;
  inspection_summary: string | null;
  assigned_technician_id: string | null;
  assigned_at: string | null;
};

type Technician = {
  id: string;
  technician_name: string;
  employee_id: string | null;
  specialization: string | null;
};

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type FindingDraft = {
  finding_title: string;
  finding_description: string;
  severity: Severity;
  requires_customer_approval: boolean;
  estimated_cost_text: string;
  estimated_time_text: string;
};

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: "brakes", label: "Brakes", checked: false },
  { id: "tyres", label: "Tyres & Wheel Condition", checked: false },
  { id: "engine", label: "Engine / Oil Leakage", checked: false },
  { id: "battery", label: "Battery", checked: false },
  { id: "lights", label: "Lights & Indicators", checked: false },
  { id: "chain", label: "Chain / Drive System", checked: false },
  { id: "suspension", label: "Suspension", checked: false },
  { id: "electrical", label: "Electrical System", checked: false },
];

const EMPTY_FINDING: FindingDraft = {
  finding_title: "",
  finding_description: "",
  severity: "normal",
  requires_customer_approval: false,
  estimated_cost_text: "",
  estimated_time_text: "",
};

export default function InspectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobCardId = searchParams.get("jobCardId") || "";

  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [summary, setSummary] = useState("");
  const [finding, setFinding] = useState<FindingDraft>(EMPTY_FINDING);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!jobCardId) {
      setMessage("Job Card ID is missing.");
      setLoading(false);
      return;
    }

    loadJobCard();
  }, [jobCardId]);

  async function loadJobCard() {
    setLoading(true);
    setMessage("");

    try {
      const { data: card, error: cardError } = await supabase
        .from("service_job_cards")
        .select(
          "id, booking_id, workshop_id, job_card_number, status, customer_request, service_instructions, inspection_summary, assigned_technician_id, assigned_at"
        )
        .eq("id", jobCardId)
        .single();

      if (cardError) throw cardError;

      setJobCard(card as JobCard);
      setSummary(card.inspection_summary || "");

      if (card.assigned_technician_id) {
        const { data: tech, error: techError } = await supabase
          .from("service_technicians")
          .select("id, technician_name, employee_id, specialization")
          .eq("id", card.assigned_technician_id)
          .single();

        if (techError) throw techError;
        setTechnician(tech as Technician);
      }

      const { data: existingFindings, error: findingsError } = await supabase
        .from("service_job_card_findings")
        .select(
          "id, finding_title, finding_description, severity, requires_customer_approval, estimated_cost_text, estimated_time_text, approval_status, created_at"
        )
        .eq("job_card_id", jobCardId)
        .order("created_at", { ascending: false });

      if (findingsError) throw findingsError;

      setFindings(existingFindings || []);

      if (card.status === "created") {
        const { error: updateCardError } = await supabase
          .from("service_job_cards")
          .update({
            status: "inspection_started",
            check_in_time: new Date().toISOString(),
          })
          .eq("id", card.id);

        if (updateCardError) throw updateCardError;

        const { error: bookingUpdateError } = await supabase
          .from("service_bookings")
          .update({ booking_status: "inspection_started" })
          .eq("id", card.booking_id);

        if (bookingUpdateError) throw bookingUpdateError;

        setJobCard({
          ...(card as JobCard),
          status: "inspection_started",
        });
      }
    } catch (error) {
      console.error("Inspection load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load inspection."
      );
    } finally {
      setLoading(false);
    }
  }

  const completedCount = useMemo(
    () => checklist.filter((item) => item.checked).length,
    [checklist]
  );

  const hasApprovalFinding = useMemo(
    () =>
      findings.some(
        (item) =>
          item.requires_customer_approval &&
          item.approval_status === "pending"
      ),
    [findings]
  );

  function toggleChecklist(id: string) {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, checked: !item.checked }
          : item
      )
    );
  }

  async function addFinding() {
    if (!jobCard) return;

    if (!finding.finding_title.trim()) {
      window.alert("Please enter the inspection finding.");
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

      const approvalStatus: ApprovalStatus =
        finding.requires_customer_approval
          ? "pending"
          : "not_required";

      const { error } = await supabase
        .from("service_job_card_findings")
        .insert({
          job_card_id: jobCard.id,
          booking_id: jobCard.booking_id,
          finding_title: finding.finding_title.trim(),
          finding_description:
            finding.finding_description.trim() || null,
          severity: finding.severity,
          requires_customer_approval:
            finding.requires_customer_approval,
          estimated_cost_text:
            finding.estimated_cost_text.trim() || null,
          estimated_time_text:
            finding.estimated_time_text.trim() || null,
          approval_status: approvalStatus,
          created_by: user.id,
        });

      if (error) throw error;

      setFinding(EMPTY_FINDING);
      await loadJobCard();
    } catch (error) {
      console.error("Add finding error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save inspection finding."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveInspection() {
    if (!jobCard) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("service_job_cards")
        .update({
          inspection_summary: summary.trim() || null,
        })
        .eq("id", jobCard.id);

      if (error) throw error;

      window.alert("Inspection saved successfully.");
    } catch (error) {
      console.error("Save inspection error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save inspection."
      );
    } finally {
      setSaving(false);
    }
  }

  async function continueAfterInspection() {
    if (!jobCard) return;

    if (completedCount < checklist.length) {
      const confirmed = window.confirm(
        "Some checklist items are still incomplete. Continue anyway?"
      );

      if (!confirmed) return;
    }

    setSaving(true);

    try {
      const nextJobCardStatus = hasApprovalFinding
        ? "approval_pending"
        : "estimate_prepared";

      const nextBookingStatus = hasApprovalFinding
        ? "approval_required"
        : "service_in_progress";

      const { error: cardError } = await supabase
        .from("service_job_cards")
        .update({
          inspection_summary: summary.trim() || null,
          status: nextJobCardStatus,
        })
        .eq("id", jobCard.id);

      if (cardError) throw cardError;

      const { error: bookingError } = await supabase
        .from("service_bookings")
        .update({ booking_status: nextBookingStatus })
        .eq("id", jobCard.booking_id);

      if (bookingError) throw bookingError;

      const { data: bookingOwner, error: ownerError } = await supabase
        .from("service_bookings")
        .select("user_id")
        .eq("id", jobCard.booking_id)
        .single();

      if (ownerError) throw ownerError;

      if (!bookingOwner?.user_id) {
        throw new Error("Customer user ID is missing from this booking.");
      }

      const historyNote = hasApprovalFinding
        ? "Inspection completed. Additional work was found and customer approval is required."
        : "Inspection completed. No customer approval is required; service can continue.";

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: jobCard.booking_id,
          user_id: bookingOwner.user_id,
          status: nextBookingStatus,
          note: historyNote,
          changed_by_type: "service_advisor",
        });

      if (historyError) throw historyError;

      if (hasApprovalFinding) {
        router.push(
          `/workshop/approval?jobCardId=${encodeURIComponent(
            jobCard.id
          )}`
        );
      } else {
        router.push(
          `/workshop/estimate?jobCardId=${encodeURIComponent(
            jobCard.id
          )}`
        );
      }
    } catch (error: any) {
      console.error("FULL CONTINUE INSPECTION ERROR:", error);

      const text =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        "Unable to continue inspection.";

      window.alert(
        `Unable to continue inspection.

Message: ${error?.message ?? "none"}
Code: ${error?.code ?? "none"}
Details: ${error?.details ?? "none"}
Hint: ${error?.hint ?? "none"}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-slate-400">Loading inspection...</p>
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
            Vehicle Inspection
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Record the vehicle condition, inspection findings and
            approval-required work before service begins.
          </p>
        </header>

        {message ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-100">
            {message}
          </section>
        ) : null}

        {jobCard ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

            <section className="rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500">
                  <Sparkles size={22} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                    Inspection Rule
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    Additional work requires customer approval
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Any finding marked for approval is sent to the customer
                    before the workshop proceeds.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Inspection Checklist
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {completedCount}/{checklist.length} Checked
                  </h2>
                </div>

                <ClipboardCheck className="text-blue-300" />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleChecklist(item.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${
                      item.checked
                        ? "border-emerald-400/30 bg-emerald-500/15"
                        : "border-white/10 bg-slate-950/35"
                    }`}
                  >
                    <CheckCircle2
                      size={20}
                      className={
                        item.checked
                          ? "text-emerald-300"
                          : "text-slate-600"
                      }
                    />

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
                    Inspection Summary
                  </p>
                  <h2 className="text-xl font-black">
                    Technician Notes
                  </h2>
                </div>
              </div>

              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={4}
                placeholder="Add overall inspection summary..."
                className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white outline-none"
              />

              <button
                type="button"
                onClick={saveInspection}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
              >
                <Save size={17} />
                Save Inspection
              </button>
            </section>

            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.07] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-300" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                    Inspection Finding
                  </p>
                  <h2 className="text-xl font-black">
                    Add Issue / Additional Work
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <input
                  value={finding.finding_title}
                  onChange={(event) =>
                    setFinding({
                      ...finding,
                      finding_title: event.target.value,
                    })
                  }
                  placeholder="Finding title"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <select
                  value={finding.severity}
                  onChange={(event) =>
                    setFinding({
                      ...finding,
                      severity: event.target.value as Severity,
                    })
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="attention">Needs Attention</option>
                  <option value="urgent">Urgent</option>
                </select>

                <textarea
                  value={finding.finding_description}
                  onChange={(event) =>
                    setFinding({
                      ...finding,
                      finding_description: event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Describe the finding"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none md:col-span-2"
                />

                <input
                  value={finding.estimated_cost_text}
                  onChange={(event) =>
                    setFinding({
                      ...finding,
                      estimated_cost_text: event.target.value,
                    })
                  }
                  placeholder="Estimated cost e.g. ₹850"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />

                <input
                  value={finding.estimated_time_text}
                  onChange={(event) =>
                    setFinding({
                      ...finding,
                      estimated_time_text: event.target.value,
                    })
                  }
                  placeholder="Estimated time e.g. 45 mins"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm outline-none"
                />
              </div>

              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <input
                  type="checkbox"
                  checked={finding.requires_customer_approval}
                  onChange={(event) =>
                    setFinding({
                      ...finding,
                      requires_customer_approval: event.target.checked,
                    })
                  }
                />

                <span>
                  <span className="block text-sm font-black">
                    Customer approval required
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Workshop cannot proceed with this work until approved.
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={addFinding}
                disabled={saving}
                className="mt-4 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950"
              >
                Add Finding
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Recorded Findings
              </p>

              <div className="mt-4 space-y-3">
                {findings.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                    No findings recorded.
                  </div>
                ) : (
                  findings.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {item.finding_title}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.finding_description || "No description"}
                          </p>
                        </div>

                        {item.requires_customer_approval ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200">
                            <ShieldAlert size={14} />
                            Approval Required
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">
                            No Approval Needed
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                        <span>{item.severity}</span>
                        {item.estimated_cost_text ? (
                          <span>{item.estimated_cost_text}</span>
                        ) : null}
                        {item.estimated_time_text ? (
                          <span>{item.estimated_time_text}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                    Inspection Complete
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {hasApprovalFinding
                      ? "Customer approval is required"
                      : "Ready to prepare estimate"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={continueAfterInspection}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-sm font-black"
                >
                  {hasApprovalFinding
                    ? "Send for Customer Approval"
                    : "Continue to Estimate"}
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
      <p className="mt-2 text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}