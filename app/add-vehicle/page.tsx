"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

type VehicleForm = {
  vehicle_name: string;
  vehicle_number: string;
  vehicle_type: string;
  brand: string;
  model: string;
  manufacturing_year: string;
  fuel_type: string;
  colour: string;
  chassis_number: string;
  engine_number: string;
  purchase_date: string;
};

const initialForm: VehicleForm = {
  vehicle_name: "",
  vehicle_number: "",
  vehicle_type: "",
  brand: "",
  model: "",
  manufacturing_year: "",
  fuel_type: "",
  colour: "",
  chassis_number: "",
  engine_number: "",
  purchase_date: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

export default function AddVehiclePage() {
  const router = useRouter();

  const [form, setForm] =
    useState<VehicleForm>(initialForm);

  const [selectedImage, setSelectedImage] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [uploadingImage, setUploadingImage] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState("");

  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo(
    () =>
      Array.from(
        { length: 50 },
        (_, index) =>
          currentYear + 1 - index
      ),
    [currentYear]
  );

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrorMessage("");
  }

  function handleImageSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(file.type)
    ) {
      setErrorMessage(
        "Please select a JPG, PNG or WEBP image."
      );
      event.target.value = "";
      return;
    }

    const maximumSize =
      5 * 1024 * 1024;

    if (file.size > maximumSize) {
      setErrorMessage(
        "Vehicle image must be smaller than 5 MB."
      );
      event.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedImage(file);
    setImagePreview(
      URL.createObjectURL(file)
    );
    setErrorMessage("");
  }

  function removeSelectedImage() {
    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedImage(null);
    setImagePreview("");
  }

  function validateForm() {
    if (
      !form.vehicle_name.trim()
    ) {
      return "Vehicle name is required.";
    }

    if (
      !form.vehicle_number.trim()
    ) {
      return "Registration number is required.";
    }

    if (!form.vehicle_type) {
      return "Select a vehicle type.";
    }

    if (!form.brand.trim()) {
      return "Brand is required.";
    }

    if (!form.model.trim()) {
      return "Model is required.";
    }

    if (!form.colour.trim()) {
      return "Vehicle colour is required.";
    }

    if (
      form.manufacturing_year &&
      Number(
        form.manufacturing_year
      ) >
        currentYear + 1
    ) {
      return "Manufacturing year is invalid.";
    }

    return "";
  }

  async function uploadVehicleImage(
    userId: string
  ) {
    if (!selectedImage) {
      return null;
    }

    setUploadingImage(true);
    setStatusMessage(
      "Uploading vehicle reference photo..."
    );

    try {
      const extension =
        selectedImage.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const fileName = `${crypto.randomUUID()}.${extension}`;

      const storagePath = `${userId}/${fileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from("vehicle-images")
          .upload(
            storagePath,
            selectedImage,
            {
              cacheControl:
                "3600",
              upsert: false,
              contentType:
                selectedImage.type,
            }
          );

      if (uploadError) {
        throw new Error(
          uploadError.message
        );
      }

      const { data } =
        supabase.storage
          .from("vehicle-images")
          .getPublicUrl(
            storagePath
          );

      return data.publicUrl;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setErrorMessage(
        validationError
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setStatusMessage(
      "Saving vehicle..."
    );

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.user ||
        !session.access_token
      ) {
        throw new Error(
          "Please sign in before adding a vehicle."
        );
      }

      const uploadedImageUrl =
        await uploadVehicleImage(
          session.user.id
        );

      const vehiclePayload = {
        user_id:
          session.user.id,
        vehicle_name:
          form.vehicle_name.trim(),
        vehicle_number:
          form.vehicle_number
            .trim()
            .toUpperCase(),
        vehicle_type:
          form.vehicle_type,
        image_url:
          uploadedImageUrl,
        generated_image_url:
          null,
        brand:
          form.brand.trim(),
        model:
          form.model.trim(),
        manufacturing_year:
          form.manufacturing_year
            ? Number(
                form.manufacturing_year
              )
            : null,
        fuel_type:
          form.fuel_type ||
          null,
        colour:
          form.colour.trim(),
        chassis_number:
          form.chassis_number
            .trim()
            .toUpperCase() ||
          null,
        engine_number:
          form.engine_number
            .trim()
            .toUpperCase() ||
          null,
        purchase_date:
          form.purchase_date ||
          null,
      };

      const {
        data,
        error,
      } = await supabase
        .from("vehicles")
        .insert(vehiclePayload)
        .select("id")
        .single();

      if (error) {
        throw new Error(
          error.message
        );
      }

      setStatusMessage(
        "Vehicle saved. Preparing your premium image in the background..."
      );

      router.push(
        `/vehicle/${data.id}`
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the vehicle."
      );
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  }

  const busy =
    saving ||
    uploadingImage ||
    false;

  const submitLabel =
    uploadingImage
      ? "Uploading Photo..."
      : saving
          ? "Saving Vehicle..."
          : "Save Vehicle";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              My Vehicle
            </p>

            <h1 className="text-2xl font-bold text-slate-900">
              Add New Vehicle
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            disabled={busy}
            className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-7 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-7 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Vehicle Profile
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Add your vehicle information
          </h2>

          <p className="mt-2 max-w-2xl text-white/80">
            Brand, model, colour and registration number are used to generate
            the premium dashboard vehicle image.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {statusMessage &&
          busy && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 font-medium text-blue-700">
              {statusMessage}
            </div>
          )}

        <form
          onSubmit={
            handleSubmit
          }
          className="overflow-hidden rounded-3xl border bg-white shadow-sm"
        >
          <FormSection
            title="Basic Information"
            description="Enter the main identity details of your vehicle."
          >
            <FormField
              label="Vehicle Name"
              required
            >
              <input
                type="text"
                value={
                  form.vehicle_name
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "vehicle_name",
                    event.target
                      .value
                  )
                }
                placeholder="Example: My BMW"
                className={
                  inputClass
                }
              />
            </FormField>

            <FormField
              label="Registration Number"
              required
            >
              <input
                type="text"
                value={
                  form.vehicle_number
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "vehicle_number",
                    event.target
                      .value
                  )
                }
                placeholder="Example: KA03HF3478"
                className={`${inputClass} uppercase`}
              />
            </FormField>

            <FormField
              label="Vehicle Type"
              required
            >
              <select
                value={
                  form.vehicle_type
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "vehicle_type",
                    event.target
                      .value
                  )
                }
                className={
                  inputClass
                }
              >
                <option value="">
                  Select vehicle type
                </option>
                <option value="Car">
                  Car
                </option>
                <option value="Bike">
                  Bike
                </option>
                <option value="Scooter">
                  Scooter
                </option>
                <option value="Auto Rickshaw">
                  Auto Rickshaw
                </option>
                <option value="Truck">
                  Truck
                </option>
                <option value="Bus">
                  Bus
                </option>
                <option value="Van">
                  Van
                </option>
                <option value="Tractor">
                  Tractor
                </option>
                <option value="Commercial Vehicle">
                  Commercial Vehicle
                </option>
                <option value="Other">
                  Other
                </option>
              </select>
            </FormField>

            <FormField label="Reference Photo">
              <label
                className={`flex min-h-36 items-center justify-center rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${
                  busy
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                    : "cursor-pointer border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50"
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={
                    handleImageSelection
                  }
                  className="hidden"
                />

                <span>
                  <span className="block text-4xl">
                    📷
                  </span>

                  <span className="mt-2 block font-semibold text-slate-900">
                    Choose reference photo
                  </span>

                  <span className="mt-1 block text-sm text-slate-500">
                    Optional · Not shown on dashboard
                  </span>
                </span>
              </label>
            </FormField>
          </FormSection>

          {imagePreview && (
            <div className="border-b bg-slate-50 p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900">
                    Reference Photo Preview
                  </h3>

                  <p className="text-sm text-slate-500">
                    {
                      selectedImage?.name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    removeSelectedImage
                  }
                  disabled={busy}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <div className="h-72 overflow-hidden rounded-2xl border bg-white">
                <img
                  src={
                    imagePreview
                  }
                  alt="Selected vehicle reference"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          <FormSection
            title="Vehicle Specifications"
            description="Brand, model and colour are required for premium image generation."
          >
            <FormField
              label="Brand"
              required
            >
              <input
                type="text"
                value={
                  form.brand
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "brand",
                    event.target
                      .value
                  )
                }
                placeholder="Example: Tata, BMW, Honda"
                className={
                  inputClass
                }
              />
            </FormField>

            <FormField
              label="Model"
              required
            >
              <input
                type="text"
                value={
                  form.model
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "model",
                    event.target
                      .value
                  )
                }
                placeholder="Example: Nexon, X5, Activa"
                className={
                  inputClass
                }
              />
            </FormField>

            <FormField label="Manufacturing Year">
              <select
                value={
                  form.manufacturing_year
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "manufacturing_year",
                    event.target
                      .value
                  )
                }
                className={
                  inputClass
                }
              >
                <option value="">
                  Select year
                </option>

                {yearOptions.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Fuel Type">
              <select
                value={
                  form.fuel_type
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "fuel_type",
                    event.target
                      .value
                  )
                }
                className={
                  inputClass
                }
              >
                <option value="">
                  Select fuel type
                </option>
                <option value="Petrol">
                  Petrol
                </option>
                <option value="Diesel">
                  Diesel
                </option>
                <option value="Electric">
                  Electric
                </option>
                <option value="Hybrid">
                  Hybrid
                </option>
                <option value="CNG">
                  CNG
                </option>
                <option value="LPG">
                  LPG
                </option>
                <option value="Hydrogen">
                  Hydrogen
                </option>
                <option value="Other">
                  Other
                </option>
              </select>
            </FormField>

            <FormField
              label="Vehicle Colour"
              required
            >
              <input
                type="text"
                value={
                  form.colour
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "colour",
                    event.target
                      .value
                  )
                }
                placeholder="Example: Alpine White"
                className={
                  inputClass
                }
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Ownership and Identification"
            description="Add identification numbers and purchase details."
          >
            <FormField label="Chassis / VIN Number">
              <input
                type="text"
                value={
                  form.chassis_number
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "chassis_number",
                    event.target
                      .value
                  )
                }
                placeholder="Enter chassis or VIN number"
                className={`${inputClass} uppercase`}
              />
            </FormField>

            <FormField label="Engine Number">
              <input
                type="text"
                value={
                  form.engine_number
                }
                disabled={busy}
                onChange={(
                  event
                ) =>
                  updateField(
                    "engine_number",
                    event.target
                      .value
                  )
                }
                placeholder="Enter engine number"
                className={`${inputClass} uppercase`}
              />
            </FormField>

            <FormField label="Purchase Date">
              <input
                type="date"
                value={
                  form.purchase_date
                }
                disabled={busy}
                max={
                  new Date()
                    .toISOString()
                    .split("T")[0]
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "purchase_date",
                    event.target
                      .value
                  )
                }
                className={
                  inputClass
                }
              />
            </FormField>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 border-t bg-slate-50 p-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push("/")
              }
              disabled={busy}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
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
    <div className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </div>
  );
}