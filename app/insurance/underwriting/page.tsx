"use client";

import Link from "next/link";

export default function IssuePolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
          My Vehicle Insurance
        </p>

        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          Policy Issuance
        </h1>

        <p className="mt-3 text-slate-400">
          Issue a new insurance policy after successful underwriting approval.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">
            Policy Issuance Engine
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">
                Underwriting Validation
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Validates approval before policy issuance.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">
                Policy Generation
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Generates policy number and creates policy record.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">
                Digital Policy
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Creates policy document and QR verification metadata.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">
                Audit Trail
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Stores issuance history and approval logs.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="mt-8 rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
            onClick={() =>
              window.alert(
                "Policy issuance backend is not connected yet. Connect this button to /api/insurance/policy/issue."
              )
            }
          >
            Issue Policy
          </button>

          <div className="mt-6">
            <Link
              href="/insurance/dashboard"
              className="text-cyan-400 hover:underline"
            >
              ← Back to Insurance Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}