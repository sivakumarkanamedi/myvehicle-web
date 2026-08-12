"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

export type RenewalQuote = {
  id: number;
  partner_name: string;
  insurer_name: string;
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
  purchase_url: string | null;
  quote_valid_until: string | null;
};

export type RenewalPolicy = {
  id: number;
  vehicle_id: number;
  insurance_company: string;
  policy_number: string;
  expiry_date: string;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

type RenewalOrder = {
  id: number;
  user_id: string;
  policy_id: number;
  vehicle_id: number;
  quote_id: number | null;
  partner_name: string;
  insurer_name: string;
  quote_reference: string | null;
  current_policy_number: string | null;
  renewed_policy_number: string | null;
  order_status: string;
  payment_status: string;
  premium_amount: number;
  idv: number | null;
  policy_type: string | null;
  selected_addons: string[];
  payment_provider: string | null;
  payment_order_id: string | null;
  payment_transaction_id: string | null;
  payment_failure_reason: string | null;
  paid_at: string | null;
  partner_order_reference: string | null;
  partner_status: string | null;
  partner_redirect_url: string | null;
  renewed_policy_document_path: string | null;
  renewed_policy_start_date: string | null;
  renewed_policy_expiry_date: string | null;
  failure_reason: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type TimelineEvent = {
  id: number;
  renewal_order_id: number;
  event_type: string;
  event_status: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Props = {
  policy: RenewalPolicy;
  quote: RenewalQuote;
  onClose?: () => void;
  onCompleted?: () => void | Promise<void>;
};

export default function InsuranceRenewalCenter({
  policy,
  quote,
  onClose,
  onCompleted,
}: Props) {
  const [orders, setOrders] = useState<RenewalOrder[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadRenewalData();
  }, [policy.id, quote.id]);

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) ?? null,
    [orders, activeOrderId]
  );

  const selectedAddons = useMemo(
    () => getSelectedAddons(quote),
    [quote]
  );

  async function loadRenewalData() {
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

    const { data: orderData, error: orderError } = await supabase
      .from("insurance_renewal_orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("policy_id", policy.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      setErrorMessage(orderError.message);
      setLoading(false);
      return;
    }

    const orderRows = (orderData ?? []) as RenewalOrder[];
    setOrders(orderRows);

    const currentOrderId =
      activeOrderId ?? orderRows[0]?.id ?? null;

    setActiveOrderId(currentOrderId);

    if (currentOrderId) {
      await loadTimeline(currentOrderId);
    } else {
      setTimeline([]);
    }

    setLoading(false);
  }

  async function loadTimeline(orderId: number) {
    const { data, error } = await supabase
      .from("insurance_renewal_timeline")
      .select("*")
      .eq("renewal_order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setTimeline((data ?? []) as TimelineEvent[]);
  }

  async function createRenewalOrder() {
    setCreating(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const { data, error } = await supabase
        .from("insurance_renewal_orders")
        .insert({
          user_id: user.id,
          policy_id: policy.id,
          vehicle_id: policy.vehicle_id,
          quote_id: quote.id,
          partner_name: quote.partner_name,
          insurer_name: quote.insurer_name,
          quote_reference: quote.quote_reference,
          current_policy_number: policy.policy_number,
          order_status: "created",
          payment_status: "not_started",
          premium_amount: quote.total_premium,
          idv: quote.idv,
          policy_type: quote.policy_type,
          selected_addons: selectedAddons,
          partner_redirect_url:
            quote.purchase_url || null,
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          error?.message || "Unable to create renewal order."
        );
      }

      const newOrder = data as RenewalOrder;

      setMessage("Renewal order created successfully.");
      setActiveOrderId(newOrder.id);

      await loadRenewalData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create renewal order."
      );
    } finally {
      setCreating(false);
    }
  }

  async function openPartnerCheckout() {
    if (!activeOrder) {
      return;
    }

    const destination =
      activeOrder.partner_redirect_url ||
      quote.purchase_url;

    if (!destination) {
      setErrorMessage(
        "Partner checkout link is not available yet."
      );
      return;
    }

    const { error } = await supabase
      .from("insurance_renewal_orders")
      .update({
        order_status: "payment_pending",
        payment_status: "pending",
      })
      .eq("id", activeOrder.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await addTimelineEvent(activeOrder.id, {
      event_type: "payment_started",
      event_status: "pending",
      title: "Payment started",
      description:
        "The user was redirected to the insurance partner checkout.",
      metadata: {
        partner_name: activeOrder.partner_name,
      },
    });

    window.open(
      destination,
      "_blank",
      "noopener,noreferrer"
    );

    await refreshOrder(activeOrder.id);
  }

  async function retryPayment() {
    if (!activeOrder) {
      return;
    }

    await openPartnerCheckout();
  }

  async function cancelRenewal() {
    if (!activeOrder) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel this renewal order?"
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("insurance_renewal_orders")
      .update({
        order_status: "cancelled",
        payment_status:
          activeOrder.payment_status === "paid"
            ? activeOrder.payment_status
            : "cancelled",
        cancelled_reason: "Cancelled by user",
      })
      .eq("id", activeOrder.id);

    if (error) {
      setErrorMessage(error.message);
      setCancelling(false);
      return;
    }

    await addTimelineEvent(activeOrder.id, {
      event_type: "order_cancelled",
      event_status: "cancelled",
      title: "Renewal cancelled",
      description: "The renewal order was cancelled by the user.",
      metadata: {},
    });

    setMessage("Renewal order cancelled.");
    setCancelling(false);
    await refreshOrder(activeOrder.id);
  }

  async function refreshOrder(orderId?: number) {
    const targetOrderId = orderId ?? activeOrderId;

    if (!targetOrderId) {
      return;
    }

    setRefreshing(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("insurance_renewal_orders")
      .select("*")
      .eq("id", targetOrderId)
      .single();

    if (error || !data) {
      setErrorMessage(
        error?.message || "Unable to refresh renewal order."
      );
      setRefreshing(false);
      return;
    }

    const updatedOrder = data as RenewalOrder;

    setOrders((current) => {
      const exists = current.some(
        (order) => order.id === updatedOrder.id
      );

      if (!exists) {
        return [updatedOrder, ...current];
      }

      return current.map((order) =>
        order.id === updatedOrder.id
          ? updatedOrder
          : order
      );
    });

    await loadTimeline(updatedOrder.id);

    if (
      updatedOrder.order_status === "completed" &&
      onCompleted
    ) {
      await onCompleted();
    }

    setRefreshing(false);
  }

  async function addTimelineEvent(
    orderId: number,
    event: Omit<
      TimelineEvent,
      "id" | "renewal_order_id" | "created_at"
    >
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await supabase
      .from("insurance_renewal_timeline")
      .insert({
        user_id: user.id,
        renewal_order_id: orderId,
        ...event,
      });
  }

  async function downloadRenewedPolicy() {
    if (
      !activeOrder?.renewed_policy_document_path
    ) {
      setErrorMessage(
        "Renewed policy document is not available yet."
      );
      return;
    }

    const { data, error } = await supabase.storage
      .from("insurance-documents")
      .download(
        activeOrder.renewed_policy_document_path
      );

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const objectUrl = URL.createObjectURL(data);
    const anchor =
      window.document.createElement("a");

    anchor.href = objectUrl;
    anchor.download =
      `${activeOrder.renewed_policy_number ||
        policy.policy_number ||
        "renewed-policy"}.pdf`;

    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }

  const vehicleName = [
    policy.vehicles?.brand,
    policy.vehicles?.model,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="renewal-center">
      <div className="header">
        <div>
          <p className="eyebrow">INSURANCE RENEWAL CENTER</p>
          <h2>Renew Policy</h2>
          <p className="description">
            Review the selected quote, create a renewal order and track
            payment, partner processing and policy issuance.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close renewal center"
          >
            ×
          </button>
        )}
      </div>

      <div className="summary-grid">
        <Summary
          label="Vehicle"
          value={
            policy.vehicles?.vehicle_number ||
            "Not linked"
          }
          subvalue={vehicleName}
        />

        <Summary
          label="Current Policy"
          value={policy.policy_number}
          subvalue={policy.insurance_company}
        />

        <Summary
          label="Selected Insurer"
          value={quote.insurer_name}
          subvalue={`Via ${quote.partner_name}`}
        />

        <Summary
          label="Total Premium"
          value={formatCurrency(quote.total_premium)}
          subvalue={quote.policy_type}
        />
      </div>

      <div className="quote-review">
        <div>
          <p className="eyebrow">SELECTED QUOTE</p>
          <h3>{quote.insurer_name}</h3>
          <p>
            Quote reference:{" "}
            {quote.quote_reference || "Not provided"}
          </p>
        </div>

        <div className="quote-values">
          <Metric
            label="IDV"
            value={formatCurrency(quote.idv)}
          />
          <Metric
            label="Base Premium"
            value={formatCurrency(quote.base_premium)}
          />
          <Metric
            label="GST"
            value={formatCurrency(quote.gst_amount)}
          />
          <Metric
            label="Final Premium"
            value={formatCurrency(quote.total_premium)}
          />
        </div>

        <div className="addon-list">
          {selectedAddons.length === 0 ? (
            <span className="addon unknown">
              Add-ons not confirmed
            </span>
          ) : (
            selectedAddons.map((addon) => (
              <span className="addon" key={addon}>
                ✓ {addon}
              </span>
            ))
          )}
        </div>

        <p className="validity-note">
          Quote valid until:{" "}
          {quote.quote_valid_until
            ? formatDateTime(quote.quote_valid_until)
            : "Not provided"}
        </p>
      </div>

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          Loading renewal orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="create-order-panel">
          <div>
            <h3>Ready to begin renewal</h3>
            <p>
              Create a renewal order using the selected genuine partner
              quote.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              void createRenewalOrder()
            }
            disabled={creating}
          >
            {creating
              ? "Creating Order..."
              : "Create Renewal Order"}
          </button>
        </div>
      ) : (
        <>
          <div className="order-selector">
            <label>
              Renewal Order
              <select
                value={activeOrderId ?? ""}
                onChange={(event) => {
                  const value = Number(
                    event.target.value
                  );

                  setActiveOrderId(value);
                  void loadTimeline(value);
                }}
              >
                {orders.map((order) => (
                  <option
                    value={order.id}
                    key={order.id}
                  >
                    #{order.id} ·{" "}
                    {formatStatus(
                      order.order_status
                    )} ·{" "}
                    {formatDateTime(
                      order.created_at
                    )}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void refreshOrder()
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh Status"}
            </button>
          </div>

          {activeOrder && (
            <>
              <div className="status-grid">
                <StatusCard
                  label="Order Status"
                  value={formatStatus(
                    activeOrder.order_status
                  )}
                  tone={getStatusTone(
                    activeOrder.order_status
                  )}
                />

                <StatusCard
                  label="Payment Status"
                  value={formatStatus(
                    activeOrder.payment_status
                  )}
                  tone={getStatusTone(
                    activeOrder.payment_status
                  )}
                />

                <StatusCard
                  label="Partner Status"
                  value={
                    activeOrder.partner_status
                      ? formatStatus(
                          activeOrder.partner_status
                        )
                      : "Not submitted"
                  }
                  tone="neutral"
                />

                <StatusCard
                  label="Renewed Policy"
                  value={
                    activeOrder.renewed_policy_number ||
                    "Pending"
                  }
                  tone={
                    activeOrder.renewed_policy_number
                      ? "success"
                      : "neutral"
                  }
                />
              </div>

              <div className="order-actions">
                {canStartPayment(activeOrder) && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void openPartnerCheckout()
                    }
                  >
                    Continue to Partner Payment
                  </button>
                )}

                {activeOrder.payment_status ===
                  "failed" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void retryPayment()
                    }
                  >
                    Retry Payment
                  </button>
                )}

                {activeOrder.renewed_policy_document_path && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void downloadRenewedPolicy()
                    }
                  >
                    Download Renewed Policy
                  </button>
                )}

                {canCancelOrder(activeOrder) && (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() =>
                      void cancelRenewal()
                    }
                    disabled={cancelling}
                  >
                    {cancelling
                      ? "Cancelling..."
                      : "Cancel Renewal"}
                  </button>
                )}
              </div>

              <div className="order-details">
                <Detail
                  label="Partner"
                  value={
                    activeOrder.partner_name
                  }
                />
                <Detail
                  label="Insurer"
                  value={
                    activeOrder.insurer_name
                  }
                />
                <Detail
                  label="Partner Order"
                  value={
                    activeOrder.partner_order_reference ||
                    "Not available"
                  }
                />
                <Detail
                  label="Payment Transaction"
                  value={
                    activeOrder.payment_transaction_id ||
                    "Not available"
                  }
                />
                <Detail
                  label="New Start Date"
                  value={
                    activeOrder.renewed_policy_start_date
                      ? formatDate(
                          activeOrder.renewed_policy_start_date
                        )
                      : "Pending"
                  }
                />
                <Detail
                  label="New Expiry Date"
                  value={
                    activeOrder.renewed_policy_expiry_date
                      ? formatDate(
                          activeOrder.renewed_policy_expiry_date
                        )
                      : "Pending"
                  }
                />
              </div>

              {(activeOrder.failure_reason ||
                activeOrder.payment_failure_reason ||
                activeOrder.cancelled_reason) && (
                <div className="warning-box">
                  <strong>Order information</strong>
                  <p>
                    {activeOrder.failure_reason ||
                      activeOrder.payment_failure_reason ||
                      activeOrder.cancelled_reason}
                  </p>
                </div>
              )}

              <div className="timeline-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">RENEWAL TIMELINE</p>
                    <h3>Order Progress</h3>
                  </div>

                  <span className="event-count">
                    {timeline.length} event
                    {timeline.length === 1 ? "" : "s"}
                  </span>
                </div>

                {timeline.length === 0 ? (
                  <div className="empty-state">
                    No renewal timeline events yet.
                  </div>
                ) : (
                  <div className="timeline-list">
                    {timeline.map((event) => (
                      <article
                        className="timeline-item"
                        key={event.id}
                      >
                        <div className="timeline-dot" />

                        <div>
                          <div className="timeline-title">
                            <strong>
                              {event.title}
                            </strong>

                            {event.event_status && (
                              <span>
                                {formatStatus(
                                  event.event_status
                                )}
                              </span>
                            )}
                          </div>

                          {event.description && (
                            <p>
                              {event.description}
                            </p>
                          )}

                          <small>
                            {formatDateTime(
                              event.created_at
                            )}
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

      <div className="partner-note">
        <span>ℹ</span>
        <p>
          Payment and policy issuance must be completed through an
          approved insurer or licensed insurance partner. My Vehicle
          tracks the journey but does not independently issue insurance.
        </p>
      </div>

      <style jsx>{`
        .renewal-center {
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
        .order-selector,
        .create-order-panel,
        .section-heading,
        .timeline-title {
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
          line-height: 1.55;
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

        .summary-grid,
        .status-grid,
        .order-details {
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

        .order-details {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 18px;
        }

        .quote-review {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .quote-review > div:first-child p:last-child {
          margin: 7px 0 0;
          color: #94a3b8;
        }

        .quote-values {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .addon-list {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 15px;
        }

        .addon {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(20, 83, 45, 0.18);
          color: #a7f3d0;
          font-size: 12px;
          font-weight: 800;
        }

        .addon.unknown {
          background: rgba(51, 65, 85, 0.3);
          color: #cbd5e1;
        }

        .validity-note {
          margin: 14px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .success-message,
        .error-message,
        .warning-box {
          margin-top: 15px;
          padding: 13px 15px;
          border-radius: 12px;
        }

        .success-message {
          background: rgba(20, 83, 45, 0.18);
          color: #a7f3d0;
        }

        .error-message,
        .warning-box {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .warning-box p {
          margin: 6px 0 0;
        }

        .create-order-panel,
        .order-selector {
          align-items: center;
          margin-top: 20px;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 16px;
          background: rgba(2, 6, 23, 0.32);
        }

        .create-order-panel p {
          margin: 7px 0 0;
          color: #94a3b8;
        }

        .order-selector label {
          display: grid;
          gap: 8px;
          flex: 1;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 800;
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

        .primary-button,
        .secondary-button,
        .danger-button {
          min-height: 44px;
          padding: 11px 17px;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.82);
          color: #dbeafe;
        }

        .danger-button {
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .order-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
        }

        .timeline-section {
          margin-top: 24px;
          padding-top: 22px;
          border-top: 1px solid rgba(148, 163, 184, 0.13);
        }

        .section-heading {
          align-items: flex-end;
          margin-bottom: 14px;
        }

        .event-count {
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
          background: rgba(2, 6, 23, 0.3);
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

        .timeline-item p {
          margin: 6px 0 0;
          color: #94a3b8;
        }

        .timeline-item small {
          display: block;
          margin-top: 8px;
          color: #64748b;
        }

        .empty-state {
          margin-top: 18px;
          padding: 32px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        .partner-note {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.08);
          color: #bfdbfe;
        }

        .partner-note p {
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 980px) {
          .summary-grid,
          .status-grid,
          .quote-values,
          .order-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .renewal-center {
            padding: 18px;
          }

          .header,
          .order-selector,
          .create-order-panel,
          .section-heading {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-grid,
          .status-grid,
          .quote-values,
          .order-details {
            grid-template-columns: 1fr;
          }

          .order-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .primary-button,
          .secondary-button,
          .danger-button {
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
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong style={{ color: "#e2e8f0", overflowWrap: "anywhere" }}>
        {value}
      </strong>

      {subvalue && (
        <small style={{ color: "#94a3b8" }}>{subvalue}</small>
      )}
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

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return <Summary label={label} value={value} />;
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

function getSelectedAddons(quote: RenewalQuote) {
  const addons: string[] = [];

  if (quote.zero_depreciation) addons.push("Zero Depreciation");
  if (quote.engine_protect) addons.push("Engine Protect");
  if (quote.roadside_assistance) addons.push("Roadside Assistance");
  if (quote.consumables_cover) addons.push("Consumables Cover");
  if (quote.return_to_invoice) addons.push("Return to Invoice");
  if (quote.ncb_protection) addons.push("NCB Protection");

  return addons;
}

function canStartPayment(order: RenewalOrder) {
  return (
    ["created", "payment_pending"].includes(order.order_status) &&
    ["not_started", "pending", "failed"].includes(order.payment_status)
  );
}

function canCancelOrder(order: RenewalOrder) {
  return ![
    "completed",
    "policy_issued",
    "cancelled",
    "refunded",
  ].includes(order.order_status);
}

function getStatusTone(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (
    [
      "paid",
      "completed",
      "policy_issued",
      "authorised",
      "payment_completed",
    ].includes(status)
  ) {
    return "success";
  }

  if (
    [
      "failed",
      "cancelled",
      "refunded",
      "payment_failure",
    ].includes(status)
  ) {
    return "danger";
  }

  if (
    [
      "pending",
      "processing",
      "payment_pending",
      "submitted_to_partner",
      "created",
      "not_started",
    ].includes(status)
  ) {
    return "warning";
  }

  return "neutral";
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

function formatCurrency(value: number | null) {
  if (value === null || value < 0) {
    return "Not provided";
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
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}