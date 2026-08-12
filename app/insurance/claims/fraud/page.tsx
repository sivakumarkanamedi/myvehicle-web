import Link from "next/link";

export const metadata = {
  title: "Claims Fraud Detection | My Vehicle",
  description:
    "Review suspicious insurance claims, fraud alerts and evidence anomalies.",
};

const fraudSignals = [
  {
    claim: "CLM-2026-1001",
    vehicle: "KA01AB1234",
    risk: "High",
    score: 82,
    reason: "Duplicate damage image detected",
    status: "Manual Review",
  },
  {
    claim: "CLM-2026-1002",
    vehicle: "KA05CD4567",
    risk: "Medium",
    score: 58,
    reason: "Incident timeline mismatch",
    status: "Under Review",
  },
  {
    claim: "CLM-2026-1003",
    vehicle: "KA09EF7890",
    risk: "Low",
    score: 18,
    reason: "No major anomaly detected",
    status: "Cleared",
  },
];

export default function ClaimsFraudPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Claims Fraud Detection Center
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review suspicious claims, duplicate images, document mismatches,
            unusual timelines and high-risk claim patterns.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="High Risk" value="1" />
          <MetricCard label="Manual Review" value="1" />
          <MetricCard label="Under Review" value="1" />
          <MetricCard label="Cleared" value="1" />
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Fraud Review Queue</h2>
            <p className="mt-1 text-sm text-slate-500">
              Claims sorted by fraud-risk score and review priority.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Claim</th>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-5 py-4">Risk</th>
                  <th className="px-5 py-4">Score</th>
                  <th className="px-5 py-4">Reason</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {fraudSignals.map((item) => (
                  <tr
                    key={item.claim}
                    className="border-t border-white/10 text-sm"
                  >
                    <td className="px-5 py-4 font-semibold">
                      {item.claim}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {item.vehicle}
                    </td>
                    <td className="px-5 py-4">
                      <RiskBadge risk={item.risk} />
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {item.score}/100
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {item.reason}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Duplicate image detection",
            "Document mismatch detection",
            "Incident timeline validation",
            "Claim pattern risk scoring",
          ].map((feature) => (
            <article
              key={feature}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
            >
              <p className="font-semibold">{feature}</p>
            </article>
          ))}
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
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{props.label}</p>
      <p className="mt-2 text-3xl font-bold">{props.value}</p>
    </article>
  );
}

function RiskBadge(props: {
  risk: string;
}) {
  const normalized = props.risk.toLowerCase();

  const classes =
    normalized === "high"
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : normalized === "medium"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {props.risk}
    </span>
  );
}