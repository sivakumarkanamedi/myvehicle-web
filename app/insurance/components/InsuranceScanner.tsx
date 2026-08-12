"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { supabase } from "../../../supabase";

export type ExtractedInsuranceData = {
  insurance_company?: string;
  policy_number?: string;
  policy_type?: string;
  premium_amount?: number | null;
  idv?: number | null;
  start_date?: string;
  expiry_date?: string;
  claim_contact?: string;
  customer_care?: string;
  vehicle_number?: string;
  notes?: string;
  document_path?: string;
  confidence?: number;
};

type Props = {
  onExtracted: (data: ExtractedInsuranceData) => void;
  onClose?: () => void;
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 12 * 1024 * 1024;

export default function InsuranceScanner({
  onExtracted,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [progressText, setProgressText] = useState("");

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl("");
  }

  function validateFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Upload a PDF, JPG, PNG or WEBP insurance document.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "File size must be 12 MB or less.";
    }

    if (file.size === 0) {
      return "The selected file is empty.";
    }

    return "";
  }

  function selectFile(file: File) {
    const validationError = validateFile(file);

    if (validationError) {
      setMessage(validationError);
      setSelectedFile(null);
      clearPreview();
      return;
    }

    clearPreview();
    setSelectedFile(file);
    setMessage("");
    setProgressText("");

    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      selectFile(file);
    }

    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      selectFile(file);
    }
  }

  async function scanDocument() {
    if (!selectedFile) {
      setMessage("Please upload or scan an insurance policy first.");
      return;
    }

    setScanning(true);
    setMessage("");
    setProgressText("Mira is securely reading your insurance policy...");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/insurance/scan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || "Mira could not scan this document."
        );
      }

      setProgressText("Policy details extracted successfully.");

      onExtracted({
        insurance_company: result.insurance_company ?? "",
        policy_number: result.policy_number ?? "",
        policy_type: result.policy_type ?? "Comprehensive",
        premium_amount:
          typeof result.premium_amount === "number"
            ? result.premium_amount
            : null,
        idv:
          typeof result.idv === "number"
            ? result.idv
            : null,
        start_date: result.start_date ?? "",
        expiry_date: result.expiry_date ?? "",
        claim_contact: result.claim_contact ?? "",
        customer_care: result.customer_care ?? "",
        vehicle_number: result.vehicle_number ?? "",
        notes: result.notes ?? "",
        document_path: result.document_path ?? "",
        confidence:
          typeof result.confidence === "number"
            ? result.confidence
            : undefined,
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Mira could not scan this document."
      );
      setProgressText("");
    } finally {
      setScanning(false);
    }
  }

  function removeFile() {
    clearPreview();
    setSelectedFile(null);
    setMessage("");
    setProgressText("");
  }

  return (
    <section className="scanner-card">
      <div className="scanner-header">
        <div>
          <p className="eyebrow">MIRA INSURANCE SCANNER</p>
          <h2>Scan Insurance Policy</h2>
          <p className="description">
            Upload a PDF or take a photo. Mira will automatically
            extract the policy details.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            disabled={scanning}
            aria-label="Close scanner"
          >
            ×
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        hidden
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        hidden
      />

      {!selectedFile ? (
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
          onDrop={handleDrop}
        >
          <div className="scan-icon">📄</div>
          <h3>Upload insurance policy</h3>
          <p>PDF, JPG, PNG or WEBP · Maximum 12 MB</p>

          <div className="upload-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload PDF or Image
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => cameraInputRef.current?.click()}
            >
              Take Photo
            </button>
          </div>
        </div>
      ) : (
        <div className="selected-file">
          <div className="preview-panel">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Insurance policy preview"
              />
            ) : (
              <div className="pdf-preview">
                <span>📕</span>
                <strong>PDF Insurance Policy</strong>
              </div>
            )}
          </div>

          <div className="file-details">
            <p className="file-label">Selected document</p>
            <h3>{selectedFile.name}</h3>
            <p>{formatFileSize(selectedFile.size)}</p>

            <div className="file-actions">
              <button
                type="button"
                className="primary-button"
                onClick={scanDocument}
                disabled={scanning}
              >
                {scanning ? "Mira is Scanning..." : "Scan with Mira"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={removeFile}
                disabled={scanning}
              >
                Choose Another
              </button>
            </div>
          </div>
        </div>
      )}

      {progressText && (
        <div className="progress-message" role="status">
          {scanning && <span className="spinner" />}
          <span>{progressText}</span>
        </div>
      )}

      {message && (
        <div className="error-message" role="alert">
          {message}
        </div>
      )}

      <style jsx>{`
        .scanner-card {
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

        .scanner-header {
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
          letter-spacing: 0.16em;
        }

        h2 {
          margin: 0;
          font-size: 28px;
        }

        .description {
          margin: 8px 0 0;
          color: #94a3b8;
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

        .drop-zone {
          display: grid;
          place-items: center;
          min-height: 300px;
          padding: 30px;
          border: 2px dashed rgba(96, 165, 250, 0.3);
          border-radius: 20px;
          background: rgba(2, 6, 23, 0.36);
          text-align: center;
        }

        .drop-zone.dragging {
          border-color: #60a5fa;
          background: rgba(37, 99, 235, 0.14);
        }

        .scan-icon {
          font-size: 40px;
        }

        .drop-zone h3 {
          margin: 14px 0 6px;
        }

        .drop-zone p {
          margin: 0 0 20px;
          color: #94a3b8;
        }

        .upload-actions,
        .file-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
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
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
        }

        .secondary-button {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.82);
          color: #dbeafe;
        }

        .selected-file {
          display: grid;
          grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr);
          gap: 22px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.36);
        }

        .preview-panel {
          display: grid;
          min-height: 260px;
          place-items: center;
          overflow: hidden;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.72);
        }

        .preview-panel img {
          width: 100%;
          height: 100%;
          max-height: 400px;
          object-fit: contain;
        }

        .pdf-preview {
          display: grid;
          justify-items: center;
          gap: 12px;
        }

        .pdf-preview span {
          font-size: 54px;
        }

        .file-details {
          align-self: center;
        }

        .file-label {
          margin: 0;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 900;
        }

        .file-details h3 {
          margin: 8px 0;
          overflow-wrap: anywhere;
        }

        .file-details > p:not(.file-label) {
          color: #94a3b8;
        }

        .progress-message,
        .error-message {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 13px 15px;
          border-radius: 13px;
        }

        .progress-message {
          background: rgba(30, 64, 175, 0.14);
          color: #bfdbfe;
        }

        .error-message {
          background: rgba(127, 29, 29, 0.2);
          color: #fecaca;
        }

        .spinner {
          width: 17px;
          height: 17px;
          border: 2px solid rgba(191, 219, 254, 0.3);
          border-top-color: #bfdbfe;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .selected-file {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .upload-actions,
          .file-actions {
            display: grid;
            width: 100%;
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}