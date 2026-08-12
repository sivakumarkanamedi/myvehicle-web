"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "../../../supabase";

function formatMode(mode: string) {
  return mode === "pickup-drop" ? "Pickup & Drop" : "Drive-in";
}

function formatDateLabel(date: string) {
  const labels: Record<string, string> = {
    today: "Today",
    tomorrow: "Tomorrow",
    "day-3": "Sunday",
    "day-4": "Monday",
    "day-5": "Tuesday",
  };

  return labels[date] || date || "Selected Date";
}

function formatTimeLabel(time: string) {
  const labels: Record<string, string> = {
    "09:00": "09:00 AM",
    "10:00": "10:00 AM",
    "11:00": "11:00 AM",
    "12:30": "12:30 PM",
    "14:00": "02:00 PM",
    "15:30": "03:30 PM",
    "17:00": "05:00 PM",
    "18:00": "06:00 PM",
  };

  return labels[time] || time || "Selected Time";
}

function dateParamToISO(dateParam: string) {
  const date = new Date();

  if (dateParam === "tomorrow") {
    date.setDate(date.getDate() + 1);
  } else if (dateParam === "day-3") {
    date.setDate(date.getDate() + 2);
  } else if (dateParam === "day-4") {
    date.setDate(date.getDate() + 3);
  } else if (dateParam === "day-5") {
    date.setDate(date.getDate() + 4);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getEstimatedCost(serviceName: string) {
  const name = serviceName.toLowerCase();

  if (name.includes("basic")) return "₹499 – ₹699";
  if (name.includes("standard")) return "₹799 – ₹1,099";
  if (name.includes("comprehensive")) return "₹1,299 – ₹1,799";
  if (name.includes("water wash")) return "From ₹149";
  if (name.includes("foam wash")) return "From ₹249";
  if (name.includes("detailing")) return "From ₹799";
  if (name.includes("breakdown")) return "From ₹299";
  if (name.includes("towing")) return "From ₹499";
  if (name.includes("flat tyre")) return "From ₹199";
  if (name.includes("jump start")) return "From ₹199";

  return "Inspection Required";
}

function getEstimatedDuration(serviceName: string) {
  const name = serviceName.toLowerCase();

  if (name.includes("basic")) return "Approx. 60–90 mins";
  if (name.includes("standard")) return "Approx. 90–120 mins";
  if (name.includes("comprehensive")) return "Approx. 2–3 hrs";
  if (name.includes("wash")) return "Approx. 20–45 mins";
  if (name.includes("detailing")) return "Approx. 2–3 hrs";

  if (
    name.includes("repair") ||
    name.includes("engine") ||
    name.includes("brake") ||
    name.includes("clutch") ||
    name.includes("electrical")
  ) {
    return "Estimate after inspection";
  }

  return "Depends on selected service";
}


async function resolveActiveVehicleId(userId: string) {
  const storageKeys = [
    "myvehicle.activeVehicleId",
    "activeVehicleId",
    "selectedVehicleId",
  ];

  let storedVehicleId: number | null = null;

  if (typeof window !== "undefined") {
    for (const key of storageKeys) {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? Number(raw) : NaN;

      if (Number.isFinite(parsed) && parsed > 0) {
        storedVehicleId = parsed;
        break;
      }
    }
  }

  // If the dashboard has already stored an active vehicle,
  // verify that it belongs to the logged-in user.
  if (storedVehicleId !== null) {
    const { data: storedVehicle, error: storedVehicleError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("user_id", userId)
      .eq("id", storedVehicleId)
      .maybeSingle();

    if (storedVehicleError) {
      throw storedVehicleError;
    }

    if (storedVehicle?.id) {
      window.localStorage.setItem(
        "myvehicle.activeVehicleId",
        String(storedVehicle.id)
      );

      return Number(storedVehicle.id);
    }
  }

  // Safe fallback for users who have not yet persisted a dashboard
  // selection: use their most recently added vehicle.
  const { data: fallbackVehicle, error: fallbackError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  if (!fallbackVehicle?.id) {
    return null;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      "myvehicle.activeVehicleId",
      String(fallbackVehicle.id)
    );
  }

  return Number(fallbackVehicle.id);
}

function createBookingNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = `${Date.now()}`.slice(-6);

  return `MV-${year}${month}${day}-${suffix}`;
}

export default function ReviewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("category") || "regular";
  const selectedService = searchParams.get("service") || "";
  const selectedServiceName =
    searchParams.get("serviceName") || "Selected Service";
  const selectedWorkshop = searchParams.get("workshop") || "";
  const selectedWorkshopName =
    searchParams.get("workshopName") || "Selected Workshop";
  const selectedDate = searchParams.get("date") || "";
  const selectedTime = searchParams.get("time") || "";
  const serviceMode = searchParams.get("mode") || "drive-in";
  const pickupAddress = searchParams.get("pickupAddress") || "";
  const pickupSlot = searchParams.get("pickupSlot") || "";
  const deliverySameAddress =
    searchParams.get("deliverySameAddress") !== "false";
  const deliveryAddress = searchParams.get("deliveryAddress") || "";
  const instructions = searchParams.get("instructions") || "";
  const preferences =
    searchParams
      .get("preferences")
      ?.split(",")
      .filter(Boolean) || [];
  const handoverComplete =
    searchParams.get("handoverComplete") === "true";
  const fuelLevel = searchParams.get("fuelLevel") || "Not recorded";
  const keysCount = Number(searchParams.get("keysCount") || "1");
  const helmetHandedOver =
    searchParams.get("helmetHandedOver") === "true";
  const accessoriesNote =
    searchParams.get("accessoriesNote") || "";

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [understandsApproval, setUnderstandsApproval] =
    useState(false);
  const [confirming, setConfirming] = useState(false);

  const estimatedCost = useMemo(
    () => getEstimatedCost(selectedServiceName),
    [selectedServiceName]
  );

  const estimatedDuration = useMemo(
    () => getEstimatedDuration(selectedServiceName),
    [selectedServiceName]
  );

  async function confirmBooking() {
    if (!acceptedTerms || !understandsApproval) {
      window.alert(
        "Please accept the booking terms and approval confirmation before continuing."
      );
      return;
    }

    if (
      !selectedService ||
      !selectedWorkshop ||
      !selectedDate ||
      !selectedTime
    ) {
      window.alert(
        "Some booking details are missing. Please go back and complete the booking flow."
      );
      return;
    }

    setConfirming(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.alert("Please sign in before confirming your booking.");
        router.push("/login");
        return;
      }

      const bookingNumber = createBookingNumber();
      const bookingDate = dateParamToISO(selectedDate);
      const activeVehicleId = await resolveActiveVehicleId(user.id);

      if (!activeVehicleId) {
        window.alert(
          "No vehicle is available for this account. Please add a vehicle before booking service."
        );
        router.push("/add-vehicle");
        return;
      }

      const { data, error } = await supabase
        .from("service_bookings")
        .insert({
          user_id: user.id,

          // Automatically link the booking to the active dashboard vehicle.
          // The customer is NOT asked to select the vehicle again.
          vehicle_id: activeVehicleId,

          booking_number: bookingNumber,

          service_category: selectedCategory,
          service_code: selectedService,
          service_name: selectedServiceName,

          workshop_id: selectedWorkshop,
          workshop_name: selectedWorkshopName,

          booking_date: bookingDate,
          booking_time: selectedTime,

          service_mode: serviceMode,

          pickup_address:
            serviceMode === "pickup-drop" ? pickupAddress || null : null,
          pickup_slot:
            serviceMode === "pickup-drop" ? pickupSlot || null : null,
          delivery_same_address: deliverySameAddress,
          delivery_address:
            serviceMode === "pickup-drop" && !deliverySameAddress
              ? deliveryAddress || null
              : null,

          service_instructions: instructions || null,
          preferences,

          fuel_level:
            fuelLevel === "Not recorded" ? null : fuelLevel,
          keys_count:
            Number.isFinite(keysCount) && keysCount > 0 ? keysCount : 1,
          helmet_handed_over: helmetHandedOver,
          accessories_note: accessoriesNote || null,

          handover_complete: handoverComplete,

          estimated_cost_text: estimatedCost,
          estimated_duration_text: estimatedDuration,

          // Booking is created successfully, but workshop acceptance
          // is still pending.
          booking_status: "workshop_acceptance_pending",
        })
        .select("id, booking_number")
        .single();

      if (error) {
        throw error;
      }

      const params = new URLSearchParams({
        bookingId: data.booking_number,
        bookingDbId: data.id,
        vehicleId: String(activeVehicleId),
        category: selectedCategory,
        service: selectedService,
        serviceName: selectedServiceName,
        workshop: selectedWorkshop,
        workshopName: selectedWorkshopName,
        date: bookingDate,
        time: selectedTime,
        mode: serviceMode,
        estimatedCost,
        estimatedDuration,
      });

      router.push(
        `/service-booking/confirmation?${params.toString()}`
      );
    } catch (caughtError) {
      console.error("Service booking create error:", caughtError);

      window.alert(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create the service booking. Please try again."
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href={`/service-booking/pickup?category=${encodeURIComponent(
              selectedCategory
            )}&service=${encodeURIComponent(
              selectedService
            )}&serviceName=${encodeURIComponent(
              selectedServiceName
            )}&workshop=${encodeURIComponent(
              selectedWorkshop
            )}&workshopName=${encodeURIComponent(
              selectedWorkshopName
            )}&date=${encodeURIComponent(
              selectedDate
            )}&time=${encodeURIComponent(selectedTime)}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Service Mode
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Step 6 of 7
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Review Booking
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Verify the service, workshop, appointment, service mode and
                estimated charges before confirming your booking.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
              <ShieldCheck size={18} />
              No additional work without approval
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                Final Check
              </p>

              <h2 className="mt-1 text-xl font-black">
                Everything in one place before you confirm
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Review every important booking detail now. Any additional repair
                or cost later must be explicitly approved by you.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <ReviewCard
            icon={<Wrench size={20} />}
            title="Package / Service"
            value={selectedServiceName}
            helper="Selected service"
          />

          <ReviewCard
            icon={<MapPin size={20} />}
            title="Workshop"
            value={selectedWorkshopName}
            helper="Verified workshop selection"
          />

          <ReviewCard
            icon={<CalendarDays size={20} />}
            title="Date"
            value={formatDateLabel(selectedDate)}
            helper="Service appointment"
          />

          <ReviewCard
            icon={<Clock3 size={20} />}
            title="Time"
            value={formatTimeLabel(selectedTime)}
            helper="Booked slot"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <SectionTitle
            icon={<Truck size={21} />}
            eyebrow="Service Mode"
            title={formatMode(serviceMode)}
          />

          {serviceMode === "pickup-drop" ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoBox
                label="Pickup Address"
                value={pickupAddress || "Not entered"}
              />
              <InfoBox
                label="Pickup Time"
                value={pickupSlot || "Not selected"}
              />
              <InfoBox
                label="Delivery"
                value={
                  deliverySameAddress
                    ? "Same as pickup address"
                    : deliveryAddress || "Different delivery address"
                }
              />
              <InfoBox
                label="Pickup & Drop Charge"
                value="Shown by workshop before confirmation"
              />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-blue-400/15 bg-blue-400/[0.07] p-4">
              <p className="text-sm font-black text-blue-100">
                Drive-in selected
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Please reach {selectedWorkshopName} at the selected appointment
                time.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <SectionTitle
            icon={<FileText size={21} />}
            eyebrow="Service Instructions"
            title="Customer request"
          />

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-sm leading-6 text-slate-300">
              {instructions.trim()
                ? instructions
                : "No additional service instructions added."}
            </p>
          </div>

          {preferences.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {preferences.map((preference) => (
                <span
                  key={preference}
                  className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100"
                >
                  {preference.replaceAll("-", " ")}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 shadow-xl sm:p-6">
          <SectionTitle
            icon={<PackageCheck size={21} />}
            eyebrow="Digital Vehicle Handover Report"
            title={
              handoverComplete
                ? "Condition record complete"
                : "Condition record pending completion"
            }
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBox label="Fuel Level" value={fuelLevel} />
            <InfoBox label="Keys" value={String(keysCount)} />
            <InfoBox
              label="Helmet"
              value={helmetHandedOver ? "Handed Over" : "Not Handed Over"}
            />
            <InfoBox
              label="Accessories"
              value={accessoriesNote || "None"}
            />
          </div>

          <div
            className={`mt-4 rounded-2xl border p-4 ${
              handoverComplete
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-amber-400/20 bg-amber-400/10 text-amber-100"
            }`}
          >
            {handoverComplete
              ? "Front, rear, left and right-side condition photos are recorded."
              : "The remaining condition photos can be completed during vehicle handover."}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
              Estimated Cost
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {estimatedCost}
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-100/70">
              Final cost may change only after inspection and your approval.
            </p>
          </div>

          <div className="rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
              Estimated Duration
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {estimatedDuration}
            </p>
            <p className="mt-2 text-sm leading-6 text-violet-100/70">
              Workshop updates will appear in live service tracking.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <input
                type="checkbox"
                checked={understandsApproval}
                onChange={(event) =>
                  setUnderstandsApproval(event.target.checked)
                }
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-black text-white">
                  I understand that additional repairs or costs require my
                  approval before work begins.
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  This protects you from unexpected work and unexpected charges.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) =>
                  setAcceptedTerms(event.target.checked)
                }
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-black text-white">
                  I have reviewed the booking details and accept the applicable
                  workshop and cancellation policies.
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Policy details can later be opened from the production booking
                  screen.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Ready to Book
              </p>
              <p className="mt-1 text-lg font-black">
                {selectedServiceName} • {selectedWorkshopName}
              </p>
            </div>

            <button
              type="button"
              onClick={confirmBooking}
              disabled={
                !acceptedTerms ||
                !understandsApproval ||
                confirming
              }
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black transition ${
                acceptedTerms &&
                understandsApproval &&
                !confirming
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:scale-[1.01]"
                  : "cursor-not-allowed bg-white/10 text-slate-600"
              }`}
            >
              {confirming ? "Creating Booking..." : "Confirm Booking"}
              {!confirming ? <ChevronRight size={17} /> : null}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReviewCard({
  icon,
  title,
  value,
  helper,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
          {icon}
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-600">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function SectionTitle({
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
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-black">{title}</h2>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}