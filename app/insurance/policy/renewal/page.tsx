import Link from "next/link";

export const metadata = {
  title: "Policy Renewal | My Vehicle",
  description: "Renew insurance policies.",
};

export default function PolicyRenewalPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          Policy Renewal Center
        </h1>

        <p className="mt-3 text-slate-400">
          Manage upcoming policy renewals and expired policies.
        </p>

        <div className="grid md:grid-cols-4 gap-6 mt-8">

          <div className="rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold">Due Today</h2>
            <p className="text-4xl mt-4 font-bold text-cyan-400">12</p>
          </div>

          <div className="rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold">Next 7 Days</h2>
            <p className="text-4xl mt-4 font-bold text-green-400">48</p>
          </div>

          <div className="rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold">Expired</h2>
            <p className="text-4xl mt-4 font-bold text-red-400">9</p>
          </div>

          <div className="rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold">Renewed</h2>
            <p className="text-4xl mt-4 font-bold text-yellow-400">156</p>
          </div>

        </div>

        <div className="mt-10 rounded-xl border border-slate-700 p-6">
          <h2 className="text-2xl font-semibold">
            Upcoming Renewals
          </h2>

          <p className="mt-3 text-slate-400">
            This page will display policies approaching expiry,
            AI renewal recommendations, premium comparison,
            and one-click renewal.
          </p>
        </div>

        <Link
          href="/insurance/dashboard"
          className="inline-block mt-8 text-cyan-400 hover:underline"
        >
          ← Back to Dashboard
        </Link>

      </div>
    </main>
  );
}