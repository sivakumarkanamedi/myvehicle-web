import Link from "next/link";

export default function InsuranceDashboard() {
  const modules = [
    ["Customer Portal","/insurance/customer"],
    ["Operations Portal","/insurance/operations"],
    ["Management Center","/insurance/management"],
    ["Mira AI & Settings","/insurance/mira"],
    ["Policies","/insurance/policy/history"],
    ["Claims","/insurance/claims"],
    ["Underwriting","/insurance/underwriting"],
    ["Endorsements","/insurance/endorsements"],
    ["Cancellation & Refund","/insurance/policy/cancellation"],
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-cyan-900/40 via-slate-900 to-indigo-900/40 p-8">
          <p className="uppercase tracking-[0.25em] text-cyan-300 text-sm font-semibold">
            My Vehicle Insurance
          </p>
          <h1 className="mt-3 text-5xl font-bold">
            Final Integration Dashboard
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            One command center connecting every insurance module built for My Vehicle.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(([title,href])=>(
            <Link
              key={title}
              href={href}
              className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-cyan-400/40"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">{title}</h2>
                <span className="text-cyan-300 text-2xl">→</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Open {title}.
              </p>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat title="Modules" value="12+" />
          <Stat title="AI Ready" value="✓" />
          <Stat title="Realtime" value="Supabase" />
          <Stat title="Status" value="Integrated" />
        </section>
      </div>
    </main>
  );
}

function Stat({title,value}:{title:string;value:string}){
  return(
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <p className="text-slate-400 text-sm">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}