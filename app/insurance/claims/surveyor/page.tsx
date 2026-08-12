import Link from "next/link";

export const metadata = {
  title: "AI Surveyor Assistant | My Vehicle",
  description: "AI assisted vehicle survey and inspection.",
};

const inspections = [
  {
    claim: "CLM-2026-1001",
    vehicle: "KA01AB1234",
    status: "Pending",
  },
  {
    claim: "CLM-2026-1002",
    vehicle: "KA05CD4567",
    status: "In Progress",
  },
  {
    claim: "CLM-2026-1003",
    vehicle: "KA09EF7890",
    status: "Completed",
  },
];

export default function SurveyorPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          AI Surveyor Assistant
        </h1>

        <p className="mt-3 text-slate-400">
          Assist surveyors with inspections, damage analysis and AI recommendations.
        </p>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-4">Claim</th>
                <th className="text-left p-4">Vehicle</th>
                <th className="text-left p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {inspections.map((item) => (
                <tr
                  key={item.claim}
                  className="border-t border-slate-800"
                >
                  <td className="p-4">{item.claim}</td>
                  <td className="p-4">{item.vehicle}</td>
                  <td className="p-4">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">
            AI Survey Features
          </h2>

          <ul className="mt-4 space-y-2 text-slate-400">
            <li>✓ AI inspection checklist</li>
            <li>✓ Photo comparison</li>
            <li>✓ Repair recommendation</li>
            <li>✓ Parts replacement suggestion</li>
            <li>✓ Survey completion report</li>
          </ul>
        </div>

        <Link
          href="/insurance/claims"
          className="inline-block mt-8 text-cyan-400 hover:underline"
        >
          ← Back to Claims
        </Link>

      </div>
    </main>
  );
}