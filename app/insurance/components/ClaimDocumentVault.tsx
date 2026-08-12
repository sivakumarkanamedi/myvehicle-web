"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type ClaimDocument = {
  id: number;
  user_id: string;
  policy_id: number;
  claim_reference: string | null;
  document_type: string;
  document_name: string;
  document_path: string;
  mime_type: string | null;
  file_size: number | null;
  document_hash: string | null;
  notes: string | null;
  claim_date: string | null;
  uploaded_at: string;
  updated_at: string;
};

type Props = {
  policyId: number;
  policyNumber: string;
  onClose?: () => void;
};

type FormState = {
  claim_reference: string;
  document_type: string;
  notes: string;
  claim_date: string;
};

const initialForm: FormState = {
  claim_reference: "",
  document_type: "claim_form",
  notes: "",
  claim_date: "",
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 12 * 1024 * 1024;

export default function ClaimDocumentVault({
  policyId,
  policyNumber,
  onClose,
}: Props) {
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadDocuments();
  }, [policyId]);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return documents.filter((claimDocument) => {
      const matchesType =
        typeFilter === "all" ||
        claimDocument.document_type === typeFilter;

      const matchesSearch =
        !term ||
        claimDocument.document_name.toLowerCase().includes(term) ||
        claimDocument.document_type.toLowerCase().includes(term) ||
        claimDocument.claim_reference?.toLowerCase().includes(term) ||
        claimDocument.notes?.toLowerCase().includes(term);

      return matchesType && Boolean(matchesSearch);
    });
  }, [documents, search, typeFilter]);

  async function loadDocuments() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("insurance_claim_documents")
      .select("*")
      .eq("policy_id", policyId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setDocuments((data ?? []) as ClaimDocument[]);
    setLoading(false);
  }

  async function uploadDocument(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Please select a claim document.");
      return;
    }

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setUploading(true);
    setMessage("");
    setErrorMessage("");

    let uploadedPath = "";

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const fileHash = await createFileHash(selectedFile);

      const { data: duplicate, error: duplicateError } =
        await supabase
          .from("insurance_claim_documents")
          .select("id, document_name")
          .eq("user_id", user.id)
          .eq("document_hash", fileHash)
          .limit(1)
          .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicate) {
        throw new Error(
          `This file already exists as "${duplicate.document_name}".`
        );
      }

      const extension =
        selectedFile.name.split(".").pop()?.toLowerCase() ||
        extensionFromMime(selectedFile.type);

      uploadedPath =
        `${user.id}/claims/${policyId}/` +
        `${crypto.randomUUID()}.${extension}`;

      const { error: storageError } = await supabase.storage
        .from("insurance-documents")
        .upload(uploadedPath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (storageError) {
        throw new Error(storageError.message);
      }

      const { error: insertError } = await supabase
        .from("insurance_claim_documents")
        .insert({
          user_id: user.id,
          policy_id: policyId,
          claim_reference: form.claim_reference.trim() || null,
          document_type: form.document_type,
          document_name: selectedFile.name,
          document_path: uploadedPath,
          mime_type: selectedFile.type,
          file_size: selectedFile.size,
          document_hash: fileHash,
          notes: form.notes.trim() || null,
          claim_date: form.claim_date || null,
        });

      if (insertError) {
        await supabase.storage
          .from("insurance-documents")
          .remove([uploadedPath]);

        throw new Error(insertError.message);
      }

      setForm(initialForm);
      setSelectedFile(null);
      setMessage("Claim document uploaded successfully.");
      await loadDocuments();
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from("insurance-documents")
          .remove([uploadedPath]);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload the claim document."
      );
    } finally {
      setUploading(false);
    }
  }

  async function viewDocument(claimDocument: ClaimDocument) {
    setErrorMessage("");

    const { data, error } = await supabase.storage
      .from("insurance-documents")
      .createSignedUrl(claimDocument.document_path, 60 * 10);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadDocument(
    claimDocument: ClaimDocument
  ) {
    setErrorMessage("");

    const { data, error } = await supabase.storage
      .from("insurance-documents")
      .download(claimDocument.document_path);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const objectUrl = URL.createObjectURL(data);
    const anchor = window.document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = claimDocument.document_name;

    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }

  async function deleteDocument(
    claimDocument: ClaimDocument
  ) {
    const confirmed = window.confirm(
      `Delete "${claimDocument.document_name}"?`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    const { error: storageError } = await supabase.storage
      .from("insurance-documents")
      .remove([claimDocument.document_path]);

    if (storageError) {
      setErrorMessage(storageError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("insurance_claim_documents")
      .delete()
      .eq("id", claimDocument.id);

    if (deleteError) {
      setErrorMessage(deleteError.message);
      return;
    }

    setMessage("Claim document deleted.");
    await loadDocuments();
  }

  return (
    <section className="vault">
      <div className="header">
        <div>
          <p className="eyebrow">INSURANCE CLAIM VAULT</p>
          <h2>Claim Documents</h2>
          <p>
            Store FIRs, photos, bills, estimates, surveyor reports and
            settlement documents under policy #{policyNumber}.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close claim document vault"
          >
            ×
          </button>
        )}
      </div>

      <form className="upload-panel" onSubmit={uploadDocument}>
        <div className="form-grid">
          <label>
            Document Type
            <select
              value={form.document_type}
              onChange={(event) =>
                setForm({
                  ...form,
                  document_type: event.target.value,
                })
              }
            >
              <option value="claim_form">Claim Form</option>
              <option value="fir">FIR</option>
              <option value="repair_estimate">
                Repair Estimate
              </option>
              <option value="repair_invoice">
                Repair Invoice
              </option>
              <option value="hospital_bill">
                Hospital Bill
              </option>
              <option value="vehicle_photo">
                Vehicle Photo
              </option>
              <option value="accident_photo">
                Accident Photo
              </option>
              <option value="surveyor_report">
                Surveyor Report
              </option>
              <option value="garage_document">
                Garage Document
              </option>
              <option value="payment_receipt">
                Payment Receipt
              </option>
              <option value="settlement_letter">
                Settlement Letter
              </option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Claim Reference
            <input
              value={form.claim_reference}
              onChange={(event) =>
                setForm({
                  ...form,
                  claim_reference: event.target.value,
                })
              }
              placeholder="Claim number or reference"
            />
          </label>

          <label>
            Claim Date
            <input
              type="date"
              value={form.claim_date}
              onChange={(event) =>
                setForm({
                  ...form,
                  claim_date: event.target.value,
                })
              }
            />
          </label>

          <label>
            Select File
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              required
            />
          </label>

          <label className="full-width">
            Notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm({
                  ...form,
                  notes: event.target.value,
                })
              }
              placeholder="Optional details about this claim document"
            />
          </label>
        </div>

        <button
          type="submit"
          className="primary-button"
          disabled={uploading}
        >
          {uploading
            ? "Uploading..."
            : "Upload Claim Document"}
        </button>
      </form>

      {message && (
        <div className="success-message">{message}</div>
      )}

      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      <div className="filters">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search claim documents..."
        />

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="all">All Document Types</option>
          <option value="claim_form">Claim Form</option>
          <option value="fir">FIR</option>
          <option value="repair_estimate">
            Repair Estimate
          </option>
          <option value="repair_invoice">
            Repair Invoice
          </option>
          <option value="hospital_bill">
            Hospital Bill
          </option>
          <option value="vehicle_photo">
            Vehicle Photo
          </option>
          <option value="accident_photo">
            Accident Photo
          </option>
          <option value="surveyor_report">
            Surveyor Report
          </option>
          <option value="garage_document">
            Garage Document
          </option>
          <option value="payment_receipt">
            Payment Receipt
          </option>
          <option value="settlement_letter">
            Settlement Letter
          </option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="document-list">
        {loading ? (
          <div className="empty-state">
            Loading claim documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            No claim documents found.
          </div>
        ) : (
          filteredDocuments.map((claimDocument) => (
            <article
              className="document-card"
              key={claimDocument.id}
            >
              <div>
                <span className="type-badge">
                  {formatDocumentType(
                    claimDocument.document_type
                  )}
                </span>

                <h3>{claimDocument.document_name}</h3>

                <p>
                  {claimDocument.claim_reference
                    ? `Claim: ${claimDocument.claim_reference}`
                    : "No claim reference"}
                </p>

                <p>
                  {claimDocument.claim_date
                    ? `Claim date: ${formatDate(
                        claimDocument.claim_date
                      )}`
                    : `Uploaded: ${formatDateTime(
                        claimDocument.uploaded_at
                      )}`}
                </p>

                {claimDocument.notes && (
                  <p className="notes">
                    {claimDocument.notes}
                  </p>
                )}
              </div>

              <div className="document-actions">
                <button
                  type="button"
                  onClick={() =>
                    void viewDocument(claimDocument)
                  }
                >
                  View
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void downloadDocument(claimDocument)
                  }
                >
                  Download
                </button>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() =>
                    void deleteDocument(claimDocument)
                  }
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <style jsx>{`
        .vault {
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

        .header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
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

        .header p:last-child {
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

        .upload-panel {
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.34);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
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
        .document-actions button {
          min-height: 42px;
          padding: 10px 14px;
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

        .filters {
          display: grid;
          grid-template-columns: 1fr 240px;
          gap: 12px;
          margin: 20px 0;
        }

        .document-list {
          display: grid;
          gap: 13px;
        }

        .document-card {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 17px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 16px;
          background: rgba(2, 6, 23, 0.34);
        }

        .type-badge {
          display: inline-flex;
          margin-bottom: 9px;
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.16);
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 900;
        }

        .document-card p {
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .document-card .notes {
          color: #cbd5e1;
        }

        .document-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          align-self: center;
        }

        .document-actions button {
          border: 1px solid rgba(96, 165, 250, 0.2);
          background: rgba(15, 23, 42, 0.8);
          color: #dbeafe;
        }

        .document-actions .danger-button {
          border-color: rgba(239, 68, 68, 0.25);
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .empty-state {
          padding: 32px;
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        @media (max-width: 760px) {
          .vault {
            padding: 18px;
          }

          .form-grid,
          .filters {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .document-card,
          .document-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .document-actions button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}

async function createFileHash(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    buffer
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validateFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Upload a PDF, JPG, PNG or WEBP file.";
  }

  if (file.size === 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "File size must be 12 MB or less.";
  }

  return "";
}

function extensionFromMime(mimeType: string) {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return map[mimeType] || "bin";
}

function formatDocumentType(value: string) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
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