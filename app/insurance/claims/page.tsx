import Link from "next/link";

export const metadata = {
  title: "Claims Management | My Vehicle",
  description:
    "Manage insurance claims, damage assessment, fraud review and settlement.",
};

const claimModules = [
  {
    title: "New Claim",
    description:
      "Register a new motor insurance claim and capture incident details.",
    href: "/insurance/claims/new",
  },
  {
    title: "Claim Command Center",
    description:
      "Track all claims, current stages, pending actions and settlement status.",
    href: "/insurance/claims/dashboard",
  },
  {
    title: "AI Damage Assessment",
    description:
      "Review vehicle damage images, affected parts and repair estimates.",
    href: "/insurance/claims/damage-assessment",
  },
  {
    title: "AI Surveyor Assistant",
    description:
      "Support surveyors with inspection findings and claim recommendations.",
    href: "/insurance/claims/surveyor",
  },
  {
    title: "Fraud Detection",
    description:
      "Review suspicious claims, duplicate evidence and fraud-risk alerts.",
    href: "/insurance/claims/fraud",
  },
  {
    title: "Settlement Center",
    description:
      "Approve settlements, record payments and close completed claims.",
    href: "/insurance/claims/settlement",
  },
];

export default function ClaimsManagementPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-300">
            My Vehicle Insurance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            AI Claims Management Center
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Manage the complete claim journey from first notification and damage
            assessment to fraud review, survey, approval and settlement.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Open Claims"
            value="0"
            helper="Claims currently in progress"
          />

          <SummaryCard
            label="Pending Survey"
            value="0"
            helper="Awaiting surveyor review"
          />

          <SummaryCard
            label="Fraud Review"
            value="0"
            helper="Claims needing investigation"
          />

          <SummaryCard
            label="Settled Claims"
            value="0"
            helper="Successfully completed claims"
          />
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {claimModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-rose-400/30 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold">
                  {module.title}
                </h2>

                <span className="text-xl text-slate-600 transition group-hover:text-rose-300">
                  →
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {module.description}
              </p>

              <p className="mt-5 text-sm font-semibold text-rose-300">
                Open module
              </p>
            </Link>
          ))}
        </section>

        <div className="mt-8">
          <Link
            href="/insurance/dashboard"
            className="text-sm font-semibold text-cyan-300 hover:underline"
          >
            ← Back to Insurance Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <p className="text-sm font-medium text-slate-400">
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