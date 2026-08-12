"use client";

import {
  ArrowLeft,
  Building2,
  Clock3,
  MapPin,
  Phone,
  Save,
  Settings,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../supabase";

type WorkshopMember = {
  workshop_id: string;
  role: string;
};

type WorkshopSettings = {
  id: string;
  workshop_name: string;
  phone: string;
  address: string;
  opening_time: string;
  closing_time: string;
  service_modes: string[];
  is_open: boolean;
};

const SERVICE_MODES = [
  "General Service",
  "Periodic Service",
  "Repair",
  "Inspection",
  "Tyre Service",
  "Battery Service",
  "Electrical",
  "AC Service",
];

export default function WorkshopSettingsPage() {
  const router = useRouter();

  const [workshopId, setWorkshopId] = useState("");
  const [role, setRole] = useState("");

  const [workshopName, setWorkshopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("18:00");

  const [serviceModes, setServiceModes] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from("workshop_members")
        .select("workshop_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!member) {
        setMessage("This account is not linked to an active workshop.");
        return;
      }

      const membership = member as WorkshopMember;

      setWorkshopId(membership.workshop_id);
      setRole(membership.role || "");

      /*
       * We keep workshop profile/settings in a separate simple table.
       *
       * If there is no record yet, the page will still work and the
       * first Save will create it.
       */
      const { data, error } = await supabase
        .from("workshop_settings")
        .select(
          `
          id,
          workshop_name,
          phone,
          address,
          opening_time,
          closing_time,
          service_modes,
          is_open
        `
        )
        .eq("id", membership.workshop_id)
        .maybeSingle();

      if (error) {
        /*
         * If the table has not been created yet, show a useful message
         * instead of crashing the whole page.
         */
        console.error("Workshop settings load error:", error);

        setMessage(
          "Workshop settings database is not ready yet. Create the workshop_settings table first."
        );

        return;
      }

      if (data) {
        const settings = data as WorkshopSettings;

        setWorkshopName(settings.workshop_name || "");
        setPhone(settings.phone || "");
        setAddress(settings.address || "");

        setOpeningTime(settings.opening_time || "09:00");
        setClosingTime(settings.closing_time || "18:00");

        setServiceModes(
          Array.isArray(settings.service_modes)
            ? settings.service_modes
            : []
        );

        setIsOpen(settings.is_open ?? true);
      }
    } catch (error) {
      console.error("Workshop settings error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load workshop settings."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function toggleServiceMode(mode: string) {
    setServiceModes((current) => {
      if (current.includes(mode)) {
        return current.filter((item) => item !== mode);
      }

      return [...current, mode];
    });
  }

  async function saveSettings() {
    if (!workshopId) {
      window.alert("Workshop ID is missing.");
      return;
    }

    if (!workshopName.trim()) {
      window.alert("Please enter workshop name.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        id: workshopId,
        workshop_name: workshopName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        opening_time: openingTime,
        closing_time: closingTime,
        service_modes: serviceModes,
        is_open: isOpen,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("workshop_settings")
        .upsert(payload, {
          onConflict: "id",
        });

      if (error) throw error;

      window.alert("Workshop settings saved successfully.");
    } catch (error) {
      console.error("Workshop settings save error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to save workshop settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />

            <p className="mt-4 text-sm font-bold text-slate-400">
              Loading workshop settings...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* HEADER */}

        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <button
            type="button"
            onClick={() => router.push("/workshop")}
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-300 transition hover:text-white"
          >
            <ArrowLeft size={17} />

            Workshop Dashboard
          </button>

          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
              <Settings size={23} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Workshop Operations
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Workshop Settings
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage the essential information customers and workshop staff
                need.
              </p>

              {workshopId ? (
                <p className="mt-3 text-xs font-bold text-slate-600">
                  Workshop ID: {workshopId}
                  {role ? ` • ${role}` : ""}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {message ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
            {message}
          </section>
        ) : null}

        {/* BASIC INFORMATION */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
          <SectionHeading
            icon={<Building2 size={21} />}
            eyebrow="Workshop Profile"
            title="Basic Information"
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Workshop Name">
              <input
                value={workshopName}
                onChange={(event) =>
                  setWorkshopName(event.target.value)
                }
                placeholder="Example: Bosch Car Service – AutoCare"
                className={inputClass}
              />
            </Field>

            <Field label="Phone">
              <div className="relative">
                <Phone
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+91 98765 43210"
                  className={`${inputClass} pl-11`}
                />
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Workshop Address">
              <div className="relative">
                <MapPin
                  size={18}
                  className="absolute left-4 top-4 text-slate-500"
                />

                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Workshop complete address"
                  rows={4}
                  className={`${inputClass} resize-none pl-11`}
                />
              </div>
            </Field>
          </div>
        </section>

        {/* WORKING HOURS */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
          <SectionHeading
            icon={<Clock3 size={21} />}
            eyebrow="Availability"
            title="Working Hours"
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Opening Time">
              <input
                type="time"
                value={openingTime}
                onChange={(event) =>
                  setOpeningTime(event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Closing Time">
              <input
                type="time"
                value={closingTime}
                onChange={(event) =>
                  setClosingTime(event.target.value)
                }
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {/* SERVICE MODES */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
          <SectionHeading
            icon={<Wrench size={21} />}
            eyebrow="Services"
            title="Service Modes"
          />

          <p className="mt-2 text-sm text-slate-500">
            Select the main services this workshop provides.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE_MODES.map((mode) => {
              const selected = serviceModes.includes(mode);

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleServiceMode(mode)}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm font-black transition ${
                    selected
                      ? "border-blue-400/40 bg-blue-500/15 text-blue-100"
                      : "border-white/10 bg-slate-950/40 text-slate-400 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        selected
                          ? "bg-blue-400"
                          : "bg-slate-700"
                      }`}
                    />

                    {mode}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* OPEN / CLOSED */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                Workshop Status
              </p>

              <h2 className="mt-2 text-xl font-black">
                {isOpen
                  ? "Workshop is Open"
                  : "Workshop is Closed"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Customers can see the current workshop availability.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              className={`rounded-2xl border px-6 py-3 text-sm font-black transition ${
                isOpen
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-200"
              }`}
            >
              {isOpen ? "OPEN" : "CLOSED"}
            </button>
          </div>
        </section>

        {/* SAVE */}

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                Save Changes
              </p>

              <p className="mt-1 text-lg font-black">
                Update Workshop Profile
              </p>
            </div>

            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving || !workshopId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={17} />

              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>

      {children}
    </label>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/10 text-blue-300">
        {icon}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">
          {eyebrow}
        </p>

        <h2 className="mt-1 text-xl font-black">
          {title}
        </h2>
      </div>
    </div>
  );
}