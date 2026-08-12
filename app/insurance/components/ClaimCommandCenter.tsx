"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type ClaimRow = {
  id: number;
  claim_reference: string | null;
  insurer_claim_reference: string | null;
  incident_type: string;
  incident_date: string;
  incident_location: string | null;
  incident_description: string | null;
  claim_status: string;
  claim_stage: string;
  estimated_repair_cost: number | null;
  approved_claim_amount: number | null;
  settlement_amount: number | null;
  expected_settlement_date: string | null;
  actual_settlement_date: string | null;
  rejection_risk_level: string | null;
  ai_claimability_status: string | null;
  ai_claimability_confidence: number | null;
  ai_missing_documents: string[] | null;
  ai_next_steps: string[] | null;
  selected_garage_name: string | null;
  created_at: string;
  updated_at: string;
};

type DamageAssessment = {
  id: number;
  assessment_reference: string | null;
  assessment_status: string;
  overall_severity: string;
  overall_confidence: number | null;
  estimated_repair_cost_min: number | null;
  estimated_repair_cost_max: number | null;
  estimated_repair_days_min: number | null;
  estimated_repair_days_max: number | null;
  likely_drivable: boolean | null;
  towing_recommended: boolean;
  total_loss_review_recommended: boolean;
  visible_damage_summary: string | null;
  safety_warnings: string[] | null;
  next_steps: string[] | null;
  assessed_at: string | null;
};

type SurveyReview = {
  id: number;
  survey_reference: string | null;
  review_status: string;
  recommendation: string;
  recommendation_confidence: number | null;
  coverage_match_confidence: number | null;
  estimate_reasonableness_confidence: number | null;
  evidence_consistency_confidence: number | null;
  inflation_risk_level: string;
  surveyor_summary: string | null;
  clarification_questions: string[] | null;
  approval_conditions: string[] | null;
  missing_evidence: string[] | null;
  recommended_approved_amount_min: number | null;
  recommended_approved_amount_max: number | null;
  manual_review_required: boolean;
  analysed_at: string | null;
};

type FraudReview = {
  id: number;
  fraud_review_reference: string | null;
  review_status: string;
  risk_level: string;
  risk_score: number | null;
  risk_confidence: number | null;
  recommendation: string;
  recommendation_summary: string | null;
  risk_reasons: string[] | null;
  missing_evidence: string[] | null;
  clarification_questions: string[] | null;
  recommended_checks: string[] | null;
  manual_investigation_required: boolean;
  analysed_at: string | null;
};

type RepairJob = {
  id: number;
  repair_reference: string | null;
  repair_status: string;
  repair_stage: string;
  estimated_cost: number | null;
  insurer_approved_amount: number | null;
  customer_payable_amount: number | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  garage_notes: string | null;
  created_at: string;
  cashless_garages?: {
    name: string;
    phone: string | null;
    city: string;
    state: string;
  } | null;
};

type ChecklistItem = {
  id: number;
  item_label: string;
  item_description: string | null;
  is_required: boolean;
  is_completed: boolean;
};

type TimelineEvent = {
  id: number;
  event_type: string;
  event_status: string | null;
  title: string;
  description: string | null;
  created_at: string;
};

