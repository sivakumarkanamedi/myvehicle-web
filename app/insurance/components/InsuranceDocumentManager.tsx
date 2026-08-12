"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";

type Props = {
  policyId: number;
  documentPath: string | null;
  policyNumber: string;
  onUpdated: () => void | Promise<void>;
  onClose?: () => void;
};

type PolicySnapshot = {
  id: number;
  user_id: string;
  document_url: string | null;
  document_hash: string | null;
  insurance_company: string;
  policy_number: string;
  policy_type: string;
  start_date: string | null;
  expiry_date: string | null;
  document_verification_status: string | null;
  document_quality_status: string | null;
  document_is_blurry: boolean | null;
  document_is_readable: boolean | null;
  missing_pages_warning: boolean | null;
  scan_confidence: number | null;
  scan_warnings: unknown;
  coverage_details: unknown;
};

type PolicyVersion = {
  id: number;
  version_number: number;
  document_path: string;
  original_file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  archived_reason: string | null;
  created_at: string;
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 12 * 1024 * 1024;

export default function InsuranceDocumentManager({
  policyId,
  documentPath,
  policyNumber,
  onUpdated,
  onClose,
}: Props) {
  const [currentDocumentPath, setCurrentDocumentPath] =
    useState<string | null>(documentPath);

  const [signedUrl, setSignedUrl] = useState("");
  const [versions, setVersions] = useState<PolicyVersion[]>([]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isPdf = useMemo(() => {
    return currentDocumentPath?.toLowerCase().endsWith(".pdf") ?? false;
  }, [currentDocumentPath]);

  useEffect(() => {
    setCurrentDocumentPath(documentPath);
  }, [documentPath]);

  useEffect(() => {
    void loadSignedUrl(currentDocumentPath);
  }, [currentDocumentPath]);

  useEffect(() => {
    void loadVersionHistory();
  }, [policyId]);

  async function loadSignedUrl(path: string | null) {
    setSignedUrl("");
    setErrorMessage("");

    if (!path) {
      return;
    }

    setLoadingPreview(true);

    const { data, error } = await supabase.storage
      .from("insurance-documents")
      .createSignedUrl(path, 60 * 10);

    if (error) {
      setErrorMessage(error.message);
      setLoadingPreview(false);
      return;
    }

    setSignedUrl(data.signedUrl);
    setLoadingPreview(false);
  }

  async function loadVersionHistory() {
    setLoadingVersions(true);

    const { data, error } = await supabase
      .from("insurance_policy_versions")
      .select(
        `
          id,
          version_number,
          document_path,
          original_file_name,
          mime_type,
          file_size,
          archived_reason,
          created_at
        `
      )
      .eq("policy_id", policyId)
      .order("version_number", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoadingVersions(false);
      return;
    }

    setVersions((data ?? []) as PolicyVersion[]);
    setLoadingVersions(false);
  }

  async function getPolicySnapshot(): Promise<PolicySnapshot> {
    const { data, error } = await supabase
      .from("insurance_policies")
      .select(
        `
          id,
          user_id,
          document_url,
          document_hash,
          insurance_company,
          policy_number,
          policy_type,
          start_date,
          expiry_date,
          document_verification_status,
          document_quality_status,
          document_is_blurry,
          document_is_readable,
          missing_pages_warning,
          scan_confidence,
          scan_warnings,
          coverage_details
        `
      )
      .eq("id", policyId)
      .single();

    if (error || !data) {
      throw new Error(
        error?.message || "Unable to load the current policy."
      );
    }

    return data as PolicySnapshot;
  }

  async function getNextVersionNumber() {
    const { data, error } = await supabase.rpc(
      "next_insurance_policy_version",
      {
        target_policy_id: policyId,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return Number(data || 1);
  }

  async function archiveCurrentDocument(
    snapshot: PolicySnapshot,
    reason: "replaced" | "removed"
  ) {
    if (!snapshot.document_url) {
      return;
    }

    const versionNumber = await getNextVersionNumber();

    const { error } = await supabase
      .from("insurance_policy_versions")
      .insert({
        user_id: snapshot.user_id,
        policy_id: snapshot.id,
        version_number: versionNumber,
        document_path: snapshot.document_url,
        document_hash: snapshot.document_hash,
        original_file_name: getFileName(snapshot.document_url),
        mime_type: getMimeTypeFromPath(snapshot.document_url),
        insurance_company: snapshot.insurance_company,
        policy_number: snapshot.policy_number,
        policy_type: snapshot.policy_type,
        start_date: snapshot.start_date,
        expiry_date: snapshot.expiry_date,
        document_verification_status:
          snapshot.document_verification_status,
        document_quality_status:
          snapshot.document_quality_status,
        document_is_blurry: snapshot.document_is_blurry,
        document_is_readable: snapshot.document_is_readable,
        missing_pages_warning: snapshot.missing_pages_warning,
        scan_confidence: snapshot.scan_confidence,
        scan_warnings: snapshot.scan_warnings ?? [],
        coverage_details: snapshot.coverage_details ?? {},
        archived_reason: reason,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  async function replaceDocument(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setUploading(true);
    setMessage("");
    setErrorMessage("");

    let newPath = "";

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const snapshot = await getPolicySnapshot();

      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        extensionFromMime(file.type);

      newPath =
        `${user.id}/${new Date().getFullYear()}/` +
        `${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("insurance-documents")
        .upload(newPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      if (snapshot.document_url) {
        await archiveCurrentDocument(snapshot, "replaced");
      }

      const { error: updateError } = await supabase
        .from("insurance_policies")
        .update({
          document_url: newPath,
          document_hash: null,
          document_verification_status: "pending",
          document_quality_status: "unknown",
          document_is_blurry: false,
          document_is_readable: true,
          missing_pages_warning: false,
          scan_confidence: null,
          scan_warnings: [],
          document_scanned_at: null,
        })
        .eq("id", policyId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setCurrentDocumentPath(newPath);
      setMessage(
        snapshot.document_url
          ? "Document replaced. The previous version was preserved."
          : "Insurance document uploaded successfully."
      );

      await loadVersionHistory();
      await onUpdated();
    } catch (error) {
      if (newPath) {
        await supabase.storage
          .from("insurance-documents")
          .remove([newPath]);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Document replacement failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function downloadCurrentDocument() {
    if (!currentDocumentPath) {
      return;
    }

    await downloadStorageFile(
      currentDocumentPath,
      `${policyNumber || "insurance-policy"}-current`
    );
  }

  async function downloadVersion(version: PolicyVersion) {
    await downloadStorageFile(
      version.document_path,
      `${policyNumber || "insurance-policy"}-version-${version.version_number}`
    );
  }

  async function downloadStorageFile(
    path: string,
    downloadName: string
  ) {
    setErrorMessage("");

    const { data, error } = await supabase.storage
      .from("insurance-documents")
      .download(path);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const objectUrl = URL.createObjectURL(data);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download =
      `${downloadName}.` + `${path.split(".").pop() || "pdf"}`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function archiveAndRemoveCurrentDocument() {
    if (!currentDocumentPath) {
      return;
    }

    const confirmed = window.confirm(
      "Remove the current document? It will remain available in version history."
    );

    if (!confirmed) {
      return;
    }

    setArchiving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const snapshot = await getPolicySnapshot();

      await archiveCurrentDocument(snapshot, "removed");

      const { error: updateError } = await supabase
        .from("insurance_policies")
        .update({
          document_url: null,
          document_hash: null,
          document_verification_status: "pending",
          document_quality_status: "unknown",
          document_is_blurry: false,
          document_is_readable: true,
          missing_pages_warning: false,
          scan_confidence: null,
          scan_warnings: [],
          document_scanned_at: null,
        })
        .eq("id", policyId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setCurrentDocumentPath(null);
      setMessage(
        "Current document removed and preserved in version history."
      );

      await loadVersionHistory();
      await onUpdated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to archive the document."
      );
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="manager">
      <div className="header">
        <div>
          <p className="eyebrow">INSURANCE DOCUMENT VAULT</p>
          <h2>Policy Document Manager</h2>
          <p>
            View the current policy file and retain every previous
            version securely.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="Close document manager"
          >
            ×
          </button>
        )}
      </div>

      <div className="preview">
        {loadingPreview ? (
          <div className="empty">Preparing secure preview...</div>
        ) : !currentDocumentPath ? (
          <div className="empty">
            <strong>No current document</strong>
            <span>Upload a policy PDF or image below.</span>
          </div>
        ) : !signedUrl ? (
          <div className="empty">Unable to open document preview.</div>
        ) : isPdf ? (
          <iframe src={signedUrl} title="Insurance policy PDF" />
        ) : (
          <img src={signedUrl} alt="Insurance policy document" />
        )}
      </div>

      {message && <div className="success-message">{message}</div>}
      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      <div className="actions">
        <label className="primary">
          {uploading
            ? "Uploading..."
            : currentDocumentPath
              ? "Replace Document"
              : "Upload Document"}

          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={replaceDocument}
            disabled={uploading || archiving}
            hidden
          />
        </label>

        <button
          type="button"
          className="secondary"
          onClick={() => void downloadCurrentDocument()}
          disabled={!currentDocumentPath || uploading || archiving}
        >
          Download Current
        </button>

        <button
          type="button"
          className="danger"
          onClick={() => void archiveAndRemoveCurrentDocument()}
          disabled={!currentDocumentPath || uploading || archiving}
        >
          {archiving ? "Archiving..." : "Archive Current"}
        </button>
      </div>

      <div className="history-section">
        <div className="history-header">
          <div>
            <p className="eyebrow">VERSION HISTORY</p>
            <h3>Previous Documents</h3>
          </div>

          <span className="version-count">
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </span>
        </div>

        {loadingVersions ? (
          <div className="history-empty">Loading version history...</div>
        ) : versions.length === 0 ? (
          <div className="history-empty">
            No previous document versions yet.
          </div>
        ) : (
          <div className="version-list">
            {versions.map((version) => (
              <article className="version-card" key={version.id}>
                <div>
                  <strong>Version {version.version_number}</strong>
                  <p>
                    {version.original_file_name ||
                      getFileName(version.document_path)}
                  </p>
                  <span>
                    {formatDateTime(version.created_at)} ·{" "}
                    {formatFileSize(version.file_size)}
                  </span>
                </div>

                <div className="version-actions">
                  <span className="reason-badge">
                    {version.archived_reason === "removed"
                      ? "Archived"
                      : "Replaced"}
                  </span>

                  <button
                    type="button"
                    onClick={() => void downloadVersion(version)}
                  >
                    Download
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .manager {
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
        .history-header,
        .version-card,
        .version-actions {
          display: flex;
          align-items: center;
        }

        .header,
        .history-header,
        .version-card {
          justify-content: space-between;
        }

        .header {
          align-items: flex-start;
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

        h2 {
          font-size: 27px;
        }

        .header p:last-child {
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

        .preview {
          min-height: 420px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.5);
        }

        iframe,
        img {
          width: 100%;
          height: 620px;
          border: 0;
          object-fit: contain;
        }

        .empty {
          min-height: 420px;
          display: grid;
          place-content: center;
          gap: 8px;
          padding: 30px;
          text-align: center;
          color: #94a3b8;
        }

        .empty strong {
          color: #f8fafc;
          font-size: 20px;
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

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 18px;
        }

        .primary,
        .secondary,
        .danger,
        .version-actions button {
          min-height: 44px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 17px;
          border-radius: 12px;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .primary {
          border: 0;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: white;
        }

        .secondary,
        .version-actions button {
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

        .history-section {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid rgba(148, 163, 184, 0.14);
        }

        .history-header {
          gap: 16px;
          margin-bottom: 14px;
        }

        .version-count,
        .reason-badge {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.15);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 900;
        }

        .version-list {
          display: grid;
          gap: 12px;
        }

        .version-card {
          gap: 18px;
          padding: 15px 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 15px;
          background: rgba(2, 6, 23, 0.34);
        }

        .version-card strong {
          color: #f8fafc;
        }

        .version-card p {
          margin: 5px 0;
          color: #cbd5e1;
          overflow-wrap: anywhere;
        }

        .version-card span:not(.reason-badge) {
          color: #64748b;
          font-size: 12px;
        }

        .version-actions {
          gap: 10px;
          flex: 0 0 auto;
        }

        .version-actions button {
          min-height: 38px;
          padding: 8px 12px;
          font-size: 12px;
        }

        .history-empty {
          padding: 20px;
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.3);
          color: #94a3b8;
          text-align: center;
        }

        @media (max-width: 700px) {
          .manager {
            padding: 18px;
          }

          .preview,
          .empty {
            min-height: 300px;
          }

          iframe,
          img {
            height: 440px;
          }

          .actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .primary,
          .secondary,
          .danger {
            width: 100%;
          }

          .version-card,
          .version-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .version-actions button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
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

function getMimeTypeFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  return extension ? map[extension] || null : null;
}

function getFileName(path: string) {
  return path.split("/").pop() || "insurance-document";
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

function formatFileSize(value: number | null) {
  if (value === null || value === undefined) {
    return "Size unavailable";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}