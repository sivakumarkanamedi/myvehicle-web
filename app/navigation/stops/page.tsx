"use client";
import Link from "next/link";
const cards=[
["Nearest Fuel","2.4 km"],["Nearest EV","3.1 km"],["Nearest Mechanic","1.8 km"],["Nearest Hospital","4.6 km"],
["Nearest Police","5.0 km"],["Rest Stop","6.3 km"]];
export default function Page(){
return <main className="min-h-screen bg-slate-950 text-white p-8">
<div className="max-w-7xl mx-auto space-y-6">
<header className="rounded-3xl border border-white/10 bg-slate-900 p-8">
<p className="text-cyan-300 uppercase text-sm font-semibold tracking-[0.2em]">Mira Navigation</p>
<h1 className="text-5xl font-bold mt-3">Smart Stops</h1>
<p className="mt-4 text-slate-300">AI recommends useful stops along your route.</p>
</header>
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
{cards.map(c=><div key={c[0]} className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-slate-500 text-xs">{c[0]}</p><h2 className="text-3xl font-bold mt-3">{c[1]}</h2><button className="mt-4 w-full rounded-xl bg-cyan-400 text-slate-950 py-2 font-bold">Navigate</button></div>)}
</div>
<div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
<h2 className="text-2xl font-bold">Mira Recommendation</h2>
<ul className="list-disc list-inside mt-4 space-y-2 text-slate-300">
<li>Fuel level is low. Refuel within 20 km.</li>
<li>Take a 15 minute break after 2 hours of driving.</li>
<li>Nearest verified mechanic available on your route.</li>
<li>Hospital and police stations are continuously monitored for emergencies.</li>
</ul>
</div>
<Link href="/navigation" className="text-cyan-300">← Back to Navigation</Link>
</div></main>}