type PolicySummary = {
  id: number;
  vehicle_id: number;
  insurance_company: string;
  policy_number: string;
  policy_type?: string | null;
  expiry_date: string;
  idv?: number | null;
  vehicles?: {
    vehicle_number?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

type Props = {
  policy: PolicySummary;
  initialClaimId?: number | null;
  onClose?: () => void;
  onOpenClaimAssistant?: (claimId: number) => void;
  onOpenDamageAssessment?: (claimId: number) => void;
  onOpenGarageFinder?: (claimId: number) => void;
  onOpenRepairTracker?: (claimId: number) => void;
};

type CommandCenterData = {
  claims: ClaimRow[];
  damage: DamageAssessment | null;
  survey: SurveyReview | null;
  fraud: FraudReview | null;
  repair: RepairJob | null;
  checklist: ChecklistItem[];
  timeline: TimelineEvent[];
};

const EMPTY_DATA: CommandCenterData = {
  claims: [],
  damage: null,
  survey: null,
  fraud: null,
  repair: null,
  checklist: [],
  timeline: [],
};

export default function ClaimCommandCenter({
  policy,
  initialClaimId,
  onClose,
  onOpenClaimAssistant,
  onOpenDamageAssessment,
  onOpenGarageFinder,
  onOpenRepairTracker,
}: Props) {
  const [data, setData] = useState<CommandCenterData>(EMPTY_DATA);
  const [activeClaimId, setActiveClaimId] = useState<number | null>(
    initialClaimId ?? null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const activeClaim = useMemo(
    () => data.claims.find((claim) => claim.id === activeClaimId) ?? null,
    [data.claims, activeClaimId]
  );

  const progress = useMemo(
    () => calculateClaimProgress(activeClaim, data),
    [activeClaim, data]
  );

  const pendingActions = useMemo(
    () => buildPendingActions(activeClaim, data),
    [activeClaim, data]
  );

  useEffect(() => {
    void loadClaims();
  }, [policy.id]);

  useEffect(() => {
    if (!activeClaimId) return;

    const channel = supabase
      .channel(`claim-command-center-${activeClaimId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_claims",
          filter: `id=eq.${activeClaimId}`,
        },
        () => void refreshClaimData(activeClaimId, false)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_claim_timeline",
          filter: `claim_id=eq.${activeClaimId}`,
        },
        () => void refreshClaimData(activeClaimId, false)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeClaimId]);

  async function loadClaims() {
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

    const { data: claimsData, error } = await supabase
      .from("insurance_claims")
      .select("*")
      .eq("user_id", user.id)
      .eq("policy_id", policy.id)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const claims = (claimsData ?? []) as ClaimRow[];
    const nextClaimId =
      initialClaimId ??
      activeClaimId ??
      claims[0]?.id ??
      null;

    setData((current) => ({
      ...current,
      claims,
    }));
    setActiveClaimId(nextClaimId);

    if (nextClaimId) {
      await refreshClaimData(nextClaimId, false, claims);
    } else {
      setData({
        ...EMPTY_DATA,
        claims,
      });
    }

    setLoading(false);
  }

  async function refreshClaimData(
    claimId: number,
    showRefreshing = true,
    knownClaims?: ClaimRow[]
  ) {
    if (showRefreshing) {
      setRefreshing(true);
    }

    setErrorMessage("");

    const [
      claimResult,
      damageResult,
      surveyResult,
      fraudResult,
      repairResult,
      checklistResult,
      timelineResult,
    ] = await Promise.all([
      supabase
        .from("insurance_claims")
        .select("*")
        .eq("id", claimId)
        .single(),

      supabase
        .from("smart_damage_assessments")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("insurance_survey_reviews")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("insurance_fraud_reviews")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("garage_repair_jobs")
        .select(
          `
            *,
            cashless_garages (
              name,
              phone,
              city,
              state
            )
          `
        )
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("insurance_claim_checklist")
        .select("*")
        .eq("claim_id", claimId)
        .order("is_required", { ascending: false })
        .order("created_at", { ascending: true }),

      supabase
        .from("insurance_claim_timeline")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const firstError = [
      claimResult.error,
      damageResult.error,
      surveyResult.error,
      fraudResult.error,
      repairResult.error,
      checklistResult.error,
      timelineResult.error,
    ].find(Boolean);

    if (firstError) {
      setErrorMessage(firstError.message);
      setRefreshing(false);
      return;
    }

    const updatedClaim = claimResult.data as ClaimRow;
    const claimList = [...(knownClaims ?? data.claims)];
    const existingIndex = claimList.findIndex(
      (claim) => claim.id === updatedClaim.id
    );

    if (existingIndex >= 0) {
      claimList[existingIndex] = updatedClaim;
    } else {
      claimList.unshift(updatedClaim);
    }

    setData({
      claims: claimList,
      damage: (damageResult.data as DamageAssessment | null) ?? null,
      survey: (surveyResult.data as SurveyReview | null) ?? null,
      fraud: (fraudResult.data as FraudReview | null) ?? null,
      repair: (repairResult.data as RepairJob | null) ?? null,
      checklist: (checklistResult.data ?? []) as ChecklistItem[],
      timeline: (timelineResult.data ?? []) as TimelineEvent[],
    });

    setLastUpdatedAt(new Date().toISOString());
    setRefreshing(false);
  }

  async function markChecklistComplete(item: ChecklistItem) {
    const { error } = await supabase
      .from("insurance_claim_checklist")
      .update({
        is_completed: !item.is_completed,
      })
      .eq("id", item.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (activeClaimId) {
      await refreshClaimData(activeClaimId, false);
    }
  }

  if (loading) {
    return (
      <section className="command-center">
        <div className="empty-state">Loading Claim Command Center...</div>
        <Style />
      </section>
    );
  }

  return (
    <section className="command-center">
      <div className="header">
        <div>
          <p className="eyebrow">MIRA CLAIM COMMAND CENTER</p>
          <h2>Complete Claim Overview</h2>
          <p className="description">
            One intelligent dashboard for claim status, damage, survey,
            risk, garage, repair, documents and pending actions.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!activeClaimId || refreshing}
            onClick={() =>
              activeClaimId
                ? void refreshClaimData(activeClaimId)
                : undefined
            }
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          {onClose && (
            <button
              type="button"
              className="close-button"
              onClick={onClose}
              aria-label="Close command center"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="policy-grid">
        <Summary
          label="Policy"
          value={policy.policy_number}
          subvalue={policy.insurance_company}
        />
        <Summary
          label="Vehicle"
          value={policy.vehicles?.vehicle_number || "Not linked"}
          subvalue={[policy.vehicles?.brand, policy.vehicles?.model]
            .filter(Boolean)
            .join(" ")}
        />
        <Summary
          label="Policy Expiry"
          value={formatDate(policy.expiry_date)}
        />
        <Summary
          label="Total Claims"
          value={String(data.claims.length)}
        />
      </div>

      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      {data.claims.length === 0 ? (
        <div className="empty-state">
          <strong>No insurance claim found.</strong>
          <p>Create a claim to activate the Command Center.</p>

          {onOpenClaimAssistant && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onOpenClaimAssistant(0)}
            >
              Create Claim
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="claim-selector">
            <label>
              Select Claim
              <select
                value={activeClaimId ?? ""}
                onChange={(event) => {
                  const claimId = Number(event.target.value);
                  setActiveClaimId(claimId);
                  void refreshClaimData(claimId);
                }}
              >
                {data.claims.map((claim) => (
                  <option key={claim.id} value={claim.id}>
                    {claim.claim_reference || `Claim #${claim.id}`} ·{" "}
                    {formatStatus(claim.incident_type)} ·{" "}
                    {formatStatus(claim.claim_status)}
                  </option>
                ))}
              </select>
            </label>

            {lastUpdatedAt && (
              <span className="last-updated">
                Updated {formatDateTime(lastUpdatedAt)}
              </span>
            )}
          </div>

          {activeClaim && (
            <>
              <div className="claim-hero">
                <div>
                  <p className="eyebrow">ACTIVE CLAIM</p>
                  <h3>
                    {activeClaim.claim_reference ||
                      `Claim #${activeClaim.id}`}
                  </h3>
                  <p>
                    {formatStatus(activeClaim.incident_type)} ·{" "}
                    {formatDate(activeClaim.incident_date)}
                    {activeClaim.incident_location
                      ? ` · ${activeClaim.incident_location}`
                      : ""}
                  </p>
                </div>

                <div className="progress-card">
                  <div className="progress-title">
                    <span>Claim Progress</span>
                    <strong>{progress}%</strong>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="status-grid">
                <StatusCard
                  label="Claim Status"
                  value={formatStatus(activeClaim.claim_status)}
                  tone={statusTone(activeClaim.claim_status)}
                />
                <StatusCard
                  label="Claim Stage"
                  value={formatStatus(activeClaim.claim_stage)}
                  tone="neutral"
                />
                <StatusCard
                  label="AI Claimability"
                  value={
                    activeClaim.ai_claimability_status
                      ? formatStatus(activeClaim.ai_claimability_status)
                      : "Pending"
                  }
                  tone={claimabilityTone(
                    activeClaim.ai_claimability_status
                  )}
                />
                <StatusCard
                  label="Settlement"
                  value={
                    activeClaim.actual_settlement_date
                      ? "Completed"
                      : activeClaim.expected_settlement_date
                        ? formatDate(
                            activeClaim.expected_settlement_date
                          )
                        : "Pending"
                  }
                  tone={
                    activeClaim.actual_settlement_date
                      ? "success"
                      : "warning"
                  }
                />
              </div>

              <div className="command-grid">
                <CommandCard
                  title="Smart Damage Assessment"
                  status={
                    data.damage
                      ? formatStatus(data.damage.assessment_status)
                      : "Not started"
                  }
                  score={
                    data.damage?.overall_confidence !== null &&
                    data.damage?.overall_confidence !== undefined
                      ? `${data.damage.overall_confidence}% confidence`
                      : undefined
                  }
                  tone={severityTone(data.damage?.overall_severity)}
                  summary={
                    data.damage?.visible_damage_summary ||
                    "Upload vehicle photos for Mira's visual assessment."
                  }
                  details={[
                    {
                      label: "Severity",
                      value: data.damage
                        ? formatStatus(data.damage.overall_severity)
                        : "Pending",
                    },
                    {
                      label: "Repair Estimate",
                      value: formatRange(
                        data.damage?.estimated_repair_cost_min ?? null,
                        data.damage?.estimated_repair_cost_max ?? null
                      ),
                    },
                    {
                      label: "Repair Time",
                      value: formatDayRange(
                        data.damage?.estimated_repair_days_min ?? null,
                        data.damage?.estimated_repair_days_max ?? null
                      ),
                    },
                    {
                      label: "Towing",
                      value: data.damage?.towing_recommended
                        ? "Recommended"
                        : "Not indicated",
                    },
                  ]}
                  actionLabel={
                    data.damage ? "View / Reassess" : "Start Assessment"
                  }
                  onAction={
                    onOpenDamageAssessment
                      ? () => onOpenDamageAssessment(activeClaim.id)
                      : undefined
                  }
                />

                <CommandCard
                  title="AI Surveyor Assistant"
                  status={
                    data.survey
                      ? formatStatus(data.survey.review_status)
                      : "Not started"
                  }
                  score={
                    data.survey?.recommendation_confidence !== null &&
                    data.survey?.recommendation_confidence !== undefined
                      ? `${data.survey.recommendation_confidence}% confidence`
                      : undefined
                  }
                  tone={recommendationTone(data.survey?.recommendation)}
                  summary={
                    data.survey?.surveyor_summary ||
                    "Survey review will compare policy coverage, damage and garage estimate."
                  }
                  details={[
                    {
                      label: "Recommendation",
                      value: data.survey
                        ? formatStatus(data.survey.recommendation)
                        : "Pending",
                    },
                    {
                      label: "Coverage Match",
                      value: formatPercent(
                        data.survey?.coverage_match_confidence
                      ),
                    },
                    {
                      label: "Estimate Check",
                      value: formatPercent(
                        data.survey
                          ?.estimate_reasonableness_confidence
                      ),
                    },
                    {
                      label: "Inflation Risk",
                      value: data.survey
                        ? formatStatus(data.survey.inflation_risk_level)
                        : "Unknown",
                    },
                  ]}
                />

                <CommandCard
                  title="AI Claim Risk Review"
                  status={
                    data.fraud
                      ? formatStatus(data.fraud.review_status)
                      : "Not started"
                  }
                  score={
                    data.fraud?.risk_score !== null &&
                    data.fraud?.risk_score !== undefined
                      ? `Risk score ${data.fraud.risk_score}/100`
                      : undefined
                  }
                  tone={riskTone(data.fraud?.risk_level)}
                  summary={
                    data.fraud?.recommendation_summary ||
                    "Mira checks claim consistency and creates risk indicators for human review."
                  }
                  details={[
                    {
                      label: "Risk Level",
                      value: data.fraud
                        ? formatStatus(data.fraud.risk_level)
                        : "Unknown",
                    },
                    {
                      label: "Recommendation",
                      value: data.fraud
                        ? formatStatus(data.fraud.recommendation)
                        : "Pending",
                    },
                    {
                      label: "Confidence",
                      value: formatPercent(data.fraud?.risk_confidence),
                    },
                    {
                      label: "Investigation",
                      value: data.fraud?.manual_investigation_required
                        ? "Required"
                        : "Not required",
                    },
                  ]}
                />

                <CommandCard
                  title="Garage & Live Repair"
                  status={
                    data.repair
                      ? formatStatus(data.repair.repair_status)
                      : activeClaim.selected_garage_name
                        ? "Garage selected"
                        : "Not assigned"
                  }
                  tone={repairTone(data.repair?.repair_status)}
                  summary={
                    data.repair?.cashless_garages
                      ? `${data.repair.cashless_garages.name}, ${data.repair.cashless_garages.city}`
                      : activeClaim.selected_garage_name ||
                        "Find a qualified cashless garage and check live queue."
                  }
                  details={[
                    {
                      label: "Repair Estimate",
                      value: formatCurrency(
                        data.repair?.estimated_cost ??
                          activeClaim.estimated_repair_cost
                      ),
                    },
                    {
                      label: "Insurer Approved",
                      value: formatCurrency(
                        data.repair?.insurer_approved_amount ??
                          activeClaim.approved_claim_amount
                      ),
                    },
                    {
                      label: "Customer Payable",
                      value: formatCurrency(
                        data.repair?.customer_payable_amount
                      ),
                    },
                    {
                      label: "Completion",
                      value: data.repair?.estimated_completion_date
                        ? formatDate(
                            data.repair.estimated_completion_date
                          )
                        : "Pending",
                    },
                  ]}
                  actionLabel={
                    data.repair ? "Open Repair Tracker" : "Find Garage"
                  }
                  onAction={
                    data.repair
                      ? onOpenRepairTracker
                        ? () => onOpenRepairTracker(activeClaim.id)
                        : undefined
                      : onOpenGarageFinder
                        ? () => onOpenGarageFinder(activeClaim.id)
                        : undefined
                  }
                />
              </div>

              <div className="financial-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">FINANCIAL OVERVIEW</p>
                    <h3>Estimate, Approval & Settlement</h3>
                  </div>
                </div>

                <div className="financial-grid">
                  <Summary
                    label="AI Estimate"
                    value={formatRange(
                      data.damage?.estimated_repair_cost_min ?? null,
                      data.damage?.estimated_repair_cost_max ?? null
                    )}
                  />
                  <Summary
                    label="Garage Estimate"
                    value={formatCurrency(
                      data.repair?.estimated_cost ??
                        activeClaim.estimated_repair_cost
                    )}
                  />
                  <Summary
                    label="Recommended Approval"
                    value={formatRange(
                      data.survey?.recommended_approved_amount_min ??
                        null,
                      data.survey?.recommended_approved_amount_max ??
                        null
                    )}
                  />
                  <Summary
                    label="Approved Amount"
                    value={formatCurrency(
                      activeClaim.approved_claim_amount
                    )}
                  />
                  <Summary
                    label="Customer Payable"
                    value={formatCurrency(
                      data.repair?.customer_payable_amount
                    )}
                  />
                  <Summary
                    label="Settlement Amount"
                    value={formatCurrency(
                      activeClaim.settlement_amount
                    )}
                  />
                </div>
              </div>

              <div className="two-column-section">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">PENDING ACTIONS</p>
                      <h3>Mira Action Center</h3>
                    </div>
                    <span className="count-badge">
                      {pendingActions.length}
                    </span>
                  </div>

                  {pendingActions.length === 0 ? (
                    <div className="empty-inline">
                      No immediate action required.
                    </div>
                  ) : (
                    <div className="action-list">
                      {pendingActions.map((action, index) => (
                        <article
                          className={`action-item action-${action.tone}`}
                          key={`${action.title}-${index}`}
                        >
                          <div>
                            <strong>{action.title}</strong>
                            <p>{action.description}</p>
                          </div>
                          <span>{action.owner}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">DOCUMENT CHECKLIST</p>
                      <h3>Claim Readiness</h3>
                    </div>
                    <span className="count-badge">
                      {checklistProgress(data.checklist)}%
                    </span>
                  </div>

                  <div className="progress-track small">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${checklistProgress(
                          data.checklist
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="checklist">
                    {data.checklist.slice(0, 8).map((item) => (
                      <label
                        className={
                          item.is_completed
                            ? "checklist-item completed"
                            : "checklist-item"
                        }
                        key={item.id}
                      >
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          onChange={() =>
                            void markChecklistComplete(item)
                          }
                        />

                        <div>
                          <strong>{item.item_label}</strong>
                          {item.item_description && (
                            <p>{item.item_description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              <section className="timeline-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">CLAIM TIMELINE</p>
                    <h3>Latest Activity</h3>
                  </div>
                  <span className="count-badge">
                    {data.timeline.length}
                  </span>
                </div>

                {data.timeline.length === 0 ? (
                  <div className="empty-inline">
                    No claim activity yet.
                  </div>
                ) : (
                  <div className="timeline">
                    {data.timeline.map((event) => (
                      <article className="timeline-item" key={event.id}>
                        <div className="timeline-dot" />

                        <div>
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

                          <small>
                            {formatDateTime(event.created_at)}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      <div className="advisory-note">
        <span>ℹ</span>
        <p>
          Mira provides decision support and workflow guidance. Claim
          approval, survey conclusions, investigation decisions and
          settlement remain with authorized insurers, surveyors and
          investigators.
        </p>
      </div>

      <Style />
    </section>
  );
}

function CommandCard({
  title,
  status,
  score,
  tone,
  summary,
  details,
  actionLabel,
  onAction,
}: {
  title: string;
  status: string;
  score?: string;
  tone: "success" | "warning" | "danger" | "neutral";
  summary: string;
  details: Array<{ label: string; value: string }>;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <article className="command-card">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          {score && <small>{score}</small>}
        </div>

        <span className={`tone-badge tone-${tone}`}>{status}</span>
      </div>

      <p className="card-summary">{summary}</p>

      <div className="card-details">
        {details.map((detail) => (
          <div key={detail.label}>
            <span>{detail.label}</span>
            <strong>{detail.value}</strong>
          </div>
        ))}
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          className="secondary-button card-button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </article>
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
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {subvalue && <small>{subvalue}</small>}
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
  return (
    <div className={`status-card status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildPendingActions(
  claim: ClaimRow | null,
  data: CommandCenterData
) {
  if (!claim) return [];

  const actions: Array<{
    title: string;
    description: string;
    owner: string;
    tone: "warning" | "danger" | "info";
  }> = [];

  if (!data.damage) {
    actions.push({
      title: "Complete damage assessment",
      description:
        "Upload clear vehicle photos so Mira can estimate visible damage.",
      owner: "User",
      tone: "warning",
    });
  }

  if (claim.ai_missing_documents?.length) {
    actions.push({
      title: "Upload missing claim documents",
      description: claim.ai_missing_documents.join(", "),
      owner: "User",
      tone: "warning",
    });
  }

  if (data.damage?.towing_recommended && !data.repair) {
    actions.push({
      title: "Arrange towing",
      description:
        "Mira recommends avoiding driving until physical inspection.",
      owner: "User",
      tone: "danger",
    });
  }

  if (!data.survey && data.damage) {
    actions.push({
      title: "Generate survey review",
      description:
        "Compare policy coverage, detected damage and garage estimate.",
      owner: "Insurer",
      tone: "info",
    });
  }

  if (data.survey?.manual_review_required) {
    actions.push({
      title: "Human surveyor review required",
      description:
        data.survey.clarification_questions?.join(", ") ||
        "The survey review requires manual verification.",
      owner: "Surveyor",
      tone: "warning",
    });
  }

  if (data.fraud?.manual_investigation_required) {
    actions.push({
      title: "Claim consistency review required",
      description:
        data.fraud.risk_reasons?.join(", ") ||
        "Risk indicators require human investigation.",
      owner: "Investigator",
      tone: "danger",
    });
  }

  if (!data.repair && claim.claim_status !== "rejected") {
    actions.push({
      title: "Select qualified garage",
      description:
        "Use the queue optimizer to find the best cashless partner.",
      owner: "User",
      tone: "info",
    });
  }

  if (
    data.repair?.repair_status === "insurer_approval_pending"
  ) {
    actions.push({
      title: "Repair approval pending",
      description:
        "The garage is waiting for insurer authorization.",
      owner: "Insurer",
      tone: "warning",
    });
  }

  return actions.slice(0, 8);
}

function calculateClaimProgress(
  claim: ClaimRow | null,
  data: CommandCenterData
) {
  if (!claim) return 0;

  const stageProgress: Record<string, number> = {
    incident_reported: 10,
    damage_assessment: 25,
    document_collection: 35,
    claim_submission: 45,
    insurer_review: 58,
    surveyor_inspection: 68,
    garage_repair: 78,
    approval: 84,
    settlement: 94,
    completed: 100,
  };

  let progress = stageProgress[claim.claim_stage] ?? 5;

  if (data.damage) progress = Math.max(progress, 25);
  if (data.survey) progress = Math.max(progress, 62);
  if (data.fraud) progress = Math.max(progress, 66);
  if (data.repair) progress = Math.max(progress, 75);

  if (
    ["settled", "closed"].includes(claim.claim_status)
  ) {
    return 100;
  }

  return Math.min(99, progress);
}

function checklistProgress(items: ChecklistItem[]) {
  if (!items.length) return 0;

  const completed = items.filter((item) => item.is_completed).length;
  return Math.round((completed / items.length) * 100);
}

function statusTone(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (
    ["approved", "settled", "closed", "completed"].includes(status)
  ) {
    return "success";
  }

  if (["rejected", "cancelled"].includes(status)) {
    return "danger";
  }

  if (
    [
      "submitted",
      "under_review",
      "documents_required",
      "surveyor_assigned",
      "settlement_pending",
      "partially_approved",
    ].includes(status)
  ) {
    return "warning";
  }

  return "neutral";
}

function claimabilityTone(
  status: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (status === "likely_claimable") return "success";
  if (
    status === "possibly_claimable" ||
    status === "manual_review_required"
  ) {
    return "warning";
  }
  if (status === "unlikely_claimable") return "danger";
  return "neutral";
}

function severityTone(
  severity?: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (severity === "minor") return "success";
  if (severity === "moderate") return "warning";
  if (severity === "major" || severity === "critical") {
    return "danger";
  }
  return "neutral";
}

function recommendationTone(
  recommendation?: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (recommendation === "approve") return "success";
  if (
    recommendation === "approve_with_conditions" ||
    recommendation === "clarification_required" ||
    recommendation === "manual_review"
  ) {
    return "warning";
  }
  if (recommendation === "reject_recommended") return "danger";
  return "neutral";
}

function riskTone(
  risk?: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (risk === "low") return "success";
  if (risk === "medium") return "warning";
  if (risk === "high" || risk === "critical") return "danger";
  return "neutral";
}

function repairTone(
  status?: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (
    status === "ready_for_delivery" ||
    status === "delivered"
  ) {
    return "success";
  }
  if (
    status &&
    [
      "inspection_in_progress",
      "estimate_ready",
      "insurer_approval_pending",
      "approved",
      "repair_in_progress",
      "parts_ordered",
      "painting",
      "quality_check",
    ].includes(status)
  ) {
    return "warning";
  }
  if (status === "cancelled") return "danger";
  return "neutral";
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined
    ? "Pending"
    : `${value}%`;
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRange(
  minimum: number | null,
  maximum: number | null
) {
  if (minimum === null && maximum === null) {
    return "Not available";
  }

  if (minimum !== null && maximum !== null) {
    return `${formatCurrency(minimum)} – ${formatCurrency(maximum)}`;
  }

  return formatCurrency(minimum ?? maximum);
}

function formatDayRange(
  minimum: number | null,
  maximum: number | null
) {
  if (minimum === null && maximum === null) {
    return "Not available";
  }

  if (minimum !== null && maximum !== null) {
    return minimum === maximum
      ? `${minimum} day${minimum === 1 ? "" : "s"}`
      : `${minimum}–${maximum} days`;
  }

  const value = minimum ?? maximum ?? 0;
  return `${value} day${value === 1 ? "" : "s"}`;
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

function Style() {
  return (
    <style jsx>{`
      .command-center {
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
      .claim-hero,
      .claim-selector,
      .section-heading,
      .progress-title,
      .card-header,
      .timeline-title {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .header {
        align-items: flex-start;
        margin-bottom: 22px;
      }

      .header-actions {
        align-items: center;
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
      .claim-hero p {
        margin: 8px 0 0;
        color: #94a3b8;
        line-height: 1.5;
      }

      .close-button {
        width: 42px;
        height: 42px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.82);
        color: #e2e8f0;
        font-size: 28px;
        cursor: pointer;
      }

      .primary-button,
      .secondary-button {
        min-height: 42px;
        padding: 10px 15px;
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

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .policy-grid,
      .status-grid,
      .financial-grid {
        display: grid;
        gap: 14px;
      }

      .policy-grid,
      .status-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .financial-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }

      .summary-card,
      .status-card {
        display: grid;
        gap: 6px;
        padding: 15px;
        border-radius: 15px;
      }

      .summary-card {
        border: 1px solid rgba(148, 163, 184, 0.12);
        background: rgba(2, 6, 23, 0.34);
      }

      .summary-card span,
      .status-card span,
      .card-details span {
        color: #64748b;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .summary-card strong {
        color: #e2e8f0;
      }

      .summary-card small {
        color: #94a3b8;
      }

      .status-success {
        background: rgba(20, 83, 45, 0.18);
        color: #a7f3d0;
      }

      .status-warning {
        background: rgba(133, 77, 14, 0.2);
        color: #fde68a;
      }

      .status-danger {
        background: rgba(127, 29, 29, 0.2);
        color: #fecaca;
      }

      .status-neutral {
        background: rgba(51, 65, 85, 0.3);
        color: #cbd5e1;
      }

      .claim-selector {
        align-items: flex-end;
        margin-top: 20px;
        padding: 16px;
        border-radius: 15px;
        background: rgba(2, 6, 23, 0.32);
      }

      .claim-selector label {
        display: grid;
        flex: 1;
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

      .last-updated {
        color: #64748b;
        font-size: 12px;
      }

      .claim-hero,
      .financial-section,
      .panel,
      .timeline-panel {
        margin-top: 20px;
        padding: 20px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        background: rgba(2, 6, 23, 0.34);
      }

      .claim-hero {
        align-items: center;
      }

      .progress-card {
        min-width: 280px;
      }

      .progress-title {
        margin-bottom: 8px;
      }

      .progress-title strong {
        color: #bfdbfe;
      }

      .progress-track {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.16);
      }

      .progress-track.small {
        height: 8px;
      }

      .progress-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2563eb, #60a5fa);
      }

      .status-grid {
        margin-top: 18px;
      }

      .command-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 20px;
      }

      .command-card {
        display: flex;
        flex-direction: column;
        padding: 20px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 18px;
        background: rgba(2, 6, 23, 0.4);
      }

      .card-header small {
        display: block;
        margin-top: 6px;
        color: #94a3b8;
      }

      .tone-badge,
      .count-badge {
        padding: 6px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
      }

      .tone-success {
        background: rgba(20, 83, 45, 0.2);
        color: #a7f3d0;
      }

      .tone-warning {
        background: rgba(133, 77, 14, 0.2);
        color: #fde68a;
      }

      .tone-danger {
        background: rgba(127, 29, 29, 0.2);
        color: #fecaca;
      }

      .tone-neutral,
      .count-badge {
        background: rgba(37, 99, 235, 0.15);
        color: #bfdbfe;
      }

      .card-summary {
        flex: 1;
        margin: 14px 0;
        color: #94a3b8;
        line-height: 1.55;
      }

      .card-details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .card-details > div {
        display: grid;
        gap: 5px;
        padding: 11px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.52);
      }

      .card-details strong {
        color: #dbeafe;
        overflow-wrap: anywhere;
      }

      .card-button {
        width: 100%;
        margin-top: 15px;
      }

      .two-column-section {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .section-heading {
        align-items: flex-end;
        margin-bottom: 15px;
      }

      .action-list,
      .checklist,
      .timeline {
        display: grid;
        gap: 10px;
      }

      .action-item {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 14px;
        border-radius: 14px;
      }

      .action-warning {
        background: rgba(133, 77, 14, 0.13);
      }

      .action-danger {
        background: rgba(127, 29, 29, 0.16);
      }

      .action-info {
        background: rgba(30, 64, 175, 0.1);
      }

      .action-item p,
      .checklist-item p,
      .timeline-item p {
        margin: 6px 0 0;
        color: #94a3b8;
        line-height: 1.45;
      }

      .action-item > span {
        color: #bfdbfe;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
      }

      .checklist {
        margin-top: 14px;
      }

      .checklist-item {
        display: grid;
        grid-template-columns: 22px minmax(0, 1fr);
        gap: 11px;
        padding: 12px;
        border-radius: 13px;
        background: rgba(15, 23, 42, 0.5);
        cursor: pointer;
      }

      .checklist-item.completed {
        opacity: 0.65;
      }

      .checklist-item input {
        width: auto;
        margin-top: 3px;
        accent-color: #3b82f6;
      }

      .timeline-item {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 12px;
        padding: 14px;
        border-radius: 14px;
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
      }

      .timeline-item small {
        display: block;
        margin-top: 8px;
        color: #64748b;
      }

      .empty-state,
      .empty-inline {
        padding: 30px;
        border-radius: 15px;
        background: rgba(2, 6, 23, 0.3);
        color: #94a3b8;
        text-align: center;
      }

      .empty-state {
        margin-top: 18px;
      }

      .empty-state strong {
        color: #f8fafc;
      }

      .empty-state p {
        margin: 7px 0 15px;
      }

      .error-message {
        margin-top: 15px;
        padding: 13px 15px;
        border-radius: 12px;
        background: rgba(127, 29, 29, 0.2);
        color: #fecaca;
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

      @media (max-width: 1180px) {
        .financial-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 900px) {
        .policy-grid,
        .status-grid,
        .command-grid,
        .two-column-section {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .two-column-section {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .command-center {
          padding: 18px;
        }

        .header,
        .header-actions,
        .claim-hero,
        .claim-selector,
        .section-heading {
          flex-direction: column;
          align-items: stretch;
        }

        .policy-grid,
        .status-grid,
        .command-grid,
        .financial-grid,
        .card-details {
          grid-template-columns: 1fr;
        }

        .progress-card {
          min-width: 0;
        }

        .secondary-button,
        .primary-button {
          width: 100%;
        }
      }
    `}</style>
  );
}