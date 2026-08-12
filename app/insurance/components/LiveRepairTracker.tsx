"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type RepairJob = {
  id: number;
  user_id: string;
  garage_id: number;
  claim_id: number | null;
  booking_id: number | null;
  vehicle_id: number;

  repair_reference: string | null;
  repair_status: string;
  repair_stage: string;

  estimated_cost: number | null;
  insurer_approved_amount: number | null;
  customer_payable_amount: number | null;

  estimated_completion_date: string | null;
  actual_completion_date: string | null;

  estimate_document_path: string | null;
  final_invoice_path: string | null;

  garage_notes: string | null;
  customer_notes: string | null;

  created_at: string;
  updated_at: string;
  completed_at: string | null;

  cashless_garages?: {
    id: number;
    name: string;
    phone: string | null;
    address_line1: string;
    city: string;
    state: string;
  } | null;
};

type RepairTimelineEvent = {
  id: number;
  repair_job_id: number;
  event_type: string;
  event_status: string | null;
  title: string;
  description: string | null;
  photo_paths: string[];
  metadata: Record<string, unknown>;
  created_at: string;
};

type PolicySummary = {
  id: number;
  vehicle_id: number;
  insurance_company: string;
  policy_number: string;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

type Props = {
  policy: PolicySummary;
  claimId?: number | null;
  bookingId?: number | null;
  onClose?: () => void;
};

const REPAIR_STAGES = [
  { key: "vehicle_received", label: "Vehicle Received" },
  { key: "inspection_in_progress", label: "Initial Inspection" },
  { key: "estimate_ready", label: "Estimate Ready" },
  { key: "insurer_approval_pending", label: "Insurance Approval Pending" },
  { key: "approved", label: "Insurance Approved" },
  { key: "parts_ordered", label: "Parts Ordered" },
  { key: "repair_in_progress", label: "Repair Started" },
  { key: "painting", label: "Painting" },
  { key: "quality_check", label: "Quality Check" },
  { key: "ready_for_delivery", label: "Ready for Delivery" },
  { key: "delivered", label: "Delivered" },
];

export default function LiveRepairTracker({
  policy,
  claimId,
  bookingId,
  onClose,
}: Props) {
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<RepairTimelineEvent[]>([]);
  const [signedPhotos, setSignedPhotos] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadRepairJobs();
  }, [policy.id, claimId, bookingId]);

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? null,
    [jobs, activeJobId]
  );

  const progress = useMemo(
    () => getRepairProgress(activeJob?.repair_status),
    [activeJob?.repair_status]
  );

  const currentStageIndex = useMemo(
    () =>
      Math.max(
        0,
        REPAIR_STAGES.findIndex(
          (stage) => stage.key === activeJob?.repair_status
        )
      ),
    [activeJob?.repair_status]
  );

  async function loadRepairJobs(preferredJobId?: number) {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("Please sign in again.");
      setLoading(false);
      return;
    }

    let query = supabase
      .from("garage_repair_jobs")
      .select(
        `
          *,
          cashless_garages (
            id,
            name,
            phone,
            address_line1,
            city,
            state
          )
        `
      )
      .eq("user_id", user.id)
      .eq("vehicle_id", policy.vehicle_id)
      .order("created_at", { ascending: false });

    if (claimId) {
      query = query.eq("claim_id", claimId);
    }

    if (bookingId) {
      query = query.eq("booking_id", bookingId);
    }

    const { data, error } = await query;

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as RepairJob[];
    setJobs(rows);

    const nextJobId =
      preferredJobId ??
      activeJobId ??
      rows[0]?.id ??
      null;

    setActiveJobId(nextJobId);

    if (nextJobId) {
      await loadTimeline(nextJobId);
    } else {
      setTimeline([]);
      setSignedPhotos({});
    }

    setLoading(false);
  }

  async function loadTimeline(repairJobId: number) {
    const { data, error } = await supabase
      .from("garage_repair_timeline")
      .select("*")
      .eq("repair_job_id", repairJobId)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = (data ?? []) as RepairTimelineEvent[];
    setTimeline(rows);

    const photoPaths = rows.flatMap(
      (event) => event.photo_paths ?? []
    );

    if (photoPaths.length) {
      await loadSignedPhotoUrls(photoPaths);
    } else {
      setSignedPhotos({});
    }
  }

  async function loadSignedPhotoUrls(paths: string[]) {
    const uniquePaths = Array.from(new Set(paths));
    const entries: Array<[string, string]> = [];

    for (const path of uniquePaths) {
      const { data, error } = await supabase.storage
        .from("insurance-documents")
        .createSignedUrl(path, 60 * 10);

      if (!error && data?.signedUrl) {
        entries.push([path, data.signedUrl]);
      }
    }

    setSignedPhotos(Object.fromEntries(entries));
  }

  async function refreshTracker() {
    if (!activeJobId) return;

    setRefreshing(true);
    setMessage("");
    setErrorMessage("");

    await loadRepairJobs(activeJobId);

    setMessage("Repair status refreshed.");
    setRefreshing(false);
  }

  async function downloadDocument(
    path: string | null,
    fallbackName: string
  ) {
    if (!path) {
      setErrorMessage("Document is not available yet.");
      return;
    }

    const { data, error } = await supabase.storage
      .from("insurance-documents")
      .download(path);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const objectUrl = URL.createObjectURL(data);
    const anchor = window.document.createElement("a");

    anchor.href = objectUrl;
    anchor.download =
      `${fallbackName}.` +
      `${path.split(".").pop() || "pdf"}`;

    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }

  const vehicleLabel = [
    policy.vehicles?.brand,
    policy.vehicles?.model,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="tracker">
      <div className="header">
        <div>
          <p className="eyebrow">LIVE REPAIR TRACKER</p>
          <h2>Vehicle Repair Progress</h2>
          <p className="description">
            Track every stage from garage inspection to final delivery.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void refreshTracker()}
            disabled={refreshing || !activeJobId}
          >
            {refreshing ? "Refreshing..." : "Refresh Status"}
          </button>

          {onClose && (
            <button
              type="button"
              className="close-button"
              onClick={onClose}
              aria-label="Close repair tracker"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="summary-grid">
        <Summary
          label="Vehicle"
          value={policy.vehicles?.vehicle_number || "Not linked"}
          subvalue={vehicleLabel}
        />

        <Summary
          label="Policy"
          value={policy.policy_number}
          subvalue={policy.insurance_company}
        />

        <Summary
          label="Claim"
          value={claimId ? `#${claimId}` : "Not linked"}
        />

        <Summary
          label="Repair Jobs"
          value={String(jobs.length)}
        />
      </div>

      {message && <div className="success-message">{message}</div>}
      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      {loading ? (
        <div className="empty-state">Loading repair jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <strong>No repair job is available yet.</strong>
          <p>
            A garage repair job will appear after inspection or claim
            approval.
          </p>
        </div>
      ) : (
        <>
          <div className="job-selector">
            <label>
              Repair Job
              <select
                value={activeJobId ?? ""}
                onChange={(event) => {
                  const jobId = Number(event.target.value);
                  setActiveJobId(jobId);
                  void loadTimeline(jobId);
                }}
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.repair_reference || `Repair #${job.id}`} ·{" "}
                    {formatStatus(job.repair_status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeJob && (
            <>
              <div className="repair-hero">
                <div>
                  <p className="eyebrow">CURRENT STATUS</p>
                  <h3>{formatStatus(activeJob.repair_status)}</h3>
                  <p>
                    {activeJob.cashless_garages?.name ||
                      "Garage details unavailable"}
                  </p>
                </div>

                <div className="progress-box">
                  <span>{progress}% complete</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="stage-track">
                {REPAIR_STAGES.map((stage, index) => {
                  const completed = index < currentStageIndex;
                  const current = index === currentStageIndex;

                  return (
                    <div
                      className={`stage-item ${
                        completed ? "completed" : ""
                      } ${current ? "current" : ""}`}
                      key={stage.key}
                    >
                      <span className="stage-dot">
                        {completed ? "✓" : index + 1}
                      </span>
                      <strong>{stage.label}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="status-grid">
                <StatusCard
                  label="Repair Stage"
                  value={formatStatus(activeJob.repair_stage)}
                  tone="neutral"
                />

                <StatusCard
                  label="Estimated Completion"
                  value={
                    activeJob.estimated_completion_date
                      ? formatDate(activeJob.estimated_completion_date)
                      : "Not available"
                  }
                  tone="warning"
                />

                <StatusCard
                  label="Repair Status"
                  value={formatStatus(activeJob.repair_status)}
                  tone={getStatusTone(activeJob.repair_status)}
                />

                <StatusCard
                  label="Actual Completion"
                  value={
                    activeJob.actual_completion_date
                      ? formatDate(activeJob.actual_completion_date)
                      : "Pending"
                  }
                  tone={
                    activeJob.actual_completion_date
                      ? "success"
                      : "neutral"
                  }
                />
              </div>

              <div className="financial-grid">
                <Summary
                  label="Estimated Cost"
                  value={formatCurrency(activeJob.estimated_cost)}
                />

                <Summary
                  label="Insurer Approved"
                  value={formatCurrency(
                    activeJob.insurer_approved_amount
                  )}
                />

                <Summary
                  label="Customer Payable"
                  value={formatCurrency(
                    activeJob.customer_payable_amount
                  )}
                />
              </div>

              <div className="garage-panel">
                <div>
                  <p className="eyebrow">GARAGE</p>
                  <h3>
                    {activeJob.cashless_garages?.name ||
                      "Garage details unavailable"}
                  </h3>
                  <p>
                    {activeJob.cashless_garages
                      ? `${activeJob.cashless_garages.address_line1}, ${activeJob.cashless_garages.city}, ${activeJob.cashless_garages.state}`
                      : ""}
                  </p>
                </div>

                <div className="garage-actions">
                  {activeJob.cashless_garages?.phone && (
                    <a
                      href={`tel:${activeJob.cashless_garages.phone}`}
                      className="secondary-button"
                    >
                      Call Garage
                    </a>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void downloadDocument(
                        activeJob.estimate_document_path,
                        activeJob.repair_reference || "repair-estimate"
                      )
                    }
                    disabled={!activeJob.estimate_document_path}
                  >
                    Download Estimate
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void downloadDocument(
                        activeJob.final_invoice_path,
                        activeJob.repair_reference || "repair-invoice"
                      )
                    }
                    disabled={!activeJob.final_invoice_path}
                  >
                    Download Invoice
                  </button>
                </div>
              </div>

              {(activeJob.garage_notes ||
                activeJob.customer_notes) && (
                <div className="notes-grid">
                  <NoteBox
                    title="Garage Notes"
                    value={
                      activeJob.garage_notes ||
                      "No garage notes."
                    }
                  />

                  <NoteBox
                    title="Your Notes"
                    value={
                      activeJob.customer_notes ||
                      "No customer notes."
                    }
                  />
                </div>
              )}

              <div className="timeline-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">REPAIR TIMELINE</p>
                    <h3>Progress Updates</h3>
                  </div>

                  <span className="count-badge">
                    {timeline.length} event
                    {timeline.length === 1 ? "" : "s"}
                  </span>
                </div>

                {timeline.length === 0 ? (
                  <div className="empty-state">
                    No repair updates yet.
                  </div>
                ) : (
                  <div className="timeline-list">
                    {timeline.map((event) => (
                      <article
                        className="timeline-item"
                        key={event.id}
                      >
                        <div className="timeline-dot" />

                        <div className="timeline-content">
                          <div className="timeline-title">
                            <strong>{event.title}</strong>

                            {event.event_status && (
                              <span>
                                {formatStatus(event.event_status)}
                              </span>
                            )}
                          </div>

                          {event.description && (
                            <p>{event.description}</p>
                          )}

                          {event.photo_paths?.length > 0 && (
                            <div className="timeline-photos">
                              {event.photo_paths.map((path) => {
                                const signedUrl = signedPhotos[path];

                                return signedUrl ? (
                                  <a
                                    href={signedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    key={path}
                                  >
                                    <img
                                      src={signedUrl}
                                      alt="Repair progress"
                                    />
                                  </a>
                                ) : null;
                              })}
                            </div>
                          )}

                          <small>
                            {formatDateTime(event.created_at)}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div className="advisory-note">
        <span>ℹ</span>
        <p>
          Repair stages, cost approvals and completion dates depend on
          garage and insurer updates. Contact the garage directly for
          urgent clarifications.
        </p>
      </div>

      <style jsx>{`
        .tracker {
          width: 100%;
          box-sizing: border-box;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.16),
              transparent 30%
            ),
            #07152a;
          color: #f8fafc;
        }

        .header,
        .header-actions,
        .repair-hero,
        .section-heading,
        .timeline-title,
        .garage-panel,
        .garage-actions {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .header {
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .header-actions,
        .garage-actions {
          align-items: center;
          flex-wrap: wrap;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        h2,
        h3 {
          margin: 0;
        }

        .description,
        .repair-hero p,
        .garage-panel p {
          color: #94a3b8;
        }

        .description,
        .repair-hero p,
        .garage-panel p {
          margin: 7px 0 0;
        }

        .close-button {
          width: 42px;
          height: 42px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
          font-size: 28px;
          cursor: pointer;
        }

        .secondary-button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.82);
          color: #dbeafe;
          font: inherit;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .summary-grid,
        .status-grid,
        .financial-grid,
        .notes-grid {
          display: grid;
          gap: 14px;
        }

        .summary-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .status-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 18px;
        }

        .financial-grid,
        .notes-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 18px;
        }

        .notes-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .success-message,
        .error-message {
          margin-top: 15px;
          padding: 13px 15px;
          border-radius: 12px;
        }

        .success-message {
          background: rgba(20, 83, 45, 0.18);
          color: #a7f3d0;
        }

        .error-message {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .empty-state {
          margin-top: 18px;
          padding: 32px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        .empty-state strong {
          color: #f8fafc;
        }

        .empty-state p {
          margin: 7px 0 0;
        }

        .job-selector {
          margin-top: 20px;
          padding: 16px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.32);
        }

        .job-selector label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 800;
        }

        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          color: #f8fafc;
          padding: 13px 14px;
          font: inherit;
        }

        .repair-hero,
        .garage-panel,
        .timeline-section {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .repair-hero {
          align-items: center;
        }

        .progress-box {
          min-width: 260px;
        }

        .progress-box > span {
          display: block;
          margin-bottom: 8px;
          color: #dbeafe;
          font-weight: 900;
          text-align: right;
        }

        .progress-track {
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #2563eb, #60a5fa);
        }

        .stage-track {
          display: grid;
          grid-template-columns: repeat(11, minmax(90px, 1fr));
          gap: 10px;
          margin-top: 18px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .stage-item {
          display: grid;
          gap: 8px;
          justify-items: center;
          min-width: 90px;
          padding: 12px 8px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.3);
          color: #64748b;
          text-align: center;
          font-size: 11px;
        }

        .stage-item.completed,
        .stage-item.current {
          color: #dbeafe;
        }

        .stage-item.current {
          border-color: rgba(96, 165, 250, 0.5);
          background: rgba(37, 99, 235, 0.12);
        }

        .stage-dot {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 50%;
          background: rgba(51, 65, 85, 0.35);
          font-weight: 900;
        }

        .stage-item.completed .stage-dot {
          background: rgba(20, 83, 45, 0.25);
          color: #a7f3d0;
        }

        .stage-item.current .stage-dot {
          background: rgba(37, 99, 235, 0.3);
          color: #bfdbfe;
        }

        .timeline-section {
          padding-top: 20px;
        }

        .section-heading {
          align-items: flex-end;
          margin-bottom: 15px;
        }

        .count-badge {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.15);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 900;
        }

        .timeline-list {
          display: grid;
          gap: 12px;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr);
          gap: 12px;
          padding: 15px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(15, 23, 42, 0.48);
        }

        .timeline-dot {
          width: 11px;
          height: 11px;
          margin-top: 4px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.12);
        }

        .timeline-title {
          align-items: center;
        }

        .timeline-title span {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(51, 65, 85, 0.3);
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 800;
        }

        .timeline-content p {
          margin: 6px 0 0;
          color: #94a3b8;
        }

        .timeline-content small {
          display: block;
          margin-top: 8px;
          color: #64748b;
        }

        .timeline-photos {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .timeline-photos img {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 12px;
        }

        .advisory-note {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.08);
          color: #bfdbfe;
        }

        .advisory-note p {
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 980px) {
          .summary-grid,
          .status-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .financial-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .tracker {
            padding: 18px;
          }

          .header,
          .header-actions,
          .repair-hero,
          .garage-panel,
          .garage-actions,
          .section-heading {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-grid,
          .status-grid,
          .financial-grid,
          .notes-grid,
          .timeline-photos {
            grid-template-columns: 1fr;
          }

          .progress-box {
            min-width: 0;
          }

          .progress-box > span {
            text-align: left;
          }

          .secondary-button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}

function Summary({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: 15,
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderRadius: 15,
        background: "rgba(2, 6, 23, 0.34)",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong style={{ color: "#e2e8f0" }}>{value}</strong>

      {subvalue && (
        <small style={{ color: "#94a3b8" }}>
          {subvalue}
        </small>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const colors = {
    success: {
      background: "rgba(20, 83, 45, 0.18)",
      color: "#a7f3d0",
    },
    warning: {
      background: "rgba(133, 77, 14, 0.2)",
      color: "#fde68a",
    },
    danger: {
      background: "rgba(127, 29, 29, 0.2)",
      color: "#fecaca",
    },
    neutral: {
      background: "rgba(51, 65, 85, 0.3)",
      color: "#cbd5e1",
    },
  }[tone];

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 15,
        borderRadius: 15,
        background: colors.background,
      }}
    >
      <span
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong style={{ color: colors.color }}>
        {value}
      </strong>
    </div>
  );
}

function NoteBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderRadius: 15,
        background: "rgba(15, 23, 42, 0.48)",
      }}
    >
      <strong style={{ color: "#dbeafe" }}>{title}</strong>
      <p
        style={{
          margin: "7px 0 0",
          color: "#94a3b8",
          lineHeight: 1.55,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function getRepairProgress(status?: string) {
  if (!status) return 0;

  const index = REPAIR_STAGES.findIndex(
    (stage) => stage.key === status
  );

  if (index < 0) return 0;

  return Math.round(
    ((index + 1) / REPAIR_STAGES.length) * 100
  );
}

function getStatusTone(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (
    ["ready_for_delivery", "delivered"].includes(status)
  ) {
    return "success";
  }

  if (
    [
      "inspection_in_progress",
      "estimate_ready",
      "insurer_approval_pending",
      "parts_ordered",
      "repair_in_progress",
      "painting",
      "quality_check",
    ].includes(status)
  ) {
    return "warning";
  }

  if (status === "cancelled") {
    return "danger";
  }

  return "neutral";
}

function formatCurrency(value: number | null) {
  if (value === null || value < 0) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}