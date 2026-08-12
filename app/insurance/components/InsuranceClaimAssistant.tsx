"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../../supabase";

type InsuranceClaim = {
  id: number;
  user_id: string;
  policy_id: number;
  vehicle_id: number;

  claim_reference: string | null;
  insurer_claim_reference: string | null;

  incident_type: string;
  incident_date: string;
  incident_time: string | null;
  incident_location: string | null;
  incident_description: string | null;

  police_report_required: boolean | null;
  fir_number: string | null;
  police_station: string | null;

  claim_status: string;
  claim_stage: string;

  estimated_repair_cost: number | null;
  approved_claim_amount: number | null;
  settlement_amount: number | null;

  selected_garage_name: string | null;
  selected_garage_phone: string | null;
  selected_garage_address: string | null;
  selected_garage_is_cashless: boolean | null;

  surveyor_name: string | null;
  surveyor_phone: string | null;
  surveyor_visit_date: string | null;

  expected_settlement_date: string | null;
  actual_settlement_date: string | null;

  rejection_risk_level: string | null;
  rejection_risk_reasons: string[] | null;

  ai_claimability_status: string | null;
  ai_claimability_confidence: number | null;
  ai_damage_summary: string | null;
  ai_repair_cost_min: number | null;
  ai_repair_cost_max: number | null;
  ai_fir_guidance: string | null;
  ai_next_steps: string[] | null;
  ai_missing_documents: string[] | null;
  ai_assessed_at: string | null;

  notes: string | null;

  created_at: string;
  updated_at: string;
};

type ClaimChecklistItem = {
  id: number;
  item_key: string;
  item_label: string;
  item_description: string | null;
  is_required: boolean;
  is_completed: boolean;
  linked_document_id: number | null;
  completed_at: string | null;
};

