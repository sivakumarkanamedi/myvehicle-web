"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

export type ComparisonPolicy = {
  id: number;
  vehicle_id: number;
  insurance_company: string;
  policy_number: string;
  policy_type: string;
  premium_amount: number | null;
  idv: number | null;
  expiry_date: string;
  ncb_percent?: number | null;
  zero_depreciation?: boolean | null;
  engine_protect?: boolean | null;
  roadside_assistance?: boolean | null;
  consumables_cover?: boolean | null;
  return_to_invoice?: boolean | null;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

type QuoteRequest = {
  id: number;
  status: string;
  requested_policy_type: string;
  requested_addons: string[];
  requested_at: string;
};

type InsuranceQuote = {
  id: number;
  request_id: number;
  partner_name: string;
  insurer_name: string;
  insurer_logo_url: string | null;
  quote_reference: string | null;
  policy_type: string;
  idv: number | null;
  base_premium: number | null;
  gst_amount: number | null;
  total_premium: number;
  zero_depreciation: boolean | null;
  engine_protect: boolean | null;
  roadside_assistance: boolean | null;
  consumables_cover: boolean | null;
  return_to_invoice: boolean | null;
  ncb_protection: boolean | null;
  cashless_garage_count: number | null;
  claim_settlement_ratio: number | null;
  deductible_amount: number | null;
  coverage_summary: Record<string, unknown> | null;
  exclusions: string[] | null;
  quote_valid_until: string | null;
  purchase_url: string | null;
  is_recommended: boolean;
  recommendation_reason: string | null;
  created_at: string;
};

type Props = {
  policy: ComparisonPolicy;
  onClose?: () => void;
  onRenewQuote?: (quote: InsuranceQuote) => void;
};

const ADD_ON_OPTIONS = [
  "Zero Depreciation",
  "Engine Protect",
  "Roadside Assistance",
  "Consumables Cover",
  "Return to Invoice",
  "NCB Protection",
];

export default function InsuranceComparisonEngine({
  policy,
  onClose,
  onRenewQuote,
}: Props) {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [quotes, setQuotes] = useState<InsuranceQuote[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    getCurrentAddons(policy)
  );
  const [requestedPolicyType, setRequestedPolicyType] = useState(
    normalizePolicyType(policy.policy_type)
  );
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadComparisonData();
  }, [policy.id]);

  const latestRequest = requests[0] ?? null;

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      if (a.is_recommended !== b.is_recommended) {
        return a.is_recommended ? -1 : 1;
      }

      return a.total_premium - b.total_premium;
    });
  }, [quotes]);

  async function loadComparisonData() {
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

    const { data: requestData, error: requestError } = await supabase
      .from("insurance_quote_requests")
      .select(
        "id, status, requested_policy_type, requested_addons, requested_at"
      )
      .eq("user_id", user.id)
      .eq("policy_id", policy.id)
      .order("requested_at", { ascending: false });

    if (requestError) {
      setErrorMessage(requestError.message);
      setLoading(false);
      return;
    }

    const requestRows = (requestData ?? []) as QuoteRequest[];
    setRequests(requestRows);

    if (requestRows.length === 0) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    const requestIds = requestRows.map((item) => item.id);

    const { data: quoteData, error: quoteError } = await supabase
      .from("insurance_quotes")
      .select("*")
      .in("request_id", requestIds)
      .order("total_premium", { ascending: true });

    if (quoteError) {
      setErrorMessage(quoteError.message);
      setLoading(false);
      return;
    }

    setQuotes((quoteData ?? []) as InsuranceQuote[]);
    setLoading(false);
  }

  function toggleAddon(addon: string) {
    setSelectedAddons((current) =>
      current.includes(addon)
        ? current.filter((item) => item !== addon)
        : [...current, addon]
    );
  }

  async function createQuoteRequest() {
    setRequesting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const { error } = await supabase
        .from("insurance_quote_requests")
        .insert({
          user_id: user.id,
          policy_id: policy.id,
          vehicle_id: policy.vehicle_id,
          current_policy_number: policy.policy_number,
          current_insurer: policy.insurance_company,
          current_expiry_date: policy.expiry_date,
          current_idv: policy.idv,
          current_premium: policy.premium_amount,
          current_ncb_percent: policy.ncb_percent ?? null,
          requested_policy_type: requestedPolicyType,
          requested_addons: selectedAddons,
          status: "pending",
        });

      if (error) {
        throw new Error(error.message);
      }

      setMessage(
        "Quote request created. Real insurer quotes will appear after a connected insurance partner responds."
      );

      await loadComparisonData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the quote request."
      );
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section className="comparison-panel">
      <div className="header">
        <div>
          <p className="eyebrow">INSURANCE COMPARISON</p>
          <h2>Compare Renewal Options</h2>
          <p className="description">
            Compare real partner quotes by premium, IDV, add-ons,
            deductible and service network.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close insurance comparison"
          >
            ×
          </button>
        )}
      </div>

      <div className="current-policy">
        <Summary
          label="Current Insurer"
          value={policy.insurance_company}
        />
        <Summary
          label="Vehicle"
          value={policy.vehicles?.vehicle_number || "Not linked"}
        />
        <Summary
          label="Current Premium"
          value={formatCurrency(policy.premium_amount)}
        />
        <Summary
          label="Current IDV"
          value={formatCurrency(policy.idv)}
        />
      </div>

      <div className="request-box">
        <div className="request-grid">
          <label>
            Policy Type
            <select
              value={requestedPolicyType}
              onChange={(event) =>
                setRequestedPolicyType(event.target.value)
              }
            >
              <option value="Comprehensive">Comprehensive</option>
              <option value="Third Party">Third Party</option>
              <option value="Own Damage">Own Damage</option>
            </select>
          </label>

          <div className="addon-section">
            <span className="field-label">Required Add-ons</span>

            <div className="addon-grid">
              {ADD_ON_OPTIONS.map((addon) => (
                <label className="addon-option" key={addon}>
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon)}
                    onChange={() => toggleAddon(addon)}
                  />
                  <span>{addon}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => void createQuoteRequest()}
          disabled={requesting}
        >
          {requesting ? "Requesting Quotes..." : "Request Real Quotes"}
        </button>

        <p className="partner-note">
          Quotes are displayed only when received from an approved
          insurer or licensed insurance partner. My Vehicle does not
          generate or estimate insurer prices.
        </p>
      </div>

      {message && <div className="success-message">{message}</div>}
      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      <div className="status-row">
        <div>
          <p className="eyebrow">LATEST REQUEST</p>
          <h3>Quote Status</h3>
        </div>

        <span
          className={`status-badge status-${
            latestRequest?.status || "none"
          }`}
        >
          {latestRequest
            ? formatStatus(latestRequest.status)
            : "Not Requested"}
        </span>
      </div>

      {loading ? (
        <div className="empty-state">Loading comparison data...</div>
      ) : sortedQuotes.length === 0 ? (
        <div className="empty-state">
          <strong>No insurer quotes available yet.</strong>
          <p>
            Create a request above. Quotes will appear here after a
            connected partner responds.
          </p>
        </div>
      ) : (
        <div className="quote-list">
          {sortedQuotes.map((quote) => (
            <article className="quote-card" key={quote.id}>
              <div className="quote-head">
                <div className="insurer">
                  {quote.insurer_logo_url ? (
                    <img
                      src={quote.insurer_logo_url}
                      alt={`${quote.insurer_name} logo`}
                    />
                  ) : (
                    <div className="insurer-placeholder">
                      {getInitials(quote.insurer_name)}
                    </div>
                  )}

                  <div>
                    <div className="insurer-name-row">
                      <h3>{quote.insurer_name}</h3>

                      {quote.is_recommended && (
                        <span className="recommended">
                          Mira Recommended
                        </span>
                      )}
                    </div>

                    <p>
                      Via {quote.partner_name} · {quote.policy_type}
                    </p>
                  </div>
                </div>

                <div className="premium-box">
                  <span>Total Premium</span>
                  <strong>{formatCurrency(quote.total_premium)}</strong>
                </div>
              </div>

              <div className="quote-metrics">
                <Metric
                  label="IDV"
                  value={formatCurrency(quote.idv)}
                />
                <Metric
                  label="Deductible"
                  value={formatCurrency(quote.deductible_amount)}
                />
                <Metric
                  label="Cashless Garages"
                  value={
                    quote.cashless_garage_count === null
                      ? "Not provided"
                      : quote.cashless_garage_count.toLocaleString("en-IN")
                  }
                />
                <Metric
                  label="Claim Settlement"
                  value={
                    quote.claim_settlement_ratio === null
                      ? "Not provided"
                      : `${quote.claim_settlement_ratio}%`
                  }
                />
              </div>

              <div className="coverage-list">
                <Coverage
                  label="Zero Dep"
                  included={quote.zero_depreciation}
                />
                <Coverage
                  label="Engine Protect"
                  included={quote.engine_protect}
                />
                <Coverage
                  label="Roadside Assistance"
                  included={quote.roadside_assistance}
                />
                <Coverage
                  label="Consumables"
                  included={quote.consumables_cover}
                />
                <Coverage
                  label="Return to Invoice"
                  included={quote.return_to_invoice}
                />
                <Coverage
                  label="NCB Protection"
                  included={quote.ncb_protection}
                />
              </div>

              {quote.recommendation_reason && (
                <div className="recommendation-reason">
                  <strong>Why Mira highlighted this quote</strong>
                  <p>{quote.recommendation_reason}</p>
                </div>
              )}

              <div className="quote-footer">
                <div>
                  <span>Quote validity</span>
                  <strong>
                    {quote.quote_valid_until
                      ? formatDateTime(quote.quote_valid_until)
                      : "Not provided"}
                  </strong>
                </div>

                {onRenewQuote ? (
                  <button
                    type="button"
                    className="buy-button"
                    onClick={() => onRenewQuote(quote)}
                  >
                    Review & Renew
                  </button>
                ) : quote.purchase_url ? (
                  <a
                    href={quote.purchase_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="buy-button"
                  >
                    Continue with Partner
                  </a>
                ) : (
                  <button
                    type="button"
                    className="buy-button"
                    disabled
                  >
                    Partner Link Pending
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <style jsx>{`
        .comparison-panel {
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
        .status-row,
        .quote-head,
        .quote-footer {
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
        h3 {
          margin: 0;
        }

        .description {
          margin: 8px 0 0;
          color: #94a3b8;
        }

        .close-button {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
          font-size: 28px;
          cursor: pointer;
        }

        .current-policy {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .request-box {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .request-grid {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
          margin-bottom: 18px;
        }

        label,
        .field-label {
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 800;
        }

        label {
          display: grid;
          gap: 8px;
        }

        select {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          color: #f8fafc;
          padding: 13px 14px;
          font: inherit;
        }

        .addon-section {
          display: grid;
          gap: 10px;
        }

        .addon-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .addon-option {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 12px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.55);
          cursor: pointer;
        }

        .addon-option input {
          accent-color: #3b82f6;
        }

        .primary-button,
        .buy-button {
          min-height: 44px;
          padding: 11px 17px;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
          cursor: pointer;
        }

        .partner-note {
          margin: 13px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
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

        .status-row {
          align-items: flex-end;
          margin: 24px 0 14px;
        }

        .status-badge {
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .status-none,
        .status-pending,
        .status-processing {
          background: rgba(133, 77, 14, 0.2);
          color: #fde68a;
        }

        .status-completed {
          background: rgba(20, 83, 45, 0.2);
          color: #a7f3d0;
        }

        .status-failed,
        .status-expired,
        .status-cancelled {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .empty-state {
          padding: 36px;
          border-radius: 16px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        .empty-state strong {
          color: #f8fafc;
        }

        .empty-state p {
          margin: 8px 0 0;
        }

        .quote-list {
          display: grid;
          gap: 16px;
        }

        .quote-card {
          padding: 19px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .quote-head {
          align-items: flex-start;
        }

        .insurer {
          display: flex;
          gap: 13px;
          align-items: center;
          min-width: 0;
        }

        .insurer img,
        .insurer-placeholder {
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          border-radius: 14px;
          object-fit: contain;
          background: white;
        }

        .insurer-placeholder {
          display: grid;
          place-items: center;
          background: rgba(37, 99, 235, 0.18);
          color: #dbeafe;
          font-weight: 900;
        }

        .insurer-name-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 9px;
        }

        .recommended {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(20, 83, 45, 0.2);
          color: #a7f3d0;
          font-size: 11px;
          font-weight: 900;
        }

        .insurer p {
          margin: 5px 0 0;
          color: #94a3b8;
        }

        .premium-box {
          min-width: 170px;
          text-align: right;
        }

        .premium-box span,
        .quote-footer span {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .premium-box strong {
          display: block;
          margin-top: 5px;
          color: #f8fafc;
          font-size: 22px;
        }

        .quote-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .coverage-list {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 15px;
        }

        .recommendation-reason {
          margin-top: 15px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.1);
        }

        .recommendation-reason p {
          margin: 6px 0 0;
          color: #94a3b8;
        }

        .quote-footer {
          align-items: center;
          margin-top: 17px;
          padding-top: 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .quote-footer strong {
          display: block;
          margin-top: 5px;
          color: #dbeafe;
        }

        .buy-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
          text-decoration: none;
          cursor: pointer;
        }

        .buy-button:disabled,
        .primary-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .current-policy,
          .quote-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .request-grid {
            grid-template-columns: 1fr;
          }

          .addon-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .comparison-panel {
            padding: 18px;
          }

          .header,
          .quote-head,
          .quote-footer,
          .status-row {
            flex-direction: column;
            align-items: stretch;
          }

          .current-policy,
          .quote-metrics,
          .addon-grid {
            grid-template-columns: 1fr;
          }

          .premium-box {
            min-width: 0;
            text-align: left;
          }

          .buy-button {
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <Summary label={label} value={value} />;
}

function Coverage({
  label,
  included,
}: {
  label: string;
  included: boolean | null;
}) {
  const text =
    included === true
      ? `✓ ${label}`
      : included === false
        ? `– ${label}`
        : `? ${label}`;

  return (
    <span
      style={{
        padding: "7px 10px",
        borderRadius: 999,
        background:
          included === true
            ? "rgba(20, 83, 45, 0.18)"
            : included === false
              ? "rgba(127, 29, 29, 0.16)"
              : "rgba(51, 65, 85, 0.28)",
        color:
          included === true
            ? "#a7f3d0"
            : included === false
              ? "#fecaca"
              : "#cbd5e1",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {text}
    </span>
  );
}

function getCurrentAddons(policy: ComparisonPolicy) {
  const addons: string[] = [];

  if (policy.zero_depreciation) addons.push("Zero Depreciation");
  if (policy.engine_protect) addons.push("Engine Protect");
  if (policy.roadside_assistance) addons.push("Roadside Assistance");
  if (policy.consumables_cover) addons.push("Consumables Cover");
  if (policy.return_to_invoice) addons.push("Return to Invoice");

  return addons;
}

function normalizePolicyType(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("third")) return "Third Party";
  if (normalized.includes("own damage")) return "Own Damage";
  return "Comprehensive";
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(value: number | null) {
  if (value === null || value < 0) return "Not provided";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.length
    ? words.map((word) => word[0]?.toUpperCase()).join("")
    : "IN";
}