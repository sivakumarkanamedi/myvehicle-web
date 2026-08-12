"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../../supabase";
import type { CashlessGarage } from "./GarageFinder";

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

type ClaimSummary = {
  id: number;
  claim_reference?: string | null;
  incident_type?: string | null;
  incident_description?: string | null;
  ai_missing_documents?: string[] | null;
};

type BookingRow = {
  id: number;
  booking_reference: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  pickup_required: boolean;
  towing_required: boolean;
  booking_status: string;
  garage_confirmation_note: string | null;
  created_at: string;
};

type Props = {
  policy: PolicySummary;
  garage: CashlessGarage;
  claim?: ClaimSummary | null;
  onClose?: () => void;
  onBooked?: (booking: BookingRow) => void | Promise<void>;
};

type BookingForm = {
  scheduled_date: string;
  scheduled_time: string;
  pickup_required: boolean;
  towing_required: boolean;
  contact_name: string;
  contact_phone: string;
  issue_summary: string;
};

const initialForm: BookingForm = {
  scheduled_date: "",
  scheduled_time: "",
  pickup_required: false,
  towing_required: false,
  contact_name: "",
  contact_phone: "",
  issue_summary: "",
};

const MAX_FILES = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function BookGarageInspection({
  policy,
  garage,
  claim,
  onClose,
  onBooked,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<BookingForm>({
    ...initialForm,
    issue_summary: claim?.incident_description?.trim() || "",
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const missingDocuments = useMemo(
    () => claim?.ai_missing_documents ?? [],
    [claim]
  );

  useEffect(() => {
    void loadBookings();
  }, [garage.id, policy.id, claim?.id]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  async function loadBookings() {
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
      .from("garage_inspection_bookings")
      .select(
        "id, booking_reference, scheduled_date, scheduled_time, pickup_required, towing_required, booking_status, garage_confirmation_note, created_at"
      )
      .eq("user_id", user.id)
      .eq("garage_id", garage.id)
      .eq("policy_id", policy.id)
      .order("created_at", { ascending: false });

    if (claim?.id) {
      query = query.eq("claim_id", claim.id);
    }

    const { data, error } = await query;

    if (error) {
      setErrorMessage(error.message);
    } else {
      setBookings((data ?? []) as BookingRow[]);
    }

    setLoading(false);
  }

  function handlePhotoInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    addPhotos(files);
  }

  function addPhotos(files: File[]) {
    setErrorMessage("");

    const remaining = MAX_FILES - photos.length;

    if (remaining <= 0) {
      setErrorMessage(`You can upload a maximum of ${MAX_FILES} photos.`);
      return;
    }

    const accepted: File[] = [];

    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErrorMessage("Only JPG, PNG and WEBP files are supported.");
        continue;
      }

      if (file.size === 0) {
        setErrorMessage(`"${file.name}" is empty.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(`"${file.name}" must be 10 MB or less.`);
        continue;
      }

      accepted.push(file);
    }

    if (!accepted.length) return;

    setPhotos((current) => [...current, ...accepted]);
    setPhotoPreviews((current) => [
      ...current,
      ...accepted.map((file) => URL.createObjectURL(file)),
    ]);
  }

  function removePhoto(index: number) {
    setPhotoPreviews((current) => {
      const url = current[index];
      if (url) URL.revokeObjectURL(url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });

    setPhotos((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function clearPhotos() {
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviews([]);
    setPhotos([]);
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateBookingForm(form, garage);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    const uploadedPaths: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please sign in again.");

      for (const photo of photos) {
        const extension =
          photo.name.split(".").pop()?.toLowerCase() ||
          extensionFromMime(photo.type);

        const path =
          `${user.id}/garage-bookings/${garage.id}/` +
          `${crypto.randomUUID()}.${extension}`;

        const { error } = await supabase.storage
          .from("insurance-documents")
          .upload(path, photo, {
            contentType: photo.type,
            upsert: false,
          });

        if (error) throw new Error(error.message);

        uploadedPaths.push(path);
      }

      const { data, error } = await supabase
        .from("garage_inspection_bookings")
        .insert({
          user_id: user.id,
          garage_id: garage.id,
          claim_id: claim?.id ?? null,
          policy_id: policy.id,
          vehicle_id: policy.vehicle_id,
          booking_type: "claim_inspection",
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time || null,
          pickup_required: form.pickup_required,
          towing_required: form.towing_required,
          contact_name: form.contact_name.trim(),
          contact_phone: form.contact_phone.trim(),
          issue_summary: form.issue_summary.trim(),
          shared_photo_paths: uploadedPaths,
          booking_status: "requested",
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Unable to create booking.");
      }

      const booking = data as BookingRow;

      if (claim?.id) {
        await supabase.from("insurance_claim_timeline").insert({
          user_id: user.id,
          claim_id: claim.id,
          event_type: "garage_inspection_requested",
          event_status: "requested",
          title: "Garage inspection requested",
          description: `Inspection requested at ${garage.name}.`,
          metadata: {
            garage_id: garage.id,
            garage_name: garage.name,
            booking_id: booking.id,
            booking_reference: booking.booking_reference,
            scheduled_date: booking.scheduled_date,
            scheduled_time: booking.scheduled_time,
          },
        });
      }

      setMessage("Garage inspection request created successfully.");
      setForm({
        ...initialForm,
        issue_summary: claim?.incident_description?.trim() || "",
      });
      clearPhotos();
      await loadBookings();

      if (onBooked) {
        await onBooked(booking);
      }
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage
          .from("insurance-documents")
          .remove(uploadedPaths);
      }

      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create booking."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(booking: BookingRow) {
    if (!window.confirm("Cancel this garage inspection booking?")) return;

    const { error } = await supabase
      .from("garage_inspection_bookings")
      .update({
        booking_status: "cancelled",
        cancellation_reason: "Cancelled by user",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage("Booking cancelled.");
    await loadBookings();
  }

  return (
    <section className="panel">
      <div className="header">
        <div>
          <p className="eyebrow">GARAGE INSPECTION BOOKING</p>
          <h2>Book Inspection</h2>
          <p className="subtext">
            Reserve an inspection slot and share claim details with the
            selected cashless garage.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="Close garage booking"
          >
            ×
          </button>
        )}
      </div>

      <div className="summary-grid">
        <Summary label="Garage" value={garage.name} subvalue={`${garage.city}, ${garage.state}`} />
        <Summary
          label="Vehicle"
          value={policy.vehicles?.vehicle_number || "Not linked"}
          subvalue={[policy.vehicles?.brand, policy.vehicles?.model]
            .filter(Boolean)
            .join(" ")}
        />
        <Summary label="Policy" value={policy.policy_number} subvalue={policy.insurance_company} />
        <Summary
          label="Claim"
          value={claim?.id ? claim.claim_reference || `#${claim.id}` : "Not linked"}
          subvalue={claim?.incident_type ? formatStatus(claim.incident_type) : undefined}
        />
      </div>

      {missingDocuments.length > 0 && (
        <div className="warning">
          <strong>Mira found missing claim documents</strong>
          <ul>
            {missingDocuments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            The garage or insurer may request these documents before
            cashless approval.
          </p>
        </div>
      )}

      <form className="form" onSubmit={submitBooking}>
        <div className="form-grid">
          <label>
            Inspection Date
            <input
              type="date"
              min={todayDate()}
              value={form.scheduled_date}
              onChange={(event) =>
                setForm({ ...form, scheduled_date: event.target.value })
              }
              required
            />
          </label>

          <label>
            Preferred Time
            <input
              type="time"
              value={form.scheduled_time}
              onChange={(event) =>
                setForm({ ...form, scheduled_time: event.target.value })
              }
            />
          </label>

          <label>
            Contact Name
            <input
              value={form.contact_name}
              onChange={(event) =>
                setForm({ ...form, contact_name: event.target.value })
              }
              placeholder="Your full name"
              required
            />
          </label>

          <label>
            Contact Number
            <input
              value={form.contact_phone}
              onChange={(event) =>
                setForm({ ...form, contact_phone: event.target.value })
              }
              placeholder="+91 98765 43210"
              inputMode="tel"
              required
            />
          </label>

          <label className="full">
            Issue Summary
            <textarea
              rows={4}
              value={form.issue_summary}
              onChange={(event) =>
                setForm({ ...form, issue_summary: event.target.value })
              }
              placeholder="Describe the damage or inspection requirement."
              required
            />
          </label>
        </div>

        <div className="options">
          <Toggle
            label="Pickup & Drop"
            description={
              garage.pickup_drop_available
                ? "Ask the garage to collect and return the vehicle."
                : "This garage has not confirmed pickup and drop."
            }
            checked={form.pickup_required}
            disabled={!garage.pickup_drop_available}
            onChange={(checked) =>
              setForm({ ...form, pickup_required: checked })
            }
          />

          <Toggle
            label="Towing Required"
            description={
              garage.towing_available
                ? "Request towing if the vehicle cannot be driven safely."
                : "This garage has not confirmed towing support."
            }
            checked={form.towing_required}
            disabled={!garage.towing_available}
            onChange={(checked) =>
              setForm({ ...form, towing_required: checked })
            }
          />
        </div>

        <div className="photo-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">SHARE DAMAGE PHOTOS</p>
              <h3>Photos for Garage Review</h3>
            </div>
            <span className="count">{photos.length}/{MAX_FILES}</span>
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
            className={`drop-zone ${isDragging ? "dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              addPhotos(Array.from(event.dataTransfer.files ?? []));
            }}
          >
            <div>
              <strong>Upload clear accident or damage photos</strong>
              <p>JPG, PNG or WEBP · Up to 6 photos · 10 MB each</p>
            </div>

            <button
              type="button"
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Photos
            </button>
          </div>

          {photoPreviews.length > 0 && (
            <div className="photo-grid">
              {photoPreviews.map((preview, index) => (
                <div className="photo-card" key={`${preview}-${index}`}>
                  <img src={preview} alt={`Damage photo ${index + 1}`} />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="actions">
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Requesting Inspection..." : "Request Garage Inspection"}
          </button>

          {garage.phone && (
            <a href={`tel:${garage.phone}`} className="secondary">
              Call Garage
            </a>
          )}
        </div>
      </form>

      {message && <div className="success">{message}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <div className="history">
        <div className="section-head">
          <div>
            <p className="eyebrow">BOOKING HISTORY</p>
            <h3>Inspection Requests</h3>
          </div>
          <span className="count">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="empty">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="empty">No inspection booking yet.</div>
        ) : (
          <div className="booking-list">
            {bookings.map((booking) => (
              <article className="booking-card" key={booking.id}>
                <div>
                  <strong>
                    {booking.booking_reference || `Booking #${booking.id}`}
                  </strong>
                  <p>
                    {formatDate(booking.scheduled_date)}
                    {booking.scheduled_time
                      ? ` at ${booking.scheduled_time.slice(0, 5)}`
                      : ""}
                  </p>
                  <p>
                    {booking.pickup_required ? "Pickup requested" : "No pickup"}
                    {" · "}
                    {booking.towing_required ? "Towing requested" : "No towing"}
                  </p>
                  {booking.garage_confirmation_note && (
                    <p>{booking.garage_confirmation_note}</p>
                  )}
                </div>

                <div className="booking-actions">
                  <span className={`status ${statusTone(booking.booking_status)}`}>
                    {formatStatus(booking.booking_status)}
                  </span>

                  {canCancel(booking.booking_status) && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void cancelBooking(booking)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="note">
        <span>ℹ</span>
        <p>
          The booking remains a request until the garage confirms it.
          Cashless approval depends on the insurer, policy coverage and
          surveyor process.
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
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 30%),
            #07152a;
          color: #f8fafc;
        }

        .header,
        .section-head,
        .actions,
        .booking-card,
        .booking-actions {
          display: flex;
          justify-content: space-between;
          gap: 16px;
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

        h2, h3 { margin: 0; }

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

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .warning,
        .form,
        .history {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .warning {
          background: rgba(133, 77, 14, 0.14);
          color: #fde68a;
        }

        .warning p { margin-bottom: 0; }

        .form-grid,
        .options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .options { margin-top: 16px; }

        label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 800;
        }

        .full { grid-column: 1 / -1; }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.56);
          color: #f8fafc;
          padding: 13px 14px;
          font: inherit;
        }

        .photo-section {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .section-head {
          align-items: flex-end;
          margin-bottom: 15px;
        }

        .count {
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 15px;
        }

        .photo-card {
          position: relative;
          overflow: hidden;
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

        .actions {
          justify-content: flex-start;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .primary,
        .secondary,
        .danger {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 17px;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .primary {
          border: 0;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
        }

        .secondary {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.82);
          color: #dbeafe;
        }

        .danger {
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .success,
        .error {
          margin-top: 15px;
          padding: 13px 15px;
          border-radius: 12px;
        }

        .success {
          background: rgba(20, 83, 45, 0.18);
          color: #a7f3d0;
        }

        .error {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .booking-list {
          display: grid;
          gap: 12px;
        }

        .booking-card {
          align-items: center;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(15, 23, 42, 0.48);
        }

        .booking-card p {
          margin: 6px 0 0;
          color: #94a3b8;
        }

        .booking-actions {
          align-items: center;
        }

        .status {
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .status-success {
          background: rgba(20, 83, 45, 0.2);
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

        .empty {
          padding: 30px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        .note {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding: 13px 15px;
          border-radius: 13px;
          background: rgba(30, 64, 175, 0.08);
          color: #bfdbfe;
        }

        .note p {
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .panel { padding: 18px; }

          .header,
          .section-head,
          .drop-zone,
          .booking-card,
          .booking-actions,
          .actions {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-grid,
          .form-grid,
          .options,
          .photo-grid {
            grid-template-columns: 1fr;
          }

          .full { grid-column: auto; }

          .primary,
          .secondary,
          .danger {
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
      {subvalue && <small style={{ color: "#94a3b8" }}>{subvalue}</small>}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "22px minmax(0, 1fr)",
        gap: 12,
        padding: 14,
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderRadius: 14,
        background: "rgba(15, 23, 42, 0.52)",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: "auto", accentColor: "#3b82f6", marginTop: 3 }}
      />
      <div>
        <strong style={{ color: "#e2e8f0" }}>{label}</strong>
        <p
          style={{
            margin: "6px 0 0",
            color: "#94a3b8",
            fontWeight: 400,
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      </div>
    </label>
  );
}

function validateBookingForm(
  form: BookingForm,
  garage: CashlessGarage
) {
  if (!form.scheduled_date) return "Inspection date is required.";

  const selected = new Date(`${form.scheduled_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selected.getTime() < today.getTime()) {
    return "Inspection date cannot be in the past.";
  }

  if (!form.contact_name.trim()) return "Contact name is required.";

  const phoneDigits = form.contact_phone.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return "Enter a valid contact number.";
  }

  if (!form.issue_summary.trim()) return "Issue summary is required.";

  if (form.pickup_required && !garage.pickup_drop_available) {
    return "Pickup and drop is unavailable for this garage.";
  }

  if (form.towing_required && !garage.towing_available) {
    return "Towing is unavailable for this garage.";
  }

  return "";
}

function extensionFromMime(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return map[mimeType] || "bin";
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function canCancel(status: string) {
  return [
    "requested",
    "confirmed",
    "rescheduled",
    "vehicle_pickup_scheduled",
  ].includes(status);
}

function statusTone(status: string) {
  if (["confirmed", "inspection_completed", "completed"].includes(status)) {
    return "status-success";
  }

  if (
    ["requested", "rescheduled", "vehicle_pickup_scheduled", "vehicle_received"].includes(status)
  ) {
    return "status-warning";
  }

  if (status === "cancelled") return "status-danger";

  return "status-neutral";
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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