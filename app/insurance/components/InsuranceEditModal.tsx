"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../supabase";

type Vehicle = {
  id?: number;
  vehicle_number?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type EditableInsurancePolicy = {
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
  vehicles?: Vehicle | null;
};

type FormState = {
  vehicle_id: string;
  insurance_company: string;
  policy_number: string;
  policy_type: string;
  premium_amount: string;
  idv: string;
  start_date: string;
  expiry_date: string;
  claim_contact: string;
  customer_care: string;
  notes: string;
};

type Props = {
  policy: EditableInsurancePolicy | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const emptyForm: FormState = {
  vehicle_id: "",
  insurance_company: "",
  policy_number: "",
  policy_type: "Comprehensive",
  premium_amount: "",
  idv: "",
  start_date: "",
  expiry_date: "",
  claim_contact: "",
  customer_care: "",
  notes: "",
};

export default function InsuranceEditModal({
  policy,
  vehicles,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!policy) {
      setForm(emptyForm);
      setMessage("");
      return;
    }

    setForm({
      vehicle_id: String(policy.vehicle_id),
      insurance_company: policy.insurance_company,
      policy_number: policy.policy_number,
      policy_type: policy.policy_type,
      premium_amount:
        policy.premium_amount === null
          ? ""
          : String(policy.premium_amount),
      idv: policy.idv === null ? "" : String(policy.idv),
      start_date: policy.start_date,
      expiry_date: policy.expiry_date,
      claim_contact: policy.claim_contact ?? "",
      customer_care: policy.customer_care ?? "",
      notes: policy.notes ?? "",
    });

    setMessage("");
  }, [policy]);

  useEffect(() => {
    if (!policy) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [policy, saving, onClose]);

  if (!policy) {
    return null;
  }

  async function saveChanges(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    if (!form.vehicle_id) {
      setMessage("Please select a vehicle.");
      setSaving(false);
      return;
    }

    if (!form.insurance_company.trim()) {
      setMessage("Insurance company is required.");
      setSaving(false);
      return;
    }

    if (!form.policy_number.trim()) {
      setMessage("Policy number is required.");
      setSaving(false);
      return;
    }

    if (!form.start_date || !form.expiry_date) {
      setMessage("Start date and expiry date are required.");
      setSaving(false);
      return;
    }

    const startDate = new Date(
      `${form.start_date}T00:00:00`
    ).getTime();

    const expiryDate = new Date(
      `${form.expiry_date}T00:00:00`
    ).getTime();

    if (expiryDate < startDate) {
      setMessage(
        "Expiry date cannot be earlier than start date."
      );
      setSaving(false);
      return;
    }

    const premiumAmount = form.premium_amount
      ? Number(form.premium_amount)
      : 0;

    const idvAmount = form.idv ? Number(form.idv) : 0;

    if (
      Number.isNaN(premiumAmount) ||
      premiumAmount < 0
    ) {
      setMessage(
        "Please enter a valid premium amount."
      );
      setSaving(false);
      return;
    }

    if (Number.isNaN(idvAmount) || idvAmount < 0) {
      setMessage("Please enter a valid IDV amount.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("insurance_policies")
      .update({
        vehicle_id: Number(form.vehicle_id),
        insurance_company:
          form.insurance_company.trim(),
        policy_number: form.policy_number.trim(),
        policy_type: form.policy_type,
        premium_amount: premiumAmount,
        idv: idvAmount,
        start_date: form.start_date,
        expiry_date: form.expiry_date,
        claim_contact:
          form.claim_contact.trim() || null,
        customer_care:
          form.customer_care.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", policy!.id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await onSaved();

    setSaving(false);
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-insurance-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">MY VEHICLE</p>

            <h2 id="edit-insurance-title">
              Edit Insurance Policy
            </h2>

            <p>
              Update the selected insurance policy
              details.
            </p>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit insurance dialog"
          >
            ×
          </button>
        </div>

        {message && (
          <div className="message">{message}</div>
        )}

        <form onSubmit={saveChanges}>
          <div className="form-grid">
            <label>
              Vehicle

              <select
                value={form.vehicle_id}
                onChange={(event) =>
                  setForm({
                    ...form,
                    vehicle_id: event.target.value,
                  })
                }
                required
              >
                <option value="">
                  Select vehicle
                </option>

                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.vehicle_number ||
                      "No number"}

                    {vehicle.brand
                      ? ` - ${vehicle.brand}`
                      : ""}

                    {vehicle.model
                      ? ` ${vehicle.model}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Insurance Company

              <input
                type="text"
                value={form.insurance_company}
                onChange={(event) =>
                  setForm({
                    ...form,
                    insurance_company:
                      event.target.value,
                  })
                }
                placeholder="Example: ICICI Lombard"
                required
              />
            </label>

            <label>
              Policy Number

              <input
                type="text"
                value={form.policy_number}
                onChange={(event) =>
                  setForm({
                    ...form,
                    policy_number:
                      event.target.value,
                  })
                }
                placeholder="Enter policy number"
                required
              />
            </label>

            <label>
              Policy Type

              <select
                value={form.policy_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    policy_type:
                      event.target.value,
                  })
                }
              >
                <option value="Comprehensive">
                  Comprehensive
                </option>

                <option value="Third Party">
                  Third Party
                </option>

                <option value="Own Damage">
                  Own Damage
                </option>

                <option value="Zero Depreciation">
                  Zero Depreciation
                </option>
              </select>
            </label>

            <label>
              Premium Amount

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.premium_amount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    premium_amount:
                      event.target.value,
                  })
                }
                placeholder="Enter premium amount"
              />
            </label>

            <label>
              IDV

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.idv}
                onChange={(event) =>
                  setForm({
                    ...form,
                    idv: event.target.value,
                  })
                }
                placeholder="Enter insured value"
              />
            </label>

            <label>
              Start Date

              <input
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    start_date:
                      event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Expiry Date

              <input
                type="date"
                value={form.expiry_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expiry_date:
                      event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Claim Contact

              <input
                type="tel"
                value={form.claim_contact}
                onChange={(event) =>
                  setForm({
                    ...form,
                    claim_contact:
                      event.target.value,
                  })
                }
                placeholder="Claim contact number"
              />
            </label>

            <label>
              Customer Care

              <input
                type="tel"
                value={form.customer_care}
                onChange={(event) =>
                  setForm({
                    ...form,
                    customer_care:
                      event.target.value,
                  })
                }
                placeholder="Customer care number"
              />
            </label>

            <label className="full-width">
              Notes

              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    notes: event.target.value,
                  })
                }
                placeholder="Add policy notes"
              />
            </label>
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving Changes..."
                : "Save Changes"}
            </button>
          </div>
        </form>

        <style jsx>{`
          .modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: grid;
            place-items: center;
            padding: 24px;
            background: rgba(2, 6, 23, 0.78);
            backdrop-filter: blur(10px);
          }

          .modal-card {
            width: min(900px, 100%);
            max-height: calc(100vh - 48px);
            overflow-y: auto;
            border: 1px solid
              rgba(148, 163, 184, 0.2);
            border-radius: 24px;
            background:
              radial-gradient(
                circle at top right,
                rgba(37, 99, 235, 0.18),
                transparent 30%
              ),
              #07152a;
            color: #f8fafc;
            box-shadow: 0 30px 90px
              rgba(0, 0, 0, 0.52);
            padding: 26px;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 22px;
          }

          .eyebrow {
            margin: 0 0 8px;
            color: #60a5fa;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.16em;
          }

          h2 {
            margin: 0;
            font-size: 28px;
          }

          .modal-header p:last-child {
            margin: 8px 0 0;
            color: #94a3b8;
          }

          .close-button {
            width: 42px;
            height: 42px;
            flex: 0 0 42px;
            border-radius: 12px;
            border: 1px solid
              rgba(148, 163, 184, 0.2);
            background: rgba(15, 23, 42, 0.78);
            color: #e2e8f0;
            font-size: 28px;
            line-height: 1;
            cursor: pointer;
          }

          .close-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .message {
            margin-bottom: 18px;
            padding: 13px 15px;
            border-radius: 12px;
            border: 1px solid
              rgba(248, 113, 113, 0.28);
            background: rgba(127, 29, 29, 0.2);
            color: #fecaca;
          }

          .form-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 16px;
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
            border: 1px solid
              rgba(148, 163, 184, 0.2);
            border-radius: 12px;
            background: rgba(2, 6, 23, 0.5);
            color: #f8fafc;
            padding: 13px 14px;
            font: inherit;
            outline: none;
          }

          input:focus,
          select:focus,
          textarea:focus {
            border-color: #60a5fa;
            box-shadow: 0 0 0 3px
              rgba(59, 130, 246, 0.12);
          }

          textarea {
            resize: vertical;
          }

          .footer-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid
              rgba(148, 163, 184, 0.14);
          }

          .primary-button,
          .secondary-button {
            min-height: 44px;
            padding: 11px 18px;
            border-radius: 12px;
            font: inherit;
            font-weight: 900;
            cursor: pointer;
          }

          .primary-button {
            border: 0;
            color: white;
            background: linear-gradient(
              135deg,
              #2563eb,
              #3b82f6
            );
          }

          .secondary-button {
            border: 1px solid
              rgba(148, 163, 184, 0.2);
            color: #dbeafe;
            background: rgba(15, 23, 42, 0.76);
          }

          .primary-button:disabled,
          .secondary-button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          @media (max-width: 700px) {
            .modal-backdrop {
              padding: 12px;
            }

            .modal-card {
              max-height: calc(100vh - 24px);
              padding: 20px;
              border-radius: 18px;
            }

            .form-grid {
              grid-template-columns: 1fr;
            }

            .full-width {
              grid-column: auto;
            }

            .footer-actions {
              display: grid;
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 420px) {
            .footer-actions {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </section>
    </div>
  );
}