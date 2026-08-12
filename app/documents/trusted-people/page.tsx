"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "../../../supabase";

type Vehicle = {
  id: number;
  vehicle_number: string | null;
  brand: string | null;
  model: string | null;
};

type VehicleDocument = {
  id: number;
  vehicle_id: number | null;
  document_type: string | null;
  document_name: string | null;
  document_number: string | null;
  expiry_date: string | null;
};

type TrustedPerson = {
  id: number;
  user_id: string;
  full_name: string;
  mobile_number: string;
  email: string | null;
  relationship: string;
  permission_level: "view" | "download";
  access_type: "permanent" | "temporary";
  access_expires_at: string | null;
  emergency_access_enabled: boolean;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
};

type DocumentPermission = {
  id: number;
  trusted_person_id: number;
  vehicle_id: number | null;
  document_id: number | null;
  can_view: boolean;
  can_download: boolean;
  emergency_only: boolean;
};

type FormState = {
  fullName: string;
  mobileNumber: string;
  email: string;
  relationship: string;
  permissionLevel: "view" | "download";
  accessType: "permanent" | "temporary";
  temporaryDuration: "1-hour" | "24-hours" | "7-days" | "30-days";
  emergencyAccessEnabled: boolean;
};

const initialForm: FormState = {
  fullName: "",
  mobileNumber: "",
  email: "",
  relationship: "Family",
  permissionLevel: "view",
  accessType: "permanent",
  temporaryDuration: "24-hours",
  emergencyAccessEnabled: false,
};

