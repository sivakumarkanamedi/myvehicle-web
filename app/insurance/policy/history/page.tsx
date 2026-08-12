import Link from "next/link";

export const metadata = {
  title: "Policy History | My Vehicle",
  description: "View all issued insurance policies.",
};

const policies = [
  {
    number: "MV-2026-000001",
    customer: "Rahul Sharma",
    vehicle: "KA01AB1234",
    type: "Comprehensive",
    status: "Active",
  },
  {
    number: "MV-2026-000002",
    customer: "Anjali Rao",
    vehicle: "KA05CD9876",
    type: "Third Party",
    status: "Expired",
  },
];

export default function PolicyHistoryPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          Policy History
        </h1>

        <p className="mt-2 text-slate-400">
          View all issued insurance policies.
        </p>

        <div className="overflow-x-auto mt-8 rounded-xl border border-slate-700">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr>
                <th className="p-4 text-left">Policy No</th>
                <th className="p-4 text-left">Customer</th>
                <th className="p-4 text-left">Vehicle</th>
                <th className="p-4 text-left">Type</th>
                <th className="p-4 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {policies.map((policy) => (
                <tr
                  key={policy.number}
                  className="border-t border-slate-800"
                >
                  <td className="p-4">{policy.number}</td>
                  <td className="p-4">{policy.customer}</td>
                  <td className="p-4">{policy.vehicle}</td>
                  <td className="p-4">{policy.type}</td>
                  <td className="p-4">{policy.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
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