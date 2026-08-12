"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
};

type VehicleDocument = {
  id: number;
  user_id: string;
  vehicle_id: number;
  document_type: string;
  document_name: string | null;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
};

const DOCUMENT_ICONS: Record<string, string> = {
  RC: "📄",
  Insurance: "🛡️",
  PUC: "🌿",
  "Driving Licence": "🪪",
  Invoice: "🧾",
  "Service Book": "🔧",
  Other: "📁",
};

function formatDate(value: string | null) {
  if (!value) return "Not provided";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getStatus(expiryDate: string | null) {
  if (!expiryDate) {
    return {
      label: "No expiry date",
      className: "bg-slate-100 text-slate-700",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  const days = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    return {
      label: "Expired",
      className: "bg-red-100 text-red-700",
    };
  }

  if (days <= 30) {
    return {
      label: days === 0 ? "Expires today" : `${days} days left`,
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Valid",
    className: "bg-green-100 text-green-700",
  };
}

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();

  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [search, setSearch] = useState("");
  const [documentType, setDocumentType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadVault = useCallback(async () => {
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
      setErrorMessage("Please sign in to view your documents.");
      setLoading(false);
      return;
    }

    const { data: vehicleData, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, vehicle_name, vehicle_number, vehicle_type")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .single();

    if (vehicleError || !vehicleData) {
      setVehicle(null);
      setDocuments([]);
      setErrorMessage("Vehicle not found or access denied.");
      setLoading(false);
      return;
    }

    const { data: documentData, error: documentError } = await supabase
      .from("vehicle_documents")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (documentError) {
      setVehicle(vehicleData as Vehicle);
      setDocuments([]);
      setErrorMessage(documentError.message);
      setLoading(false);
      return;
    }

    setVehicle(vehicleData as Vehicle);
    setDocuments((documentData as VehicleDocument[]) || []);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesSearch =
        !query ||
        document.document_name?.toLowerCase().includes(query) ||
        document.document_number?.toLowerCase().includes(query) ||
        document.document_type.toLowerCase().includes(query);

      const matchesType =
        documentType === "all" || document.document_type === documentType;

      return matchesSearch && matchesType;
    });
  }, [documents, search, documentType]);

  const stats = useMemo(() => {
    let valid = 0;
    let expiring = 0;
    let expired = 0;

    documents.forEach((document) => {
      if (!document.expiry_date) {
        valid += 1;
        return;
      }

      const status = getStatus(document.expiry_date).label;

      if (status === "Expired") {
        expired += 1;
      } else if (status === "Valid") {
        valid += 1;
      } else {
        expiring += 1;
      }
    });

    return {
      total: documents.length,
      valid,
      expiring,
      expired,
    };
  }, [documents]);

  async function openDocument(document: VehicleDocument) {
    if (!document.file_url) {
      setErrorMessage("No file has been uploaded for this document.");
      return;
    }

    setOpeningId(document.id);
    setErrorMessage("");

    const { data, error } = await supabase.storage
      .from("vehicle-documents")
      .createSignedUrl(document.file_url, 600);

    if (error || !data?.signedUrl) {
      setErrorMessage(error?.message || "Unable to open the document.");
      setOpeningId(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setOpeningId(null);
  }

  async function deleteDocument(document: VehicleDocument) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${
        document.document_name || document.document_type
      }?`
    );

    if (!confirmed) return;

    setDeletingId(document.id);
    setErrorMessage("");

    try {
      if (document.file_url) {
        const { error: storageError } = await supabase.storage
          .from("vehicle-documents")
          .remove([document.file_url]);

        if (storageError) {
          throw new Error(storageError.message);
        }
      }

      const { error } = await supabase
        .from("vehicle_documents")
        .delete()
        .eq("id", document.id)
        .eq("vehicle_id", document.vehicle_id)
        .eq("user_id", document.user_id);

      if (error) {
        throw new Error(error.message);
      }

      setDocuments((current) =>
        current.filter((item) => item.id !== document.id)
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-6xl">📁</div>
          <p className="mt-4 font-semibold text-slate-600">
            Loading Document Vault...
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
            Unable to open Document Vault
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">My Vehicle</p>
            <h1 className="text-2xl font-bold text-slate-900">
              Document Vault
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {vehicle.vehicle_name || "Unnamed Vehicle"} ·{" "}
              {vehicle.vehicle_number || "Number not provided"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push(`/vehicle/${vehicle.id}`)}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              ← Vehicle Details
            </button>

            <Link
              href={`/vehicle/${vehicle.id}/documents/add`}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              + Add Document
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-7 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Secure Cloud Storage
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            Keep every vehicle document in one place
          </h2>
          <p className="mt-2 max-w-3xl text-white/80">
            Store RC, insurance, PUC, driving licence and other important
            documents with expiry tracking and secure access.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Documents" value={stats.total} icon="📁" />
          <StatCard label="Valid" value={stats.valid} icon="✅" />
          <StatCard label="Expiring Soon" value={stats.expiring} icon="⏳" />
          <StatCard label="Expired" value={stats.expired} icon="⚠️" />
        </div>

        <div className="mt-7 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_240px_auto]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search document name, number or type"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">All document types</option>
              <option value="RC">RC</option>
              <option value="Insurance">Insurance</option>
              <option value="PUC">PUC</option>
              <option value="Driving Licence">Driving Licence</option>
              <option value="Invoice">Invoice</option>
              <option value="Service Book">Service Book</option>
              <option value="Other">Other</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDocumentType("all");
              }}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
            <button
              type="button"
              onClick={loadVault}
              className="ml-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {filteredDocuments.length === 0 ? (
          <div className="mt-7 rounded-3xl border border-dashed bg-white px-6 py-16 text-center">
            <div className="text-6xl">📄</div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              {documents.length === 0
                ? "No documents uploaded yet"
                : "No matching documents found"}
            </h2>
            <p className="mt-2 text-slate-500">
              {documents.length === 0
                ? "Add your first RC, insurance, PUC or driving licence document."
                : "Change your search or filter and try again."}
            </p>

            {documents.length === 0 && (
              <Link
                href={`/vehicle/${vehicle.id}/documents/add`}
                className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Add Your First Document
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((document) => {
              const status = getStatus(document.expiry_date);

              return (
                <article
                  key={document.id}
                  className="overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4 border-b bg-slate-50 p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                        {DOCUMENT_ICONS[document.document_type] || "📁"}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-blue-600">
                          {document.document_type}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                          {document.document_name ||
                            `${document.document_type} Document`}
                        </h2>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="p-5">
                    <DocumentField
                      label="Document Number"
                      value={document.document_number || "Not provided"}
                    />

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <DocumentField
                        label="Issue Date"
                        value={formatDate(document.issue_date)}
                      />
                      <DocumentField
                        label="Expiry Date"
                        value={formatDate(document.expiry_date)}
                      />
                    </div>

                    {document.notes && (
                      <div className="mt-5 rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Notes
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {document.notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => openDocument(document)}
                        disabled={openingId === document.id}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {openingId === document.id ? "Opening..." : "View File"}
                      </button>

                      <Link
                        href={`/vehicle/${vehicle.id}/documents/${document.id}/edit`}
                        className="rounded-xl bg-amber-500 px-4 py-2.5 text-center font-semibold text-white hover:bg-amber-600"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteDocument(document)}
                        disabled={deletingId === document.id}
                        className="col-span-2 rounded-xl border border-red-200 px-4 py-2.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingId === document.id
                          ? "Deleting..."
                          : "Delete Document"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function DocumentField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}