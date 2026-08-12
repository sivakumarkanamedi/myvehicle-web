"use client";

import Link from "next/link";
import { useState } from "react";

export default function AddressEndorsementPage() {
  const [form, setForm] = useState({
    policyId: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    effectiveDate: "",
    reason: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-4xl font-bold">
          Address Change Request
        </h1>

        <p className="mt-2 text-slate-400">
          Update the communication address linked to an insurance policy.
        </p>

        <div className="mt-8 grid gap-5">

          <input
            className="rounded-xl bg-slate-900 border border-slate-700 p-3"
            placeholder="Policy ID"
            value={form.policyId}
            onChange={(e) => update("policyId", e.target.value)}
          />

          <input
            className="rounded-xl bg-slate-900 border border-slate-700 p-3"
            placeholder="Address Line 1"
            value={form.addressLine1}
            onChange={(e) => update("addressLine1", e.target.value)}
          />

          <input
            className="rounded-xl bg-slate-900 border border-slate-700 p-3"
            placeholder="Address Line 2"
            value={form.addressLine2}
            onChange={(e) => update("addressLine2", e.target.value)}
          />

          <div className="grid md:grid-cols-3 gap-4">

            <input
              className="rounded-xl bg-slate-900 border border-slate-700 p-3"
              placeholder="City"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />

            <input
              className="rounded-xl bg-slate-900 border border-slate-700 p-3"
              placeholder="State"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
            />

            <input
              className="rounded-xl bg-slate-900 border border-slate-700 p-3"
              placeholder="PIN Code"
              value={form.pincode}
              onChange={(e) => update("pincode", e.target.value)}
            />

          </div>

          <input
            type="date"
            className="rounded-xl bg-slate-900 border border-slate-700 p-3"
            value={form.effectiveDate}
            onChange={(e) => update("effectiveDate", e.target.value)}
          />

          <textarea
            rows={4}
            className="rounded-xl bg-slate-900 border border-slate-700 p-3"
            placeholder="Reason for address change"
            value={form.reason}
            onChange={(e) => update("reason", e.target.value)}
          />

          <button className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-3">
            Submit Address Change
          </button>

        </div>

        <Link
          href="/insurance/endorsements"
          className="inline-block mt-8 text-cyan-400 hover:underline"
        >
          ← Back to Endorsements
        </Link>

      </div>
    </main>
  );
}