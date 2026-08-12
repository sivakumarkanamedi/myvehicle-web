"use client";

import { useMemo } from "react";

export type InsuranceRecommendationPolicy = {
  id: number;
  insurance_company: string;
  policy_number: string;
  policy_type: string;
  premium_amount: number | null;
  idv: number | null;
  expiry_date: string;
  zero_depreciation?: boolean | null;
  engine_protect?: boolean | null;
  roadside_assistance?: boolean | null;
  consumables_cover?: boolean | null;
  return_to_invoice?: boolean | null;
  ncb_percent?: number | null;
  vehicle_age_years?: number | null;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

type Priority = "high" | "medium" | "low";

type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
};

type Props = {
  policy: InsuranceRecommendationPolicy;
  onClose?: () => void;
};

export default function InsuranceRecommendationEngine({
  policy,
  onClose,
}: Props) {
  const analysis = useMemo(() => analysePolicy(policy), [policy]);

  return (
    <section className="panel">
      <div className="header">
        <div>
          <p className="eyebrow">MIRA INSURANCE ADVISOR</p>
          <h2>Policy Recommendations</h2>
          <p className="subtext">
            Mira reviews the current policy and highlights practical
            actions before renewal.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="Close recommendations"
          >
            ×
          </button>
        )}
      </div>

      <div className="summary-grid">
        <Summary label="Insurer" value={policy.insurance_company} />
        <Summary
          label="Vehicle"
          value={policy.vehicles?.vehicle_number || "Not linked"}
        />
        <Summary label="Policy Type" value={policy.policy_type} />
        <Summary label="Expiry" value={formatDate(policy.expiry_date)} />
      </div>

      <div className="renewal-banner">
        <div>
          <span className={`badge ${analysis.tone}`}>
            {analysis.label}
          </span>
          <h3>{analysis.message}</h3>
          <p>{analysis.detail}</p>
        </div>

        <div className="action-date">
          <span>Recommended action date</span>
          <strong>{formatDate(analysis.actionDate)}</strong>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">CURRENT COVERAGE</p>
            <h3>Detected Add-ons</h3>
          </div>
          <span className="count">
            {analysis.enabledCoverageCount} detected
          </span>
        </div>

        <div className="coverage-grid">
          {analysis.coverage.map((item) => (
            <div
              key={item.label}
              className={`coverage coverage-${item.status}`}
            >
              <span className="coverage-icon">
                {item.status === "included"
                  ? "✓"
                  : item.status === "not_included"
                    ? "–"
                    : "?"}
              </span>

              <div>
                <strong>{item.label}</strong>
                <p>{coverageText(item.status)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">MIRA RECOMMENDS</p>
            <h3>Suggested Actions</h3>
          </div>
          <span className="count">
            {analysis.recommendations.length} suggestion
            {analysis.recommendations.length === 1 ? "" : "s"}
          </span>
        </div>

        {analysis.recommendations.length === 0 ? (
          <div className="all-clear">
            <span>✓</span>
            <div>
              <strong>No immediate coverage gaps detected.</strong>
              <p>Recheck premium, IDV and insurer terms during renewal.</p>
            </div>
          </div>
        ) : (
          <div className="recommendation-list">
            {analysis.recommendations.map((item) => (
              <article
                key={item.id}
                className={`recommendation priority-${item.priority}`}
              >
                <span className="priority">
                  {formatPriority(item.priority)}
                </span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="finance-grid">
        <Summary
          label="Current Premium"
          value={formatCurrency(policy.premium_amount)}
        />
        <Summary label="Current IDV" value={formatCurrency(policy.idv)} />
        <Summary
          label="NCB"
          value={
            policy.ncb_percent === null ||
            policy.ncb_percent === undefined
              ? "Not detected"
              : `${policy.ncb_percent}%`
          }
        />
      </div>

      <div className="advisory">
        <span>ℹ</span>
        <p>
          Recommendations are based only on extracted policy data.
          Confirm final premium, IDV, add-ons and eligibility with the
          insurer or an authorised insurance partner.
        </p>
      </div>

      <style jsx>{`
        .panel {
          width: 100%;
          box-sizing: border-box;
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.17),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              rgba(15, 23, 42, 0.98),
              rgba(7, 21, 42, 0.98)
            );
          color: #f8fafc;
        }

        .header,
        .section-head,
        .renewal-banner {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .header {
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        h2,
        h3,
        h4 {
          margin: 0;
        }

        .subtext {
          margin: 8px 0 0;
          color: #94a3b8;
        }

        .close {
          width: 42px;
          height: 42px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
          font-size: 28px;
          cursor: pointer;
        }

        .summary-grid,
        .finance-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .finance-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 24px;
        }

        .renewal-banner {
          align-items: center;
          margin-top: 18px;
          padding: 18px;
          border: 1px solid rgba(96, 165, 250, 0.16);
          border-radius: 17px;
          background: rgba(30, 64, 175, 0.1);
        }

        .renewal-banner p {
          margin: 7px 0 0;
          color: #94a3b8;
        }

        .badge {
          display: inline-flex;
          margin-bottom: 10px;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .danger {
          background: rgba(127, 29, 29, 0.22);
          color: #fecaca;
        }

        .warning {
          background: rgba(133, 77, 14, 0.22);
          color: #fde68a;
        }

        .success {
          background: rgba(20, 83, 45, 0.2);
          color: #a7f3d0;
        }

        .action-date {
          min-width: 190px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.34);
          text-align: right;
        }

        .action-date span {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .action-date strong {
          display: block;
          margin-top: 6px;
          color: #dbeafe;
        }

        .section {
          margin-top: 24px;
        }

        .section-head {
          align-items: flex-end;
          margin-bottom: 14px;
        }

        .count {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.15);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 900;
        }

        .coverage-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .coverage {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.32);
        }

        .coverage-icon {
          display: grid;
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          place-items: center;
          border-radius: 12px;
          font-weight: 900;
        }

        .coverage-included .coverage-icon {
          background: rgba(20, 83, 45, 0.22);
          color: #86efac;
        }

        .coverage-not_included .coverage-icon {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .coverage-unknown .coverage-icon {
          background: rgba(51, 65, 85, 0.3);
          color: #cbd5e1;
        }

        .coverage p,
        .recommendation p,
        .all-clear p {
          margin: 5px 0 0;
          color: #94a3b8;
        }

        .recommendation-list {
          display: grid;
          gap: 12px;
        }

        .recommendation {
          display: grid;
          grid-template-columns: 90px minmax(0, 1fr);
          gap: 14px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(2, 6, 23, 0.34);
        }

        .priority-high {
          border-color: rgba(248, 113, 113, 0.24);
        }

        .priority-medium {
          border-color: rgba(250, 204, 21, 0.2);
        }

        .priority-low {
          border-color: rgba(96, 165, 250, 0.18);
        }

        .priority {
          align-self: start;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.78);
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 900;
          text-align: center;
        }

        .all-clear {
          display: flex;
          gap: 13px;
          align-items: center;
          padding: 17px;
          border-radius: 16px;
          background: rgba(20, 83, 45, 0.1);
        }

        .all-clear > span {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 13px;
          background: rgba(20, 83, 45, 0.22);
          color: #86efac;
          font-weight: 900;
        }

        .advisory {
          display: flex;
          gap: 10px;
          margin-top: 18px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.08);
          color: #bfdbfe;
        }

        .advisory p {
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .coverage-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .panel {
            padding: 18px;
          }

          .header,
          .renewal-banner,
          .section-head {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-grid,
          .coverage-grid,
          .finance-grid {
            grid-template-columns: 1fr;
          }

          .recommendation {
            grid-template-columns: 1fr;
          }

          .action-date {
            min-width: 0;
            text-align: left;
          }
        }
      `}</style>
    </section>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
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
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <strong style={{ color: "#e2e8f0", overflowWrap: "anywhere" }}>
        {value}
      </strong>
    </div>
  );
}

function analysePolicy(policy: InsuranceRecommendationPolicy) {
  const daysRemaining = getDaysRemaining(policy.expiry_date);

  const coverage = [
    {
      label: "Zero Depreciation",
      status: coverageStatus(policy.zero_depreciation),
    },
    {
      label: "Engine Protect",
      status: coverageStatus(policy.engine_protect),
    },
    {
      label: "Roadside Assistance",
      status: coverageStatus(policy.roadside_assistance),
    },
    {
      label: "Consumables Cover",
      status: coverageStatus(policy.consumables_cover),
    },
    {
      label: "Return to Invoice",
      status: coverageStatus(policy.return_to_invoice),
    },
  ];

  const recommendations: Recommendation[] = [];
  const policyType = policy.policy_type.toLowerCase();

  if (
    policyType.includes("third") &&
    !policyType.includes("comprehensive")
  ) {
    recommendations.push({
      id: "comprehensive",
      title: "Review comprehensive coverage",
      description:
        "Third-party cover generally does not cover damage to your own vehicle. Compare comprehensive options before renewal.",
      priority: "high",
    });
  }

  if (policy.zero_depreciation === false) {
    recommendations.push({
      id: "zero-dep",
      title: "Consider Zero Depreciation",
      description:
        "This add-on can reduce depreciation deductions on eligible replaced parts during an own-damage claim.",
      priority:
        policy.vehicle_age_years !== null &&
        policy.vehicle_age_years !== undefined &&
        policy.vehicle_age_years <= 5
          ? "high"
          : "medium",
    });
  }

  if (policy.engine_protect === false) {
    recommendations.push({
      id: "engine",
      title: "Review Engine Protect",
      description:
        "Useful where water ingress, flooding or consequential engine damage is a concern, subject to insurer terms.",
      priority: "medium",
    });
  }

  if (policy.roadside_assistance === false) {
    recommendations.push({
      id: "rsa",
      title: "Add Roadside Assistance",
      description:
        "Roadside support may help with breakdowns, towing, battery jump-starts and emergency assistance.",
      priority: "medium",
    });
  }

  if (policy.consumables_cover === false) {
    recommendations.push({
      id: "consumables",
      title: "Check Consumables Cover",
      description:
        "This may cover eligible consumables used during repairs that standard own-damage policies can exclude.",
      priority: "low",
    });
  }

  if (
    policy.return_to_invoice === false &&
    policy.vehicle_age_years !== null &&
    policy.vehicle_age_years !== undefined &&
    policy.vehicle_age_years <= 3
  ) {
    recommendations.push({
      id: "rti",
      title: "Review Return to Invoice",
      description:
        "For a newer vehicle, this add-on may improve protection in total-loss or theft situations.",
      priority: "medium",
    });
  }

  if (
    policy.ncb_percent !== null &&
    policy.ncb_percent !== undefined &&
    policy.ncb_percent > 0
  ) {
    recommendations.push({
      id: "ncb",
      title: "Preserve your NCB",
      description: `The policy shows an NCB of ${policy.ncb_percent}%. Confirm that it is carried forward correctly during renewal.`,
      priority: "high",
    });
  }

  if (policy.idv === null || policy.idv <= 0) {
    recommendations.push({
      id: "idv",
      title: "Confirm the IDV",
      description:
        "Mira could not confirm a valid IDV. Review it because it affects total-loss or theft settlement and premium.",
      priority: "high",
    });
  }

  if (daysRemaining <= 30) {
    recommendations.unshift({
      id: "renewal",
      title: daysRemaining < 0 ? "Renew before driving" : "Start renewal now",
      description:
        daysRemaining < 0
          ? "The policy appears expired. Confirm active coverage before using the vehicle."
          : "Compare insurer terms, IDV and add-ons before the expiry date.",
      priority: "high",
    });
  }

  const enabledCoverageCount = coverage.filter(
    (item) => item.status === "included"
  ).length;

  const actionDate = recommendedActionDate(policy.expiry_date);

  if (daysRemaining < 0) {
    return {
      label: "Expired",
      tone: "danger",
      message: "Immediate action required",
      detail: "Confirm renewal and active coverage before using the vehicle.",
      actionDate,
      coverage,
      recommendations,
      enabledCoverageCount,
    };
  }

  if (daysRemaining <= 30) {
    return {
      label: "Renew Now",
      tone: "warning",
      message: `${daysRemaining} day${
        daysRemaining === 1 ? "" : "s"
      } remaining`,
      detail: "Review IDV, add-ons, NCB and insurer terms before renewal.",
      actionDate,
      coverage,
      recommendations,
      enabledCoverageCount,
    };
  }

  return {
    label: "Active",
    tone: "success",
    message: `${daysRemaining} days remaining`,
    detail:
      "No immediate renewal action is required. Mira will continue tracking the expiry date.",
    actionDate,
    coverage,
    recommendations,
    enabledCoverageCount,
  };
}

function coverageStatus(
  value: boolean | null | undefined
): "included" | "not_included" | "unknown" {
  if (value === true) return "included";
  if (value === false) return "not_included";
  return "unknown";
}

function coverageText(
  status: "included" | "not_included" | "unknown"
) {
  if (status === "included") return "Detected as included";
  if (status === "not_included") return "Not detected as included";
  return "Could not be confirmed";
}

function getDaysRemaining(expiryDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  expiry.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) return 0;

  return Math.ceil(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function recommendedActionDate(expiryDate: string) {
  const expiry = new Date(`${expiryDate}T00:00:00`);

  if (Number.isNaN(expiry.getTime())) return expiryDate;

  expiry.setDate(expiry.getDate() - 30);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiry.getTime() < today.getTime()) {
    return today.toISOString().slice(0, 10);
  }

  return expiry.toISOString().slice(0, 10);
}

function formatPriority(priority: Priority) {
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Optional";
}

function formatCurrency(value: number | null) {
  if (value === null || value <= 0) return "Not confirmed";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value || "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}