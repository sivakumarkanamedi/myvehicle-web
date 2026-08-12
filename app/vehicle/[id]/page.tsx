"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../supabase";
import { resolveVehicleImage } from "../../lib/vehicleImageLibrary";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  image_url: string | null;
  generated_image_url: string | null;
  colour?: string | null;
  brand?: string | null;
  model?: string | null;
  manufacturing_year?: number | null;
  fuel_type?: string | null;
  odometer?: number | null;
  created_at?: string | null;
};

export default function VehicleDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) return;

    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Please sign in.");
      setVehicle(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      setErrorMessage(error.message);
      setVehicle(null);
    } else {
      setVehicle(data as Vehicle);
    }

    setLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);


  async function deleteVehicle() {
    if (!vehicle) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${
        vehicle.vehicle_name || "this vehicle"
      }?`
    );

    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicle.id)
      .eq("user_id", user?.id);

    if (error) {
      setErrorMessage(error.message);
      setDeleting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-6 h-12 w-40 rounded-xl bg-slate-200" />
          <div className="h-96 rounded-3xl bg-slate-200" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 rounded-2xl bg-slate-200"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!vehicle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
          <div className="text-6xl">🚗</div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Vehicle not found
          </h1>

          <p className="mt-3 text-slate-500">
            {errorMessage || "This vehicle may have been removed."}
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

  const details = [
    {
      label: "Vehicle Number",
      value: vehicle.vehicle_number || "Not provided",
      icon: "🔢",
    },
    {
      label: "Vehicle Type",
      value: vehicle.vehicle_type || "Not provided",
      icon: "🚘",
    },
    {
      label: "Brand",
      value: vehicle.brand || "Not added yet",
      icon: "🏷️",
    },
    {
      label: "Model",
      value: vehicle.model || "Not added yet",
      icon: "⚙️",
    },
    {
      label: "Manufacturing Year",
      value: vehicle.manufacturing_year?.toString() || "Not added yet",
      icon: "📅",
    },
    {
      label: "Fuel Type",
      value: vehicle.fuel_type || "Not added yet",
      icon: "⛽",
    },
    {
      label: "Colour",
      value: vehicle.colour || "Not added yet",
      icon: "🎨",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Dashboard
          </button>

          <div className="flex gap-3">
            <Link
              href={`/edit-vehicle?id=${vehicle.id}`}
              className="rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-white hover:bg-amber-600"
            >
              Edit
            </Link>

            <button
              type="button"
              onClick={deleteVehicle}
              disabled={deleting}
              className="rounded-xl bg-red-500 px-5 py-2.5 font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-slate-200">
            <img
              src={resolveVehicleImage({
                brand: vehicle.brand,
                model: vehicle.model,
                colour: vehicle.colour,
                vehicleType: vehicle.vehicle_type,
                vehicleNumber: vehicle.vehicle_number,
                generatedImageUrl: vehicle.generated_image_url,
              })}
              alt={
                [vehicle.brand, vehicle.model]
                  .filter(Boolean)
                  .join(" ") || "Vehicle"
              }
              className="h-[420px] w-full object-contain p-5"
            />

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-7 pb-7 pt-24 text-white">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-white/70">
                    My Vehicle
                  </p>

                  <h1 className="text-4xl font-bold">
                    {vehicle.vehicle_name || "Unnamed Vehicle"}
                  </h1>

                  <p className="mt-2 text-xl text-white/90">
                    {vehicle.vehicle_number || "Number not provided"}
                  </p>
                </div>

                <span className="rounded-full bg-white/20 px-5 py-2 font-semibold backdrop-blur">
                  {vehicle.vehicle_type || "Vehicle"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="text-3xl">{detail.icon}</div>

              <p className="mt-4 text-sm font-medium text-slate-500">
                {detail.label}
              </p>

              <p className="mt-1 break-words text-lg font-bold text-slate-900">
                {detail.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          <section className="rounded-3xl border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Vehicle Overview
                </h2>
                <p className="mt-1 text-slate-500">
                  Important information and upcoming vehicle services.
                </p>
              </div>

              <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
                Active
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <StatusCard
                title="RC Status"
                description="Add your RC document"
                status="Not uploaded"
                icon="📄"
              />

              <StatusCard
                title="Insurance"
                description="Add insurance details"
                status="Not uploaded"
                icon="🛡️"
              />

              <StatusCard
                title="PUC Certificate"
                description="Add emission certificate"
                status="Not uploaded"
                icon="🌿"
              />

              <StatusCard
                title="Service Due"
                description="Add service schedule"
                status="Not scheduled"
                icon="🔧"
              />
            </div>
          </section>

          <aside className="rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
              Mira AI
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Ask Mira about this vehicle
            </h2>

            <p className="mt-3 text-white/80">
              Get vehicle insights, reminders and assistance from one place.
            </p>

            <button
              type="button"
              onClick={() => router.push("/mira")}
              className="mt-7 w-full rounded-xl bg-white px-5 py-3 font-bold text-purple-700 hover:bg-slate-100"
            >
              Ask Mira
            </button>
          </aside>
        </div>

        <section className="mt-7 rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Vehicle Modules
          </h2>

          <p className="mt-1 text-slate-500">
            Access the key modules connected to this vehicle.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ModuleCard
              icon="📁"
              title="Document Vault"
              description="RC, insurance, PUC and other files"
              onClick={() =>
                router.push(`/vehicle/${vehicle.id}/documents`)
              }
            />

            <ModuleCard
              icon="🛡️"
              title="Insurance"
              description="Policies, expiry and smart renewal"
              onClick={() =>
                router.push("/documents")
              }
            />

            <ModuleCard
              icon="⛽"
              title="Fuel & Expenses"
              description="Track fuel cost and vehicle spending"
              onClick={() =>
                router.push("/expenses")
              }
            />

            <ModuleCard
              icon="🔧"
              title="Service History"
              description="Maintenance records and reminders"
              onClick={() =>
                router.push("/service-history")
              }
            />

            <ModuleCard
              icon="🧾"
              title="Challans"
              description="Check and manage traffic challans"
              onClick={() =>
                router.push("/challans")
              }
            />

            <ModuleCard
              icon="📍"
              title="Live Location"
              description="Vehicle location and navigation"
              onClick={() =>
                router.push("/navigation")
              }
            />

            <ModuleCard
              icon="🤖"
              title="Ask Mira"
              description="AI help for this vehicle"
              onClick={() => router.push("/mira")}
            />

          </div>
        </section>
      </section>
    </main>
  );
}

function StatusCard({
  title,
  description,
  status,
  icon,
}: {
  title: string;
  description: string;
  status: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-3xl">{icon}</span>

        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          {status}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
    >
      <div className="text-4xl">{icon}</div>

      <h3 className="mt-4 font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>

      <p className="mt-4 text-sm font-semibold text-blue-600">
        Open →
      </p>
    </button>
  );
}