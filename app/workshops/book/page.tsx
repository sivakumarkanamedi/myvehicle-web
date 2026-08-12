"use client";

import Link from "next/link";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type VehicleOption = {
  id: number;
  label: string;
  registrationNumber: string;
  vehicleType: "Car" | "Bike" | "EV" | "Commercial";
};

type WorkshopOption = {
  id: number;
  name: string;
  area: string;
  distanceKm: number;
  rating: number;
  verified: boolean;
};

type ServiceOption = {
  id: number;
  name: string;
  estimatedPrice: number;
  estimatedDurationMinutes: number;
};

type VisitMode =
  | "workshop_visit"
  | "pickup_drop"
  | "doorstep";

type BookingStatus =
  | "draft"
  | "requested"
  | "confirmed"
  | "cancelled";

type BookingDraft = {
  vehicleId: number;
  workshopId: number;
  serviceIds: number[];
  preferredDate: string;
  preferredTime: string;
  visitMode: VisitMode;
  pickupAddress: string;
  contactNumber: string;
  notes: string;
  agreeToEstimate: boolean;
};

const vehicles: VehicleOption[] = [
  {
    id: 1,
    label: "Primary Car",
    registrationNumber: "KA 01 AB 1234",
    vehicleType: "Car",
  },
  {
    id: 2,
    label: "Family Bike",
    registrationNumber: "KA 05 XY 9876",
    vehicleType: "Bike",
  },
];

const workshops: WorkshopOption[] = [
  {
    id: 1,
    name: "Bosch Car Service – AutoCare",
    area: "Marathahalli",
    distanceKm: 2.1,
    rating: 4.8,
    verified: true,
  },
  {
    id: 2,
    name: "GoMechanic Premium Garage",
    area: "Indiranagar",
    distanceKm: 4.4,
    rating: 4.6,
    verified: true,
  },
  {
    id: 3,
    name: "RideFix Two Wheeler Care",
    area: "Yeshwanthpur",
    distanceKm: 5.7,
    rating: 4.7,
    verified: true,
  },
];

const services: ServiceOption[] = [
  {
    id: 1,
    name: "General Service",
    estimatedPrice: 2499,
    estimatedDurationMinutes: 180,
  },
  {
    id: 2,
    name: "Oil Change",
    estimatedPrice: 1299,
    estimatedDurationMinutes: 60,
  },
  {
    id: 3,
    name: "Brake Service",
    estimatedPrice: 1799,
    estimatedDurationMinutes: 120,
  },
  {
    id: 4,
    name: "Tyres",
    estimatedPrice: 999,
    estimatedDurationMinutes: 90,
  },
  {
    id: 5,
    name: "AC Service",
    estimatedPrice: 1999,
    estimatedDurationMinutes: 120,
  },
  {
    id: 6,
    name: "Electrical",
    estimatedPrice: 1499,
    estimatedDurationMinutes: 90,
  },
  {
    id: 7,
    name: "Denting & Painting",
    estimatedPrice: 3499,
    estimatedDurationMinutes: 480,
  },
  {
    id: 8,
    name: "EV Service",
    estimatedPrice: 1999,
    estimatedDurationMinutes: 150,
  },
];

const initialDraft: BookingDraft = {
  vehicleId: vehicles[0].id,
  workshopId: workshops[0].id,
  serviceIds: [services[0].id],
  preferredDate: "",
  preferredTime: "",
  visitMode: "workshop_visit",
  pickupAddress: "",
  contactNumber: "",
  notes: "",
  agreeToEstimate: false,
};

