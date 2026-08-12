"use client";

export type RenewalPolicy = {
  id: number;
  insurance_company: string;
  policy_number: string;
  expiry_date: string;
  vehicle_id: number;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

type Props = {
  policies: RenewalPolicy[];
  onOpenPolicy?: (policy: RenewalPolicy) => void;
};

type AlertLevel = "expired" | "urgent" | "soon" | "upcoming";

export default function InsuranceRenewalAlerts({
  policies,
  onOpenPolicy,
}: Props) {
  const alerts = policies
    .map((policy) => {
      const daysRemaining = getDaysRemaining(policy.expiry_date);

      return {
        policy,
        daysRemaining,
        level: getAlertLevel(daysRemaining),
      };
    })
    .filter((item) => item.daysRemaining <= 60)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <section className="renewal-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">MIRA RENEWAL WATCH</p>
          <h2>Insurance Renewal Alerts</h2>
          <p className="description">
            Mira highlights policies that are expired or nearing renewal.
          </p>
        </div>

        <span className={alerts.length ? "alert-count" : "all-clear"}>
          {alerts.length
            ? `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`
            : "All Clear"}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <div>
            <strong>No renewal is due within 60 days.</strong>
            <p>Mira will surface policies when action is needed.</p>
          </div>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map(({ policy, daysRemaining, level }) => {
            const vehicleName = [
              policy.vehicles?.brand,
              policy.vehicles?.model,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article
                className={`alert-card alert-${level}`}
                key={policy.id}
              >
                <div className="alert-main">
                  <div className={`status-icon status-${level}`}>
                    {level === "expired" || level === "urgent" ? "!" : "◷"}
                  </div>

                  <div className="alert-copy">
                    <div className="title-row">
                      <h3>{policy.insurance_company}</h3>
                      <span className={`status-label label-${level}`}>
                        {getStatusLabel(daysRemaining)}
                      </span>
                    </div>

                    <p>Policy #{policy.policy_number}</p>

                    <div className="vehicle-line">
                      <strong>
                        {policy.vehicles?.vehicle_number ||
                          "Vehicle not linked"}
                      </strong>
                      {vehicleName && <span>{vehicleName}</span>}
                    </div>

                    <p>Expiry: {formatDate(policy.expiry_date)}</p>
                  </div>
                </div>

                {onOpenPolicy && (
                  <button
                    type="button"
                    className="review-button"
                    onClick={() => onOpenPolicy(policy)}
                  >
                    Review Policy
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="reminder-note">
        🔔 Recommended reminders: 30, 15, 7, 3 and 1 day before expiry.
      </div>

      <style jsx>{`
        .renewal-panel {
          padding: 24px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.15),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              rgba(15, 23, 42, 0.98),
              rgba(7, 21, 42, 0.98)
            );
          color: #f8fafc;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
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
        .alert-copy p,
        .empty-state p {
          color: #94a3b8;
        }

        .description {
          margin: 8px 0 0;
        }

        .alert-count,
        .all-clear,
        .status-label {
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .alert-count,
        .all-clear {
          align-self: flex-start;
          padding: 8px 12px;
        }

        .alert-count {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .all-clear {
          background: rgba(20, 83, 45, 0.18);
          color: #a7f3d0;
        }

        .alerts-list {
          display: grid;
          gap: 14px;
        }

        .alert-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 17px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 17px;
          background: rgba(2, 6, 23, 0.34);
        }

        .alert-main {
          display: flex;
          gap: 14px;
          min-width: 0;
        }

        .status-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border-radius: 13px;
          font-weight: 900;
        }

        .status-expired,
        .label-expired {
          background: rgba(127, 29, 29, 0.22);
          color: #fecaca;
        }

        .status-urgent,
        .label-urgent {
          background: rgba(154, 52, 18, 0.22);
          color: #fdba74;
        }

        .status-soon,
        .label-soon {
          background: rgba(133, 77, 14, 0.22);
          color: #fde68a;
        }

        .status-upcoming,
        .label-upcoming {
          background: rgba(30, 64, 175, 0.2);
          color: #bfdbfe;
        }

        .title-row,
        .vehicle-line {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          align-items: center;
        }

        .status-label {
          padding: 5px 8px;
        }

        .alert-copy p {
          margin: 6px 0 0;
          font-size: 13px;
        }

        .vehicle-line {
          margin-top: 9px;
        }

        .vehicle-line strong {
          color: #dbeafe;
        }

        .vehicle-line span {
          color: #64748b;
        }

        .review-button {
          min-height: 42px;
          padding: 10px 14px;
          border: 1px solid rgba(96, 165, 250, 0.22);
          border-radius: 12px;
          background: rgba(37, 99, 235, 0.15);
          color: #dbeafe;
          font: inherit;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .empty-state {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px;
          border-radius: 16px;
          background: rgba(20, 83, 45, 0.1);
        }

        .empty-icon {
          display: grid;
          width: 44px;
          height: 44px;
          place-items: center;
          border-radius: 14px;
          background: rgba(20, 83, 45, 0.22);
          color: #86efac;
          font-size: 20px;
          font-weight: 900;
        }

        .empty-state p {
          margin: 6px 0 0;
        }

        .reminder-note {
          margin-top: 16px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.09);
          color: #bfdbfe;
        }

        @media (max-width: 700px) {
          .renewal-panel {
            padding: 18px;
          }

          .panel-header,
          .alert-card {
            flex-direction: column;
            align-items: stretch;
          }

          .review-button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}

function getDaysRemaining(expiryDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  expiry.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function getAlertLevel(daysRemaining: number): AlertLevel {
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= 7) return "urgent";
  if (daysRemaining <= 30) return "soon";
  return "upcoming";
}

function getStatusLabel(daysRemaining: number) {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return `Expired ${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (daysRemaining === 0) return "Expires today";

  return `${daysRemaining} day${
    daysRemaining === 1 ? "" : "s"
  } remaining`;
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