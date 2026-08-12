import Link from "next/link";

export const metadata = {
  title: "Claims Dashboard | My Vehicle",
  description: "Monitor and manage insurance claims.",
};

const stats = [
  { title: "Open Claims", value: 18 },
  { title: "Under Review", value: 7 },
  { title: "Approved", value: 31 },
  { title: "Rejected", value: 3 },
];

export default function ClaimsDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          Claims Dashboard
        </h1>

        <p className="mt-2 text-slate-400">
          Real-time overview of insurance claims.
        </p>

        <div className="grid md:grid-cols-4 gap-6 mt-8">
          {stats.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-700 p-6 bg-slate-900"
            >
              <h2 className="text-sm text-slate-400">
                {item.title}
              </h2>

              <p className="mt-4 text-4xl font-bold text-cyan-400">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-slate-700 p-6 bg-slate-900">
          <h2 className="text-2xl font-semibold">
            Claims Queue
          </h2>

          <p className="mt-3 text-slate-400">
            This dashboard will display all incoming claims,
            AI priority score, survey status, fraud alerts,
            settlement progress and customer communication.
          </p>
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