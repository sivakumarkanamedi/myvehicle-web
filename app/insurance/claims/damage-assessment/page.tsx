import Link from "next/link";

export const metadata = {
  title: "AI Damage Assessment | My Vehicle",
  description: "AI powered vehicle damage analysis.",
};

const damages = [
  { part: "Front Bumper", severity: "Medium", estimate: "₹12,500" },
  { part: "Headlight", severity: "High", estimate: "₹18,000" },
  { part: "Bonnet", severity: "Low", estimate: "₹7,500" },
];

export default function DamageAssessmentPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          AI Damage Assessment
        </h1>

        <p className="mt-3 text-slate-400">
          AI detects damaged vehicle parts and estimates repair costs.
        </p>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3">Vehicle Part</th>
                <th className="text-left py-3">Severity</th>
                <th className="text-left py-3">Estimated Cost</th>
              </tr>
            </thead>

            <tbody>
              {damages.map((damage) => (
                <tr key={damage.part} className="border-b border-slate-800">
                  <td className="py-4">{damage.part}</td>
                  <td>{damage.severity}</td>
                  <td>{damage.estimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">
            AI Features
          </h2>

          <ul className="mt-4 space-y-2 text-slate-400">
            <li>✓ Automatic damage detection</li>
            <li>✓ Repair cost estimation</li>
            <li>✓ Parts replacement recommendation</li>
            <li>✓ Total loss prediction</li>
            <li>✓ Fraud image detection</li>
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