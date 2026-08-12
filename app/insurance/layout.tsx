import Link from "next/link";

const insuranceNavigation = [
  {
    label: "Dashboard",
    href: "/insurance/dashboard",
  },
  {
    label: "Customer Portal",
    href: "/insurance/customer",
  },
  {
    label: "Operations",
    href: "/insurance/operations",
  },
  {
    label: "Management",
    href: "/insurance/management",
  },
  {
    label: "Mira AI",
    href: "/insurance/mira",
  },
  {
    label: "Policies",
    href: "/insurance/policy/history",
  },
  {
    label: "Renewals",
    href: "/insurance/policy/renewal",
  },
  {
    label: "Claims",
    href: "/insurance/claims",
  },
  {
    label: "Underwriting",
    href: "/insurance/underwriting",
  },
  {
    label: "Endorsements",
    href: "/insurance/endorsements",
  },
  {
    label: "Cancellation & Refund",
    href: "/insurance/policy/cancellation",
  },
  {
    label: "Verify Policy",
    href: "/insurance/verify",
  },
];

export default function InsuranceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link
              href="/insurance/dashboard"
              className="text-lg font-bold tracking-tight text-white"
            >
              My Vehicle Insurance
            </Link>

            <p className="mt-0.5 text-xs text-slate-500">
              Powered by Mira AI
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Main App
            </Link>

            <Link
              href="/insurance/mira"
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Ask Mira
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-slate-950/70 lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r">
          <nav className="flex gap-2 overflow-x-auto p-4 lg:sticky lg:top-[73px] lg:block lg:space-y-2 lg:overflow-visible lg:p-5">
            {insuranceNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-white/10 hover:bg-white/5 hover:text-white lg:block"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {children}
        </section>
      </div>
    </div>
  );
}