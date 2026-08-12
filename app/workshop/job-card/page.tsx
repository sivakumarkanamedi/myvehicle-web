"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../supabase";

type Booking = {
  id: string;
  booking_number: string;
  user_id: string;
  workshop_id: string;
  workshop_name: string;
  service_name: string;
  service_instructions: string | null;
  fuel_level: string | null;
  keys_count: number | null;
  helmet_handed_over: boolean | null;
  accessories_note: string | null;
  booking_date: string;
  booking_time: string;
  booking_status: string;
};

export default function JobCardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBookingId = searchParams.get("bookingId") || "";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadBookings();
  }, [requestedBookingId]);

  async function loadBookings() {
    setLoading(true);
    setMessage("");

    let query = supabase
      .from("service_bookings")
      .select(
        "id, booking_number, user_id, workshop_id, workshop_name, service_name, service_instructions, fuel_level, keys_count, helmet_handed_over, accessories_note, booking_date, booking_time, booking_status"
      )
      .in("booking_status", [
        "accepted",
        "vehicle_checked_in",
        "inspection_started",
      ])
      .order("created_at", { ascending: false });

    if (requestedBookingId) {
      query = query.eq("id", requestedBookingId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setMessage(error.message);
      setBookings([]);
    } else {
      setBookings((data || []) as Booking[]);
    }

    setLoading(false);
  }

  async function createJobCard(booking: Booking) {
    setCreatingId(booking.id);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        throw new Error("Please sign in before creating a Job Card.");
      }

      const { data: membership, error: membershipError } = await supabase
        .from("workshop_members")
        .select("workshop_id, role, is_active")
        .eq("user_id", user.id)
        .eq("workshop_id", booking.workshop_id)
        .eq("is_active", true)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership) {
        throw new Error(
          `This login is not an active member of workshop ${booking.workshop_id}. Logged-in email: ${
            user.email ?? "unknown"
          }`
        );
      }

      if (!["owner", "service_advisor", "receptionist"].includes(membership.role)) {
        throw new Error(
          `Role "${membership.role}" cannot create Digital Job Cards.`
        );
      }

      const { data: existing, error: existingError } = await supabase
        .from("service_job_cards")
        .select("id, job_card_number")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        window.alert(
          `Digital Job Card already exists: ${existing.job_card_number}\nOpening Technician Assignment.`
        );

        router.push(
          `/workshop/technician?jobCardId=${encodeURIComponent(existing.id)}`
        );
        return;
      }

      const jobCardNumber =
        "JC-" + new Date().getTime().toString().slice(-8);

      const { data: created, error: insertError } = await supabase
        .from("service_job_cards")
        .insert({
          booking_id: booking.id,
          workshop_id: booking.workshop_id,
          customer_user_id: booking.user_id,
          job_card_number: jobCardNumber,
          status: "created",
          customer_request: booking.service_name,
          service_instructions: booking.service_instructions || null,
          fuel_level: booking.fuel_level || null,
          keys_received: booking.keys_count ?? 1,
          helmet_received: booking.helmet_handed_over ?? false,
          accessories_received: booking.accessories_note || null,
          created_by: user.id,
        })
        .select("id, job_card_number")
        .single();

      if (insertError) throw insertError;

      const { error: historyError } = await supabase
        .from("service_booking_status_history")
        .insert({
          booking_id: booking.id,
          user_id: user.id,
          status: "vehicle_checked_in",
          note: `Digital Job Card ${created.job_card_number} created.`,
          changed_by_type: "service_advisor",
        });

      if (historyError) {
        console.error("Job Card history error:", historyError);
      }

      window.alert(
        `Digital Job Card Created Successfully\n${created.job_card_number}\n\nNext: Assign Technician`
      );

      router.push(
        `/workshop/technician?jobCardId=${encodeURIComponent(created.id)}`
      );
    } catch (error) {
      console.error("Create Digital Job Card error:", error);

      const text =
        error instanceof Error
          ? error.message
          : "Unable to create Digital Job Card.";

      setMessage(text);
      window.alert(text);
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black">Digital Job Cards</h1>

        <p className="mt-2 text-sm text-slate-400">
          Create a Job Card after the workshop has accepted the booking.
        </p>

        {message ? (
          <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {message}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-8 text-slate-400">Loading...</p>
        ) : (
          <div className="mt-6 space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
              >
                <h2 className="text-xl font-bold">{booking.service_name}</h2>

                <p className="mt-1 text-slate-400">
                  {booking.booking_number}
                </p>

                <p className="text-slate-400">{booking.workshop_name}</p>

                <p className="text-slate-400">
                  {booking.booking_date} • {booking.booking_time}
                </p>

                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {booking.booking_status.replaceAll("_", " ")}
                </p>

                <button
                  type="button"
                  disabled={creatingId === booking.id}
                  onClick={() => createJobCard(booking)}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingId === booking.id
                    ? "Creating..."
                    : "Create Digital Job Card"}
                </button>
              </div>
            ))}

            {bookings.length === 0 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
                No accepted/check-in bookings available.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}