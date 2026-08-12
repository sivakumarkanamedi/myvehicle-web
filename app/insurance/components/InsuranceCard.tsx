"use client";

export type Vehicle = {
  id?: number;
  vehicle_number?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type InsurancePolicy = {
  id: number;
  user_id?: string;
  vehicle_id: number;
  insurance_company: string;
  policy_number: string;
  policy_type: string;
  premium_amount: number | null;
  idv: number | null;
  start_date: string;
  expiry_date: string;
  claim_contact: string | null;
  customer_care: string | null;
  document_url: string | null;
  notes: string | null;

  zero_depreciation?: boolean | null;
  engine_protect?: boolean | null;
  roadside_assistance?: boolean | null;
  consumables_cover?: boolean | null;
  return_to_invoice?: boolean | null;
  ncb_percent?: number | null;

  created_at?: string;
  updated_at?: string;
  vehicles?: Vehicle | null;
};

type Props = {
  policy: InsurancePolicy;
  onDelete: (id: number) => void | Promise<void>;
  onEdit?: (policy: InsurancePolicy) => void;
  onManageDocument?: (policy: InsurancePolicy) => void;
  onManageClaims?: (policy: InsurancePolicy) => void;
  onViewRecommendations?: (policy: InsurancePolicy) => void;
  onCompareInsurance?: (policy: InsurancePolicy) => void;
};

type PolicyStatus = "active" | "expiring" | "expired";

export default function InsuranceCard({
  policy,
  onDelete,
  onEdit,
  onManageDocument,
  onManageClaims,
  onViewRecommendations,
  onCompareInsurance,
}: Props) {
  const daysRemaining = getDaysRemaining(policy.expiry_date);
  const status = getPolicyStatus(daysRemaining);
  const progress = getPolicyProgress(
    policy.start_date,
    policy.expiry_date
  );

  const statusLabel =
    status === "active"
      ? "Active"
      : status === "expiring"
        ? "Expiring Soon"
        : "Expired";

  const countdownLabel =
    daysRemaining < 0
      ? `Expired ${Math.abs(daysRemaining)} day${
          Math.abs(daysRemaining) === 1 ? "" : "s"
        } ago`
      : daysRemaining === 0
        ? "Expires today"
        : `${daysRemaining} day${
            daysRemaining === 1 ? "" : "s"
          } remaining`;

  const vehicleTitle = [
    policy.vehicles?.brand,
    policy.vehicles?.model,
  ]
    .filter(Boolean)
    .join(" ");

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete policy ${policy.policy_number}?`
    );

    if (!confirmed) {
      return;
    }

    await onDelete(policy.id);
  }

  return (
    <article className="insurance-card">
      <div className="top-row">
        <div className="company-section">
          <div className="company-logo" aria-hidden="true">
            {getInitials(policy.insurance_company)}
          </div>

          <div>
            <div className="status-row">
              <span className={`status-badge status-${status}`}>
                {statusLabel}
              </span>

              <span className="countdown">
                {countdownLabel}
              </span>
            </div>

            <h2>{policy.insurance_company}</h2>
            <p>{policy.policy_type}</p>
          </div>
        </div>

        <div className="vehicle-box">
          <span>Vehicle</span>

          <strong>
            {policy.vehicles?.vehicle_number || "Not assigned"}
          </strong>

          {vehicleTitle && <small>{vehicleTitle}</small>}
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-labels">
          <span>Policy Period</span>
          <strong>{Math.round(progress)}%</strong>
        </div>

        <div className="progress-track">
          <div
            className={`progress-fill progress-${status}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="date-row">
          <span>{formatDate(policy.start_date)}</span>
          <span>{formatDate(policy.expiry_date)}</span>
        </div>
      </div>

      <div className="details-grid">
        <DetailItem
          label="Policy Number"
          value={policy.policy_number}
        />

        <DetailItem
          label="Premium"
          value={formatCurrency(policy.premium_amount)}
        />

        <DetailItem
          label="IDV"
          value={formatCurrency(policy.idv)}
        />

        <DetailItem
          label="Claim Contact"
          value={policy.claim_contact || "Not added"}
        />

        <DetailItem
          label="Customer Care"
          value={policy.customer_care || "Not added"}
        />

        <DetailItem
          label="Document"
          value={policy.document_url ? "Uploaded" : "Not uploaded"}
        />
      </div>

      {policy.notes && (
        <div className="notes">
          <span>Notes</span>
          <p>{policy.notes}</p>
        </div>
      )}

      <div className="actions">
        <div className="primary-actions">
          {onManageDocument && (
            <button
              type="button"
              className="action-button document-action"
              onClick={() => onManageDocument(policy)}
            >
              {policy.document_url
                ? "Manage Document"
                : "Upload Document"}
            </button>
          )}

          {onManageClaims && (
            <button
              type="button"
              className="action-button"
              onClick={() => onManageClaims(policy)}
            >
              Claim Documents
            </button>
          )}

          {onViewRecommendations && (
            <button
              type="button"
              className="action-button recommendation-action"
              onClick={() => onViewRecommendations(policy)}
            >
              Mira Recommendations
            </button>
          )}

          {onCompareInsurance && (
            <button
              type="button"
              className="action-button comparison-action"
              onClick={() => onCompareInsurance(policy)}
            >
              Compare Insurance
            </button>
          )}

          {policy.customer_care && (
            <a
              className="action-button"
              href={`tel:${policy.customer_care}`}
            >
              Call Insurer
            </a>
          )}

          {onEdit && (
            <button
              type="button"
              className="action-button"
              onClick={() => onEdit(policy)}
            >
              Edit
            </button>
          )}
        </div>

        <button
          type="button"
          className="delete-button"
          onClick={() => void handleDelete()}
        >
          Delete
        </button>
      </div>

      <style jsx>{`
        .insurance-card {
          position: relative;
          overflow: hidden;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background: linear-gradient(
            145deg,
            rgba(15, 23, 42, 0.96),
            rgba(7, 21, 42, 0.92)
          );
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.24);
        }

        .insurance-card::before {
          content: "";
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(
            90deg,
            #2563eb,
            #60a5fa,
            transparent
          );
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }

        .company-section {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          min-width: 0;
        }

        .company-logo {
          display: grid;
          width: 54px;
          height: 54px;
          flex: 0 0 54px;
          place-items: center;
          border: 1px solid rgba(147, 197, 253, 0.3);
          border-radius: 16px;
          background: linear-gradient(145deg, #1d4ed8, #3b82f6);
          color: #eff6ff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.28);
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .status-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 8px;
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .status-active {
          border: 1px solid rgba(16, 185, 129, 0.24);
          background: rgba(16, 185, 129, 0.14);
          color: #6ee7b7;
        }

        .status-expiring {
          border: 1px solid rgba(245, 158, 11, 0.24);
          background: rgba(245, 158, 11, 0.14);
          color: #fcd34d;
        }

        .status-expired {
          border: 1px solid rgba(239, 68, 68, 0.24);
          background: rgba(239, 68, 68, 0.14);
          color: #fca5a5;
        }

        .countdown {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 700;
        }

        h2 {
          margin: 0;
          color: #f8fafc;
          font-size: 22px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .company-section p {
          margin: 6px 0 0;
          color: #94a3b8;
        }

        .vehicle-box {
          min-width: 180px;
          padding: 14px 16px;
          border: 1px solid rgba(96, 165, 250, 0.18);
          border-radius: 16px;
          background: rgba(37, 99, 235, 0.12);
          text-align: right;
        }

        .vehicle-box span,
        .notes span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .vehicle-box strong {
          display: block;
          margin-top: 5px;
          color: #dbeafe;
          font-size: 16px;
        }

        .vehicle-box small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
        }

        .progress-section {
          margin-top: 24px;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(2, 6, 23, 0.34);
        }

        .progress-labels,
        .date-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .progress-labels {
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 800;
        }

        .progress-track {
          height: 8px;
          margin: 12px 0 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.3s ease;
        }

        .progress-active {
          background: linear-gradient(90deg, #2563eb, #60a5fa);
        }

        .progress-expiring {
          background: linear-gradient(90deg, #d97706, #fbbf24);
        }

        .progress-expired {
          background: linear-gradient(90deg, #b91c1c, #ef4444);
        }

        .date-row {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }

        .notes {
          margin-top: 18px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.6);
        }

        .notes p {
          margin: 8px 0 0;
          color: #cbd5e1;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(148, 163, 184, 0.13);
        }

        .primary-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .action-button,
        .delete-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px 14px;
          border-radius: 12px;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .action-button {
          border: 1px solid rgba(96, 165, 250, 0.2);
          background: rgba(15, 23, 42, 0.86);
          color: #dbeafe;
        }

        .document-action,
        .recommendation-action,
        .comparison-action {
          background: rgba(37, 99, 235, 0.18);
        }

        .recommendation-action,
        .comparison-action {
          border-color: rgba(96, 165, 250, 0.38);
        }

        .action-button:hover {
          border-color: rgba(96, 165, 250, 0.5);
          background: rgba(30, 64, 175, 0.2);
        }

        .delete-button {
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        @media (max-width: 900px) {
          .details-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .insurance-card {
            padding: 20px;
          }

          .top-row,
          .actions {
            flex-direction: column;
            align-items: stretch;
          }

          .vehicle-box {
            min-width: 0;
            text-align: left;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .primary-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .delete-button {
            width: 100%;
          }
        }

        @media (max-width: 420px) {
          .company-section {
            flex-direction: column;
          }

          .primary-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(15, 23, 42, 0.54)",
        border: "1px solid rgba(148, 163, 184, 0.12)",
      }}
    >
      <span
        style={{
          display: "block",
          marginBottom: 7,
          color: "#64748b",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: "#e2e8f0",
          fontSize: 14,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function getDaysRemaining(expiryDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  expiry.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) {
    return 0;
  }

  return Math.ceil(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function getPolicyStatus(
  daysRemaining: number
): PolicyStatus {
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= 30) return "expiring";
  return "active";
}

function getPolicyProgress(
  startDate: string,
  expiryDate: string
) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const expiry = new Date(`${expiryDate}T00:00:00`).getTime();
  const now = Date.now();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(expiry) ||
    expiry <= start
  ) {
    return 0;
  }

  const progress = ((now - start) / (expiry - start)) * 100;

  return Math.min(100, Math.max(0, progress));
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Not added";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value || "Not added";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "IN";
  }

  return words
    .map((word) => word[0]?.toUpperCase())
    .join("");
}