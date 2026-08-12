"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
};

type DocumentForm = {
  document_type: string;
  document_name: string;
  document_number: string;
  issue_date: string;
  expiry_date: string;
  notes: string;
};

const initialForm: DocumentForm = {
  document_type: "",
  document_name: "",
  document_number: "",
  issue_date: "",
  expiry_date: "",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

const allowedFileTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function AddDocumentPage() {
  const params = useParams();
  const router = useRouter();

  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<DocumentForm>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) {
      setErrorMessage("Vehicle ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Please sign in to add a document.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("id, vehicle_name, vehicle_number")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      setVehicle(null);
      setErrorMessage("Vehicle not found or access denied.");
      setLoading(false);
      return;
    }

    setVehicle(data as Vehicle);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  function updateField(field: keyof DocumentForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleDocumentTypeChange(value: string) {
    setForm((current) => ({
      ...current,
      document_type: value,
      document_name:
        current.document_name ||
        (value ? `${value} Document` : ""),
    }));
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!allowedFileTypes.includes(file.type)) {
      setSelectedFile(null);
      setErrorMessage("Please select a PDF, JPG, PNG or WEBP file.");
      event.target.value = "";
      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (file.size > maximumSize) {
      setSelectedFile(null);
      setErrorMessage("Document file must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
  }

  function removeSelectedFile() {
    setSelectedFile(null);
  }

  function validateForm() {
    if (!form.document_type) {
      return "Select a document type.";
    }

    if (!form.document_name.trim()) {
      return "Document name is required.";
    }

    if (
      form.issue_date &&
      form.expiry_date &&
      form.expiry_date < form.issue_date
    ) {
      return "Expiry date cannot be earlier than issue date.";
    }

    if (!selectedFile) {
      return "Please select a document file.";
    }

    return "";
  }

  async function uploadDocumentFile(userId: string) {
    if (!selectedFile || !vehicleId) {
      throw new Error("Document file is missing.");
    }

    setUploadingFile(true);

    try {
      const extension =
        selectedFile.name.split(".").pop()?.toLowerCase() ||
        (selectedFile.type === "application/pdf" ? "pdf" : "jpg");

      const fileName = `${crypto.randomUUID()}.${extension}`;
      const storagePath = `${userId}/${vehicleId}/${fileName}`;

      const { error } = await supabase.storage
        .from("vehicle-documents")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type,
        });

      if (error) {
        throw new Error(error.message);
      }

      return storagePath;
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!vehicleId) {
      setErrorMessage("Vehicle ID is missing.");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    let uploadedPath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in before adding a document.");
      }

      uploadedPath = await uploadDocumentFile(user.id);

      const documentPayload = {
        user_id: user.id,
        vehicle_id: Number(vehicleId),
        document_type: form.document_type,
        document_name: form.document_name.trim(),
        document_number: form.document_number.trim() || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        file_url: uploadedPath,
        notes: form.notes.trim() || null,
      };

      const { error } = await supabase
        .from("vehicle_documents")
        .insert(documentPayload);

      if (error) {
        throw new Error(error.message);
      }

      router.push(`/vehicle/${vehicleId}/documents`);
      router.refresh();
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from("vehicle-documents")
          .remove([uploadedPath]);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the document."
      );
    } finally {
      setSaving(false);
      setUploadingFile(false);
    }
  }

  const busy = loading || saving || uploadingFile;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-6xl">📄</div>
          <p className="mt-4 font-semibold text-slate-600">
            Loading document form...
          </p>
        </div>
      </main>
    );
  }

  if (!vehicle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
          <div className="text-6xl">🔒</div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Unable to add document
          </h1>

          <p className="mt-3 text-slate-500">
            {errorMessage || "Vehicle not found or access denied."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              My Vehicle
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Add Document
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {vehicle.vehicle_name || "Unnamed Vehicle"} ·{" "}
              {vehicle.vehicle_number || "Number not provided"}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(`/vehicle/${vehicle.id}/documents`)
            }
            disabled={busy}
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            ← Document Vault
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-7 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-7 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Secure Upload
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Add an important vehicle document
          </h2>

          <p className="mt-2 max-w-2xl text-white/80">
            Upload RC, insurance, PUC, driving licence or another
            document. Files are stored inside your private vault.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border bg-white shadow-sm"
        >
          <section className="border-b p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900">
                Document Information
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Enter the document identity and validity details.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Document Type" required>
                <select
                  value={form.document_type}
                  disabled={busy}
                  onChange={(event) =>
                    handleDocumentTypeChange(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select document type</option>
                  <option value="RC">RC</option>
                  <option value="Insurance">Insurance</option>
                  <option value="PUC">PUC</option>
                  <option value="Driving Licence">
                    Driving Licence
                  </option>
                  <option value="Invoice">Invoice</option>
                  <option value="Service Book">Service Book</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>

              <FormField label="Document Name" required>
                <input
                  type="text"
                  value={form.document_name}
                  disabled={busy}
                  onChange={(event) =>
                    updateField("document_name", event.target.value)
                  }
                  placeholder="Example: Comprehensive Insurance"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Document Number">
                <input
                  type="text"
                  value={form.document_number}
                  disabled={busy}
                  onChange={(event) =>
                    updateField("document_number", event.target.value)
                  }
                  placeholder="Enter policy or certificate number"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Issue Date">
                <input
                  type="date"
                  value={form.issue_date}
                  disabled={busy}
                  onChange={(event) =>
                    updateField("issue_date", event.target.value)
                  }
                  className={inputClass}
                />
              </FormField>

              <FormField label="Expiry Date">
                <input
                  type="date"
                  value={form.expiry_date}
                  disabled={busy}
                  min={form.issue_date || undefined}
                  onChange={(event) =>
                    updateField("expiry_date", event.target.value)
                  }
                  className={inputClass}
                />
              </FormField>

              <FormField label="Notes">
                <textarea
                  value={form.notes}
                  disabled={busy}
                  onChange={(event) =>
                    updateField("notes", event.target.value)
                  }
                  placeholder="Add optional notes"
                  rows={4}
                  className={inputClass}
                />
              </FormField>
            </div>
          </section>

          <section className="border-b p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900">
                Document File
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Upload one PDF or image file up to 10 MB.
              </p>
            </div>

            <label
              className={`flex min-h-48 items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                busy
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                  : "cursor-pointer border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50"
              }`}
            >
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={handleFileSelection}
                className="hidden"
              />

              <span>
                <span className="block text-5xl">📤</span>

                <span className="mt-3 block text-lg font-bold text-slate-900">
                  Choose document file
                </span>

                <span className="mt-1 block text-sm text-slate-500">
                  PDF, JPG, PNG or WEBP · Maximum 10 MB
                </span>
              </span>
            </label>

            {selectedFile && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-slate-50 p-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="text-4xl">
                    {selectedFile.type === "application/pdf"
                      ? "📕"
                      : "🖼️"}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">
                      {selectedFile.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeSelectedFile}
                  disabled={busy}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 bg-slate-50 p-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(`/vehicle/${vehicle.id}/documents`)
              }
              disabled={busy}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingFile
                ? "Uploading File..."
                : saving
                  ? "Saving Document..."
                  : "Save Document"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      {children}
    </div>
  );
}