type ClaimTimelineEvent = {
  id: number;
  event_type: string;
  event_status: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type PolicySummary = {
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

type Props = {
  policy: PolicySummary;
  onClose?: () => void;
};

type ClaimForm = {
  incident_type: string;
  incident_date: string;
  incident_time: string;
  incident_location: string;
  incident_description: string;
  fir_number: string;
  police_station: string;
};

const initialForm: ClaimForm = {
  incident_type: "accident",
  incident_date: "",
  incident_time: "",
  incident_location: "",
  incident_description: "",
  fir_number: "",
  police_station: "",
};

const MAX_FILES = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function InsuranceClaimAssistant({
  policy,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [activeClaimId, setActiveClaimId] = useState<number | null>(
    null
  );
  const [checklist, setChecklist] = useState<ClaimChecklistItem[]>([]);
  const [timeline, setTimeline] = useState<ClaimTimelineEvent[]>([]);

  const [form, setForm] = useState<ClaimForm>(initialForm);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [showNewClaimForm, setShowNewClaimForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [updatingChecklistId, setUpdatingChecklistId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadClaims();
  }, [policy.id]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  const activeClaim = useMemo(
    () =>
      claims.find((claim) => claim.id === activeClaimId) ?? null,
    [claims, activeClaimId]
  );

  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) {
      return 0;
    }

    const completed = checklist.filter(
      (item) => item.is_completed
    ).length;

    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  async function loadClaims(preferredClaimId?: number) {
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

    const { data, error } = await supabase
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

    const rows = (data ?? []) as InsuranceClaim[];
    setClaims(rows);

    const nextClaimId =
      preferredClaimId ??
      activeClaimId ??
      rows[0]?.id ??
      null;

    setActiveClaimId(nextClaimId);

    if (nextClaimId) {
      await Promise.all([
        loadChecklist(nextClaimId),
        loadTimeline(nextClaimId),
      ]);
    } else {
      setChecklist([]);
      setTimeline([]);
    }

    setLoading(false);
  }

  async function loadChecklist(claimId: number) {
    const { data, error } = await supabase
      .from("insurance_claim_checklist")
      .select("*")
      .eq("claim_id", claimId)
      .order("is_required", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setChecklist((data ?? []) as ClaimChecklistItem[]);
  }

  async function loadTimeline(claimId: number) {
    const { data, error } = await supabase
      .from("insurance_claim_timeline")
      .select("*")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setTimeline((data ?? []) as ClaimTimelineEvent[]);
  }

  async function createClaim(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.incident_date) {
      setErrorMessage("Incident date is required.");
      return;
    }

    if (!form.incident_description.trim()) {
      setErrorMessage("Incident description is required.");
      return;
    }

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
        .from("insurance_claims")
        .insert({
          user_id: user.id,
          policy_id: policy.id,
          vehicle_id: policy.vehicle_id,
          incident_type: form.incident_type,
          incident_date: form.incident_date,
          incident_time: form.incident_time || null,
          incident_location:
            form.incident_location.trim() || null,
          incident_description:
            form.incident_description.trim(),
          fir_number: form.fir_number.trim() || null,
          police_station:
            form.police_station.trim() || null,
          claim_status: "draft",
          claim_stage: "incident_reported",
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          error?.message || "Unable to create the claim."
        );
      }

      const createdClaim = data as InsuranceClaim;

      setForm(initialForm);
      setShowNewClaimForm(false);
      setMessage("Claim draft created successfully.");

      await loadClaims(createdClaim.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the claim."
      );
    } finally {
      setCreating(false);
    }
  }

  function handlePhotoInput(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? []
    );

    event.target.value = "";

    addPhotos(selectedFiles);
  }

  function handlePhotoDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setIsDragging(false);

    addPhotos(Array.from(event.dataTransfer.files ?? []));
  }

  function addPhotos(files: File[]) {
    setErrorMessage("");

    const remainingSlots = MAX_FILES - photos.length;

    if (remainingSlots <= 0) {
      setErrorMessage(
        `You can upload a maximum of ${MAX_FILES} photos.`
      );
      return;
    }

    const accepted: File[] = [];

    for (const file of files.slice(0, remainingSlots)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrorMessage(
          "Only JPG, PNG and WEBP photos are supported."
        );
        continue;
      }

      if (file.size === 0) {
        setErrorMessage(`"${file.name}" is empty.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(
          `"${file.name}" must be 10 MB or less.`
        );
        continue;
      }

      accepted.push(file);
    }

    if (accepted.length === 0) {
      return;
    }

    setPhotos((current) => [...current, ...accepted]);
    setPhotoPreviews((current) => [
      ...current,
      ...accepted.map((file) =>
        URL.createObjectURL(file)
      ),
    ]);
  }

  function removePhoto(index: number) {
    setPhotoPreviews((current) => {
      const preview = current[index];

      if (preview) {
        URL.revokeObjectURL(preview);
      }

      return current.filter(
        (_, currentIndex) => currentIndex !== index
      );
    });

    setPhotos((current) =>
      current.filter(
        (_, currentIndex) => currentIndex !== index
      )
    );
  }

  function clearPhotos() {
    photoPreviews.forEach((url) =>
      URL.revokeObjectURL(url)
    );

    setPhotoPreviews([]);
    setPhotos([]);
  }

  async function analyseClaim() {
    if (!activeClaim) {
      setErrorMessage("Select or create a claim first.");
      return;
    }

    setAnalysing(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const formData = new FormData();
      formData.append(
        "claimId",
        String(activeClaim.id)
      );

      photos.forEach((photo) => {
        formData.append("files", photo);
      });

      const response = await fetch(
        "/api/insurance/claim/analyse",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Mira could not analyse the claim."
        );
      }

      clearPhotos();
      setMessage(
        "Mira completed the preliminary claim assessment."
      );

      await loadClaims(activeClaim.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Mira could not analyse the claim."
      );
    } finally {
      setAnalysing(false);
    }
  }

  async function toggleChecklist(
    item: ClaimChecklistItem
  ) {
    setUpdatingChecklistId(item.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("insurance_claim_checklist")
      .update({
        is_completed: !item.is_completed,
      })
      .eq("id", item.id);

    if (error) {
      setErrorMessage(error.message);
      setUpdatingChecklistId(null);
      return;
    }

    if (activeClaimId) {
      await loadChecklist(activeClaimId);
    }

    setUpdatingChecklistId(null);
  }

  async function updateClaimStatus(
    status: string,
    stage: string
  ) {
    if (!activeClaim) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("insurance_claims")
      .update({
        claim_status: status,
        claim_stage: stage,
      })
      .eq("id", activeClaim.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("insurance_claim_timeline")
        .insert({
          user_id: user.id,
          claim_id: activeClaim.id,
          event_type: "claim_status_updated",
          event_status: status,
          title: `Claim moved to ${formatStatus(status)}`,
          description:
            "The claim status was updated in My Vehicle.",
          metadata: {
            claim_stage: stage,
          },
        });
    }

    setMessage("Claim status updated.");
    await loadClaims(activeClaim.id);
  }

  return (
    <section className="assistant">
      <div className="header">
        <div>
          <p className="eyebrow">MIRA CLAIM ASSISTANT</p>
          <h2>Insurance Claim Center</h2>
          <p className="description">
            Create a claim, upload damage photos, review Mira’s
            assessment and track every step.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowNewClaimForm((current) => !current)
            }
          >
            {showNewClaimForm
              ? "Close New Claim"
              : "+ New Claim"}
          </button>

          {onClose && (
            <button
              type="button"
              className="close-button"
              onClick={onClose}
              aria-label="Close claim assistant"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="policy-summary">
        <Summary
          label="Policy"
          value={policy.policy_number}
          subvalue={policy.insurance_company}
        />

        <Summary
          label="Vehicle"
          value={
            policy.vehicles?.vehicle_number ||
            "Not linked"
          }
          subvalue={[
            policy.vehicles?.brand,
            policy.vehicles?.model,
          ]
            .filter(Boolean)
            .join(" ")}
        />

        <Summary
          label="Expiry"
          value={formatDate(policy.expiry_date)}
        />

        <Summary
          label="Open Claims"
          value={String(
            claims.filter(
              (claim) =>
                ![
                  "settled",
                  "closed",
                  "cancelled",
                ].includes(claim.claim_status)
            ).length
          )}
        />
      </div>

      {showNewClaimForm && (
        <form
          className="new-claim-form"
          onSubmit={createClaim}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">NEW CLAIM</p>
              <h3>Incident Details</h3>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Incident Type
              <select
                value={form.incident_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    incident_type: event.target.value,
                  })
                }
              >
                <option value="accident">Accident</option>
                <option value="theft">Theft</option>
                <option value="fire">Fire</option>
                <option value="flood">Flood</option>
                <option value="natural_disaster">
                  Natural Disaster
                </option>
                <option value="vandalism">
                  Vandalism
                </option>
                <option value="third_party_damage">
                  Third-Party Damage
                </option>
                <option value="glass_damage">
                  Glass Damage
                </option>
                <option value="personal_accident">
                  Personal Accident
                </option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Incident Date
              <input
                type="date"
                value={form.incident_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    incident_date: event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Incident Time
              <input
                type="time"
                value={form.incident_time}
                onChange={(event) =>
                  setForm({
                    ...form,
                    incident_time: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Incident Location
              <input
                value={form.incident_location}
                onChange={(event) =>
                  setForm({
                    ...form,
                    incident_location: event.target.value,
                  })
                }
                placeholder="Road, city or landmark"
              />
            </label>

            <label>
              FIR Number
              <input
                value={form.fir_number}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fir_number: event.target.value,
                  })
                }
                placeholder="Optional"
              />
            </label>

            <label>
              Police Station
              <input
                value={form.police_station}
                onChange={(event) =>
                  setForm({
                    ...form,
                    police_station: event.target.value,
                  })
                }
                placeholder="Optional"
              />
            </label>

            <label className="full-width">
              Incident Description
              <textarea
                rows={4}
                value={form.incident_description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    incident_description:
                      event.target.value,
                  })
                }
                placeholder="Explain what happened, visible damage and any third-party involvement."
                required
              />
            </label>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={creating}
          >
            {creating
              ? "Creating Claim..."
              : "Create Claim Draft"}
          </button>
        </form>
      )}

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
          Loading claims...
        </div>
      ) : claims.length === 0 ? (
        <div className="empty-state">
          <strong>No claims created yet.</strong>
          <p>
            Create a claim draft to begin Mira’s guided
            assessment.
          </p>
        </div>
      ) : (
        <>
          <div className="claim-selector">
            <label>
              Select Claim
              <select
                value={activeClaimId ?? ""}
                onChange={(event) => {
                  const claimId = Number(
                    event.target.value
                  );

                  setActiveClaimId(claimId);

                  void Promise.all([
                    loadChecklist(claimId),
                    loadTimeline(claimId),
                  ]);
                }}
              >
                {claims.map((claim) => (
                  <option
                    key={claim.id}
                    value={claim.id}
                  >
                    #{claim.id} ·{" "}
                    {formatStatus(
                      claim.incident_type
                    )} ·{" "}
                    {formatStatus(
                      claim.claim_status
                    )}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeClaim && (
            <>
              <div className="status-grid">
                <StatusCard
                  label="Claim Status"
                  value={formatStatus(
                    activeClaim.claim_status
                  )}
                  tone={getStatusTone(
                    activeClaim.claim_status
                  )}
                />

                <StatusCard
                  label="Claim Stage"
                  value={formatStatus(
                    activeClaim.claim_stage
                  )}
                  tone="neutral"
                />

                <StatusCard
                  label="Mira Assessment"
                  value={
                    activeClaim.ai_claimability_status
                      ? formatStatus(
                          activeClaim.ai_claimability_status
                        )
                      : "Not analysed"
                  }
                  tone={getAssessmentTone(
                    activeClaim.ai_claimability_status
                  )}
                />

                <StatusCard
                  label="Rejection Risk"
                  value={formatStatus(
                    activeClaim.rejection_risk_level ||
                      "unknown"
                  )}
                  tone={getRiskTone(
                    activeClaim.rejection_risk_level
                  )}
                />
              </div>

              <div className="claim-details">
                <Detail
                  label="Incident"
                  value={formatStatus(
                    activeClaim.incident_type
                  )}
                />
                <Detail
                  label="Date"
                  value={formatDate(
                    activeClaim.incident_date
                  )}
                />
                <Detail
                  label="Location"
                  value={
                    activeClaim.incident_location ||
                    "Not provided"
                  }
                />
                <Detail
                  label="FIR"
                  value={
                    activeClaim.fir_number ||
                    (activeClaim.police_report_required
                      ? "Likely required"
                      : "Not provided")
                  }
                />
              </div>

              <div className="photo-analysis-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      DAMAGE PHOTOS
                    </p>
                    <h3>Analyse with Mira</h3>
                  </div>

                  <span className="count-badge">
                    {photos.length}/{MAX_FILES}
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handlePhotoInput}
                  hidden
                />

                <div
                  className={`drop-zone ${
                    isDragging ? "dragging" : ""
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() =>
                    setIsDragging(false)
                  }
                  onDrop={handlePhotoDrop}
                >
                  <div>
                    <strong>
                      Upload clear damage photographs
                    </strong>
                    <p>
                      JPG, PNG or WEBP · Up to 8 photos ·
                      10 MB each
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    Choose Photos
                  </button>
                </div>

                {photoPreviews.length > 0 && (
                  <div className="photo-grid">
                    {photoPreviews.map(
                      (preview, index) => (
                        <div
                          className="photo-card"
                          key={`${preview}-${index}`}
                        >
                          <img
                            src={preview}
                            alt={`Damage preview ${
                              index + 1
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removePhoto(index)
                            }
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="primary-button analyse-button"
                  onClick={() =>
                    void analyseClaim()
                  }
                  disabled={analysing}
                >
                  {analysing
                    ? "Mira is Analysing..."
                    : "Analyse Claim with Mira"}
                </button>
              </div>

              {activeClaim.ai_assessed_at && (
                <div className="assessment-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">
                        AI ASSESSMENT
                      </p>
                      <h3>Mira’s Preliminary Review</h3>
                    </div>

                    <span className="count-badge">
                      {activeClaim.ai_claimability_confidence ??
                        0}
                      % confidence
                    </span>
                  </div>

                  <div className="assessment-summary">
                    <div>
                      <span>Damage Summary</span>
                      <p>
                        {activeClaim.ai_damage_summary ||
                          "No summary available."}
                      </p>
                    </div>

                    <div>
                      <span>
                        Repair Cost Range
                      </span>
                      <strong>
                        {formatRange(
                          activeClaim.ai_repair_cost_min,
                          activeClaim.ai_repair_cost_max
                        )}
                      </strong>
                    </div>
                  </div>

                  {activeClaim.ai_fir_guidance && (
                    <div className="guidance-box">
                      <strong>FIR Guidance</strong>
                      <p>
                        {activeClaim.ai_fir_guidance}
                      </p>
                    </div>
                  )}

                  {activeClaim.rejection_risk_reasons &&
                    activeClaim
                      .rejection_risk_reasons.length >
                      0 && (
                      <ListPanel
                        title="Potential Rejection Risks"
                        items={
                          activeClaim.rejection_risk_reasons
                        }
                        tone="danger"
                      />
                    )}

                  {activeClaim.ai_missing_documents &&
                    activeClaim
                      .ai_missing_documents.length >
                      0 && (
                      <ListPanel
                        title="Missing Documents"
                        items={
                          activeClaim.ai_missing_documents
                        }
                        tone="warning"
                      />
                    )}

                  {activeClaim.ai_next_steps &&
                    activeClaim.ai_next_steps
                      .length > 0 && (
                      <ListPanel
                        title="Next Recommended Steps"
                        items={
                          activeClaim.ai_next_steps
                        }
                        tone="info"
                      />
                    )}
                </div>
              )}

              <div className="checklist-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      CLAIM CHECKLIST
                    </p>
                    <h3>Required Documents</h3>
                  </div>

                  <span className="count-badge">
                    {checklistProgress}% complete
                  </span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${checklistProgress}%`,
                    }}
                  />
                </div>

                <div className="checklist-list">
                  {checklist.map((item) => (
                    <label
                      className={`checklist-item ${
                        item.is_completed
                          ? "completed"
                          : ""
                      }`}
                      key={item.id}
                    >
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={() =>
                          void toggleChecklist(item)
                        }
                        disabled={
                          updatingChecklistId ===
                          item.id
                        }
                      />

                      <div>
                        <div className="checklist-title">
                          <strong>
                            {item.item_label}
                          </strong>

                          {item.is_required && (
                            <span>Required</span>
                          )}
                        </div>

                        {item.item_description && (
                          <p>
                            {item.item_description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="claim-actions">
                {activeClaim.claim_status ===
                  "draft" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void updateClaimStatus(
                        "ready_to_submit",
                        "document_collection"
                      )
                    }
                  >
                    Mark Ready to Submit
                  </button>
                )}

                {activeClaim.claim_status ===
                  "ready_to_submit" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void updateClaimStatus(
                        "submitted",
                        "claim_submission"
                      )
                    }
                  >
                    Mark as Submitted
                  </button>
                )}

                {activeClaim.claim_status ===
                  "submitted" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void updateClaimStatus(
                        "under_review",
                        "insurer_review"
                      )
                    }
                  >
                    Mark Under Review
                  </button>
                )}
              </div>

              <div className="timeline-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      CLAIM TIMELINE
                    </p>
                    <h3>Progress History</h3>
                  </div>

                  <span className="count-badge">
                    {timeline.length} event
                    {timeline.length === 1 ? "" : "s"}
                  </span>
                </div>

                {timeline.length === 0 ? (
                  <div className="empty-state">
                    No timeline events yet.
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

      <div className="advisory-note">
        <span>ℹ</span>
        <p>
          Mira provides preliminary guidance only. Final claim
          admissibility, repair approval, FIR requirements and
          settlement decisions remain with the insurer and applicable
          authorities.
        </p>
      </div>

      <style jsx>{`
        .assistant {
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
        .section-heading,
        .timeline-title,
        .claim-selector {
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

        .description {
          margin: 8px 0 0;
          color: #94a3b8;
          line-height: 1.55;
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

        .policy-summary,
        .status-grid,
        .claim-details,
        .form-grid {
          display: grid;
          gap: 14px;
        }

        .policy-summary,
        .status-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .claim-details {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 18px;
        }

        .new-claim-form,
        .photo-analysis-section,
        .assessment-section,
        .checklist-section,
        .timeline-section {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .section-heading {
          align-items: flex-end;
          margin-bottom: 15px;
        }

        .form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 18px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 800;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          color: #f8fafc;
          padding: 13px 14px;
          font: inherit;
          outline: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #60a5fa;
        }

        .primary-button,
        .secondary-button {
          min-height: 44px;
          padding: 11px 17px;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(
            135deg,
            #2563eb,
            #3b82f6
          );
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

        .claim-selector {
          align-items: center;
          margin-top: 20px;
          padding: 16px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.32);
        }

        .claim-selector label {
          width: 100%;
        }

        .count-badge {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.15);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 900;
        }

        .drop-zone {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          min-height: 110px;
          padding: 18px;
          border: 2px dashed rgba(96, 165, 250, 0.28);
          border-radius: 16px;
          background: rgba(2, 6, 23, 0.28);
        }

        .drop-zone.dragging {
          border-color: #60a5fa;
          background: rgba(37, 99, 235, 0.12);
        }

        .drop-zone p {
          margin: 7px 0 0;
          color: #94a3b8;
        }

        .photo-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 15px;
        }

        .photo-card {
          position: relative;
          overflow: hidden;
          min-height: 130px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.6);
        }

        .photo-card img {
          width: 100%;
          height: 160px;
          object-fit: cover;
        }

        .photo-card button {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 50%;
          background: rgba(2, 6, 23, 0.82);
          color: white;
          font-size: 20px;
          cursor: pointer;
        }

        .analyse-button {
          margin-top: 16px;
        }

        .assessment-summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 14px;
        }

        .assessment-summary > div,
        .guidance-box,
        .list-panel {
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(15, 23, 42, 0.52);
        }

        .assessment-summary span {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .assessment-summary p,
        .guidance-box p {
          margin: 7px 0 0;
          color: #cbd5e1;
          line-height: 1.55;
        }

        .assessment-summary strong {
          display: block;
          margin-top: 8px;
          color: #dbeafe;
          font-size: 20px;
        }

        .guidance-box {
          margin-top: 14px;
          background: rgba(30, 64, 175, 0.1);
        }

        .checklist-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .checklist-item {
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr);
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.52);
        }

        .checklist-item.completed {
          opacity: 0.72;
        }

        .checklist-item input {
          width: auto;
          margin-top: 3px;
          accent-color: #3b82f6;
        }

        .checklist-title {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          align-items: center;
        }

        .checklist-title span {
          padding: 4px 7px;
          border-radius: 999px;
          background: rgba(127, 29, 29, 0.18);
          color: #fecaca;
          font-size: 10px;
          font-weight: 900;
        }

        .checklist-item p {
          margin: 6px 0 0;
          color: #94a3b8;
          font-weight: 400;
        }

        .progress-track {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #2563eb,
            #60a5fa
          );
        }

        .claim-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
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

        .timeline-item p {
          margin: 6px 0 0;
          color: #94a3b8;
        }

        .timeline-item small {
          display: block;
          margin-top: 8px;
          color: #64748b;
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
          .policy-summary,
          .status-grid,
          .claim-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .photo-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .assistant {
            padding: 18px;
          }

          .header,
          .header-actions,
          .section-heading,
          .drop-zone {
            flex-direction: column;
            align-items: stretch;
          }

          .policy-summary,
          .status-grid,
          .claim-details,
          .form-grid,
          .assessment-summary,
          .photo-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .primary-button,
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
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: "#e2e8f0",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      {subvalue && (
        <small style={{ color: "#94a3b8" }}>
          {subvalue}
        </small>
      )}
    </div>
  );
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

function ListPanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "danger" | "warning" | "info";
}) {
  const colors = {
    danger: {
      background: "rgba(127, 29, 29, 0.16)",
      color: "#fecaca",
    },
    warning: {
      background: "rgba(133, 77, 14, 0.16)",
      color: "#fde68a",
    },
    info: {
      background: "rgba(30, 64, 175, 0.1)",
      color: "#bfdbfe",
    },
  }[tone];

  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 15,
        background: colors.background,
      }}
    >
      <strong style={{ color: colors.color }}>
        {title}
      </strong>

      <ol
        style={{
          margin: "10px 0 0",
          paddingLeft: 20,
          color: "#cbd5e1",
          lineHeight: 1.6,
        }}
      >
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            {item}
          </li>
        ))}
      </ol>
    </div>
  );
}

function getStatusTone(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (
    [
      "approved",
      "settled",
      "closed",
      "completed",
    ].includes(status)
  ) {
    return "success";
  }

  if (
    [
      "rejected",
      "cancelled",
    ].includes(status)
  ) {
    return "danger";
  }

  if (
    [
      "documents_required",
      "partially_approved",
      "settlement_pending",
      "under_review",
      "submitted",
    ].includes(status)
  ) {
    return "warning";
  }

  return "neutral";
}

function getAssessmentTone(
  status: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (status === "likely_claimable") {
    return "success";
  }

  if (
    status === "possibly_claimable" ||
    status === "manual_review_required"
  ) {
    return "warning";
  }

  if (status === "unlikely_claimable") {
    return "danger";
  }

  return "neutral";
}

function getRiskTone(
  risk: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (risk === "low") return "success";
  if (risk === "medium") return "warning";
  if (risk === "high") return "danger";
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

function formatRange(
  minimum: number | null,
  maximum: number | null
) {
  if (minimum === null && maximum === null) {
    return "Not estimated";
  }

  if (
    minimum !== null &&
    maximum !== null
  ) {
    return `${formatCurrency(minimum)} – ${formatCurrency(
      maximum
    )}`;
  }

  return formatCurrency(minimum ?? maximum);
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