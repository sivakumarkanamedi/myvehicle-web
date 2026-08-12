import Link from "next/link";

export const metadata = {
  title: "Claims Analytics | My Vehicle",
  description:
    "Analyse claim volume, settlement trends, fraud alerts and processing performance.",
};

const monthlyClaims = [
  { month: "Jan", claims: 42, settled: 31, rejected: 4 },
  { month: "Feb", claims: 48, settled: 36, rejected: 5 },
  { month: "Mar", claims: 55, settled: 41, rejected: 6 },
  { month: "Apr", claims: 51, settled: 39, rejected: 4 },
  { month: "May", claims: 63, settled: 49, rejected: 7 },
  { month: "Jun", claims: 68, settled: 54, rejected: 6 },
];

const claimTypes = [
  { type: "Accident", count: 152, percentage: 46 },
  { type: "Theft", count: 42, percentage: 13 },
  { type: "Flood", count: 38, percentage: 12 },
  { type: "Glass Damage", count: 36, percentage: 11 },
  { type: "Fire", count: 29, percentage: 9 },
  { type: "Other", count: 30, percentage: 9 },
];

export default function ClaimsAnalyticsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Claims Analytics
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Monitor claim volume, approval performance, settlement value, fraud
            exposure and processing efficiency.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Claims"
            value="327"
            helper="Current reporting period"
          />

          <MetricCard
            label="Settlement Rate"
            value="76.5%"
            helper="Claims successfully settled"
          />

          <MetricCard
            label="Average Settlement"
            value="₹68,450"
            helper="Average approved payout"
          />

          <MetricCard
            label="Average Processing Time"
            value="6.8 days"
            helper="From registration to decision"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold">
              Monthly Claims Performance
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Claim registration, settlement and rejection trends.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-3">Month</th>
                    <th className="pb-3">Claims</th>
                    <th className="pb-3">Settled</th>
                    <th className="pb-3">Rejected</th>
                    <th className="pb-3">Settlement Rate</th>
                  </tr>
                </thead>

                <tbody>
                  {monthlyClaims.map((item) => (
                    <tr
                      key={item.month}
                      className="border-t border-white/10 text-sm"
                    >
                      <td className="py-4 font-semibold">
                        {item.month}
                      </td>

                      <td className="py-4 text-slate-300">
                        {item.claims}
                      </td>

                      <td className="py-4 text-emerald-300">
                        {item.settled}
                      </td>

                      <td className="py-4 text-rose-300">
                        {item.rejected}
                      </td>

                      <td className="py-4 text-slate-300">
                        {(
                          (item.settled / item.claims) *
                          100
                        ).toFixed(1)}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-xl font-bold">
              Claim Type Distribution
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Breakdown of claim volume by incident category.
            </p>

            <div className="mt-5 space-y-4">
              {claimTypes.map((item) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-300">
                      {item.type}
                    </span>

                    <span className="text-slate-500">
                      {item.count} · {item.percentage}%
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-violet-400"
                      style={{
                        width: `${item.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            title="Fraud Alert Rate"
            value="8.4%"
            description="Claims sent for fraud review."
          />

          <InsightCard
            title="Inspection Completion"
            value="92.1%"
            description="Required inspections completed."
          />

          <InsightCard
            title="Customer Response Time"
            value="4.2 hrs"
            description="Average first response time."
          />

          <InsightCard
            title="Total Settlement Value"
            value="₹2.24 Cr"
            description="Approved claim payouts."
          />
        </section>

        <div className="mt-8">
          <Link
            href="/insurance/claims"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Claims
          </Link>
        </div>
      </div>
    </main>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">
        {props.label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {props.value}
      </p>

      <p className="mt-2 text-xs text-slate-600">
        {props.helper}
      </p>
    </article>
  );
}

function InsightCard(props: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <p className="text-sm text-slate-400">
        {props.title}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {props.value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        {props.description}
      </p>
    </article>
  );
}