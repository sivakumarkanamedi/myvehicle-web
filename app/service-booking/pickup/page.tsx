"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  KeyRound,
  MapPin,
  Mic,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  Upload,
  Video,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type ServiceMode = "drive-in" | "pickup-drop";

type PreferenceKey =
  | "call-before-parts"
  | "genuine-parts"
  | "return-parts"
  | "notify-estimate"
  | "wash"
  | "dont-wash";

const pickupSlots = [
  "08:00 – 09:00 AM",
  "09:00 – 10:00 AM",
  "10:00 – 11:00 AM",
  "11:00 AM – 12:00 PM",
];

const preferenceOptions: Array<{
  id: PreferenceKey;
  label: string;
}> = [
  {
    id: "call-before-parts",
    label: "Call before replacing any parts",
  },
  {
    id: "genuine-parts",
    label: "Use genuine OEM parts only",
  },
  {
    id: "return-parts",
    label: "Return replaced parts after service",
  },
  {
    id: "notify-estimate",
    label: "Notify me if the estimate changes",
  },
  {
    id: "wash",
    label: "Wash vehicle after service",
  },
  {
    id: "dont-wash",
    label: "Do not wash vehicle",
  },
];

export default function PickupDropPage() {
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
  const vehicleId = searchParams.get("vehicleId") || "";

  const [serviceMode, setServiceMode] =
    useState<ServiceMode>("drive-in");
  const [pickupAddress, setPickupAddress] =
    useState("Home Address");
  const [pickupSlot, setPickupSlot] = useState(
    pickupSlots[0]
  );
  const [deliverySameAddress, setDeliverySameAddress] =
    useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [preferences, setPreferences] = useState<
    PreferenceKey[]
  >(["call-before-parts", "notify-estimate"]);

  const [frontPhoto, setFrontPhoto] = useState(false);
  const [rearPhoto, setRearPhoto] = useState(false);
  const [leftPhoto, setLeftPhoto] = useState(false);
  const [rightPhoto, setRightPhoto] = useState(false);

  const [fuelLevel, setFuelLevel] = useState("Half");
  const [keysCount, setKeysCount] = useState("1");
  const [helmetHandedOver, setHelmetHandedOver] =
    useState(false);
  const [accessoriesNote, setAccessoriesNote] =
    useState("");

  const handoverComplete = useMemo(
    () =>
      frontPhoto &&
      rearPhoto &&
      leftPhoto &&
      rightPhoto,
    [frontPhoto, rearPhoto, leftPhoto, rightPhoto]
  );

  function togglePreference(id: PreferenceKey) {
    setPreferences((current) => {
      if (id === "wash") {
        return current.includes(id)
          ? current.filter((item) => item !== id)
          : [
              ...current.filter(
                (item) => item !== "dont-wash"
              ),
              id,
            ];
      }

      if (id === "dont-wash") {
        return current.includes(id)
          ? current.filter((item) => item !== id)
          : [
              ...current.filter(
                (item) => item !== "wash"
              ),
              id,
            ];
      }

      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
    });
  }

  function continueToReview() {
    if (
      serviceMode === "pickup-drop" &&
      !pickupAddress.trim()
    ) {
      window.alert("Please enter a pickup address.");
      return;
    }

    const params = new URLSearchParams({
      category: selectedCategory,
      service: selectedService,
      serviceName: selectedServiceName,
      workshop: selectedWorkshop,
      workshopName: selectedWorkshopName,
      date: selectedDate,
      time: selectedTime,
      mode: serviceMode,
      pickupAddress:
        serviceMode === "pickup-drop"
          ? pickupAddress
          : "",
      pickupSlot:
        serviceMode === "pickup-drop"
          ? pickupSlot
          : "",
      deliverySameAddress: String(
        deliverySameAddress
      ),
      deliveryAddress:
        serviceMode === "pickup-drop" &&
        !deliverySameAddress
          ? deliveryAddress
          : "",
      instructions,
      preferences: preferences.join(","),
      handoverComplete: String(handoverComplete),
      fuelLevel,
      keysCount,
      helmetHandedOver: String(
        helmetHandedOver
      ),
      accessoriesNote,
    });

    if (vehicleId) {
      params.set("vehicleId", vehicleId);
    }

    router.push(
      `/service-booking/review?${params.toString()}`
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#071426_38%,#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <Link
            href={`/service-booking/schedule?category=${encodeURIComponent(
              selectedCategory
            )}&service=${encodeURIComponent(
              selectedService
            )}&serviceName=${encodeURIComponent(
              selectedServiceName
            )}&workshop=${encodeURIComponent(
              selectedWorkshop
            )}&workshopName=${encodeURIComponent(
              selectedWorkshopName
            )}${
              vehicleId
                ? `&vehicleId=${encodeURIComponent(vehicleId)}`
                : ""
            }`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} />
            Back to Date & Time
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                Step 5 of 7
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Drive-in or Pickup & Drop
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Choose how you want to hand over the vehicle,
                add service instructions, and complete the
                digital handover record.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
              <SummaryBox
                label="Service"
                value={selectedServiceName}
              />
              <SummaryBox
                label="Workshop"
                value={selectedWorkshopName}
              />
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <SectionTitle
            icon={<Truck size={21} />}
            eyebrow="Service Mode"
            title="How would you like to service your vehicle?"
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ModeCard
              active={serviceMode === "drive-in"}
              title="Drive-in"
              description="Take the vehicle directly to the workshop at the booked time."
              icon={<Wrench size={25} />}
              onClick={() => setServiceMode("drive-in")}
            />

            <ModeCard
              active={serviceMode === "pickup-drop"}
              title="Pickup & Drop"
              description="Workshop pickup and return service, where available."
              icon={<Truck size={25} />}
              onClick={() =>
                setServiceMode("pickup-drop")
              }
            />
          </div>
        </section>

        {serviceMode === "drive-in" ? (
          <section className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl sm:p-6">
            <SectionTitle
              icon={<MapPin size={21} />}
              eyebrow="Drive-in Details"
              title={selectedWorkshopName}
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoCard
                label="Reporting Time"
                value={
                  selectedTime
                    ? selectedTime
                    : "As per booking"
                }
              />
              <InfoCard
                label="Workshop"
                value={selectedWorkshopName}
              />
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 shadow-xl sm:p-6">
            <SectionTitle
              icon={<MapPin size={21} />}
              eyebrow="Pickup & Drop"
              title="Pickup details"
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">
                  Pickup Address
                </label>

                <input
                  value={pickupAddress}
                  onChange={(event) =>
                    setPickupAddress(event.target.value)
                  }
                  placeholder="Enter pickup address"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">
                  Pickup Time
                </label>

                <select
                  value={pickupSlot}
                  onChange={(event) =>
                    setPickupSlot(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm font-bold text-white outline-none"
                >
                  {pickupSlots.map((slot) => (
                    <option key={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={deliverySameAddress}
                  onChange={(event) =>
                    setDeliverySameAddress(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold text-slate-200">
                  Deliver to the same address
                </span>
              </label>

              {!deliverySameAddress ? (
                <input
                  value={deliveryAddress}
                  onChange={(event) =>
                    setDeliveryAddress(
                      event.target.value
                    )
                  }
                  placeholder="Enter delivery address"
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
              Pickup & Drop charges, if any, must be shown
              clearly on the Review Booking screen before
              confirmation.
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
          <SectionTitle
            icon={<Sparkles size={21} />}
            eyebrow="Service Instructions"
            title="Tell the workshop anything important"
          />

          <textarea
            value={instructions}
            onChange={(event) =>
              setInstructions(event.target.value)
            }
            rows={4}
            placeholder="Example: Please check the front brake noise. Call me before replacing any parts."
            className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm leading-6 text-white outline-none placeholder:text-slate-600"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <AttachmentButton
              icon={<Mic size={18} />}
              title="Voice Note"
              helper="Optional"
            />
            <AttachmentButton
              icon={<Camera size={18} />}
              title="Add Photos"
              helper="Optional"
            />
            <AttachmentButton
              icon={<Video size={18} />}
              title="Short Video"
              helper="Optional"
            />
          </div>

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
              Quick Preferences
            </p>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {preferenceOptions.map((option) => {
                const active = preferences.includes(
                  option.id
                );

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      togglePreference(option.id)
                    }
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-bold transition ${
                      active
                        ? "border-violet-400/30 bg-violet-500/15 text-violet-100"
                        : "border-white/10 bg-slate-950/35 text-slate-400"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border ${
                        active
                          ? "border-violet-300 bg-violet-500 text-white"
                          : "border-white/15"
                      }`}
                    >
                      {active ? (
                        <Check size={14} />
                      ) : null}
                    </span>

                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 shadow-xl sm:p-6">
          <SectionTitle
            icon={<ShieldCheck size={21} />}
            eyebrow="Digital Vehicle Handover Report"
            title="Create a clear vehicle condition record"
          />

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            This record protects both the customer and the
            workshop by documenting the vehicle condition at
            handover.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PhotoCheck
              label="Front Photo"
              checked={frontPhoto}
              onClick={() =>
                setFrontPhoto((value) => !value)
              }
            />
            <PhotoCheck
              label="Rear Photo"
              checked={rearPhoto}
              onClick={() =>
                setRearPhoto((value) => !value)
              }
            />
            <PhotoCheck
              label="Left Side Photo"
              checked={leftPhoto}
              onClick={() =>
                setLeftPhoto((value) => !value)
              }
            />
            <PhotoCheck
              label="Right Side Photo"
              checked={rightPhoto}
              onClick={() =>
                setRightPhoto((value) => !value)
              }
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Fuel Level
              </label>
              <select
                value={fuelLevel}
                onChange={(event) =>
                  setFuelLevel(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm font-bold text-white outline-none"
              >
                <option>Empty</option>
                <option>Quarter</option>
                <option>Half</option>
                <option>Three Quarter</option>
                <option>Full</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Keys Handed Over
              </label>
              <select
                value={keysCount}
                onChange={(event) =>
                  setKeysCount(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm font-bold text-white outline-none"
              >
                <option>1</option>
                <option>2</option>
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={helmetHandedOver}
                  onChange={(event) =>
                    setHelmetHandedOver(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                    Helmet
                  </span>
                  <span className="mt-1 block text-sm font-bold text-white">
                    Handed Over
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                Accessories
              </label>
              <input
                value={accessoriesNote}
                onChange={(event) =>
                  setAccessoriesNote(
                    event.target.value
                  )
                }
                placeholder="Optional notes"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          <div
            className={`mt-5 rounded-2xl border p-4 ${
              handoverComplete
                ? "border-emerald-400/30 bg-emerald-500/15"
                : "border-amber-400/20 bg-amber-400/10"
            }`}
          >
            <div className="flex items-center gap-3">
              {handoverComplete ? (
                <PackageCheck
                  size={20}
                  className="text-emerald-300"
                />
              ) : (
                <Upload
                  size={20}
                  className="text-amber-300"
                />
              )}

              <div>
                <p className="text-sm font-black">
                  {handoverComplete
                    ? "Handover photo set complete"
                    : "Handover photos can be completed now or during vehicle handover"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Front, rear, left and right-side photos
                  are used for the condition record.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Service Mode Selected
              </p>
              <p className="mt-1 text-lg font-black">
                {serviceMode === "drive-in"
                  ? "Drive-in"
                  : "Pickup & Drop"}
              </p>
            </div>

            <button
              type="button"
              onClick={continueToReview}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-sm font-black text-white transition hover:scale-[1.01]"
            >
              Continue to Review
              <ChevronRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white">
        {value}
      </p>
    </div>
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

function ModeCard({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left transition ${
        active
          ? "border-blue-400/40 bg-blue-500/15"
          : "border-white/10 bg-slate-950/35 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl ${
            active
              ? "bg-blue-500 text-white"
              : "bg-white/[0.04] text-slate-400"
          }`}
        >
          {icon}
        </div>

        <div
          className={`grid h-7 w-7 place-items-center rounded-full border ${
            active
              ? "border-blue-300 bg-blue-500 text-white"
              : "border-white/15"
          }`}
        >
          {active ? <Check size={15} /> : null}
        </div>
      </div>

      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </button>
  );
}

function AttachmentButton({
  icon,
  title,
  helper,
}: {
  icon: React.ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-left transition hover:bg-white/[0.05]"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
          {icon}
        </span>
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {helper}
          </p>
        </div>
      </div>
    </button>
  );
}

function PhotoCheck({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        checked
          ? "border-emerald-400/30 bg-emerald-500/15"
          : "border-white/10 bg-slate-950/35"
      }`}
    >
      <Camera
        size={20}
        className={
          checked ? "text-emerald-300" : "text-slate-500"
        }
      />
      <p className="mt-3 text-sm font-black">{label}</p>
      <p className="mt-1 text-xs text-slate-600">
        {checked ? "Added" : "Tap to mark added"}
      </p>
    </button>
  );
}

function InfoCard({
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