function formatDateTime(value: string | null) {
  if (!value) return "No expiry";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTemporaryExpiry(duration: FormState["temporaryDuration"]) {
  const now = new Date();

  if (duration === "1-hour") {
    now.setHours(now.getHours() + 1);
  } else if (duration === "24-hours") {
    now.setHours(now.getHours() + 24);
  } else if (duration === "7-days") {
    now.setDate(now.getDate() + 7);
  } else {
    now.setDate(now.getDate() + 30);
  }

  return now.toISOString();
}

function vehicleLabel(vehicle: Vehicle) {
  const number = vehicle.vehicle_number || "Vehicle";
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  return name ? `${number} — ${name}` : number;
}

export default function TrustedPeoplePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingPersonId, setWorkingPersonId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [trustedPeople, setTrustedPeople] = useState<TrustedPerson[]>([]);
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const [
        vehiclesResult,
        documentsResult,
        peopleResult,
        permissionsResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, vehicle_number, brand, model")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("vehicle_documents")
          .select(
            "id, vehicle_id, document_type, document_name, document_number, expiry_date"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("trusted_people")
          .select(
            "id, user_id, full_name, mobile_number, email, relationship, permission_level, access_type, access_expires_at, emergency_access_enabled, is_active, revoked_at, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("document_permissions")
          .select(
            "id, trusted_person_id, vehicle_id, document_id, can_view, can_download, emergency_only"
          )
          .eq("user_id", user.id),
      ]);

      if (vehiclesResult.error) throw vehiclesResult.error;
      if (documentsResult.error) throw documentsResult.error;
      if (peopleResult.error) throw peopleResult.error;
      if (permissionsResult.error) throw permissionsResult.error;

      setVehicles((vehiclesResult.data || []) as Vehicle[]);
      setDocuments((documentsResult.data || []) as VehicleDocument[]);
      setTrustedPeople((peopleResult.data || []) as TrustedPerson[]);
      setPermissions((permissionsResult.data || []) as DocumentPermission[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load trusted access."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableDocuments = useMemo(() => {
    if (selectedVehicleIds.length === 0) return [];

    return documents.filter(
      (document) =>
        document.vehicle_id !== null &&
        selectedVehicleIds.includes(document.vehicle_id)
    );
  }, [documents, selectedVehicleIds]);

  const activePeople = useMemo(
    () => trustedPeople.filter((person) => person.is_active),
    [trustedPeople]
  );

  const revokedPeople = useMemo(
    () => trustedPeople.filter((person) => !person.is_active),
    [trustedPeople]
  );

  function resetForm() {
    setForm(initialForm);
    setSelectedVehicleIds([]);
    setSelectedDocumentIds([]);
    setShowForm(false);
  }

  function toggleVehicle(vehicleId: number) {
    setSuccessMessage("");

    setSelectedVehicleIds((current) => {
      const next = current.includes(vehicleId)
        ? current.filter((id) => id !== vehicleId)
        : [...current, vehicleId];

      setSelectedDocumentIds((documentIds) =>
        documentIds.filter((documentId) => {
          const document = documents.find((item) => item.id === documentId);
          return (
            document?.vehicle_id !== null &&
            document?.vehicle_id !== undefined &&
            next.includes(document.vehicle_id)
          );
        })
      );

      return next;
    });
  }

  function toggleDocument(documentId: number) {
    setSuccessMessage("");
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  }

  function selectAllAvailableDocuments() {
    if (
      availableDocuments.length > 0 &&
      availableDocuments.every((document) =>
        selectedDocumentIds.includes(document.id)
      )
    ) {
      const availableIds = new Set(
        availableDocuments.map((document) => document.id)
      );
      setSelectedDocumentIds((current) =>
        current.filter((id) => !availableIds.has(id))
      );
      return;
    }

    setSelectedDocumentIds((current) =>
      Array.from(
        new Set([
          ...current,
          ...availableDocuments.map((document) => document.id),
        ])
      )
    );
  }

  async function saveTrustedPerson() {
    if (saving) return;

    const fullName = form.fullName.trim();
    const mobileNumber = form.mobileNumber.trim();
    const email = form.email.trim();

    if (!fullName) {
      setError("Enter the trusted person's full name.");
      return;
    }

    if (!mobileNumber) {
      setError("Enter the trusted person's mobile number.");
      return;
    }

    if (selectedVehicleIds.length === 0) {
      setError("Select at least one vehicle.");
      return;
    }

    if (selectedDocumentIds.length === 0) {
      setError("Select at least one document to share.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const accessExpiresAt =
        form.accessType === "temporary"
          ? getTemporaryExpiry(form.temporaryDuration)
          : null;

      const { data: personData, error: personError } = await supabase
        .from("trusted_people")
        .insert({
          user_id: user.id,
          full_name: fullName,
          mobile_number: mobileNumber,
          email: email || null,
          relationship: form.relationship,
          permission_level: form.permissionLevel,
          access_type: form.accessType,
          access_expires_at: accessExpiresAt,
          emergency_access_enabled: form.emergencyAccessEnabled,
          is_active: true,
          revoked_at: null,
        })
        .select("id")
        .single();

      if (personError || !personData) {
        throw new Error(
          personError?.message || "Unable to add the trusted person."
        );
      }

      const permissionRows = selectedDocumentIds.map((documentId) => {
        const document = documents.find((item) => item.id === documentId);

        return {
          user_id: user.id,
          trusted_person_id: personData.id,
          vehicle_id: document?.vehicle_id ?? null,
          document_id: documentId,
          can_view: true,
          can_download: form.permissionLevel === "download",
          emergency_only: false,
        };
      });

      const { error: permissionError } = await supabase
        .from("document_permissions")
        .insert(permissionRows);

      if (permissionError) {
        await supabase
          .from("trusted_people")
          .delete()
          .eq("id", personData.id)
          .eq("user_id", user.id);

        throw new Error(permissionError.message);
      }

      setSuccessMessage(
        `${fullName} now has secure access to ${selectedDocumentIds.length} document${
          selectedDocumentIds.length === 1 ? "" : "s"
        }.`
      );

      resetForm();
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save trusted access."
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeAccess(person: TrustedPerson) {
    if (workingPersonId !== null) return;

    const confirmed = window.confirm(
      `Revoke all document access for ${person.full_name}?\n\nThey will no longer be able to use their trusted access.`
    );

    if (!confirmed) return;

    setWorkingPersonId(person.id);
    setError("");
    setSuccessMessage("");

    try {
      const { error: updateError } = await supabase
        .from("trusted_people")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
        })
        .eq("id", person.id)
        .eq("user_id", person.user_id);

      if (updateError) throw updateError;

      setSuccessMessage(`${person.full_name}'s access has been revoked.`);
      await loadData();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Unable to revoke access."
      );
    } finally {
      setWorkingPersonId(null);
    }
  }

  async function restoreAccess(person: TrustedPerson) {
    if (workingPersonId !== null) return;

    setWorkingPersonId(person.id);
    setError("");
    setSuccessMessage("");

    try {
      const { error: updateError } = await supabase
        .from("trusted_people")
        .update({
          is_active: true,
          revoked_at: null,
        })
        .eq("id", person.id)
        .eq("user_id", person.user_id);

      if (updateError) throw updateError;

      setSuccessMessage(`${person.full_name}'s access has been restored.`);
      await loadData();
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Unable to restore access."
      );
    } finally {
      setWorkingPersonId(null);
    }
  }

  async function deleteTrustedPerson(person: TrustedPerson) {
    if (workingPersonId !== null) return;

    const confirmed = window.confirm(
      `Delete ${person.full_name} permanently?\n\nTheir permissions and trusted-person record will be removed.`
    );

    if (!confirmed) return;

    setWorkingPersonId(person.id);
    setError("");
    setSuccessMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("trusted_people")
        .delete()
        .eq("id", person.id)
        .eq("user_id", person.user_id);

      if (deleteError) throw deleteError;

      setSuccessMessage(`${person.full_name} was removed.`);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the trusted person."
      );
    } finally {
      setWorkingPersonId(null);
    }
  }

  function personPermissions(personId: number) {
    return permissions.filter(
      (permission) => permission.trusted_person_id === personId
    );
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top, #172554 0%, #071426 40%, #020617 100%)",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Loader2
            size={34}
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p style={{ color: "#94a3b8" }}>Loading trusted access...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px 70px",
        background:
          "radial-gradient(circle at top, #172554 0%, #071426 38%, #020617 100%)",
        color: "#f8fafc",
      }}
    >
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        input,
        select {
          font: inherit;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div style={{ width: "min(1120px, 100%)", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.push("/documents")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 12px",
            borderRadius: "11px",
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.62)",
            color: "#cbd5e1",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={17} />
          Document Vault
        </button>

        <header
          style={{
            marginTop: "22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#67e8f9",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Secure Family & Emergency Access
            </div>

            <h1
              style={{
                margin: "9px 0 7px",
                fontSize: "clamp(31px, 5vw, 48px)",
                lineHeight: 1.08,
              }}
            >
              Trusted People
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: "720px",
                color: "#94a3b8",
                lineHeight: 1.7,
              }}
            >
              Give selected family members or trusted drivers controlled access
              to specific vehicle documents. You can revoke access instantly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccessMessage("");
              setShowForm(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              padding: "13px 17px",
              borderRadius: "14px",
              border: "none",
              background: "#2563eb",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(37,99,235,0.25)",
            }}
          >
            <Plus size={19} />
            Add Trusted Person
          </button>
        </header>

        <section
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "13px",
          }}
        >
          {[
            {
              label: "Active People",
              value: activePeople.length,
              icon: UserRoundCheck,
              colour: "#86efac",
            },
            {
              label: "Shared Documents",
              value: permissions.length,
              icon: FileText,
              colour: "#93c5fd",
            },
            {
              label: "Emergency Enabled",
              value: activePeople.filter(
                (person) => person.emergency_access_enabled
              ).length,
              icon: ShieldCheck,
              colour: "#fcd34d",
            },
            {
              label: "Revoked",
              value: revokedPeople.length,
              icon: UsersRound,
              colour: "#fca5a5",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                style={{
                  padding: "18px",
                  borderRadius: "18px",
                  background: "rgba(15,23,42,0.82)",
                  border: "1px solid rgba(148,163,184,0.14)",
                }}
              >
                <Icon size={21} color={item.colour} />
                <div
                  style={{
                    marginTop: "14px",
                    color: "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "28px",
                    fontWeight: 950,
                  }}
                >
                  {item.value}
                </div>
              </div>
            );
          })}
        </section>

        {successMessage && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(22,101,52,0.18)",
              border: "1px solid rgba(134,239,172,0.22)",
              color: "#bbf7d0",
              display: "flex",
              alignItems: "center",
              gap: "9px",
            }}
          >
            <CheckCircle2 size={18} />
            {successMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(127,29,29,0.18)",
              border: "1px solid rgba(248,113,113,0.23)",
              color: "#fecaca",
              display: "flex",
              alignItems: "flex-start",
              gap: "9px",
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <section
          style={{
            marginTop: "22px",
            padding: "18px",
            borderRadius: "18px",
            background:
              "linear-gradient(135deg, rgba(30,64,175,0.22), rgba(8,47,73,0.16))",
            border: "1px solid rgba(103,232,249,0.18)",
            display: "flex",
            alignItems: "flex-start",
            gap: "13px",
          }}
        >
          <ShieldCheck size={22} color="#67e8f9" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 900 }}>Mira Secure Access</div>
            <p
              style={{
                margin: "6px 0 0",
                color: "#bae6fd",
                fontSize: "13px",
                lineHeight: 1.65,
              }}
            >
              Trusted people receive only the documents you select. Owner
              controls remain in your account, and revoked access is blocked
              immediately.
            </p>
          </div>
        </section>

        <section style={{ marginTop: "22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "21px" }}>Access List</h2>
              <p
                style={{
                  margin: "5px 0 0",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Review active, temporary, emergency and revoked access.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 12px",
                borderRadius: "11px",
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15,23,42,0.6)",
                color: "#cbd5e1",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gap: "13px",
            }}
          >
            {trustedPeople.length === 0 ? (
              <div
                style={{
                  padding: "42px 20px",
                  borderRadius: "20px",
                  background: "rgba(15,23,42,0.76)",
                  border: "1px solid rgba(148,163,184,0.14)",
                  textAlign: "center",
                }}
              >
                <UserRound size={34} color="#64748b" />
                <h3 style={{ margin: "14px 0 7px" }}>
                  No trusted people added
                </h3>
                <p style={{ margin: 0, color: "#94a3b8" }}>
                  Add a family member, driver or emergency contact.
                </p>
              </div>
            ) : (
              trustedPeople.map((person) => {
                const accessPermissions = personPermissions(person.id);
                const assignedVehicleIds = Array.from(
                  new Set(
                    accessPermissions
                      .map((permission) => permission.vehicle_id)
                      .filter((id): id is number => id !== null)
                  )
                );
                const expanded = expandedPersonId === person.id;
                const expired =
                  person.access_expires_at !== null &&
                  new Date(person.access_expires_at).getTime() < Date.now();
                const active = person.is_active && !expired;

                return (
                  <article
                    key={person.id}
                    style={{
                      borderRadius: "19px",
                      background: "rgba(15,23,42,0.84)",
                      border: active
                        ? "1px solid rgba(134,239,172,0.16)"
                        : "1px solid rgba(248,113,113,0.18)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPersonId(expanded ? null : person.id)
                      }
                      style={{
                        width: "100%",
                        padding: "18px",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "14px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "13px",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: "46px",
                            height: "46px",
                            borderRadius: "15px",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                            background: active
                              ? "rgba(22,163,74,0.15)"
                              : "rgba(127,29,29,0.16)",
                            color: active ? "#86efac" : "#fca5a5",
                          }}
                        >
                          <UserRoundCheck size={22} />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 950,
                            }}
                          >
                            {person.full_name}
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              color: "#94a3b8",
                              fontSize: "12px",
                            }}
                          >
                            {person.relationship} ·{" "}
                            {accessPermissions.length} document
                            {accessPermissions.length === 1 ? "" : "s"} ·{" "}
                            {assignedVehicleIds.length} vehicle
                            {assignedVehicleIds.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            padding: "6px 9px",
                            borderRadius: "999px",
                            background: active
                              ? "rgba(22,163,74,0.15)"
                              : "rgba(127,29,29,0.18)",
                            color: active ? "#86efac" : "#fca5a5",
                            fontSize: "11px",
                            fontWeight: 900,
                          }}
                        >
                          {active ? "ACTIVE" : expired ? "EXPIRED" : "REVOKED"}
                        </span>
                        <ChevronDown
                          size={18}
                          style={{
                            transform: expanded
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                          }}
                        />
                      </div>
                    </button>

                    {expanded && (
                      <div
                        style={{
                          padding: "0 18px 18px",
                          borderTop: "1px solid rgba(148,163,184,0.1)",
                        }}
                      >
                        <div
                          style={{
                            paddingTop: "17px",
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(210px, 1fr))",
                            gap: "11px",
                          }}
                        >
                          <Info
                            icon={Phone}
                            label="Mobile"
                            value={person.mobile_number}
                          />
                          <Info
                            icon={Mail}
                            label="Email"
                            value={person.email || "Not provided"}
                          />
                          <Info
                            icon={ShieldCheck}
                            label="Permission"
                            value={
                              person.permission_level === "download"
                                ? "View & Download"
                                : "View Only"
                            }
                          />
                          <Info
                            icon={CalendarClock}
                            label="Access Expiry"
                            value={
                              person.access_type === "temporary"
                                ? formatDateTime(person.access_expires_at)
                                : "Permanent access"
                            }
                          />
                        </div>

                        {person.emergency_access_enabled && (
                          <div
                            style={{
                              marginTop: "13px",
                              padding: "12px",
                              borderRadius: "13px",
                              background: "rgba(120,53,15,0.17)",
                              border: "1px solid rgba(253,224,71,0.17)",
                              color: "#fde68a",
                              fontSize: "12px",
                              fontWeight: 800,
                            }}
                          >
                            Emergency access is enabled for this person.
                          </div>
                        )}

                        <div style={{ marginTop: "15px" }}>
                          <div
                            style={{
                              color: "#cbd5e1",
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            Shared documents
                          </div>

                          <div
                            style={{
                              marginTop: "9px",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "7px",
                            }}
                          >
                            {accessPermissions.map((permission) => {
                              const document = documents.find(
                                (item) => item.id === permission.document_id
                              );

                              return (
                                <span
                                  key={permission.id}
                                  style={{
                                    padding: "7px 9px",
                                    borderRadius: "9px",
                                    background: "rgba(37,99,235,0.11)",
                                    border:
                                      "1px solid rgba(96,165,250,0.15)",
                                    color: "#bfdbfe",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                  }}
                                >
                                  {document?.document_type ||
                                    document?.document_name ||
                                    "Vehicle Document"}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: "17px",
                            display: "flex",
                            gap: "9px",
                            flexWrap: "wrap",
                          }}
                        >
                          {person.is_active ? (
                            <button
                              type="button"
                              onClick={() => revokeAccess(person)}
                              disabled={workingPersonId !== null}
                              style={{
                                padding: "10px 13px",
                                borderRadius: "11px",
                                border:
                                  "1px solid rgba(248,113,113,0.22)",
                                background: "rgba(127,29,29,0.15)",
                                color: "#fca5a5",
                                fontWeight: 900,
                                cursor:
                                  workingPersonId !== null
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              {workingPersonId === person.id
                                ? "Processing..."
                                : "Revoke Access"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreAccess(person)}
                              disabled={workingPersonId !== null}
                              style={{
                                padding: "10px 13px",
                                borderRadius: "11px",
                                border:
                                  "1px solid rgba(134,239,172,0.22)",
                                background: "rgba(22,101,52,0.15)",
                                color: "#86efac",
                                fontWeight: 900,
                                cursor:
                                  workingPersonId !== null
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              {workingPersonId === person.id
                                ? "Processing..."
                                : "Restore Access"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => deleteTrustedPerson(person)}
                            disabled={workingPersonId !== null}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "7px",
                              padding: "10px 13px",
                              borderRadius: "11px",
                              border: "1px solid rgba(148,163,184,0.18)",
                              background: "transparent",
                              color: "#cbd5e1",
                              fontWeight: 900,
                              cursor:
                                workingPersonId !== null
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            <Trash2 size={16} />
                            Delete Person
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {showForm && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              resetForm();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            padding: "18px",
            background: "rgba(2,6,23,0.82)",
            backdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            overflowY: "auto",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Add trusted person"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              borderRadius: "22px",
              background:
                "linear-gradient(145deg, rgba(15,23,42,0.99), rgba(7,20,38,0.99))",
              border: "1px solid rgba(148,163,184,0.18)",
              boxShadow: "0 30px 100px rgba(0,0,0,0.55)",
            }}
          >
            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid rgba(148,163,184,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "22px" }}>
                  Add Trusted Person
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  Select exactly who, what vehicle and which documents.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                aria-label="Close"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "transparent",
                  color: "#cbd5e1",
                  display: "grid",
                  placeItems: "center",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                <X size={19} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "13px",
                }}
              >
                <Field
                  label="Full Name"
                  value={form.fullName}
                  placeholder="Example: Priya Kumar"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      fullName: value,
                    }))
                  }
                />

                <Field
                  label="Mobile Number"
                  value={form.mobileNumber}
                  placeholder="+91 98765 43210"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      mobileNumber: value,
                    }))
                  }
                />

                <Field
                  label="Email (Optional)"
                  value={form.email}
                  placeholder="name@example.com"
                  type="email"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      email: value,
                    }))
                  }
                />

                <SelectField
                  label="Relationship"
                  value={form.relationship}
                  options={[
                    "Family",
                    "Wife",
                    "Husband",
                    "Son",
                    "Daughter",
                    "Brother",
                    "Sister",
                    "Friend",
                    "Driver",
                    "Employee",
                    "Other",
                  ]}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      relationship: value,
                    }))
                  }
                />

                <SelectField
                  label="Permission"
                  value={form.permissionLevel}
                  options={[
                    { value: "view", label: "View Only" },
                    {
                      value: "download",
                      label: "View & Download",
                    },
                  ]}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      permissionLevel: value as "view" | "download",
                    }))
                  }
                />

                <SelectField
                  label="Access Type"
                  value={form.accessType}
                  options={[
                    { value: "permanent", label: "Permanent" },
                    { value: "temporary", label: "Temporary" },
                  ]}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      accessType: value as "permanent" | "temporary",
                    }))
                  }
                />

                {form.accessType === "temporary" && (
                  <SelectField
                    label="Temporary Duration"
                    value={form.temporaryDuration}
                    options={[
                      { value: "1-hour", label: "1 Hour" },
                      { value: "24-hours", label: "24 Hours" },
                      { value: "7-days", label: "7 Days" },
                      { value: "30-days", label: "30 Days" },
                    ]}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        temporaryDuration:
                          value as FormState["temporaryDuration"],
                      }))
                    }
                  />
                )}
              </div>

              <label
                style={{
                  marginTop: "17px",
                  padding: "14px",
                  borderRadius: "14px",
                  background: "rgba(120,53,15,0.14)",
                  border: "1px solid rgba(253,224,71,0.16)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "11px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.emergencyAccessEnabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      emergencyAccessEnabled: event.target.checked,
                    }))
                  }
                  style={{
                    width: "18px",
                    height: "18px",
                    marginTop: "1px",
                  }}
                />
                <span>
                  <strong style={{ color: "#fde68a" }}>
                    Enable Emergency Access
                  </strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#d6d3d1",
                      fontSize: "12px",
                      lineHeight: 1.55,
                    }}
                  >
                    Marks this person as eligible for the future Mira SOS
                    emergency-sharing flow.
                  </span>
                </span>
              </label>

              <div style={{ marginTop: "20px" }}>
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  1. Select Vehicles
                </h3>

                <div
                  style={{
                    marginTop: "10px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "9px",
                  }}
                >
                  {vehicles.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                      Add a vehicle before creating trusted access.
                    </div>
                  ) : (
                    vehicles.map((vehicle) => {
                      const selected = selectedVehicleIds.includes(vehicle.id);

                      return (
                        <SelectionCard
                          key={vehicle.id}
                          selected={selected}
                          title={vehicleLabel(vehicle)}
                          subtitle="Vehicle"
                          onClick={() => toggleVehicle(vehicle.id)}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ marginTop: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px" }}>
                      2. Select Documents
                    </h3>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "#94a3b8",
                        fontSize: "12px",
                      }}
                    >
                      Only documents belonging to selected vehicles appear.
                    </p>
                  </div>

                  {availableDocuments.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllAvailableDocuments}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "9px",
                        border: "1px solid rgba(96,165,250,0.18)",
                        background: "rgba(37,99,235,0.1)",
                        color: "#bfdbfe",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 850,
                      }}
                    >
                      {availableDocuments.every((document) =>
                        selectedDocumentIds.includes(document.id)
                      )
                        ? "Clear All"
                        : "Select All"}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "9px",
                  }}
                >
                  {selectedVehicleIds.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Select a vehicle first.
                    </div>
                  ) : availableDocuments.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                      No documents are available for the selected vehicle.
                    </div>
                  ) : (
                    availableDocuments.map((document) => {
                      const selected = selectedDocumentIds.includes(document.id);
                      const vehicle = vehicles.find(
                        (item) => item.id === document.vehicle_id
                      );

                      return (
                        <SelectionCard
                          key={document.id}
                          selected={selected}
                          title={
                            document.document_type ||
                            document.document_name ||
                            "Vehicle Document"
                          }
                          subtitle={
                            vehicle?.vehicle_number ||
                            document.document_number ||
                            "Document"
                          }
                          onClick={() => toggleDocument(document.id)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "17px 20px",
                borderTop: "1px solid rgba(148,163,184,0.12)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "9px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{
                  padding: "11px 14px",
                  borderRadius: "11px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "transparent",
                  color: "#cbd5e1",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveTrustedPerson}
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 15px",
                  borderRadius: "11px",
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Check size={17} />
                )}
                {saving ? "Saving Access..." : "Save Trusted Access"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "13px",
        background: "rgba(2,6,23,0.36)",
        border: "1px solid rgba(148,163,184,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          color: "#64748b",
          fontSize: "11px",
          fontWeight: 850,
        }}
      >
        <Icon size={14} />
        {label}
      </div>
      <div
        style={{
          marginTop: "7px",
          color: "#e2e8f0",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span
        style={{
          display: "block",
          marginBottom: "7px",
          color: "#cbd5e1",
          fontSize: "12px",
          fontWeight: 850,
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          padding: "12px 13px",
          borderRadius: "11px",
          border: "1px solid rgba(148,163,184,0.18)",
          background: "rgba(2,6,23,0.5)",
          color: "white",
          outline: "none",
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span
        style={{
          display: "block",
          marginBottom: "7px",
          color: "#cbd5e1",
          fontSize: "12px",
          fontWeight: 850,
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          padding: "12px 13px",
          borderRadius: "11px",
          border: "1px solid rgba(148,163,184,0.18)",
          background: "#071426",
          color: "white",
          outline: "none",
        }}
      >
        {options.map((option) => {
          const value =
            typeof option === "string" ? option : option.value;
          const optionLabel =
            typeof option === "string" ? option : option.label;

          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function SelectionCard({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px",
        borderRadius: "13px",
        border: selected
          ? "1px solid rgba(96,165,250,0.58)"
          : "1px solid rgba(148,163,184,0.14)",
        background: selected
          ? "rgba(37,99,235,0.14)"
          : "rgba(2,6,23,0.38)",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "27px",
          height: "27px",
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          background: selected ? "#2563eb" : "rgba(148,163,184,0.1)",
          color: selected ? "white" : "#64748b",
        }}
      >
        {selected ? <Check size={16} /> : <FileText size={15} />}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: "3px",
            color: "#94a3b8",
            fontSize: "10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </div>
      </div>
    </button>
  );
}