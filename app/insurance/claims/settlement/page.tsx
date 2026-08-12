import Link from "next/link";

export const metadata = {
  title: "Claims Settlement Center | My Vehicle",
  description:
    "Review approved claim amounts, payment status and claim closure.",
};

const settlements = [
  {
    claim: "CLM-2026-1001",
    customer: "Rahul Sharma",
    vehicle: "KA01AB1234",
    approvedAmount: "₹84,500",
    paymentStatus: "Pending",
    settlementStatus: "Approved",
  },
  {
    claim: "CLM-2026-1002",
    customer: "Anjali Rao",
    vehicle: "KA05CD4567",
    approvedAmount: "₹46,200",
    paymentStatus: "Processing",
    settlementStatus: "Approved",
  },
  {
    claim: "CLM-2026-1003",
    customer: "Kiran Kumar",
    vehicle: "KA09EF7890",
    approvedAmount: "₹1,12,000",
    paymentStatus: "Paid",
    settlementStatus: "Closed",
  },
];

export default function ClaimsSettlementPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Claims Settlement Center
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Review approved claim amounts, payment progress, customer payout
            status and final claim closure.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Approved Settlements"
            value="2"
            helper="Ready for payout"
          />

          <MetricCard
            label="Payment Processing"
            value="1"
            helper="Currently being paid"
          />

          <MetricCard
            label="Paid Claims"
            value="1"
            helper="Payment completed"
          />

          <MetricCard
            label="Total Approved"
            value="₹2,42,700"
            helper="Current settlement value"
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">
              Settlement Queue
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Claims awaiting payment, processing or closure.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Claim</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-5 py-4">Approved Amount</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Settlement</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {settlements.map((item) => (
                  <tr
                    key={item.claim}
                    className="border-t border-white/10 text-sm"
                  >
                    <td className="px-5 py-4 font-semibold">
                      {item.claim}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {item.customer}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {item.vehicle}
                    </td>

                    <td className="px-5 py-4 font-semibold text-emerald-300">
                      {item.approvedAmount}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge value={item.paymentStatus} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge value={item.settlementStatus} />
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Settlement approval",
            "Customer payout tracking",
            "Payment reference capture",
            "Claim closure workflow",
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

function StatusBadge(props: {
  value: string;
}) {
  const normalized = props.value.toLowerCase();

  const classes =
    ["paid", "closed", "approved"].includes(normalized)
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : ["pending", "processing"].includes(normalized)
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {props.value}
    </span>
  );
}