"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../supabase";

type VehicleForm = {
  vehicle_name: string;
  vehicle_number: string;
  vehicle_type: string;
  brand: string;
  model: string;
  manufacturing_year: string;
  fuel_type: string;
  odometer: string;
  color: string;
  chassis_number: string;
  engine_number: string;
  purchase_date: string;
};

type VehicleRecord = VehicleForm & {
  id: number;
  image_url: string | null;
};

const initialForm: VehicleForm = {
  vehicle_name: "",
  vehicle_number: "",
  vehicle_type: "",
  brand: "",
  model: "",
  manufacturing_year: "",
  fuel_type: "",
  odometer: "",
  color: "",
  chassis_number: "",
  engine_number: "",
  purchase_date: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

export default function EditVehiclePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get("id");

  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo(
    () =>
      Array.from(
        { length: 50 },
        (_, index) => currentYear + 1 - index
      ),
    [currentYear]
  );

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
      setErrorMessage("Please sign in.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      setErrorMessage(error?.message || "Vehicle not found.");
      setLoading(false);
      return;
    }

    const vehicle = data as VehicleRecord;

    setForm({
      vehicle_name: vehicle.vehicle_name || "",
      vehicle_number: vehicle.vehicle_number || "",
      vehicle_type: vehicle.vehicle_type || "",
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      manufacturing_year:
        vehicle.manufacturing_year?.toString() || "",
      fuel_type: vehicle.fuel_type || "",
      odometer: vehicle.odometer?.toString() || "",
      color: vehicle.color || "",
      chassis_number: vehicle.chassis_number || "",
      engine_number: vehicle.engine_number || "",
      purchase_date: vehicle.purchase_date || "",
    });

    setExistingImageUrl(vehicle.image_url || "");
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  function updateField(field: keyof VehicleForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Please select a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Vehicle image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
    setErrorMessage("");
  }

  function removeSelectedPhoto() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(null);
    setImagePreview("");
  }

  function removeCurrentPhoto() {
    removeSelectedPhoto();
    setExistingImageUrl("");
    setRemoveExistingImage(true);
  }

  function validateForm() {
    if (!form.vehicle_name.trim()) {
      return "Vehicle name is required.";
    }

    if (!form.vehicle_number.trim()) {
      return "Registration number is required.";
    }

    if (!form.vehicle_type) {
      return "Select a vehicle type.";
    }

    if (
      form.manufacturing_year &&
      Number(form.manufacturing_year) > currentYear + 1
    ) {
      return "Manufacturing year is invalid.";
    }

    if (form.odometer && Number(form.odometer) < 0) {
      return "Odometer cannot be negative.";
    }

    return "";
  }

  async function uploadVehicleImage() {
    if (!selectedImage) return null;

    setUploadingImage(true);

    try {
      const extension =
        selectedImage.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `${crypto.randomUUID()}.${extension}`;
      const storagePath = `vehicles/${fileName}`;

      const { error } = await supabase.storage
        .from("vehicle-images")
        .upload(storagePath, selectedImage, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedImage.type,
        });

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage
        .from("vehicle-images")
        .getPublicUrl(storagePath);

      return data.publicUrl;
    } finally {
      setUploadingImage(false);
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

    try {
      let finalImageUrl: string | null = existingImageUrl || null;

      if (selectedImage) {
        finalImageUrl = await uploadVehicleImage();
      } else if (removeExistingImage) {
        finalImageUrl = null;
      }

      const vehiclePayload = {
        vehicle_name: form.vehicle_name.trim(),
        vehicle_number: form.vehicle_number.trim().toUpperCase(),
        vehicle_type: form.vehicle_type,
        image_url: finalImageUrl,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        manufacturing_year: form.manufacturing_year
          ? Number(form.manufacturing_year)
          : null,
        fuel_type: form.fuel_type || null,
        odometer: form.odometer ? Number(form.odometer) : null,
        color: form.color.trim() || null,
        chassis_number:
          form.chassis_number.trim().toUpperCase() || null,
        engine_number:
          form.engine_number.trim().toUpperCase() || null,
        purchase_date: form.purchase_date || null,
      };

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("vehicles")
        .update(vehiclePayload)
        .eq("id", vehicleId)
        .eq("user_id", user?.id);

      if (error) {
        throw new Error(error.message);
      }

      router.push(`/vehicle/${vehicleId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the vehicle."
      );
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  }

  const busy = loading || saving || uploadingImage;
  const displayedImage = imagePreview || existingImageUrl;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-6xl">🚗</div>
          <p className="mt-4 font-semibold text-slate-600">
            Loading vehicle...
          </p>
        </div>
      </main>
    );
  }

  if (!vehicleId || (errorMessage && !form.vehicle_name)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Unable to load vehicle
          </h1>

          <p className="mt-3 text-red-600">{errorMessage}</p>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              My Vehicle
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Edit Vehicle
            </h1>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/vehicle/${vehicleId}`)}
            disabled={busy}
            className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Vehicle Details
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-7 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-7 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Vehicle Profile
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Update your vehicle information
          </h2>

          <p className="mt-2 text-white/80">
            Keep vehicle details accurate for reminders, documents and
            Mira AI assistance.
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
          <FormSection
            title="Basic Information"
            description="Update the identity details of your vehicle."
          >
            <FormField label="Vehicle Name" required>
              <input
                type="text"
                value={form.vehicle_name}
                disabled={busy}
                onChange={(event) =>
                  updateField("vehicle_name", event.target.value)
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Registration Number" required>
              <input
                type="text"
                value={form.vehicle_number}
                disabled={busy}
                onChange={(event) =>
                  updateField("vehicle_number", event.target.value)
                }
                className={`${inputClass} uppercase`}
              />
            </FormField>

            <FormField label="Vehicle Type" required>
              <select
                value={form.vehicle_type}
                disabled={busy}
                onChange={(event) =>
                  updateField("vehicle_type", event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select vehicle type</option>
                <option value="Car">Car</option>
                <option value="Bike">Bike</option>
                <option value="Scooter">Scooter</option>
                <option value="Auto Rickshaw">Auto Rickshaw</option>
                <option value="Truck">Truck</option>
                <option value="Bus">Bus</option>
                <option value="Van">Van</option>
                <option value="Tractor">Tractor</option>
                <option value="Commercial Vehicle">
                  Commercial Vehicle
                </option>
                <option value="Other">Other</option>
              </select>
            </FormField>

            <FormField label="Replace Vehicle Photo">
              <label className="flex min-h-36 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center hover:border-blue-500 hover:bg-blue-50">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={handleImageSelection}
                  className="hidden"
                />

                <span>
                  <span className="block text-4xl">📷</span>
                  <span className="mt-2 block font-semibold">
                    Choose a new photo
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    JPG, PNG or WEBP · Maximum 5 MB
                  </span>
                </span>
              </label>
            </FormField>
          </FormSection>

          {displayedImage && (
            <div className="border-b bg-slate-50 p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">
                    Vehicle Photo
                  </h3>

                  <p className="text-sm text-slate-500">
                    {selectedImage
                      ? "New photo selected"
                      : "Current vehicle photo"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={removeCurrentPhoto}
                  disabled={busy}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>

              <div className="h-72 overflow-hidden rounded-2xl border bg-white">
                <img
                  src={displayedImage}
                  alt="Vehicle"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          <FormSection
            title="Vehicle Specifications"
            description="Update brand, model and technical information."
          >
            <FormField label="Brand">
              <input
                type="text"
                value={form.brand}
                disabled={busy}
                onChange={(event) =>
                  updateField("brand", event.target.value)
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Model">
              <input
                type="text"
                value={form.model}
                disabled={busy}
                onChange={(event) =>
                  updateField("model", event.target.value)
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Manufacturing Year">
              <select
                value={form.manufacturing_year}
                disabled={busy}
                onChange={(event) =>
                  updateField("manufacturing_year", event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select year</option>

                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Fuel Type">
              <select
                value={form.fuel_type}
                disabled={busy}
                onChange={(event) =>
                  updateField("fuel_type", event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select fuel type</option>
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
                <option value="CNG">CNG</option>
                <option value="LPG">LPG</option>
                <option value="Hydrogen">Hydrogen</option>
                <option value="Other">Other</option>
              </select>
            </FormField>

            <FormField label="Current Odometer">
              <input
                type="number"
                min="0"
                value={form.odometer}
                disabled={busy}
                onChange={(event) =>
                  updateField("odometer", event.target.value)
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Vehicle Color">
              <input
                type="text"
                value={form.color}
                disabled={busy}
                onChange={(event) =>
                  updateField("color", event.target.value)
                }
                className={inputClass}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Ownership and Identification"
            description="Update identification and purchase details."
          >
            <FormField label="Chassis / VIN Number">
              <input
                type="text"
                value={form.chassis_number}
                disabled={busy}
                onChange={(event) =>
                  updateField("chassis_number", event.target.value)
                }
                className={`${inputClass} uppercase`}
              />
            </FormField>

            <FormField label="Engine Number">
              <input
                type="text"
                value={form.engine_number}
                disabled={busy}
                onChange={(event) =>
                  updateField("engine_number", event.target.value)
                }
                className={`${inputClass} uppercase`}
              />
            </FormField>

            <FormField label="Purchase Date">
              <input
                type="date"
                value={form.purchase_date}
                disabled={busy}
                max={new Date().toISOString().split("T")[0]}
                onChange={(event) =>
                  updateField("purchase_date", event.target.value)
                }
                className={inputClass}
              />
            </FormField>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 border-t bg-slate-50 p-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push(`/vehicle/${vehicleId}`)}
              disabled={busy}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {uploadingImage
                ? "Uploading Photo..."
                : saving
                  ? "Updating Vehicle..."
                  : "Update Vehicle"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b p-6 sm:p-8">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
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