export default function WorkshopBookingPage() {
  const router = useRouter();

  const [draft, setDraft] =
    useState<BookingDraft>(initialDraft);

  const [status, setStatus] =
    useState<BookingStatus>("draft");

  const [bookingReference, setBookingReference] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [miraQuestion, setMiraQuestion] =
    useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can help select a workshop, service package, visit mode, date, time and estimated cost."
    );

  const selectedVehicle = useMemo(
    () =>
      vehicles.find(
        (vehicle) =>
          vehicle.id === draft.vehicleId
      ) ?? vehicles[0],
    [draft.vehicleId]
  );

  const selectedWorkshop = useMemo(
    () =>
      workshops.find(
        (workshop) =>
          workshop.id === draft.workshopId
      ) ?? workshops[0],
    [draft.workshopId]
  );

  const selectedServices = useMemo(
    () =>
      services.filter((service) =>
        draft.serviceIds.includes(
          service.id
        )
      ),
    [draft.serviceIds]
  );

  const estimatedServiceCost = useMemo(
    () =>
      selectedServices.reduce(
        (total, service) =>
          total +
          service.estimatedPrice,
        0
      ),
    [selectedServices]
  );

  const convenienceCharge = useMemo(() => {
    if (
      draft.visitMode === "pickup_drop"
    ) {
      return 299;
    }

    if (
      draft.visitMode === "doorstep"
    ) {
      return 399;
    }

    return 0;
  }, [draft.visitMode]);

  const estimatedTotal =
    estimatedServiceCost +
    convenienceCharge;

  const estimatedDurationMinutes =
    useMemo(
      () =>
        selectedServices.reduce(
          (total, service) =>
            Math.max(
              total,
              service.estimatedDurationMinutes
            ),
          0
        ),
      [selectedServices]
    );

  const bookingReady = useMemo(() => {
    const addressRequired =
      draft.visitMode !==
      "workshop_visit";

    return Boolean(
      draft.vehicleId &&
        draft.workshopId &&
        draft.serviceIds.length &&
        draft.preferredDate &&
        draft.preferredTime &&
        draft.contactNumber.trim() &&
        (!addressRequired ||
          draft.pickupAddress.trim()) &&
        draft.agreeToEstimate
    );
  }, [draft]);

  function updateDraft<
    K extends keyof BookingDraft,
  >(
    key: K,
    value: BookingDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));

    setError("");
    setMessage("");
  }

  function toggleService(
    serviceId: number
  ) {
    setDraft((current) => {
      const exists =
        current.serviceIds.includes(
          serviceId
        );

      const nextServiceIds =
        exists
          ? current.serviceIds.filter(
              (id) =>
                id !== serviceId
            )
          : [
              ...current.serviceIds,
              serviceId,
            ];

      return {
        ...current,
        serviceIds:
          nextServiceIds,
      };
    });

    setError("");
    setMessage("");
  }

  function submitBooking(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!bookingReady) {
      setError(
        "Complete all required fields and accept the estimate acknowledgement."
      );
      return;
    }

    const reference =
      `MV-${Date.now()
        .toString()
        .slice(-8)}`;

    const bookingPayload = {
      bookingReference:
        reference,
      status: "requested",
      vehicle: selectedVehicle,
      workshop: selectedWorkshop,
      services: selectedServices,
      preferredDate:
        draft.preferredDate,
      preferredTime:
        draft.preferredTime,
      visitMode:
        draft.visitMode,
      pickupAddress:
        draft.pickupAddress ||
        null,
      contactNumber:
        draft.contactNumber,
      notes:
        draft.notes || null,
      estimatedServiceCost,
      convenienceCharge,
      estimatedTotal,
      createdAt:
        new Date().toISOString(),
    };

    localStorage.setItem(
      `my-vehicle-service-booking-${reference}`,
      JSON.stringify(
        bookingPayload
      )
    );

    setBookingReference(
      reference
    );

    setStatus("requested");

    setMessage(
      "Service request created in preview mode. Supabase booking creation can be connected next."
    );
  }

  function resetBooking() {
    setDraft(initialDraft);
    setStatus("draft");
    setBookingReference("");
    setMessage("");
    setError("");
  }

  function cancelBooking() {
    const confirmed =
      window.confirm(
        "Cancel this service request?"
      );

    if (!confirmed) {
      return;
    }

    setStatus("cancelled");
    setMessage(
      "Booking cancelled in preview mode."
    );
  }

  function rescheduleBooking() {
    setStatus("draft");

    setMessage(
      "Choose a new date and time, then submit the request again."
    );
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion
        .trim()
        .toLowerCase();

    if (!question) {
      return;
    }

    if (
      question.includes("cost") ||
      question.includes("price")
    ) {
      setMiraReply(
        `The current estimated total is ₹${estimatedTotal.toLocaleString(
          "en-IN"
        )}. Final cost must be approved after workshop inspection.`
      );
    } else if (
      question.includes("pickup")
    ) {
      setMiraReply(
        draft.visitMode ===
        "pickup_drop"
          ? "Pickup and drop is selected. Enter the pickup address and keep the contact number available."
          : "Choose Pickup & Drop under Visit Mode to request collection of the vehicle."
      );
    } else if (
      question.includes("doorstep")
    ) {
      setMiraReply(
        draft.visitMode ===
        "doorstep"
          ? "Doorstep service is selected. Availability depends on the workshop and selected service."
          : "Choose Doorstep Service under Visit Mode when supported by the workshop."
      );
    } else if (
      question.includes("time") ||
      question.includes("duration")
    ) {
      setMiraReply(
        `Estimated workshop time is ${formatDuration(
          estimatedDurationMinutes
        )}. Actual completion time can change after inspection.`
      );
    } else if (
      question.includes("workshop")
    ) {
      setMiraReply(
        `${selectedWorkshop.name} is ${selectedWorkshop.distanceKm} km away, rated ${selectedWorkshop.rating}/5, and ${
          selectedWorkshop.verified
            ? "verified"
            : "not yet verified"
        }.`
      );
    } else if (
      question.includes("service")
    ) {
      setMiraReply(
        selectedServices.length
          ? `Selected services: ${selectedServices
              .map(
                (service) =>
                  service.name
              )
              .join(", ")}.`
          : "Select at least one service before booking."
      );
    } else {
      setMiraReply(
        bookingReady
          ? "Your booking form is ready to submit."
          : "Complete the required vehicle, workshop, service, date, time, contact and estimate fields."
      );
    }

    setMiraQuestion("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">
            My Vehicle Service Network
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Book Vehicle Service
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Select the vehicle, workshop, service, visit mode, preferred
            date and time, then review the estimated cost before sending
            the request.
          </p>
        </header>

        {error ? (
          <Alert
            tone="error"
            text={error}
          />
        ) : null}

        {message ? (
          <Alert
            tone="success"
            text={message}
          />
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Vehicle"
            value={
              selectedVehicle.registrationNumber
            }
          />

          <Metric
            label="Workshop"
            value={
              selectedWorkshop.area
            }
          />

          <Metric
            label="Services"
            value={String(
              selectedServices.length
            )}
          />

          <Metric
            label="Estimated Time"
            value={formatDuration(
              estimatedDurationMinutes
            )}
          />

          <Metric
            label="Estimated Total"
            value={`₹${estimatedTotal.toLocaleString(
              "en-IN"
            )}`}
          />
        </section>

        {status === "requested" ||
        status === "cancelled" ? (
          <section
            className={
              status === "requested"
                ? "rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 sm:p-8"
                : "rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6 sm:p-8"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Booking Status
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              {status ===
              "requested"
                ? "Service Request Submitted"
                : "Booking Cancelled"}
            </h2>

            {bookingReference ? (
              <p className="mt-3 text-sm text-slate-300">
                Reference:{" "}
                <strong>
                  {bookingReference}
                </strong>
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={
                  rescheduleBooking
                }
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold"
              >
                Reschedule
              </button>

              <button
                type="button"
                onClick={
                  cancelBooking
                }
                disabled={
                  status ===
                  "cancelled"
                }
                className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 disabled:opacity-40"
              >
                Cancel Booking
              </button>

              <button
                type="button"
                onClick={
                  resetBooking
                }
                className="rounded-2xl bg-blue-400 px-5 py-3 text-sm font-bold text-slate-950"
              >
                New Booking
              </button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={
              submitBooking
            }
            className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"
          >
            <section className="space-y-6">
              <BookingCard
                title="1. Select Vehicle"
                description="Choose the vehicle that needs service."
              >
                <select
                  value={
                    draft.vehicleId
                  }
                  onChange={(event) =>
                    updateDraft(
                      "vehicleId",
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
                >
                  {vehicles.map(
                    (vehicle) => (
                      <option
                        key={
                          vehicle.id
                        }
                        value={
                          vehicle.id
                        }
                      >
                        {
                          vehicle.label
                        }{" "}
                        —{" "}
                        {
                          vehicle.registrationNumber
                        }
                      </option>
                    )
                  )}
                </select>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Detail
                    label="Registration"
                    value={
                      selectedVehicle.registrationNumber
                    }
                  />

                  <Detail
                    label="Vehicle Type"
                    value={
                      selectedVehicle.vehicleType
                    }
                  />
                </div>
              </BookingCard>

              <BookingCard
                title="2. Select Workshop"
                description="Choose a workshop from the current service network."
              >
                <select
                  value={
                    draft.workshopId
                  }
                  onChange={(event) =>
                    updateDraft(
                      "workshopId",
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm"
                >
                  {workshops.map(
                    (workshop) => (
                      <option
                        key={
                          workshop.id
                        }
                        value={
                          workshop.id
                        }
                      >
                        {
                          workshop.name
                        }{" "}
                        —{" "}
                        {
                          workshop.area
                        }
                      </option>
                    )
                  )}
                </select>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Detail
                    label="Distance"
                    value={`${selectedWorkshop.distanceKm} km`}
                  />

                  <Detail
                    label="Rating"
                    value={`${selectedWorkshop.rating}/5`}
                  />

                  <Detail
                    label="Verification"
                    value={
                      selectedWorkshop.verified
                        ? "Verified"
                        : "Not verified"
                    }
                  />
                </div>

                <Link
                  href="/workshops"
                  className="mt-4 inline-block text-sm font-semibold text-blue-300 hover:underline"
                >
                  Change from workshop list
                </Link>
              </BookingCard>

              <BookingCard
                title="3. Select Services"
                description="Choose one or more required services."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {services.map(
                    (service) => {
                      const selected =
                        draft.serviceIds.includes(
                          service.id
                        );

                      return (
                        <button
                          key={
                            service.id
                          }
                          type="button"
                          onClick={() =>
                            toggleService(
                              service.id
                            )
                          }
                          className={
                            selected
                              ? "rounded-2xl border border-blue-400/40 bg-blue-400/10 p-4 text-left"
                              : "rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left"
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {
                                  service.name
                                }
                              </p>

                              <p className="mt-2 text-sm text-slate-500">
                                From ₹
                                {service.estimatedPrice.toLocaleString(
                                  "en-IN"
                                )}
                              </p>
                            </div>

                            <span
                              className={
                                selected
                                  ? "text-blue-300"
                                  : "text-slate-600"
                              }
                            >
                              {selected
                                ? "✓"
                                : "○"}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </BookingCard>

              <BookingCard
                title="4. Date & Time"
                description="Choose your preferred appointment slot."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Preferred date"
                    type="date"
                    value={
                      draft.preferredDate
                    }
                    required
                    onChange={(value) =>
                      updateDraft(
                        "preferredDate",
                        value
                      )
                    }
                  />

                  <Field
                    label="Preferred time"
                    type="time"
                    value={
                      draft.preferredTime
                    }
                    required
                    onChange={(value) =>
                      updateDraft(
                        "preferredTime",
                        value
                      )
                    }
                  />
                </div>
              </BookingCard>

              <BookingCard
                title="5. Visit Mode"
                description="Choose workshop visit, pickup and drop, or doorstep service."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <ModeButton
                    label="Workshop Visit"
                    selected={
                      draft.visitMode ===
                      "workshop_visit"
                    }
                    onClick={() =>
                      updateDraft(
                        "visitMode",
                        "workshop_visit"
                      )
                    }
                  />

                  <ModeButton
                    label="Pickup & Drop"
                    selected={
                      draft.visitMode ===
                      "pickup_drop"
                    }
                    onClick={() =>
                      updateDraft(
                        "visitMode",
                        "pickup_drop"
                      )
                    }
                  />

                  <ModeButton
                    label="Doorstep Service"
                    selected={
                      draft.visitMode ===
                      "doorstep"
                    }
                    onClick={() =>
                      updateDraft(
                        "visitMode",
                        "doorstep"
                      )
                    }
                  />
                </div>

                {draft.visitMode !==
                "workshop_visit" ? (
                  <div className="mt-4">
                    <TextAreaField
                      label="Pickup / service address"
                      value={
                        draft.pickupAddress
                      }
                      required
                      placeholder="Enter complete address"
                      onChange={(value) =>
                        updateDraft(
                          "pickupAddress",
                          value
                        )
                      }
                    />
                  </div>
                ) : null}
              </BookingCard>

              <BookingCard
                title="6. Contact & Notes"
                description="Provide the contact number and any workshop instructions."
              >
                <Field
                  label="Contact number"
                  type="tel"
                  value={
                    draft.contactNumber
                  }
                  required
                  placeholder="+91"
                  onChange={(value) =>
                    updateDraft(
                      "contactNumber",
                      value
                    )
                  }
                />

                <div className="mt-4">
                  <TextAreaField
                    label="Notes for workshop"
                    value={
                      draft.notes
                    }
                    placeholder="Describe the service request or preferred instructions."
                    onChange={(value) =>
                      updateDraft(
                        "notes",
                        value
                      )
                    }
                  />
                </div>
              </BookingCard>
            </section>

            <aside className="space-y-6">
              <section className="sticky top-5 space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                    Booking Summary
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Review Request
                  </h2>
                </div>

                <SummaryRow
                  label="Vehicle"
                  value={
                    selectedVehicle.registrationNumber
                  }
                />

                <SummaryRow
                  label="Workshop"
                  value={
                    selectedWorkshop.name
                  }
                />

                <SummaryRow
                  label="Visit Mode"
                  value={formatLabel(
                    draft.visitMode
                  )}
                />

                <SummaryRow
                  label="Services"
                  value={
                    selectedServices.length
                      ? selectedServices
                          .map(
                            (service) =>
                              service.name
                          )
                          .join(", ")
                      : "None selected"
                  }
                />

                <div className="border-t border-white/10 pt-4">
                  <SummaryRow
                    label="Service Estimate"
                    value={`₹${estimatedServiceCost.toLocaleString(
                      "en-IN"
                    )}`}
                  />

                  <div className="mt-3">
                    <SummaryRow
                      label="Convenience Charge"
                      value={`₹${convenienceCharge.toLocaleString(
                        "en-IN"
                      )}`}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-4">
                    <span className="font-semibold text-blue-100">
                      Estimated Total
                    </span>

                    <span className="text-2xl font-bold text-blue-100">
                      ₹
                      {estimatedTotal.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <input
                    type="checkbox"
                    checked={
                      draft.agreeToEstimate
                    }
                    onChange={(event) =>
                      updateDraft(
                        "agreeToEstimate",
                        event.target
                          .checked
                      )
                    }
                    className="mt-1 h-5 w-5"
                  />

                  <span className="text-sm leading-6 text-slate-300">
                    I understand this is an estimate. The workshop must
                    share the final inspection estimate for approval before
                    additional work.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={
                    !bookingReady
                  }
                  className="w-full rounded-2xl bg-blue-400 px-6 py-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit Service Request
                </button>

                <p className="text-xs leading-5 text-slate-600">
                  No payment is collected on this preview page.
                </p>
              </section>

              <section className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                  Ask Mira Booking Assistant
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fuchsia-50/90">
                  {miraReply}
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  <input
                    value={
                      miraQuestion
                    }
                    onChange={(event) =>
                      setMiraQuestion(
                        event.target
                          .value
                      )
                    }
                    placeholder="Ask about cost, workshop, pickup, service or duration..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none"
                  />

                  <button
                    type="button"
                    onClick={(event) =>
                      askMira(
                        event as unknown as FormEvent<HTMLFormElement>
                      )
                    }
                    disabled={
                      !miraQuestion.trim()
                    }
                    className="rounded-2xl bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                  >
                    Ask Mira
                  </button>
                </div>
              </section>
            </aside>
          </form>
        )}

        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
          <strong>Development status:</strong> this page currently stores
          preview bookings in the browser. Production booking requires
          Supabase booking tables, RLS policies, workshop availability,
          slot confirmation, notifications, payments, rescheduling and
          cancellation APIs.
        </section>

        <div className="flex flex-wrap gap-4 pb-4">
          <Link
            href="/workshops"
            className="text-sm font-semibold text-blue-300 hover:underline"
          >
            ← Back to Workshops
          </Link>

          <Link
            href="/vehicle-health"
            className="text-sm font-semibold text-emerald-300 hover:underline"
          >
            Vehicle Health Center
          </Link>
        </div>
      </div>
    </main>
  );
}

function BookingCard(props: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-6">
      <h2 className="text-xl font-bold">
        {props.title}
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {props.description}
      </p>

      <div className="mt-5">
        {props.children}
      </div>
    </section>
  );
}

function Metric(props: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-lg font-bold">
        {props.value}
      </p>
    </article>
  );
}

function Detail(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-600">
        {props.label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-300">
        {props.value}
      </p>
    </div>
  );
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
        {props.required ? " *" : ""}
      </span>

      <input
        type={props.type}
        value={props.value}
        required={props.required}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
        {props.required ? " *" : ""}
      </span>

      <textarea
        value={props.value}
        rows={4}
        required={props.required}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(
            event.target.value
          )
        }
        className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}

function ModeButton(props: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        props.selected
          ? "rounded-2xl border border-blue-400/40 bg-blue-400/10 px-4 py-4 text-sm font-semibold text-blue-100"
          : "rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm font-semibold text-slate-400"
      }
    >
      {props.label}
    </button>
  );
}

function SummaryRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500">
        {props.label}
      </span>

      <span className="max-w-[60%] text-right text-sm font-semibold text-slate-200">
        {props.value}
      </span>
    </div>
  );
}

function Alert(props: {
  tone: "error" | "success";
  text: string;
}) {
  const classes =
    props.tone === "error"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}
    >
      {props.text}
    </div>
  );
}

function formatDuration(
  totalMinutes: number
) {
  if (totalMinutes <= 0) {
    return "Not available";
  }

  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${
    minutes
      ? `${minutes}m`
      : ""
  }`.trim();
}

function formatLabel(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}